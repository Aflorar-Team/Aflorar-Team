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