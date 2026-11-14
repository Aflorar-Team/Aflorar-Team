const meses = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const usuario = (() => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    return null;
  }
})();

const API_URL = "https://aflorar-backend.onrender.com";
const hoje = new Date();
let mes = hoje.getMonth();
let ano = hoje.getFullYear();
let dataSelecionada = formatarData(hoje);
let tipoAtual = "compromisso";
let eventos = [];
let pacientesVinculados = [];

const grid = document.getElementById("gridDias");
const listaEventos = document.getElementById("listaEventos");
const dialogo = document.getElementById("dialogEvento");
const formulario = document.getElementById("formEvento");
const campoTitulo = document.getElementById("tituloEvento");
const campoData = document.getElementById("dataEvento");
const campoHora = document.getElementById("horaEvento");
const campoDetalhes = document.getElementById("detalhesEvento");
const campoNotificar = document.getElementById("notificarEvento");
const campoDestinoEvento = document.getElementById("destinoEvento");
const campoPacienteEvento = document.getElementById("pacienteEvento");
const areaPacienteEvento = document.getElementById("selecaoPacienteEvento");
const avisoSemPacientes = document.getElementById("avisoSemPacientes");
const destinoEventoContainer = document.getElementById("destinoEventoContainer");

function formatarData(data) {
  const anoLocal = data.getFullYear();
  const mesLocal = String(data.getMonth() + 1).padStart(2, "0");
  const diaLocal = String(data.getDate()).padStart(2, "0");
  return `${anoLocal}-${mesLocal}-${diaLocal}`;
}

async function requisicaoApi(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const resultado = await response.json();
  if (!response.ok) throw new Error(resultado.erro || "Não foi possível concluir a operação da agenda.");
  return resultado;
}

async function carregarEventosMes() {
  const inicio = formatarData(new Date(ano, mes, 1));
  const fim = formatarData(new Date(ano, mes + 1, 0));
  try {
    const resultado = await requisicaoApi(`/api/psicologo/eventos?inicio=${inicio}&fim=${fim}`);
    eventos = resultado.eventos;
    renderizarCalendario();
    renderizarEventos();
    verificarAutoavisos();
  } catch (error) {
    eventos = [];
    renderizarCalendario();
    renderizarEventos();
    document.getElementById("estadoVazio").textContent = error.message;
    document.getElementById("estadoVazio").hidden = false;
  }
}

async function carregarPacientesVinculados() {
  try {
    const resultado = await requisicaoApi("/api/psicologo/vinculos");
    pacientesVinculados = resultado.vinculos.filter((vinculo) => vinculo.status === "aceito");
    pacientesVinculados.forEach((vinculo) => {
      const option = document.createElement("option");
      option.value = vinculo.paciente_id;
      option.textContent = vinculo.paciente?.nome || "Paciente";
      campoPacienteEvento.appendChild(option);
    });
    const pacienteInicial = new URLSearchParams(location.search).get("pacienteId");
    if (pacienteInicial && pacientesVinculados.some((vinculo) => vinculo.paciente_id === pacienteInicial)) {
      campoDestinoEvento.value = "paciente";
      campoPacienteEvento.value = pacienteInicial;
    }
    atualizarDestinoEvento();
  } catch (error) {
    document.getElementById("estadoVazio").textContent = error.message;
    document.getElementById("estadoVazio").hidden = false;
  }
}

function criarMarcadores(dia, data) {
  const tipos = new Set(eventos.filter((evento) => evento.data === data).map((evento) => evento.tipo));
  if (!tipos.size) return;

  const marcadores = document.createElement("span");
  marcadores.className = "marcadores-dia";
  marcadores.setAttribute("aria-hidden", "true");

  ["compromisso", "aviso", "autoaviso"].forEach((tipo) => {
    if (!tipos.has(tipo)) return;
    const marcador = document.createElement("i");
    marcador.className = `marcador-${tipo}`;
    marcadores.appendChild(marcador);
  });

  dia.appendChild(marcadores);
}

