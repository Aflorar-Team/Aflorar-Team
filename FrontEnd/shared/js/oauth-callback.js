const statusOAuth = document.getElementById("oauthStatus");
const erroOAuth = document.getElementById("oauthError");
const pendenteOAuth = document.getElementById("oauthPending");
const voltarOAuth = document.getElementById("oauthBack");

window.AflorarAuth.processarRetornoGoogle().catch((error) => {
  if (error.code === "PSICOLOGO_PENDENTE") {
    statusOAuth.textContent = error.message;
    pendenteOAuth.hidden = false;
    return;
  }

  statusOAuth.textContent = "Não foi possível concluir o acesso.";
  erroOAuth.textContent = error.message || "Tente novamente pelo login do seu tipo de conta.";
  erroOAuth.style.display = "block";
  voltarOAuth.hidden = false;
});