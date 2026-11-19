/**
 * Tags de UTM (origem das entradas financeiras). A lista de tags válidas mora
 * no banco (coleção `utmtags`, no banco da rifa) e é gerenciada pela seção
 * "UTM" do painel. O backend da rifa (gatil-mercadopago-backend) e o site
 * leem dessa mesma coleção, então uma tag nova vale para todos sem deploy.
 */

export const UTM_CATEGORIAS = ["SOURCE", "MEDIUM", "CAMPAIGN"] as const;
export type UtmCategoria = typeof UTM_CATEGORIAS[number];

/** Campo correspondente em Transferencia / Pedido / Rifa. */
export const CAMPO_POR_CATEGORIA: Record<UtmCategoria, "utmSource" | "utmMedium" | "utmCampaign"> = {
    SOURCE: "utmSource",
    MEDIUM: "utmMedium",
    CAMPAIGN: "utmCampaign",
};

/** Só letras maiúsculas sem acento, números e "_". É o que vai no link (?utm_source=...). */
export const CODIGO_UTM_REGEX = /^[A-Z0-9_]{2,40}$/;

/**
 * Campanha que separa a rifa das doações (filtro categoria=DOACAO e
 * ehPagamentoRifa no backend da rifa). É fixa no código: a tag existe no
 * banco como "de sistema", sem poder ser excluída, desativada ou renomeada.
 */
export const CAMPANHA_RIFA = "RIFA_SOLIDARIA";

export interface UtmTagPadrao {
    categoria: UtmCategoria;
    codigo: string;
    nome: string;
    descricao: string;
    sistema: boolean;
}

/** As tags que existiam fixas no código antes da coleção. Usadas pelo seed. */
export const UTM_TAGS_PADRAO: readonly UtmTagPadrao[] = [
    { categoria: "SOURCE", codigo: "LANDING_PAGE", nome: "Landing page", descricao: "Acesso direto pelo site do gatil.", sistema: false },
    { categoria: "SOURCE", codigo: "INSTAGRAM", nome: "Instagram", descricao: "Links da bio, stories e posts do Instagram.", sistema: false },
    { categoria: "SOURCE", codigo: "FACEBOOK", nome: "Facebook", descricao: "Posts e anúncios no Facebook.", sistema: false },
    { categoria: "SOURCE", codigo: "FEIRA_ADOCAO", nome: "Feira de adoção", descricao: "QR codes e materiais das feiras de adoção.", sistema: false },
    { categoria: "MEDIUM", codigo: "ORGANICO", nome: "Orgânico", descricao: "Divulgação sem custo (posts, bio, compartilhamentos).", sistema: false },
    { categoria: "MEDIUM", codigo: "PAGO", nome: "Pago", descricao: "Anúncios e impulsionamentos pagos.", sistema: false },
    { categoria: "CAMPAIGN", codigo: "CAMPANHA_ESPECIFICA", nome: "Campanha específica", descricao: "Campanhas pontuais de arrecadação.", sistema: false },
    { categoria: "CAMPAIGN", codigo: CAMPANHA_RIFA, nome: "Rifa solidária", descricao: "Pagamentos da rifa. Separa a rifa das doações no financeiro.", sistema: true },
];
