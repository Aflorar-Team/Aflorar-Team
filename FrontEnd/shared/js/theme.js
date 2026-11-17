(() => {
  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch (error) {
      console.error("Não foi possível ler a conta para aplicar o tema:", error);
      return null;
    }
  })();
  const chaveTema = usuario?.id ? `aflorar.tema.${usuario.id}` : "tema";
  const API_URL = "https://aflorar-backend.onrender.com";
  const temaInicial = localStorage.getItem(chaveTema)
    || (!usuario?.id ? localStorage.getItem("tema") : null)
    || "claro";
  let revisaoTema = 0;
  let gravacoesTema = Promise.resolve();

  function aplicarTema(tema) {
    const temaValido = tema === "escuro" ? "escuro" : "claro";
    document.documentElement.dataset.theme = temaValido;
    document.body?.classList.toggle("dark", temaValido === "escuro");
    localStorage.setItem(chaveTema, temaValido);
    localStorage.setItem("tema", temaValido);
    window.dispatchEvent(new CustomEvent("aflorar:tema-alterado", { detail: temaValido }));
  }

  async function sincronizarTemaServidor() {
    const token = localStorage.getItem("token");
    if (!token || !usuario?.id) return;
    const revisaoInicial = revisaoTema;

    try {
      const response = await fetch(`${API_URL}/api/configuracoes/tema`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.erro || "Não foi possível carregar sua preferência de tema.");
      if (revisaoInicial !== revisaoTema) return;

      if (resultado.configurado) {
        aplicarTema(resultado.tema);
        return;
      }

      const temaAnterior = localStorage.getItem(chaveTema) || localStorage.getItem("tema");
      if (temaAnterior) {
        await definirTema(temaAnterior);
      } else {
        aplicarTema(resultado.tema);
      }
    } catch (error) {
      console.error("Não foi possível sincronizar o tema da conta:", error);
      if (revisaoInicial === revisaoTema) {
        aplicarTema(localStorage.getItem(chaveTema) || temaInicial);
      }
    }
  }

  async function definirTema(tema) {
    if (!["claro", "escuro"].includes(tema)) throw new Error("Tema inválido.");
    const revisaoAtual = ++revisaoTema;
    aplicarTema(tema);
    const token = localStorage.getItem("token");
    if (!token || !usuario?.id) return;

    const gravacao = gravacoesTema.then(async () => {
      const response = await fetch(`${API_URL}/api/configuracoes/tema`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tema }),
      });
      const resultado = await response.json();
      if (!response.ok) throw new Error(resultado.erro || "Não foi possível salvar sua preferência de tema.");
      if (revisaoAtual === revisaoTema) aplicarTema(resultado.tema);
    });
    gravacoesTema = gravacao.catch(() => {});
    try {
      await gravacao;
    } catch (error) {
      console.error("Não foi possível salvar o tema da conta:", error);
      throw error;
    }
  }

  aplicarTema(temaInicial);
  window.AflorarTheme = {
    aplicarTema,
    definirTema,
    alternar: () => definirTema(document.documentElement.dataset.theme === "escuro" ? "claro" : "escuro"),
    sincronizar: sincronizarTemaServidor,
  };
  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.toggle("dark", document.documentElement.dataset.theme === "escuro");
    sincronizarTemaServidor();
  }, { once: true });
})();
