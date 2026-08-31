const form = document.getElementById("formLogin");
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

    // Salva o token e nome do usuário
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));

    // Redireciona para a página inicial
    window.location.href = "./inicio.html";

  } catch (error) {
    mostrarErro("Erro de conexão. Tente novamente.");
  }
});

function mostrarErro(msg) {
  mensagemErro.textContent = msg;
  mensagemErro.style.display = "block";
}

// Toggle mostrar/ocultar senha
document.getElementById("togglePassword").addEventListener("click", () => {
  const input = document.getElementById("password");
  input.type = input.type === "password" ? "text" : "password";
});