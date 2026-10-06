const form = document.getElementById("formCadastroPsicologo");
const mensagemErro = document.getElementById("mensagemErro");
const mensagemSucesso = document.getElementById("mensagemSucesso");

const limparNumeros = (valor = "") => valor.replace(/\D/g, "");
const limitarSenha = (valor = "") => valor.slice(0, 20);

const aplicarMascaraCpf = (input) => {
  let valor = limparNumeros(input.value).slice(0, 11);
  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  input.value = valor;
};

const aplicarMascaraCrp = (input) => {
  let valor = limparNumeros(input.value).slice(0, 8);
  if (valor.length > 2) {
    valor = valor.replace(/(\d{2})(\d)/, "$1/$2");
  }
  input.value = valor;
};

const aplicarMascaraTelefone = (input) => {
  let valor = limparNumeros(input.value).slice(0, 11);
  if (valor.length > 2) valor = valor.replace(/(\d{2})(\d)/, "($1) $2");
  if (valor.length > 7) valor = valor.replace(/(\d{5})(\d)/, "$1-$2");
  input.value = valor;
};

document.getElementById("cpf")?.addEventListener("input", (event) => aplicarMascaraCpf(event.target));
document.getElementById("crp")?.addEventListener("input", (event) => aplicarMascaraCrp(event.target));
document.getElementById("telefone")?.addEventListener("input", (event) => aplicarMascaraTelefone(event.target));
document.getElementById("password")?.addEventListener("input", (event) => {
  event.target.value = limitarSenha(event.target.value);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const cpf = limparNumeros(document.getElementById("cpf").value);
  const crp = limparNumeros(document.getElementById("crp").value);
  const email = document.getElementById("email").value.trim();
  const telefone = limparNumeros(document.getElementById("telefone").value);
  const senha = limitarSenha(document.getElementById("password").value.trim());

  if (!cpf || !crp || !email || !telefone || !senha) {
    mostrarErro("Preencha todos os campos.");
    return;
  }

  if (cpf.length !== 11) {
    mostrarErro("CPF inválido. Use 11 dígitos.");
    return;
  }

  if (crp.length < 4 || crp.length > 8) {
    mostrarErro("CRP inválido. Use entre 4 e 8 dígitos.");
    return;
  }

  if (telefone.length < 10 || telefone.length > 11) {
    mostrarErro("Telefone inválido. Use 10 ou 11 dígitos.");
    return;
  }

  if (senha.length < 6 || senha.length > 20) {
    mostrarErro("A senha deve ter entre 6 e 20 caracteres.");
    return;
  }

  try {
    const response = await fetch("https://aflorar-backend.onrender.com/api/cadastro-psicologo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf, crp, email, telefone, senha }),
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
      window.location.href = "./login-psicologo.html";
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
