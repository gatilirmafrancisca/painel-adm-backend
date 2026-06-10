import {Request, Response, Router } from 'express';
import * as gatoController from "../controllers/gato.controller.js";
import verifyJWT from '../middlewares/jwt.token.middleware.js';
import { upload } from '../database/configupload.js';

const router = Router();

router.post("/", verifyJWT, upload.array('imagens', 10), gatoController.criarGato);
router.get("/", gatoController.listarGatos);
router.patch("/:id", verifyJWT, upload.array('imagens', 10), gatoController.patchGato);
router.delete("/:id", verifyJWT, gatoController.deletarGato);

export default router;