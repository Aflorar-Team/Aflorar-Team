import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  CORS_ORIGINS,
  DB_TYPE,
  GEMINI_API_KEY,
  readEnv,
  SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./config/env.js";
import { getDbPool, ensureMysqlSchema, createDbId } from "./config/database.js";
import { supabase } from "./config/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const dbPool = getDbPool();
const useMysql = DB_TYPE === "mysql" && Boolean(dbPool);

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const passwordHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return { salt, hash: passwordHash };
};

const verifyPassword = (password, salt, hash) => {
  try {
    const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
  } catch (error) {
    return false;
  }
};

const createSessionToken = (usuario) => Buffer.from(JSON.stringify({
  id: String(usuario.id),
  email: usuario.email,
  tipo: usuario.tipo,
  exp: Date.now() + 86400000,
})).toString("base64url");

const serializarUsuario = (usuario) => ({
  id: String(usuario.id),
  nome: usuario.nome,
  email: usuario.email,
  tipo: usuario.tipo,
  ...(usuario.cpf ? { cpf: usuario.cpf } : {}),
  ...(usuario.telefone ? { telefone: usuario.telefone } : {}),
  ...(usuario.crp ? { crp: usuario.crp } : {}),
});

const envFaltando = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "GEMINI_API_KEY",
].filter((chave) => !readEnv(chave));

if (envFaltando.length) {
  console.warn(
    `⚠️ Variáveis de ambiente ausentes: ${envFaltando.join(", ")}. Configure-as no ambiente de deploy para evitar falhas.`
  );
}

const jardinsFallback = new Map();

async function ensureJardinsTable() {
  if (useMysql) {
    try {
      const ok = await ensureMysqlSchema();
      if (ok) {
        console.log("✅ Tabelas de usuários e jardins garantidas no MySQL do cPanel.");
      }
      return ok;
    } catch (error) {
      console.error("❌ Não foi possível criar as tabelas MySQL do cPanel:", error.message);
      return false;
    }
  }

  if (!SUPABASE_URL) return false;

  const adminKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;
  if (!adminKey) {
    console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY ausente. A tabela public.jardins precisa existir no Supabase antes do uso.");
    return false;
  }

  try {
    const probe = await fetch(`${SUPABASE_URL}/rest/v1/jardins?select=id&limit=1`, {
      method: "GET",
      headers: {
        apikey: adminKey,
        Authorization: `Bearer ${adminKey}`,
      },
    });

    if (probe.ok) {
      return true;
    }

    if (probe.status !== 404 && probe.status !== 400) {
      const text = await probe.text();
      console.warn("Probe de tabela public.jardins retornou status inesperado:", probe.status, text.slice(0, 200));
      return true;
    }
  } catch (error) {
    console.warn("Não foi possível consultar a tabela public.jardins:", error.message);
  }

  const sql = `
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS public.jardins (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id text NOT NULL,
      nome text NOT NULL,
      nivel integer NOT NULL DEFAULT 1,
      posicao integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_jardins_usuario_id
      ON public.jardins (usuario_id);

    CREATE INDEX IF NOT EXISTS idx_jardins_usuario_posicao
      ON public.jardins (usuario_id, posicao);
  `;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: adminKey,
        Authorization: `Bearer ${adminKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${text}`);
    }

    console.log("✅ Tabela public.jardins garantida no Supabase.");
    return true;
  } catch (error) {
    console.error("❌ Não foi possível criar a tabela public.jardins automaticamente:", error.message);
    return false;
  }
}

const getJardinsFallback = (usuarioId) => {
  const lista = jardinsFallback.get(String(usuarioId)) || [];
  return lista.map((canteiro) => ({ ...canteiro, id: String(canteiro.id) }));
};

const setJardinsFallback = (usuarioId, canteiros) => {
  jardinsFallback.set(String(usuarioId), canteiros.map((canteiro) => ({ ...canteiro, id: String(canteiro.id) })));
};

const normalizarCpf = (valor = "") => String(valor).replace(/\D/g, "").slice(0, 11);
const normalizarTelefone = (valor = "") => String(valor).replace(/\D/g, "").slice(0, 11);
const registrarErroMysqlCadastro = (tipo, error) => {
  console.error(`Erro no cadastro ${tipo} MySQL: ${JSON.stringify({
    code: error?.code || null,
    errno: error?.errno || null,
    sqlState: error?.sqlState || null,
    message: error?.sqlMessage || error?.message || String(error),
  })}`);
};

