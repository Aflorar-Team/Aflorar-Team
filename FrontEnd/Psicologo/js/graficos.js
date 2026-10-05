const emocoes = [
      { nome: "Feliz",      emoji: "😊", cor: "#4A7C59" },
      { nome: "Radiante",   emoji: "😁", cor: "#E9B949" },
      { nome: "Neutro",     emoji: "😐", cor: "#7C8798" },
      { nome: "Irritado",   emoji: "😠", cor: "#8B2020" },
      { nome: "Triste",     emoji: "😢", cor: "#3B5EA6" },
      { nome: "Ansioso",    emoji: "😰", cor: "#D4853A" },
      { nome: "Estressado", emoji: "😵", cor: "#B05D3B" },
      { nome: "Depressivo", emoji: "😞", cor: "#596275" },
      { nome: "Inseguro",   emoji: "😟", cor: "#8A6D3B" },
      { nome: "Cansado",    emoji: "😴", cor: "#B8860B" },
      { nome: "Desmotivado",emoji: "😶", cor: "#6B7280" },
      { nome: "Preocupado", emoji: "😧", cor: "#7B5EA6" },
    ];

    const dados = {
      mensal:  [18, 14, 10, 9, 8, 11, 7, 5, 6, 5, 4, 3],
      semanal: [22, 16, 8,  7, 9, 12, 6, 4, 5, 4, 4, 3],
      diario:  [20, 18, 10, 8, 10, 12, 5, 4, 5, 3, 3, 2],
    };

    let chartInstance = null;

    function renderLegenda() {
      const legenda = document.getElementById("legenda");
      legenda.innerHTML = emocoes.map(e => `
        <div class="legenda-item">
          <div class="legenda-cor" style="background:${e.cor}"></div>
          <span class="legenda-emoji">${e.emoji}</span>
          <span>${e.nome}</span>
        </div>
      `).join("");
    }

    function renderGrafico(filtro) {
      const ctx = document.getElementById("graficoHumor").getContext("2d");
      if (chartInstance) chartInstance.destroy();

      chartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: emocoes.map(e => e.nome),
          datasets: [{
            data: dados[filtro],
            backgroundColor: emocoes.map(e => e.cor),
            borderWidth: 2,
            borderColor: "#fff",
            hoverOffset: 10,
          }]
        },
        options: {
          responsive: true,
          cutout: "55%",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.parsed}%`
              }
            }
          }
        }
      });
    }

    function trocarFiltro(filtro, btn) {
      document.querySelectorAll(".btn-filtro").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      renderGrafico(filtro);
    }

    renderLegenda();
    renderGrafico("mensal");