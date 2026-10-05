const form = document.getElementById("formCadastro");
const mensagemErro = document.getElementById("mensagemErro");
const mensagemSucesso = document.getElementById("mensagemSucesso");

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

  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("password").value.trim();
  const cpf = limparNumeros(document.getElementById("cpf").value);
  const telefone = limparNumeros(document.getElementById("telefone").value);

  if (!nome || !email || !senha || !cpf || !telefone) {
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

  if (senha.length < 6) {
    mostrarErro("A senha deve ter pelo menos 6 caracteres.");
    return;
  }

  try {
    const response = await fetch("https://aflorar-backend.onrender.com/api/cadastro-paciente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, cpf, telefone }),
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
      window.location.href = "./login-paciente.html";
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