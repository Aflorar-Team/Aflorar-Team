const API_URL = "https://aflorar-backend.onrender.com";
const loginAdmin = document.getElementById("adminLogin");
const dashboardAdmin = document.getElementById("adminDashboard");
const statusAdmin = document.getElementById("adminStatus");
const listaPendentes = document.getElementById("pendingList");
const botaoSairAdmin = document.getElementById("adminLogout");
let tokenAdmin;

function setStatusAdmin(mensagem, erro = false) {
  statusAdmin.textContent = mensagem;
  statusAdmin.classList.toggle("is-error", erro);
}

function criarCampoResumo(rotulo, valor) {
  const linha = document.createElement("div");
  linha.className = "review-detail";
  const titulo = document.createElement("span");
  titulo.textContent = rotulo;
  const conteudo = document.createElement("strong");
  conteudo.textContent = valor || "Não informado";
  linha.append(titulo, conteudo);
  return linha;
}

function criarConfirmacao(rotulo, tipo, usuarioId) {
  const label = document.createElement("label");
  label.className = "review-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.check = tipo;
  input.dataset.usuarioId = usuarioId;
  const texto = document.createElement("span");
  texto.textContent = rotulo;
  label.append(input, texto);
  return label;
}

function criarCardRevisao(cadastro) {
  const card = document.createElement("article");
  card.className = "review-item";
  const titulo = document.createElement("h2");
  titulo.textContent = cadastro.usuario?.nome || "Nome não informado";
  const email = document.createElement("p");
  email.className = "review-email";
  email.textContent = cadastro.usuario?.email || "E-mail não informado";

  const detalhes = document.createElement("div");
  detalhes.className = "review-details";
  detalhes.append(
    criarCampoResumo("CRP", cadastro.crp),
    criarCampoResumo("e-Psi informado", cadastro.epsi),
    criarCampoResumo("CPF", cadastro.cpf),
    criarCampoResumo("Telefone", cadastro.telefone),
    criarCampoResumo("Solicitado em", new Date(cadastro.criado_em).toLocaleDateString("pt-BR")),
  );

  const verificacoes = document.createElement("div");
  verificacoes.className = "review-checks";
  verificacoes.append(
    criarConfirmacao("CRP ativo confirmado no CFP", "registro", cadastro.usuario_id),
    criarConfirmacao("Cadastro e-Psi conferido", "epsi", cadastro.usuario_id),
    criarConfirmacao("Identidade conferida por videochamada ou serviço apropriado", "identidade", cadastro.usuario_id),
  );

  const observacao = document.createElement("textarea");
  observacao.dataset.observacao = cadastro.usuario_id;
  observacao.rows = 2;
  observacao.maxLength = 500;
  observacao.placeholder = "Observação da revisão; não inclua dados de documentos";
  observacao.setAttribute("aria-label", "Observação da revisão");

  const acoes = document.createElement("div");
  acoes.className = "review-actions";
  const recusar = document.createElement("button");
  recusar.type = "button";
  recusar.className = "secondary-button danger-button";
  recusar.textContent = "Recusar";
  recusar.addEventListener("click", () => revisarCadastro(cadastro.usuario_id, "recusado", card));
  const aprovar = document.createElement("button");
  aprovar.type = "button";
  aprovar.className = "admin-button approve-button";
  aprovar.textContent = "Aprovar profissional";
  aprovar.addEventListener("click", () => revisarCadastro(cadastro.usuario_id, "aprovado", card));
  acoes.append(recusar, aprovar);

  card.append(titulo, email, detalhes, verificacoes, observacao, acoes);
  return card;
}

async function carregarPendentes() {
  setStatusAdmin("Carregando cadastros pendentes...");
  listaPendentes.replaceChildren();
  const response = await fetch(`${API_URL}/api/admin/psychologists/pending`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.erro || "Não foi possível carregar a fila.");

  if (!data.cadastros.length) {
    setStatusAdmin("Não há cadastros aguardando revisão.");
    return;
  }

  data.cadastros.forEach((cadastro) => listaPendentes.append(criarCardRevisao(cadastro)));
  setStatusAdmin(`${data.cadastros.length} cadastro(s) aguardando revisão.`);
}

async function revisarCadastro(usuarioId, decisao, card) {
  const checks = [...card.querySelectorAll(`input[data-usuario-id="${usuarioId}"]`)];
  const observacao = card.querySelector(`textarea[data-observacao="${usuarioId}"]`).value.trim();
  if (decisao === "aprovado" && checks.some((check) => !check.checked)) {
    setStatusAdmin("Confirme CRP, e-Psi e identidade antes de aprovar.", true);
    return;
  }
  if (decisao === "recusado" && !observacao) {
    setStatusAdmin("Registre uma observação para justificar a recusa.", true);
    return;
  }

  const botoes = card.querySelectorAll("button");
  botoes.forEach((botao) => { botao.disabled = true; });
  try {
    const response = await fetch(`${API_URL}/api/admin/psychologists/${encodeURIComponent(usuarioId)}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenAdmin}`,
      },
      body: JSON.stringify({
        decisao,
        registroConferido: checks.find((check) => check.dataset.check === "registro")?.checked === true,
        epsiConferido: checks.find((check) => check.dataset.check === "epsi")?.checked === true,
        identidadeConferida: checks.find((check) => check.dataset.check === "identidade")?.checked === true,
        observacao,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.erro || "Não foi possível registrar a decisão.");
    card.remove();
    setStatusAdmin(data.mensagem);
    if (!listaPendentes.children.length) setStatusAdmin("Revisão concluída. Não há outros cadastros pendentes.");
  } catch (error) {
    setStatusAdmin(error.message, true);
    botoes.forEach((botao) => { botao.disabled = false; });
  }
}

async function iniciarPainelAdmin() {
  try {
    const client = await window.AflorarAuth.getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      loginAdmin.hidden = false;
      return;
    }

    tokenAdmin = data.session.access_token;
    dashboardAdmin.hidden = false;
    botaoSairAdmin.hidden = false;
    await carregarPendentes();
  } catch (error) {
      dashboardAdmin.hidden = true;
      botaoSairAdmin.hidden = true;
    loginAdmin.hidden = false;
    const mensagem = document.getElementById("mensagemErro");
    mensagem.textContent = error.message || "Não foi possível iniciar o painel.";
    mensagem.hidden = false;
  }
}

document.getElementById("refreshQueue").addEventListener("click", () => {
  carregarPendentes().catch((error) => setStatusAdmin(error.message, true));
});

botaoSairAdmin.addEventListener("click", async () => {
  const client = await window.AflorarAuth.getClient();
  await client.auth.signOut({ scope: "local" });
  window.location.replace("./admin.html");
});

iniciarPainelAdmin();