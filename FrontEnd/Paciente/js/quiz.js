// ============================================
// AFLORAR — Check-in emocional diário (v2)
// Cada resposta soma pontos em estados emocionais;
// o resultado cruza emoção, corpo, mente e sono.
// ============================================

const ESTADOS = ["bem", "calmo", "triste", "ansioso", "cansado", "irritado", "confuso"];
const NEGATIVOS = ["triste", "ansioso", "cansado", "irritado", "confuso"];

const nomeEstado = {
  bem: "bem-estar",
  calmo: "calma",
  triste: "tristeza",
  ansioso: "ansiedade",
  cansado: "cansaço",
  irritado: "irritação",
  confuso: "confusão mental",
};

// ─── PERGUNTAS (com pesos por estado) ────────

const questions = [
  {
    id: "emocao",
    question: "Como você se sente hoje?",
    options: [
      { valor: "alegre",  texto: "😊 Alegre",        pesos: { bem: 3 } },
      { valor: "calmo",   texto: "😌 Calmo(a)",      pesos: { calmo: 3 } },
      { valor: "triste",  texto: "😢 Triste",        pesos: { triste: 3 } },
      { valor: "ansioso", texto: "😰 Ansioso(a)",    pesos: { ansioso: 3 } },
      { valor: "cansado", texto: "😴 Cansado(a)",    pesos: { cansado: 3 } },
      { valor: "irritado", texto: "😠 Irritado(a)",  pesos: { irritado: 3 } },
    ],
  },
  {
    id: "corpo",
    question: "Como está o seu corpo hoje?",
    options: [
      { valor: "energia",   texto: "⚡ Cheio(a) de energia",               pesos: { bem: 2 } },
      { valor: "leve",      texto: "🌤️ Leve e confortável",               pesos: { calmo: 2 } },
      { valor: "acelerado", texto: "💓 Coração acelerado",                 pesos: { ansioso: 2 } },
      { valor: "pesado",    texto: "🪨 Pesado(a) e sem energia",           pesos: { cansado: 1, triste: 1 } },
      { valor: "tenso",     texto: "💪 Tenso(a), com os músculos rígidos", pesos: { irritado: 1, ansioso: 1 } },
    ],
  },
  {
    id: "mente",
    question: "E a sua mente, como está?",
    options: [
      { valor: "acelerada",  texto: "🌀 Cheia de pensamentos acelerados", pesos: { ansioso: 2 } },
      { valor: "serena",     texto: "🍃 Tranquila e serena",              pesos: { calmo: 2 } },
      { valor: "preocupada", texto: "😟 Preocupada com algo",             pesos: { ansioso: 1, triste: 1 } },
      { valor: "confusa",    texto: "🌫️ Confusa ou perdida",             pesos: { confuso: 3 } },
      { valor: "focada",     texto: "🎯 Focada e motivada",               pesos: { bem: 2 } },
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
      { valor: "bem",     texto: "😴 Dormi bem e descansei",              pesos: { bem: 1, calmo: 1 } },
      { valor: "pouco",   texto: "🥱 Dormi poucas horas",                 pesos: { cansado: 2 } },
      { valor: "acordei", texto: "🌙 Acordei várias vezes",               pesos: { cansado: 1, ansioso: 1 } },
      { valor: "insonia", texto: "👀 Quase não consegui dormir",          pesos: { cansado: 2, ansioso: 1 } },
      { valor: "demais",  texto: "🛌 Dormi demais e acordei cansado(a)",  pesos: { cansado: 1, triste: 1 } },
    ],
  },
];

// ─── PERFIS DE RESULTADO ─────────────────────

