/** Contratos reais de cópia; nenhum segredo ou corpo do ERP volta ao modelo. */
export function validarImagemAprovada(i: Record<string, unknown> | null): void {
  if (!i || i.aprovada !== true || i.removida_em != null) throw new Error("Aprove a imagem na fila antes de copiar.");
  if (!i.direitos_confirmados_em || !i.direitos_referencia) throw new Error("Confirme os direitos de uso e a referência antes de copiar.");
}
export function corpoImagensBling(produto: any, url: string) {
  if (!produto || produto.situacao !== "A") throw new Error("O produto precisa estar ativo no Bling.");
  const imagens = produto.midia?.imagens;
  // Não converter silenciosamente imagens internas em externas.
  if (imagens?.internas?.length) throw new Error("Produto com imagens internas: revisão manual necessária para preservar os anexos.");
  const atuais: string[] = (imagens?.externas ?? []).map((i: any) => i.link);
  if (atuais.some(x => typeof x !== "string" || !x.startsWith("https://"))) throw new Error("Galeria atual inválida; confira no Bling.");
  return { midia: { imagens: { imagensURL: [...new Set([...atuais, url])].map(link => ({ link })) } } };
}
export async function copiarDrive(token: string, id: string, nome: string, bytes: Uint8Array, mime: string, hash: string, f: typeof fetch = fetch) {
  const boundary = "conecta_" + crypto.randomUUID();
  const metadata = { id, name: nome, appProperties: { conecta_sha256: hash } };
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, bytes as Uint8Array<ArrayBuffer>, `\r\n--${boundary}--`]);
  const r = await f("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,size", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body, redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Drive não confirmou a gravação (HTTP ${r.status}). Não repita sem conferir o recibo.`);
  const j = await r.json();
  if (j.id !== id || Number(j.size) !== bytes.length) throw new Error("Drive devolveu confirmação incompleta; confira o recibo.");
  return { id: j.id, url: `https://drive.google.com/file/d/${j.id}/view` };
}

/** Ferramenta do registro (Policy Engine) que cobre o envio da galeria. Desligada até decisão do dono para o campo de imagens. */
export const FERRAMENTA_IMAGENS = "bling.produtos.imagens_adicionar";
/** Chave de idempotência: vale no Conecta.IA (o Bling não a recebe). Mesma imagem e mesmo arquivo = mesma chave. */
export const chaveIdempotencia = (imagemId: string, sha256: string) => `nanogpt-midia:${imagemId}:${sha256}`;
/** O corpo desta ferramenta só pode levar midia.imagens.imagensURL com links https. Devolve o motivo da recusa ou null. */
export function corpoSoImagens(corpo: unknown): string | null {
  const so = (o: unknown, chave: string): unknown => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return undefined;
    const k = Object.keys(o as object);
    return k.length === 1 && k[0] === chave ? (o as Record<string, unknown>)[chave] : undefined;
  };
  const lista = so(so(so(corpo, "midia"), "imagens"), "imagensURL");
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > 20) return "corpo deve conter apenas midia.imagens.imagensURL (1 a 20 links)";
  for (const i of lista) {
    const link = so(i, "link");
    if (typeof link !== "string" || !/^https:\/\/[^\s]+$/.test(link)) return "cada imagem deve ter apenas um link https";
  }
  return null;
}
/** Espera mínima antes de concluir que o Bling NÃO gravou (um PATCH que expirou ainda pode chegar). */
export const ESPERA_RECONCILIACAO_MS = 2 * 60_000;
export type Reconciliacao = { tipo: "gravado" | "nao_gravado" | "aguardar"; motivo: string };
/** Decide o destino de uma trava pendente comparando o recibo com a galeria LIDA do Bling agora. Não escreve nada. */
export function decidirReconciliacao(recibo: Record<string, unknown> | null, linksBling: readonly string[], agora = Date.now()): Reconciliacao {
  const url = recibo?.conecta_url;
  if (!recibo || typeof url !== "string" || !url.startsWith("https://")) throw new Error("Recibo inválido; conferência manual necessária.");
  if (recibo.estado === "confirmado") return { tipo: "gravado", motivo: "A operação já estava confirmada; só a trava ficou." };
  if (linksBling.includes(url)) return { tipo: "gravado", motivo: "O Bling já mostra a imagem na galeria do produto." };
  const em = Date.parse(String(recibo.atualizado_em ?? ""));
  if (!Number.isFinite(em) || agora - em < ESPERA_RECONCILIACAO_MS) return { tipo: "aguardar", motivo: "Operação recente: aguarde dois minutos e confira de novo antes de liberar." };
  return { tipo: "nao_gravado", motivo: "O Bling não mostra a imagem: nada foi gravado no produto." };
}
