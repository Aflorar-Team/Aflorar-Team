import nodemailer from "nodemailer";

export function registerProfileRoutes(app, dependencies) {
  const {
    SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
    EMAIL_FROM, SMTP_USER, SMTP_APP_PASSWORD, FRONTEND_URL,
    fetch: fetchImpl, createTransport = nodemailer.createTransport,
    supabase, normalizarCpf, normalizarTelefone, normalizarCrp, criarClienteAuth,
    criarClienteAdmin, usuarioTemPerfil, usuarioComPerfil, salvarPerfilConta, cadastrarPerfil,
  } = dependencies;
  const enviosRecentes = new Map();
  const transportadorGmail = SMTP_USER && SMTP_APP_PASSWORD
    ? createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD },
    })
    : null;
  const resendDisponivel = Boolean(RESEND_API_KEY && EMAIL_FROM);
  const emailDisponivel = Boolean(transportadorGmail || resendDisponivel);

  function excedeuLimite(req, chave, maximo) {
    const agora = Date.now();
    if (enviosRecentes.size > 1000) {
      for (const [id, instantes] of enviosRecentes) {
        if (!instantes.some((instante) => agora - instante < 15 * 60 * 1000)) enviosRecentes.delete(id);
      }
    }
    const ip = req.ip || req.socket.remoteAddress || "desconhecido";
    const id = `${chave}:${ip}`;
    const recentes = (enviosRecentes.get(id) || []).filter((instante) => agora - instante < 15 * 60 * 1000);
    if (recentes.length >= maximo) {
      enviosRecentes.set(id, recentes);
      return true;
    }
    recentes.push(agora);
    enviosRecentes.set(id, recentes);
    return false;
  }

  function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, (caractere) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    })[caractere]);
  }

  async function enviarEmail({ para, assunto, texto, html, responderPara }) {
    if (transportadorGmail) {
      try {
        await transportadorGmail.sendMail({
          from: { name: "Aflorar", address: SMTP_USER },
          to: para,
          subject: assunto,
          text: texto,
          html,
          ...(responderPara ? { replyTo: responderPara } : {}),
        });
        return true;
      } catch (error) {
        console.error("Falha ao enviar e-mail pelo Gmail:", error.code || error.name || "erro desconhecido");
        if (!resendDisponivel) return false;
        console.info("Tentando enviar pelo Resend após falha no Gmail SMTP.");
      }
    }

    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [para],
        subject: assunto,
        text: texto,
        html,
        ...(responderPara ? { reply_to: responderPara } : {}),
      }),
    });
    if (!response.ok) {
      console.error("O provedor de e-mail recusou a mensagem:", response.status);
      return false;
    }
    return true;
  }

  async function autenticarConta(req) {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { erro: "Autenticação obrigatória.", status: 401 };
    const clienteAuth = criarClienteAuth();
    const { data, error } = await clienteAuth.auth.getUser(token);
    if (error || !data.user) return { erro: "Sessão inválida ou expirada.", status: 401 };
    if (!["paciente", "psicologo"].some((perfil) => usuarioTemPerfil(data.user, perfil))) {
      return { erro: "Acesso não autorizado.", status: 403 };
    }
    return { user: data.user };
  }

  app.get("/api/configuracoes/tema", async (req, res) => {
    const autenticacao = await autenticarConta(req);
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de configurações indisponível." });

    const { data, error } = await admin.from("configuracoes_usuario")
      .select("tema")
      .eq("usuario_id", autenticacao.user.id)
      .maybeSingle();
    if (error) {
      console.error("Erro ao carregar o tema da conta:", error);
      return res.status(500).json({ erro: "Não foi possível carregar o tema da conta." });
    }
    return res.json({ tema: data?.tema || "claro", configurado: Boolean(data) });
  });

  app.put("/api/configuracoes/tema", async (req, res) => {
    const autenticacao = await autenticarConta(req);
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const { tema } = req.body;
    if (!["claro", "escuro"].includes(tema)) {
      return res.status(400).json({ erro: "Tema inválido." });
    }
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de configurações indisponível." });

    const { error } = await admin.from("configuracoes_usuario").upsert({
      usuario_id: autenticacao.user.id,
      tema,
    }, { onConflict: "usuario_id" });
    if (error) {
      console.error("Erro ao salvar o tema da conta:", error);
      return res.status(500).json({ erro: "Não foi possível salvar o tema da conta." });
    }
    return res.json({ tema });
  });

  app.put("/api/configuracoes/perfil", async (req, res) => {
    const autenticacao = await autenticarConta(req);
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const { perfil, senha } = req.body;
    if (!["paciente", "psicologo"].includes(perfil)
      || !usuarioTemPerfil(autenticacao.user, perfil)) {
      return res.status(403).json({ erro: "Perfil não autorizado para esta conta." });
    }

    const dadosPerfil = {
      nome: String(req.body.nome || "").trim(),
      telefone: normalizarTelefone(req.body.telefone),
    };
    if (perfil === "psicologo") dadosPerfil.crp = normalizarCrp(req.body.crp);
    if (!dadosPerfil.nome || dadosPerfil.nome.length > 100
      || dadosPerfil.telefone.length < 10 || dadosPerfil.telefone.length > 11) {
      return res.status(400).json({ erro: "Confira nome e telefone antes de salvar." });
    }
    if (perfil === "psicologo" && !/^\d{2}\/\d{4,8}$/.test(dadosPerfil.crp)) {
      return res.status(400).json({ erro: "Informe o CRP no formato UF/número." });
    }
    if (senha && (senha.length < 6 || senha.length > 20)) {
      return res.status(400).json({ erro: "A nova senha deve ter entre 6 e 20 caracteres." });
    }

    try {
      const resultado = await salvarPerfilConta({
        usuarioId: autenticacao.user.id,
        perfil,
        dadosPerfil,
        senha: senha || undefined,
        preservarCpf: true,
      });
      if (resultado.erro) return res.status(resultado.status).json({ erro: resultado.erro });
      return res.json({
        mensagem: "Dados atualizados com sucesso.",
        usuario: resultado.usuario,
        statusPerfil: resultado.statusPerfil,
      });
    } catch (error) {
      console.error("Erro ao atualizar dados da conta:", error);
      return res.status(500).json({ erro: "Não foi possível atualizar os dados da conta." });
    }
  });

  app.post("/api/auth/recover", async (req, res) => {
    if (excedeuLimite(req, "recuperacao", 5)) {
      return res.status(429).json({ erro: "Muitas solicitações. Aguarde 15 minutos e tente novamente." });
    }
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ erro: "Informe um e-mail válido." });
    }
    if (!emailDisponivel) {
      return res.status(503).json({ erro: "O envio de e-mails ainda não está configurado no servidor." });
    }
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "O serviço de recuperação está indisponível." });

    const mensagemGenerica = "Se houver uma conta com esse e-mail, enviaremos um link para redefinir a senha.";
    const redirectTo = `${(FRONTEND_URL || "https://aflorar-team.vercel.app").replace(/\/+$/, "")}/redefinir-senha.html`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (error || !data?.properties?.action_link) {
      if (error && !/user not found|not found/i.test(error.message || "")) {
        console.error("Não foi possível gerar o link de recuperação:", error);
      }
      return res.json({ mensagem: mensagemGenerica });
    }

    const link = data.properties.action_link;
    const enviado = await enviarEmail({
      para: email,
      assunto: "Redefinição de senha - Aflorar",
      texto: `Recebemos uma solicitação para redefinir sua senha. Acesse este link: ${link}\n\nSe você não solicitou, ignore esta mensagem.`,
      html: `<p>Recebemos uma solicitação para redefinir sua senha.</p><p><a href="${escaparHtml(link)}">Criar nova senha</a></p><p>Se você não solicitou, ignore esta mensagem.</p>`,
    });
    if (!enviado) return res.status(503).json({ erro: "Não foi possível enviar o e-mail. Tente novamente mais tarde." });
    return res.json({ mensagem: mensagemGenerica });
  });

  app.get("/api/auth-config", (req, res) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ erro: "Configuração pública do Supabase ausente." });
    }

    return res.json({ url: SUPABASE_URL, anonKey: SUPABASE_KEY });
  });
  app.post("/api/oauth/complete-profile", async (req, res) => {
    const { tipo, nome, cpf, telefone, crp } = req.body;
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) return res.status(401).json({ erro: "Sessão não autenticada." });
    if (!["paciente", "psicologo"].includes(tipo)) {
      return res.status(400).json({ erro: "Tipo de perfil inválido." });
    }

    const dadosPerfil = {
      nome: String(nome || "").trim(),
      cpf: normalizarCpf(cpf),
      telefone: normalizarTelefone(telefone),
    };
    if (tipo === "psicologo") {
      dadosPerfil.crp = normalizarCrp(crp);
    }

    if (!dadosPerfil.nome || dadosPerfil.cpf.length !== 11
      || dadosPerfil.telefone.length < 10 || dadosPerfil.telefone.length > 11) {
      return res.status(400).json({ erro: "Nome, CPF ou telefone inválido." });
    }
    if (tipo === "psicologo" && !/^\d{2}\/\d{4,8}$/.test(dadosPerfil.crp)) {
      return res.status(400).json({ erro: "Informe o CRP no formato UF/número." });
    }

    try {
      const clienteAuth = criarClienteAuth();
      const { data: autenticacao, error: erroAuth } = await clienteAuth.auth.getUser(token);
      if (erroAuth || !autenticacao.user) {
        return res.status(401).json({ erro: "Sessão inválida ou expirada." });
      }

      const resultado = await salvarPerfilConta({
        usuarioId: autenticacao.user.id,
        perfil: tipo,
        dadosPerfil,
      });
      if (resultado.erro) return res.status(resultado.status).json({ erro: resultado.erro });

      return res.json({
        mensagem: tipo === "psicologo" && resultado.statusPerfil === "pendente"
          ? "Cadastro recebido e aguardando verificação profissional."
          : "Perfil salvo com sucesso!",
        usuario: resultado.usuario,
        statusPerfil: resultado.statusPerfil,
      });
    } catch (error) {
      console.error("Erro ao concluir perfil OAuth:", error);
      return res.status(500).json({ erro: "Erro ao salvar o perfil." });
    }
  });

  app.post("/api/cadastro-paciente", async (req, res) => {
    const { nome, email, senha, cpf, telefone } = req.body;

    if (!nome || !email || !senha || !cpf || !telefone)
      return res.status(400).json({ erro: "Preencha todos os campos." });

    const cpfLimpo = normalizarCpf(cpf);
    const telefoneLimpo = normalizarTelefone(telefone);

    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ erro: "CPF inválido." });
    }

    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      return res.status(400).json({ erro: "Telefone inválido." });
    }

    try {
      const resultado = await cadastrarPerfil({
        email,
        senha,
        perfil: "paciente",
        dadosPerfil: { nome, cpf: cpfLimpo, telefone: telefoneLimpo },
      });

      if (resultado.erro) return res.status(resultado.status).json({ erro: resultado.erro });

      return res.json({
        mensagem: "Cadastro realizado com sucesso!",
        usuario: resultado.usuario,
        contaExistente: resultado.contaExistente,
      });
    } catch (error) {
      console.error("Erro no cadastro do paciente:", error);
      return res.status(500).json({
        erro: "Erro de conexão com o Supabase. Verifique a URL e a chave de autenticação.",
      });
    }
  });

  app.post(["/api/login", "/api/login-paciente"], async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha)
      return res.status(400).json({ erro: "Preencha e-mail e senha." });

    if (!supabase) {
      return res.status(500).json({
        erro: "Configuração do Supabase ausente no deploy. Verifique as variáveis SUPABASE_URL e SUPABASE_KEY no Render.",
      });
    }

    try {
      const clienteAuth = criarClienteAuth();
      const { data, error } = await clienteAuth.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) return res.status(400).json({ erro: "E-mail ou senha inválidos." });
      if (!usuarioTemPerfil(data.user, "paciente")) {
        return res.status(403).json({ erro: "Acesso negado. Use o login de psicólogo." });
      }

      return res.json({
        mensagem: "Login realizado com sucesso!",
        usuario: usuarioComPerfil(data.user, "paciente"),
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      });
    } catch (error) {
      console.error("Erro no login do paciente:", error);
      return res.status(500).json({ erro: "Erro de conexão com o Supabase." });
    }
  });

  app.post("/api/refresh-session", async (req, res) => {
    const { refreshToken, tipo } = req.body;
    if (!refreshToken || !["paciente", "psicologo"].includes(tipo)) {
      return res.status(400).json({ erro: "Dados de sessão inválidos." });
    }

    if (!SUPABASE_URL || !(SUPABASE_KEY || SUPABASE_SERVICE_ROLE_KEY)) {
      return res.status(500).json({ erro: "Configuração do Supabase ausente." });
    }

    try {
      const clienteAuth = criarClienteAuth();
      const { data, error } = await clienteAuth.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session || !data.user) {
        return res.status(401).json({ erro: "Sessão expirada. Faça login novamente." });
      }

      if (!usuarioTemPerfil(data.user, tipo)) {
        return res.status(403).json({ erro: "Acesso negado para este tipo de conta." });
      }

      return res.json({
        usuario: usuarioComPerfil(data.user, tipo),
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      });
    } catch (error) {
      console.error("Erro ao renovar sessão:", error);
      return res.status(500).json({ erro: "Erro ao renovar a sessão." });
    }
  });

  app.post("/api/cadastro-psicologo", async (req, res) => {
    const { nome, cpf, crp, email, telefone, senha } = req.body;
    if (!nome || !cpf || !crp || !email || !telefone || !senha)
      return res.status(400).json({ erro: "Preencha todos os campos." });

    const dadosPerfil = {
      nome: String(nome).trim(),
      cpf: normalizarCpf(cpf),
      crp: normalizarCrp(crp),
      telefone: normalizarTelefone(telefone),
    };
    if (dadosPerfil.cpf.length !== 11) return res.status(400).json({ erro: "CPF inválido." });
    if (!/^\d{2}\/\d{4,8}$/.test(dadosPerfil.crp)) {
      return res.status(400).json({ erro: "Informe o CRP no formato UF/número." });
    }
    if (dadosPerfil.telefone.length < 10 || dadosPerfil.telefone.length > 11) {
      return res.status(400).json({ erro: "Telefone inválido." });
    }

    try {
      const resultado = await cadastrarPerfil({
        email,
        senha,
        perfil: "psicologo",
        dadosPerfil,
      });

      if (resultado.erro) return res.status(resultado.status).json({ erro: resultado.erro });
      return res.json({
        mensagem: resultado.statusPerfil === "pendente"
          ? "Cadastro recebido. O acesso profissional será liberado após a verificação do CRP."
          : "Perfil de psicólogo atualizado.",
        usuario: resultado.usuario,
        contaExistente: resultado.contaExistente,
        statusPerfil: resultado.statusPerfil,
      });
    } catch (error) {
      console.error("Erro no cadastro do psicólogo:", error);
      return res.status(500).json({ erro: "Erro ao salvar o cadastro do psicólogo." });
    }
  });

  app.post("/api/login-psicologo", async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha)
      return res.status(400).json({ erro: "Preencha e-mail e senha." });

    if (!supabase) return res.status(500).json({ erro: "Configuração do Supabase ausente." });

    let data;
    let error;
    try {
      const clienteAuth = criarClienteAuth();
      ({ data, error } = await clienteAuth.auth.signInWithPassword({ email, password: senha }));
    } catch (loginError) {
      console.error("Erro no login do psicólogo:", loginError);
      return res.status(500).json({ erro: "Erro de conexão com o Supabase." });
    }

    if (error) return res.status(400).json({ erro: "E-mail ou senha inválidos." });

    if (data.user?.app_metadata?.psicologo_status === "pendente") {
      return res.status(403).json({ erro: "Seu cadastro profissional aguarda a verificação do CRP." });
    }
    if (data.user?.app_metadata?.psicologo_status === "recusado") {
      return res.status(403).json({ erro: "Seu cadastro profissional não foi aprovado. Entre em contato com o suporte." });
    }

    if (!usuarioTemPerfil(data.user, "psicologo")) {
      return res.status(403).json({ erro: "Acesso negado. Use o login de paciente." });
    }

    res.json({
      mensagem: "Login realizado com sucesso!",
      usuario: usuarioComPerfil(data.user, "psicologo"),
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    });
  });
}
