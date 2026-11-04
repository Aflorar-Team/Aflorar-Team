export function registerFloraRoutes(app, dependencies) {
  const { GEMINI_API_KEY, fetch } = dependencies;

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
}
