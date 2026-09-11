import { type NextFunction, type Request, type Response } from "express";

const internalSecret = (req: Request, res: Response, next: NextFunction) => {
	const receivedSecret = req.header("x-internal-secret");
	const expectedSecret = process.env.MERCADOPAGO_BACKEND_INTERNAL_SECRET;

	if (!expectedSecret || receivedSecret !== expectedSecret) {
		console.error("[internal-secret] chamada recusada", {
			configured: Boolean(expectedSecret),
			received: Boolean(receivedSecret),
		});
		return res.status(401).json({ message: "Unauthorized." });
	}

	next();
};

export default internalSecret;
