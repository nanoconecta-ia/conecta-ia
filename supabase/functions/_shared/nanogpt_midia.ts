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
