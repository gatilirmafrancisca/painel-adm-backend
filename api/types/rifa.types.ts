export const TOTAL_NUMEROS = 500;
export const TICKET_PRICE_BRL = 100;

export const STATUSRIFATYPE = ["PENDENTE", "APROVADO", "CANCELADO", "RESERVADO"] as const;
export type StatusRifaType = typeof STATUSRIFATYPE[number];
// Compra com reserva (backend da rifa: models/Pedido.ts).
export const STATUSPEDIDO = ['RESERVADO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'PAGO_PARCIAL', 'EXPIRADO', 'CANCELADO'] as const;
export type StatusPedido = typeof STATUSPEDIDO[number];
export const ALERTASPEDIDO = ['VALOR_DIVERGENTE', 'PAGAMENTO_DUPLICADO', 'PAGO_APOS_EXPIRAR'] as const;
export type AlertaPedido = typeof ALERTASPEDIDO[number];
