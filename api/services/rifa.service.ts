import { getRifaModel, IRifa } from "../models/Rifa.js";
import { ConflictError, MissingParamsError, NotFoundError } from "../utils/errors.js";
import type ResponseType from "../types/response.type.js";
import { Types, Document } from "mongoose";

const TOTAL_NUMEROS = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


const localizarRifa = async(id?: string, filters: any = {}) : Promise<(IRifa & Document)[]> => {
    
    if (id) {

        if (!Types.ObjectId.isValid(id)) {
            return [];
        }

        const rifa = await getRifaModel().findOne({ _id: id, ...filters });
        return rifa ? [rifa] : [];
    }
    return await getRifaModel().find(filters);

}



function validarNome(value: unknown): string {
    const normalizado = String(value ?? "").trim();
    if (normalizado.length < 3) {
        throw new MissingParamsError("O campo 'Nome' precisa ter pelo menos 3 caracteres.");
    }
    return normalizado;
}

function validarTelefone(value: unknown): string {
    const normalizado = String(value ?? "").trim();
    const digitos = normalizado.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 13) {
        throw new MissingParamsError("O campo 'Telefone' deve ser um telefone válido, com DDD.");
    }
    return normalizado;
}

function validarEmailOpcional(value: unknown, numeroFormatado: string): string {
    const normalizado = String(value ?? "").trim().toLowerCase();
    if (!normalizado) {
        // Sem e-mail informado — placeholder rastreável, igual à migração da planilha.
        return `manual+n${numeroFormatado}@gatilirmafrancisca.org`;
    }
    if (!EMAIL_REGEX.test(normalizado)) {
        throw new MissingParamsError("O campo 'E-mail' não parece válido.");
    }
    return normalizado;
}

function validarNumero(value: unknown): number {
    const numero = Number(value);
    if (!Number.isInteger(numero) || numero < 1 || numero > TOTAL_NUMEROS) {
        throw new MissingParamsError(
            `O campo 'Número' deve ser um inteiro entre 1 e ${TOTAL_NUMEROS}.`
        );
    }
    return numero;
}


export const listarRifasAdminService = async (): Promise<ResponseType> => {
    try {
        const rifas = await getRifaModel()
            .find({ claimedNumber: { $ne: null } })
            .select("name phone email claimedNumber status paymentId")
            .sort({ claimedNumber: 1 })
            .lean();

        return { status: 200, message: "Rifas encontradas.", data: rifas };
    } catch (error: any) {
        console.error("listarRifasAdminService error:", error);
        throw error;
    }
};

export interface CadastroManualInput {
    name: string;
    phone: string;
    email?: string;
    claimedNumber: number;
}


export const criarRifaManualService = async (
    data: CadastroManualInput
): Promise<ResponseType> => {
    try {
        const numero = validarNumero(data.claimedNumber);
        const numeroFormatado = String(numero).padStart(3, "0");

        const nome = validarNome(data.name);
        const telefone = validarTelefone(data.phone);
        const email = validarEmailOpcional(data.email, numeroFormatado);

        const rifa = await getRifaModel().create({
 
            paymentId: `MANUAL-${numeroFormatado}`,
            status: "confirmado",
            amount: 100,
            name: nome,
            phone: telefone,
            email,
            claimedNumber: numero,
        });

        return {
            status: 201,
            message: "Número cadastrado manualmente.",
            data: { id: rifa._id, claimedNumber: rifa.claimedNumber },
        };
    } catch (error: any) {
        if (error?.code === 11000) {
            throw new ConflictError("Esse número já foi vendido — confira antes de cadastrar de novo.");
        }
        console.error("criarRifaManualService error:", error);
        throw error;
    }
};


export const excluirRifaService = async (claimedNumber: unknown): Promise<ResponseType> => {
    try {
        const numero = validarNumero(claimedNumber);
 
        const resultado = await getRifaModel().findOneAndDelete({ claimedNumber: numero });
 
        if (!resultado) {
            throw new NotFoundError(`Nenhum registro encontrado com o número ${numero}.`);
        }
 
        return { status: 200, message: "Registro removido.", data: { claimedNumber: numero } };
    } catch (error: any) {
        console.error("excluirRifaService error:", error);
        throw error;
    }
};