const perfis = {
  bem: {
    titulo: "Você está num bom momento hoje! 😄",
    mensagem: "Energia e bom humor são ótimos aliados. Aproveite esse embalo para fazer algo que faz bem a você.",
    dicas: [
      "Anote uma coisa boa que aconteceu hoje. Isso ajuda a lembrar dela nos dias mais difíceis.",
      "Use a disposição para cuidar de algo que você vem adiando.",
      "Compartilhe esse bom momento com alguém de quem você gosta.",
    ],
  },
  calmo: {
    titulo: "Você parece em equilíbrio hoje 😌",
    mensagem: "A calma é um ótimo ponto de partida. Vale reparar no que ajudou você a chegar até aqui.",
    dicas: [
      "Observe o que contribuiu para essa calma hoje: um hábito, uma pessoa, um lugar.",
      "Aproveite para fazer algo prazeroso, sem pressa.",
      "Mantenha seus horários de sono e refeições, eles sustentam esse equilíbrio.",
    ],
  },
  triste: {
    titulo: "Hoje parece estar mais pesado 😢",
    mensagem: "Sentir tristeza faz parte, e você não precisa carregá-la sozinho(a). Pequenos gestos de cuidado já contam.",
    dicas: [
      "Mande uma mensagem para alguém de confiança, mesmo que seja curta.",
      "Escolha uma coisa pequena que costuma te fazer bem: uma música, um banho quente, um lanche gostoso.",
      "Tente pegar luz natural por uns 10 minutos, de preferência com uma caminhada leve.",
    ],
  },
  ansioso: {
    titulo: "Sinais de ansiedade apareceram hoje 😰",
    mensagem: "Quando a mente corre mais rápido que o corpo, ajuda trazer a atenção de volta para o aqui e agora.",
    dicas: [
      "Faça a respiração 4-7-8: inspire por 4 segundos, segure por 7 e solte por 8.",
      "Escreva o que te preocupa e separe o que depende de você do que não depende.",
      "Tente a técnica 5-4-3-2-1: cinco coisas que você vê, quatro que sente ao toque, três que ouve, duas que cheira e uma que saboreia.",
    ],
  },
  cansado: {
    titulo: "Seu corpo e sua mente pedem descanso 😴",
    mensagem: "O cansaço é um recado, não uma fraqueza. Hoje dá para ir mais devagar, sem culpa.",
    dicas: [
      "Faça uma pausa de 10 a 20 minutos, longe das telas.",
      "Beba água e coma algo leve: corpo cansado também sente fome e sede.",
      "Escolha só uma ou duas tarefas essenciais hoje e deixe o resto para depois.",
    ],
  },
  irritado: {
    titulo: "Hoje as coisas parecem estar no limite 😠",
    mensagem: "A irritação costuma aparecer quando estamos sobrecarregados(as). Ela não define você, só mostra que algo precisa de atenção.",
    dicas: [
      "Se puder, afaste-se por 5 minutos antes de responder algo que te irritou.",
      "Movimente o corpo: uma caminhada rápida ou um alongamento ajuda a soltar a tensão.",
      "Tente nomear o que realmente incomoda. Muitas vezes há cansaço ou frustração por trás.",
    ],
  },
  confuso: {
    titulo: "Parece difícil se achar hoje 🌫️",
    mensagem: "Quando a cabeça está confusa, ajuda tirar as ideias de dentro dela e colocá-las para fora.",
    dicas: [
      "Escreva tudo o que está na sua cabeça, sem se preocupar com a ordem.",
      "Escolha uma única prioridade para agora e deixe o resto para depois.",
      "Converse com alguém ou com a Flora para organizar os pensamentos.",
    ],
  },
};

// Observações específicas (usamos no máximo uma: sono > corpo > mente)
const observacoes = {
  sono: {
    pouco:   "Você dormiu pouco: se puder, faça uma pausa curta hoje e evite telas à noite.",
    acordei: "Acordar várias vezes cansa. Tente manter um horário regular para dormir.",
    insonia: "Uma noite quase sem dormir pesa no humor. Seja gentil consigo mesmo(a) hoje.",
    demais:  "Dormir demais também deixa o corpo cansado. Uma caminhada curta ajuda a despertar.",
  },
  corpo: {
    acelerado: "Com o coração acelerado, respirar devagar ajuda o corpo a entender que está seguro.",
    pesado:    "Com o corpo pesado, um alongamento leve ou um copo de água podem ajudar.",
    tenso:     "Com tensão muscular, alongue o pescoço e os ombros por alguns minutos.",
  },
  mente: {
    acelerada:  "Com a mente acelerada, escrever os pensamentos num papel ajuda a organizá-los.",
    preocupada: "Quando algo preocupa, pergunte: o que eu posso fazer sobre isso hoje?",
  },
};

