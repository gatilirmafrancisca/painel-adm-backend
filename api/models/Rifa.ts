import mongoose, { Schema, model, Model } from "mongoose";
import * as RifaTypes from "../types/rifa.types.js";
import { getRifaConnection } from "../database/rifadb.js";


export interface IRifa {
    paymentId: string;
    status: RifaTypes.StatusRifaType;
    amount: number;

    // Nulos até o participante confirmar o número.
    name: string | null;
    phone: string | null;
    email: string | null;

    claimedNumber: number | null;

    // Gravados pelo backend da rifa (gatil-mercadopago-backend):
    // início do prazo de escolha do número, lembretes já enviados e o
    // Pix de teste de R$ 0,01 (só existe quando true).
    aprovadoEm?: Date | null;
    lembretesEnviados?: number[];
    teste?: boolean;
}

const RifaSchema: Schema<IRifa> = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true },
    status: { type: String, enum: RifaTypes.STATUSRIFATYPE, required: true },
    amount: { type: Number, required: true },

    name: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },

    claimedNumber: { type: Number, default: null },

    aprovadoEm: { type: Date, default: null },
    lembretesEnviados: { type: [Number], default: undefined },
    // Sem default: o índice único do número no backend da rifa conta com
    // registros reais sem esse campo.
    teste: { type: Boolean },
});

// Só documentação: a conexão usa autoIndex: false (database/rifadb.ts), e
// quem cria/troca os índices é o backend da rifa (npm run migrate:indices).
RifaSchema.index(
    { claimedNumber: 1 },
    { unique: true, partialFilterExpression: { claimedNumber: { $type: "number" } } }
);

let RifaModel: Model<IRifa> | null = null;

export function getRifaModel(): Model<IRifa> {

    if (RifaModel) return RifaModel;
    const connection = getRifaConnection();
    RifaModel = connection.model<IRifa>("Rifa", RifaSchema, "rifas");
    return RifaModel;
    
}