function renderizarCalendario() {
  document.getElementById("mesAno").textContent = `${meses[mes]} ${ano}`;
  grid.innerHTML = "";

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const diasMesAnterior = new Date(ano, mes, 0).getDate();

  for (let indice = primeiroDia - 1; indice >= 0; indice--) {
    const wrapper = document.createElement("div");
    wrapper.className = "dia-wrapper";
    const dia = document.createElement("div");
    dia.className = "dia outro-mes";
    dia.textContent = diasMesAnterior - indice;
    wrapper.appendChild(dia);
    grid.appendChild(wrapper);
  }

  for (let numeroDia = 1; numeroDia <= totalDias; numeroDia++) {
    const wrapper = document.createElement("div");
    wrapper.className = "dia-wrapper";
    const dia = document.createElement("button");
    const data = formatarData(new Date(ano, mes, numeroDia));
    dia.type = "button";
    dia.className = "dia";
    dia.textContent = numeroDia;
    dia.setAttribute("aria-label", new Date(ano, mes, numeroDia).toLocaleDateString("pt-BR", { dateStyle: "full" }));
    dia.setAttribute("aria-pressed", String(data === dataSelecionada));

    if (data === formatarData(hoje)) dia.classList.add("hoje");
    if (data === dataSelecionada) dia.classList.add("selecionado");
    criarMarcadores(dia, data);

    dia.addEventListener("click", () => {
      dataSelecionada = data;
      renderizarCalendario();
      renderizarEventos();
    });

    wrapper.appendChild(dia);
    grid.appendChild(wrapper);
  }

  const totalCelulas = primeiroDia + totalDias;
  const restantes = totalCelulas % 7 === 0 ? 0 : 7 - (totalCelulas % 7);
  for (let numeroDia = 1; numeroDia <= restantes; numeroDia++) {
    const wrapper = document.createElement("div");
    wrapper.className = "dia-wrapper";
    const dia = document.createElement("div");
    dia.className = "dia outro-mes";
    dia.textContent = numeroDia;
    wrapper.appendChild(dia);
    grid.appendChild(wrapper);
  }
}

function renderizarEventos() {
  document.getElementById("estadoVazio").textContent = "Nenhum item nesta data.";
  const data = new Date(`${dataSelecionada}T12:00:00`);
  document.getElementById("dataSelecionada").textContent = data.toLocaleDateString("pt-BR", {
    dateStyle: "full",
  });
  listaEventos.innerHTML = "";

  const doDia = eventos
    .filter((evento) => evento.data === dataSelecionada)
    .sort((a, b) => a.hora.localeCompare(b.hora));

  document.getElementById("estadoVazio").hidden = doDia.length > 0;

  doDia.forEach((evento) => {
    const item = document.createElement("li");
    item.className = `evento ${evento.tipo}`;

    const topo = document.createElement("div");
    topo.className = "evento-topo";
    const titulo = document.createElement("h2");
    titulo.textContent = evento.titulo;
    const hora = document.createElement("time");
    hora.className = "evento-hora";
    hora.textContent = evento.hora;
    topo.append(titulo, hora);

    const remover = document.createElement("button");
    remover.className = "botao-remover";
    remover.type = "button";
    remover.textContent = "×";
    remover.setAttribute("aria-label", `Remover ${evento.titulo}`);
    remover.addEventListener("click", async () => {
      remover.disabled = true;
      try {
        await requisicaoApi(`/api/psicologo/eventos/${encodeURIComponent(evento.id)}`, { method: "DELETE" });
        eventos = eventos.filter((itemSalvo) => itemSalvo.id !== evento.id);
        renderizarCalendario();
        renderizarEventos();
      } catch (error) {
        remover.disabled = false;
        window.alert(error.message);
      }
    });
    topo.appendChild(remover);
    item.appendChild(topo);

    if (evento.detalhes) {
      const detalhes = document.createElement("p");
      detalhes.textContent = evento.detalhes;
      item.appendChild(detalhes);
    }

    const rotulo = document.createElement("span");
    rotulo.className = "evento-rotulo";
    const tipoEvento = evento.tipo === "autoaviso" ? "Autoaviso" : evento.tipo === "aviso" ? "Aviso" : "Compromisso";
    rotulo.textContent = evento.paciente_nome ? `${tipoEvento} · ${evento.paciente_nome}` : `${tipoEvento} · Geral`;
    item.appendChild(rotulo);
    listaEventos.appendChild(item);
  });
}

async function solicitarPermissaoNotificacao() {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {}
}

function verificarAutoavisos() {
  const agora = Date.now();
  let alterou = false;

  eventos.forEach((evento) => {
    if (evento.tipo !== "autoaviso" || !evento.notificar || evento.notificado) return;
    const horario = new Date(`${evento.data}T${evento.hora.slice(0, 5)}:00`).getTime();
    const atraso = agora - horario;
    if (atraso < 0) return;

    if (atraso <= 60000 && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const notificacao = new Notification("Autoaviso Aflorar", {
        body: `${evento.titulo} • ${evento.hora}`,
      });
      notificacao.onclick = () => window.focus();
    }

    evento.notificado = true;
    alterou = true;
  });
  if (alterou) renderizarEventos();
}

