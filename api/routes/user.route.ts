import { Router } from 'express';
import { rateLimit } from "express-rate-limit";
import { registerController, loginController } from "../controllers/user.controller.js";
import verifyJWT from "../middlewares/jwt.token.middleware.js";
import requireAdmin from "../middlewares/requireAdmin.middleware.js";

/** Contra força bruta: 10 tentativas erradas de login por IP a cada 15 minutos. */
export const criarLimiteLogin = () => rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { message: "Muitas tentativas de login. Aguarde 15 minutos e tente de novo." },
});

const router = Router();

// Cadastro de usuários do painel: só um Admin logado. O primeiro Admin é
// criado pelo script `npm run criar-admin`, nunca por uma rota pública.
router.post('/register', verifyJWT, requireAdmin, registerController);
router.post('/login', criarLimiteLogin(), loginController);

export default router;
