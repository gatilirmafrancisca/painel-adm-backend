import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../api/app.js";
import { getRifaModel } from "../api/models/Rifa.js";
import { getPedidoModel } from "../api/models/Pedido.js";
import { celulaCsv } from "../api/services/rifa.service.js";
import { criarUsuario } from "./helpers.js";

const MIN = 60_000;
let token: string;

const rifa = (dados: Record<string, unknown>) => getRifaModel().collection.insertOne({ amount: 100, ...dados } as any);
const pedido = (dados: Record<string, unknown>) =>
    getPedidoModel().collection.insertOne({
        numeros: [], numerosConfirmados: [], numerosAEscolher: 0, valor: 0, alertas: [], pagamentosExtras: [],
        criadoEm: new Date(), atualizadoEm: new Date(), expiraEm: new Date(Date.now() + 10 * MIN), ...dados,
    } as any);

const get = (caminho: string) => request(app).get(caminho).set("Authorization", `Bearer ${token}`);

beforeEach(async () => {
    ({ token } = await criarUsuario("Admin"));
});

describe("resumo das vagas com compras do site", () => {
    it("conta as reservas ativas, ignora as vencidas e mostra os números da compra", async () => {
        const futuro = new Date(Date.now() + 10 * MIN);
        const passado = new Date(Date.now() - MIN);
        await pedido({ _id: "pedido-ativo", status: "AGUARDANDO_PAGAMENTO", numeros: [10, 11], valor: 200, email: "ana@email.com", nome: "Ana", pagamento: { metodo: "pix", mpPaymentId: "880001", expiraEm: futuro, criadoEm: new Date() } });
        await rifa({ paymentId: "PEDIDO-pedido-ativo-010", status: "RESERVADO", claimedNumber: 10, pedidoId: "pedido-ativo", reservaExpiraEm: futuro });
        await rifa({ paymentId: "PEDIDO-pedido-ativo-011", status: "RESERVADO", claimedNumber: 11, pedidoId: "pedido-ativo", reservaExpiraEm: futuro });
        await rifa({ paymentId: "PEDIDO-velho-012", status: "RESERVADO", claimedNumber: 12, pedidoId: "velho", reservaExpiraEm: passado });
        await rifa({ paymentId: "PEDIDO-pago-020", status: "APROVADO", claimedNumber: 20, pedidoId: "pago" });
        await rifa({ paymentId: "PEDIDO-pago-021", status: "APROVADO", claimedNumber: null, pedidoId: "pago", email: "bia@email.com" });
        await rifa({ paymentId: "777", status: "PENDENTE", claimedNumber: null });

        const res = await get("/rifa/resumo");
        expect(res.status).toBe(200);
        const r = res.body.data;
        expect(r.compradas).toBe(1);
        expect(r.pendentesEscolha).toBe(1);
        expect(r.reservadas).toBe(3); // 2 números da compra ativa + 1 Pix antigo
        expect(r.disponiveis).toBe(500 - 1 - 1 - 3);
        const compra = r.listas.reservadas.find((x: any) => x.pedidoId === "pedido-ativo");
        expect(compra.numeros).toEqual([10, 11]);
        expect(compra.email).toBe("ana@email.com");
        expect(compra.metodoPagamento).toBe("pix");
        // O número que se perdeu tem link para escolher (fluxo antigo)
        expect(r.listas.pendentesEscolha[0].linkEscolha).toContain("PEDIDO-pago-021");
    });

    it("a lista de números não mostra reserva vencida", async () => {
        await rifa({ paymentId: "PEDIDO-x-030", status: "RESERVADO", claimedNumber: 30, pedidoId: "x", reservaExpiraEm: new Date(Date.now() - MIN) });
        await rifa({ paymentId: "PEDIDO-y-031", status: "RESERVADO", claimedNumber: 31, pedidoId: "y", reservaExpiraEm: new Date(Date.now() + MIN) });
        const res = await get("/rifa/listar-rifas");
        expect(res.body.data.map((d: any) => d.claimedNumber)).toEqual([31]);
    });
});

