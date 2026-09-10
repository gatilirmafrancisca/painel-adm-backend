import { Router } from 'express';
import * as rifaController from "../controllers/rifa.controller.js";
import verifyJWT from '../middlewares/jwt.token.middleware.js';

const router = Router();

router.get("/listar-rifas", verifyJWT, rifaController.listarRifasAdminController);
router.post("/criar-rifa", verifyJWT, rifaController.criarRifaManualController);
router.delete("/excluir-rifa/:claimedNumber", verifyJWT, rifaController.excluirRifaController);

export default router;