import mongoose, { Schema, model, Model, Document } from "mongoose";
import * as FinanceTypes from "../types/transferencias.types.js";

export interface ITransferencia extends Document {

    valor: number;
    tipo: FinanceTypes.TipoMovimentacaoType;
    metodoPagamento: FinanceTypes.MetodoPagamentoType;
    status: FinanceTypes.StatusFinanceiroType;
    origem: FinanceTypes.OrigemFinanceiraType;
    gatoId?: mongoose.Types.ObjectId;
    nomeDoador: string;
    emailDoador?: string;
    descricao?: string;
    mercadoPagoId?: string;
    dataConfirmacao: Date;

}

const TransferenciaSchema: Schema<ITransferencia> = new mongoose.Schema({

    valor : {
        type: Number,
        required: true
    },

    tipo : { type: String, enum: FinanceTypes.TIPOMOVIMENTACAOTYPE, required: true},
    metodoPagamento : { type: String, enum: FinanceTypes.METODOPAGAMENTOTYPE, required: true},
    status: { type: String, enum: FinanceTypes.STATUSFINANCEIROTYPE, required: true },
    origem: { type: String, enum: FinanceTypes.ORIGEMFINANCEIRATYPE, required: true },
  
    // Vínculo opcional com um gato do abrigo
    gatoId: { type: Schema.Types.ObjectId, ref: 'Gato', required: false },
  
    nomeDoador: { type: String, required: true, default: 'Anônimo' },
    emailDoador: { type: String, required: false },
    descricao: { type: String, required: false },
  
    // Controle do Gateway de Pagamento
    mercadoPagoId: { type: String, required: false, unique: true, sparse: true }, 
    dataConfirmacao: { type: Date, required: true }

}, { timestamps: true });

const Transferencia : Model<ITransferencia> = model("Transferencia", TransferenciaSchema);
export default Transferencia;