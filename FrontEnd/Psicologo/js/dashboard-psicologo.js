// Verifica se o usuário está logado como psicólogo
const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
const tipo = localStorage.getItem("tipo");

if (!usuario || tipo !== "psicologo") {
  window.location.href = "./login-psicologo.html";
}

// Exibe o nome do psicólogo no boas-vindas
const boasVindas = document.querySelector(".boas-vindas h2");
if (usuario?.user_metadata?.nome) {
  boasVindas.textContent = `Bem-Vindo(a), ${usuario.user_metadata.nome}!`;
}

const modal = document.getElementById("popupModal");
const popupTitulo = document.getElementById("popupTitulo");
const popupTexto = document.getElementById("popupTexto");
const modalClose = document.querySelector(".modal-close");

const popups = {
  demanda: {
    titulo: "Demanda de hoje",
    texto: "Aqui você visualiza as solicitações de atendimento, prioridades e o resumo das demandas pendentes do dia."
  },
  mensagens: {
    titulo: "Mensagens",
    texto: "Este espaço reunirá suas mensagens recentes com pacientes, lembretes e respostas pendentes da sua agenda."
  },
  pacientes: {
    titulo: "Adicionar Pacientes",
    texto: "Aqui você poderá cadastrar novos pacientes, vincular prontuários e iniciar o acompanhamento de forma organizada."
  }
};

function abrirPopup(chave) {
  const item = popups[chave];
  if (!item || !modal) return;

  popupTitulo.textContent = item.titulo;
  popupTexto.textContent = item.texto;
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
}

function fecharPopup() {
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

document.querySelectorAll(".btn-acao").forEach((botao) => {
  botao.addEventListener("click", () => abrirPopup(botao.dataset.popup));
});

if (modalClose) {
  modalClose.addEventListener("click", fecharPopup);
}

if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) fecharPopup();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal?.classList.contains("active")) {
    fecharPopup();
  }
});