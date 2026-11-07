import { afterAll, beforeAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { getRifaConnection } from "../api/database/rifadb.js";

process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
process.env.MERCADOPAGO_BACKEND_INTERNAL_SECRET = "segredo-interno-teste";
process.env.MONGODB_RIFA_NAME = "rifa_teste";
process.env.RIFA_SITE_URL = "https://rifa.teste";
// Só pra o módulo de upload carregar: os testes não sobem imagem.
process.env.CLOUDINARY_CLOUD_NAME ??= "teste";
process.env.CLOUDINARY_API_KEY ??= "teste";
process.env.CLOUDINARY_API_SECRET ??= "teste";

let mongod: MongoMemoryServer;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    await mongoose.connect(mongod.getUri(), { dbName: "painel_teste" });
});

beforeEach(async () => {
    // Banco limpo a cada teste (o do painel e o da rifa).
    await mongoose.connection.db?.dropDatabase();
    await getRifaConnection().asPromise();
    await getRifaConnection().db?.dropDatabase();
});

afterAll(async () => {
    await getRifaConnection().close().catch(() => undefined);
    await mongoose.disconnect();
    await mongod?.stop();
});
