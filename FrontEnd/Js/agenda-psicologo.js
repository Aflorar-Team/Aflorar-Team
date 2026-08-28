 const meses = [
      "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ];
 
    const diasComConsulta = [2, 13, 24];
 
    let hoje = new Date();
    let mes = hoje.getMonth();
    let ano = hoje.getFullYear();
 
    function renderCalendario() {
      const grid = document.getElementById("gridDias");
      document.getElementById("mesAno").textContent = `${meses[mes]} ${ano}`;
      grid.innerHTML = "";
 
      const primeiroDia = new Date(ano, mes, 1).getDay();
      const totalDias = new Date(ano, mes + 1, 0).getDate();
      const diasMesAnterior = new Date(ano, mes, 0).getDate();
 
      // Dias do mês anterior
      for (let i = primeiroDia - 1; i >= 0; i--) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("dia-wrapper");
        const div = document.createElement("div");
        div.classList.add("dia", "outro-mes");
        div.textContent = diasMesAnterior - i;
        wrapper.appendChild(div);
        grid.appendChild(wrapper);
      }
 
      // Dias do mês atual
      for (let d = 1; d <= totalDias; d++) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("dia-wrapper");
        const div = document.createElement("div");
        div.classList.add("dia");
        div.textContent = d;
 
        if (d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear()) {
          div.classList.add("hoje");
        }
 
        if (diasComConsulta.includes(d)) {
          div.classList.add("tem-consulta");
        }
 
        div.addEventListener("click", () => {
          document.querySelectorAll(".dia.selecionado").forEach(el => el.classList.remove("selecionado"));
          div.classList.add("selecionado");
        });
 
        wrapper.appendChild(div);
        grid.appendChild(wrapper);
      }
 
      // Dias do próximo mês
      const totalCelulas = primeiroDia + totalDias;
      const restantes = totalCelulas % 7 === 0 ? 0 : 7 - (totalCelulas % 7);
      for (let i = 1; i <= restantes; i++) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("dia-wrapper");
        const div = document.createElement("div");
        div.classList.add("dia", "outro-mes");
        div.textContent = i;
        wrapper.appendChild(div);
        grid.appendChild(wrapper);
      }
    }
 
    document.getElementById("btnAnterior").addEventListener("click", () => {
      mes--; if (mes < 0) { mes = 11; ano--; }
      renderCalendario();
    });
 
    document.getElementById("btnProximo").addEventListener("click", () => {
      mes++; if (mes > 11) { mes = 0; ano++; }
      renderCalendario();
    });
 
    renderCalendario();