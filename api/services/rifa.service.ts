import { getRifaModel, IRifa } from "../models/Rifa.js";
import { getPedidoModel, type IPedido } from "../models/Pedido.js";
import * as RifaTypes from "../types/rifa.types.js";
import { ConflictError, MissingParamsError, NotFoundError } from "../utils/errors.js";
import type ResponseType from "../types/response.type.js";
import { Types, Document } from "mongoose";

const TOTAL_NUMEROS = 500;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


const localizarRifa = async(id?: string, filters: any = {}) : Promise<(IRifa & Document)[]> => {
    
    if (id) {

        if (!Types.ObjectId.isValid(id)) {
            return [];
        }

        const rifa = await getRifaModel().findOne({ _id: id, ...filters });
        return rifa ? [rifa] : [];
    }
    return await getRifaModel().find(filters);

}



function validarNome(value: unknown): string {
    const normalizado = String(value ?? "").trim();
    if (normalizado.length < 3) {
        throw new MissingParamsError("O campo 'Nome' precisa ter pelo menos 3 caracteres.");
    }
    return normalizado;
}

function validarTelefone(value: unknown): string {
    const normalizado = String(value ?? "").trim();
    const digitos = normalizado.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 13) {
        throw new MissingParamsError("O campo 'Telefone' deve ser um telefone válido, com DDD.");
    }
    return normalizado;
}

function validarEmailOpcional(value: unknown, numeroFormatado: string): string {
    const normalizado = String(value ?? "").trim().toLowerCase();
    if (!normalizado) {
        // Sem e-mail informado — placeholder rastreável, igual à migração da planilha.
        return `manual+n${numeroFormatado}@gatilirmafrancisca.org`;
    }
    if (!EMAIL_REGEX.test(normalizado)) {
        throw new MissingParamsError("O campo 'E-mail' não parece válido.");
    }
    return normalizado;
}

function validarNumero(value: unknown): number {
    const numero = Number(value);
    if (!Number.isInteger(numero) || numero < 1 || numero > TOTAL_NUMEROS) {
        throw new MissingParamsError(
            `O campo 'Número' deve ser um inteiro entre 1 e ${TOTAL_NUMEROS}.`
        );
    }
    return numero;
}


export const listarRifasAdminService = async (): Promise<ResponseType> => {
    try {
        // Números de Pix de teste (R$ 0,01) não são vendas.
        // Reserva vencida (o backend da rifa apaga em seguida) não aparece.
        const rifas = await getRifaModel()
            .find({
                claimedNumber: { $ne: null },
                teste: { $ne: true },
                $nor: [{ status: "RESERVADO", reservaExpiraEm: { $lte: new Date() } }],
            })
            .select("name phone email claimedNumber status paymentId pedidoId metodoPagamento dataPagamento reservaExpiraEm")
            .sort({ claimedNumber: 1 })
            .lean();

        return { status: 200, message: "Rifas encontradas.", data: rifas };
    } catch (error: any) {
        console.error("listarRifasAdminService error:", error);
        throw error;
    }
};

/** Mesmo prazo do backend da rifa (lembretes.service.ts). */
const PRAZO_ESCOLHA_DIAS = 20;
const DIA_MS = 24 * 60 * 60_000;

interface ItemResumo {
    paymentId: string;
    email: string | null;
    aprovadoEm?: Date | null;
    nomePagador?: string | null;
    bancoPagador?: string | null;
    metodoPagamento?: string | null;
    dataPagamento?: Date | null;
    _id: Types.ObjectId;
}

interface ContatoItem {
    paymentId: string;
    email: string | null;
    /** Nome de quem pagou (pagador ou titular do cartão), para quando não há e-mail. */
    nomePagador: string | null;
    /** Banco de origem do Pix — ajuda a achar o pagamento no extrato. */
    bancoPagador: string | null;
    /** pix, cartao ou o tipo informado pelo Mercado Pago. */
    metodoPagamento: string | null;
    /** Link para escolher o número (precisa de RIFA_SITE_URL). */
    linkEscolha: string | null;
}

/** Link da escolha do número no site da rifa — o mesmo dos e-mails de lembrete. */
const linkEscolha = (paymentId: string): string | null => {
    const site = process.env.RIFA_SITE_URL?.replace(/\/+$/, "");
    return site ? `${site}/rifa/pagamento-aprovado?payment_id=${encodeURIComponent(paymentId)}` : null;
};

