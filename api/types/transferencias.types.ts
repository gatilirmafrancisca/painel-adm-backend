export const TIPOMOVIMENTACAOTYPE = ['ENTRADA', 'SAIDA'] as const;
export type TipoMovimentacaoType = typeof TIPOMOVIMENTACAOTYPE[number];

export const METODOPAGAMENTOTYPE = ['PIX', 'DINHEIRO', 'TRANSFERENCIA_BANCARIA', 'MERCADO_PAGO'] as const;
export type MetodoPagamentoType = typeof METODOPAGAMENTOTYPE[number];

export const STATUSFINANCEIROTYPE = ['PENDENTE', 'APROVADO', 'CANCELADO'] as const;
export type StatusFinanceiroType = typeof STATUSFINANCEIROTYPE[number];

// As tags de UTM não são mais fixas no código: ficam na coleção `utmtags`
// (ver api/types/utm.types.ts e a seção "UTM" do painel).
export type UtmSourceType = string;
export type UtmMediumType = string;
export type UtmCampaignType = string;
