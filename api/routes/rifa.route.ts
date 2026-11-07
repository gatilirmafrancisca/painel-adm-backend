import { Router } from 'express';
import * as rifaController from "../controllers/rifa.controller.js";
import verifyJWT from '../middlewares/jwt.token.middleware.js';

const router = Router();

router.get("/listar-rifas", verifyJWT, rifaController.listarRifasAdminController);
router.get("/resumo", verifyJWT, rifaController.resumoRifasAdminController);
router.patch("/pagamento/:paymentId/email", verifyJWT, rifaController.definirEmailPagamentoController);
router.post("/criar-rifa", verifyJWT, rifaController.criarRifaManualController);
// Compras com reserva da Ação de Natal
router.get("/pedidos", verifyJWT, rifaController.listarPedidosAdminController);
router.get("/alertas", verifyJWT, rifaController.alertasPedidosAdminController);
router.get("/exportar.csv", verifyJWT, rifaController.exportarCsvController);
router.delete("/excluir-rifa/:claimedNumber", verifyJWT, rifaController.excluirRifaController);

export default router;