document.getElementById("btnAnterior").addEventListener("click", () => {
  mes--;
  if (mes < 0) {
    mes = 11;
    ano--;
  }
  dataSelecionada = formatarData(new Date(ano, mes, 1));
  carregarEventosMes();
});

document.getElementById("btnProximo").addEventListener("click", () => {
  mes++;
  if (mes > 11) {
    mes = 0;
    ano++;
  }
  dataSelecionada = formatarData(new Date(ano, mes, 1));
  carregarEventosMes();
});

document.getElementById("btnNovoCompromisso").addEventListener("click", () => abrirDialogo("compromisso"));
document.getElementById("btnNovoAviso").addEventListener("click", () => abrirDialogo("aviso"));
document.getElementById("btnNovoAutoaviso").addEventListener("click", () => abrirDialogo("autoaviso"));
document.getElementById("btnFecharDialogo").addEventListener("click", () => dialogo.close());
document.getElementById("btnCancelarDialogo").addEventListener("click", () => dialogo.close());
campoDestinoEvento.addEventListener("change", atualizarDestinoEvento);

function atualizarDestinoEvento() {
  const paraPaciente = tipoAtual !== "autoaviso" && campoDestinoEvento.value === "paciente";
  areaPacienteEvento.hidden = !paraPaciente;
  campoPacienteEvento.disabled = !paraPaciente || pacientesVinculados.length === 0;
  campoPacienteEvento.required = paraPaciente && pacientesVinculados.length > 0;
  avisoSemPacientes.hidden = !paraPaciente || pacientesVinculados.length > 0;
}

function abrirDialogo(tipo) {
  tipoAtual = tipo;
  formulario.reset();
  campoData.value = dataSelecionada;
  document.getElementById("tipoEventoDialogo").textContent = tipo === "autoaviso" ? "LEMBRETE PESSOAL" : tipo === "aviso" ? "AVISO" : "AGENDA";
  document.getElementById("tituloDialogo").textContent = tipo === "autoaviso" ? "Novo autoaviso" : tipo === "aviso" ? "Novo aviso" : "Novo compromisso";
  document.getElementById("opcaoNotificacao").hidden = tipo !== "autoaviso";
  destinoEventoContainer.hidden = tipo === "autoaviso";
  campoDestinoEvento.disabled = tipo === "autoaviso";
  if (tipo !== "autoaviso") {
    const pacienteInicial = new URLSearchParams(location.search).get("pacienteId");
    if (pacienteInicial && pacientesVinculados.some((vinculo) => vinculo.paciente_id === pacienteInicial)) {
      campoDestinoEvento.value = "paciente";
      campoPacienteEvento.value = pacienteInicial;
    }
  }
  atualizarDestinoEvento();
  campoNotificar.checked = tipo === "autoaviso";
  dialogo.showModal();
  campoTitulo.focus();
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (tipoAtual !== "autoaviso" && campoDestinoEvento.value === "paciente" && !campoPacienteEvento.value) {
    window.alert(pacientesVinculados.length
      ? "Selecione o paciente que receberá este evento."
      : "Não há pacientes vinculados para selecionar.");
    return;
  }
  if (tipoAtual === "autoaviso" && campoNotificar.checked) await solicitarPermissaoNotificacao();
  const botaoSalvar = formulario.querySelector(".botao-salvar");
  botaoSalvar.disabled = true;
  try {
    const resultado = await requisicaoApi("/api/psicologo/eventos", {
      method: "POST",
      body: JSON.stringify({
        tipo: tipoAtual,
        titulo: campoTitulo.value.trim(),
        data: campoData.value,
        hora: campoHora.value,
        detalhes: campoDetalhes.value.trim(),
        paciente_id: tipoAtual === "autoaviso" || campoDestinoEvento.value !== "paciente"
          ? null
          : campoPacienteEvento.value,
        notificar: tipoAtual === "autoaviso" && campoNotificar.checked,
      }),
    });
    dataSelecionada = campoData.value;
    const data = new Date(`${dataSelecionada}T12:00:00`);
    mes = data.getMonth();
    ano = data.getFullYear();
    dialogo.close();
    await carregarEventosMes();
  } catch (error) {
    window.alert(error.message);
  } finally {
    botaoSalvar.disabled = false;
  }
});

async function iniciarAgenda() {
  await carregarPacientesVinculados();
  await carregarEventosMes();
  window.setInterval(verificarAutoavisos, 15000);
}

iniciarAgenda();