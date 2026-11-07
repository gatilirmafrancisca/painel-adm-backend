// Primeiro import: o app.ts lê o .env (FRONTEND_URL) ao ser carregado.
import "dotenv/config";
import database from "./database/configdb.js"
import { app } from "./app.js";
import { getJwtSecret } from "./utils/jwtSecret.js";

// Sem um JWT_SECRET forte o painel não sobe: um segredo padrão deixaria
// qualquer pessoa forjar um token de admin.
getJwtSecret();

// Database
database.connect();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`App is listening on http://localhost:${PORT}/`);
});

export default app;
