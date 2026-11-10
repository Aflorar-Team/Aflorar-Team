(function () {
  "use strict";

  const TOTAL_SLOTS = 6; // 3x2 grid, last slot can be the "+" button
  const SEED_INVENTORY_KEY = "aflorar_sementes_v1";
  const STAGE_NAMES = ["Broto", "Muda", "Botão", "Florescendo", "Flor aberta"];
  const SEEDS = [
    { id: "girassol", nome: "Girassol", descricao: "Uma flor cheia de luz." },
    { id: "rosa", nome: "Rosa", descricao: "Uma rosa que floresce aos poucos." },
    { id: "lavanda", nome: "Lavanda", descricao: "Raminhos roxos e delicados." },
    { id: "flor-luz", nome: "Flor-luz", descricao: "Uma flor clara e especial." },
  ];

  // ---------- estado ----------
  let usuarioSessao = null;
  try {
    usuarioSessao = JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {}
  const usuarioId = usuarioSessao?.id;
  if (!usuarioId || localStorage.getItem("tipo") !== "paciente") {
    window.location.replace("./login-paciente.html");
    return;
  }
  let canteiros = []; // [{id, usuario_id, nome, nivel, posicao}]
  let evolucoesAtuais = [];
  let editingId = null; // null = criando novo
  let plantaSelecionada = null;
  let sementeSelecionada = null;
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

  function getSeed(seedId) {
    return SEEDS.find(seed => seed.id === seedId) || SEEDS[0];
  }

  function getGrowthStage(canteiro) {
    const level = Number(canteiro.nivel) || 1;
    return Math.max(1, Math.min(5, Math.floor(level)));
  }

  function getFlowerSprite(seedId, stage) {
    return `./assets/flores/${getSeed(seedId).id}/estagio-${stage}.png`;
  }

  function loadSeedInventory() {
    try {
      const saved = JSON.parse(localStorage.getItem(SEED_INVENTORY_KEY) || "{}");
      const inventory = saved[usuarioId];
      return Object.fromEntries(SEEDS.map(seed => [
        seed.id,
        Math.max(0, Number(inventory?.[seed.id]) || 0),
      ]));
    } catch (error) {
      console.error("Não foi possível ler o inventário de sementes:", error);
      return Object.fromEntries(SEEDS.map(seed => [seed.id, 0]));
    }
  }

  function saveSeedInventory(inventory) {
    try {
      const saved = JSON.parse(localStorage.getItem(SEED_INVENTORY_KEY) || "{}");
      saved[usuarioId] = inventory;
      localStorage.setItem(SEED_INVENTORY_KEY, JSON.stringify(saved));
      return true;
    } catch (error) {
      console.error("Não foi possível salvar o inventário de sementes:", error);
      showToast("Não foi possível salvar suas sementes neste navegador.", "error");
      return false;
    }
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
        const stage = getGrowthStage(canteiro);
        const seed = getSeed(canteiro.semente);
        el.innerHTML = `
          <div class="planter-box"><img class="planter-sprite" src="${getFlowerSprite(seed.id, stage)}" alt=""></div>
          <div class="planter-name">${escapeHTML(canteiro.nome)}</div>
          <div class="planter-level">${levelStarsSVG(canteiro.nivel || 1)}</div>
          <span class="planter-stage">${STAGE_NAMES[stage - 1]}</span>
        `;
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
        el.setAttribute("aria-label", `Ver ${canteiro.nome}, ${STAGE_NAMES[stage - 1]}`);
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
          addBtn.setAttribute("role", "button");
          addBtn.setAttribute("tabindex", "0");
          addBtn.setAttribute("aria-label", "Plantar uma semente");
          addBtn.addEventListener("click", () => openCreateModal(pos));
          addBtn.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openCreateModal(pos);
            }
          });
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

  function desenharEvolucoes() {
    const evolucoes = evolucoesAtuais;
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
      date.dateTime = evolucao.criado_em;
      date.textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(evolucao.criado_em));
      header.append(label, date);

      const body = document.createElement("p");
      body.textContent = evolucao.texto;
      item.append(header, body);

      if (evolucao.compartilhada) {
        const badge = document.createElement("span");
        badge.className = "evolution-public-badge";
        badge.textContent = "Compartilhada";
        item.appendChild(badge);
      }

      evolutionList.appendChild(item);
    });
  }

  async function abrirEvolucoes(canteiro) {
    plantaSelecionada = canteiro;
    const stage = getGrowthStage(canteiro);
    const seed = getSeed(canteiro.semente);
    document.getElementById("plant-portrait-name").textContent = canteiro.nome;
    const plantIllustration = document.getElementById("plant-illustration");
    plantIllustration.src = getFlowerSprite(seed.id, stage);
    plantIllustration.alt = `${seed.nome} no estágio ${stage}: ${STAGE_NAMES[stage - 1]}`;
    document.getElementById("plant-portrait-level").textContent = `Estágio ${stage} de 5 · ${STAGE_NAMES[stage - 1]}`;
    document.getElementById("compose-plant-name").textContent = canteiro.nome;
    evolutionTitle.textContent = canteiro.nome;
    evolutionList.replaceChildren();
    const carregando = document.createElement("p");
    carregando.className = "evolution-empty";
    carregando.textContent = "Carregando evoluções...";
    evolutionList.appendChild(carregando);
    evolutionCompose.hidden = true;
    evolutionDetails.hidden = false;
    evolutionBackdrop.classList.add("show");
    evolutionBackdrop.setAttribute("aria-hidden", "false");
    document.getElementById("evolution-close").focus();

    try {
      const response = await apiRequest(`/api/jardins/${encodeURIComponent(canteiro.id)}/evolucoes`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.erro || "Não foi possível carregar as evoluções.");
      evolucoesAtuais = payload.evolucoes || [];
      desenharEvolucoes();
    } catch (error) {
      evolutionList.replaceChildren();
      const falha = document.createElement("p");
      falha.className = "evolution-empty";
      falha.textContent = error.message || "Não foi possível carregar as evoluções.";
      evolutionList.appendChild(falha);
    }
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
  evolutionCompose.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = evolutionText.value.trim();
    if (!text || !plantaSelecionada) {
      evolutionFormError.textContent = "Escreva uma evolução antes de salvar.";
      return;
    }

    try {
      const response = await apiRequest(`/api/jardins/${encodeURIComponent(plantaSelecionada.id)}/evolucoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: text, compartilhada: evolutionShare.checked }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.erro || "Não foi possível salvar a evolução.");
      evolucoesAtuais = [payload.evolucao, ...evolucoesAtuais];
      desenharEvolucoes();
      const estagioSalvo = await avancarEstagio(plantaSelecionada);
      evolutionCompose.hidden = true;
      evolutionDetails.hidden = false;
      showToast(
        estagioSalvo ? "Evolução registrada!" : "Registro salvo. O estágio ficou salvo apenas neste navegador.",
        estagioSalvo ? "success" : "error"
      );
    } catch (error) {
      console.error("Não foi possível salvar a evolução:", error);
      evolutionFormError.textContent = error.message || "Não foi possível salvar a evolução.";
    }
  });

  async function avancarEstagio(canteiro) {
    const nivelAtual = getGrowthStage(canteiro);
    if (nivelAtual >= 5) return true;

    const novoNivel = nivelAtual + 1;
    canteiro.nivel = novoNivel;
    let estagioSalvo = true;
    try {
      const atualizado = await atualizarCanteiro(canteiro.id, { nivel: novoNivel });
      canteiro.nivel = Number(atualizado.canteiro?.nivel) || novoNivel;
    } catch (error) {
      console.error("O registro foi salvo, mas o estágio não foi atualizado no servidor:", error);
      estagioSalvo = false;
    }

    saveLocalGarden(canteiros);
    const stage = getGrowthStage(canteiro);
    const seed = getSeed(canteiro.semente);
    const plantIllustration = document.getElementById("plant-illustration");
    plantIllustration.src = getFlowerSprite(seed.id, stage);
    plantIllustration.alt = `${seed.nome} no estágio ${stage}: ${STAGE_NAMES[stage - 1]}`;
    document.getElementById("plant-portrait-level").textContent = `Estágio ${stage} de 5 · ${STAGE_NAMES[stage - 1]}`;
    renderGrid();
    return estagioSalvo;
  }
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
        const response = await fetch(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
            ...options.headers,
          },
        });

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

      const localCanteiros = new Map(loadLocalGarden().map(canteiro => [String(canteiro.id), canteiro]));
      canteiros = (Array.isArray(payload.canteiros) ? payload.canteiros : []).map(canteiro => {
        const local = localCanteiros.get(String(canteiro.id));
        return {
          ...local,
          ...canteiro,
          semente: canteiro.semente || local?.semente || "girassol",
        };
      });
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
    posicao,
    semente
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
        posicao,
        semente
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
  function openCreateModal(posicao, sementeId) {
    if (posicao === null || posicao === undefined) {
      showToast("Seu jardim está cheio. Libere um espaço para plantar.", "error");
      return;
    }

    const inventory = loadSeedInventory();
    const sementesDisponiveis = SEEDS.filter(seed => inventory[seed.id] > 0);
    if (!sementeId) {
      if (sementesDisponiveis.length !== 1) {
        openSeedShop();
        showToast(sementesDisponiveis.length ? "Escolha qual semente você quer plantar." : "Pegue uma semente na loja antes de plantar.");
        return;
      }
      sementeId = sementesDisponiveis[0].id;
    }
    if (!inventory[sementeId]) {
      openSeedShop();
      showToast("Pegue essa semente na loja antes de plantar.", "error");
      return;
    }

    sementeSelecionada = sementeId;
    editingId = null;
    modalTitle.textContent = "Novo canteiro";
    modalSub.textContent = `Semente de ${getSeed(sementeId).nome}. Dê um nome para o canteiro 🌱`;
    inputNome.value = "";
    fieldNivel.style.display = "none";
    btnSave.textContent = "Criar";
    btnDelete.hidden = true;
    modalError.classList.remove("show");
    modalBackdrop.dataset.posicao = posicao;
    sideCard.classList.remove("show");
    modalBackdrop.classList.add("show");
    setTimeout(() => inputNome.focus(), 200);
  }

  function openEditModal(canteiro) {
    sementeSelecionada = null;
    editingId = canteiro.id;
    modalTitle.textContent = "Editar canteiro";
    modalSub.textContent = "Atualize o nome ou o estágio de crescimento da flor";
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
    sementeSelecionada = null;
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
        const inventory = loadSeedInventory();
        const semente = sementeSelecionada;
        if (!semente || inventory[semente] < 1) {
          throw new Error("Pegue uma semente na loja antes de plantar.");
        }
        inventory[semente] -= 1;
        if (!saveSeedInventory(inventory)) {
          throw new Error("Não foi possível reservar a semente no seu inventário.");
        }

        let criado;
        try {
          criado = await criarCanteiro(nome, posicao, semente);
        } catch (error) {
          inventory[semente] += 1;
          saveSeedInventory(inventory);
          throw error;
        }
        const novo = criado.canteiro || criado;
        canteiros.push({
          id: novo.id,
          usuario_id: usuarioId,
          nome,
          semente: novo.semente || semente,
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
  function openSeedShop() {
    const inventory = loadSeedInventory();
    const hasFreeSlot = getNextAvailablePosition() !== null;
    sideCardTitle.textContent = "Loja de sementes";
    sideCardBody.replaceChildren();

    const intro = document.createElement("p");
    intro.className = "seed-shop-intro";
    intro.textContent = "Pegue uma semente para adicionar ao seu inventário. Depois, escolha onde e como plantar.";
    sideCardBody.appendChild(intro);

    const products = document.createElement("div");
    products.className = "seed-products";
    for (const seed of SEEDS) {
      const card = document.createElement("article");
      card.className = "seed-product";

      const image = document.createElement("img");
      image.src = `./assets/sementes/${seed.id}.png`;
      image.alt = `Semente de ${seed.nome}`;
      card.appendChild(image);

      const details = document.createElement("div");
      const name = document.createElement("h4");
      name.textContent = seed.nome;
      const description = document.createElement("p");
      description.textContent = seed.descricao;
      const quantity = document.createElement("div");
      quantity.className = "seed-product-quantity";
      quantity.textContent = `No inventário: ${inventory[seed.id]}`;
      details.append(name, description, quantity);
      card.appendChild(details);

      const actions = document.createElement("div");
      actions.className = "seed-product-actions";
      const collectButton = document.createElement("button");
      collectButton.type = "button";
      collectButton.textContent = "Pegar semente";
      collectButton.addEventListener("click", () => {
        const updatedInventory = loadSeedInventory();
        updatedInventory[seed.id] += 1;
        if (saveSeedInventory(updatedInventory)) {
          showToast(`Semente de ${seed.nome} adicionada ao inventário!`, "success");
          openSeedShop();
        }
      });
      actions.appendChild(collectButton);

      if (inventory[seed.id] > 0) {
        const plantButton = document.createElement("button");
        plantButton.type = "button";
        plantButton.className = "secondary";
        plantButton.textContent = "Plantar";
        plantButton.disabled = !hasFreeSlot;
        plantButton.addEventListener("click", () => openCreateModal(getNextAvailablePosition(), seed.id));
        actions.appendChild(plantButton);
      }

      card.appendChild(actions);
      products.appendChild(card);
    }
    sideCardBody.appendChild(products);
    sideCard.classList.add("show");
  }

  function openSeedVault() {
    const inventory = loadSeedInventory();
    sideCardTitle.textContent = "Cofre de sementes";
    sideCardBody.replaceChildren();

    const products = document.createElement("div");
    products.className = "seed-products";
    for (const seed of SEEDS) {
      const item = document.createElement("article");
      item.className = "seed-product";
      const image = document.createElement("img");
      image.src = `./assets/sementes/${seed.id}.png`;
      image.alt = "";
      const details = document.createElement("div");
      const name = document.createElement("h4");
      name.textContent = seed.nome;
      const quantity = document.createElement("p");
      quantity.className = "seed-product-quantity";
      quantity.textContent = `${inventory[seed.id]} semente(s)`;
      details.append(name, quantity);
      item.append(image, details);
      products.appendChild(item);
    }
    sideCardBody.appendChild(products);
    sideCard.classList.add("show");
  }

  document.querySelectorAll(".side-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.card;
      if (key === "loja") {
        openSeedShop();
        return;
      }
      if (key === "cofre") {
        openSeedVault();
        return;
      }

      sideCardTitle.textContent = "Configurações";
      sideCardBody.textContent = "Ajustes de conta, notificações e preferências. Em breve.";
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