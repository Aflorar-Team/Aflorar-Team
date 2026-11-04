const API_URL = "https://aflorar-backend.onrender.com";
const pacienteSelect = document.getElementById("pacienteNota");
const dataNota = document.getElementById("dataNota");
const editor = document.getElementById("editor");
const statusNota = document.getElementById("statusNota");
const botaoSalvar = document.getElementById("salvarNota");
let timerSalvamento;

function dataHoje() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${hoje.getFullYear()}-${mes}-${dia}`;
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
  if (!response.ok) throw new Error(resultado.erro || "Não foi possível concluir a solicitação.");
  return resultado;
}

async function carregarAnotacao() {
  const pacienteId = pacienteSelect.value;
  const data = dataNota.value;
  if (!pacienteId || !data) return;
  clearTimeout(timerSalvamento);
  editor.disabled = true;
  statusNota.textContent = "Carregando anotação...";
  try {
    const resultado = await requisicaoApi(
      `/api/psicologo/pacientes/${encodeURIComponent(pacienteId)}/anotacoes?data=${encodeURIComponent(data)}`,
    );
    editor.value = resultado.anotacao.conteudo;
    editor.disabled = false;
    statusNota.textContent = resultado.anotacao.atualizado_em
      ? `Salva em ${new Date(resultado.anotacao.atualizado_em).toLocaleString("pt-BR")}`
      : "Sem anotação salva para este dia.";
    document.getElementById("tituloNota").textContent = `Anotação · ${pacienteSelect.selectedOptions[0].textContent}`;
  } catch (error) {
    editor.value = "";
    statusNota.textContent = error.message;
  }
}

async function salvarAnotacao() {
  const pacienteId = pacienteSelect.value;
  if (!pacienteId || !dataNota.value) return;
  botaoSalvar.disabled = true;
  statusNota.textContent = "Salvando...";
  try {
    await requisicaoApi(`/api/psicologo/pacientes/${encodeURIComponent(pacienteId)}/anotacoes`, {
      method: "PUT",
      body: JSON.stringify({ data: dataNota.value, conteudo: editor.value }),
    });
    statusNota.textContent = `Salva em ${new Date().toLocaleString("pt-BR")}`;
  } catch (error) {
    statusNota.textContent = error.message;
  } finally {
    botaoSalvar.disabled = false;
  }
}

async function carregarPacientes() {
  pacienteSelect.replaceChildren();
  editor.disabled = true;
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
      statusNota.textContent = "Nenhum paciente com vínculo confirmado.";
      return;
    }
    editor.disabled = false;
    await carregarAnotacao();
  } catch (error) {
    statusNota.textContent = error.message;
  }
}

function exportarPDF() {
  if (!window.jspdf?.jsPDF) {
    statusNota.textContent = "Não foi possível carregar a ferramenta de exportação do PDF.";
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const linhas = doc.splitTextToSize(editor.value.trim() || "Sem anotações.", 180);
  doc.setFontSize(16);
  doc.text(`Anotação diária · ${pacienteSelect.selectedOptions[0]?.textContent || "Paciente"}`, 14, 20);
  doc.setFontSize(12);
  doc.text(`Data: ${dataNota.value}`, 14, 29);
  let posicaoY = 40;
  linhas.forEach((linha) => {
    if (posicaoY > 280) {
      doc.addPage();
      posicaoY = 20;
    }
    doc.text(linha, 14, posicaoY);
    posicaoY += 7;
  });
  doc.save(`anotacao-${dataNota.value}.pdf`);
}

dataNota.value = dataHoje();
dataNota.addEventListener("change", carregarAnotacao);
pacienteSelect.addEventListener("change", carregarAnotacao);
botaoSalvar.addEventListener("click", salvarAnotacao);
editor.addEventListener("input", () => {
  clearTimeout(timerSalvamento);
  statusNota.textContent = "Alterações não salvas.";
  timerSalvamento = setTimeout(salvarAnotacao, 1000);
});

carregarPacientes();