const API_URL = "https://aflorar-backend.onrender.com";
const pacienteSelect = document.getElementById("pacienteSelect");
const statusGrafico = document.getElementById("statusGrafico");
const tituloGrafico = document.getElementById("tituloGrafico");
const paleta = ["#4A7C59", "#E9B949", "#7C8798", "#8B2020", "#3B5EA6", "#D4853A", "#B05D3B", "#596275", "#8A6D3B", "#B8860B", "#6B7280", "#7B5EA6"];
let chartInstance;
let filtroAtual = "mensal";

async function requisicaoApi(endpoint) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const resultado = await response.json();
  if (!response.ok) throw new Error(resultado.erro || "Não foi possível carregar os dados.");
  return resultado;
}

function renderGrafico(registros) {
  const contagem = new Map();
  registros.forEach((registro) => contagem.set(registro.humor, (contagem.get(registro.humor) || 0) + 1));
  const labels = [...contagem.keys()];
  const valores = [...contagem.values()];
  const legenda = document.getElementById("legenda");
  legenda.replaceChildren();

  labels.forEach((nome, index) => {
    const item = document.createElement("div");
    item.className = "legenda-item";
    const cor = document.createElement("span");
    cor.className = "legenda-cor";
    cor.style.background = paleta[index % paleta.length];
    const texto = document.createElement("span");
    const registro = registros.find((entrada) => entrada.humor === nome);
    texto.textContent = `${registro?.emoji || ""} ${nome}: ${valores[index]}`;
    item.append(cor, texto);
    legenda.appendChild(item);
  });

  chartInstance?.destroy();
  chartInstance = new Chart(document.getElementById("graficoHumor"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: valores,
        backgroundColor: labels.map((_, index) => paleta[index % paleta.length]),
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => ` ${context.label}: ${context.parsed} registro(s)` } },
      },
    },
  });
}

async function carregarRegistros() {
  const pacienteId = pacienteSelect.value;
  if (!pacienteId) return;
  statusGrafico.textContent = "Carregando registros...";
  try {
    const agora = new Date();
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
    const resultado = await requisicaoApi(`/api/psicologo/pacientes/${encodeURIComponent(pacienteId)}/humor?periodo=${filtroAtual}&hoje=${hoje}`);
    renderGrafico(resultado.registros);
    statusGrafico.textContent = resultado.registros.length
      ? `${resultado.registros.length} registro(s) no período.`
      : "Sem registros de humor neste período.";
    tituloGrafico.textContent = `Registros de humor · ${pacienteSelect.selectedOptions[0].textContent}`;
  } catch (error) {
    statusGrafico.textContent = error.message;
    renderGrafico([]);
  }
}

async function carregarPacientes() {
  pacienteSelect.replaceChildren();
  try {
    const resultado = await requisicaoApi("/api/psicologo/vinculos");
    const pacientes = resultado.vinculos.filter((vinculo) => vinculo.status === "aceito");
    pacientes.forEach((vinculo) => {
      const option = document.createElement("option");
      option.value = vinculo.paciente_id;
      option.textContent = vinculo.paciente.nome;
      pacienteSelect.appendChild(option);
    });

    const solicitado = new URLSearchParams(location.search).get("pacienteId");
    if (solicitado && pacientes.some((vinculo) => vinculo.paciente_id === solicitado)) pacienteSelect.value = solicitado;
    if (!pacientes.length) {
      statusGrafico.textContent = "Nenhum paciente com vínculo confirmado.";
      renderGrafico([]);
      return;
    }
    await carregarRegistros();
  } catch (error) {
    statusGrafico.textContent = error.message;
    renderGrafico([]);
  }
}

function trocarFiltro(filtro, botao) {
  filtroAtual = filtro;
  document.querySelectorAll(".btn-filtro").forEach((item) => item.classList.remove("ativo"));
  botao.classList.add("ativo");
  carregarRegistros();
}

pacienteSelect.addEventListener("change", carregarRegistros);
carregarPacientes();