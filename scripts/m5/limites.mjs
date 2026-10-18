export function exigirLocal(valor) {
  const u = new URL(valor);
  if (u.origin !== 'http://127.0.0.1:54321' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw Error('M5 só aceita http://127.0.0.1:54321; projeto remoto proibido.');
  return u.origin;
}
