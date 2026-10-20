const editor = document.getElementById("editor");
let selecaoSalva = null;
let timerToast;

function carregarTextoAntigo(texto) {
  const padrao = /(\*\*[^*]+\*\*|==[^=]+==|_[^_]+_)/g;
  let inicio = 0;
  let trecho;

  while ((trecho = padrao.exec(texto))) {
    editor.append(document.createTextNode(texto.slice(inicio, trecho.index)));
    const marcador = trecho[0];
    const elemento = document.createElement(marcador.startsWith("**") ? "strong" : marcador.startsWith("==") ? "mark" : "em");
    elemento.textContent = marcador.slice(2, -2);
    if (marcador.startsWith("_")) elemento.textContent = marcador.slice(1, -1);
    editor.append(elemento);
    inicio = trecho.index + marcador.length;
  }

  editor.append(document.createTextNode(texto.slice(inicio)));
}

const salvoFormatado = localStorage.getItem("anotacoes_psicologo_formatadas");
const salvoAntigo = localStorage.getItem("anotacoes_psicologo");
if (salvoFormatado) {
  editor.innerHTML = salvoFormatado;
} else if (salvoAntigo) {
  if (/[*_][^\n]+[*_]|==[^\n]+==/.test(salvoAntigo)) carregarTextoAntigo(salvoAntigo);
  else editor.textContent = salvoAntigo;
  localStorage.setItem("anotacoes_psicologo_formatadas", editor.innerHTML);
  localStorage.setItem("anotacoes_psicologo", editor.innerText);
}

document.addEventListener("selectionchange", () => {
  const selecao = window.getSelection();
  if (selecao?.rangeCount && editor.contains(selecao.anchorNode)) {
    selecaoSalva = selecao.getRangeAt(0).cloneRange();
  }
});

document.querySelectorAll(".btn-ferramenta").forEach((botao) => {
  botao.addEventListener("mousedown", (evento) => evento.preventDefault());
});

function aplicar(tipo) {
  editor.focus();
  const selecao = window.getSelection();
  if (selecaoSalva && editor.contains(selecaoSalva.startContainer)) {
    selecao.removeAllRanges();
    selecao.addRange(selecaoSalva);
  }
  if (!selecao || selecao.isCollapsed || !editor.contains(selecao.anchorNode)) return;

  if (tipo === "destacar") {
    const elementoAncora = selecao.anchorNode.nodeType === Node.TEXT_NODE
      ? selecao.anchorNode.parentElement
      : selecao.anchorNode;
    const destaque = elementoAncora.closest("mark, span[style*='background-color']");
    const contemSelecao = destaque && editor.contains(destaque)
      && destaque.contains(selecao.focusNode);

    if (contemSelecao) {
      destaque.replaceWith(...destaque.childNodes);
      selecaoSalva = null;
      salvarLocal(false);
      return;
    }
  }

  const comandos = { negrito: "bold", italico: "italic", destacar: "hiliteColor" };
  document.execCommand(comandos[tipo], false, tipo === "destacar" ? "#fff1a8" : undefined);
  selecaoSalva = null;
  salvarLocal(false);
}

function mudarTamanho(valor) {
  editor.focus();
  const selecao = window.getSelection();
  if (selecaoSalva && editor.contains(selecaoSalva.startContainer)) {
    selecao.removeAllRanges();
    selecao.addRange(selecaoSalva);
  }

  if (selecao && !selecao.isCollapsed && editor.contains(selecao.anchorNode)) {
    document.execCommand("fontSize", false, "7");
    editor.querySelectorAll('font[size="7"]').forEach((fonte) => {
      const span = document.createElement("span");
      span.style.fontSize = `${Number(valor)}px`;
      span.innerHTML = fonte.innerHTML;
      fonte.replaceWith(span);
    });
  } else {
    editor.style.fontSize = `${Number(valor)}px`;
  }
  salvarLocal(false);
}

function salvarLocal(mostrarConfirmacao = true) {
  localStorage.setItem("anotacoes_psicologo_formatadas", editor.innerHTML);
  localStorage.setItem("anotacoes_psicologo", editor.innerText);
  if (!mostrarConfirmacao) return;

  const toast = document.getElementById("toastSalvo");
  toast.style.display = "block";
  clearTimeout(timerToast);
  timerToast = setTimeout(() => toast.style.display = "none", 2500);
}

editor.addEventListener("input", () => salvarLocal(false));
setInterval(() => salvarLocal(false), 30000);

function exportarPDF() {
  if (!window.jspdf?.jsPDF) {
    alert("Não foi possível carregar a ferramenta de exportação do PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const texto = editor.innerText.trim() || "Sem anotações.";
  const linhas = doc.splitTextToSize(texto, 180);

  doc.setFontSize(16);
  doc.text("Anotações - Aflorar", 14, 20);
  doc.setFontSize(12);
  let posicaoY = 35;
  linhas.forEach((linha) => {
    if (posicaoY > 280) {
      doc.addPage();
      posicaoY = 20;
    }
    doc.text(linha, 14, posicaoY);
    posicaoY += 7;
  });
  doc.save("anotacoes-paciente.pdf");
}