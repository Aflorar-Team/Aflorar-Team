const tipoPerfilGoogle = new URLSearchParams(window.location.search).get("tipo");
const API_URL = "https://aflorar-backend.onrender.com";
const formularioPerfilGoogle = document.getElementById("formPerfilGoogle");
const erroPerfilGoogle = document.getElementById("erroPerfilGoogle");
const sucessoPerfilGoogle = document.getElementById("sucessoPerfilGoogle");
const inputNomeGoogle = document.getElementById("nomeGoogle");
const inputEmailGoogle = document.getElementById("emailGoogle");
const inputCpfGoogle = document.getElementById("cpfGoogle");
const inputTelefoneGoogle = document.getElementById("telefoneGoogle");
const inputCrpGoogle = document.getElementById("crpGoogle");
const botaoSalvarGoogle = document.getElementById("salvarPerfilGoogle");
const botaoSair = document.getElementById("Logout");
let sessaoGoogle;

function limparNumeros(valor = "") {
  return valor.replace(/\D/g, "");
}

function mostrarErroPerfil(mensagem) {
  erroPerfilGoogle.textContent = mensagem;
  erroPerfilGoogle.style.display = "block";
}

function aplicarMascaraCpfGoogle() {
  let valor = limparNumeros(inputCpfGoogle.value).slice(0, 11);
  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
  valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  inputCpfGoogle.value = valor;
}

function aplicarMascaraTelefoneGoogle() {
  let valor = limparNumeros(inputTelefoneGoogle.value).slice(0, 11);
  if (valor.length > 2) valor = valor.replace(/(\d{2})(\d)/, "($1) $2");
  if (valor.length > 7) valor = valor.replace(/(\d{5})(\d)/, "$1-$2");
  inputTelefoneGoogle.value = valor;
}

async function carregarPerfilGoogle() {
  if (!["paciente", "psicologo"].includes(tipoPerfilGoogle)) {
    throw new Error("Tipo de perfil inválido. Inicie novamente pelo login.");
  }

  const client = await window.AflorarAuth.getClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error("Sua sessão não foi encontrada. Faça login pelo Google novamente.");

  sessaoGoogle = data.session;
  const usuario = data.session.user;
  const metadados = usuario.user_metadata || {};
  const perfilSalvo = metadados.perfis?.[tipoPerfilGoogle] || {};

  document.getElementById("tituloPerfil").textContent = tipoPerfilGoogle === "psicologo"
    ? "Complete seu cadastro profissional"
    : "Complete seu cadastro de paciente";
  document.getElementById("campoCrpGoogle").hidden = tipoPerfilGoogle !== "psicologo";
  inputCrpGoogle.required = tipoPerfilGoogle === "psicologo";
  inputNomeGoogle.value = perfilSalvo.nome || metadados.full_name || metadados.name || "";
  inputEmailGoogle.value = usuario.email || "";
  inputCpfGoogle.value = perfilSalvo.cpf || "";
  inputTelefoneGoogle.value = perfilSalvo.telefone || "";
  inputCrpGoogle.value = perfilSalvo.crp || "";
}

inputCpfGoogle.addEventListener("input", aplicarMascaraCpfGoogle);
inputTelefoneGoogle.addEventListener("input", aplicarMascaraTelefoneGoogle);

formularioPerfilGoogle.addEventListener("submit", async (event) => {
  event.preventDefault();
  erroPerfilGoogle.style.display = "none";

  const nome = inputNomeGoogle.value.trim();
  const cpf = limparNumeros(inputCpfGoogle.value);
  const telefone = limparNumeros(inputTelefoneGoogle.value);
  const crp = limparNumeros(inputCrpGoogle.value);

  if (!nome || cpf.length !== 11 || telefone.length < 10 || telefone.length > 11) {
    mostrarErroPerfil("Confira nome, CPF e telefone antes de continuar.");
    return;
  }

  if (tipoPerfilGoogle === "psicologo" && (crp.length < 6 || crp.length > 10)) {
    mostrarErroPerfil("Informe um CRP válido.");
    return;
  }

  botaoSalvarGoogle.disabled = true;

  try {
    const client = await window.AflorarAuth.getClient();
    const response = await fetch(`${API_URL}/api/oauth/complete-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessaoGoogle.access_token}`,
      },
      body: JSON.stringify({ tipo: tipoPerfilGoogle, nome, cpf, telefone, crp }),
    });
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.erro || "Não foi possível salvar seu perfil.");

    if (resultado.statusPerfil === "pendente") {
      await client.auth.signOut({ scope: "local" });
      formularioPerfilGoogle.querySelectorAll("input, button").forEach((campo) => {
        campo.disabled = true;
      });
      sucessoPerfilGoogle.textContent = resultado.mensagem;
      sucessoPerfilGoogle.style.display = "block";
      return;
    }

    const { data: sessaoAtualizada, error: erroSessao } = await client.auth.refreshSession();
    if (erroSessao || !sessaoAtualizada.session) {
      throw erroSessao || new Error("Perfil salvo, mas não foi possível atualizar a sessão. Entre novamente.");
    }
    const sessaoSalva = sessaoAtualizada.session;

    window.AflorarAuth.salvarSessao({
      token: sessaoSalva.access_token,
      refreshToken: sessaoSalva.refresh_token,
      expiresAt: sessaoSalva.expires_at,
      usuario: sessaoSalva.user,
    }, tipoPerfilGoogle);

    window.location.replace(tipoPerfilGoogle === "psicologo"
      ? "./Psicologo/dashboard-psicologo.html"
      : "./Paciente/inicio.html");
  } catch (error) {
    mostrarErroPerfil(error.message || "Não foi possível salvar seu perfil.");
    botaoSalvarGoogle.disabled = false;
  }
});

carregarPerfilGoogle().catch((error) => {
  mostrarErroPerfil(error.message || "Não foi possível carregar sua conta.");
  formularioPerfilGoogle.querySelectorAll("input, button").forEach((campo) => {
    campo.disabled = true;
  });
});
botaoSair.addEventListener("click", async () => {
  const client = await window.AflorarAuth.getClient();
  await client.auth.signOut({ scope: "local" });
  window.location.replace("./index.html");
});