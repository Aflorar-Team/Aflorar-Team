import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import {
  GEMINI_API_KEY,
  readEnv,
  SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./config/env.js";
import { supabase } from "./config/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const envFaltando = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "GEMINI_API_KEY",
].filter((chave) => !readEnv(chave));

if (envFaltando.length) {
  console.warn(
    `⚠️ Variáveis de ambiente ausentes: ${envFaltando.join(", ")}. Configure no Render para evitar falhas em deploy.`
  );
}

const jardinsFallback = new Map();

async function ensureJardinsTable() {
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

const normalizarCpf = (valor = "") => String(valor).replace(/\D/g, "");
const normalizarTelefone = (valor = "") => String(valor).replace(/\D/g, "");
const normalizarCrp = (valor = "") => String(valor).replace(/\D/g, "");

const criarClienteAuth = () => createClient(
  SUPABASE_URL,
  SUPABASE_KEY || SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const criarClienteAdmin = () => SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

const usuarioTemPerfil = (usuario, perfil) => {
  const papeis = usuario?.app_metadata?.roles;
  return Array.isArray(papeis) && papeis.includes(perfil);
};

const usuarioComPerfil = (usuario, perfil) => {
  const metadados = usuario?.user_metadata || {};
  const dadosPerfil = metadados.perfis?.[perfil] || metadados;
  return {
    ...usuario,
    user_metadata: { ...metadados, ...dadosPerfil, tipo: perfil },
  };
};

async function salvarPerfilConta({ usuarioId, perfil, dadosPerfil }) {
  const admin = criarClienteAdmin();
  if (!admin) {
    return { erro: "SUPABASE_SERVICE_ROLE_KEY não configurada no backend.", status: 500 };
  }

  const { data: usuarioAtual, error: erroBusca } = await admin.auth.admin.getUserById(usuarioId);
  if (erroBusca || !usuarioAtual?.user) {
    return { erro: "Não foi possível localizar a conta autenticada.", status: 500 };
  }

  const usuario = usuarioAtual.user;
  const metadadosAtuais = usuario.user_metadata || {};
  const perfisAtuais = { ...(metadadosAtuais.perfis || {}) };
  const rolesAtuais = new Set(Array.isArray(usuario.app_metadata?.roles)
    ? usuario.app_metadata.roles.filter((role) => ["paciente", "psicologo"].includes(role))
    : []);
  const perfisAtualizados = { ...perfisAtuais, [perfil]: dadosPerfil };
  const userMetadata = {
    ...metadadosAtuais,
    nome: dadosPerfil.nome,
    cpf: dadosPerfil.cpf,
    telefone: dadosPerfil.telefone,
    perfis: perfisAtualizados,
  };
  const appMetadata = { ...(usuario.app_metadata || {}), roles: [...rolesAtuais] };

  const { error: erroUsuario } = await admin.from("usuarios").upsert({
    id: usuarioId,
    nome: dadosPerfil.nome,
    email: usuario.email,
  }, { onConflict: "id" });
  if (erroUsuario) return { erro: "Não foi possível salvar os dados da conta.", status: 500 };

  const tabelaPerfil = perfil === "paciente" ? "pacientes" : "psicologos";
  const { error: erroPerfil } = await admin.from(tabelaPerfil).upsert({
    usuario_id: usuarioId,
    cpf: dadosPerfil.cpf,
    telefone: dadosPerfil.telefone,
    ...(perfil === "psicologo" ? { crp: dadosPerfil.crp } : {}),
  }, { onConflict: "usuario_id" });
  if (erroPerfil) {
    console.error(`Erro ao salvar perfil na tabela ${tabelaPerfil}:`, erroPerfil);
    return { erro: "Não foi possível salvar os dados do perfil. Verifique o schema do Supabase.", status: 500 };
  }

  if (perfil === "paciente") {
    rolesAtuais.add("paciente");
    appMetadata.roles = [...rolesAtuais];
  } else if (rolesAtuais.has("psicologo")) {
    appMetadata.psicologo_status = "aprovado";
  } else {
    appMetadata.psicologo_status = "pendente";
  }

  const { data, error } = await admin.auth.admin.updateUserById(usuarioId, {
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  });

  if (error) return { erro: "Não foi possível salvar o perfil.", status: 500 };
  return {
    usuario: data.user,
    statusPerfil: perfil === "psicologo" && !rolesAtuais.has("psicologo") ? "pendente" : "ativo",
  };
}

async function cadastrarPerfil({ email, senha, perfil, dadosPerfil }) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { erro: "Configuração do Supabase ausente.", status: 500 };
  }

  const clienteAuth = criarClienteAuth();
  const { data: login, error: erroLogin } = await clienteAuth.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (!erroLogin && login.user) {
    const resultadoPerfil = await salvarPerfilConta({
      usuarioId: login.user.id,
      perfil,
      dadosPerfil,
    });
    return resultadoPerfil.erro
      ? resultadoPerfil
      : { ...resultadoPerfil, contaExistente: true };
  }

  if (erroLogin?.message?.toLowerCase().includes("email not confirmed")) {
    return {
      erro: "Confirme o e-mail da conta existente antes de adicionar outro perfil.",
      status: 409,
    };
  }

  const { data, error } = await clienteAuth.auth.signUp({
    email,
    password: senha,
    options: {
      data: dadosPerfil,
    },
  });

  if (error) {
    const emailJaCadastrado = /already registered|user exists|email.*(taken|exists)/i.test(error.message || "");
    return {
      erro: emailJaCadastrado
        ? "Este e-mail já possui uma conta. Confirme o e-mail e use a senha já cadastrada para adicionar outro perfil."
        : error.message,
      status: emailJaCadastrado ? 409 : 400,
    };
  }
  if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
    return {
      erro: "Este e-mail já possui uma conta. Confirme o e-mail e use a senha já cadastrada para adicionar outro perfil.",
      status: 409,
    };
  }

  if (!data.user) return { erro: "Não foi possível criar a conta.", status: 500 };

  const resultadoPerfil = await salvarPerfilConta({
    usuarioId: data.user.id,
    perfil,
    dadosPerfil,
  });
  return resultadoPerfil.erro
    ? resultadoPerfil
    : { ...resultadoPerfil, contaExistente: false };
}

