import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import userRoute from "./routes/user.route.js";
import gatoRoute from "./routes/gato.route.js";
import financeiroRoute from "./routes/financeiro.route.js";
import protectedRoute from "./routes/protected.route.js";
import rifaRoute from "./routes/rifa.route.js";
import { errorHandler } from "./middlewares/errors.middleware.js";

/** App sem banco nem listen: os testes sobem só isto, com o Mongo em memória. */
export const app = express();

// Na Vercel a requisição chega via proxy: sem isso o rate limit do login
// trataria todo mundo como o mesmo IP.
app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(cors(
  { origin: process.env.FRONTEND_URL, credentials: true }
));

/** routes **/

app.use("/protected", protectedRoute);
app.use("/auth", userRoute);
app.use("/gatos", gatoRoute);
app.use("/financeiro", financeiroRoute);
app.use("/rifa", rifaRoute);

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "App Working" });
});

app.use((req: Request, res: Response) => {
    res.status(404).json({ message: `Cannot ${req.method} ${req.path}` });
});

app.use(errorHandler);
