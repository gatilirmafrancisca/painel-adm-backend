import { Types } from "mongoose";
import { getUtmTagModel, type IUtmTag } from "../models/UtmTag.js";
import Transferencia from "../models/Transferencia.js";
import { getPedidoModel } from "../models/Pedido.js";
import { getRifaModel } from "../models/Rifa.js";
import {
    CAMPO_POR_CATEGORIA,
    CODIGO_UTM_REGEX,
    UTM_CATEGORIAS,
    UTM_TAGS_PADRAO,
    type UtmCategoria,
} from "../types/utm.types.js";
import { ConflictError, InvalidEnumError, InvalidIdError, MissingParamsError, NotFoundError } from "../utils/errors.js";
import type ResponseType from "../types/response.type.js";

// ---------- Cache de leitura (usado na validação do financeiro) ----------

/**
 * Na Vercel cada instância tem o próprio cache, então ele é curto e, antes de
 * recusar um código que não está nele, o banco é consultado de novo (ver
 * codigoUtmValido). Toda escrita por esta instância limpa o cache.
 */
const CACHE_TTL_MS = 60_000;
let cache: { expiraEm: number; tags: Pick<IUtmTag, "categoria" | "codigo" | "ativo">[] } | null = null;

export const limparCacheUtm = () => { cache = null; };

async function lerTagsDoBanco(): Promise<Pick<IUtmTag, "categoria" | "codigo" | "ativo">[]> {
    const tags = await getUtmTagModel().find({}, { categoria: 1, codigo: 1, ativo: 1, _id: 0 }).lean();
    // Coleção ainda vazia (antes do `npm run seed:utm`): vale a lista antiga,
    // para o financeiro não passar a recusar as tags de sempre.
    if (tags.length === 0) {
        return UTM_TAGS_PADRAO.map(({ categoria, codigo }) => ({ categoria, codigo, ativo: true }));
    }
    return tags;
}

async function tagsEmCache(forcar = false) {
    if (!forcar && cache && cache.expiraEm > Date.now()) return cache.tags;
    const tags = await lerTagsDoBanco();
    cache = { expiraEm: Date.now() + CACHE_TTL_MS, tags };
    return tags;
}

/** Códigos de uma categoria. Por padrão só as ativas; filtros do financeiro incluem as inativas. */
export async function codigosUtm(categoria: UtmCategoria, { incluirInativas = false } = {}): Promise<string[]> {
    const tags = await tagsEmCache();
    return tags
        .filter((t) => t.categoria === categoria && (incluirInativas || t.ativo))
        .map((t) => t.codigo);
}

/**
 * O código existe (e está ativo, se exigido)? Se não estiver no cache, relê o
 * banco antes de responder: uma tag recém-criada em outra instância do painel
 * não pode ser recusada por causa de cache velho.
 */
export async function codigoUtmValido(
    categoria: UtmCategoria,
    codigo: string,
    { incluirInativas = false } = {},
): Promise<boolean> {
    const confere = (tags: Pick<IUtmTag, "categoria" | "codigo" | "ativo">[]) =>
        tags.some((t) => t.categoria === categoria && t.codigo === codigo && (incluirInativas || t.ativo));

    if (confere(await tagsEmCache())) return true;
    return confere(await tagsEmCache(true));
}

// ---------- Validação de entrada do CRUD ----------

const isVazio = (v: unknown) => v === undefined || v === null || String(v).trim() === "";

function validarCategoria(valor: unknown): UtmCategoria {
    const categoria = String(valor ?? "").trim().toUpperCase();
    if (!UTM_CATEGORIAS.includes(categoria as UtmCategoria)) {
        throw new InvalidEnumError(`Categoria inválida '${categoria}'. Valores permitidos: ${UTM_CATEGORIAS.join(", ")}.`);
    }
    return categoria as UtmCategoria;
}

function validarCodigo(valor: unknown): string {
    const codigo = String(valor ?? "").trim().toUpperCase();
    if (!CODIGO_UTM_REGEX.test(codigo)) {
        throw new MissingParamsError(
            "O código deve ter de 2 a 40 caracteres, só com letras sem acento, números e '_' (ex.: TIKTOK, NATAL_2026).",
        );
    }
    return codigo;
}

function validarTexto(valor: unknown, rotulo: string, max: number, obrigatorio: boolean): string {
    const texto = String(valor ?? "").trim();
    if (obrigatorio && !texto) throw new MissingParamsError(`O campo '${rotulo}' é obrigatório.`);
    if (texto.length > max) throw new MissingParamsError(`O campo '${rotulo}' aceita até ${max} caracteres.`);
    return texto;
}

function validarId(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new InvalidIdError("ID de tag inválido.");
}

const serializar = (t: IUtmTag) => ({
    id: String(t._id),
    categoria: t.categoria,
    codigo: t.codigo,
    nome: t.nome,
    descricao: t.descricao ?? "",
    ativo: t.ativo,
    sistema: t.sistema,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
});

// ---------- CRUD ----------

export async function listarUtmTags(query: Record<string, unknown> = {}): Promise<ResponseType> {
    const filtro: Record<string, unknown> = {};
    if (!isVazio(query.categoria)) filtro.categoria = validarCategoria(query.categoria);
    if (query.ativo === "true") filtro.ativo = true;
    if (query.ativo === "false") filtro.ativo = false;

    const tags = await getUtmTagModel().find(filtro).sort({ categoria: 1, codigo: 1 }).lean();
    return { status: 200, message: "Tags de UTM.", data: tags.map(serializar) };
}

