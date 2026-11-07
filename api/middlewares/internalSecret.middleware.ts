import { type NextFunction, type Request, type Response } from "express";
import { createHash, timingSafeEqual } from "node:crypto";

/** Compara em tempo constante (hash dos dois lados: timingSafeEqual exige o mesmo tamanho). */
export const segredoConfere = (recebido: unknown, esperado: string | undefined): boolean => {
	if (!esperado || typeof recebido !== "string" || !recebido) return false;
	const a = createHash("sha256").update(recebido).digest();
	const b = createHash("sha256").update(esperado).digest();
	return timingSafeEqual(a, b);
};

const internalSecret = (req: Request, res: Response, next: NextFunction) => {
	const receivedSecret = req.header("x-internal-secret");
	const expectedSecret = process.env.MERCADOPAGO_BACKEND_INTERNAL_SECRET;

	if (!segredoConfere(receivedSecret, expectedSecret)) {
		console.error("[internal-secret] chamada recusada", {
			configured: Boolean(expectedSecret),
			received: Boolean(receivedSecret),
		});
		return res.status(401).json({ message: "Unauthorized." });
	}

	next();
};

export default internalSecret;
