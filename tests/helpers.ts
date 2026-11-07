import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../api/models/User.js";
import type { UserType } from "../api/types/user.type.js";

let contador = 0;

/** Cria um usuário direto no banco e devolve o token de acesso dele. */
export async function criarUsuario(utype: UserType = "Admin") {
    contador++;
    const user = await User.create({
        login: `usuario${contador}`,
        email: `usuario${contador}@teste.org`,
        password: await bcrypt.hash("Senha.Forte1", 4),
        utype,
    });
    const token = jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET!, { expiresIn: "1h" });
    return { user, token, login: user.login, senha: "Senha.Forte1" };
}

/** IP próprio por teste: o rate limit do login é por IP e vale pro processo inteiro. */
export const ipUnico = () => `10.9.${Math.floor(contador / 256)}.${(contador++ % 254) + 1}`;
