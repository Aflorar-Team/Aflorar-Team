import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFaltando = [
  "SUPABASE_URL",
  "SUPABASE_KEY",
  "GEMINI_API_KEY",
].filter((chave) => !process.env[chave]);

if (envFaltando.length) {
  console.warn(
    `⚠️ Variáveis de ambiente ausentes: ${envFaltando.join(", ")}. Configure no Render para evitar falhas em deploy.`
  );
}

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;
console.log("Supabase URL:", process.env.SUPABASE_URL ? "✅ OK" : "❌ AUSENTE");
console.log("Supabase KEY:", process.env.SUPABASE_KEY ? "✅ OK" : "❌ AUSENTE");

app.use(express.static(path.join(__dirname, "../FrontEnd")));
app.use("/Css", express.static(path.join(__dirname, "../Css")));
app.use("/Js", express.static(path.join(__dirname, "../Js")));
const origensPermitidas = [
  "https://aflorar-team.vercel.app",
  /https:\/\/aflorar-team-.*\.vercel\.app/  // aceita qualquer branch do vercel
];

app.use(cors({
  origin: function(origin, callback) {
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
  const { nome, email, senha } = req.body;

  console.log("Dados recebidos:", { nome, email, senha });

  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.status(500).json({
      erro: "Configuração do Supabase ausente no deploy. Verifique as variáveis SUPABASE_URL e SUPABASE_KEY no Render.",
    });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    });

    console.log("Resposta Supabase:", { data, error });

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
    return res.status(400).json({ erro: "Preencha todos os campos." });

  if (!supabase) {
    return res.status(500).json({
      erro: "Configuração do Supabase ausente no deploy. Verifique as variáveis SUPABASE_URL e SUPABASE_KEY no Render.",
    });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) return res.status(400).json({ erro: "Email ou senha inválidos." });
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
    return res.status(400).json({ erro: "Preencha todos os campos." });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) return res.status(400).json({ erro: "Email ou senha inválidos." });

  // Verifica se é realmente psicólogo
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

app.listen(process.env.PORT || 3000, () => {
  console.log(`Flora backend rodando na porta ${process.env.PORT || 3000}`);
});