// ============================================
// AFLORAR — Check-in emocional diário
// ============================================

const questions = [
  {
    id: "emocao",
    question: "Como você se sente hoje?",
    options: [
      { valor: "alegre",   texto: "😊 Alegre" },
      { valor: "triste",   texto: "😢 Triste" },
      { valor: "ansioso",  texto: "😰 Ansioso(a)" },
      { valor: "cansado",  texto: "😴 Cansado(a)" },
      { valor: "calmo",    texto: "😌 Calmo(a)" },
    ],
  },
  {
    id: "corpo",
    question: "Como está o seu corpo hoje?",
    options: [
      { valor: "energia",   texto: "⚡ Cheio(a) de energia" },
      { valor: "leve",      texto: "🌤️ Leve e confortável" },
      { valor: "acelerado", texto: "💓 Coração acelerado" },
      { valor: "pesado",    texto: "🪨 Pesado(a) e sem energia" },
      { valor: "tenso",     texto: "💪 Tenso(a), com os músculos rígidos" },
    ],
  },
  {
    id: "mente",
    question: "E a sua mente, como está?",
    options: [
      { valor: "acelerada",  texto: "🌀 Cheia de pensamentos acelerados" },
      { valor: "serena",     texto: "🍃 Tranquila e serena" },
      { valor: "preocupada", texto: "😟 Preocupada com algo" },
      { valor: "confusa",    texto: "🌫️ Confusa ou perdida" },
      { valor: "focada",     texto: "🎯 Focada e motivada" },
    ],
  },
  {
    id: "necessidade",
    question: "O que você mais precisa neste momento?",
    options: [
      { valor: "animo",     texto: "✨ Uma palavra de ânimo" },
      { valor: "respirar",  texto: "🌬️ Relaxar e respirar fundo" },
      { valor: "gratidao",  texto: "🙏 Um momento de gratidão" },
      { valor: "oracao",    texto: "🤲 Um tempo de oração ou silêncio" },
      { valor: "conversar", texto: "💬 Conversar com alguém" },
    ],
  },
  {
    id: "sono",
    question: "Como foi o seu sono na última noite?",
    options: [
      { valor: "bem",       texto: "😴 Dormi bem e descansei" },
      { valor: "pouco",     texto: "🥱 Dormi poucas horas" },
      { valor: "acordei",   texto: "🌙 Acordei várias vezes" },
      { valor: "insonia",   texto: "👀 Quase não consegui dormir" },
      { valor: "demais",    texto: "🛌 Dormi demais e acordei cansado(a)" },
    ],
  },
];

// ─── TEXTOS DOS RESULTADOS ───────────────────

const resultadosEmocao = {
  alegre: {
    titulo: "Você parece estar bem hoje! 😄",
    mensagem: "Aproveite esse momento e continue cultivando hábitos que fortalecem o seu bem-estar.",
  },
  triste: {
    titulo: "Percebemos que você está triste 😢",
    mensagem: "Está tudo bem sentir isso. Tente conversar com alguém de confiança ou fazer algo gentil por você hoje.",
  },
  ansioso: {
    titulo: "Você demonstra sinais de ansiedade 😰",
    mensagem: "Respire fundo, divida suas tarefas em partes pequenas e reserve um momento de descanso.",
  },
  cansado: {
    titulo: "Seu corpo e sua mente pedem descanso 😴",
    mensagem: "Reserve um tempo para relaxar e recuperar as energias. Descansar também é produtivo.",
  },
  calmo: {
    titulo: "Você parece estar tranquilo(a) 😌",
    mensagem: "Que bom! Procure manter esse equilíbrio ao longo do dia.",
  },
};

const observacoes = {
  corpo: {
    acelerado: "Seu coração está acelerado: o exercício de respiração pode ajudar a desacelerar.",
    pesado:    "Seu corpo está pesado: um alongamento leve ou um copo de água podem ajudar.",
    tenso:     "Você está com tensão muscular: tente alongar o pescoço e os ombros por alguns minutos.",
  },
  mente: {
    acelerada:  "Com a mente acelerada, escrever os pensamentos num papel ajuda a organizá-los.",
    preocupada: "Quando algo preocupa, separe o que depende de você do que não depende.",
    confusa:    "Quando tudo parece confuso, escolha uma única coisa pequena para fazer agora.",
  },
  sono: {
    pouco:   "Você dormiu pouco: se puder, faça uma pausa curta hoje e evite telas à noite.",
    acordei: "Acordar várias vezes cansa. Tente manter um horário regular para dormir.",
    insonia: "Uma noite quase sem dormir pesa no humor. Seja gentil consigo mesmo(a) hoje.",
    demais:  "Dormir demais também pode deixar o corpo cansado. Uma caminhada curta ajuda a despertar.",
  },
};