const contatoDoItem = (item: ItemResumo): ContatoItem => ({
    paymentId: item.paymentId,
    email: item.email ?? null,
    nomePagador: item.nomePagador ?? null,
    bancoPagador: item.bancoPagador ?? null,
    metodoPagamento: item.metodoPagamento ?? null,
    linkEscolha: item.paymentId.startsWith("MANUAL-") ? null : linkEscolha(item.paymentId),
});

export interface PendenteEscolha extends ContatoItem {
    /** Data do pagamento no Mercado Pago (ou, sem ela, da aprovação/registro). */
    pagoEm: string;
    /** Dias até o número ser sorteado; 0 = sorteio na próxima execução. */
    diasRestantes: number;
}

export interface Reserva extends ContatoItem {
    /** Quando o Pix foi gerado (data de criação do registro). */
    criadoEm: string;
    /** Compra com reserva: o pedido, os números guardados e até quando. */
    pedidoId?: string;
    numeros?: number[];
    expiraEm?: string;
    nome?: string | null;
}

export interface ResumoRifas {
    total: number;
    compradas: number;
    pendentesEscolha: number;
    reservadas: number;
    disponiveis: number;
    listas: { pendentesEscolha: PendenteEscolha[]; reservadas: Reserva[] };
}

/**
 * Situação das vagas da rifa, na mesma conta que o site usa para bloquear a
 * venda (haNumerosDisponiveis no backend da rifa):
 * - compradas: APROVADO com número (site + cadastro manual);
 * - pendentesEscolha: APROVADO, pagou e ainda não escolheu o número;
 * - reservadas: PENDENTE, Pix gerado e ainda não pago — ocupa vaga até vencer;
 * - disponiveis: o resto. CANCELADO e Pix de teste ficam de fora.
 */
export const resumoRifasAdminService = async (): Promise<ResponseType> => {
    try {
        const campos = {
            paymentId: 1, email: 1, aprovadoEm: 1, nomePagador: 1, bancoPagador: 1, metodoPagamento: 1, dataPagamento: 1,
        };
        const agoraData = new Date();
        const [resultado] = await getRifaModel().aggregate<{
            compradas: { n: number }[];
            pendentesEscolha: ItemResumo[];
            reservadas: ItemResumo[];
            reservasAtivas: { _id: string; numeros: number[]; expiraEm: Date }[];
        }>([
            { $match: { teste: { $ne: true }, status: { $ne: "CANCELADO" } } },
            { $sort: { _id: 1 } },
            {
                $facet: {
                    compradas: [
                        { $match: { status: "APROVADO", claimedNumber: { $type: "number" } } },
                        { $count: "n" },
                    ],
                    pendentesEscolha: [
                        { $match: { status: "APROVADO", claimedNumber: null } },
                        { $project: campos },
                    ],
                    reservadas: [
                        { $match: { status: "PENDENTE" } },
                        { $project: campos },
                    ],
                    // Números guardados por uma compra do site, ainda dentro do prazo.
                    reservasAtivas: [
                        { $match: { status: "RESERVADO", reservaExpiraEm: { $gt: agoraData } } },
                        { $sort: { claimedNumber: 1 } },
                        { $group: { _id: "$pedidoId", numeros: { $push: "$claimedNumber" }, expiraEm: { $max: "$reservaExpiraEm" } } },
                    ],
                },
            },
        ]);

        const agora = Date.now();
        const pendentesEscolha: PendenteEscolha[] = (resultado?.pendentesEscolha ?? [])
            .map((item) => {
                // O prazo conta de aprovadoEm (como no backend da rifa); a data
                // mostrada é a do pagamento, para achar no extrato.
                const inicioPrazo = item.aprovadoEm ? new Date(item.aprovadoEm) : item._id.getTimestamp();
                const pagoEm = item.dataPagamento ? new Date(item.dataPagamento) : inicioPrazo;
                const prazo = inicioPrazo.getTime() + PRAZO_ESCOLHA_DIAS * DIA_MS;
                return {
                    ...contatoDoItem(item),
                    pagoEm: pagoEm.toISOString(),
                    diasRestantes: Math.max(0, Math.ceil((prazo - agora) / DIA_MS)),
                };
            })
            .sort((a, b) => a.pagoEm.localeCompare(b.pagoEm));

        const reservadasAntigas: Reserva[] = (resultado?.reservadas ?? []).map((item) => ({
            ...contatoDoItem(item),
            criadoEm: item._id.getTimestamp().toISOString(),
        }));

        const ativas = resultado?.reservasAtivas ?? [];
        const pedidos = ativas.length
            ? await getPedidoModel()
                .find({ _id: { $in: ativas.map((a) => a._id) } }, { nome: 1, email: 1, criadoEm: 1, pagamento: 1 })
                .lean()
            : [];
        const pedidoPorId = new Map(pedidos.map((p) => [String(p._id), p]));
        const reservasDeCompras: Reserva[] = ativas.map((a) => {
            const pedido = pedidoPorId.get(String(a._id));
            return {
                paymentId: pedido?.pagamento?.mpPaymentId ?? String(a._id),
                email: pedido?.email ?? null,
                nomePagador: null,
                bancoPagador: null,
                metodoPagamento: pedido?.pagamento?.metodo ?? null,
                linkEscolha: null,
                criadoEm: (pedido?.criadoEm ?? agoraData).toISOString(),
                pedidoId: String(a._id),
                numeros: a.numeros,
                expiraEm: new Date(a.expiraEm).toISOString(),
                nome: pedido?.nome ?? null,
            };
        });
        const reservadas = [...reservasDeCompras, ...reservadasAntigas];
        const vagasReservadas = reservadasAntigas.length + ativas.reduce((t, a) => t + a.numeros.length, 0);

        const compradas = resultado?.compradas[0]?.n ?? 0;
        const ocupadas = compradas + pendentesEscolha.length + vagasReservadas;

        const resumo: ResumoRifas = {
            total: TOTAL_NUMEROS,
            compradas,
            pendentesEscolha: pendentesEscolha.length,
            reservadas: vagasReservadas,
            disponiveis: Math.max(0, TOTAL_NUMEROS - ocupadas),
            listas: { pendentesEscolha, reservadas },
        };

        return { status: 200, message: "Resumo da rifa.", data: resumo };
    } catch (error: any) {
        console.error("resumoRifasAdminService error:", error);
        throw error;
    }
};

