export function registerRelationshipRoutes(app, dependencies) {
  const {
    autenticarUsuario, criarClienteAdmin, usuarioTemPerfil, verificarVinculoAceito,
  } = dependencies;

  app.get("/api/paciente/codigo-vinculo", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de cadastro indisponível." });

    const { data, error } = await admin
      .from("pacientes")
      .select("codigo_vinculo")
      .eq("usuario_id", autenticacao.user.id)
      .maybeSingle();
    if (error) {
      console.error("Erro ao carregar código de vínculo do paciente:", error);
      return res.status(500).json({ erro: "Não foi possível carregar seu código." });
    }
    if (!data?.codigo_vinculo) {
      return res.status(404).json({ erro: "Código não encontrado. Entre em contato com o suporte." });
    }

    return res.json({ codigo: data.codigo_vinculo });
  });

  app.get("/api/paciente/vinculos-pendentes", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de cadastro indisponível." });

    const { data: vinculos, error } = await admin
      .from("vinculos_paciente_psicologo")
      .select("id, psicologo_id, criado_em")
      .eq("paciente_id", autenticacao.user.id)
      .eq("status", "pendente")
      .neq("solicitado_por", autenticacao.user.id)
      .order("criado_em", { ascending: true });
    if (error) {
      console.error("Erro ao carregar solicitações de vínculo:", error);
      return res.status(500).json({ erro: "Não foi possível carregar as solicitações." });
    }
    if (!vinculos?.length) return res.json({ solicitacoes: [] });

    const idsPsicologos = [...new Set(vinculos.map((vinculo) => vinculo.psicologo_id))];
    const [{ data: perfis }, { data: usuarios }] = await Promise.all([
      admin.from("psicologos").select("usuario_id, crp").in("usuario_id", idsPsicologos),
      admin.from("usuarios").select("id, nome").in("id", idsPsicologos),
    ]);
    const perfisPorId = new Map((perfis || []).map((perfil) => [perfil.usuario_id, perfil]));
    const usuariosPorId = new Map((usuarios || []).map((usuario) => [usuario.id, usuario]));

    return res.json({
      solicitacoes: vinculos.map((vinculo) => ({
        id: vinculo.id,
        criado_em: vinculo.criado_em,
        psicologo: {
          nome: usuariosPorId.get(vinculo.psicologo_id)?.nome || "Profissional",
          crp: perfisPorId.get(vinculo.psicologo_id)?.crp || "",
        },
      })),
    });
  });

  app.post("/api/paciente/vinculos/:vinculoId/aceitar", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de cadastro indisponível." });

    const { data, error } = await admin
      .from("vinculos_paciente_psicologo")
      .update({ status: "aceito" })
      .eq("id", req.params.vinculoId)
      .eq("paciente_id", autenticacao.user.id)
      .eq("status", "pendente")
      .neq("solicitado_por", autenticacao.user.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Erro ao aceitar solicitação de vínculo:", error);
      return res.status(500).json({ erro: "Não foi possível aceitar a solicitação." });
    }
    if (!data) return res.status(404).json({ erro: "Solicitação pendente não encontrada." });

    return res.json({ mensagem: "Vínculo confirmado com sucesso." });
  });

  app.post("/api/psicologo/vinculos", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const codigo = String(req.body.codigo || "").trim().toUpperCase();
    if (!/^AFL-[A-F0-9]{6,12}$/.test(codigo)) {
      return res.status(400).json({ erro: "Informe um código de paciente válido." });
    }

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de cadastro indisponível." });

    const { data: paciente, error: erroPaciente } = await admin
      .from("pacientes")
      .select("usuario_id")
      .eq("codigo_vinculo", codigo)
      .maybeSingle();
    if (erroPaciente) {
      console.error("Erro ao localizar código de paciente:", erroPaciente);
      return res.status(500).json({ erro: "Não foi possível validar o código." });
    }
    if (!paciente) return res.status(404).json({ erro: "Código não encontrado. Confira com o paciente." });

    const { data: contaPaciente, error: erroContaPaciente } = await admin.auth.admin.getUserById(paciente.usuario_id);
    if (erroContaPaciente || !usuarioTemPerfil(contaPaciente?.user, "paciente")) {
      return res.status(404).json({ erro: "Código não encontrado. Confira com o paciente." });
    }

    const { data: vinculoExistente, error: erroVinculoExistente } = await admin
      .from("vinculos_paciente_psicologo")
      .select("status")
      .eq("paciente_id", paciente.usuario_id)
      .eq("psicologo_id", autenticacao.user.id)
      .maybeSingle();
    if (erroVinculoExistente) {
      console.error("Erro ao verificar vínculo existente:", erroVinculoExistente);
      return res.status(500).json({ erro: "Não foi possível verificar o vínculo." });
    }
    if (vinculoExistente) {
      const mensagem = vinculoExistente.status === "aceito"
        ? "Este paciente já está vinculado ao seu perfil."
        : "Já existe uma solicitação ou vínculo para este paciente.";
      return res.status(409).json({ erro: mensagem });
    }

    const { error } = await admin.from("vinculos_paciente_psicologo").insert({
      paciente_id: paciente.usuario_id,
      psicologo_id: autenticacao.user.id,
      solicitado_por: autenticacao.user.id,
      status: "pendente",
    });
    if (error) {
      console.error("Erro ao criar solicitação de vínculo:", error);
      return res.status(error.code === "23505" ? 409 : 500).json({
        erro: error.code === "23505"
          ? "Já existe uma solicitação ou vínculo para este paciente."
          : "Não foi possível enviar a solicitação.",
      });
    }

    return res.status(201).json({ mensagem: "Solicitação enviada. O vínculo será ativado quando o paciente aceitar." });
  });

  app.get("/api/psicologo/vinculos", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de cadastro indisponível." });

    const { data: vinculos, error } = await admin
      .from("vinculos_paciente_psicologo")
      .select("id, paciente_id, status, criado_em")
      .eq("psicologo_id", autenticacao.user.id)
      .in("status", ["pendente", "aceito"])
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("Erro ao carregar vínculos do psicólogo:", error);
      return res.status(500).json({ erro: "Não foi possível carregar os vínculos." });
    }

    const idsPacientes = [...new Set((vinculos || [])
      .filter((vinculo) => vinculo.status === "aceito")
      .map((vinculo) => vinculo.paciente_id))];
    const { data: usuarios } = idsPacientes.length
      ? await admin.from("usuarios").select("id, nome, avatar_url").in("id", idsPacientes)
      : { data: [] };
    const usuariosPorId = new Map((usuarios || []).map((usuario) => [usuario.id, usuario]));
    const usuariosSemFoto = idsPacientes.filter((id) => !usuariosPorId.get(id)?.avatar_url);
    await Promise.all(usuariosSemFoto.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      const metadata = data?.user?.user_metadata || {};
      const avatarUrl = metadata.avatar_url || metadata.picture || null;
      if (avatarUrl) usuariosPorId.set(id, { ...usuariosPorId.get(id), avatar_url: avatarUrl });
    }));
    const partesData = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Recife",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const dataLocal = Object.fromEntries(partesData.map(({ type, value }) => [type, value]));
    const hoje = `${dataLocal.year}-${dataLocal.month}-${dataLocal.day}`;
    const { data: eventosFuturos, error: erroEventos } = idsPacientes.length
      ? await admin.from("eventos_agenda")
        .select("id, paciente_id, tipo, titulo, data_evento, hora, detalhes")
        .eq("psicologo_id", autenticacao.user.id)
        .in("paciente_id", idsPacientes)
        .in("tipo", ["compromisso", "aviso", "consulta"])
        .gte("data_evento", hoje)
        .order("data_evento", { ascending: true })
        .order("hora", { ascending: true })
      : { data: [], error: null };
    if (erroEventos) {
      console.error("Erro ao carregar eventos dos pacientes:", erroEventos);
      return res.status(500).json({ erro: "Não foi possível carregar os próximos compromissos." });
    }
    const eventosPorPaciente = new Map();
    (eventosFuturos || []).forEach((evento) => {
      const lista = eventosPorPaciente.get(evento.paciente_id) || [];
      lista.push({
        id: evento.id,
        tipo: evento.tipo,
        titulo: evento.titulo,
        data: evento.data_evento,
        hora: String(evento.hora).slice(0, 5),
        detalhes: evento.detalhes,
      });
      eventosPorPaciente.set(evento.paciente_id, lista);
    });

    return res.json({
      vinculos: (vinculos || []).map((vinculo) => ({
        id: vinculo.id,
        paciente_id: vinculo.paciente_id,
        status: vinculo.status,
        criado_em: vinculo.criado_em,
        paciente: vinculo.status === "aceito"
          ? (() => {
            const usuarioPaciente = usuariosPorId.get(vinculo.paciente_id) || {};
            const eventosPaciente = eventosPorPaciente.get(vinculo.paciente_id) || [];
            return {
              nome: usuarioPaciente.nome || "Paciente",
              avatar_url: usuarioPaciente.avatar_url || null,
              eventos: eventosPaciente,
            };
          })()
          : null,
      })),
    });
  });

  app.get("/api/psicologo/eventos", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const inicio = String(req.query.inicio || "");
    const fim = String(req.query.fim || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
      return res.status(400).json({ erro: "Informe um intervalo de datas válido." });
    }

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço da agenda indisponível." });
    const { data: eventos, error } = await admin.from("eventos_agenda")
      .select("id, tipo, titulo, data_evento, hora, detalhes, notificar, paciente_id")
      .eq("psicologo_id", autenticacao.user.id)
      .gte("data_evento", inicio)
      .lte("data_evento", fim)
      .order("data_evento", { ascending: true })
      .order("hora", { ascending: true });
    if (error) {
      console.error("Erro ao carregar agenda do psicólogo:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code)) {
        return res.status(503).json({
          erro: "O banco ainda não está com a estrutura atualizada da agenda.",
        });
      }
      return res.status(500).json({
        erro: "Não foi possível carregar a agenda.",
        ...(error.code ? { codigo: error.code } : {}),
      });
    }

    const idsPacientes = [...new Set((eventos || []).map((evento) => evento.paciente_id).filter(Boolean))];
    const { data: usuarios, error: erroUsuarios } = idsPacientes.length
      ? await admin.from("usuarios").select("id, nome").in("id", idsPacientes)
      : { data: [] };
    if (erroUsuarios) {
      console.error("Erro ao carregar pacientes da agenda:", {
        code: erroUsuarios.code,
        message: erroUsuarios.message,
        details: erroUsuarios.details,
        hint: erroUsuarios.hint,
      });
      return res.status(500).json({
        erro: "A agenda carregou, mas não foi possível carregar os nomes dos pacientes.",
        ...(erroUsuarios.code ? { codigo: erroUsuarios.code } : {}),
      });
    }
    const nomes = new Map((usuarios || []).map((usuario) => [usuario.id, usuario.nome]));
    return res.json({
      eventos: (eventos || []).map((evento) => ({
        id: evento.id,
        tipo: evento.tipo,
        titulo: evento.titulo,
        data: evento.data_evento,
        hora: String(evento.hora).slice(0, 5),
        detalhes: evento.detalhes,
        notificar: evento.notificar,
        paciente_id: evento.paciente_id,
        paciente_nome: evento.paciente_id ? nomes.get(evento.paciente_id) || "Paciente" : null,
      })),
    });
  });

  app.post("/api/psicologo/eventos", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const tipo = String(req.body.tipo || "");
    const titulo = String(req.body.titulo || "").trim();
    const data = String(req.body.data || "");
    const hora = String(req.body.hora || "");
    const detalhes = String(req.body.detalhes || "").trim();
    const pacienteId = req.body.paciente_id || null;
    if (!["compromisso", "aviso", "consulta"].includes(tipo)) {
      return res.status(400).json({ erro: "Tipo de evento inválido." });
    }
    if (!titulo || titulo.length > 90 || !/^\d{4}-\d{2}-\d{2}$/.test(data)
      || !/^\d{2}:\d{2}$/.test(hora) || detalhes.length > 300) {
      return res.status(400).json({ erro: "Confira título, data, horário e observações do evento." });
    }
    if (tipo === "consulta" && !pacienteId) {
      return res.status(400).json({ erro: "Selecione o paciente desta consulta." });
    }
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço da agenda indisponível." });
    if (pacienteId) {
      const { aceito, error } = await verificarVinculoAceito(admin, autenticacao.user.id, pacienteId);
      if (error) return res.status(500).json({ erro: "Não foi possível validar o vínculo do paciente." });
      if (!aceito) return res.status(403).json({ erro: "Só é possível criar eventos para pacientes vinculados." });
    }

    const { data: eventoSalvo, error } = await admin.from("eventos_agenda").insert({
      psicologo_id: autenticacao.user.id,
      paciente_id: pacienteId,
      tipo,
      titulo,
      data_evento: data,
      hora,
      detalhes: detalhes || null,
      notificar: false,
    }).select("id, tipo, titulo, data_evento, hora, detalhes, notificar, paciente_id").single();
    if (error) {
      console.error("Erro ao salvar evento da agenda:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code)) {
        return res.status(503).json({
          erro: "O banco ainda não está com a estrutura atualizada da agenda. Aplique a migração 20261116_agenda_consulta_events.sql no Supabase.",
          codigo: error.code,
        });
      }
      return res.status(500).json({
        erro: "Não foi possível salvar o evento.",
        ...(error.code ? { codigo: error.code } : {}),
      });
    }
    return res.status(201).json({ evento: {
      id: eventoSalvo.id,
      tipo: eventoSalvo.tipo,
      titulo: eventoSalvo.titulo,
      data: eventoSalvo.data_evento,
      hora: eventoSalvo.hora,
      detalhes: eventoSalvo.detalhes,
      notificar: eventoSalvo.notificar,
      paciente_id: eventoSalvo.paciente_id,
    } });
  });

  app.delete("/api/psicologo/eventos/:eventoId", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço da agenda indisponível." });
    const { data, error } = await admin.from("eventos_agenda")
      .delete()
      .eq("id", req.params.eventoId)
      .eq("psicologo_id", autenticacao.user.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("Erro ao excluir evento da agenda:", error);
      return res.status(500).json({ erro: "Não foi possível excluir o evento." });
    }
    if (!data) return res.status(404).json({ erro: "Evento não encontrado." });
    return res.json({ mensagem: "Evento removido." });
  });
}
