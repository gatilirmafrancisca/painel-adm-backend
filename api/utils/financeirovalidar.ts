import { ITransferencia } from "../models/Transferencia.js";
import * as FinanceTypes from "../types/transferencias.types.js";
import { MissingParamsError, InvalidEnumError } from "./errors.js";
import { codigoUtmValido, codigosUtm } from "../services/utm.service.js";
import { CAMPANHA_RIFA, type UtmCategoria } from "../types/utm.types.js";
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

    for (const field of ["utmSource", "utmMedium", "utmCampaign"] as const) {
        if (isEmptyValue(rawData[field])) {
            normalizedData[field] = undefined;
        }
    }

    return normalizedData;
};

export const CATEGORIA_DOACAO = "DOACAO";

const UTM_CAMPOS = [
    ["utmSource", "SOURCE"],
    ["utmMedium", "MEDIUM"],
    ["utmCampaign", "CAMPAIGN"],
] as const satisfies readonly (readonly [string, UtmCategoria])[];

const ROTULO_UTM = { utmSource: "UtmSource", utmMedium: "UtmMedium", utmCampaign: "UtmCampaign" } as const;

export const montarFiltrosTransferencia = async (query: any): Promise<Record<string, any>> => {
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

    // Filtro por UTM: vale qualquer tag cadastrada, ativa ou não (as inativas
    // continuam no histórico). Valor desconhecido é ignorado, como antes.
    for (const [campo, categoria] of UTM_CAMPOS) {
        const valor = query[campo];
        if (typeof valor === "string" && valor && await codigoUtmValido(categoria, valor, { incluirInativas: true })) {
            filters[campo] = valor;
        }
    }

    if (query.nomeDoador) {
        filters.nomeDoador = { $regex: String(query.nomeDoador).trim(), $options: "i" };
    }

    // Convertido para ObjectId para funcionar também no aggregate (que não faz cast)
    if (query.gatoId && Types.ObjectId.isValid(query.gatoId)) {
        filters.gatoId = new Types.ObjectId(String(query.gatoId));
    }

    // Categoria DOACAO: só entradas que não vieram da rifa solidária.
    // Sobrescreve 'tipo' e 'utmCampaign' para nunca misturar outros valores no resultado.
    if (query.categoria === CATEGORIA_DOACAO) {
        filters.tipo = "ENTRADA" satisfies FinanceTypes.TipoMovimentacaoType;
        filters.utmCampaign = { $ne: CAMPANHA_RIFA };
    }

    // Filtro por mês (ex: ?mes=10&ano=2026), no fuso de Brasília (UTC-3, sem horário de verão)
    if (query.mes && query.ano) {
        const mes = Number(query.mes);
        const ano = Number(query.ano);
        if (Number.isInteger(mes) && Number.isInteger(ano) && mes >= 1 && mes <= 12) {
            filters.dataConfirmacao = {
                $gte: new Date(Date.UTC(ano, mes - 1, 1, 3)),
                $lt: new Date(Date.UTC(ano, mes, 1, 3))
            };
        }
    }

    return filters;
};

export interface OpcoesValidacao {
    /** Sincronização do Mercado Pago: UTM desconhecida ou inativa não impede o registro. */
    tolerarUtmDesconhecida?: boolean;
}

export const validarParametros = async (data: ITransferencia, opcoes: OpcoesValidacao = {}): Promise<any> => {
    const camposAusentes: string[] = [];

    // Validação de presença obrigatória
    if (isEmptyValue(data.valor)) camposAusentes.push("Valor");
    if (!String(data.tipo || "").trim()) camposAusentes.push("Tipo");
    if (!String(data.metodoPagamento || "").trim()) camposAusentes.push("Método de Pagamento");
    if (!String(data.status || "").trim()) camposAusentes.push("Status");
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
    for (const [campo, categoria] of UTM_CAMPOS) {
        const valor = data[campo];
        if (isEmptyValue(valor)) continue;
        const codigo = validateStringField(valor, ROTULO_UTM[campo]);

        // Só tags ativas, no cadastro manual. Na sincronização do Mercado
        // Pago o pagamento já aconteceu (o Pix fica até 30 min pendente, o
        // checkout do cartão fica aberto): se a tag foi desativada ou
        // excluída nesse meio-tempo, a entrada é registrada mesmo assim, com
        // a UTM que veio, em vez de o dinheiro sumir do financeiro.
        if (await codigoUtmValido(categoria, codigo, { incluirInativas: opcoes.tolerarUtmDesconhecida })) continue;

        if (opcoes.tolerarUtmDesconhecida) {
            console.warn(`[financeiro] ${ROTULO_UTM[campo]} '${codigo}' não está cadastrada; registrada mesmo assim.`, {
                mercadoPagoId: data.mercadoPagoId ?? "N/A",
            });
            continue;
        }

        const permitidos = await codigosUtm(categoria);
        throw new InvalidEnumError(`${ROTULO_UTM[campo]} inválido '${codigo}'. Valores permitidos: ${permitidos.join(", ")}.`);
    }

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
    "metodoPagamento",
    "status",
    "nomeDoador",
    "emailDoador",
    "descricao",
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

    if (hasOwnField(payload, "metodoPagamento")) {
        payload.metodoPagamento = validateEnumField(payload.metodoPagamento, "Método de Pagamento", FinanceTypes.METODOPAGAMENTOTYPE);
    }

    if (hasOwnField(payload, "status")) {
        payload.status = validateEnumField(payload.status, "Status", FinanceTypes.STATUSFINANCEIROTYPE);
    }

    return payload as Partial<ITransferencia>;
};