const frasesAnimo = [
  "A persistência realiza o impossível.",
  "Você é mais forte do que imagina.",
  "Grandes conquistas começam com pequenos passos.",
  "Cada dia é uma nova oportunidade para recomeçar.",
  "Seu esforço de hoje constrói o seu amanhã.",
  "Continue avançando, mesmo que devagar.",
];

const frasesGratidao = [
  "Agradeça pela sua vida e pelas oportunidades de um novo dia.",
  "Agradeça pelas pessoas que se importam com você.",
  "Agradeça pelos aprendizados que teve até aqui.",
  "Agradeça pelo seu corpo e por tudo o que ele faz por você.",
  "Agradeça pelos momentos felizes que já viveu.",
  "Agradeça pela chance de continuar crescendo.",
];

const frasesOracao = [
  "Peça por paz interior e equilíbrio emocional.",
  "Lembre das pessoas que você ama e deseje o bem a elas.",
  "Peça sabedoria para enfrentar os desafios do dia.",
  "Peça por saúde, proteção e bem-estar.",
  "Agradeça pelas coisas boas da vida.",
  "Peça por esperança e força para seguir em frente.",
];

// ─── ELEMENTOS E ESTADO ──────────────────────

const title = document.getElementById("questionTitle");
const optionsContainer = document.getElementById("optionsContainer");
const nextBtn = document.getElementById("nextBtn");
const progressBar = document.getElementById("progressBar");

let currentQuestion = 0;
let selectedOption = null;
const answers = {}; // { emocao: {valor, texto}, corpo: {...}, ... }

const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

// ─── PERGUNTAS ───────────────────────────────

function loadQuestion() {
  const q = questions[currentQuestion];

  title.textContent = q.question;
  optionsContainer.innerHTML = "";
  selectedOption = null;
  nextBtn.disabled = true;

  if (currentQuestion === questions.length - 1) {
    nextBtn.textContent = "Ver resultado";
  }

  q.options.forEach((option) => {
    const div = document.createElement("div");
    div.classList.add("option");
    div.textContent = option.texto;

    div.addEventListener("click", () => {
      optionsContainer
        .querySelectorAll(".option")
        .forEach((item) => item.classList.remove("selected"));

      div.classList.add("selected");
      selectedOption = option;
      nextBtn.disabled = false;
    });

    optionsContainer.appendChild(div);
  });

  progressBar.style.width = ((currentQuestion + 1) / questions.length) * 100 + "%";
}

nextBtn.addEventListener("click", () => {
  if (!selectedOption) return;

  answers[questions[currentQuestion].id] = selectedOption;
  currentQuestion++;

  if (currentQuestion < questions.length) {
    loadQuestion();
  } else {
    showResults();
  }
});

// ─── RESULTADO ───────────────────────────────

function showResults() {
  const { titulo, mensagem } = resultadosEmocao[answers.emocao.valor];

  // Observações personalizadas (corpo, mente e sono)
  const notas = ["corpo", "mente", "sono"]
    .map((chave) => observacoes[chave][answers[chave].valor])
    .filter(Boolean);

  const notasHTML = notas.length
    ? `<div class="notas">${notas.map((n) => `<p>• ${n}</p>`).join("")}</div>`
    : "";

  salvarCheckin();

  document.querySelector(".quiz-card").innerHTML = `
    <div class="result">
      <h2>${titulo}</h2>
      <p>${mensagem}</p>
      ${notasHTML}
      <hr style="margin:20px 0">
      ${gerarAcao()}
      ${gerarApoio()}
    </div>
  `;

  iniciarRespiracao();
}

