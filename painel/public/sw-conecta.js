// PWA Conecta.IA: scope exclusivo de /conecta.html. Não controla o aplicativo da loja.
const CACHE = "conecta-admin-casca-v2";
const CASCA = ["./conecta.html", "./manifest.webmanifest", "./icones/conecta-app-192.png"];
self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n.startsWith("conecta-admin-casca-") && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);
  if (requisicao.method !== "GET" || url.origin !== self.location.origin || requisicao.mode !== "navigate") return;
  if (url.pathname !== new URL(self.registration.scope).pathname) return;
  evento.respondWith(
    fetch(requisicao, { cache: "no-store" }).then((resposta) => {
      if (resposta.ok) {
        const copia = resposta.clone();
        evento.waitUntil(caches.open(CACHE).then((c) => c.put("./conecta.html", copia)));
      }
      return resposta;
    }).catch(() => caches.match("./conecta.html").then((cache) => cache || Response.error()))
  );
});
