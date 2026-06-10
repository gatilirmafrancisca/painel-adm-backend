import mongoose, { Schema, model, Model, mongo } from "mongoose";
import * as EnumGatos from "../types/cats.types.js";

export interface IGato {
    nome: String;
    idade: number;
    sexo: EnumGatos.SexoType;
    cor: EnumGatos.CorType;
    castrado: boolean;
    vacinado: boolean;
    vermifugado: boolean;
    fivFelv: EnumGatos.FivFeLVType;
    personalidade: EnumGatos.PersonalidadeType[];
    necessidadesEspeciais: boolean;
    descricaoBio: String;
    status: EnumGatos.StatusType;
    imagemUrl: String[];
}

const GatoSchema: Schema<IGato> = new mongoose.Schema({

    nome: { type: String, required: true },
    idade: { type: Number, required: true },
    sexo: { type: String, enum: EnumGatos.SEXOTYPES, required: true },
    cor: { type: String, enum: EnumGatos.CORTYPES, required: true },
    castrado: { type: Boolean, required: true },
    vacinado: { type: Boolean, required: true },
    vermifugado: { type: Boolean, required: true },
    fivFelv: { type: String, enum: EnumGatos.FIVFELVTYPES, required: true },
    personalidade: { 
        type: [{ type: String, enum: EnumGatos.PERSONALIDADETYPES }], 
        required: true 
    },
    necessidadesEspeciais: { type: Boolean, required: true },
    descricaoBio: { type: String, required: true },
    status: { type: String, enum: EnumGatos.STATUSTYPES, required: true },
    imagemUrl: { type: [String], required: true }
    
}, {timestamps : true});

const Gato: Model<IGato> = model("Gato", GatoSchema);
export default Gato;