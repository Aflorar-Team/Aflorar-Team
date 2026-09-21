const form = document.getElementById("formLogin");
const mensagemErro = document.getElementById("mensagemErro");

const limparNumeros = (valor = "") => valor.replace(/\D/g, "");

function aplicarMascaraCpf(input) {
  let valor = limparNumeros(input.value).slice(0, 11);
  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  input.value = valor;
}

function aplicarMascaraTelefone(input) {
  let valor = limparNumeros(input.value).slice(0, 11);
  if (valor.length > 2) valor = valor.replace(/(\d{2})(\d)/, "($1) $2");
  if (valor.length > 7) valor = valor.replace(/(\d{5})(\d)/, "$1-$2");
  input.value = valor;
}

document.getElementById("cpf")?.addEventListener("input", (event) => aplicarMascaraCpf(event.target));
document.getElementById("telefone")?.addEventListener("input", (event) => aplicarMascaraTelefone(event.target));

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const cpf = limparNumeros(document.getElementById("cpf").value);
  const telefone = limparNumeros(document.getElementById("telefone").value);
  const senha = document.getElementById("password").value.trim();

  if (!email || !cpf || !telefone || !senha) {
    mostrarErro("Preencha todos os campos.");
    return;
  }

  if (cpf.length !== 11) {
    mostrarErro("CPF inválido.");
    return;
  }

  if (telefone.length < 10 || telefone.length > 11) {
    mostrarErro("Telefone inválido.");
    return;
  }

  try {
    const response = await fetch("https://aflorar-backend.onrender.com/api/login-paciente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, cpf, telefone, senha }),
    });

    const data = await response.json();

    if (!response.ok) {
      mostrarErro(data.erro || "Erro ao fazer login.");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    localStorage.setItem("tipo", "paciente");

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