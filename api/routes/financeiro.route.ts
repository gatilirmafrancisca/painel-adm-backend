import {Request, Response, Router } from 'express';
import verifyJWT from '../middlewares/jwt.token.middleware.js';
import * as financeiroController from "../controllers/financeiro.controller.js"

const router = Router();

router.post("/manual", verifyJWT, financeiroController.criarTransferencia);
router.get("/transferencias", verifyJWT, financeiroController.listarTransferencias);
router.patch("/:id", verifyJWT, financeiroController.patchTransferencia);
router.delete("/:id", verifyJWT, financeiroController.deletarTransferencia);

export default router;