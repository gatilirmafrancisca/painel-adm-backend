import Transferencia, {ITransferencia} from "../models/Transferencia"
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

        const dadosTransferencia = new Transferencia(dadosNormalizados);
        await dadosTransferencia.save();

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