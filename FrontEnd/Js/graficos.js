  let chartInstance = null;
    let filtroAtual = "mensal";
 
    const dados = {
      mensal: {
        labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"],
        valores: [5, 6, 4, 7, 6, 8, 7],
      },
      semanal: {
        labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
        valores: [6, 5, 7, 6, 8, 7, 6],
      },
      diario: {
        labels: ["08h", "10h", "12h", "14h", "16h", "18h", "20h"],
        valores: [4, 6, 7, 5, 8, 6, 7],
      },
    };
 
    function trocarFiltro(filtro, btn) {
      filtroAtual = filtro;
      document.querySelectorAll(".btn-filtro").forEach(b => b.classList.remove("ativo"));
      btn.classList.add("ativo");
 
      // Se o gráfico já está visível, atualiza
      if (document.getElementById("graficoWrapper").style.display === "block") {
        gerarGraficos();
      }
    }
 
    function gerarGraficos() {
      document.getElementById("estadoVazio").style.display = "none";
      document.getElementById("graficoWrapper").style.display = "block";
 
      const d = dados[filtroAtual];
 
      if (chartInstance) chartInstance.destroy();
 
      const ctx = document.getElementById("graficoHumor").getContext("2d");
      chartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: d.labels,
          datasets: [{
            label: "Nível de Humor",
            data: d.valores,
            borderColor: "#E8717A",
            backgroundColor: "rgba(232, 113, 122, 0.15)",
            pointBackgroundColor: "#F4A261",
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.4,
            fill: true,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, position: "top" },
            tooltip: {
              callbacks: {
                label: ctx => ` Humor: ${ctx.parsed.y}/10`
              }
            }
          },
          scales: {
            y: {
              min: 0,
              max: 10,
              ticks: { stepSize: 2 },
              title: { display: true, text: "Nível (0-10)" }
            },
            x: {
              title: { display: true, text: filtroAtual.charAt(0).toUpperCase() + filtroAtual.slice(1) }
            }
          }
        }
      });
    }