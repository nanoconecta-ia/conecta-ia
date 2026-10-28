// Service worker mínimo do app instalável. NÃO guarda dados do usuário nem respostas do servidor (Supabase, funções, login):
// só a "casca" do painel para abrir sem rede. Navegação vai primeiro à rede (SEM o cache HTTP do navegador); se cair, mostra a última casca guardada.
// v2: ao trocar de versão, apaga o cache antigo e recarrega UMA vez as janelas abertas, para o app instalado não ficar preso numa tela antiga.
const VERSAO = "conecta-casca-v2";
const CASCA = ["./", "icones/icone-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const antigas = (await caches.keys()).filter((k) => k !== VERSAO);
    await Promise.all(antigas.map((k) => caches.delete(k)));
    await self.clients.claim();
    if (antigas.length === 0) return; // primeira instalação ou mesma versão: nada a recarregar
    const janelas = await self.clients.matchAll({ type: "window" });
    await Promise.all(janelas.map((j) => j.navigate(j.url).catch(() => undefined)));
  })());
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return; // outros domínios e escritas: direto pela rede
  if (r.mode === "navigate") {
    e.respondWith(fetch(r, { cache: "no-store" }).then((resp) => { const copia = resp.clone(); void caches.open(VERSAO).then((c) => c.put("./", copia)); return resp; }).catch(() => caches.match("./").then((m) => m || Response.error())));
  }
});
