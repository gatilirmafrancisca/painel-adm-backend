import express, {Request, Response} from "express"
import cors from "cors"
import dotenv from "dotenv"
import database from "./database/configdb.js"
import userRoute from "./routes/user.route.js";
import gatoRoute from "./routes/gato.route.js";
import financeiroRoute from "./routes/financeiro.route.js";
import protectedRoute from "./routes/protected.route.js";
import { errorHandler } from "./middlewares/errors.middleware.js";

dotenv.config();

// App
const app = express();

// Database
database.connect();

app.use(express.json());
app.use(cors());

/** routes **/ 

app.use("/protected", protectedRoute);
app.use("/auth", userRoute);
app.use("/gatos", gatoRoute);
app.use("/financeiro", financeiroRoute);

app.get("/", (req: Request, res: Response) => {
  res.send({ message: "App Working" });
});

app.use((req: Request, res: Response) => {
    res.status(404).json({ message: `Cannot ${req.method} ${req.path}` });
});

app.use(errorHandler);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`App is listening on http://localhost:${PORT}/`);
  });