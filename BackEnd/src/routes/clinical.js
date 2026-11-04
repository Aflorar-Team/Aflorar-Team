export function registerClinicalRoutes(app, dependencies) {
  const { autenticarUsuario, criarClienteAdmin, verificarVinculoAceito } = dependencies;

  app.post("/api/paciente/humor", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });

    const humor = String(req.body.humor || "").trim();
    const emoji = String(req.body.emoji || "").trim();
    const emocoesPermitidas = new Map([
      ["Feliz", "😊"], ["Radiante", "😁"], ["Neutro", "😐"], ["Irritado", "😠"],
      ["Triste", "😢"], ["Ansioso", "😰"], ["Estressado", "😵"], ["Depressivo", "😞"],
      ["Inseguro", "😟"], ["Cansado", "😴"], ["Desmotivado", "😶"], ["Preocupado", "😧"],
    ]);
    if (!emocoesPermitidas.has(humor) || emocoesPermitidas.get(humor) !== emoji) {
      return res.status(400).json({ erro: "Selecione uma emoção válida." });
    }
    const dataRegistro = String(req.body.data_registro || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRegistro)) {
      return res.status(400).json({ erro: "Data do registro inválida." });
    }

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de registros indisponível." });
    const { error } = await admin.from("registros_humor").upsert({
      paciente_id: autenticacao.user.id,
      data_registro: dataRegistro,
      humor,
      emoji,
      origem: "inicio",
    }, { onConflict: "paciente_id,data_registro,origem" });
    if (error) {
      console.error("Erro ao salvar registro de humor:", error);
      return res.status(500).json({ erro: "Não foi possível salvar sua emoção." });
    }
    return res.json({ mensagem: "Emoção registrada." });
  });

  app.get("/api/psicologo/pacientes/:pacienteId/humor", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de registros indisponível." });

    const { aceito, error: erroVinculo } = await verificarVinculoAceito(
      admin,
      autenticacao.user.id,
      req.params.pacienteId,
    );
    if (erroVinculo) return res.status(500).json({ erro: "Não foi possível validar o vínculo." });
    if (!aceito) return res.status(403).json({ erro: "Este paciente não está vinculado ao seu perfil." });

    const periodo = req.query.periodo || "mensal";
    if (!["diario", "semanal", "mensal"].includes(periodo)) {
      return res.status(400).json({ erro: "Período inválido." });
    }
    const hoje = String(req.query.hoje || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hoje)) {
      return res.status(400).json({ erro: "Informe uma data de referência válida." });
    }
    const inicio = new Date(`${hoje}T12:00:00Z`);
    if (periodo === "semanal") inicio.setUTCDate(inicio.getUTCDate() - 6);
    if (periodo === "mensal") inicio.setUTCDate(inicio.getUTCDate() - 29);

    const { data, error } = await admin
      .from("registros_humor")
      .select("data_registro, humor, emoji, origem")
      .eq("paciente_id", req.params.pacienteId)
      .gte("data_registro", inicio.toISOString().slice(0, 10))
      .lte("data_registro", hoje)
      .order("data_registro", { ascending: true });
    if (error) {
      console.error("Erro ao carregar registros de humor:", error);
      return res.status(500).json({ erro: "Não foi possível carregar os registros de humor." });
    }
    return res.json({ registros: data || [] });
  });

  app.get("/api/psicologo/pacientes/:pacienteId/anotacoes", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de anotações indisponível." });

    const { aceito, error: erroVinculo } = await verificarVinculoAceito(admin, autenticacao.user.id, req.params.pacienteId);
    if (erroVinculo) return res.status(500).json({ erro: "Não foi possível validar o vínculo." });
    if (!aceito) return res.status(403).json({ erro: "Este paciente não está vinculado ao seu perfil." });

    const dataNota = String(req.query.data || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNota)) return res.status(400).json({ erro: "Informe uma data válida." });
    const { data, error } = await admin
      .from("anotacoes_psicologo_diarias")
      .select("id, data_nota, conteudo, atualizado_em")
      .eq("psicologo_id", autenticacao.user.id)
      .eq("paciente_id", req.params.pacienteId)
      .eq("data_nota", dataNota)
      .maybeSingle();
    if (error) {
      console.error("Erro ao carregar anotação diária:", error);
      return res.status(500).json({ erro: "Não foi possível carregar a anotação." });
    }
    return res.json({ anotacao: data || { data_nota: dataNota, conteudo: "" } });
  });

  app.put("/api/psicologo/pacientes/:pacienteId/anotacoes", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço de anotações indisponível." });

    const { aceito, error: erroVinculo } = await verificarVinculoAceito(admin, autenticacao.user.id, req.params.pacienteId);
    if (erroVinculo) return res.status(500).json({ erro: "Não foi possível validar o vínculo." });
    if (!aceito) return res.status(403).json({ erro: "Este paciente não está vinculado ao seu perfil." });

    const dataNota = String(req.body.data || "");
    const conteudo = String(req.body.conteudo || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataNota) || conteudo.length > 10000) {
      return res.status(400).json({ erro: "Data inválida ou anotação acima de 10.000 caracteres." });
    }
    const { data, error } = await admin.from("anotacoes_psicologo_diarias").upsert({
      psicologo_id: autenticacao.user.id,
      paciente_id: req.params.pacienteId,
      data_nota: dataNota,
      conteudo,
    }, { onConflict: "psicologo_id,paciente_id,data_nota" })
      .select("id, data_nota, conteudo, atualizado_em")
      .single();
    if (error) {
      console.error("Erro ao salvar anotação diária:", error);
      return res.status(500).json({ erro: "Não foi possível salvar a anotação." });
    }
    return res.json({ anotacao: data });
  });

  app.get("/api/psicologo/pacientes/:pacienteId/evolucoes-compartilhadas", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "psicologo");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço do jardim indisponível." });

    const { aceito, error: erroVinculo } = await verificarVinculoAceito(admin, autenticacao.user.id, req.params.pacienteId);
    if (erroVinculo) return res.status(500).json({ erro: "Não foi possível validar o vínculo." });
    if (!aceito) return res.status(403).json({ erro: "Este paciente não está vinculado ao seu perfil." });

    const { data: jardins, error: erroJardins } = await admin
      .from("jardins")
      .select("id, nome")
      .eq("usuario_id", req.params.pacienteId);
    if (erroJardins) return res.status(500).json({ erro: "Não foi possível carregar os jardins compartilhados." });
    if (!jardins?.length) return res.json({ evolucoes: [] });

    const jardinsPorId = new Map(jardins.map((jardim) => [jardim.id, jardim]));
    const { data, error } = await admin
      .from("jardim_evolucoes")
      .select("id, jardim_id, texto, criado_em")
      .eq("compartilhada", true)
      .in("jardim_id", [...jardinsPorId.keys()])
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("Erro ao carregar evoluções compartilhadas:", error);
      return res.status(500).json({ erro: "Não foi possível carregar as anotações compartilhadas." });
    }
    return res.json({
      evolucoes: (data || []).map((evolucao) => ({
        ...evolucao,
        jardim: jardinsPorId.get(evolucao.jardim_id)?.nome || "Jardim",
      })),
    });
  });
}
