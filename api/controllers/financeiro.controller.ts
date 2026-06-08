import { Request, Response, NextFunction } from "express";
import { ITransferencia } from "../models/Transferencia.js";
import * as financeiroService from "../services/financeiro.service.js"

export const criarTransferencia = async(req: Request<any, any, ITransferencia> , res: Response, next: NextFunction) => {

    try {
        
        if(!req.user) {
            return res.status(401).json( {message: "Unathorized."} );
        }

        const resposta = await financeiroService.criarTransferenciaService(req.body, req);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });
    }
    catch (error) {

        next(error);
        
    }
}

export const listarTransferencias = async(req: Request, res: Response, next: NextFunction) => {
    
    try {

        const resposta = await financeiroService.listarTransferenciaService({query: req.query});
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });

    } catch (error) {

        next(error);
    }
}

export const patchTransferencia = async (req: Request<{ id: string }, any, Partial<ITransferencia>>, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unathorized." });
        }

        const { id } = req.params;
        const resposta = await financeiroService.patchTransferenciaService(id, req.body, req);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });

    } catch (error) {

        next(error);

    }
};

export const deletarTransferencia = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unathorized." });
        }

        const { id } = req.params;
        const resposta = await financeiroService.deletarTransferenciaService(id);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });
    } catch (error) {
        next(error);
    }
};