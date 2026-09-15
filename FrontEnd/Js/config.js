 // Carrega dados salvos
    const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
    if (usuario?.user_metadata) {
      document.getElementById("cpf").value = usuario.user_metadata.cpf || "";
      document.getElementById("crp").value = usuario.user_metadata.crp || "";
      document.getElementById("email").value = usuario.email || "";
      document.getElementById("telefone").value = usuario.user_metadata.telefone || "";
    }

    // Modo escuro
    function alternarModo() {
      document.body.classList.toggle("dark");
      const isDark = document.body.classList.contains("dark");
      localStorage.setItem("tema", isDark ? "escuro" : "claro");
      document.getElementById("btnModoEscuro").querySelector(".icone").textContent = isDark ? "☀️" : "🌙";
    }

    // Aplica tema salvo
    if (localStorage.getItem("tema") === "escuro") {
      document.body.classList.add("dark");
      document.getElementById("btnModoEscuro").querySelector(".icone").textContent = "☀️";
    }

    // Sair
    function sair() {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      localStorage.removeItem("tipo");
      window.location.href = "./escolha_tipo_conta.html";
    }

    // Salvar dados
    function salvarDados() {
      const senha = document.getElementById("senha").value;
      const confirmar = document.getElementById("confirmarSenha").value;

      if (senha && senha !== confirmar) {
        mostrarToast("❌ As senhas não coincidem!", "#E8717A");
        return;
      }

      mostrarToast("✅ Dados atualizados com sucesso!");
    }

    function mostrarToast(msg, cor = "#4A7C59") {
      const toast = document.getElementById("toast");
      toast.textContent = msg;
      toast.style.background = cor;
      toast.style.display = "block";
      setTimeout(() => toast.style.display = "none", 3000);
    }

    // Máscara CPF
    document.getElementById("cpf").addEventListener("input", function() {
      let v = this.value.replace(/\D/g, "").slice(0, 11);
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      this.value = v;
    });

    // Máscara telefone
    document.getElementById("telefone").addEventListener("input", function() {
      let v = this.value.replace(/\D/g, "").slice(0, 11);
      v = v.replace(/(\d{2})(\d)/, "($1) $2");
      v = v.replace(/(\d{5})(\d)/, "$1-$2");
      this.value = v;
    });