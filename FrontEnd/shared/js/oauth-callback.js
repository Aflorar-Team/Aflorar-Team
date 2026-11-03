const statusOAuth = document.getElementById("oauthStatus");
const erroOAuth = document.getElementById("oauthError");
const pendenteOAuth = document.getElementById("oauthPending");
const voltarOAuth = document.getElementById("oauthBack");

window.AflorarAuth.processarRetornoGoogle().catch((error) => {
  if (["PSICOLOGO_PENDENTE", "PSICOLOGO_RECUSADO"].includes(error.code)) {
    statusOAuth.textContent = error.message;
    pendenteOAuth.hidden = false;
    return;
  }

  statusOAuth.textContent = "Não foi possível concluir o acesso.";
  erroOAuth.textContent = error.message || "Tente novamente pelo login do seu tipo de conta.";
  erroOAuth.style.display = "block";
  voltarOAuth.hidden = false;
});