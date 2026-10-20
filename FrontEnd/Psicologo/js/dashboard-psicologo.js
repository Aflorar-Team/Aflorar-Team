const usuario = (() => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    return null;
  }
})();
const tipo = localStorage.getItem("tipo");

if (!usuario || tipo !== "psicologo") {
  window.location.href = "./login-psicologo.html";
}

const idPsicologo = usuario?.id || usuario?.email || "local";
const chaveAgenda = `aflorar.agenda.${idPsicologo}`;
const chavePacientes = `aflorar.pacientes-vinculados.${idPsicologo}`;
const chaveAlertas = `aflorar.alertas.${idPsicologo}`;
const modal = document.getElementById("popupModal");
const popupTitulo = document.getElementById("popupTitulo");
const popupConteudo = document.getElementById("popupConteudo");
const modalClose = document.querySelector(".modal-close");
let ultimoAcionador = null;

const boasVindas = document.querySelector(".boas-vindas h2");
if (usuario?.user_metadata?.nome) {
  boasVindas.textContent = `Bem-Vindo(a), ${usuario.user_metadata.nome}!`;
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function lerLista(chave) {
  try {
    const dados = JSON.parse(localStorage.getItem(chave) || "[]");
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

function dataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function lerAlertas() {
  return lerLista(chaveAlertas);
}

function salvarAlertas(alertas) {
  localStorage.setItem(chaveAlertas, JSON.stringify(alertas));
}

function renderizarAlertas(paciente) {
  const chavePaciente = paciente.toLocaleLowerCase("pt-BR");
  const alertas = lerAlertas().filter((alerta) => alerta.paciente === chavePaciente);
  const formulario = document.createElement("form");
  formulario.className = "form-alerta-paciente";
  formulario.innerHTML = `
    <label for="tituloAlerta">Novo lembrete</label>
    <input id="tituloAlerta" name="titulo" type="text" maxlength="100" required placeholder="Ex.: Retomar exercício de respiração">
    <div class="campos-alerta">
      <label>Prioridade
        <select name="prioridade">
          <option value="normal">Normal</option>
          <option value="atencao">Atenção</option>
          <option value="urgente">Urgente</option>
        </select>
      </label>
      <label>Data
        <input name="data" type="date">
      </label>
    </div>
    <button class="botao-vincular" type="submit">Adicionar lembrete</button>
    <p class="status-vinculo" role="status"></p>
  `;

  const secao = criarElemento("section", "popup-secao");
  secao.appendChild(criarElemento("h5", "", `Lembretes de ${paciente}`));
  const lista = criarElemento("ul", "lista-alertas-paciente");

  function atualizarLista() {
    const itens = lerAlertas().filter((alerta) => alerta.paciente === chavePaciente);
    lista.replaceChildren();
    if (!itens.length) {
      lista.appendChild(criarElemento("li", "estado-vazio-popup", "Nenhum lembrete cadastrado para este paciente."));
      return;
    }

    itens.sort((a, b) => (a.data || "9999-12-31").localeCompare(b.data || "9999-12-31"));
    itens.forEach((alerta) => {
      const item = criarElemento("li", `item-alerta prioridade-${alerta.prioridade}`);
      const conteudo = criarElemento("div", "item-alerta-conteudo");
      conteudo.appendChild(criarElemento("strong", "", alerta.titulo));
      const prioridade = alerta.prioridade === "urgente" ? "Urgente" : alerta.prioridade === "atencao" ? "Atenção" : "Normal";
      const data = alerta.data ? new Date(`${alerta.data}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data";
      conteudo.appendChild(criarElemento("span", "", `${prioridade} · ${data}`));

      const remover = criarElemento("button", "botao-remover-alerta", "Remover");
      remover.type = "button";
      remover.setAttribute("aria-label", `Remover lembrete: ${alerta.titulo}`);
      remover.addEventListener("click", () => {
        salvarAlertas(lerAlertas().filter((itemSalvo) => itemSalvo.id !== alerta.id));
        atualizarLista();
      });
      item.append(conteudo, remover);
      lista.appendChild(item);
    });
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const dados = new FormData(formulario);
    const novoAlerta = {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      paciente: chavePaciente,
      titulo: String(dados.get("titulo")).trim(),
      prioridade: String(dados.get("prioridade")),
      data: String(dados.get("data") || ""),
      criadoEm: new Date().toISOString(),
    };
    const status = formulario.querySelector(".status-vinculo");
    try {
      salvarAlertas([...lerAlertas(), novoAlerta]);
      formulario.reset();
      status.textContent = "Lembrete salvo neste navegador.";
      atualizarLista();
    } catch {
      status.textContent = "Não foi possível salvar. Verifique o espaço disponível no navegador.";
    }
  });

  const aviso = criarElemento("p", "aviso-integracao", "Estes lembretes ficam salvos apenas neste navegador e não são enviados ao paciente nem sincronizados com o prontuário.");
  popupConteudo.replaceChildren(aviso, formulario, secao);
  secao.appendChild(lista);
  atualizarLista();
}

function renderizarDemandas() {
  const hoje = dataLocal(new Date());
  const eventos = lerLista(chaveAgenda)
    .filter((evento) => evento.data === hoje)
    .sort((a, b) => String(a.hora || "").localeCompare(String(b.hora || "")));
  const lista = criarElemento("ul", "painel-lista");

  if (!eventos.length) {
    lista.appendChild(criarElemento("li", "estado-vazio-popup", "Nenhum compromisso ou autoaviso marcado para hoje."));
  } else {
    eventos.forEach((evento) => {
      const item = criarElemento("li", "item-demanda");
      const horario = criarElemento("time", "item-horario", evento.hora || "--:--");
      const detalhes = criarElemento("div", "item-demanda-texto");
      detalhes.appendChild(criarElemento("strong", "", evento.titulo || "Sem título"));
      detalhes.appendChild(criarElemento("span", "", evento.tipo === "autoaviso" ? "Autoaviso" : "Compromisso"));
      if (evento.detalhes) detalhes.appendChild(criarElemento("p", "", evento.detalhes));
      item.append(horario, detalhes);
      lista.appendChild(item);
    });
  }

  const agendaSection = criarElemento("section", "popup-secao");
  agendaSection.appendChild(criarElemento("h5", "", "Agenda de hoje"));
  agendaSection.appendChild(lista);

  const anotacoes = (localStorage.getItem("anotacoes_psicologo") || "").trim();
  const anotacoesSection = criarElemento("section", "popup-secao");
  anotacoesSection.appendChild(criarElemento("h5", "", "Anotações salvas"));
  anotacoesSection.appendChild(anotacoes
    ? criarElemento("p", "texto-anotacao", anotacoes)
    : criarElemento("p", "estado-vazio-popup", "Nenhuma anotação salva ainda."));

  const avisoMensagens = criarElemento(
    "div",
    "aviso-integracao",
    "As mensagens de pacientes ainda não aparecem aqui: o chat atual conversa com a Flora IA e não salva mensagens para o psicólogo."
  );
  const acaoMensagens = criarElemento("button", "link-popup", "Ver mensagens recentes");
  acaoMensagens.type = "button";
  acaoMensagens.dataset.openPopup = "mensagens";
  avisoMensagens.appendChild(acaoMensagens);

  popupConteudo.replaceChildren(agendaSection, anotacoesSection, avisoMensagens);
}

function renderizarMensagens() {
  const estado = criarElemento("div", "estado-mensagens");
  estado.appendChild(criarElemento("span", "icone-estado", "…"));
  estado.appendChild(criarElemento("h5", "", "Nenhuma mensagem disponível"));
  estado.appendChild(criarElemento(
    "p",
    "",
    "As mensagens enviadas pelos pacientes ainda não são armazenadas nem compartilhadas com esta área. O chat existente atende conversas com a Flora IA."
  ));
  estado.appendChild(criarElemento("p", "nota-integracao", "Quando o chat entre paciente e psicólogo estiver conectado ao sistema, as conversas mais recentes aparecerão aqui."));
  popupConteudo.replaceChildren(estado);
}

function renderizarPacientes() {
  const formulario = document.createElement("form");
  formulario.className = "form-paciente-codigo";
  formulario.innerHTML = `
    <label for="codigoPaciente">Código único do paciente</label>
    <div class="campo-codigo">
      <input id="codigoPaciente" name="codigo" type="text" maxlength="32" minlength="4" required
        autocomplete="off" autocapitalize="characters" placeholder="Ex.: AFL-8K29Q" aria-describedby="ajudaCodigo erroCodigo">
      <button class="botao-vincular" type="submit">Vincular</button>
    </div>
    <p id="ajudaCodigo" class="ajuda-campo">Informe o código fornecido pelo paciente. Letras e números, com hífen opcional.</p>
    <p id="erroCodigo" class="erro-campo" role="alert" hidden></p>
  `;

  const listaSection = criarElemento("section", "popup-secao pacientes-vinculados");
  listaSection.appendChild(criarElemento("h5", "", "Pacientes vinculados"));
  const lista = criarElemento("ul", "lista-codigos-paciente");
  const status = criarElemento("p", "status-vinculo");

  function atualizarLista() {
    const pacientes = lerLista(chavePacientes);
    lista.replaceChildren();
    if (!pacientes.length) {
      lista.appendChild(criarElemento("li", "estado-vazio-popup", "Nenhum paciente vinculado por código."));
    } else {
      pacientes.forEach((paciente) => {
        const linha = criarElemento("li", "linha-codigo-paciente");
        linha.appendChild(criarElemento("span", "", paciente.codigo));
        linha.appendChild(criarElemento("time", "", new Date(paciente.adicionadoEm).toLocaleDateString("pt-BR")));
        lista.appendChild(linha);
      });
    }
  }

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const campo = formulario.elements.codigo;
    const erro = formulario.querySelector("#erroCodigo");
    const codigo = campo.value.trim().toUpperCase();
    const pacientes = lerLista(chavePacientes);
    erro.hidden = true;
    status.textContent = "";

    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(codigo)) {
      erro.textContent = "Use apenas letras, números e hífens.";
      erro.hidden = false;
      campo.focus();
      return;
    }
    if (pacientes.some((paciente) => paciente.codigo === codigo)) {
      erro.textContent = "Este código já está vinculado a este perfil.";
      erro.hidden = false;
      campo.focus();
      return;
    }

    pacientes.push({ codigo, adicionadoEm: new Date().toISOString() });
    try {
      localStorage.setItem(chavePacientes, JSON.stringify(pacientes));
      campo.value = "";
      atualizarLista();
      status.textContent = "Código vinculado neste navegador.";
    } catch {
      erro.textContent = "Não foi possível salvar o vínculo neste navegador.";
      erro.hidden = false;
    }
  });

  const aviso = criarElemento(
    "p",
    "aviso-integracao",
    "A validação de que o código pertence a um paciente depende da integração com o cadastro central. Por enquanto, o vínculo fica salvo somente neste navegador."
  );
  listaSection.append(lista, status);
  popupConteudo.replaceChildren(formulario, aviso, listaSection);
  atualizarLista();
}

const popups = {
  demanda: { titulo: "Demandas de hoje", renderizar: renderizarDemandas },
  mensagens: { titulo: "Mensagens recentes", renderizar: renderizarMensagens },
  pacientes: { titulo: "Adicionar paciente", renderizar: renderizarPacientes },
};

function abrirPopup(chave) {
  const item = popups[chave];
  if (!item || !modal) return;

  ultimoAcionador = document.activeElement;
  popupTitulo.textContent = item.titulo;
  item.renderizar();
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("active");
  modalClose?.focus();
  if (chave === "pacientes") document.getElementById("codigoPaciente")?.focus();
}

function fecharPopup() {
  if (!modal) return;
  ultimoAcionador?.focus();
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}

document.querySelectorAll(".btn-acao").forEach((botao) => {
  botao.addEventListener("click", () => abrirPopup(botao.dataset.popup));
});

document.querySelectorAll('.acoes-paciente button[title="Alertas"]').forEach((botao) => {
  botao.addEventListener("click", () => {
    const paciente = botao.closest(".card-paciente")?.querySelector(".tag-nome")?.textContent.trim();
    if (!paciente) return;
    ultimoAcionador = botao;
    popupTitulo.textContent = `Alertas · ${paciente}`;
    renderizarAlertas(paciente);
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("active");
    modalClose?.focus();
  });
});

popupConteudo.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-open-popup]");
  if (botao) abrirPopup(botao.dataset.openPopup);
});

modalClose?.addEventListener("click", fecharPopup);

modal?.addEventListener("click", (evento) => {
  if (evento.target === modal) fecharPopup();
});

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && modal?.classList.contains("active")) fecharPopup();
});