app.use(express.static(path.resolve(__dirname, "../../FrontEnd")));

// O frontend e a API são servidos pela mesma origem no cPanel, então CORS
// não é necessário. Para manter o frontend em outro domínio durante uma
// transição, configure CORS_ORIGINS como uma lista separada por vírgulas.
const origensPermitidas = CORS_ORIGINS;

if (origensPermitidas.length) {
  app.use(cors({
    origin(origin, callback) {
      if (!origin || origensPermitidas.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Bloqueado pelo CORS"));
    },
  }));
}
app.use(express.json());

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ erro: "JSON inválido. Verifique os dados enviados." });
  }

  console.error("Erro interno do servidor:", error);
  return res.status(500).json({ erro: "Erro interno do servidor." });
});

const INSTRUCAO_FLORA = `
  Você é a Flora, assistente virtual da plataforma Aflorar.
  
  Personalidade:
  - Empática e acolhedora, como uma amiga de confiança
  - Usa linguagem leve, sem termos médicos complexos
  - Respostas curtas (máximo 3 parágrafos)
  - Usa emojis com moderação 🌱
  
  Limites importantes:
  - Nunca diagnostica doenças ou prescreve remédios
  - Em crises graves (suicídio, automutilação), sugere gentilmente o CVV (188)
  - Não  responde assuntos fora de bem-estar emocional
`;

app.post("/api/flora", async (req, res) => {
  const { mensagem } = req.body;
  if (!mensagem)
    return res.status(400).json({ erro: "Mensagem não fornecida." });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCAO_FLORA }] },
          contents: [{ parts: [{ text: mensagem }] }],
        }),
      },
    );

    const data = await response.json();
    const resposta = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resposta) throw new Error("Resposta inválida da API");

    res.json({ resposta });
  } catch (error) {
    console.error("Erro:", error);
    res.status(500).json({ erro: "Erro ao processar sua mensagem." });
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

  if (useMysql && dbPool) {
    try {
      const emailNormalizado = String(email).trim().toLowerCase();
      const [usuarios] = await dbPool.execute("SELECT id FROM usuarios WHERE email = ? LIMIT 1", [emailNormalizado]);

      if (usuarios.length) {
        return res.status(409).json({ erro: "E-mail já cadastrado." });
      }

      const id = createDbId();
      const { salt, hash } = hashPassword(String(senha));
      await dbPool.execute(
        "INSERT INTO usuarios (id, nome, email, password_hash, password_salt, cpf, telefone, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, String(nome).trim(), emailNormalizado, hash, salt, cpfLimpo, telefoneLimpo, "paciente"]
      );

      return res.json({
        mensagem: "Cadastro realizado com sucesso!",
        usuario: serializarUsuario({ id, nome: String(nome).trim(), email: emailNormalizado, cpf: cpfLimpo, telefone: telefoneLimpo, tipo: "paciente" }),
        token: createSessionToken({ id, email: emailNormalizado, tipo: "paciente" }),
      });
    } catch (error) {
      registrarErroMysqlCadastro("do paciente", error);
      return res.status(500).json({ erro: "Erro ao cadastrar paciente no banco do cPanel." });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({
      erro: "Configuração do Supabase ausente no deploy. Verifique as variáveis SUPABASE_URL e SUPABASE_KEY no ambiente do servidor.",
    });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome, cpf: cpfLimpo, telefone: telefoneLimpo, tipo: "paciente" } },
    });

    if (error) {
      return res.status(400).json({
        erro: error.message || "Não foi possível cadastrar o usuário no Supabase.",
      });
    }

    return res.json({ mensagem: "Cadastro realizado com sucesso!", usuario: data.user });
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

  if (useMysql && dbPool) {
    try {
      const emailNormalizado = String(email).trim().toLowerCase();
      const [usuarios] = await dbPool.execute(
        "SELECT * FROM usuarios WHERE email = ? LIMIT 1",
        [emailNormalizado]
      );

      if (!usuarios.length) {
        return res.status(401).json({ erro: "E-mail ou senha inválidos." });
      }

      const usuario = usuarios[0];
      const senhaValida = verifyPassword(String(senha), usuario.password_salt, usuario.password_hash);
      if (!senhaValida) {
        return res.status(401).json({ erro: "E-mail ou senha inválidos." });
      }

      return res.json({
        mensagem: "Login realizado com sucesso!",
        usuario: serializarUsuario(usuario),
        token: createSessionToken(usuario),
      });
    } catch (error) {
      console.error("Erro no login do paciente no MySQL:", error);
      return res.status(500).json({ erro: "Erro de conexão com o banco do cPanel." });
    }
  }

  if (!supabase) {
    return res.status(500).json({
      erro: "Configuração do Supabase ausente no deploy. Verifique as variáveis SUPABASE_URL e SUPABASE_KEY no ambiente do servidor.",
    });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) return res.status(400).json({ erro: "E-mail ou senha inválidos." });

    return res.json({
      mensagem: "Login realizado com sucesso!",
      usuario: data.user,
      token: data.session.access_token,
    });
  } catch (error) {
    console.error("Erro no login do paciente:", error);
    return res.status(500).json({ erro: "Erro de conexão com o Supabase." });
  }
});