function gerarAcao() {
  const necessidade = answers.necessidade.valor;
  let titulo = "";
  let mensagem = "";
  let extra = "";

  switch (necessidade) {
    case "animo":
      titulo = "✨ Palavra de ânimo";
      mensagem = sortear(frasesAnimo);
      break;

    case "respirar":
      titulo = "🌿 Momento de respiração";
      mensagem = "Siga o exercício abaixo e acompanhe o círculo.";
      extra = `
        <div class="respiracao">
          <div class="circulo-container">
            <div class="circulo"></div>
          </div>
          <p id="instrucao">Prepare-se...</p>
          <p id="contador">3</p>
        </div>
      `;
      break;

    case "gratidao":
      titulo = "🙏 Momento de gratidão";
      mensagem = sortear(frasesGratidao);
      break;

    case "oracao":
      titulo = "🤲 Sugestão para o seu momento de silêncio";
      mensagem = sortear(frasesOracao);
      break;

    case "conversar":
      titulo = "💬 Você não precisa enfrentar tudo sozinho(a)";
      mensagem = `
        Conversar pode ajudar muito:<br><br>
        • Fale com um amigo ou familiar de confiança;<br>
        • Procure apoio de um psicólogo;<br>
        • Converse com a Flora, nossa assistente virtual.
      `;
      extra = `<p><a href="./chat.html">🌱 Conversar com a Flora</a></p>`;
      break;
  }

  return `<h3>${titulo}</h3><p>${mensagem}</p>${extra}`;
}

// Mostra o CVV quando o usuário está mais vulnerável
function gerarApoio() {
  const precisaApoio =
    answers.emocao.valor === "triste" ||
    answers.necessidade.valor === "conversar" ||
    answers.sono.valor === "insonia";

  if (!precisaApoio) return "";

  return `
    <hr style="margin:20px 0">
    <p>
      Se você estiver passando por um momento muito difícil, o <strong>CVV</strong>
      atende gratuitamente, 24 horas por dia, pelo telefone <strong>188</strong>.
    </p>
  `;
}

// Guarda o histórico para usar nos gráficos do psicólogo depois
function salvarCheckin() {
  try {
    const historico = JSON.parse(localStorage.getItem("checkins") || "[]");
    historico.push({
      data: new Date().toISOString(),
      emocao: answers.emocao.valor,
      corpo: answers.corpo.valor,
      mente: answers.mente.valor,
      necessidade: answers.necessidade.valor,
      sono: answers.sono.valor,
    });
    localStorage.setItem("checkins", JSON.stringify(historico));
  } catch (erro) {
    console.warn("Não foi possível salvar o check-in:", erro);
  }
}

// ─── RESPIRAÇÃO 4-7-8 ────────────────────────

function iniciarRespiracao() {
  const instrucao = document.getElementById("instrucao");
  const contador = document.getElementById("contador");
  const circulo = document.querySelector(".circulo");

  if (!instrucao || !contador || !circulo) return;

  const etapas = [
    { texto: "🌬️ Inspire", classe: "inspirar", segundos: 4 },
    { texto: "⏸️ Segure",  classe: "segurar",  segundos: 7 },
    { texto: "🍃 Expire",  classe: "expirar",  segundos: 8 },
  ];

  let preparacao = 3;
  let emCiclo = false;
  let indice = 0;
  let restante = 0;

  function iniciarEtapa() {
    const etapa = etapas[indice];

    circulo.classList.remove("inspirar", "segurar", "expirar");
    // Ajusta a velocidade da animação para a duração de cada etapa
    circulo.style.transitionDuration = `${etapa.segundos}s`;
    circulo.classList.add(etapa.classe);

    instrucao.textContent = etapa.texto;
    restante = etapa.segundos;
    contador.textContent = restante;
  }

  // Um único temporizador controla tudo
  const intervalo = setInterval(() => {
    // Para sozinho se o usuário sair da tela
    if (!circulo.isConnected) {
      clearInterval(intervalo);
      return;
    }

    if (!emCiclo) {
      preparacao--;
      if (preparacao > 0) {
        contador.textContent = preparacao;
      } else {
        emCiclo = true;
        iniciarEtapa();
      }
      return;
    }

    restante--;
    if (restante <= 0) {
      indice = (indice + 1) % etapas.length;
      iniciarEtapa();
    } else {
      contador.textContent = restante;
    }
  }, 1000);
}

loadQuestion();
