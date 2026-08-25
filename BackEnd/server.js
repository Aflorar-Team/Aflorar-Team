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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

app.use(express.static(path.join(__dirname, "../FrontEnd")));
app.use("/Css", express.static(path.join(__dirname, "../Css")));
app.use("/Js", express.static(path.join(__dirname, "../Js")));
app.use(cors({ origin: "https://aflorar-team.vercel.app/" }));
app.use(express.json());

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
  - Não responde assuntos fora de bem-estar emocional
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

app.post("/api/cadastro", async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });

  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome } },
  });

  if (error) return res.status(400).json({ erro: error.message });
  res.json({ mensagem: "Cadastro realizado com sucesso!", usuario: data.user });
});

app.post("/api/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "Preencha todos os campos." });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) return res.status(400).json({ erro: "Email ou senha inválidos." });
  res.json({
    mensagem: "Login realizado com sucesso!",
    usuario: data.user,
    token: data.session.access_token,
  });
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