import User, { IUser } from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import ResponseType from "../types/response.type.js";


const createJWT = (uid: Types.ObjectId | string) => {
    const id = typeof uid === "string" ? uid : uid.toString();
    return jwt.sign({ id }, process.env.JWT_SECRET || "secret", { expiresIn: "7d" }); // Acesso expira em 7 dias
};


const locateUserByEmail = async (email: string) => {
    return await User.findOne({ email }).select('+password');
};

const locateUserByLogin = async (login: string) => {
    return await User.findOne({ login }).select('+password');
}

const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

const validatePassword = (password: string): { valid: boolean; message?: string } => {
    // 1) spaces
    if (/\s/.test(password)) {
        return { valid: false, message: "A senha não pode conter espaços." };
    }

    // 2) accented or non-ASCII characters
    if (/[^\x00-\x7F]/.test(password)) {
        return { valid: false, message: "A senha não pode conter acentos ou caracteres não-ASCII." };
    }

    // 3) characters not allowed (only A-Za-z0-9 and @$!%*?&_. allowed)
    const allowedRegex = /^[A-Za-z\d@$!%*?&_.]+$/;
    if (!allowedRegex.test(password)) {
        return { valid: false, message: "A senha possui caracteres não validos. Válidos: @ $ ! % * ? & _ ." };
    }

    // 4) length
    if (password.length < 8) {
        return { valid: false, message: "A senha precisa de no mínimo 8 caracteres." };
    }

    // 5) composition requirements
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[@$!%*?&_.]/.test(password)) {
        return { valid: false, message: "A senha precisa incluir uma letra maiúscula, uma letra minúscula, um número e um caractere especial (@ $ ! % * ? & _ .)." };
    }

    return { valid: true };
};

export const registerService = async (data: IUser): Promise<ResponseType> => {

    try {
        if (!data || !data.login || !data.password || !data.email || !data.utype) {

            return { status: 400, message: "Login, email, e senha são necessários." };
        }

        // Validação email existente
        const existingEmail = await locateUserByEmail(data.email);
        if (existingEmail) {
            return { status: 409, message: "Email já está cadastrado!" };
        }
        
        const existingUser =  await locateUserByLogin(data.login);
        if (existingUser) {
            return {status : 409, message: "Escolha outro nome de usuário!"}
        }

        const validEmail = isValidEmail(data.email);
        if (!validEmail) {
            return { status: 400, message: "Email no formato inválido" };
        }

        const validPassword = validatePassword(data.password);
        if (!validPassword.valid) {
            return { status: 400, message: validPassword.message || "Senha inválida." };
        }

        // Hashing password

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(data.password, salt);

        const user = new User({ 
            login: data.login, 
            email: data.email,
            password: hashedPassword,
            utype: data.utype
        });

        await user.save();
        return { status: 201, message: "Usuário registrado com sucesso.", data: { name: user.login, email: user.email } };
    } catch (error) {
        return { status: 500, message: "Erro interno no servidor." };
    }
};

export const loginService = async (data: IUser): Promise<ResponseType> => {

    try {
        if (!data || !data.login || !data.password) {
            return { status: 400, message: "Login e senha são obrigatórios." };
        }

        const user = await locateUserByLogin(data.login);
        if (!user) {
            console.log("User not found with login:", data.login);
            return { status: 404, message: "Usuário inválido" };
        }

        const isMatch = await bcrypt.compare(data.password, user.password);
        if (!isMatch) {
            console.log("Invalid password attempt for login:", data.login); 
            return { status: 401, message: "Senha incorreta." };
        }
        console.log("User logged in successfully:", user.email);

       const token = createJWT(user._id);

        return { status: 200, message: "Login bem sucedido.", data: { name: user.login, email: user.email, token: token } };

    } catch (error) {
        return { status: 500, message: "Erro interno no servidor." };
    }

}