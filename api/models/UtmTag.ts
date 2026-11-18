import mongoose, { Model } from "mongoose";
import { getRifaConnection } from "../database/rifadb.js";
import { UTM_CATEGORIAS, type UtmCategoria } from "../types/utm.types.js";

/**
 * Tag de UTM aceita pelo site, pelo backend da rifa e pelo financeiro do
 * painel. Mora no banco da rifa (o mesmo que o gatil-mercadopago-backend usa
 * como conexão padrão): o painel escreve, o backend da rifa só lê.
 */
export interface IUtmTag {
    _id: mongoose.Types.ObjectId;
    categoria: UtmCategoria;
    codigo: string;
    nome: string;
    descricao: string;
    ativo: boolean;
    sistema: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const UtmTagSchema = new mongoose.Schema<IUtmTag>({
    categoria: { type: String, enum: UTM_CATEGORIAS, required: true },
    codigo: { type: String, required: true, trim: true, uppercase: true },
    nome: { type: String, required: true, trim: true },
    descricao: { type: String, default: "", trim: true },
    ativo: { type: Boolean, default: true },
    sistema: { type: Boolean, default: false },
}, { timestamps: true });

// A conexão da rifa usa autoIndex: false. O índice é criado pelo
// `npm run seed:utm` (e pelo migrate:indices do backend da rifa).
UtmTagSchema.index({ categoria: 1, codigo: 1 }, { unique: true });

let UtmTagModel: Model<IUtmTag> | null = null;

export function getUtmTagModel(): Model<IUtmTag> {
    if (UtmTagModel) return UtmTagModel;
    UtmTagModel = getRifaConnection().model<IUtmTag>("UtmTag", UtmTagSchema, "utmtags");
    return UtmTagModel;
}