/**
 * Informa à mão o e-mail de um pagamento que ficou sem (o Mercado Pago não
 * devolveu). A partir daí o backend da rifa manda os lembretes de escolha do
 * número para ele. Pagamento cancelado não recebe e-mail.
 */
export const definirEmailPagamentoService = async (
    paymentId: unknown,
    email: unknown
): Promise<ResponseType> => {
    try {
        const id = String(paymentId ?? "").trim();
        if (!id) throw new MissingParamsError("Informe o pagamento.");

        const normalizado = String(email ?? "").trim().toLowerCase();
        if (!EMAIL_REGEX.test(normalizado)) {
            throw new MissingParamsError("O campo 'E-mail' não parece válido.");
        }

        const rifa = await getRifaModel().findOneAndUpdate(
            { paymentId: id, status: { $ne: "CANCELADO" } },
            { $set: { email: normalizado } },
            { new: true }
        ).select("paymentId email status claimedNumber").lean();

        if (!rifa) throw new NotFoundError("Pagamento não encontrado (ou cancelado).");

        return { status: 200, message: "E-mail atualizado.", data: rifa };
    } catch (error: any) {
        console.error("definirEmailPagamentoService error:", error);
        throw error;
    }
};

export interface CadastroManualInput {
    name: string;
    phone: string;
    email?: string;
    claimedNumber: number;
}


export const criarRifaManualService = async (
    data: CadastroManualInput
): Promise<ResponseType> => {
    try {
        const numero = validarNumero(data.claimedNumber);
        const numeroFormatado = String(numero).padStart(3, "0");

        const nome = validarNome(data.name);
        const telefone = validarTelefone(data.phone);
        const email = validarEmailOpcional(data.email, numeroFormatado);

        const rifa = await getRifaModel().create({
 
            paymentId: `MANUAL-${numeroFormatado}`,
            status: "APROVADO",
            amount: 100,
            name: nome,
            phone: telefone,
            email,
            claimedNumber: numero,
        });

        return {
            status: 201,
            message: "Número cadastrado manualmente.",
            data: { id: rifa._id, claimedNumber: rifa.claimedNumber },
        };
    } catch (error: any) {
        if (error?.code === 11000) {
            throw new ConflictError("Esse número já foi vendido — confira antes de cadastrar de novo.");
        }
        console.error("criarRifaManualService error:", error);
        throw error;
    }
};


