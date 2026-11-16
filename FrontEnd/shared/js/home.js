 const blobs = document.querySelectorAll('.blob');

blobs.forEach((blob, index) => {
  let x = 0;
  let y = 0;

  setInterval(() => {
    x += (Math.random() - 0.5) * 20;
    y += (Math.random() - 0.5) * 20;

    blob.style.transform = `translate(${x}px, ${y}px)`;
  }, 2000 + index * 500);
});

const formContato = document.querySelector(".contato-form");
const statusContato = document.querySelector(".contato-status");

formContato?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const botao = formContato.querySelector('button[type="submit"]');
  botao.disabled = true;
  statusContato.textContent = "Enviando mensagem...";

  try {
    const formData = new FormData(formContato);
    const response = await fetch("https://aflorar-backend.onrender.com/api/contato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: formData.get("nome"),
        email: formData.get("email"),
        mensagem: formData.get("mensagem"),
        website: formData.get("website"),
      }),
    });
    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.erro || "Não foi possível enviar a mensagem.");

    formContato.reset();
    statusContato.textContent = resultado.mensagem;
  } catch (error) {
    statusContato.textContent = error.message || "Falha ao enviar. Tente novamente mais tarde.";
  } finally {
    botao.disabled = false;
  }
});