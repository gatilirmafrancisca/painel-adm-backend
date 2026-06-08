import { Request, Response, NextFunction } from "express";
import { IGato } from "../models/Gato.js";
import * as gatoService from "../services/gato.service.js"


export const criarGato = async(req: Request<any, any, IGato> , res: Response, next: NextFunction) => {

    try {

        if(!req.user){
            return res.status(401).json( {message: "Unathorized."} );
        }

        const resposta = await gatoService.criarGatoService(req.body, req);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });

    } catch (error) {
        next(error);
    }
    
}

export const listarGatos = async(req: Request, res: Response, next: NextFunction) => {
    try {
        const resposta = await gatoService.listarGatosService({query: req.query});
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });
    } catch (error) {
        next(error);
    }
}

export const patchGato = async (req: Request<{ id: string }, any, Partial<IGato>>, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unathorized." });
        }

        const { id } = req.params;
        const resposta = await gatoService.patchGatoService(id, req.body, req);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });
    } catch (error) {
        next(error);
    }
};

export const deletarGato = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unathorized." });
        }

        const { id } = req.params;
        const resposta = await gatoService.deletarGatoService(id);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });
    } catch (error) {
        next(error);
    }
};