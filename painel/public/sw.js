// PWA da vitrine MOBIS: apenas a casca pública. Nunca armazena sessões, OAuth, APIs ou dados privados.
const CACHE = "mobis-loja-casca-v1";
const CASCA = ["./", "./mobis.webmanifest", "./icones/mobis-ma-app-192.png"];
self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    // Apenas caches da loja e o cache legado COMPARTILHADO; nunca apaga os do painel independente.
    await Promise.all(nomes.filter((n) => (n.startsWith("mobis-loja-casca-") && n !== CACHE) || n.startsWith("conecta-casca-v")).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);
  if (requisicao.method !== "GET" || url.origin !== self.location.origin || requisicao.mode !== "navigate") return;
  const raiz = new URL("./", self.registration.scope).pathname;
  // Não captura /conecta.html nem qualquer tela de autenticação ou administração.
  if (url.pathname !== raiz && url.pathname !== raiz + "index.html") return;
  evento.respondWith(
    fetch(requisicao, { cache: "no-store" }).then((resposta) => {
      if (resposta.ok) {
        const copia = resposta.clone();
        evento.waitUntil(caches.open(CACHE).then((c) => c.put("./", copia)));
      }
      return resposta;
    }).catch(() => caches.match("./").then((cache) => cache || Response.error()))
  );
});
