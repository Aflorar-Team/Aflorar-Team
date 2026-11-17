(() => {
  const API_URL = "https://aflorar-backend.onrender.com";
  const ROTAS = {
    paciente: "/Paciente/inicio.html",
    psicologo: "./dashboard-psicologo.html",
  };
  let clientePromise;

  async function getClient() {
    if (!clientePromise) {
      clientePromise = (async () => {
        const response = await fetch(`${API_URL}/api/auth-config`);
        if (!response.ok) throw new Error("Não foi possível carregar a configuração de autenticação.");
        const config = await response.json();
        if (!window.supabase?.createClient) throw new Error("Biblioteca de autenticação indisponível.");

        return window.supabase.createClient(config.url, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce",
          },
        });
      })();
    }

    return clientePromise;
  }

  function salvarSessao(data, tipo) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken || "");
    localStorage.setItem("tokenExpiraEm", String(data.expiresAt || ""));
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    localStorage.setItem("tipo", tipo);
  }

  function limparSessao() {
    ["token", "refreshToken", "tokenExpiraEm", "usuario", "tipo"].forEach((chave) => {
      localStorage.removeItem(chave);
    });
  }

  async function sair() {
    try {
      const client = await getClient();
      const { error } = await client.auth.signOut();
      if (error) await client.auth.signOut({ scope: "local" });
    } catch (error) {
      try {
        const client = await getClient();
        await client.auth.signOut({ scope: "local" });
      } catch (erroLocal) {
      }
    } finally {
      limparSessao();
      window.location.href = "../escolha-tipo-conta.html";
    }
  }

  async function restaurarSessao(tipo) {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");
    const usuarioSalvo = localStorage.getItem("usuario");

    if (localStorage.getItem("tipo") !== tipo || !token || !usuarioSalvo) return false;

    if (!refreshToken) {
      window.location.replace(ROTAS[tipo]);
      return true;
    }

    try {
      const response = await fetch(`${API_URL}/api/refresh-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, tipo }),
      });

      if (response.status === 401 || response.status === 403) {
        limparSessao();
        return false;
      }

      if (!response.ok) return false;

      const data = await response.json();
      salvarSessao(data, tipo);
      window.location.replace(ROTAS[tipo]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function iniciarGoogle(tipo) {
    const client = await getClient();
    const redirectTo = new URL("/oauth-callback.html", window.location.origin);
    redirectTo.searchParams.set("tipo", tipo);
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  }

  function perfilCompleto(usuario, tipo) {
    const metadados = usuario?.user_metadata || {};
    const perfil = metadados.perfis?.[tipo] || (metadados.tipo === tipo ? metadados : {});
    return Boolean(perfil.nome && perfil.cpf && perfil.telefone
      && (tipo !== "psicologo" || perfil.crp));
  }

  async function processarRetornoGoogle() {
    const status = document.getElementById("oauthStatus");
    const parametros = new URLSearchParams(window.location.search);
    const tipo = parametros.get("tipo");

    if (!["paciente", "psicologo", "admin"].includes(tipo)) {
      throw new Error("Não foi possível identificar o tipo de conta selecionado.");
    }

    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      const detalhe = parametros.get("error_description");
      throw new Error(detalhe || "O Google não concluiu a autenticação. Tente novamente.");
    }

    const { session } = data;
    if (tipo === "admin") {
      window.location.replace("/admin.html");
      return;
    }

    const roles = session.user.app_metadata?.roles || [];

    if (tipo === "psicologo"
      && session.user.app_metadata?.psicologo_status === "pendente"
      && !roles.includes("psicologo")) {
      const error = new Error("Seu cadastro profissional aguarda a verificação do CRP.");
      error.code = "PSICOLOGO_PENDENTE";
      throw error;
    }
    if (tipo === "psicologo"
      && session.user.app_metadata?.psicologo_status === "recusado"
      && !roles.includes("psicologo")) {
      const error = new Error("Seu cadastro profissional não foi aprovado. Entre em contato com o suporte.");
      error.code = "PSICOLOGO_RECUSADO";
      throw error;
    }

    if (roles.includes(tipo) && perfilCompleto(session.user, tipo)) {
      salvarSessao({
        token: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
        usuario: session.user,
      }, tipo);
      window.location.replace(ROTAS[tipo]);
      return;
    }

    if (status) status.textContent = "Vamos completar os dados do seu perfil.";
    window.location.replace(`/oauth-completar-perfil.html?tipo=${tipo}`);
  }

  document.querySelectorAll("[data-google-auth]").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const tipo = botao.dataset.googleAuth;
      const mensagem = botao.closest("form")?.querySelector("#mensagemErro");
      botao.disabled = true;
      if (mensagem) mensagem.style.display = "none";

      try {
        await iniciarGoogle(tipo);
      } catch (error) {
        if (mensagem) {
          mensagem.textContent = error.message || "Não foi possível iniciar o login com Google.";
          mensagem.style.display = "block";
        }
        botao.disabled = false;
      }
    });
  });

  window.AflorarAuth = {
    salvarSessao,
    limparSessao,
    sair,
    restaurarSessao,
    getClient,
    processarRetornoGoogle,
  };
})();