import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../api/app.js";
import User from "../api/models/User.js";
import { getJwtSecret } from "../api/utils/jwtSecret.js";
import { segredoConfere } from "../api/middlewares/internalSecret.middleware.js";
import { criarUsuario, ipUnico } from "./helpers.js";

const novoUsuario = { login: "invasor", email: "invasor@teste.org", password: "Senha.Forte1", utype: "Admin" };

describe("cadastro de usuários do painel", () => {
    it("sem login, o cadastro é recusado e nenhum usuário é criado", async () => {
        const res = await request(app).post("/auth/register").send(novoUsuario);
        expect(res.status).toBe(401);
        expect(await User.countDocuments()).toBe(0);
    });

    it("um Voluntário não pode cadastrar usuários", async () => {
        const { token } = await criarUsuario("Voluntário");
        const res = await request(app).post("/auth/register").set("Authorization", `Bearer ${token}`).send(novoUsuario);
        expect(res.status).toBe(403);
        expect(await User.countDocuments({ login: "invasor" })).toBe(0);
    });

    it("um Admin logado cadastra um usuário", async () => {
        const { token } = await criarUsuario("Admin");
        const res = await request(app).post("/auth/register").set("Authorization", `Bearer ${token}`)
            .send({ ...novoUsuario, login: "voluntaria", email: "voluntaria@teste.org", utype: "Voluntário" });
        expect(res.status).toBe(201);
        expect(await User.countDocuments({ login: "voluntaria" })).toBe(1);
    });

    it("tipo de usuário fora da lista é recusado", async () => {
        const { token } = await criarUsuario("Admin");
        const res = await request(app).post("/auth/register").set("Authorization", `Bearer ${token}`)
            .send({ ...novoUsuario, utype: "SuperAdmin" });
        expect(res.status).toBe(400);
    });

    it("token de um usuário apagado não cadastra ninguém", async () => {
        const { token, user } = await criarUsuario("Admin");
        await User.deleteOne({ _id: user._id });
        const res = await request(app).post("/auth/register").set("Authorization", `Bearer ${token}`).send(novoUsuario);
        expect(res.status).toBe(403);
    });
});

describe("login", () => {
    it("usuário inexistente e senha errada têm a mesma resposta", async () => {
        const { login } = await criarUsuario();
        const inexistente = await request(app).post("/auth/login").set("X-Forwarded-For", ipUnico())
            .send({ login: "ninguem", password: "Qualquer.1" });
        const senhaErrada = await request(app).post("/auth/login").set("X-Forwarded-For", ipUnico())
            .send({ login, password: "Errada.123" });
        expect(inexistente.status).toBe(401);
        expect(senhaErrada.status).toBe(401);
        expect(inexistente.body.message).toBe(senhaErrada.body.message);
    });

    it("login certo devolve um token aceito pelas rotas protegidas", async () => {
        const { login, senha } = await criarUsuario();
        const res = await request(app).post("/auth/login").set("X-Forwarded-For", ipUnico()).send({ login, password: senha });
        expect(res.status).toBe(200);
        const rifas = await request(app).get("/rifa/listar-rifas").set("Authorization", `Bearer ${res.body.user.token}`);
        expect(rifas.status).toBe(200);
    });

    it("objeto no lugar do login (injeção NoSQL) é recusado", async () => {
        await criarUsuario();
        const res = await request(app).post("/auth/login").set("X-Forwarded-For", ipUnico())
            .send({ login: { $ne: null }, password: "Senha.Forte1" });
        expect(res.status).toBe(400);
    });

    it("depois de 10 tentativas erradas do mesmo IP, bloqueia", async () => {
        const { login } = await criarUsuario();
        const ip = ipUnico();
        for (let i = 0; i < 10; i++) {
            const r = await request(app).post("/auth/login").set("X-Forwarded-For", ip).send({ login, password: "Errada.123" });
            expect(r.status).toBe(401);
        }
        const bloqueado = await request(app).post("/auth/login").set("X-Forwarded-For", ip).send({ login, password: "Errada.123" });
        expect(bloqueado.status).toBe(429);
    });
});

describe("JWT", () => {
    it("token assinado com o antigo segredo padrão ('secret') é recusado", async () => {
        const { user } = await criarUsuario();
        const forjado = jwt.sign({ id: String(user._id) }, "secret");
        const res = await request(app).get("/rifa/listar-rifas").set("Authorization", `Bearer ${forjado}`);
        expect(res.status).toBe(401);
    });

    it("token sem assinatura (alg none) é recusado", async () => {
        const { user } = await criarUsuario();
        const semAssinatura = jwt.sign({ id: String(user._id) }, "", { algorithm: "none" });
        const res = await request(app).get("/rifa/resumo").set("Authorization", `Bearer ${semAssinatura}`);
        expect(res.status).toBe(401);
    });

    it("sem JWT_SECRET (ou curto), o servidor recusa subir", () => {
        const original = process.env.JWT_SECRET;
        try {
            delete process.env.JWT_SECRET;
            expect(() => getJwtSecret()).toThrow();
            process.env.JWT_SECRET = "curto";
            expect(() => getJwtSecret()).toThrow();
        } finally {
            process.env.JWT_SECRET = original;
        }
    });

    it("dados pessoais da rifa exigem login", async () => {
        expect((await request(app).get("/rifa/listar-rifas")).status).toBe(401);
        expect((await request(app).get("/rifa/resumo")).status).toBe(401);
    });
});

describe("segredo interno (backend da rifa → painel)", () => {
    it("compara o segredo corretamente", () => {
        expect(segredoConfere("abc", "abc")).toBe(true);
        expect(segredoConfere("abd", "abc")).toBe(false);
        expect(segredoConfere("", "abc")).toBe(false);
        expect(segredoConfere("abc", undefined)).toBe(false);
        expect(segredoConfere(["abc"], "abc")).toBe(false);
    });

    it("rota interna sem o segredo é recusada", async () => {
        const res = await request(app).post("/financeiro/interno/mercadopago").send({});
        expect(res.status).toBe(401);
    });
});

describe("headers de segurança", () => {
    it("o helmet está ativo", async () => {
        const res = await request(app).get("/");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("corpo JSON gigante é recusado", async () => {
        const res = await request(app).post("/auth/login").set("X-Forwarded-For", ipUnico())
            .set("Content-Type", "application/json").send(JSON.stringify({ login: "a".repeat(200_000), password: "x" }));
        expect(res.status).toBe(413);
    });
});
