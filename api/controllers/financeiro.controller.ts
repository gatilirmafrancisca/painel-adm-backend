import { Request, Response, NextFunction } from "express";
import { ITransferencia } from "../models/Transferencia.js";
import * as financeiroService from "../services/financeiro.service.js"

export const criarTransferencia = async(req: Request<any, any, ITransferencia> , res: Response, next: NextFunction) => {

    try {
        
        if(!req.user) {
            return res.status(401).json( {message: "Unathorized."} );
        }

        const transferencia = await financeiroService.criarTransferenciaService(req.body, req);
        return res.status(transferencia.status).json({ message: transferencia.message, data: transferencia.data });
    }
    catch (error) {

        next(error);
        
    }
}

export const listarTransferencias = async(req: Request, res: Response, next: NextFunction) => {
    
    try {

        const transferencias = await financeiroService.listarTransferenciaService({query: req.query});
        return res.status(transferencias.status).json({ message: transferencias.message, data: transferencias.data });

    } catch (error) {

        next(error);
    }
}