describe("compras (GET /rifa/pedidos)", () => {
    beforeEach(async () => {
        await pedido({ _id: "p1", status: "PAGO", numeros: [5, 6], numerosConfirmados: [5, 6], valor: 200, nome: "Ana Souza", email: "ana@email.com", phone: "71999998888", ipHash: "segredo", pagoPor: "880010" });
        await pedido({ _id: "p2", status: "AGUARDANDO_PAGAMENTO", numeros: [7], valor: 100, nome: "Bruno", email: "bruno@email.com", expiraEm: new Date(Date.now() - MIN) });
        await pedido({ _id: "p3", status: "PAGO", numeros: [8], valor: 0.01, teste: true, nome: "Teste" });
    });

    it("exige login", async () => {
        expect((await request(app).get("/rifa/pedidos")).status).toBe(401);
    });

    it("lista sem o hash do IP e sem os pedidos de teste; reserva vencida aparece como EXPIRADO", async () => {
        const res = await get("/rifa/pedidos");
        expect(res.status).toBe(200);
        const ids = res.body.data.map((p: any) => p.pedidoId);
        expect(ids.sort()).toEqual(["p1", "p2"]);
        expect(JSON.stringify(res.body)).not.toContain("segredo");
        expect(res.body.data.find((p: any) => p.pedidoId === "p2").status).toBe("EXPIRADO");
        expect(res.body.data.find((p: any) => p.pedidoId === "p1").mpPaymentId).toBe("880010");
    });

    it("filtra por status e busca por número, nome, e-mail e WhatsApp", async () => {
        expect((await get("/rifa/pedidos?status=EXPIRADO")).body.data.map((p: any) => p.pedidoId)).toEqual(["p2"]);
        expect((await get("/rifa/pedidos?busca=6")).body.data.map((p: any) => p.pedidoId)).toEqual(["p1"]);
        expect((await get("/rifa/pedidos?busca=souza")).body.data.map((p: any) => p.pedidoId)).toEqual(["p1"]);
        expect((await get("/rifa/pedidos?busca=bruno%40")).body.data.map((p: any) => p.pedidoId)).toEqual(["p2"]);
        expect((await get("/rifa/pedidos?busca=99999-8888")).body.data.map((p: any) => p.pedidoId)).toEqual(["p1"]);
    });

    it("busca com caracteres de regex não quebra nem vira expressão", async () => {
        const res = await get(`/rifa/pedidos?busca=${encodeURIComponent(".*")}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });

    it("status inválido e busca que não é texto são recusados", async () => {
        expect((await get("/rifa/pedidos?status=QUALQUER")).status).toBe(400);
        // Parâmetro repetido vira array: não é texto, é recusado.
        expect((await get("/rifa/pedidos?busca=a&busca=b")).status).toBe(400);
        // O parser de query do Express 5 não monta objetos: busca[$ne] nem chega como busca.
        expect((await get("/rifa/pedidos?busca[$ne]=x")).body.data).toHaveLength(2);
    });
});

describe("alertas (GET /rifa/alertas)", () => {
    it("mostra pagamento em dobro, valor divergente e números a escolher", async () => {
        await pedido({ _id: "dobro", status: "PAGO", alertas: ["PAGAMENTO_DUPLICADO"], pagamentosExtras: [{ mpPaymentId: "999", valor: 100, em: new Date() }] });
        await pedido({ _id: "parcial", status: "PAGO_PARCIAL", numerosAEscolher: 1 });
        await pedido({ _id: "normal", status: "PAGO" });
        const res = await get("/rifa/alertas");
        expect(res.status).toBe(200);
        expect(res.body.data.map((p: any) => p.pedidoId).sort()).toEqual(["dobro", "parcial"]);
        const dobro = res.body.data.find((p: any) => p.pedidoId === "dobro");
        expect(dobro.pagamentosExtras[0].mpPaymentId).toBe("999");
    });
});

describe("planilha (GET /rifa/exportar.csv)", () => {
    it("exige login", async () => {
        expect((await request(app).get("/rifa/exportar.csv")).status).toBe(401);
    });

    it("traz os números vendidos, sem cache e com fórmulas neutralizadas", async () => {
        await rifa({ paymentId: "PEDIDO-a-005", status: "APROVADO", claimedNumber: 5, name: "=HYPERLINK(\"x\")", email: "ana@email.com", phone: "71999998888", metodoPagamento: "pix", mpPaymentId: "880020", pedidoId: "a" });
        await rifa({ paymentId: "MANUAL-006", status: "APROVADO", claimedNumber: 6, name: "Manual" });
        await rifa({ paymentId: "PEDIDO-b-007", status: "RESERVADO", claimedNumber: 7, pedidoId: "b", reservaExpiraEm: new Date(Date.now() + MIN) });
        await rifa({ paymentId: "T-8", status: "APROVADO", claimedNumber: 8, teste: true });

        const res = await get("/rifa/exportar.csv");
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/csv");
        expect(res.headers["cache-control"]).toBe("no-store");
        const linhas = res.text.replace(/^﻿/, "").trim().split("\r\n");
        expect(linhas).toHaveLength(3); // cabeçalho + 005 + 006 (reservado e teste ficam de fora)
        expect(linhas[1]).toContain('"005"');
        expect(linhas[1]).toContain(`"'=HYPERLINK(""x"")"`);
        expect(linhas[1]).toContain('"880020"');
        expect(linhas[2]).toContain('"Manual"');
    });

    it("celulaCsv neutraliza fórmulas e escapa aspas", () => {
        expect(celulaCsv("=1+1")).toBe(`"'=1+1"`);
        expect(celulaCsv("-2")).toBe(`"'-2"`);
        expect(celulaCsv("@SUM")).toBe(`"'@SUM"`);
        expect(celulaCsv('a "b"')).toBe('"a ""b"""');
        expect(celulaCsv(null)).toBe('""');
    });
});

describe("excluir número", () => {
    it("número reservado agora não pode ser excluído", async () => {
        await rifa({ paymentId: "PEDIDO-c-040", status: "RESERVADO", claimedNumber: 40, pedidoId: "c", reservaExpiraEm: new Date(Date.now() + MIN) });
        const res = await request(app).delete("/rifa/excluir-rifa/40").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(409);
    });

    it("número comprado pelo site só sai com confirmação", async () => {
        await rifa({ paymentId: "PEDIDO-d-041", status: "APROVADO", claimedNumber: 41, pedidoId: "d" });
        const sem = await request(app).delete("/rifa/excluir-rifa/41").set("Authorization", `Bearer ${token}`);
        expect(sem.status).toBe(409);
        const com = await request(app).delete("/rifa/excluir-rifa/41?forcar=1").set("Authorization", `Bearer ${token}`);
        expect(com.status).toBe(200);
    });

    it("cadastro manual continua saindo direto", async () => {
        await rifa({ paymentId: "MANUAL-042", status: "APROVADO", claimedNumber: 42 });
        const res = await request(app).delete("/rifa/excluir-rifa/42").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
    });
});