app.use(express.static(path.resolve(__dirname, "../../FrontEnd")));
const origensPermitidas = [
  "https://aflorar-team.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5500",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5500",
  /https:\/\/aflorar-team-.*\.vercel\.app/  // aceita qualquer branch do vercel
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const permitida = origensPermitidas.some(o =>
      typeof o === "string" ? o === origin : o.test(origin)
    );

    if (permitida) {
      callback(null, true);
    } else {
      callback(new Error("Bloqueado pelo CORS"));
    }
  }
}));
app.use(express.json());

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
  if (tipo === "psicologo") dadosPerfil.crp = normalizarCrp(crp);

  if (!dadosPerfil.nome || dadosPerfil.cpf.length !== 11
    || dadosPerfil.telefone.length < 10 || dadosPerfil.telefone.length > 11) {
    return res.status(400).json({ erro: "Nome, CPF ou telefone inválido." });
  }
  if (tipo === "psicologo" && (dadosPerfil.crp.length < 4 || dadosPerfil.crp.length > 8)) {
    return res.status(400).json({ erro: "CRP inválido." });
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
  if (dadosPerfil.crp.length < 4 || dadosPerfil.crp.length > 8) {
    return res.status(400).json({ erro: "CRP inválido." });
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

app.get("/api/jardins", async (req, res) => {
  const { usuario_id } = req.query;

  if (!usuario_id) {
    return res.status(400).json({ erro: "usuario_id é obrigatório." });
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
  const { id } = req.params;
  const { usuario_id } = req.body;

  if (!usuario_id) {
    return res.status(400).json({ erro: "usuario_id é obrigatório." });
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

export { ensureJardinsTable };
export default app;