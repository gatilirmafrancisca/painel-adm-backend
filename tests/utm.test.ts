import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../api/app.js";
import { getUtmTagModel } from "../api/models/UtmTag.js";
import { getRifaModel } from "../api/models/Rifa.js";
import Transferencia from "../api/models/Transferencia.js";
import { limparCacheUtm, semearUtmTags } from "../api/services/utm.service.js";
import { criarUsuario } from "./helpers.js";

let admin: string;
let comum: string;

const comToken = (token: string) => ({
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string, body: object) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
    patch: (url: string, body: object) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body),
    delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
});

const interno = () => ({
    sincronizar: (body: object) =>
        request(app).post("/financeiro/interno/mercadopago").set("x-internal-secret", process.env.MERCADOPAGO_BACKEND_INTERNAL_SECRET!).send(body),
    listar: (query: string) =>
        request(app).get(`/financeiro/interno/transferencias?${query}`).set("x-internal-secret", process.env.MERCADOPAGO_BACKEND_INTERNAL_SECRET!),
});

const pagamentoMP = (extra: object = {}) => ({
    mercadoPagoId: `mp-${Math.random().toString(36).slice(2)}`,
    valor: 50,
    status: "APROVADO",
    metodoPagamento: "MERCADO_PAGO",
    tipo: "ENTRADA",
    nomeDoador: "Ana",
    dataConfirmacao: new Date().toISOString(),
    utmSource: "", utmMedium: "", utmCampaign: "",
    ...extra,
});

const tagId = async (categoria: string, codigo: string) =>
    String((await getUtmTagModel().findOne({ categoria, codigo }).lean())!._id);

beforeEach(async () => {
    await getRifaModel().db.asPromise();
    await semearUtmTags();
    ({ token: admin } = await criarUsuario("Admin"));
    ({ token: comum } = await criarUsuario("Voluntário"));
});

describe("seed", () => {
    it("cria as 8 tags de antes, com RIFA_SOLIDARIA travada, e é idempotente", async () => {
        expect(await getUtmTagModel().countDocuments()).toBe(8);
        expect((await semearUtmTags()).criadas).toBe(0);
        const rifa = await getUtmTagModel().findOne({ codigo: "RIFA_SOLIDARIA" }).lean();
        expect(rifa?.sistema).toBe(true);
    });
});

