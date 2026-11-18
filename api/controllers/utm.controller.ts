import { type NextFunction, type Request, type Response } from "express";
import * as utmService from "../services/utm.service.js";
import type ResponseType from "../types/response.type.js";

const responder = (res: Response, r: ResponseType) => res.status(r.status).json({ message: r.message, data: r.data });

export const listar = async (req: Request, res: Response, next: NextFunction) => {
    try { responder(res, await utmService.listarUtmTags(req.query as Record<string, unknown>)); } catch (e) { next(e); }
};

export const buscar = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try { responder(res, await utmService.buscarUtmTag(req.params.id)); } catch (e) { next(e); }
};

export const criar = async (req: Request, res: Response, next: NextFunction) => {
    try { responder(res, await utmService.criarUtmTag(req.body ?? {})); } catch (e) { next(e); }
};

export const atualizar = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try { responder(res, await utmService.atualizarUtmTag(req.params.id, req.body ?? {})); } catch (e) { next(e); }
};

export const excluir = async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try { responder(res, await utmService.excluirUtmTag(req.params.id)); } catch (e) { next(e); }
};
