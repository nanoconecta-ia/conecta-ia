/** Estado QR do mesmo RPC usado no topo do Conecta e no Estúdio Nano. */
export type PresencaQr = { disponivel?: boolean; online?: boolean; ultimo_sinal_em?: string | null; token_ate?: string | null; janela_ate?: string | null } | null;
export type IndicadorQr = { online: boolean; rotulo: string; detalhe: string };
export function indicadorQr(qr: PresencaQr, agora = Date.now()): IndicadorQr {
  const ultimo = qr?.ultimo_sinal_em ? Date.parse(qr.ultimo_sinal_em) : NaN;
  const autorizado = qr?.disponivel === true && Number.isFinite(Date.parse(qr?.token_ate ?? '')) && Date.parse(qr?.token_ate ?? '') > agora && Date.parse(qr?.janela_ate ?? '') > agora;
  const online = autorizado && qr?.online === true && Number.isFinite(ultimo) && ultimo <= agora + 5000 && agora - ultimo <= 75000;
  return online ? { online: true, rotulo: 'Agente QR: online', detalhe: 'Dispositivo consultou a fila do Nano nos últimos 75 segundos; resposta do modelo depende do consumidor ativo.' }
    : autorizado ? { online: false, rotulo: 'Agente QR: offline', detalhe: 'QR autorizado, mas nenhum consumidor consultou a fila recentemente. Não confundir autorização com atendimento.' }
    : { online: false, rotulo: 'Agente QR: offline', detalhe: 'Sem autorização e token válidos para atender mensagens.' };
}
