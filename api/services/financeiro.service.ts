import Transferencia, {ITransferencia} from "../models/Transferencia.js"
import ResponseType from "../types/response.type.js";
import { Types, Document } from "mongoose";
import { Request } from "express";
import { normalizarDadosTransferencia, validarParametros, montarFiltrosTransferencia, validatePatchParams } from "../utils/financeirovalidar.js";
import Gato from "../models/Gato.js";

const localizarTransferencia = async(id?: string, filters: any = {}) : Promise<(ITransferencia & Document)[]> => {
    
    if (id) {

        if (!Types.ObjectId.isValid(id)) {
            return [];
        }

        const transferencia = await Transferencia.findOne({ _id: id, ...filters });
        return transferencia ? [transferencia] : [];
    }
    return await Transferencia.find(filters);

}

export const criarTransferenciaService = async (data: ITransferencia, req: Request) : Promise<ResponseType> => {

    try {

        const dadosNormalizados = normalizarDadosTransferencia(data);
        await validarParametros(dadosNormalizados as ITransferencia);

        const mercadoPagoId = dadosNormalizados.mercadoPagoId;
        const transferenciaExistente = mercadoPagoId
            ? await Transferencia.findOne({ mercadoPagoId })
            : null;

        if (transferenciaExistente) {
            if (transferenciaExistente.status !== "APROVADO" || dadosNormalizados.status === "APROVADO") {
                Object.assign(transferenciaExistente, dadosNormalizados);
            } else {
                Object.assign(transferenciaExistente, { ...dadosNormalizados, status: transferenciaExistente.status });
            }

            await transferenciaExistente.save();

            console.log("[financeiro] transferência sincronizada:", {
                id: transferenciaExistente._id,
                mercadoPagoId: transferenciaExistente.mercadoPagoId ?? "N/A",
                valor: transferenciaExistente.valor,
                status: transferenciaExistente.status,
            });

            return { status: 200, message: "Transferência já cadastrada e atualizada.", data: { id: transferenciaExistente._id } };
        }

        const dadosTransferencia = new Transferencia(dadosNormalizados);
        await dadosTransferencia.save();

        console.log("[financeiro] transferência salva com sucesso:", {
        id: dadosTransferencia._id,
        mercadoPagoId: dadosTransferencia.mercadoPagoId ?? "N/A",
        valor: dadosTransferencia.valor,
        status: dadosTransferencia.status,
        });

        return {status: 201, message: "Transferência cadastrada.", data: {id: dadosTransferencia._id }}

    } catch (error: any) {

        console.error("criarTransferenciaService error:", error);
        throw error;
    }

}

export const listarTransferenciaService = async (req: any) : Promise<ResponseType> => {
    try {
    
        const { query } = req;
        const filters = montarFiltrosTransferencia(query);

        // ?agregar=total devolve só a soma dos valores filtrados, sem a lista
        if (query?.agregar === "total") {
            const [resultado] = await Transferencia.aggregate<{ total: number }>([
                { $match: filters },
                { $group: { _id: null, total: { $sum: "$valor" } } },
            ]);

            const total = Math.round((resultado?.total ?? 0) * 100) / 100;
            return { status: 200, message: "Total das transferências:", data: { total } };
        }
    
        const transferencias = await localizarTransferencia(undefined, filters);
    
        if (transferencias.length === 0) {

           return { status: 404, message: "Nenhuma transferência encontrada." };
        }
    
        return { status: 200, message: "Transferências:", data: transferencias };
    
    } catch (error: any) {
    
        console.error("listarTranferenciaService error:", error);
        throw error;
    
    }
}

export const patchTransferenciaService = async (id: string, data: Partial<ITransferencia>, req: Request) : Promise<ResponseType> => {
    try {

        const transferencia = await localizarTransferencia(id, {});

        if (transferencia.length === 0) {
            return { status: 404, message: "Transferencia não encontrada." };
        }

        const dadosNormalizados = normalizarDadosTransferencia(data as Partial<ITransferencia> & Record<string, any>);
        const validData = await validatePatchParams(dadosNormalizados);

        Object.assign(transferencia[0], validData);
        await transferencia[0].save();
        
        return {status : 201, message: "Transferencia atualizada.", data: transferencia[0]};

    } catch (error: any) {

        console.error("patchTransferenciaService error:", error);
        throw error;

    }
}

export const deletarTransferenciaService = async(id: string) : Promise<ResponseType> => {
    try {
        const transferencia = await localizarTransferencia(id, {});

        if (transferencia.length === 0) {
            return {status: 404, message: "Transferencia não encontrada."};
        }

        await transferencia[0].deleteOne();

        return {status: 200, message: "Transferencia deletada com sucesso."};

    } catch (error: any) {
        console.error("deletarTransferenciaService error:", error);
        throw error;
    }
}