export const excluirRifaService = async (claimedNumber: unknown, forcar = false): Promise<ResponseType> => {
    try {
        const numero = validarNumero(claimedNumber);

        // Número de uma compra do site: apagar sem querer tira o número de quem
        // pagou. Reservado: a pessoa está pagando agora.
        const atual = await getRifaModel().findOne({ claimedNumber: numero, teste: { $ne: true } }).lean();
        if (atual?.status === "RESERVADO") {
            throw new ConflictError("Esse número está reservado por alguém que está pagando agora. Aguarde a reserva terminar.");
        }
        if (atual?.pedidoId && !forcar) {
            throw new ConflictError("Esse número foi comprado pelo site. Para excluir mesmo assim, confirme a exclusão.");
        }

        const resultado = await getRifaModel().findOneAndDelete({ claimedNumber: numero, teste: { $ne: true } });
 
        if (!resultado) {
            throw new NotFoundError(`Nenhum registro encontrado com o número ${numero}.`);
        }
 
        return { status: 200, message: "Registro removido.", data: { claimedNumber: numero } };
    } catch (error: any) {
        console.error("excluirRifaService error:", error);
        throw error;
    }
};

// ---------- Compras com reserva (Ação de Natal) ----------

const ABERTOS: RifaTypes.StatusPedido[] = ["RESERVADO", "AGUARDANDO_PAGAMENTO"];

/** Escapa o texto da busca: ele vira regex, e regex vinda do navegador não pode ser executada. */
const escaparRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface PedidoAdmin {
    pedidoId: string;
    status: RifaTypes.StatusPedido;
    numeros: number[];
    numerosConfirmados: number[];
    numerosAEscolher: number;
    valor: number;
    metodo: "pix" | "cartao" | null;
    mpPaymentId: string | null;
    nome: string | null;
    email: string | null;
    phone: string | null;
    criadoEm: string;
    expiraEm: string;
    pagoEm: string | null;
    alertas: RifaTypes.AlertaPedido[];
    pagamentosExtras: { mpPaymentId: string; valor: number; em: string }[];
    utmSource: string | null;
}

function pedidoAdmin(p: IPedido, agora = Date.now()): PedidoAdmin {
    const vencido = ABERTOS.includes(p.status) && new Date(p.expiraEm).getTime() <= agora;
    return {
        pedidoId: String(p._id),
        status: vencido ? "EXPIRADO" : p.status,
        numeros: p.numeros ?? [],
        numerosConfirmados: p.numerosConfirmados ?? [],
        numerosAEscolher: p.numerosAEscolher ?? 0,
        valor: p.valor ?? 0,
        metodo: p.pagamento?.metodo ?? null,
        mpPaymentId: p.pagoPor ?? p.pagamento?.mpPaymentId ?? null,
        nome: p.nome ?? null,
        email: p.email ?? null,
        phone: p.phone ?? null,
        criadoEm: new Date(p.criadoEm).toISOString(),
        expiraEm: new Date(p.expiraEm).toISOString(),
        pagoEm: p.pagoEm ? new Date(p.pagoEm).toISOString() : null,
        alertas: p.alertas ?? [],
        pagamentosExtras: (p.pagamentosExtras ?? []).map((e) => ({ ...e, em: new Date(e.em).toISOString() })),
        utmSource: p.utmSource ?? null,
    };
}

const CAMPOS_PEDIDO = { ipHash: 0, "pagamento.qrCode": 0, "pagamento.qrCodeBase64": 0, "pagamento.initPoint": 0 } as const;

/**
 * Compras da Ação de Natal, das mais novas para as mais antigas. status filtra
 * (um dos STATUSPEDIDO); busca procura por número, nome, e-mail ou WhatsApp.
 */