describe("CRUD /utm", () => {
    it("lista com e sem filtro de categoria e exige login", async () => {
        expect((await request(app).get("/utm")).status).toBe(401);
        const todas = await comToken(comum).get("/utm");
        expect(todas.status).toBe(200);
        expect(todas.body.data).toHaveLength(8);
        const sources = await comToken(comum).get("/utm?categoria=SOURCE");
        expect(sources.body.data.map((t: any) => t.codigo).sort()).toEqual(["FACEBOOK", "FEIRA_ADOCAO", "INSTAGRAM", "LANDING_PAGE"]);
    });

    it("só Admin cria, edita ou exclui", async () => {
        const res = await comToken(comum).post("/utm", { categoria: "SOURCE", codigo: "TIKTOK", nome: "TikTok" });
        expect(res.status).toBe(403);
    });

    it("cria normalizando o código e recusa duplicado e código inválido", async () => {
        const res = await comToken(admin).post("/utm", { categoria: "source", codigo: " tiktok ", nome: "TikTok" });
        expect(res.status).toBe(201);
        expect(res.body.data).toMatchObject({ categoria: "SOURCE", codigo: "TIKTOK", ativo: true, sistema: false });

        expect((await comToken(admin).post("/utm", { categoria: "SOURCE", codigo: "TIKTOK", nome: "x" })).status).toBe(409);
        expect((await comToken(admin).post("/utm", { categoria: "SOURCE", codigo: "tik tok", nome: "x" })).status).toBe(400);
        expect((await comToken(admin).post("/utm", { categoria: "OUTRA", codigo: "X1", nome: "x" })).status).toBe(400);
        expect((await comToken(admin).post("/utm", { categoria: "SOURCE", codigo: "YOUTUBE" })).status).toBe(400);
        // mesmo código em outra categoria é permitido
        expect((await comToken(admin).post("/utm", { categoria: "CAMPAIGN", codigo: "TIKTOK", nome: "x" })).status).toBe(201);
    });

    it("edita nome, descrição e ativo, mas não o código", async () => {
        const id = await tagId("SOURCE", "FACEBOOK");
        const ok = await comToken(admin).patch(`/utm/${id}`, { nome: "Facebook Ads", ativo: false });
        expect(ok.status).toBe(200);
        expect(ok.body.data).toMatchObject({ nome: "Facebook Ads", ativo: false, codigo: "FACEBOOK" });
        expect((await comToken(admin).patch(`/utm/${id}`, { codigo: "META" })).status).toBe(400);
        expect((await comToken(admin).patch(`/utm/${id}`, { categoria: "MEDIUM" })).status).toBe(400);
    });

    it("a tag de sistema não pode ser desativada nem excluída", async () => {
        const id = await tagId("CAMPAIGN", "RIFA_SOLIDARIA");
        expect((await comToken(admin).patch(`/utm/${id}`, { ativo: false })).status).toBe(409);
        expect((await comToken(admin).delete(`/utm/${id}`)).status).toBe(409);
        expect((await comToken(admin).patch(`/utm/${id}`, { nome: "Rifa" })).status).toBe(200);
    });

    it("exclui tag nunca usada; tag usada no financeiro ou na rifa dá 409", async () => {
        const nova = await comToken(admin).post("/utm", { categoria: "SOURCE", codigo: "TIKTOK", nome: "TikTok" });
        expect((await comToken(admin).delete(`/utm/${nova.body.data.id}`)).status).toBe(200);
        expect(await getUtmTagModel().countDocuments({ codigo: "TIKTOK" })).toBe(0);

        await Transferencia.create(pagamentoMP({ utmSource: "INSTAGRAM" }));
        expect((await comToken(admin).delete(`/utm/${await tagId("SOURCE", "INSTAGRAM")}`)).status).toBe(409);

        await getRifaModel().collection.insertOne({ paymentId: "1", status: "APROVADO", amount: 10, utmMedium: "PAGO" } as any);
        expect((await comToken(admin).delete(`/utm/${await tagId("MEDIUM", "PAGO")}`)).status).toBe(409);
    });

    it("id inválido ou inexistente", async () => {
        expect((await comToken(admin).get("/utm/abc")).status).toBe(400);
        expect((await comToken(admin).get("/utm/0123456789abcdef01234567")).status).toBe(404);
    });
});

