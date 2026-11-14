  import app, { ensureJardinsTable } from "./app.js";
import { PORT } from "./config/env.js";

const startServer = async () => {
  await ensureJardinsTable();

  app.listen(PORT, () => {
    console.log(`Flora backend rodando na porta ${PORT}`);
  });
};

startServer();
