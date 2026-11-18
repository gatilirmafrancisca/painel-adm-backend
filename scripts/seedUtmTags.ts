/**
 * Cria a coleção `utmtags` (no banco da rifa) com as tags que antes ficavam
 * fixas no código, e o índice único { categoria, codigo }. Idempotente: pode
 * rodar de novo sem duplicar nem desfazer o que foi editado no painel.
 *
 *   npm run seed:utm
 *
 * Usa MONGODB_URI e MONGODB_RIFA_NAME (as mesmas variáveis do servidor).
 */
import "dotenv/config";
import { getRifaConnection } from "../api/database/rifadb.js";
import { semearUtmTags } from "../api/services/utm.service.js";

async function main() {
    const conexao = getRifaConnection();
    await conexao.asPromise();
    const { criadas } = await semearUtmTags();
    console.log(`[seed:utm] ${criadas} tag(s) criada(s); as já existentes foram mantidas.`);
    await conexao.close();
}

main().catch((erro) => {
    console.error("[seed:utm] falhou:", erro);
    process.exit(1);
});
