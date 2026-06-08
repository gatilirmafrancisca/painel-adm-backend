import { Request, Response } from "express";
import { registerService, loginService } from "../services/user.service.js";
import { IUser } from "../models/User.js";


export const registerController = async (req: Request<any, any, IUser>, res: Response) => {

    const resposta = await registerService(req.body);
    return res.status(resposta.status).json({ message: resposta.message, user: resposta.data });
    
};

export const loginController = async (req: Request<any, any, IUser>, res: Response) => {
    
    const resposta = await loginService(req.body);
    return res.status(resposta.status).json({ message: resposta.message, user: resposta.data });
    
};