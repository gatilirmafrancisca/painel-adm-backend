export const TIPOMOVIMENTACAOTYPE = ['ENTRADA', 'SAIDA'] as const;
export type TipoMovimentacaoType = typeof TIPOMOVIMENTACAOTYPE[number];

export const METODOPAGAMENTOTYPE = ['PIX', 'DINHEIRO', 'TRANSFERENCIA_BANCARIA', 'MERCADO_PAGO'] as const;
export type MetodoPagamentoType = typeof METODOPAGAMENTOTYPE[number];

export const STATUSFINANCEIROTYPE = ['PENDENTE', 'APROVADO', 'CANCELADO', 'REJEITADO'] as const;
export type StatusFinanceiroType = typeof STATUSFINANCEIROTYPE[number];

export const ORIGEMFINANCEIRATYPE = ['LANDING_PAGE', 'INSTAGRAM', 'FEIRA_ADOCAO', 'CAMPANHA_ESPECIFICA'] as const;
export type OrigemFinanceiraType = typeof ORIGEMFINANCEIRATYPE[number];