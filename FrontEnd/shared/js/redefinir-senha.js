const formRedefinirSenha = document.getElementById("formRedefinirSenha");
const statusRedefinirSenha = document.getElementById("statusRedefinirSenha");
let clienteAuth;

window.AflorarAuth.getClient().then(async (client) => {
  clienteAuth = client;
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    statusRedefinirSenha.textContent = "Este link expirou ou já foi usado. Solicite outro pelo login.";
    formRedefinirSenha.querySelector("button[type='submit']").disabled = true;
  }
}).catch((error) => {
  console.error("Não foi possível validar o link de recuperação:", error);
  statusRedefinirSenha.textContent = "Não foi possível validar o link. Solicite outro pelo login.";
  formRedefinirSenha.querySelector("button[type='submit']").disabled = true;
});

formRedefinirSenha.addEventListener("submit", async (event) => {
  event.preventDefault();
  const senha = document.getElementById("novaSenha").value;
  const confirmacao = document.getElementById("confirmarNovaSenha").value;
  const botao = formRedefinirSenha.querySelector("button[type='submit']");

  if (senha.length < 6 || senha.length > 20) {
    statusRedefinirSenha.textContent = "A senha deve ter entre 6 e 20 caracteres.";
    return;
  }
  if (senha !== confirmacao) {
    statusRedefinirSenha.textContent = "As senhas não coincidem.";
    return;
  }
  if (!clienteAuth) {
    statusRedefinirSenha.textContent = "O link ainda está sendo validado. Tente novamente.";
    return;
  }

  botao.disabled = true;
  statusRedefinirSenha.textContent = "Atualizando senha...";
  try {
    const { error } = await clienteAuth.auth.updateUser({ password: senha });
    if (error) throw error;
    statusRedefinirSenha.textContent = "Senha alterada. Você já pode entrar com a nova senha.";
    formRedefinirSenha.reset();
  } catch (error) {
    console.error("Não foi possível redefinir a senha:", error);
    statusRedefinirSenha.textContent = error.message || "Não foi possível alterar a senha. Solicite um novo link.";
  } finally {
    botao.disabled = false;
  }
});
