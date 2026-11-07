import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { getJwtSecret, JWT_ALGORITMO } from "../utils/jwtSecret.js";


const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  let segredo: string;
  try {
    segredo = getJwtSecret();
  } catch (err) {
    console.error("[jwt] servidor sem JWT_SECRET válido", err);
    return res.status(500).json({ message: "Internal Server Error." });
  }

  jwt.verify(token, segredo, { algorithms: [JWT_ALGORITMO] }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid token." });
    }

    const id = decoded && typeof decoded !== "string" ? (decoded as JwtPayload & { id?: unknown }).id : undefined;
    if (typeof id !== "string" || !id) {
      return res.status(401).json({ message: "Invalid token payload." });
    }

    req.user = { id };

    next();
  });
};

export default verifyJWT;
