const API_URL = "https://aflorar-backend.onrender.com";
const linkRecuperacao = document.querySelector(".forgot");

linkRecuperacao?.addEventListener("click", async (event) => {
  event.preventDefault();
  const email = document.getElementById("email").value.trim();
  const mensagem = document.getElementById("mensagemErro");

  if (!email) {
    mensagem.textContent = "Informe seu e-mail para receber o link de recuperação.";
    mensagem.style.display = "block";
    document.getElementById("email").focus();
    return;
  }

  linkRecuperacao.setAttribute("aria-disabled", "true");
  mensagem.style.color = "#3b6848";
  mensagem.textContent = "Solicitando link de recuperação...";
  mensagem.style.display = "block";

  try {
    const response = await fetch(`${API_URL}/api/auth/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.erro || "Não foi possível solicitar a recuperação.");
    mensagem.textContent = resultado.mensagem;
  } catch (error) {
    mensagem.style.color = "#a9353d";
    mensagem.textContent = error.message || "Falha ao solicitar recuperação. Tente novamente.";
  } finally {
    linkRecuperacao.removeAttribute("aria-disabled");
  }
});
