export const TIPOMOVIMENTACAOTYPE = ['ENTRADA', 'SAIDA'] as const;
export type TipoMovimentacaoType = typeof TIPOMOVIMENTACAOTYPE[number];

export const METODOPAGAMENTOTYPE = ['PIX', 'DINHEIRO', 'TRANSFERENCIA_BANCARIA', 'MERCADO_PAGO'] as const;
export type MetodoPagamentoType = typeof METODOPAGAMENTOTYPE[number];

export const STATUSFINANCEIROTYPE = ['PENDENTE', 'APROVADO', 'CANCELADO'] as const;
export type StatusFinanceiroType = typeof STATUSFINANCEIROTYPE[number];

export const UTMSOURCETYPE = ['LANDING_PAGE', 'INSTAGRAM', 'FACEBOOK', 'FEIRA_ADOCAO'] as const;
export type UtmSourceType = typeof UTMSOURCETYPE[number];

export const UTMEDIUMTYPE = ['ORGANICO', 'PAGO'] as const;
export type UtmMediumType = typeof UTMEDIUMTYPE[number];

export const UTCAMPAIGNTYPE = ['CAMPANHA_ESPECIFICA', 'RIFA_SOLIDARIA'] as const;
export type UtmCampaignType = typeof UTCAMPAIGNTYPE[number];