import { Request, Response, NextFunction } from "express";
import * as rifaService from "../services/rifa.service.js"

export const listarRifasAdminController = async(_req:Request , res: Response, next: NextFunction) => {

    try {

        const resposta = await rifaService.listarRifasAdminService();
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
        const resposta = await rifaService.excluirRifaService(claimedNumber);
        return res.status(resposta.status).json({ message: resposta.message, data: resposta.data }); 

    } catch (error) {next(error);}

}