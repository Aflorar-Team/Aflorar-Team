export function registerGardenRoutes(app, dependencies) {
  const { autenticarUsuario, supabase, criarClienteAdmin, getJardinsFallback, setJardinsFallback } = dependencies;

  app.get("/api/jardins", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const usuario_id = autenticacao.user.id;

    if (!supabase) {
      const canteiros = getJardinsFallback(usuario_id);
      console.warn("Supabase ausente. Usando fallback em memória para jardins do usuário:", usuario_id);
      return res.json({ canteiros });
    }

    try {
      const { data, error } = await supabase
        .from("jardins")
        .select("*")
        .eq("usuario_id", usuario_id)
        .order("posicao");

      if (error) throw error;

      setJardinsFallback(usuario_id, data || []);
      return res.json({ canteiros: data || [] });
    } catch (error) {
      const mensagem = String(error?.message || "");
      const tabelaAusente = mensagem.includes("jardins") && (mensagem.includes("does not exist") || mensagem.includes("Could not find the table") || mensagem.includes("PGRST205"));

      console.error("Erro ao listar jardins:", error);
      if (tabelaAusente) {
        console.warn("Tabela public.jardins não existe no Supabase. Retornando fallback em memória.");
        const canteiros = getJardinsFallback(usuario_id);
        return res.json({ canteiros, aviso: "Tabela public.jardins ausente. Verifique o schema do Supabase." });
      }

      const canteiros = getJardinsFallback(usuario_id);
      console.warn("Usando fallback em memória para listar jardins do usuário:", usuario_id);
      return res.json({ canteiros });
    }
  });

  app.post("/api/jardins", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const { usuario_id, nome, posicao, nivel = 1 } = req.body;

    if (usuario_id !== autenticacao.user.id || !nome || posicao === undefined) {
      return res.status(400).json({ erro: "usuario_id, nome e posicao são obrigatórios." });
    }

    if (!supabase) {
      const canteiros = getJardinsFallback(usuario_id);
      const novoCanteiro = {
        id: `demo-${Date.now()}`,
        usuario_id,
        nome,
        nivel: Number(nivel) || 1,
        posicao: Number(posicao),
      };
      setJardinsFallback(usuario_id, [...canteiros, novoCanteiro]);
      return res.status(201).json({ canteiro: novoCanteiro });
    }

    try {
      const { data, error } = await supabase
        .from("jardins")
        .insert([
          {
            usuario_id,
            nome,
            nivel: Number(nivel) || 1,
            posicao: Number(posicao),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const canteiros = getJardinsFallback(usuario_id);
      setJardinsFallback(usuario_id, [...canteiros, data]);
      return res.status(201).json({ canteiro: data });
    } catch (error) {
      const mensagem = String(error?.message || "");
      const tabelaAusente = mensagem.includes("jardins") && (mensagem.includes("does not exist") || mensagem.includes("Could not find the table") || mensagem.includes("PGRST205"));

      console.error("Erro ao criar canteiro:", error);
      if (tabelaAusente) {
        const canteiros = getJardinsFallback(usuario_id);
        const novoCanteiro = {
          id: `demo-${Date.now()}`,
          usuario_id,
          nome,
          nivel: Number(nivel) || 1,
          posicao: Number(posicao),
        };
        setJardinsFallback(usuario_id, [...canteiros, novoCanteiro]);
        return res.status(201).json({ canteiro: novoCanteiro, aviso: "Tabela public.jardins ausente. Verifique o schema do Supabase." });
      }

      const canteiros = getJardinsFallback(usuario_id);
      const novoCanteiro = {
        id: `demo-${Date.now()}`,
        usuario_id,
        nome,
        nivel: Number(nivel) || 1,
        posicao: Number(posicao),
      };
      setJardinsFallback(usuario_id, [...canteiros, novoCanteiro]);
      return res.status(201).json({ canteiro: novoCanteiro });
    }
  });

  app.put("/api/jardins/:id", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const { id } = req.params;
    const { usuario_id, nome, nivel } = req.body;

    if (usuario_id !== autenticacao.user.id) {
      return res.status(403).json({ erro: "Acesso não autorizado a este jardim." });
    }

    if (!supabase) {
      const canteiros = getJardinsFallback(usuario_id);
      const idx = canteiros.findIndex((canteiro) => String(canteiro.id) === String(id));
      if (idx >= 0) {
        canteiros[idx] = {
          ...canteiros[idx],
          ...(nome !== undefined ? { nome } : {}),
          ...(nivel !== undefined ? { nivel: Number(nivel) || 1 } : {}),
        };
        setJardinsFallback(usuario_id, canteiros);
        return res.json({ canteiro: canteiros[idx] });
      }
      return res.status(404).json({ erro: "Canteiro não encontrado no fallback local." });
    }

    try {
      const updates = {};
      if (nome !== undefined) updates.nome = nome;
      if (nivel !== undefined) updates.nivel = Number(nivel) || 1;

      const { data, error } = await supabase
        .from("jardins")
        .update(updates)
        .eq("id", id)
        .eq("usuario_id", usuario_id)
        .select()
        .single();

      if (error) throw error;

      const canteiros = getJardinsFallback(usuario_id);
      const idx = canteiros.findIndex((canteiro) => String(canteiro.id) === String(id));
      if (idx >= 0) {
        canteiros[idx] = { ...canteiros[idx], ...data };
        setJardinsFallback(usuario_id, canteiros);
      }
      return res.json({ canteiro: data });
    } catch (error) {
      const mensagem = String(error?.message || "");
      const tabelaAusente = mensagem.includes("jardins") && (mensagem.includes("does not exist") || mensagem.includes("Could not find the table") || mensagem.includes("PGRST205"));

      console.error("Erro ao atualizar canteiro:", error);
      if (tabelaAusente) {
        const canteiros = getJardinsFallback(usuario_id);
        const idx = canteiros.findIndex((canteiro) => String(canteiro.id) === String(id));
        if (idx >= 0) {
          canteiros[idx] = {
            ...canteiros[idx],
            ...(nome !== undefined ? { nome } : {}),
            ...(nivel !== undefined ? { nivel: Number(nivel) || 1 } : {}),
          };
          setJardinsFallback(usuario_id, canteiros);
          return res.json({ canteiro: canteiros[idx], aviso: "Tabela public.jardins ausente. Verifique o schema do Supabase." });
        }
        return res.status(404).json({ erro: "Canteiro não encontrado." });
      }

      const canteiros = getJardinsFallback(usuario_id);
      const idx = canteiros.findIndex((canteiro) => String(canteiro.id) === String(id));
      if (idx >= 0) {
        canteiros[idx] = {
          ...canteiros[idx],
          ...(nome !== undefined ? { nome } : {}),
          ...(nivel !== undefined ? { nivel: Number(nivel) || 1 } : {}),
        };
        setJardinsFallback(usuario_id, canteiros);
        return res.json({ canteiro: canteiros[idx] });
      }
      return res.status(404).json({ erro: "Canteiro não encontrado." });
    }
  });

  app.delete("/api/jardins/:id", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const { id } = req.params;
    const { usuario_id } = req.body;

    if (usuario_id !== autenticacao.user.id) {
      return res.status(403).json({ erro: "Acesso não autorizado a este jardim." });
    }

    if (!supabase) {
      const canteiros = getJardinsFallback(usuario_id);
      const restantes = canteiros.filter((canteiro) => String(canteiro.id) !== String(id));
      if (restantes.length === canteiros.length) {
        return res.status(404).json({ erro: "Canteiro não encontrado." });
      }
      setJardinsFallback(usuario_id, restantes);
      return res.json({ mensagem: "Canteiro excluído." });
    }

    try {
      const { data, error } = await supabase
        .from("jardins")
        .delete()
        .eq("id", id)
        .eq("usuario_id", usuario_id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ erro: "Canteiro não encontrado." });

      const restantes = getJardinsFallback(usuario_id)
        .filter((canteiro) => String(canteiro.id) !== String(id));
      setJardinsFallback(usuario_id, restantes);
      return res.json({ mensagem: "Canteiro excluído." });
    } catch (error) {
      const mensagem = String(error?.message || "");
      const tabelaAusente = mensagem.includes("jardins") && (
        mensagem.includes("does not exist")
        || mensagem.includes("Could not find the table")
        || mensagem.includes("PGRST205")
      );

      console.error("Erro ao excluir canteiro:", error);
      if (tabelaAusente) {
        const canteiros = getJardinsFallback(usuario_id);
        const restantes = canteiros.filter((canteiro) => String(canteiro.id) !== String(id));
        if (restantes.length === canteiros.length) {
          return res.status(404).json({ erro: "Canteiro não encontrado." });
        }
        setJardinsFallback(usuario_id, restantes);
        return res.json({ mensagem: "Canteiro excluído do armazenamento temporário." });
      }

      return res.status(500).json({ erro: "Não foi possível excluir o canteiro." });
    }
  });

  app.get("/api/jardins/:id/evolucoes", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço do jardim indisponível." });

    const { data: jardim, error: erroJardim } = await admin
      .from("jardins")
      .select("id")
      .eq("id", req.params.id)
      .eq("usuario_id", autenticacao.user.id)
      .maybeSingle();
    if (erroJardim) return res.status(500).json({ erro: "Não foi possível validar o jardim." });
    if (!jardim) return res.status(404).json({ erro: "Jardim não encontrado." });

    const { data, error } = await admin
      .from("jardim_evolucoes")
      .select("id, jardim_id, texto, compartilhada, criado_em")
      .eq("jardim_id", jardim.id)
      .order("criado_em", { ascending: false });
    if (error) {
      console.error("Erro ao carregar evoluções do jardim:", error);
      return res.status(500).json({ erro: "Não foi possível carregar as evoluções." });
    }
    return res.json({ evolucoes: data || [] });
  });

  app.post("/api/jardins/:id/evolucoes", async (req, res) => {
    const autenticacao = await autenticarUsuario(req, "paciente");
    if (autenticacao.erro) return res.status(autenticacao.status).json({ erro: autenticacao.erro });
    const texto = String(req.body.texto || "").trim();
    const compartilhada = req.body.compartilhada === true;
    if (!texto || texto.length > 600) {
      return res.status(400).json({ erro: "Escreva uma evolução de até 600 caracteres." });
    }

    const admin = criarClienteAdmin();
    if (!admin) return res.status(503).json({ erro: "Serviço do jardim indisponível." });
    const { data: jardim, error: erroJardim } = await admin
      .from("jardins")
      .select("id")
      .eq("id", req.params.id)
      .eq("usuario_id", autenticacao.user.id)
      .maybeSingle();
    if (erroJardim) return res.status(500).json({ erro: "Não foi possível validar o jardim." });
    if (!jardim) return res.status(404).json({ erro: "Jardim não encontrado." });

    const { data, error } = await admin.from("jardim_evolucoes").insert({
      jardim_id: jardim.id,
      texto,
      compartilhada,
    }).select("id, jardim_id, texto, compartilhada, criado_em").single();
    if (error) {
      console.error("Erro ao salvar evolução do jardim:", error);
      return res.status(500).json({ erro: "Não foi possível salvar a evolução." });
    }
    return res.status(201).json({ evolucao: data });
  });
}
