import mongoose, { Model } from "mongoose";
import * as RifaTypes from "../types/rifa.types.js";
import { getRifaConnection } from "../database/rifadb.js";

/**
 * Compra com reserva da Ação de Natal, gravada pelo backend da rifa
 * (gatil-mercadopago-backend: api/models/Pedido.ts). O painel só lê; quem cria
 * e mantém os índices é o backend da rifa (conexão com autoIndex: false).
 */
export interface IPedido {
    _id: string;
    status: RifaTypes.StatusPedido;
    numeros: number[];
    numerosConfirmados: number[];
    numerosAEscolher: number;
    valor: number;
    expiraEm: Date;
    tentativas: number;
    pagamento: {
        mpPaymentId: string | null;
        preferenceId: string | null;
        metodo: "pix" | "cartao";
        expiraEm: Date;
        criadoEm: Date;
    } | null;
    pagoPor: string | null;
    pagoEm: Date | null;
    pagamentosExtras: { mpPaymentId: string; valor: number; em: Date }[];
    alertas: RifaTypes.AlertaPedido[];
    nome: string | null;
    email: string | null;
    phone: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    teste?: boolean;
    anonimizadoEm: Date | null;
    criadoEm: Date;
    atualizadoEm: Date;
}

// strict: false — o schema de verdade é o do backend da rifa; aqui só leitura.
const PedidoSchema = new mongoose.Schema<IPedido>({ _id: String }, { strict: false, versionKey: false });

let PedidoModel: Model<IPedido> | null = null;

export function getPedidoModel(): Model<IPedido> {
    if (PedidoModel) return PedidoModel;
    PedidoModel = getRifaConnection().model<IPedido>("Pedido", PedidoSchema, "pedidos");
    return PedidoModel;
}
