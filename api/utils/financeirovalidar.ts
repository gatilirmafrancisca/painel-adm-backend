import { ITransferencia } from "../models/Transferencia.js";
import * as FinanceTypes from "../types/transferencias.types.js";
import { MissingParamsError, InvalidEnumError } from "./errors.js";
import { Types } from "mongoose";

const hasOwnField = (obj: Record<string, any>, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);
const isEmptyValue = (value: unknown): boolean => value === undefined || value === null || value === "";

const validateStringField = (value: unknown, fieldLabel: string): string => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        throw new MissingParamsError(`O campo '${fieldLabel}' não pode estar vazio.`);
    }
    return normalized;
};

// Diferente da idade do gato, o valor financeiro pode ter decimais (float)
const validateNumberField = (value: unknown, fieldLabel: string): number => {
    if (typeof value === "boolean" || isEmptyValue(value)) {
        throw new MissingParamsError(`O campo '${fieldLabel}' deve ser um número válido.`);
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
        throw new MissingParamsError(`O campo '${fieldLabel}' deve ser um número válido e maior ou igual a zero.`);
    }
    return parsed;
};

const validateDateField = (value: unknown, fieldLabel: string): Date => {
    if (isEmptyValue(value)) {
        throw new MissingParamsError(`O campo '${fieldLabel}' é obrigatório.`);
    }
    const date = new Date(value as any);
    if (isNaN(date.getTime())) {
        throw new MissingParamsError(`O campo '${fieldLabel}' deve ser uma data válida.`);
    }
    return date;
};

const validateEnumField = <T extends readonly string[]>(
    value: unknown,
    fieldLabel: string,
    allowedValues: T,
): T[number] => {
    const normalized = validateStringField(value, fieldLabel);
    if (!allowedValues.includes(normalized)) {
        throw new InvalidEnumError(`${fieldLabel} inválido '${normalized}'. Valores permitidos: ${allowedValues.join(", ")}.`);
    }
    return normalized as T[number];
};

const parseNumberFormValue = (value: any): number | undefined => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return undefined;

    const normalized = value.trim();
    if (normalized === "") return undefined;

    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
};

const parseDateFormValue = (value: any): Date | undefined => {
    if (value instanceof Date) return value;
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? undefined : parsed;
};

export const normalizarDadosTransferencia = (data: Partial<ITransferencia> & Record<string, any>): Partial<ITransferencia> => {
    const rawData = data as Record<string, any>;
    const normalizedData: Partial<ITransferencia> & Record<string, any> = { ...data };

    if (hasOwnField(rawData, "valor")) {
        const valorConvertido = parseNumberFormValue(rawData.valor);
        normalizedData.valor = valorConvertido !== undefined || isEmptyValue(rawData.valor)
            ? valorConvertido
            : rawData.valor;
    }

    if (hasOwnField(rawData, "data")) {
        const dataConvertida = parseDateFormValue(rawData.data);
        normalizedData.data = dataConvertida !== undefined || isEmptyValue(rawData.data)
            ? dataConvertida
            : rawData.data;
    }

    if (hasOwnField(rawData, "dataConfirmacao") && !isEmptyValue(rawData.dataConfirmacao)) {
        const dataConfConvertida = parseDateFormValue(rawData.dataConfirmacao);
        normalizedData.dataConfirmacao = dataConfConvertida !== undefined 
            ? dataConfConvertida 
            : rawData.dataConfirmacao;
    }

    return normalizedData;
};

export const montarFiltrosTransferencia = (query: any): Record<string, any> => {
    const filters: Record<string, any> = {};

    if (!query) return filters;

    if (query.tipo && FinanceTypes.TIPOMOVIMENTACAOTYPE.includes(query.tipo as FinanceTypes.TipoMovimentacaoType)) {
        filters.tipo = query.tipo;
    }

    if (query.status && FinanceTypes.STATUSFINANCEIROTYPE.includes(query.status as FinanceTypes.StatusFinanceiroType)) {
        filters.status = query.status;
    }

    if (query.metodoPagamento && FinanceTypes.METODOPAGAMENTOTYPE.includes(query.metodoPagamento as FinanceTypes.MetodoPagamentoType)) {
        filters.metodoPagamento = query.metodoPagamento;
    }

    if (query.origem && FinanceTypes.ORIGEMFINANCEIRATYPE.includes(query.origem as FinanceTypes.OrigemFinanceiraType)) {
        filters.origem = query.origem;
    }

    if (query.nomeDoador) {
        filters.nomeDoador = { $regex: String(query.nomeDoador).trim(), $options: "i" };
    }

    if (query.gatoId && Types.ObjectId.isValid(query.gatoId)) {
        filters.gatoId = query.gatoId;
    }

    // Filtro de data exata ou range (ex: ano e mês via query)
    if (query.mes && query.ano) {
        const mes = Number(query.mes);
        const ano = Number(query.ano);
        if (!Number.isNaN(mes) && !Number.isNaN(ano)) {
            filters.data = {
                $gte: new Date(ano, mes - 1, 1),
                $lte: new Date(ano, mes, 0, 23, 59, 59, 999)
            };
        }
    }

    return filters;
};

