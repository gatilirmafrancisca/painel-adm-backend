import { type NextFunction, type Request, type Response } from "express";
import { Types } from "mongoose";
import User from "../models/User.js";

/**
 * Só deixa passar um usuário Admin que ainda existe no banco. Usado depois
 * do verifyJWT em rotas que mudam quem tem acesso ao painel.
 */
const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = (req.user as { id?: string } | undefined)?.id;
        if (!id || !Types.ObjectId.isValid(id)) {
            return res.status(401).json({ message: "Unauthorized." });
        }

        const usuario = await User.findById(id).select("utype").lean();
        if (!usuario || usuario.utype !== "Admin") {
            return res.status(403).json({ message: "Apenas administradores podem fazer isso." });
        }

        next();
    } catch (error) {
        next(error);
    }
};

export default requireAdmin;
