const form = document.getElementById("formLogin");
const mensagemErro = document.getElementById("mensagemErro");
const limitarSenha = (valor = "") => valor.slice(0, 20);

window.AflorarAuth.restaurarSessao("paciente");

document.getElementById("password")?.addEventListener("input", (event) => {
  event.target.value = limitarSenha(event.target.value);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const senha = limitarSenha(document.getElementById("password").value.trim());

  if (!email || !senha) {
    mostrarErro("Preencha e-mail e senha.");
    return;
  }

  if (senha.length > 20) {
    mostrarErro("A senha deve ter no máximo 20 caracteres.");
    return;
  }

  try {
    const response = await fetch("https://aflorar-backend.onrender.com/api/login-paciente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(data.erro || "Erro ao fazer login.");
      return;
    }

    window.AflorarAuth.salvarSessao(data, "paciente");

    window.location.href = "./inicio.html";

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