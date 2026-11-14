const PERFIS = {
  paciente: {
    participanteId: "psicologo_id",
    outroId: "psicologoId",
    tabelaRelacionamento: "vinculos_paciente_psicologo",
  },
  psicologo: {
    participanteId: "paciente_id",
    outroId: "pacienteId",
    tabelaRelacionamento: "vinculos_paciente_psicologo",
  },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerConversationRoutes(app, dependencies) {
  const { autenticarUsuario, criarClienteAdmin } = dependencies;

  async function carregarConversas(perfil, req, res) {
    const autenticacao = await autenticarUsuario(req, perfil);
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de mensagens indisponível." });

    const usuarioId = autenticacao.user.id;
    const config = PERFIS[perfil];
    const campoUsuario = perfil === "paciente" ? "paciente_id" : "psicologo_id";
    const campoOutro = config.participanteId;
    const { data: vinculos, error: erroVinculos } = await admin
      .from(config.tabelaRelacionamento)
      .select(`${campoOutro}`)
      .eq(campoUsuario, usuarioId)
      .eq("status", "aceito");
    if (erroVinculos) {
      console.error("Erro ao carregar vínculos para conversas:", erroVinculos);
      return res.status(500).json({ erro: "Não foi possível carregar seus contatos." });
    }

    const idsContatos = [...new Set((vinculos || []).map((vinculo) => vinculo[campoOutro]))];
    if (!idsContatos.length) return res.json({ contatos: [] });

    const tabelaUsuarios = "usuarios";
    const [{ data: usuarios, error: erroUsuarios }, { data: conversas, error: erroConversas }] = await Promise.all([
      admin.from(tabelaUsuarios).select("id, nome, avatar_url").in("id", idsContatos),
      admin.from("conversas")
        .select("id, paciente_id, psicologo_id, criado_em, atualizado_em, psicologo_leu_ate")
        .eq("tipo", "paciente_psicologo")
        .eq(campoUsuario, usuarioId)
        .in(campoOutro, idsContatos),
    ]);

    if (erroUsuarios || erroConversas) {
      console.error("Erro ao carregar contatos e conversas:", erroUsuarios || erroConversas);
      return res.status(500).json({ erro: "Não foi possível carregar suas conversas." });
    }

    const usuariosPorId = new Map((usuarios || []).map((usuario) => [usuario.id, usuario]));
    const conversasPorContato = new Map((conversas || []).map((conversa) => [
      conversa[campoOutro],
      conversa,
    ]));
    const conversasComUltimaMensagem = await Promise.all((conversas || []).map(async (conversa) => {
      const { data, error } = await admin.from("mensagens_conversa")
        .select("conteudo, remetente_id, papel_remetente, criado_em")
        .eq("conversa_id", conversa.id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Erro ao carregar prévia de mensagem:", error);
        throw error;
      }

      let mensagemNaoLida = null;
      let mensagensNaoLidas = 0;
      if (perfil === "psicologo") {
        let consultaNaoLidas = admin.from("mensagens_conversa")
          .select("conteudo, remetente_id, papel_remetente, criado_em", { count: "exact" })
          .eq("conversa_id", conversa.id)
          .eq("papel_remetente", "paciente");
        if (conversa.psicologo_leu_ate) {
          consultaNaoLidas = consultaNaoLidas.gt("criado_em", conversa.psicologo_leu_ate);
        }
        const { data: naoLidas, count, error: erroNaoLidas } = await consultaNaoLidas
          .order("criado_em", { ascending: false })
          .limit(1);
        if (erroNaoLidas) {
          console.error("Erro ao contar mensagens não lidas:", erroNaoLidas);
          throw erroNaoLidas;
        }
        mensagemNaoLida = naoLidas?.[0] || null;
        mensagensNaoLidas = count || 0;
      }

      return [conversa.id, {
        ultimaMensagem: data,
        mensagemNaoLida,
        mensagensNaoLidas,
      }];
    })).catch((error) => ({ erro: error }));

    if (!Array.isArray(conversasComUltimaMensagem)) {
      return res.status(500).json({ erro: "Não foi possível carregar as mensagens recentes." });
    }

    const mensagensPorConversa = new Map(conversasComUltimaMensagem);
    const contatos = idsContatos.map((id) => {
      const usuario = usuariosPorId.get(id) || {};
      const conversa = conversasPorContato.get(id);
      return {
        participante_id: id,
        nome: usuario.nome || (perfil === "paciente" ? "Psicólogo" : "Paciente"),
        avatar_url: usuario.avatar_url || null,
        conversa_id: conversa?.id || null,
        ultima_mensagem: conversa ? mensagensPorConversa.get(conversa.id)?.ultimaMensagem || null : null,
        ultima_mensagem_nao_lida: conversa
          ? mensagensPorConversa.get(conversa.id)?.mensagemNaoLida || null
          : null,
        mensagens_nao_lidas: conversa
          ? mensagensPorConversa.get(conversa.id)?.mensagensNaoLidas || 0
          : 0,
        atualizado_em: conversa?.atualizado_em || conversa?.criado_em || null,
      };
    }).sort((a, b) => {
      const dataA = a.ultima_mensagem?.criado_em || a.atualizado_em || "";
      const dataB = b.ultima_mensagem?.criado_em || b.atualizado_em || "";
      return dataB.localeCompare(dataA);
    });

    return res.json({ contatos });
  }

  async function abrirConversa(perfil, req, res) {
    const autenticacao = await autenticarUsuario(req, perfil);
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de mensagens indisponível." });

    const usuarioId = autenticacao.user.id;
    const outroId = req.params[PERFIS[perfil].outroId];
    if (!UUID_PATTERN.test(outroId)) return res.status(400).json({ erro: "Contato inválido." });

    const pacienteId = perfil === "paciente" ? usuarioId : outroId;
    const psicologoId = perfil === "psicologo" ? usuarioId : outroId;
    const { data: vinculo, error: erroVinculo } = await admin
      .from("vinculos_paciente_psicologo")
      .select("id")
      .eq("paciente_id", pacienteId)
      .eq("psicologo_id", psicologoId)
      .eq("status", "aceito")
      .maybeSingle();
    if (erroVinculo) {
      console.error("Erro ao validar vínculo para abrir conversa:", erroVinculo);
      return res.status(500).json({ erro: "Não foi possível validar o vínculo." });
    }
    if (!vinculo) return res.status(403).json({ erro: "Conversa disponível somente para vínculos aceitos." });

    const procurarConversa = () => admin.from("conversas")
      .select("id, paciente_id, psicologo_id, criado_em, atualizado_em")
      .eq("tipo", "paciente_psicologo")
      .eq("paciente_id", pacienteId)
      .eq("psicologo_id", psicologoId)
      .limit(1)
      .maybeSingle();
    const { data: existente, error: erroBusca } = await procurarConversa();
    if (erroBusca) {
      console.error("Erro ao procurar conversa existente:", erroBusca);
      return res.status(500).json({ erro: "Não foi possível abrir a conversa." });
    }
    if (existente) return res.json({ conversa: existente });

    const { data: criada, error: erroCriacao } = await admin.from("conversas")
      .insert({
        tipo: "paciente_psicologo",
        paciente_id: pacienteId,
        psicologo_id: psicologoId,
      })
      .select("id, paciente_id, psicologo_id, criado_em, atualizado_em")
      .single();
    if (!erroCriacao) return res.status(201).json({ conversa: criada });

    if (erroCriacao.code === "23505") {
      const { data: concorrente, error: erroConcorrente } = await procurarConversa();
      if (!erroConcorrente && concorrente) return res.json({ conversa: concorrente });
    }

    console.error("Erro ao criar conversa:", erroCriacao);
    return res.status(500).json({ erro: "Não foi possível abrir a conversa." });
  }

  async function validarParticipacao(perfil, req, res, admin) {
    const autenticacao = await autenticarUsuario(req, perfil);
    if (autenticacao.erro) {
      res.status(autenticacao.status).json({ erro: autenticacao.erro });
      return null;
    }

    const conversaId = req.params.conversaId;
    if (!UUID_PATTERN.test(conversaId)) {
      res.status(400).json({ erro: "Conversa inválida." });
      return null;
    }

    const { data: conversa, error: erroConversa } = await admin.from("conversas")
      .select("id, paciente_id, psicologo_id")
      .eq("id", conversaId)
      .eq("tipo", "paciente_psicologo")
      .maybeSingle();
    if (erroConversa) {
      console.error("Erro ao validar conversa:", erroConversa);
      res.status(500).json({ erro: "Não foi possível validar a conversa." });
      return null;
    }
    if (!conversa) {
      res.status(404).json({ erro: "Conversa não encontrada." });
      return null;
    }

    const usuarioId = autenticacao.user.id;
    const participante = perfil === "paciente"
      ? conversa.paciente_id === usuarioId
      : conversa.psicologo_id === usuarioId;
    if (!participante) {
      res.status(403).json({ erro: "Você não participa desta conversa." });
      return null;
    }

    const { data: vinculo, error: erroVinculo } = await admin.from("vinculos_paciente_psicologo")
      .select("id")
      .eq("paciente_id", conversa.paciente_id)
      .eq("psicologo_id", conversa.psicologo_id)
      .eq("status", "aceito")
      .maybeSingle();
    if (erroVinculo) {
      console.error("Erro ao validar vínculo da conversa:", erroVinculo);
      res.status(500).json({ erro: "Não foi possível validar o vínculo da conversa." });
      return null;
    }
    if (!vinculo) {
      res.status(403).json({ erro: "O vínculo foi encerrado; esta conversa não está disponível." });
      return null;
    }

    return { autenticacao, conversa };
  }

  async function listarMensagens(perfil, req, res) {
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de mensagens indisponível." });
    const participacao = await validarParticipacao(perfil, req, res, admin);
    if (!participacao) return;

    const { data, error } = await admin.from("mensagens_conversa")
      .select("id, conversa_id, remetente_id, papel_remetente, conteudo, criado_em")
      .eq("conversa_id", participacao.conversa.id)
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) {
      console.error("Erro ao listar mensagens:", error);
      return res.status(500).json({ erro: "Não foi possível carregar as mensagens." });
    }

    if (perfil === "psicologo") {
      const ultimaMensagemPaciente = (data || []).find((mensagem) => mensagem.papel_remetente === "paciente");
      if (ultimaMensagemPaciente) {
        const { error: erroLeitura } = await admin.from("conversas")
          .update({ psicologo_leu_ate: ultimaMensagemPaciente.criado_em })
          .eq("id", participacao.conversa.id);
        if (erroLeitura) {
          console.error("Mensagens carregadas, mas não foi possível marcar como lidas:", erroLeitura);
          return res.status(500).json({ erro: "Não foi possível atualizar o estado de leitura das mensagens." });
        }
      }
    }

    return res.json({ mensagens: (data || []).reverse() });
  }

  async function enviarMensagem(perfil, req, res) {
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de mensagens indisponível." });
    const participacao = await validarParticipacao(perfil, req, res, admin);
    if (!participacao) return;

    const conteudo = String(req.body.conteudo || "").trim();
    if (!conteudo || conteudo.length > 2000) {
      return res.status(400).json({ erro: "Escreva uma mensagem de até 2.000 caracteres." });
    }

    const { data, error } = await admin.from("mensagens_conversa").insert({
      conversa_id: participacao.conversa.id,
      remetente_id: participacao.autenticacao.user.id,
      papel_remetente: perfil,
      conteudo,
    }).select("id, conversa_id, remetente_id, papel_remetente, conteudo, criado_em").single();
    if (error) {
      console.error("Erro ao enviar mensagem:", error);
      return res.status(500).json({ erro: "Não foi possível enviar a mensagem." });
    }

    const { error: erroAtualizacao } = await admin.from("conversas")
      .update({ atualizado_em: data.criado_em })
      .eq("id", participacao.conversa.id);
    if (erroAtualizacao) console.error("Mensagem enviada, mas não foi possível atualizar a data da conversa:", erroAtualizacao);

    return res.status(201).json({ mensagem: data });
  }

  for (const perfil of Object.keys(PERFIS)) {
    app.get(`/api/${perfil}/conversas`, (req, res) => carregarConversas(perfil, req, res));
    app.get(`/api/${perfil}/conversas/:conversaId/mensagens`, (req, res) => listarMensagens(perfil, req, res));
    app.post(`/api/${perfil}/conversas/:conversaId/mensagens`, (req, res) => enviarMensagem(perfil, req, res));
  }

  app.post("/api/paciente/conversas/:psicologoId/abrir", (req, res) => abrirConversa("paciente", req, res));
  app.post("/api/psicologo/conversas/:pacienteId/abrir", (req, res) => abrirConversa("psicologo", req, res));
}
