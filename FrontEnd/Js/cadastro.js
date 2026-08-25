const form = document.getElementById("formCadastro");
const mensagemErro = document.getElementById("mensagemErro");
const mensagemSucesso = document.getElementById("mensagemSucesso");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("password").value.trim();

  if (!nome || !email || !senha) {
    mostrarErro("Preencha todos os campos.");
    return;
  }

  if (senha.length < 6) {
    mostrarErro("A senha deve ter pelo menos 6 caracteres.");
    return;
  }

  try {
    const response = await fetch("https://aflorar-backend.onrender.com/api/cadastro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(data.erro || "Erro ao criar conta.");
      return;
    }

    mensagemErro.style.display = "none";
    mensagemSucesso.textContent = "Conta criada! Verifique seu e-mail para confirmar.";
    mensagemSucesso.style.display = "block";

    setTimeout(() => {
      window.location.href = "./login.html";
    }, 3000);

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