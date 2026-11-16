import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import {
  GEMINI_API_KEY,
  ADMIN_EMAIL,
  readEnv,
  SUPABASE_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  RESEND_API_KEY,
  EMAIL_FROM,
  SMTP_USER,
  SMTP_APP_PASSWORD,
  FRONTEND_URL,
} from "./config/env.js";
import { supabase } from "./config/supabase.js";

import { registerProfileRoutes } from "./routes/profiles.js";
import { registerRelationshipRoutes } from "./routes/relationships.js";
import { registerClinicalRoutes } from "./routes/clinical.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerFloraRoutes } from "./routes/flora.js";
import { registerGardenRoutes } from "./routes/gardens.js";
import { registerConversationRoutes } from "./routes/conversations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

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
      semente text NOT NULL DEFAULT 'girassol',
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
const normalizarCrp = (valor = "") => {
  const crp = String(valor).trim().toUpperCase().replace(/\s+/g, "");
  const apenasDigitos = crp.replace(/\D/g, "");
  if (/^\d{6,10}$/.test(apenasDigitos)) {
    return `${apenasDigitos.slice(0, 2)}/${apenasDigitos.slice(2)}`;
  }
  return crp;
};

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

async function autenticarAdmin(req) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { erro: "Autenticação obrigatória.", status: 401 };
  if (!ADMIN_EMAIL) return { erro: "ADMIN_EMAIL não configurado no backend.", status: 503 };

  const clienteAuth = criarClienteAuth();
  const { data, error } = await clienteAuth.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { erro: "Sessão inválida ou expirada.", status: 401 };
  if (!user.email_confirmed_at || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    return { erro: "Acesso administrativo não autorizado.", status: 403 };
  }

  return { user };
}

async function autenticarUsuario(req, perfil) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { erro: "Autenticação obrigatória.", status: 401 };

  const clienteAuth = criarClienteAuth();
  const { data, error } = await clienteAuth.auth.getUser(token);
  if (error || !data.user) return { erro: "Sessão inválida ou expirada.", status: 401 };
  if (!usuarioTemPerfil(data.user, perfil)) {
    return { erro: "Acesso não autorizado para este perfil.", status: 403 };
  }

  return { user: data.user };
}

async function verificarVinculoAceito(admin, psicologoId, pacienteId) {
  const { data, error } = await admin
    .from("vinculos_paciente_psicologo")
    .select("id")
    .eq("psicologo_id", psicologoId)
    .eq("paciente_id", pacienteId)
    .eq("status", "aceito")
    .maybeSingle();
  return { aceito: Boolean(data), error };
}