describe("financeiro com tags do banco", () => {
    it("cadastro manual aceita tag nova e recusa tag inativa ou desconhecida", async () => {
        await comToken(admin).post("/utm", { categoria: "SOURCE", codigo: "TIKTOK", nome: "TikTok" });
        const manual = (utmSource: string) => comToken(admin).post("/financeiro/manual", {
            valor: 10, tipo: "ENTRADA", metodoPagamento: "PIX", status: "APROVADO", nomeDoador: "Bia",
            dataConfirmacao: new Date().toISOString(), utmSource,
        });
        expect((await manual("TIKTOK")).status).toBe(201);
        expect((await manual("ORKUT")).status).toBe(400);

        await comToken(admin).patch(`/utm/${await tagId("SOURCE", "FACEBOOK")}`, { ativo: false });
        const inativa = await manual("FACEBOOK");
        expect(inativa.status).toBe(400);
        expect(inativa.body.message).toContain("UtmSource inválido 'FACEBOOK'");
    });

    it("tag criada direto no banco (outra instância) é aceita mesmo com cache já carregado", async () => {
        const manual = () => comToken(admin).post("/financeiro/manual", {
            valor: 10, tipo: "ENTRADA", metodoPagamento: "PIX", status: "APROVADO", nomeDoador: "Bia",
            dataConfirmacao: new Date().toISOString(), utmMedium: "INFLUENCER",
        });
        expect((await manual()).status).toBe(400); // carrega o cache sem a tag
        await getUtmTagModel().create({ categoria: "MEDIUM", codigo: "INFLUENCER", nome: "Influencer" });
        expect((await manual()).status).toBe(201);
    });

    it("sincronização do Mercado Pago nunca é recusada por UTM (tag desativada ou excluída no meio do Pix)", async () => {
        await comToken(admin).patch(`/utm/${await tagId("SOURCE", "FACEBOOK")}`, { ativo: false });
        const inativa = await interno().sincronizar(pagamentoMP({ utmSource: "FACEBOOK", utmMedium: "PAGO" }));
        expect(inativa.status).toBe(201);

        const desconhecida = await interno().sincronizar(pagamentoMP({ utmSource: "TAG_APAGADA" }));
        expect(desconhecida.status).toBe(201);

        const salvas = await Transferencia.find({}).lean();
        expect(salvas.map((t) => t.utmSource).sort()).toEqual(["FACEBOOK", "TAG_APAGADA"]);
    });

    it("pendente → aprovado continua atualizando a mesma transferência", async () => {
        const base = pagamentoMP({ status: "PENDENTE", utmSource: "INSTAGRAM", utmCampaign: "CAMPANHA_ESPECIFICA" });
        expect((await interno().sincronizar(base)).status).toBe(201);
        expect((await interno().sincronizar({ ...base, status: "APROVADO" })).status).toBe(200);
        const [t] = await Transferencia.find({}).lean();
        expect(t).toMatchObject({ status: "APROVADO", utmSource: "INSTAGRAM", utmCampaign: "CAMPANHA_ESPECIFICA" });
    });

    it("filtros: tag inativa ainda filtra, valor desconhecido é ignorado, e o total da landing exclui a rifa", async () => {
        await interno().sincronizar(pagamentoMP({ utmSource: "FACEBOOK", valor: 30 }));
        await interno().sincronizar(pagamentoMP({ utmSource: "INSTAGRAM", valor: 20 }));
        await interno().sincronizar(pagamentoMP({ utmCampaign: "RIFA_SOLIDARIA", valor: 100 }));
        await comToken(admin).patch(`/utm/${await tagId("SOURCE", "FACEBOOK")}`, { ativo: false });

        const fb = await comToken(admin).get("/financeiro/transferencias?utmSource=FACEBOOK");
        expect(fb.status).toBe(200);
        expect(fb.body.data.map((t: any) => t.utmSource)).toEqual(["FACEBOOK"]);

        const ignorado = await comToken(admin).get("/financeiro/transferencias?utmSource=ORKUT");
        expect(ignorado.body.data).toHaveLength(3);

        const agora = new Date(Date.now() - 3 * 3600_000);
        const total = await interno().listar(
            `categoria=DOACAO&status=APROVADO&metodoPagamento=MERCADO_PAGO&mes=${agora.getUTCMonth() + 1}&ano=${agora.getUTCFullYear()}&agregar=total`,
        );
        expect(total.status).toBe(200);
        expect(total.body.data.total).toBe(50);
    });

    it("antes do seed (coleção vazia) as tags de sempre continuam valendo", async () => {
        await getUtmTagModel().deleteMany({});
        limparCacheUtm();
        const res = await comToken(admin).post("/financeiro/manual", {
            valor: 10, tipo: "ENTRADA", metodoPagamento: "PIX", status: "APROVADO", nomeDoador: "Bia",
            dataConfirmacao: new Date().toISOString(), utmSource: "INSTAGRAM", utmMedium: "ORGANICO",
        });
        expect(res.status).toBe(201);
    });
});
