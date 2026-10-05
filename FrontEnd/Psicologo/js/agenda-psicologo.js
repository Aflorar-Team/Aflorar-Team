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

const chaveAgenda = `aflorar.agenda.${usuario?.id || usuario?.email || "local"}`;
const hoje = new Date();
let mes = hoje.getMonth();
let ano = hoje.getFullYear();
let dataSelecionada = formatarData(hoje);
let tipoAtual = "compromisso";
let eventos = carregarEventos();

const grid = document.getElementById("gridDias");
const listaEventos = document.getElementById("listaEventos");
const dialogo = document.getElementById("dialogEvento");
const formulario = document.getElementById("formEvento");
const campoTitulo = document.getElementById("tituloEvento");
const campoData = document.getElementById("dataEvento");
const campoHora = document.getElementById("horaEvento");
const campoDetalhes = document.getElementById("detalhesEvento");
const campoNotificar = document.getElementById("notificarEvento");

function formatarData(data) {
  const anoLocal = data.getFullYear();
  const mesLocal = String(data.getMonth() + 1).padStart(2, "0");
  const diaLocal = String(data.getDate()).padStart(2, "0");
  return `${anoLocal}-${mesLocal}-${diaLocal}`;
}

function carregarEventos() {
  try {
    const salvos = JSON.parse(localStorage.getItem(chaveAgenda) || "[]");
    return Array.isArray(salvos) ? salvos : [];
  } catch {
    return [];
  }
}

function salvarEventos() {
  localStorage.setItem(chaveAgenda, JSON.stringify(eventos));
}

function criarMarcadores(dia, data) {
  const tipos = new Set(eventos.filter((evento) => evento.data === data).map((evento) => evento.tipo));
  if (!tipos.size) return;

  const marcadores = document.createElement("span");
  marcadores.className = "marcadores-dia";
  marcadores.setAttribute("aria-hidden", "true");

  ["compromisso", "autoaviso"].forEach((tipo) => {
    if (!tipos.has(tipo)) return;
    const marcador = document.createElement("i");
    marcador.className = tipo === "compromisso" ? "marcador-compromisso" : "marcador-autoaviso";
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
    item.className = `evento ${evento.tipo === "autoaviso" ? "autoaviso" : "compromisso"}`;

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
    remover.addEventListener("click", () => {
      eventos = eventos.filter((itemSalvo) => itemSalvo.id !== evento.id);
      salvarEventos();
      renderizarCalendario();
      renderizarEventos();
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
    rotulo.textContent = evento.tipo === "autoaviso" ? "Autoaviso" : "Compromisso";
    item.appendChild(rotulo);
    listaEventos.appendChild(item);
  });
}

function abrirDialogo(tipo) {
  tipoAtual = tipo;
  formulario.reset();
  campoData.value = dataSelecionada;
  document.getElementById("tipoEventoDialogo").textContent = tipo === "autoaviso" ? "LEMBRETE PESSOAL" : "AGENDA";
  document.getElementById("tituloDialogo").textContent = tipo === "autoaviso" ? "Novo autoaviso" : "Novo compromisso";
  document.getElementById("opcaoNotificacao").hidden = tipo !== "autoaviso";
  campoNotificar.checked = tipo === "autoaviso";
  dialogo.showModal();
  campoTitulo.focus();
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
    const horario = new Date(`${evento.data}T${evento.hora}:00`).getTime();
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

  if (alterou) salvarEventos();
}

document.getElementById("btnAnterior").addEventListener("click", () => {
  mes--;
  if (mes < 0) {
    mes = 11;
    ano--;
  }
  dataSelecionada = formatarData(new Date(ano, mes, 1));
  renderizarCalendario();
  renderizarEventos();
});

document.getElementById("btnProximo").addEventListener("click", () => {
  mes++;
  if (mes > 11) {
    mes = 0;
    ano++;
  }
  dataSelecionada = formatarData(new Date(ano, mes, 1));
  renderizarCalendario();
  renderizarEventos();
});

document.getElementById("btnNovoCompromisso").addEventListener("click", () => abrirDialogo("compromisso"));
document.getElementById("btnNovoAutoaviso").addEventListener("click", () => abrirDialogo("autoaviso"));
document.getElementById("btnFecharDialogo").addEventListener("click", () => dialogo.close());
document.getElementById("btnCancelarDialogo").addEventListener("click", () => dialogo.close());

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (tipoAtual === "autoaviso" && campoNotificar.checked) await solicitarPermissaoNotificacao();

  eventos.push({
    id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    tipo: tipoAtual,
    titulo: campoTitulo.value.trim(),
    data: campoData.value,
    hora: campoHora.value,
    detalhes: campoDetalhes.value.trim(),
    notificar: tipoAtual === "autoaviso" && campoNotificar.checked,
    notificado: false,
  });

  dataSelecionada = campoData.value;
  const data = new Date(`${dataSelecionada}T12:00:00`);
  mes = data.getMonth();
  ano = data.getFullYear();
  salvarEventos();
  dialogo.close();
  renderizarCalendario();
  renderizarEventos();
  verificarAutoavisos();
});

renderizarCalendario();
renderizarEventos();
verificarAutoavisos();
window.setInterval(verificarAutoavisos, 15000);