export const validarParametros = async (data: ITransferencia): Promise<any> => {
    const camposAusentes: string[] = [];

    // Validação de presença obrigatória
    if (isEmptyValue(data.valor)) camposAusentes.push("Valor");
    if (!String(data.tipo || "").trim()) camposAusentes.push("Tipo");
    if (!String(data.metodoPagamento || "").trim()) camposAusentes.push("Método de Pagamento");
    if (!String(data.status || "").trim()) camposAusentes.push("Status");
    if (!String(data.origem || "").trim()) camposAusentes.push("Origem");
    if (!String(data.nomeDoador || "").trim()) camposAusentes.push("Nome do Doador");
    if (isEmptyValue(data.dataConfirmacao)) camposAusentes.push("Data");

    if (camposAusentes.length > 0) {
        throw new MissingParamsError(
            `Os seguintes campos obrigatórios estão ausentes ou vazios: ${camposAusentes.join(", ")}.`
        );
    }

    // Validação de Tipos e Enums
    validateNumberField(data.valor, "Valor");
    validateDateField(data.dataConfirmacao, "Data");
    validateEnumField(data.tipo, "Tipo", FinanceTypes.TIPOMOVIMENTACAOTYPE);
    validateEnumField(data.metodoPagamento, "Método de Pagamento", FinanceTypes.METODOPAGAMENTOTYPE);
    validateEnumField(data.status, "Status", FinanceTypes.STATUSFINANCEIROTYPE);
    validateEnumField(data.origem, "Origem", FinanceTypes.ORIGEMFINANCEIRATYPE);

    // Validações opcionais (apenas se preenchidos)
    if (!isEmptyValue(data.gatoId) && !Types.ObjectId.isValid(String(data.gatoId))) {
        throw new MissingParamsError("O campo 'gatoId' deve ser um ID de MongoDB válido.");
    }
    
    if (!isEmptyValue(data.dataConfirmacao)) {
        validateDateField(data.dataConfirmacao, "Data de Confirmação");
    }
};

const ALLOWED_PATCH_FIELDS = new Set([
    "valor",
    "tipo",
    "metodoPagamento",
    "status",
    "origem",
    "gatoId",
    "nomeDoador",
    "emailDoador",
    "descricao",
    "mercadoPagoId",
    "data",
    "dataConfirmacao"
]);

export const validatePatchParams = async (data: Partial<ITransferencia>): Promise<Partial<ITransferencia>> => {
    const payload = data as Record<string, any>;
    const keys = Object.keys(payload);

    if (keys.length === 0) {
        throw new MissingParamsError("Nenhum dado foi fornecido para atualização.");
    }

    for (const key of keys) {
        if (!ALLOWED_PATCH_FIELDS.has(key)) {
            throw new MissingParamsError(`O campo '${key}' não é permitido na atualização.`);
        }
    }

    if (hasOwnField(payload, "valor")) {
        payload.valor = validateNumberField(payload.valor, "valor");
    }

    if (hasOwnField(payload, "data")) {
        payload.data = validateDateField(payload.data, "data");
    }

    if (hasOwnField(payload, "dataConfirmacao") && !isEmptyValue(payload.dataConfirmacao)) {
        payload.dataConfirmacao = validateDateField(payload.dataConfirmacao, "dataConfirmacao");
    }

    if (hasOwnField(payload, "nomeDoador")) {
        payload.nomeDoador = validateStringField(payload.nomeDoador, "nomeDoador");
    }

    if (hasOwnField(payload, "emailDoador") && !isEmptyValue(payload.emailDoador)) {
        payload.emailDoador = validateStringField(payload.emailDoador, "emailDoador");
    }

    if (hasOwnField(payload, "descricao") && !isEmptyValue(payload.descricao)) {
        payload.descricao = validateStringField(payload.descricao, "descricao");
    }

    if (hasOwnField(payload, "mercadoPagoId") && !isEmptyValue(payload.mercadoPagoId)) {
        payload.mercadoPagoId = validateStringField(payload.mercadoPagoId, "mercadoPagoId");
    }

    if (hasOwnField(payload, "gatoId") && !isEmptyValue(payload.gatoId)) {
        if (!Types.ObjectId.isValid(String(payload.gatoId))) {
            throw new MissingParamsError("O campo 'gatoId' deve ser um ID de MongoDB válido.");
        }
    }

    if (hasOwnField(payload, "tipo")) {
        payload.tipo = validateEnumField(payload.tipo, "Tipo", FinanceTypes.TIPOMOVIMENTACAOTYPE);
    }

    if (hasOwnField(payload, "metodoPagamento")) {
        payload.metodoPagamento = validateEnumField(payload.metodoPagamento, "Método de Pagamento", FinanceTypes.METODOPAGAMENTOTYPE);
    }

    if (hasOwnField(payload, "status")) {
        payload.status = validateEnumField(payload.status, "Status", FinanceTypes.STATUSFINANCEIROTYPE);
    }

    if (hasOwnField(payload, "origem")) {
        payload.origem = validateEnumField(payload.origem, "Origem", FinanceTypes.ORIGEMFINANCEIRATYPE);
    }

    return payload as Partial<ITransferencia>;
};