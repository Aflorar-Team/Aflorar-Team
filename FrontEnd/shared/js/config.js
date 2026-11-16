// Carrega dados salvos
const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
const nomeInput = document.getElementById("nome");
const cpfInput = document.getElementById("cpf");
const crpInput = document.getElementById("crp");
const emailInput = document.getElementById("email");
const telefoneInput = document.getElementById("telefone");
const API_URL = "https://aflorar-backend.onrender.com";

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
  const definirTema = window.AflorarTheme?.alternar;
  if (!definirTema) throw new Error("O serviço de tema não foi carregado.");
  definirTema().then(atualizarBotaoTemaSalvo).catch((error) => {
    mostrarToast(error.message, "#E8717A");
  });
}

function atualizarBotaoTemaSalvo() {
  const btnModo = document.getElementById("btnModoEscuro");
  if (!btnModo) return;
  const isDark = document.documentElement.dataset.theme === "escuro";
  btnModo.querySelector(".icone").textContent = isDark ? "☀️" : "🌙";
  const rotulo = btnModo.querySelector(".nav-label");
  if (rotulo) rotulo.textContent = isDark ? "Modo claro" : "Modo escuro";
  btnModo.setAttribute("aria-pressed", String(isDark));
}

window.addEventListener("aflorar:tema-alterado", atualizarBotaoTemaSalvo);
atualizarBotaoTemaSalvo();

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
async function salvarDados() {
  const nome = nomeInput.value.trim();
  const cpf = cpfInput.value.replace(/\D/g, "");
  const telefone = telefoneInput.value.replace(/\D/g, "");
  const perfil = localStorage.getItem("tipo");
  const senha = document.getElementById("senha").value;
  const confirmar = document.getElementById("confirmarSenha").value;
  const botao = document.querySelector(".btn-editar");

  if (!nome || cpf.length !== 11 || ![10, 11].includes(telefone.length)) {
    mostrarToast("Confira nome, CPF e telefone antes de salvar.", "#E8717A");
    return;
  }
  if (!["paciente", "psicologo"].includes(perfil)) {
    mostrarToast("Não foi possível identificar o perfil da conta. Entre novamente.", "#E8717A");
    return;
  }
  if (perfil === "psicologo" && !/^\d{2}\/\d{4,8}$/.test(crpInput.value.trim())) {
    mostrarToast("Informe o CRP no formato UF/número.", "#E8717A");
    return;
  }
  if ((senha || confirmar) && senha !== confirmar) {
    mostrarToast("As senhas não coincidem.", "#E8717A");
    return;
  }
  if (senha && (senha.length < 6 || senha.length > 20)) {
    mostrarToast("A nova senha deve ter entre 6 e 20 caracteres.", "#E8717A");
    return;
  }

  botao.disabled = true;
  botao.textContent = "Salvando...";
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/api/configuracoes/perfil`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        perfil,
        nome,
        cpf,
        telefone,
        ...(perfil === "psicologo" ? { crp: crpInput.value.trim() } : {}),
        ...(senha ? { senha } : {}),
      }),
    });
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.erro || "Não foi possível atualizar os dados.");

    localStorage.setItem("usuario", JSON.stringify(resultado.usuario));
    document.getElementById("senha").value = "";
    document.getElementById("confirmarSenha").value = "";
    mostrarToast(resultado.statusPerfil === "pendente"
      ? "Dados salvos. O perfil profissional precisa ser verificado novamente."
      : "Dados atualizados com sucesso!");
  } catch (error) {
    mostrarToast(error.message || "Não foi possível salvar os dados.", "#E8717A");
  } finally {
    botao.disabled = false;
    botao.textContent = "Editar dados";
  }
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

async function requisicaoPaciente(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const resultado = await response.json();
  if (!response.ok) throw new Error(resultado.erro || "Não foi possível concluir a solicitação.");
  return resultado;
}

async function carregarCodigoPaciente() {
  const codigo = document.getElementById("codigoVinculoPaciente");
  const botaoCopiar = document.getElementById("copiarCodigoPaciente");
  if (!codigo || !botaoCopiar) return;

  try {
    const resultado = await requisicaoPaciente("/api/paciente/codigo-vinculo");
    codigo.textContent = resultado.codigo;
    botaoCopiar.disabled = false;
  } catch (error) {
    codigo.textContent = "Indisponível";
    document.getElementById("statusCodigoPaciente").textContent = error.message;
  }

  botaoCopiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(codigo.textContent);
      document.getElementById("statusCodigoPaciente").textContent = "Código copiado.";
    } catch {
      document.getElementById("statusCodigoPaciente").textContent = "Não foi possível copiar. Selecione e copie o código.";
    }
  });
}

async function carregarSolicitacoesPaciente() {
  const lista = document.getElementById("listaSolicitacoesPaciente");
  if (!lista) return;

  try {
    const resultado = await requisicaoPaciente("/api/paciente/vinculos-pendentes");
    lista.replaceChildren();
    if (!resultado.solicitacoes.length) {
      lista.appendChild(document.createElement("li")).textContent = "Nenhuma solicitação pendente.";
      return;
    }

    resultado.solicitacoes.forEach((solicitacao) => {
      const item = document.createElement("li");
      const profissional = document.createElement("span");
      profissional.textContent = solicitacao.psicologo.crp
        ? `${solicitacao.psicologo.nome} · CRP ${solicitacao.psicologo.crp}`
        : solicitacao.psicologo.nome;
      const aceitar = document.createElement("button");
      aceitar.type = "button";
      aceitar.className = "btn-aceitar-vinculo";
      aceitar.textContent = "Aceitar";
      aceitar.addEventListener("click", async () => {
        aceitar.disabled = true;
        try {
          const resposta = await requisicaoPaciente(
            `/api/paciente/vinculos/${encodeURIComponent(solicitacao.id)}/aceitar`,
            { method: "POST" },
          );
          document.getElementById("statusSolicitacoesPaciente").textContent = resposta.mensagem;
          await carregarSolicitacoesPaciente();
        } catch (error) {
          aceitar.disabled = false;
          document.getElementById("statusSolicitacoesPaciente").textContent = error.message;
        }
      });
      item.append(profissional, aceitar);
      lista.appendChild(item);
    });
  } catch (error) {
    lista.replaceChildren();
    lista.appendChild(document.createElement("li")).textContent = error.message;
  }
}

carregarCodigoPaciente();
carregarSolicitacoesPaciente();

// Máscara telefone
if (telefoneInput) {
  telefoneInput.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "").slice(0, 11);
    v = v.replace(/(\d{2})(\d)/, "($1) $2");
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
    this.value = v;
  });
}