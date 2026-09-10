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
}

const RifaSchema: Schema<IRifa> = new mongoose.Schema({
    paymentId: { type: String, required: true, unique: true },
    status: { type: String, enum: RifaTypes.STATUSRIFATYPE, required: true },
    amount: { type: Number, required: true },

    name: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },

    claimedNumber: { type: Number, default: null },
});

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