app.post("/api/cadastro-psicologo", async (req, res) => {
  const { cpf, crp, email, telefone, senha } = req.body;
  if (!cpf || !crp || !email || !telefone || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });

  if (useMysql && dbPool) {
    try {
      const emailNormalizado = String(email).trim().toLowerCase();
      const cpfLimpo = normalizarCpf(cpf);
      const telefoneLimpo = normalizarTelefone(telefone);
      const crpLimpo = String(crp).replace(/\D/g, "");

      const [usuarios] = await dbPool.execute("SELECT id FROM usuarios WHERE email = ? LIMIT 1", [emailNormalizado]);
      if (usuarios.length) {
        return res.status(409).json({ erro: "E-mail já cadastrado." });
      }

      const id = createDbId();
      const { salt, hash } = hashPassword(String(senha));
      await dbPool.execute(
        "INSERT INTO usuarios (id, nome, email, password_hash, password_salt, cpf, telefone, crp, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, "Psicólogo", emailNormalizado, hash, salt, cpfLimpo, telefoneLimpo, crpLimpo, "psicologo"]
      );

      return res.json({
        mensagem: "Cadastro realizado com sucesso!",
        usuario: serializarUsuario({ id, nome: "Psicólogo", email: emailNormalizado, cpf: cpfLimpo, telefone: telefoneLimpo, crp: crpLimpo, tipo: "psicologo" }),
        token: createSessionToken({ id, email: emailNormalizado, tipo: "psicologo" }),
      });
    } catch (error) {
      registrarErroMysqlCadastro("do psicólogo", error);
      return res.status(500).json({ erro: "Erro ao cadastrar psicólogo no banco do cPanel." });
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { cpf, crp, telefone, tipo: "psicologo" } },
  });

  if (error) return res.status(400).json({ erro: error.message });
  res.json({ mensagem: "Cadastro realizado com sucesso!", usuario: data.user });
});

app.post("/api/login-psicologo", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "Preencha e-mail e senha." });

  if (useMysql && dbPool) {
    try {
      const emailNormalizado = String(email).trim().toLowerCase();
      const [usuarios] = await dbPool.execute("SELECT * FROM usuarios WHERE email = ? LIMIT 1", [emailNormalizado]);

      if (!usuarios.length) {
        return res.status(401).json({ erro: "E-mail ou senha inválidos." });
      }

      const usuario = usuarios[0];
      if (usuario.tipo !== "psicologo") {
        return res.status(403).json({ erro: "Acesso negado. Use o login de paciente." });
      }

      const senhaValida = verifyPassword(String(senha), usuario.password_salt, usuario.password_hash);
      if (!senhaValida) {
        return res.status(401).json({ erro: "E-mail ou senha inválidos." });
      }

      return res.json({
        mensagem: "Login realizado com sucesso!",
        usuario: serializarUsuario(usuario),
        token: createSessionToken(usuario),
      });
    } catch (error) {
      console.error("Erro no login do psicólogo no MySQL:", error);
      return res.status(500).json({ erro: "Erro de conexão com o banco do cPanel." });
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) return res.status(400).json({ erro: "E-mail ou senha inválidos." });

  const tipo = data.user.user_metadata?.tipo;
  if (tipo !== "psicologo") {
    return res.status(403).json({ erro: "Acesso negado. Use o login de paciente." });
  }

  res.json({
    mensagem: "Login realizado com sucesso!",
    usuario: data.user,
    token: data.session.access_token,
  });
});

