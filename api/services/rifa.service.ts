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
        // Números de Pix de teste (R$ 0,01) não são vendas.
        const rifas = await getRifaModel()
            .find({ claimedNumber: { $ne: null }, teste: { $ne: true } })
            .select("name phone email claimedNumber status paymentId")
            .sort({ claimedNumber: 1 })
            .lean();

        return { status: 200, message: "Rifas encontradas.", data: rifas };
    } catch (error: any) {
        console.error("listarRifasAdminService error:", error);
        throw error;
    }
};

/** Mesmo prazo do backend da rifa (lembretes.service.ts). */
const PRAZO_ESCOLHA_DIAS = 20;
const DIA_MS = 24 * 60 * 60_000;

interface ItemResumo {
    paymentId: string;
    email: string | null;
    aprovadoEm?: Date | null;
    _id: Types.ObjectId;
}

export interface PendenteEscolha {
    paymentId: string;
    email: string | null;
    /** Data da aprovação (ou do registro, para os antigos sem aprovadoEm). */
    pagoEm: string;
    /** Dias até o número ser sorteado; 0 = sorteio na próxima execução. */
    diasRestantes: number;
}

export interface Reserva {
    paymentId: string;
    email: string | null;
    /** Quando o Pix foi gerado (data de criação do registro). */
    criadoEm: string;
}

export interface ResumoRifas {
    total: number;
    compradas: number;
    pendentesEscolha: number;
    reservadas: number;
    disponiveis: number;
    listas: { pendentesEscolha: PendenteEscolha[]; reservadas: Reserva[] };
}

/**
 * Situação das vagas da rifa, na mesma conta que o site usa para bloquear a
 * venda (haNumerosDisponiveis no backend da rifa):
 * - compradas: APROVADO com número (site + cadastro manual);
 * - pendentesEscolha: APROVADO, pagou e ainda não escolheu o número;
 * - reservadas: PENDENTE, Pix gerado e ainda não pago — ocupa vaga até vencer;
 * - disponiveis: o resto. CANCELADO e Pix de teste ficam de fora.
 */
export const resumoRifasAdminService = async (): Promise<ResponseType> => {
    try {
        const campos = { paymentId: 1, email: 1, aprovadoEm: 1 };
        const [resultado] = await getRifaModel().aggregate<{
            compradas: { n: number }[];
            pendentesEscolha: ItemResumo[];
            reservadas: ItemResumo[];
        }>([
            { $match: { teste: { $ne: true }, status: { $ne: "CANCELADO" } } },
            { $sort: { _id: 1 } },
            {
                $facet: {
                    compradas: [
                        { $match: { status: "APROVADO", claimedNumber: { $type: "number" } } },
                        { $count: "n" },
                    ],
                    pendentesEscolha: [
                        { $match: { status: "APROVADO", claimedNumber: null } },
                        { $project: campos },
                    ],
                    reservadas: [
                        { $match: { status: "PENDENTE" } },
                        { $project: campos },
                    ],
                },
            },
        ]);

        const agora = Date.now();
        const pendentesEscolha: PendenteEscolha[] = (resultado?.pendentesEscolha ?? [])
            .map((item) => {
                const pagoEm = item.aprovadoEm ? new Date(item.aprovadoEm) : item._id.getTimestamp();
                const prazo = pagoEm.getTime() + PRAZO_ESCOLHA_DIAS * DIA_MS;
                return {
                    paymentId: item.paymentId,
                    email: item.email ?? null,
                    pagoEm: pagoEm.toISOString(),
                    diasRestantes: Math.max(0, Math.ceil((prazo - agora) / DIA_MS)),
                };
            })
            .sort((a, b) => a.pagoEm.localeCompare(b.pagoEm));

        const reservadas: Reserva[] = (resultado?.reservadas ?? []).map((item) => ({
            paymentId: item.paymentId,
            email: item.email ?? null,
            criadoEm: item._id.getTimestamp().toISOString(),
        }));

        const compradas = resultado?.compradas[0]?.n ?? 0;
        const ocupadas = compradas + pendentesEscolha.length + reservadas.length;

        const resumo: ResumoRifas = {
            total: TOTAL_NUMEROS,
            compradas,
            pendentesEscolha: pendentesEscolha.length,
            reservadas: reservadas.length,
            disponiveis: Math.max(0, TOTAL_NUMEROS - ocupadas),
            listas: { pendentesEscolha, reservadas },
        };

        return { status: 200, message: "Resumo da rifa.", data: resumo };
    } catch (error: any) {
        console.error("resumoRifasAdminService error:", error);
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
            status: "APROVADO",
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