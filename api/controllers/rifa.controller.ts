import { Request, Response, NextFunction } from "express";
import * as rifaService from "../services/rifa.service.js"

export const listarRifasAdminController = async(_req:Request , res: Response, next: NextFunction) => {

    try {

        const resposta = await rifaService.listarRifasAdminService();
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data }); 

    } catch (error) {next(error);}

}

export const resumoRifasAdminController = async(_req: Request, res: Response, next: NextFunction) => {

    try {

        const resposta = await rifaService.resumoRifasAdminService();
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });

    } catch (error) {next(error);}

}

export const definirEmailPagamentoController = async(req: Request, res: Response, next: NextFunction) => {

    try {

        const resposta = await rifaService.definirEmailPagamentoService(req.params.paymentId, req.body?.email);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });

    } catch (error) {next(error);}

}

export const criarRifaManualController = async(
    req:Request<any, any, rifaService.CadastroManualInput>, 
    res: Response, 
    next: NextFunction
) => {

    try {

        if(!req.user){
            return res.status(401).json( {message: "Unathorized."} );
        }
        const resposta = await rifaService.criarRifaManualService(req.body);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data }); 


    } catch (error) {next(error);}

}

export const excluirRifaController = async (req: Request, res: Response, next: NextFunction) =>{


    try {

        if(!req.user){
            return res.status(401).json( {message: "Unathorized."} );
        }

        const { claimedNumber } = req.params;
        const resposta = await rifaService.excluirRifaService(claimedNumber, req.query.forcar === "1");
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data }); 

    } catch (error) {next(error);}

}

export const listarPedidosAdminController = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const resposta = await rifaService.listarPedidosAdminService({ status: req.query.status, busca: req.query.busca });
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });
    } catch (error) { next(error); }
}

export const alertasPedidosAdminController = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const resposta = await rifaService.alertasPedidosAdminService();
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data });
    } catch (error) { next(error); }
}

export const exportarCsvController = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const csv = await rifaService.exportarCsvService();
        const hoje = new Date().toISOString().slice(0, 10);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="rifa-numeros-${hoje}.csv"`);
        // Dados pessoais: nunca em cache.
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(csv);
    } catch (error) { next(error); }
}
