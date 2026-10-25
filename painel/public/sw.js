// Service worker mínimo do app instalável. NÃO guarda dados do usuário nem respostas do servidor (Supabase, funções, login):
// só a "casca" do painel para abrir sem rede. Navegação vai primeiro à rede; se cair, mostra a última casca guardada.
const VERSAO = "conecta-casca-v1";
const CASCA = ["./", "icones/icone-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return; // outros domínios e escritas: direto pela rede
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then((resp) => { const copia = resp.clone(); void caches.open(VERSAO).then((c) => c.put("./", copia)); return resp; }).catch(() => caches.match("./").then((m) => m || Response.error())));
  }
});