app.get("/api/jardins", async (req, res) => {
  const { usuario_id } = req.query;

  if (!usuario_id) {
    return res.status(400).json({ erro: "usuario_id é obrigatório." });
  }

  if (useMysql && dbPool) {
    try {
      const [rows] = await dbPool.execute(
        "SELECT * FROM jardins WHERE usuario_id = ? ORDER BY posicao ASC, created_at ASC",
        [String(usuario_id)]
      );

      const canteiros = rows.map((row) => ({
        ...row,
        id: String(row.id),
        usuario_id: String(row.usuario_id),
      }));

      setJardinsFallback(String(usuario_id), canteiros);
      return res.json({ canteiros });
    } catch (error) {
      console.error("Erro ao listar jardins no MySQL:", error);
      const canteiros = getJardinsFallback(String(usuario_id));
      return res.json({ canteiros, aviso: "Erro ao consultar o banco do cPanel. Usando fallback local." });
    }
  }

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
  const { usuario_id, nome, posicao, nivel = 1 } = req.body;

  if (!usuario_id || !nome || posicao === undefined) {
    return res.status(400).json({ erro: "usuario_id, nome e posicao são obrigatórios." });
  }

  if (useMysql && dbPool) {
    try {
      const novoCanteiro = {
        id: createDbId(),
        usuario_id: String(usuario_id),
        nome: String(nome).trim(),
        nivel: Number(nivel) || 1,
        posicao: Number(posicao),
      };

      await dbPool.execute(
        "INSERT INTO jardins (id, usuario_id, nome, nivel, posicao) VALUES (?, ?, ?, ?, ?)",
        [novoCanteiro.id, novoCanteiro.usuario_id, novoCanteiro.nome, novoCanteiro.nivel, novoCanteiro.posicao]
      );

      const canteiros = getJardinsFallback(String(usuario_id));
      setJardinsFallback(String(usuario_id), [...canteiros, novoCanteiro]);
      return res.status(201).json({ canteiro: novoCanteiro });
    } catch (error) {
      console.error("Erro ao criar canteiro no MySQL:", error);
      const canteiros = getJardinsFallback(String(usuario_id));
      const novoCanteiro = {
        id: `demo-${Date.now()}`,
        usuario_id: String(usuario_id),
        nome: String(nome).trim(),
        nivel: Number(nivel) || 1,
        posicao: Number(posicao),
      };
      setJardinsFallback(String(usuario_id), [...canteiros, novoCanteiro]);
      return res.status(201).json({ canteiro: novoCanteiro, aviso: "Banco do cPanel indisponível; usando fallback local." });
    }
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
  const { id } = req.params;
  const { usuario_id, nome, nivel } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ erro: "usuario_id é obrigatório." });
  }

  if (useMysql && dbPool) {
    try {
      const campos = [];
      const valores = [];

      if (nome !== undefined) {
        campos.push("nome = ?");
        valores.push(String(nome).trim());
      }

      if (nivel !== undefined) {
        campos.push("nivel = ?");
        valores.push(Number(nivel) || 1);
      }

      if (!campos.length) {
        return res.status(400).json({ erro: "Nenhum campo para atualizar." });
      }

      valores.push(String(id));
      valores.push(String(usuario_id));

      const [resultado] = await dbPool.execute(
        `UPDATE jardins SET ${campos.join(", ")} WHERE id = ? AND usuario_id = ?`,
        valores
      );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({ erro: "Canteiro não encontrado no banco do cPanel." });
      }

      const [rows] = await dbPool.execute("SELECT * FROM jardins WHERE id = ? AND usuario_id = ? LIMIT 1", [String(id), String(usuario_id)]);
      const canteiro = rows[0] ? { ...rows[0], id: String(rows[0].id), usuario_id: String(rows[0].usuario_id) } : null;
      const canteiros = getJardinsFallback(String(usuario_id));
      if (canteiro) {
        const idx = canteiros.findIndex((item) => String(item.id) === String(id));
        if (idx >= 0) {
          canteiros[idx] = canteiro;
        } else {
          canteiros.push(canteiro);
        }
        setJardinsFallback(String(usuario_id), canteiros);
      }
      return res.json({ canteiro });
    } catch (error) {
      console.error("Erro ao atualizar canteiro no MySQL:", error);
      return res.status(500).json({ erro: "Erro ao atualizar canteiro no banco do cPanel." });
    }
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

export { ensureJardinsTable };
export default app;