export async function buscarUtmTag(id: string): Promise<ResponseType> {
    validarId(id);
    const tag = await getUtmTagModel().findById(id).lean();
    if (!tag) throw new NotFoundError("Tag de UTM não encontrada.");
    return { status: 200, message: "Tag de UTM.", data: serializar(tag) };
}

export async function criarUtmTag(body: Record<string, unknown> = {}): Promise<ResponseType> {
    const categoria = validarCategoria(body.categoria);
    const codigo = validarCodigo(body.codigo);
    const nome = validarTexto(body.nome, "nome", 60, true);
    const descricao = validarTexto(body.descricao, "descricao", 300, false);
    const ativo = body.ativo === undefined ? true : Boolean(body.ativo);

    const Model = getUtmTagModel();
    // O índice único também barra, mas a mensagem fica melhor assim (e o
    // índice só existe depois do seed).
    if (await Model.exists({ categoria, codigo })) {
        throw new ConflictError(`Já existe a tag '${codigo}' em ${categoria}.`);
    }

    try {
        const tag = await Model.create({ categoria, codigo, nome, descricao, ativo, sistema: false });
        limparCacheUtm();
        return { status: 201, message: "Tag de UTM criada.", data: serializar(tag.toObject()) };
    } catch (error: any) {
        if (error?.code === 11000) throw new ConflictError(`Já existe a tag '${codigo}' em ${categoria}.`);
        throw error;
    }
}

const CAMPOS_EDITAVEIS = new Set(["nome", "descricao", "ativo"]);

export async function atualizarUtmTag(id: string, body: Record<string, unknown> = {}): Promise<ResponseType> {
    validarId(id);
    const tag = await getUtmTagModel().findById(id);
    if (!tag) throw new NotFoundError("Tag de UTM não encontrada.");

    const chaves = Object.keys(body);
    if (chaves.length === 0) throw new MissingParamsError("Nenhum dado foi fornecido para atualização.");

    for (const chave of chaves) {
        if (chave === "codigo" || chave === "categoria") {
            // O código fica gravado nas transferências e pedidos: trocar
            // quebraria o histórico e os filtros do financeiro.
            if (chave === "codigo" && String(body.codigo ?? "").trim().toUpperCase() === tag.codigo) continue;
            if (chave === "categoria" && String(body.categoria ?? "").trim().toUpperCase() === tag.categoria) continue;
            throw new MissingParamsError(
                "O código e a categoria não podem ser alterados, porque já ficam gravados no histórico financeiro. Crie uma tag nova e desative esta.",
            );
        }
        if (!CAMPOS_EDITAVEIS.has(chave)) {
            throw new MissingParamsError(`O campo '${chave}' não é permitido na atualização.`);
        }
    }

    if ("nome" in body) tag.nome = validarTexto(body.nome, "nome", 60, true);
    if ("descricao" in body) tag.descricao = validarTexto(body.descricao, "descricao", 300, false);
    if ("ativo" in body) {
        if (typeof body.ativo !== "boolean") throw new MissingParamsError("O campo 'ativo' deve ser true ou false.");
        if (tag.sistema && body.ativo === false) {
            throw new ConflictError(`A tag '${tag.codigo}' é usada pelo sistema e não pode ser desativada.`);
        }
        tag.ativo = body.ativo;
    }

    await tag.save();
    limparCacheUtm();
    return { status: 200, message: "Tag de UTM atualizada.", data: serializar(tag.toObject()) };
}

/** Quantos registros (até 1) usam o código: transferências, compras e bilhetes da rifa. */
async function tagEmUso(categoria: UtmCategoria, codigo: string): Promise<boolean> {
    const campo = CAMPO_POR_CATEGORIA[categoria];
    const filtro = { [campo]: codigo };
    const [transferencias, pedidos, rifas] = await Promise.all([
        Transferencia.countDocuments(filtro).limit(1),
        getPedidoModel().collection.countDocuments(filtro, { limit: 1 }),
        getRifaModel().collection.countDocuments(filtro, { limit: 1 }),
    ]);
    return transferencias + pedidos + rifas > 0;
}

export async function excluirUtmTag(id: string): Promise<ResponseType> {
    validarId(id);
    const tag = await getUtmTagModel().findById(id);
    if (!tag) throw new NotFoundError("Tag de UTM não encontrada.");

    if (tag.sistema) {
        throw new ConflictError(`A tag '${tag.codigo}' é usada pelo sistema e não pode ser excluída.`);
    }
    if (await tagEmUso(tag.categoria, tag.codigo)) {
        throw new ConflictError(
            `A tag '${tag.codigo}' já foi usada em entradas do financeiro ou compras. Desative-a em vez de excluir, para manter o histórico.`,
        );
    }

    await tag.deleteOne();
    limparCacheUtm();
    return { status: 200, message: "Tag de UTM excluída.", data: { id } };
}

/** Upsert das tags padrão + índice único. Idempotente: não mexe no que já foi editado no painel. */
export async function semearUtmTags(): Promise<{ criadas: number }> {
    const Model = getUtmTagModel();
    await Model.createIndexes();
    let criadas = 0;
    for (const { sistema, ...t } of UTM_TAGS_PADRAO) {
        // Tag de sistema: garante a trava mesmo se já existir; as demais só
        // são criadas, nunca sobrescritas.
        const update = sistema
            ? { $setOnInsert: t, $set: { sistema: true, ativo: true } }
            : { $setOnInsert: { ...t, sistema: false, ativo: true } };
        const r = await Model.updateOne({ categoria: t.categoria, codigo: t.codigo }, update, { upsert: true });
        criadas += r.upsertedCount;
    }
    limparCacheUtm();
    return { criadas };
}
