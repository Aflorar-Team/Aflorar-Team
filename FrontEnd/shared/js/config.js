// Carrega dados salvos
const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
const nomeInput = document.getElementById("nome");
const cpfInput = document.getElementById("cpf");
const crpInput = document.getElementById("crp");
const emailInput = document.getElementById("email");
const telefoneInput = document.getElementById("telefone");

if (nomeInput) {
  nomeInput.value = usuario?.user_metadata?.nome || usuario?.nome || "";
}

if (cpfInput) {
  cpfInput.value = usuario?.user_metadata?.cpf || "";
}

if (crpInput) {
  crpInput.value = usuario?.user_metadata?.crp || "";
}

if (emailInput) {
  emailInput.value = usuario?.email || "";
}

if (telefoneInput) {
  telefoneInput.value = usuario?.user_metadata?.telefone || "";
}

// Modo escuro
function alternarModo() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("tema", isDark ? "escuro" : "claro");
  const btnModo = document.getElementById("btnModoEscuro");
  if (btnModo) {
    btnModo.querySelector(".icone").textContent = isDark ? "☀️" : "🌙";
  }
}

// Aplica tema salvo
if (localStorage.getItem("tema") === "escuro") {
  document.body.classList.add("dark");
  const btnModo = document.getElementById("btnModoEscuro");
  if (btnModo) {
    btnModo.querySelector(".icone").textContent = "☀️";
  }
}

// Sair
async function sair() {
  if (window.AflorarAuth) {
    await window.AflorarAuth.sair();
    return;
  }

  ["token", "refreshToken", "tokenExpiraEm", "usuario", "tipo"].forEach((chave) => {
    localStorage.removeItem(chave);
  });
  window.location.href = "../escolha-tipo-conta.html";
}

// Salvar dados
function salvarDados() {
  const senha = document.getElementById("senha").value;
  const confirmar = document.getElementById("confirmarSenha").value;

  if (senha && senha !== confirmar) {
    mostrarToast("❌ As senhas não coincidem!", "#E8717A");
    return;
  }

  mostrarToast("✅ Dados atualizados com sucesso!");
}

function mostrarToast(msg, cor = "#4A7C59") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.background = cor;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 3000);
}

// Máscara CPF
if (cpfInput) {
  cpfInput.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "").slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    this.value = v;
  });
}

// Máscara telefone
if (telefoneInput) {
  telefoneInput.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "").slice(0, 11);
    v = v.replace(/(\d{2})(\d)/, "($1) $2");
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
    this.value = v;
  });
}