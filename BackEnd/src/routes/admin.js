export function registerAdminRoutes(app, dependencies) {
  const { autenticarAdmin, criarClienteAdmin } = dependencies;

  app.get("/api/admin/psychologists/pending", async (req, res) => {
    const autenticacao = await autenticarAdmin(req);
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço administrativo indisponível." });

    const { data: psicologos, error } = await admin
      .from("psicologos")
      .select("usuario_id, cpf, crp, telefone, criado_em")
      .eq("status_verificacao", "pendente")
      .order("criado_em", { ascending: true });

    if (error) {
      console.error("Erro ao listar cadastros pendentes:", error);
      return res.status(500).json({ erro: "Não foi possível carregar os cadastros pendentes." });
    }

    const ids = (psicologos || []).map((perfil) => perfil.usuario_id);
    if (!ids.length) return res.json({ cadastros: [] });

    const { data: usuarios, error: erroUsuarios } = await admin
      .from("usuarios")
      .select("id, nome, email")
      .in("id", ids);
    if (erroUsuarios) {
      console.error("Erro ao carregar dados das contas pendentes:", erroUsuarios);
      return res.status(500).json({ erro: "Não foi possível carregar os dados das contas." });
    }

    const usuariosPorId = new Map((usuarios || []).map((usuario) => [usuario.id, usuario]));
    return res.json({
      cadastros: psicologos.map((perfil) => ({
        ...perfil,
        usuario: usuariosPorId.get(perfil.usuario_id) || null,
      })),
    });
  });

  app.post("/api/admin/psychologists/:usuarioId/review", async (req, res) => {
    const autenticacao = await autenticarAdmin(req);
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const { decisao, registroConferido, identidadeConferida, observacao = "" } = req.body;
    if (!["aprovado", "recusado"].includes(decisao)) {
      return res.status(400).json({ erro: "Decisão inválida." });
    }
    if (decisao === "aprovado"
      && (registroConferido !== true || identidadeConferida !== true)) {
      return res.status(400).json({ erro: "Para aprovar, confirme o CRP no CFP e a identidade do profissional." });
    }
    if (decisao === "recusado" && !String(observacao).trim()) {
      return res.status(400).json({ erro: "Informe o motivo da recusa." });
    }

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço administrativo indisponível." });

    const usuarioId = req.params.usuarioId;
    const { data: perfil, error: erroPerfil } = await admin
      .from("psicologos")
      .select("usuario_id")
      .eq("usuario_id", usuarioId)
      .eq("status_verificacao", "pendente")
      .maybeSingle();
    if (erroPerfil) return res.status(500).json({ erro: "Não foi possível localizar o cadastro." });
    if (!perfil) return res.status(404).json({ erro: "Cadastro pendente não encontrado." });

    const agora = new Date().toISOString();
    const { data: revisao, error: erroAtualizacao } = await admin
      .from("psicologos")
      .update({
        status_verificacao: decisao,
        registro_verificado: decisao === "aprovado" && registroConferido === true,
        identidade_verificada: decisao === "aprovado" && identidadeConferida === true,
        verificado_por: autenticacao.user.id,
        verificado_em: agora,
        observacao_verificacao: String(observacao).trim() || null,
      })
      .eq("usuario_id", usuarioId)
      .eq("status_verificacao", "pendente")
      .select("usuario_id")
      .maybeSingle();
    if (erroAtualizacao) {
      console.error("Erro ao registrar revisão profissional:", erroAtualizacao);
      return res.status(500).json({ erro: "Não foi possível registrar a decisão." });
    }
    if (!revisao) return res.status(409).json({ erro: "Este cadastro já foi revisado por outra pessoa." });

    const desfazerRevisao = async () => {
      await admin.from("psicologos").update({
        status_verificacao: "pendente",
        registro_verificado: false,
        identidade_verificada: false,
        verificado_por: null,
        verificado_em: null,
        observacao_verificacao: null,
      }).eq("usuario_id", usuarioId).eq("status_verificacao", decisao);
    };

    const { data: conta, error: erroConta } = await admin.auth.admin.getUserById(usuarioId);
    if (erroConta || !conta.user) {
      await desfazerRevisao();
      return res.status(500).json({ erro: "Decisão registrada, mas não foi possível atualizar o acesso. Tente novamente." });
    }

    const roles = new Set(Array.isArray(conta.user.app_metadata?.roles)
      ? conta.user.app_metadata.roles.filter((role) => ["paciente", "psicologo"].includes(role))
      : []);
    if (decisao === "aprovado") roles.add("psicologo");
    else roles.delete("psicologo");

    const { error: erroPapel } = await admin.auth.admin.updateUserById(usuarioId, {
      app_metadata: {
        ...(conta.user.app_metadata || {}),
        roles: [...roles],
        psicologo_status: decisao,
      },
    });
    if (erroPapel) {
      console.error("Erro ao atualizar papel após revisão:", erroPapel);
      await desfazerRevisao();
      return res.status(500).json({ erro: "Decisão registrada, mas não foi possível atualizar o acesso." });
    }

    return res.json({ mensagem: `Cadastro ${decisao} com sucesso.` });
  });
}
