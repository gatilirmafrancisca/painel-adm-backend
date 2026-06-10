import Gato, {IGato} from "../models/Gato.js";
import ResponseType from "../types/response.type.js";
import { Types, Document } from "mongoose";
import { Request } from "express";
import { cloudinary } from '../database/configupload.js';
import streamifier from 'streamifier';
import { montarFiltrosGato, normalizarDadosGato, normalizarPersonalidades, validarParametros, validatePatchParams } from "../utils/gatovalidar.js";

const localizarGato = async(id?: string, filters: any = {}) : Promise<(IGato & Document)[]> => {
    
    if (id) {

        if (!Types.ObjectId.isValid(id)) {
            return [];
        }

        const gato = await Gato.findOne({ _id: id, ...filters });
        return gato ? [gato] : [];
    }
    return await Gato.find(filters);

}


const uploadFromBuffer = (reqFile: Express.Multer.File, id: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        const cld_upload_stream = cloudinary.uploader.upload_stream(
          { folder: `gatil_images/gatos/${id}` },
          (error: any, result: any) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(reqFile.buffer).pipe(cld_upload_stream);
    });
};


const uploadMultipleFiles = async (files: Express.Multer.File[], id: string): Promise<string[]> => {
    // Cria um array de promessas de upload
    const uploadPromises = files.map(file => uploadFromBuffer(file, id));
    // Aguarda todas subirem ao mesmo tempo (muito mais rápido que um for loop)
    const results = await Promise.all(uploadPromises);
    // Retorna apenas as URLs geradas
    return results.map(result => result.secure_url);
};


export const criarGatoService = async (data: IGato, req: Request) : Promise<ResponseType> => {
    try {

        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {return {status: 400, message: "Pelo menos uma imagem é obrigatória."};}
        if (files.length > 10) {
            return { status: 400, message: "É permitido enviar no máximo 10 imagens por gato." };
        }

        const dadosNormalizados = normalizarDadosGato(data);

        await validarParametros({
          ...data,
          ...dadosNormalizados,
          personalidade: normalizarPersonalidades(dadosNormalizados.personalidade),
        } as IGato);

        const personalidades = normalizarPersonalidades(dadosNormalizados.personalidade);

        const id = new Types.ObjectId();
        const result = await uploadMultipleFiles(files, id.toString());

        const dadosGato = new Gato({
            _id: id,
          ...data,
          ...dadosNormalizados,
          imagemUrl: result,
          personalidade: personalidades
        });

        // Criar gato com dados originais e sobrescrever campos modificados
        const gatoNovo = new Gato(dadosGato);
        await gatoNovo.save();

        return {status: 201, message: "Gato cadastrado com sucesso.", data: { nome: gatoNovo.nome, id: gatoNovo._id }}

    }catch(error: any) {

        console.error("criarGatoService error:", error);
        throw error;
    }
}

export const listarGatosService = async (req: any): Promise<ResponseType> => {
    try {

      const { query } = req;
      const filters = montarFiltrosGato(query);

      const gatos = await localizarGato(undefined, filters);

      if (gatos.length === 0) {
        return { status: 404, message: "Nenhum gato encontrado." };
      }

      return { status: 200, message: "Gatos:", data: gatos };

    } catch (error: any) {

        console.error("listarGatosService error:", error);
        throw error;

    }
}

export const patchGatoService = async (id: string, data: Partial<IGato>, req: Request): Promise<ResponseType> => {
    try {
        const gato = await localizarGato(id, {});

        if (gato.length === 0) {
            return { status: 404, message: "Gato não encontrado." };
        }

        const files = req.files as Express.Multer.File[];
        const hasBodyData = !!data && Object.keys(data).length > 0;

        if (!hasBodyData && (!files || files.length === 0)) {
            return { status: 400, message: "Nenhum dado fornecido para atualização." };
        }

        const dadosNormalizados = normalizarDadosGato(data as Partial<IGato> & Record<string, any>);
        const validData = hasBodyData
            ? await validatePatchParams(dadosNormalizados)
            : {} as Partial<IGato>;

        if (files && files.length > 0) {
            if (files.length > 10) {
                return { status: 400, message: "É permitido enviar no máximo 10 imagens." };
            }

            const uploadResult = await uploadMultipleFiles(files, id);
            validData.imagemUrl = uploadResult as any;
        }

        Object.assign(gato[0], validData);
        await gato[0].save();

        return { status: 200, message: "Gato atualizado com sucesso.", data: gato[0] };
    } catch (error: any) {
        console.error("patchGatoService error:", error);
        throw error;
    }
};

export const deletarGatoService = async(id: string) : Promise<ResponseType> => {
    try {
        const gato = await localizarGato(id, {});

        if (gato.length === 0) {
            return {status: 404, message: "Gato não encontrado."};
        }

        await gato[0].deleteOne()

        return {status: 200, message: "Gato deletado com sucesso."};

    } catch (error: any) {
        console.error("deletarGatoService error:", error);
        throw error;
    }
}