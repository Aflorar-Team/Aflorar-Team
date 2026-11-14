(() => {
  const role = document.body.dataset.chatRole;
  const roles = {
    paciente: {
      listEndpoint: "/api/paciente/conversas",
      openEndpoint: (id) => `/api/paciente/conversas/${encodeURIComponent(id)}/abrir`,
      messagesEndpoint: (id) => `/api/paciente/conversas/${encodeURIComponent(id)}/mensagens`,
      login: "../Paciente/login-paciente.html",
      emptyLink: "./configuracoes.html",
      emptyLinkText: "Acesse as configurações para compartilhar seu código com um psicólogo.",
      contactFallback: "Psicólogo",
    },
    psicologo: {
      listEndpoint: "/api/psicologo/conversas",
      openEndpoint: (id) => `/api/psicologo/conversas/${encodeURIComponent(id)}/abrir`,
      messagesEndpoint: (id) => `/api/psicologo/conversas/${encodeURIComponent(id)}/mensagens`,
      login: "./login-psicologo.html",
      emptyLink: "./dashboard-psicologo.html",
      emptyLinkText: "Adicione pacientes pelo painel e aguarde a confirmação do vínculo.",
      contactFallback: "Paciente",
    },
  };
  const config = roles[role];
  if (!config) return;

  if (localStorage.getItem("tipo") !== role || !localStorage.getItem("token")) {
    window.location.replace(config.login);
    return;
  }

  const API_URL = "https://aflorar-backend.onrender.com";
  const main = document.getElementById("privateChat");
  const contactList = document.getElementById("chatContactList");
  const messages = document.getElementById("chatMessages");
  const status = document.getElementById("chatStatus");
  const compose = document.getElementById("chatCompose");
  const input = document.getElementById("chatMessageInput");
  const sendButton = document.getElementById("chatSend");
  const search = document.getElementById("chatSearch");
  let contacts = [];
  let selectedContact = null;
  let conversationId = null;
  let messageIds = new Set();
  let hasLoadedMessages = false;
  let messageRequestSequence = 0;
  const pacienteInicial = new URLSearchParams(window.location.search).get("pacienteId");
  let pacienteInicialAberto = false;

  async function api(endpoint, options = {}) {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.erro || "Não foi possível concluir a solicitação.");
    return payload;
  }

  function initials(name) {
    return String(name || config.contactFallback)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || "")
      .join("")
      .toLocaleUpperCase("pt-BR") || "?";
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay
      ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function makeAvatar(name, avatarUrl, className = "chat-avatar") {
    const avatar = document.createElement("div");
    avatar.className = className;
    avatar.textContent = initials(name);
    if (avatarUrl) {
      const image = document.createElement("img");
      image.src = avatarUrl;
      image.alt = "";
      image.addEventListener("error", () => image.remove(), { once: true });
      avatar.appendChild(image);
    }
    return avatar;
  }

  function renderContacts() {
    const searchTerm = search.value.trim().toLocaleLowerCase("pt-BR");
    const visibleContacts = contacts.filter((contact) => contact.nome.toLocaleLowerCase("pt-BR").includes(searchTerm));
    contactList.replaceChildren();

    if (!contacts.length) {
      const empty = document.createElement("p");
      empty.className = "chat-list-state";
      empty.textContent = "Você ainda não tem vínculos aceitos.";
      const link = document.createElement("a");
      link.href = config.emptyLink;
      link.textContent = config.emptyLinkText;
      empty.append(document.createElement("br"), link);
      contactList.appendChild(empty);
      return;
    }

    if (!visibleContacts.length) {
      const empty = document.createElement("p");
      empty.className = "chat-list-state";
      empty.textContent = "Nenhum contato corresponde à busca.";
      contactList.appendChild(empty);
      return;
    }

    visibleContacts.forEach((contact) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chat-contact${selectedContact?.participante_id === contact.participante_id ? " active" : ""}`;
      button.setAttribute("aria-current", selectedContact?.participante_id === contact.participante_id ? "true" : "false");
      button.appendChild(makeAvatar(contact.nome, contact.avatar_url));

      const copy = document.createElement("span");
      copy.className = "chat-contact-copy";
      const top = document.createElement("span");
      top.className = "chat-contact-topline";
      const name = document.createElement("span");
      name.className = "chat-contact-name";
      name.textContent = contact.nome;
      const time = document.createElement("time");
      time.className = "chat-contact-time";
      time.textContent = formatTime(contact.ultima_mensagem?.criado_em);
      top.append(name, time);

      const preview = document.createElement("span");
      preview.className = "chat-contact-preview";
      const lastMessage = contact.ultima_mensagem;
      preview.textContent = lastMessage
        ? `${lastMessage.remetente_id === currentUserId ? "Você: " : ""}${lastMessage.conteudo}`
        : "Toque para iniciar a conversa";
      copy.append(top, preview);
      button.appendChild(copy);
      button.addEventListener("click", () => selecionarContato(contact));
      contactList.appendChild(button);
    });
  }

  const usuario = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch (error) {
      console.error("Não foi possível ler os dados da sessão:", error);
      return null;
    }
  })();
  const currentUserId = usuario?.id;

  function renderEmptyMessages(title, description) {
    messages.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    const text = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = title;
    text.append(strong, document.createTextNode(description));
    empty.appendChild(text);
    messages.appendChild(empty);
  }

  function renderMessages(items, keepScroll = false) {
    const shouldScroll = !keepScroll || messages.scrollHeight - messages.scrollTop - messages.clientHeight < 90;
    messages.replaceChildren();
    if (!items.length) {
      renderEmptyMessages("Sua conversa começa aqui", "Envie uma mensagem para iniciar o contato.");
      return;
    }

    items.forEach((message) => {
      const bubble = document.createElement("article");
      bubble.className = `private-message${message.remetente_id === currentUserId ? " own" : ""}`;
      bubble.dataset.id = message.id;
      const content = document.createElement("p");
      content.className = "private-message-content";
      content.textContent = message.conteudo;
      const time = document.createElement("time");
      time.dateTime = message.criado_em;
      time.textContent = formatTime(message.criado_em);
      bubble.append(content, time);
      messages.appendChild(bubble);
    });

    if (shouldScroll) messages.scrollTop = messages.scrollHeight;
  }

  async function carregarMensagens(keepScroll = false) {
    if (!conversationId) return;
    const requestedConversationId = conversationId;
    const requestSequence = ++messageRequestSequence;
    try {
      const result = await api(config.messagesEndpoint(requestedConversationId));
      if (!selectedContact
        || conversationId !== requestedConversationId
        || requestSequence !== messageRequestSequence) return;
      const updatedIds = new Set(result.mensagens.map((message) => message.id));
      const changed = updatedIds.size !== messageIds.size
        || [...updatedIds].some((id) => !messageIds.has(id));
      if (changed || !hasLoadedMessages) {
        messageIds = updatedIds;
        renderMessages(result.mensagens, keepScroll);
        hasLoadedMessages = true;
        atualizarPrevia(result.mensagens.at(-1) || null);
      }
      status.textContent = "";
    } catch (error) {
      if (requestSequence !== messageRequestSequence) return;
      console.error("Erro ao carregar mensagens:", error);
      status.textContent = error.message;
    }
  }

  function atualizarPrevia(lastMessage) {
    if (!selectedContact) return;
    selectedContact.ultima_mensagem = lastMessage;
    renderContacts();
  }

  async function selecionarContato(contact) {
    selectedContact = contact;
    conversationId = null;
    messageIds = new Set();
    hasLoadedMessages = false;
    status.textContent = "";
    main.dataset.active = "true";
    const heading = document.getElementById("chatConversationIdentity");
    heading.replaceChildren(makeAvatar(contact.nome, contact.avatar_url));
    const copy = document.createElement("div");
    copy.className = "chat-conversation-copy";
    const title = document.createElement("h2");
    title.id = "chatConversationName";
    title.textContent = contact.nome;
    const subtitle = document.createElement("p");
    subtitle.id = "chatConversationStatus";
    subtitle.textContent = "Vínculo aceito";
    copy.append(title, subtitle);
    heading.appendChild(copy);
    renderContacts();
    renderEmptyMessages("Abrindo conversa…", "Aguarde um instante.");
    input.disabled = true;
    sendButton.disabled = true;

    try {
      const result = await api(config.openEndpoint(contact.participante_id), { method: "POST" });
      if (selectedContact?.participante_id !== contact.participante_id) return;
      conversationId = result.conversa.id;
      await carregarMensagens();
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    } catch (error) {
      console.error("Erro ao abrir conversa:", error);
      status.textContent = error.message;
      renderEmptyMessages("Não foi possível abrir a conversa", error.message);
    }
  }

  async function carregarContatos() {
    try {
      const result = await api(config.listEndpoint);
      contacts = result.contatos.map((contact) => ({
        ...contact,
        nome: contact.nome || config.contactFallback,
      }));
      renderContacts();

      if (selectedContact) {
        const atualizado = contacts.find((contact) => contact.participante_id === selectedContact.participante_id);
        if (!atualizado) {
          selectedContact = null;
          conversationId = null;
          messageIds = new Set();
          hasLoadedMessages = false;
          main.dataset.active = "false";
          renderEmptyMessages("Selecione uma conversa", "Seus contatos com vínculo aceito aparecem na lateral.");
        } else {
          selectedContact = { ...selectedContact, ...atualizado };
        }
      }

      if (!pacienteInicialAberto && pacienteInicial) {
        const contatoInicial = contacts.find((contact) => contact.participante_id === pacienteInicial);
        if (contatoInicial) {
          pacienteInicialAberto = true;
          await selecionarContato(contatoInicial);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      contactList.replaceChildren();
      const failure = document.createElement("p");
      failure.className = "chat-list-state";
      failure.textContent = error.message;
      contactList.appendChild(failure);
    }
  }

  compose.addEventListener("submit", async (event) => {
    event.preventDefault();
    const conteudo = input.value.trim();
    if (!conteudo || !conversationId) return;

    sendButton.disabled = true;
    status.textContent = "";
    try {
      const result = await api(config.messagesEndpoint(conversationId), {
        method: "POST",
        body: JSON.stringify({ conteudo }),
      });
      input.value = "";
      messageIds = new Set();
      await carregarMensagens();
      atualizarPrevia(result.mensagem);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      status.textContent = error.message;
    } finally {
      sendButton.disabled = !conversationId;
      input.focus();
    }
  });

  search.addEventListener("input", renderContacts);
  document.getElementById("chatBack").addEventListener("click", () => {
    main.dataset.active = "false";
  });

  renderEmptyMessages("Selecione uma conversa", "Seus contatos com vínculo aceito aparecem na lateral.");
  carregarContatos();
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    carregarMensagens(true);
  }, 5000);
  window.setInterval(() => {
    if (document.visibilityState === "visible") carregarContatos();
  }, 30000);
})();
