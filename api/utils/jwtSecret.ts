/**
 * Segredo do JWT do painel. Sem fallback: um segredo padrão ("secret")
 * permitiria a qualquer pessoa forjar um token de admin e ler os dados
 * pessoais dos compradores. Sem JWT_SECRET (ou curto demais), falha.
 */
export const TAMANHO_MINIMO_SEGREDO = 32;

export function getJwtSecret(): string {
    const segredo = process.env.JWT_SECRET;
    if (!segredo || segredo.length < TAMANHO_MINIMO_SEGREDO) {
        throw new Error(
            `JWT_SECRET ausente ou com menos de ${TAMANHO_MINIMO_SEGREDO} caracteres. ` +
            "Gere um com: npm run generate-secret-key"
        );
    }
    return segredo;
}

/** Único algoritmo aceito na assinatura e na verificação. */
export const JWT_ALGORITMO = "HS256" as const;
