  const editor = document.getElementById("editor");

    // Carrega anotações salvas
    const salvo = localStorage.getItem("anotacoes_psicologo");
    if (salvo) editor.value = salvo;

    // ── FERRAMENTAS ──────────────────────────
    function aplicar(tipo) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const textoSelecionado = editor.value.substring(start, end);

      if (!textoSelecionado) return;

      let resultado = textoSelecionado;

      if (tipo === "negrito") {
        resultado = `**${textoSelecionado}**`;
      } else if (tipo === "italico") {
        resultado = `_${textoSelecionado}_`;
      } else if (tipo === "destacar") {
        resultado = `==${textoSelecionado}==`;
      }

      editor.value = editor.value.substring(0, start) + resultado + editor.value.substring(end);
      editor.focus();
    }

    function mudarTamanho(valor) {
      editor.style.fontSize = valor + "px";
      editor.style.lineHeight = "2.2";
    }

    // ── SALVAR LOCAL ─────────────────────────
    function salvarLocal() {
      localStorage.setItem("anotacoes_psicologo", editor.value);
      const toast = document.getElementById("toastSalvo");
      toast.style.display = "block";
      setTimeout(() => toast.style.display = "none", 2500);
    }

    // Autosalva a cada 30 segundos
    setInterval(salvarLocal, 30000);

    // ── EXPORTAR PDF ─────────────────────────
    function exportarPDF() {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      const texto = editor.value || "Sem anotações.";
      const linhas = doc.splitTextToSize(texto, 180);

      doc.setFontSize(16);
      doc.text("Anotações - Aflorar", 14, 20);
      doc.setFontSize(12);
      doc.text(linhas, 14, 35);
      doc.save("anotacoes-paciente.pdf");
    }