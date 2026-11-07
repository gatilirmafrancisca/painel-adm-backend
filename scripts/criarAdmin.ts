/**
 * Cria (ou promove) um usuário Admin do painel. É o único jeito de criar o
 * primeiro Admin: a rota /auth/register exige um Admin logado.
 *
 *   ADMIN_LOGIN=fulana ADMIN_EMAIL=fulana@exemplo.org ADMIN_SENHA='Senha.Forte1' npm run criar-admin
 *
 * A senha vem só de variável de ambiente (nunca de argumento: ficaria no
 * histórico do terminal) e segue a mesma regra do cadastro.
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../api/models/User.js";

async function main() {
    const login = process.env.ADMIN_LOGIN?.trim();
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const senha = process.env.ADMIN_SENHA;
    const uri = process.env.MONGODB_URI;

    if (!login || !email || !senha || !uri) {
        throw new Error("Defina MONGODB_URI, ADMIN_LOGIN, ADMIN_EMAIL e ADMIN_SENHA.");
    }
    if (senha.length < 12 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/\d/.test(senha) || !/[@$!%*?&_.]/.test(senha)) {
        throw new Error("A senha do Admin precisa de 12+ caracteres, com maiúscula, minúscula, número e @ $ ! % * ? & _ .");
    }

    await mongoose.connect(uri, { dbName: process.env.MONGODB_DB_NAME || "example" });

    const existente = await User.findOne({ login });
    const password = await bcrypt.hash(senha, 12);
    if (existente) {
        await User.updateOne({ _id: existente._id }, { $set: { utype: "Admin", email, password } });
        console.info("Usuário existente promovido a Admin:", login);
    } else {
        await User.create({ login, email, password, utype: "Admin" });
        console.info("Admin criado:", login);
    }

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
