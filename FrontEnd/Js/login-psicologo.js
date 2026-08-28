const form = document.getElementById("formLoginPsicologo");
const mensagemErro = document.getElementById("mensagemErro");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("password").value.trim();

  if (!email || !senha) {
    mostrarErro("Preencha todos os campos.");
    return;
  }

  try {
    const response = await fetch("https://aflorar-backend.onrender.com/api/login-psicologo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(data.erro || "Erro ao fazer login.");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    localStorage.setItem("tipo", "psicologo");

    window.location.href = "./dashboard-psicologo.html";

  } catch (error) {
    mostrarErro("Erro de conexão. Tente novamente.");
  }
});

function mostrarErro(msg) {
  mensagemErro.textContent = msg;
  mensagemErro.style.display = "block";
}

document.getElementById("togglePassword").addEventListener("click", () => {
  const input = document.getElementById("password");
  input.type = input.type === "password" ? "text" : "password";
});