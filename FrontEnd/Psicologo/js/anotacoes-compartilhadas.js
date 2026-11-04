const API_URL = "https://aflorar-backend.onrender.com";
const pacienteSelect = document.getElementById("pacienteCompartilhado");
const statusCompartilhadas = document.getElementById("statusCompartilhadas");
const listaCompartilhadas = document.getElementById("listaCompartilhadas");

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

async function carregarAnotacoes() {
  const pacienteId = pacienteSelect.value;
  if (!pacienteId) return;
  statusCompartilhadas.textContent = "Carregando anotações...";
  listaCompartilhadas.replaceChildren();
  try {
    const resultado = await requisicaoApi(
      `/api/psicologo/pacientes/${encodeURIComponent(pacienteId)}/evolucoes-compartilhadas`,
    );
    if (!resultado.evolucoes.length) {
      statusCompartilhadas.textContent = "Este paciente ainda não compartilhou anotações do jardim.";
      return;
    }
    statusCompartilhadas.textContent = `${resultado.evolucoes.length} anotação(ões) compartilhada(s).`;
    resultado.evolucoes.forEach((evolucao) => {
      const item = document.createElement("article");
      item.className = "evolucao-compartilhada";
      const meta = document.createElement("div");
      meta.className = "evolucao-meta";
      const jardim = document.createElement("span");
      jardim.textContent = evolucao.jardim;
      const data = document.createElement("time");
      data.dateTime = evolucao.criado_em;
      data.textContent = new Date(evolucao.criado_em).toLocaleString("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      const texto = document.createElement("p");
      texto.textContent = evolucao.texto;
      meta.append(jardim, data);
      item.append(meta, texto);
      listaCompartilhadas.appendChild(item);
    });
  } catch (error) {
    statusCompartilhadas.textContent = error.message;
  }
}

async function carregarPacientes() {
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
      statusCompartilhadas.textContent = "Nenhum paciente com vínculo confirmado.";
      return;
    }
    await carregarAnotacoes();
  } catch (error) {
    statusCompartilhadas.textContent = error.message;
  }
}

pacienteSelect.addEventListener("change", carregarAnotacoes);
carregarPacientes();