async function salvarPerfilConta({ usuarioId, perfil, dadosPerfil, senha, preservarCpf = false }) {
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
  if (preservarCpf) {
    const tabelaPerfil = perfil === "paciente" ? "pacientes" : "psicologos";
    const { data: perfilExistente, error: erroPerfilExistente } = await admin
      .from(tabelaPerfil)
      .select("cpf")
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (erroPerfilExistente) {
      return { erro: "Não foi possível verificar o CPF cadastrado.", status: 500 };
    }
    const cpfExistente = String(perfilExistente?.cpf || "").replace(/\D/g, "");
    if (cpfExistente.length !== 11) {
      return { erro: "Não foi possível localizar o CPF cadastrado. Entre em contato com o suporte.", status: 409 };
    }
    dadosPerfil.cpf = cpfExistente;
  }
  let psicologoAprovado = false;
  let perfilAnterior;
  if (perfil === "psicologo" && rolesAtuais.has("psicologo")) {
    const { data, error: erroPerfilAnterior } = await admin
      .from("psicologos")
      .select("cpf, crp, telefone, status_verificacao, registro_verificado, identidade_verificada, verificado_por, verificado_em, observacao_verificacao")
      .eq("usuario_id", usuarioId)
      .maybeSingle();
    if (erroPerfilAnterior) {
      return { erro: "Não foi possível verificar o cadastro profissional existente.", status: 500 };
    }
    perfilAnterior = data;
    const dadosAnteriores = metadadosAtuais.perfis?.psicologo || metadadosAtuais;
    psicologoAprovado = perfilAnterior?.status_verificacao === "aprovado"
      && dadosAnteriores.nome === dadosPerfil.nome
      && String(perfilAnterior.cpf || "").trim() === dadosPerfil.cpf
      && perfilAnterior.crp === dadosPerfil.crp
      && perfilAnterior.telefone === dadosPerfil.telefone;
    if (!psicologoAprovado) rolesAtuais.delete("psicologo");
  }
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
    ...((metadadosAtuais.avatar_url || metadadosAtuais.picture)
      ? { avatar_url: metadadosAtuais.avatar_url || metadadosAtuais.picture }
      : {}),
  }, { onConflict: "id" });
  if (erroUsuario) return { erro: "Não foi possível salvar os dados da conta.", status: 500 };

  const tabelaPerfil = perfil === "paciente" ? "pacientes" : "psicologos";
  const { error: erroPerfil } = await admin.from(tabelaPerfil).upsert({
    usuario_id: usuarioId,
    cpf: dadosPerfil.cpf,
    telefone: dadosPerfil.telefone,
    ...(perfil === "psicologo" ? {
      crp: dadosPerfil.crp,
      status_verificacao: psicologoAprovado ? "aprovado" : "pendente",
      registro_verificado: psicologoAprovado && perfilAnterior.registro_verificado,
      identidade_verificada: psicologoAprovado && perfilAnterior.identidade_verificada,
      verificado_por: psicologoAprovado ? perfilAnterior.verificado_por : null,
      verificado_em: psicologoAprovado ? perfilAnterior.verificado_em : null,
      observacao_verificacao: psicologoAprovado ? perfilAnterior.observacao_verificacao : null,
    } : {}),
  }, { onConflict: "usuario_id" });
  if (erroPerfil) {
    console.error(`Erro ao salvar perfil na tabela ${tabelaPerfil}:`, erroPerfil);
    return { erro: "Não foi possível salvar os dados do perfil. Verifique o schema do Supabase.", status: 500 };
  }

  if (perfil === "paciente") {
    rolesAtuais.add("paciente");
    appMetadata.roles = [...rolesAtuais];
  } else if (psicologoAprovado) {
    appMetadata.psicologo_status = "aprovado";
  } else {
    appMetadata.psicologo_status = "pendente";
  }

  const { data, error } = await admin.auth.admin.updateUserById(usuarioId, {
    user_metadata: userMetadata,
    ...(senha ? { password: senha } : {}),
    app_metadata: {
      ...appMetadata,
      ...(perfil === "psicologo" ? {
        psicologo_status: psicologoAprovado ? "aprovado" : "pendente",
      } : {}),
    },
  });

  if (error) return { erro: "Não foi possível salvar o perfil.", status: 500 };
  return {
    usuario: data.user,
    statusPerfil: perfil === "psicologo" && !psicologoAprovado ? "pendente" : "ativo",
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

registerProfileRoutes(app, {
  SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, EMAIL_FROM,
  SMTP_USER, SMTP_APP_PASSWORD, FRONTEND_URL, fetch, supabase,
  normalizarCpf, normalizarTelefone, normalizarCrp, criarClienteAuth, criarClienteAdmin,
  usuarioTemPerfil, usuarioComPerfil, salvarPerfilConta, cadastrarPerfil,
});
registerRelationshipRoutes(app, {
  autenticarUsuario, criarClienteAdmin, usuarioTemPerfil, verificarVinculoAceito,
});
registerClinicalRoutes(app, { autenticarUsuario, criarClienteAdmin, verificarVinculoAceito });
registerAdminRoutes(app, { autenticarAdmin, criarClienteAdmin });
registerFloraRoutes(app, { GEMINI_API_KEY, fetch });
registerGardenRoutes(app, {
  autenticarUsuario, supabase, criarClienteAdmin, getJardinsFallback, setJardinsFallback,
});
registerConversationRoutes(app, { autenticarUsuario, criarClienteAdmin });

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ erro: "JSON inválido. Verifique os dados enviados." });
  }

  console.error("Erro interno do servidor:", error);
  return res.status(500).json({ erro: "Erro interno do servidor." });
});

export { ensureJardinsTable };
export default app;