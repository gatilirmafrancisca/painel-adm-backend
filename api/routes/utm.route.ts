import { Router } from "express";
import verifyJWT from "../middlewares/jwt.token.middleware.js";
import requireAdmin from "../middlewares/requireAdmin.middleware.js";
import * as utmController from "../controllers/utm.controller.js";

/**
 * Tags de UTM aceitas pelo site, pelo backend da rifa e pelo financeiro.
 * Qualquer usuário logado vê; só Admin cria, edita ou exclui.
 */
const router = Router();

router.get("/", verifyJWT, utmController.listar);
router.get("/:id", verifyJWT, utmController.buscar);
router.post("/", verifyJWT, requireAdmin, utmController.criar);
router.patch("/:id", verifyJWT, requireAdmin, utmController.atualizar);
router.delete("/:id", verifyJWT, requireAdmin, utmController.excluir);

export default router;