export const listarPedidosAdminService = async (
    { status, busca }: { status?: unknown; busca?: unknown }
): Promise<ResponseType> => {
    const filtro: Record<string, unknown> = { teste: { $ne: true } };
    const agora = new Date();

    if (status !== undefined && status !== "") {
        if (typeof status !== "string" || !RifaTypes.STATUSPEDIDO.includes(status as RifaTypes.StatusPedido)) {
            throw new MissingParamsError(`Status inválido. Valores: ${RifaTypes.STATUSPEDIDO.join(", ")}.`);
        }
        if (status === "EXPIRADO") {
            filtro.$or = [{ status: "EXPIRADO" }, { status: { $in: ABERTOS }, expiraEm: { $lte: agora } }];
        } else if (ABERTOS.includes(status as RifaTypes.StatusPedido)) {
            filtro.status = status;
            filtro.expiraEm = { $gt: agora };
        } else {
            filtro.status = status;
        }
    }

    if (busca !== undefined && busca !== "") {
        if (typeof busca !== "string" || busca.length > 100) throw new MissingParamsError("Busca inválida.");
        const termo = busca.trim();
        const digitos = termo.replace(/\D/g, "");
        const ou: Record<string, unknown>[] = [
            { nome: { $regex: escaparRegex(termo), $options: "i" } },
            { email: { $regex: escaparRegex(termo), $options: "i" } },
        ];
        if (/^\d{1,3}$/.test(termo)) ou.push({ numeros: Number(termo) }, { numerosConfirmados: Number(termo) });
        if (digitos.length >= 4) ou.push({ phone: { $regex: escaparRegex(digitos) } });
        filtro.$and = [...((filtro.$and as unknown[]) ?? []), { $or: ou }];
    }

    const pedidos = await getPedidoModel()
        .find(filtro, CAMPOS_PEDIDO)
        .sort({ criadoEm: -1 })
        .limit(500)
        .lean();

    return { status: 200, message: "Compras.", data: pedidos.map((p) => pedidoAdmin(p)) };
};

/**
 * O que precisa de alguém olhar: pagamento em dobro (estornar), valor pago
 * diferente do pedido, pago depois de a reserva vencer e números que a pessoa
 * ainda vai escolher.
 */
export const alertasPedidosAdminService = async (): Promise<ResponseType> => {
    const pedidos = await getPedidoModel()
        .find(
            { teste: { $ne: true }, $or: [{ "alertas.0": { $exists: true } }, { status: "PAGO_PARCIAL" }] },
            CAMPOS_PEDIDO
        )
        .sort({ atualizadoEm: -1 })
        .limit(200)
        .lean();
    return { status: 200, message: "Alertas.", data: pedidos.map((p) => pedidoAdmin(p)) };
};

/** Célula de CSV segura: aspas escapadas e fórmulas neutralizadas (=, +, -, @ no começo). */
export function celulaCsv(valor: unknown): string {
    let texto = valor === null || valor === undefined ? "" : String(valor);
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
}

/** Planilha dos números vendidos (para o sorteio e a prestação de contas). */
export const exportarCsvService = async (): Promise<string> => {
    const rifas = await getRifaModel()
        .find({ status: "APROVADO", claimedNumber: { $ne: null }, teste: { $ne: true } })
        .select("claimedNumber name email phone metodoPagamento dataPagamento paymentId pedidoId mpPaymentId")
        .sort({ claimedNumber: 1 })
        .lean();

    const cabecalho = ["Número", "Nome", "E-mail", "WhatsApp", "Pagamento", "Pago em", "ID do pagamento", "Compra"];
    const linhas = rifas.map((r) => [
        String(r.claimedNumber).padStart(3, "0"),
        r.name,
        r.email,
        r.phone,
        r.metodoPagamento === "pix" ? "Pix" : r.metodoPagamento === "cartao" ? "Cartão" : (r.metodoPagamento ?? (String(r.paymentId).startsWith("MANUAL-") ? "Manual" : "")),
        r.dataPagamento ? new Date(r.dataPagamento).toISOString() : "",
        r.mpPaymentId ?? (String(r.paymentId).startsWith("PEDIDO-") ? "" : r.paymentId),
        r.pedidoId ?? "",
    ].map(celulaCsv).join(";"));

    // BOM: o Excel abre os acentos certo.
    return "\uFEFF" + [cabecalho.map(celulaCsv).join(";"), ...linhas].join("\r\n") + "\r\n";
};
