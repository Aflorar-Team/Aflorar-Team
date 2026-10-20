(function () {
  "use strict";

  const TOTAL_SLOTS = 6; // 3x2 grid, last slot can be the "+" button

  // ---------- estado ----------
  // usuárioId é obtido do localStorage; se não existir, cria um valor temporário "demo-user"
  let usuarioId = localStorage.getItem("aflorar_usuario_id");

  // Se o usuárioId não estiver presente, cria um valor temporário "demo-user" e armazena no localStorage, Temporário até Banco de dados de usuários estar implementado.
  if (!usuarioId) {
    usuarioId = "demo-user";
    localStorage.setItem("aflorar_usuario_id", usuarioId);
    console.log("[jardim.js] usuarioId ausente; usando valor temporário: demo-user");
  }
  let canteiros = []; // [{id, usuario_id, nome, nivel, posicao}]
  let editingId = null; // null = criando novo
  let plantaSelecionada = null;
  let voltarParaEvolucao = false;

  // ---------- elementos ----------
  const grid = document.getElementById("garden-grid");
  const loadingOverlay = document.getElementById("loading-overlay");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalTitle = document.getElementById("modal-title");
  const modalSub = document.getElementById("modal-sub");
  const inputNome = document.getElementById("input-nome");
  const fieldNivel = document.getElementById("field-nivel");
  const levelPicker = document.getElementById("level-picker");
  const modalError = document.getElementById("modal-error");
  const btnSave = document.getElementById("btn-save");
  const btnDelete = document.getElementById("btn-delete");
  const btnCancel = document.getElementById("btn-cancel");
  const toastEl = document.getElementById("toast");
  const sideCard = document.getElementById("side-card");
  const sideCardTitle = document.getElementById("side-card-title");
  const sideCardBody = document.getElementById("side-card-body");
  const closeCard = document.getElementById("close-card");
  const evolutionBackdrop = document.getElementById("evolution-backdrop");
  const evolutionDetails = document.getElementById("evolution-details");
  const evolutionCompose = document.getElementById("evolution-compose");
  const evolutionList = document.getElementById("evolution-list");
  const evolutionTitle = document.getElementById("evolution-title");
  const evolutionText = document.getElementById("evolution-text");
  const evolutionShare = document.getElementById("evolution-share");
  const evolutionCount = document.getElementById("evolution-count");
  const evolutionFormError = document.getElementById("evolution-form-error");
  const evolutionStorageKey = `aflorar_evolucoes_${usuarioId}`;

  let selectedLevel = 1;

  // ---------- utilidades ----------
  function showToast(msg, type) {
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (type ? " " + type : "");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toastEl.className = "toast"; }, 3200);
  }

  function setLoading(isLoading) {
    loadingOverlay.style.opacity = isLoading ? "1" : "0";
    loadingOverlay.style.pointerEvents = isLoading ? "auto" : "none";
  }

  function levelStarsSVG(nivel) {
    let html = "";
    for (let i = 1; i <= 5; i++) {
      html += `<svg viewBox="0 0 24 24" fill="${i <= nivel ? '#F0A868' : 'rgba(255,255,255,0.6)'}" stroke="none"><polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9"/></svg>`;
    }
    return html;
  }

  function planterSVG() {
    return `
      <svg viewBox="0 0 170 88">
        <defs>
          <linearGradient id="boxFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--canteiro-claro)"/>
            <stop offset="100%" stop-color="var(--canteiro)"/>
          </linearGradient>
        </defs>
        <polygon points="10,28 160,28 145,84 25,84" fill="url(#boxFront)"/>
        <polygon points="10,28 160,28 150,12 20,12" fill="var(--canteiro-claro)"/>
        <polygon points="20,12 150,12 145,28 25,28" fill="var(--canteiro-escuro)" opacity="0.55"/>
      </svg>
    `;
  }

  // ---------- render ----------
  function renderGrid() {
    grid.innerHTML = "";

    for (let pos = 1; pos <= TOTAL_SLOTS; pos++) {
      const slot = document.createElement("div");
      slot.className = "plot-slot";

      const canteiro = canteiros.find(c => c.posicao === pos);

      if (canteiro) {
        const el = document.createElement("div");
        el.className = "planter";
        el.dataset.id = canteiro.id;
        el.innerHTML = `
          <div class="planter-box">${planterSVG()}</div>
          <div class="planter-name">${escapeHTML(canteiro.nome)}</div>
          <div class="planter-level">${levelStarsSVG(canteiro.nivel || 1)}</div>
        `;
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", `Ver evoluções de ${canteiro.nome}`);
        el.addEventListener("click", () => abrirEvolucoes(canteiro));
        el.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            abrirEvolucoes(canteiro);
          }
        });
        slot.appendChild(el);
      } else {
        const nextPos = getNextAvailablePosition();
        if (pos === nextPos) {
          const addBtn = document.createElement("div");
          addBtn.className = "add-plot";
          addBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>`;
          addBtn.addEventListener("click", () => openCreateModal(pos));
          slot.appendChild(addBtn);
        }
      }

      grid.appendChild(slot);
    }
  }

  function getNextAvailablePosition() {
    const usadas = new Set(canteiros.map(c => c.posicao));
    for (let i = 1; i <= TOTAL_SLOTS; i++) {
      if (!usadas.has(i)) return i;
    }
    return null;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function lerEvolucoes() {
    try {
      const evolucoes = JSON.parse(localStorage.getItem(evolutionStorageKey) || "{}");
      return evolucoes && typeof evolucoes === "object" && !Array.isArray(evolucoes) ? evolucoes : {};
    } catch (error) {
      console.warn("Não foi possível ler as evoluções:", error);
      return {};
    }
  }

  function desenharEvolucoes() {
    const evolucoes = lerEvolucoes()[String(plantaSelecionada.id)] || [];
    evolutionList.replaceChildren();

    if (!evolucoes.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "evolution-empty";
      emptyState.textContent = "Sua história começa com um pequeno registro. Como esta planta está crescendo?";
      evolutionList.appendChild(emptyState);
      return;
    }

    [...evolucoes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((evolucao) => {
      const item = document.createElement("article");
      item.className = "evolution-entry";

      const header = document.createElement("div");
      header.className = "evolution-entry-header";
      const label = document.createElement("h3");
      label.textContent = "Evolução";
      const date = document.createElement("time");
      date.dateTime = evolucao.createdAt;
      date.textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(evolucao.createdAt));
      header.append(label, date);

      const body = document.createElement("p");
      body.textContent = evolucao.text;
      item.append(header, body);

      if (evolucao.publica) {
        const badge = document.createElement("span");
        badge.className = "evolution-public-badge";
        badge.textContent = "Compartilhada";
        item.appendChild(badge);
      }

      evolutionList.appendChild(item);
    });
  }

  function abrirEvolucoes(canteiro) {
    plantaSelecionada = canteiro;
    document.getElementById("plant-portrait-name").textContent = canteiro.nome;
    document.getElementById("plant-portrait-level").textContent = `Nível ${canteiro.nivel || 1}`;
    document.getElementById("compose-plant-name").textContent = canteiro.nome;
    evolutionTitle.textContent = canteiro.nome;
    desenharEvolucoes();
    evolutionCompose.hidden = true;
    evolutionDetails.hidden = false;
    evolutionBackdrop.classList.add("show");
    evolutionBackdrop.setAttribute("aria-hidden", "false");
    document.getElementById("evolution-close").focus();
  }

  function abrirFormularioEvolucao() {
    evolutionDetails.hidden = true;
    evolutionCompose.hidden = false;
    evolutionText.value = "";
    evolutionShare.checked = false;
    evolutionCount.textContent = "0/600";
    evolutionFormError.textContent = "";
    evolutionText.focus();
  }

  function fecharEvolucoes() {
    evolutionBackdrop.classList.remove("show");
    evolutionBackdrop.setAttribute("aria-hidden", "true");
    evolutionCompose.hidden = true;
    evolutionDetails.hidden = false;
    plantaSelecionada = null;
    grid.querySelector(".planter")?.focus();
  }

  document.getElementById("evolution-register").addEventListener("click", () => abrirFormularioEvolucao());
  document.getElementById("evolution-back").addEventListener("click", () => {
    evolutionCompose.hidden = true;
    evolutionDetails.hidden = false;
  });
  document.getElementById("evolution-close").addEventListener("click", fecharEvolucoes);
  document.getElementById("evolution-edit").addEventListener("click", () => {
    if (!plantaSelecionada) return;
    const canteiro = plantaSelecionada;
    fecharEvolucoes();
    voltarParaEvolucao = true;
    openEditModal(canteiro);
  });
  evolutionBackdrop.addEventListener("click", (event) => {
    if (event.target === evolutionBackdrop) fecharEvolucoes();
  });
  evolutionText.addEventListener("input", () => {
    evolutionCount.textContent = `${evolutionText.value.length}/600`;
  });
  evolutionShare.addEventListener("change", () => {
    evolutionCompose.classList.toggle("is-public", evolutionShare.checked);
  });
  evolutionCompose.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = evolutionText.value.trim();
    if (!text || !plantaSelecionada) {
      evolutionFormError.textContent = "Escreva uma evolução antes de salvar.";
      return;
    }

    const todasEvolucoes = lerEvolucoes();
    const plantaId = String(plantaSelecionada.id);
    todasEvolucoes[plantaId] = [
      ...(todasEvolucoes[plantaId] || []),
      { id: `${Date.now()}`, text, createdAt: new Date().toISOString(), publica: evolutionShare.checked },
    ];

    try {
      localStorage.setItem(evolutionStorageKey, JSON.stringify(todasEvolucoes));
      desenharEvolucoes();
      evolutionCompose.hidden = true;
      evolutionDetails.hidden = false;
      showToast("Evolução registrada!", "success");
    } catch (error) {
      console.error("Não foi possível salvar a evolução:", error);
      evolutionFormError.textContent = "Não foi possível salvar. Verifique o espaço disponível no navegador.";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && evolutionBackdrop.classList.contains("show")) fecharEvolucoes();
  });

  // ---------- API ----------
  const GARDEN_LOCAL_KEY = "aflorar_jardins_demo";

  function getApiCandidates() {
    const renderOrigin = "https://aflorar-backend.onrender.com";
    const localOrigins = ["http://localhost:3000", "http://localhost:3001"];
    const currentOrigin = window.location.origin;
    const isLocalBackend = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]
      .includes(currentOrigin);

    if (isLocalBackend) {
      return [currentOrigin, ...localOrigins.filter(origin => origin !== currentOrigin), renderOrigin];
    }

    return [renderOrigin, ...localOrigins];
  }

  function loadLocalGarden() {
    try {
      const raw = localStorage.getItem(GARDEN_LOCAL_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return Array.isArray(parsed[usuarioId]) ? parsed[usuarioId] : [];
    } catch (error) {
      console.warn("Não foi possível ler o jardim local:", error);
      return [];
    }
  }

  function saveLocalGarden(items) {
    try {
      const raw = localStorage.getItem(GARDEN_LOCAL_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[usuarioId] = items;
      localStorage.setItem(GARDEN_LOCAL_KEY, JSON.stringify(parsed));
    } catch (error) {
      console.warn("Não foi possível salvar o jardim local:", error);
    }
  }

  async function apiRequest(path, options = {}) {
    const candidates = getApiCandidates();
    let lastError = null;

    for (const origin of candidates) {
      const url = `${origin}${path}`;
      console.log("[jardim.js] Tentando chamada na API:", url);

      try {
        const response = await fetch(url, options);

        if (response.status !== 404) {
          return response;
        }

        lastError = new Error(`404 em ${url}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("API indisponível");
  }

  async function carregarCanteiros() {

    if (!usuarioId) {
      console.log("[jardim.js] Sem usuarioId. Renderizando jardim vazio.");
      canteiros = [];
      renderGrid();
      return;
    }

    console.log("[jardim.js] Iniciando carregamento do jardim para usuarioId:", usuarioId);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("[jardim.js] Timeout ao carregar jardim. Abortando requisição.");
      controller.abort();
    }, 8000);

    try {
      const response = await apiRequest(`/api/jardins?usuario_id=${encodeURIComponent(usuarioId)}`, {
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.erro || "Erro ao carregar jardim");
      }

      canteiros = Array.isArray(payload.canteiros) ? payload.canteiros : [];
      saveLocalGarden(canteiros);
      renderGrid();
      console.log("[jardim.js] Jardim carregado com sucesso:", canteiros.length, "canteiros");

    } catch (error) {
      const gardenFallback = loadLocalGarden();
      if (gardenFallback.length) {
        canteiros = gardenFallback;
        renderGrid();
        console.warn("[jardim.js] Usando fallback local do jardim por falha na API:", error.message || error);
        showToast("Mostrando seu jardim salvo localmente.", "success");
      } else if (error.name === "AbortError") {
        console.warn("[jardim.js] Requisição abortada por timeout.");
        canteiros = [];
        renderGrid();
        showToast("Servidor demorou para responder. Tente novamente em alguns segundos.", "error");
      } else {
        console.error("[jardim.js] Erro ao carregar jardim:", error);
        canteiros = [];
        renderGrid();
        showToast(
          error.message || "Erro ao carregar jardim",
          "error"
        );
      }

    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }

  }
  async function criarCanteiro(
    nome,
    posicao
  ) {

    const response = await apiRequest("/api/jardins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        nome,
        nivel: 1,
        posicao
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.erro || "Não foi possível criar o canteiro.");
    }

    return {
      canteiro: payload.canteiro
    };

  }

  async function atualizarCanteiro(
    id,
    updates
  ) {

    const response = await apiRequest(`/api/jardins/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        usuario_id: usuarioId,
        ...updates
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.erro || "Não foi possível atualizar o canteiro.");
    }

    return {
      canteiro: payload.canteiro
    };

  }

  async function excluirCanteiro(id) {
    const response = await apiRequest(`/api/jardins/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario_id: usuarioId }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.erro || "Não foi possível excluir o canteiro.");
    }

    return payload;
  }

  // ---------- modal ----------
  function openCreateModal(posicao) {
    editingId = null;
    modalTitle.textContent = "Novo canteiro";
    modalSub.textContent = "Dê um nome para o seu novo canteiro 🌱";
    inputNome.value = "";
    fieldNivel.style.display = "none";
    btnSave.textContent = "Criar";
    btnDelete.hidden = true;
    modalError.classList.remove("show");
    modalBackdrop.dataset.posicao = posicao;
    modalBackdrop.classList.add("show");
    setTimeout(() => inputNome.focus(), 200);
  }

  function openEditModal(canteiro) {
    editingId = canteiro.id;
    modalTitle.textContent = "Editar canteiro";
    modalSub.textContent = "Atualize o nome e o nível do seu canteiro";
    inputNome.value = canteiro.nome;
    fieldNivel.style.display = "block";
    selectLevel(canteiro.nivel || 1);
    btnSave.textContent = "Salvar alterações";
    btnDelete.hidden = false;
    modalError.classList.remove("show");
    modalBackdrop.classList.add("show");
    setTimeout(() => inputNome.focus(), 200);
  }

  function closeModal() {
    modalBackdrop.classList.remove("show");
    editingId = null;
  }

  function selectLevel(n) {
    selectedLevel = n;
    [...levelPicker.children].forEach(star => {
      star.classList.toggle("active", Number(star.dataset.level) === n);
    });
  }

  levelPicker.addEventListener("click", (e) => {
    const star = e.target.closest(".level-star");
    if (!star) return;
    selectLevel(Number(star.dataset.level));
  });

  btnCancel.addEventListener("click", () => {
    voltarParaEvolucao = false;
    closeModal();
  });
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) {
      voltarParaEvolucao = false;
      closeModal();
    }
  });

  btnSave.addEventListener("click", async () => {
    const nome = inputNome.value.trim();
    if (!nome) {
      modalError.textContent = "Digite um nome para o canteiro.";
      modalError.classList.add("show");
      return;
    }
    modalError.classList.remove("show");
    btnSave.disabled = true;
    const textoOriginal = btnSave.textContent;
    btnSave.textContent = "Salvando...";

    try {
      const plantaEditada = editingId ? canteiros.find(c => c.id === editingId) : null;
      if (editingId) {
        const atualizado = await atualizarCanteiro(editingId, { nome, nivel: selectedLevel });
        const idx = canteiros.findIndex(c => c.id === editingId);
        if (idx > -1) {
          canteiros[idx] = { ...canteiros[idx], nome, nivel: selectedLevel, ...(atualizado.canteiro || {}) };
        }
        saveLocalGarden(canteiros);
        showToast("Canteiro atualizado!", "success");
      } else {
        const posicao = Number(modalBackdrop.dataset.posicao);
        const criado = await criarCanteiro(nome, posicao);
        const novo = criado.canteiro || criado;
        canteiros.push({
          id: novo.id,
          usuario_id: usuarioId,
          nome,
          nivel: typeof novo.nivel === "number" ? novo.nivel : 1,
          posicao: typeof novo.posicao === "number" ? novo.posicao : posicao
        });
        saveLocalGarden(canteiros);
        showToast("Canteiro criado!", "success");
      }
      renderGrid();
      closeModal();
      if (voltarParaEvolucao && plantaEditada) {
        voltarParaEvolucao = false;
        const atualizada = canteiros.find(c => String(c.id) === String(plantaEditada.id));
        if (atualizada) abrirEvolucoes(atualizada);
      }
    } catch (err) {
      console.error(err);
      modalError.textContent = "Não foi possível salvar. Tente novamente.";
      modalError.classList.add("show");
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = textoOriginal;
    }
  });

  btnDelete.addEventListener("click", async () => {
    const canteiro = canteiros.find((item) => String(item.id) === String(editingId));
    if (!canteiro || !window.confirm(`Excluir o canteiro "${canteiro.nome}" e suas evoluções?`)) return;

    btnDelete.disabled = true;
    btnSave.disabled = true;
    btnDelete.textContent = "Excluindo...";
    const idExcluido = String(canteiro.id);

    try {
      let apenasLocal = false;
      try {
        await excluirCanteiro(canteiro.id);
      } catch (error) {
        console.warn("API indisponível; removendo o canteiro apenas do armazenamento local:", error);
        apenasLocal = true;
      }

      canteiros = canteiros.filter((item) => String(item.id) !== idExcluido);
      saveLocalGarden(canteiros);
      const evolucoes = lerEvolucoes();
      delete evolucoes[idExcluido];
      localStorage.setItem(evolutionStorageKey, JSON.stringify(evolucoes));
      voltarParaEvolucao = false;
      renderGrid();
      closeModal();
      showToast(apenasLocal ? "Canteiro removido deste navegador. O servidor não estava disponível." : "Canteiro excluído!", apenasLocal ? "error" : "success");
    } catch (error) {
      console.error("Não foi possível concluir a exclusão do canteiro:", error);
      modalError.textContent = "O canteiro foi removido, mas não foi possível atualizar os dados locais.";
      modalError.classList.add("show");
    } finally {
      btnDelete.disabled = false;
      btnSave.disabled = false;
      btnDelete.textContent = "Excluir";
    }
  });

  // clique no canteiro leva à página de detalhes (preparado, sem navegar de fato ainda)
  function irParaDetalhes(id) {
    // window.location.href = `/canteiro.html?id=${id}`;
    console.log("Navegar para detalhes do canteiro", id);
  }

  // ---------- side cards ----------
  const cardContent = {
    loja: { title: "Loja", body: "Em breve você poderá comprar sementes, adubos e decorações para o seu jardim aqui." },
    cofre: { title: "Cofre", body: "Guarde suas sementes e itens especiais. Em breve." },
    config: { title: "Configurações", body: "Ajustes de conta, notificações e preferências. Em breve." }
  };

  document.querySelectorAll(".side-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.card;
      const content = cardContent[key] || { title: "", body: "" };
      sideCardTitle.textContent = content.title;
      sideCardBody.textContent = content.body;
      sideCard.classList.add("show");
    });
  });

  if (closeCard) {
    closeCard.addEventListener("click", () => sideCard.classList.remove("show"));
  } else {
    console.warn("[jardim.js] Elemento #close-card não encontrado no DOM.");
  }

  const btnPerfil = document.getElementById("btn-perfil");
  if (btnPerfil) {
    btnPerfil.addEventListener("click", () => {
      sideCardTitle.textContent = "Perfil";
      sideCardBody.textContent = "Suas informações de conta aparecerão aqui.";
      sideCard.classList.add("show");
    });
  } else {
    console.warn("[jardim.js] Elemento #btn-perfil não encontrado no DOM. Verifique o HTML do navbar.");
  }

  // ---------- fence ----------
  (function buildFence() {
    const fence = document.getElementById("fence");
    const count = 40;
    if (!fence) {
      console.warn("[jardim.js] Elemento #fence não encontrado no DOM.");
      return;
    }
    for (let i = 0; i < count; i++) {
      const picket = document.createElement("div");
      picket.className = "picket";
      fence.appendChild(picket);
    }
  })();

  // ---------- nav arrows (placeholder pagination) ----------
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");

  if (btnPrev) {
    btnPrev.addEventListener("click", () => showToast("Você já está na primeira página do jardim."));
  } else {
    console.warn("[jardim.js] Elemento #btn-prev não encontrado no DOM.");
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => showToast("Mais espaços de jardim em breve!"));
  } else {
    console.warn("[jardim.js] Elemento #btn-next não encontrado no DOM.");
  }

  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
    });
  });

  // ---------- init ----------
  carregarCanteiros();

  // expõe funções úteis para debug/dev
  window.Aflorar = { carregarCanteiros, irParaDetalhes };

})();