const fechamentos = {
  moderada:
    "Alguns sinais de desgaste apareceram hoje. Cuide de você e, se isso se repetir por vários dias, vale conversar com um profissional.",
  alta:
    "Seus sinais estão bem intensos hoje. Considere conversar com alguém de confiança ou com o seu psicólogo. Se estiver difícil demais, o CVV atende gratuitamente, 24 horas, pelo telefone <strong>188</strong>.",
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
const answers = {}; // { emocao: {valor, texto, pesos}, corpo: {...}, ... }

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

// ─── ANÁLISE ─────────────────────────────────

function analisar() {
  // 1. Soma os pontos de cada estado
  const pontos = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  Object.values(answers).forEach((resp) => {
    Object.entries(resp.pesos || {}).forEach(([estado, p]) => {
      pontos[estado] += p;
    });
  });

  // 2. A emoção que a pessoa escolheu pesa mais e nunca é ignorada
  const estadoEmocao = Object.keys(answers.emocao.pesos)[0];
  const emocaoNegativa = NEGATIVOS.includes(estadoEmocao);

  // Se disse que está mal, o resultado nunca vira "você está ótimo"
  const candidatos = emocaoNegativa ? NEGATIVOS : ESTADOS;
  const ordenados = [...candidatos].sort(
    (a, b) => pontos[b] - pontos[a] || (b === estadoEmocao) - (a === estadoEmocao)
  );

  const principal = ordenados[0];
  const secundario = ordenados.find(
    (e) => e !== principal && NEGATIVOS.includes(e) && pontos[e] >= 2
  );

  // 3. Intensidade = quanto desconforto somou no total
  const negativos = NEGATIVOS.reduce((soma, e) => soma + pontos[e], 0);
  const positivos = pontos.bem + pontos.calmo;
  const intensidade =
    negativos >= 9 ? "alta" : negativos >= 6 ? "moderada" : negativos >= 3 ? "leve" : "baixa";

  return { pontos, estadoEmocao, emocaoNegativa, principal, secundario, positivos, intensidade };
}

// ─── RESULTADO ───────────────────────────────

function showResults() {
  const r = analisar();
  const perfil = perfis[r.principal];

  // Aviso quando o que a pessoa disse não bate com o que o corpo/mente mostram
  let aviso = "";
  if (!r.emocaoNegativa && NEGATIVOS.includes(r.principal)) {
    aviso = `Você disse que está bem, mas seu corpo e sua mente mostram sinais de ${nomeEstado[r.principal]}. Às vezes só percebemos o quanto estamos sobrecarregados(as) quando paramos para observar.`;
  } else if (r.emocaoNegativa && r.positivos >= 4) {
    aviso = "Mesmo com esse sentimento, alguns sinais do seu corpo e da sua mente são positivos. Isso é um bom ponto de apoio.";
  }

  const nota = r.secundario
    ? `<p>Também aparecem sinais de <strong>${nomeEstado[r.secundario]}</strong>.</p>`
    : "";

  // Dicas do perfil + uma observação específica (sono > corpo > mente)
  const dicas = [...perfil.dicas];
  const extra =
    observacoes.sono[answers.sono.valor] ||
    observacoes.corpo[answers.corpo.valor] ||
    observacoes.mente[answers.mente.valor];
  if (extra) dicas.push(extra);

  const chips = questions
    .map(
      (q) =>
        `<span style="display:inline-block;margin:3px;padding:4px 10px;border-radius:14px;background:#f3ece6;font-size:13px;">${answers[q.id].texto}</span>`
    )
    .join("");

  const fechamento = fechamentos[r.intensidade]
    ? `<hr style="margin:20px 0">
       <p>${fechamentos[r.intensidade]}</p>
       <p><a href="./chat.html">🌱 Conversar com a Flora</a></p>`
    : "";

  salvarCheckin(r);

  document.querySelector(".quiz-card").innerHTML = `
    <div class="result">
      <h2>${perfil.titulo}</h2>
      <p>${perfil.mensagem}</p>
      ${aviso ? `<p><em>${aviso}</em></p>` : ""}
      ${nota}

      <div style="margin:14px 0">${chips}</div>

      <h3>O que pode ajudar hoje</h3>
      <ul style="text-align:left;margin:8px 0 0 18px;">
        ${dicas.map((d) => `<li style="margin-bottom:6px">${d}</li>`).join("")}
      </ul>

      <hr style="margin:20px 0">
      ${gerarAcao()}
      ${fechamento}

      <p style="margin-top:20px;font-size:12px;color:#999">
        Este check-in é um apoio ao autocuidado e não substitui a avaliação de um profissional.
      </p>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button type="button" id="refazer" class="btn-primary">Refazer check-in</button>
        <a href="./inicio.html" class="btn-primary">Voltar ao início</a>
      </div>
    </div>
  `;

  document.getElementById("refazer").addEventListener("click", () => location.reload());

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
      break;
  }

  return `<h3>${titulo}</h3><p>${mensagem}</p>${extra}`;
}

// Guarda o histórico para alimentar os gráficos do psicólogo depois
function salvarCheckin(r) {
  try {
    const historico = JSON.parse(localStorage.getItem("checkins") || "[]");
    historico.push({
      data: new Date().toISOString(),
      estado: r.principal,
      intensidade: r.intensidade,
      pontos: r.pontos,
      respostas: Object.fromEntries(
        Object.entries(answers).map(([id, resp]) => [id, resp.valor])
      ),
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
    circulo.style.transitionDuration = `${etapa.segundos}s`;
    circulo.classList.add(etapa.classe);

    instrucao.textContent = etapa.texto;
    restante = etapa.segundos;
    contador.textContent = restante;
  }

  const intervalo = setInterval(() => {
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