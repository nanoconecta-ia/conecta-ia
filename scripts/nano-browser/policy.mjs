const HOST='nanoconecta-ia.github.io';
export function authorizeUrl(raw) {
 let u; try {u=new URL(raw)} catch {throw Error('URL invalida')}
 if(u.protocol!=='https:'||u.hostname!==HOST||u.port||u.username||u.password||!(u.pathname==='/conecta-ia'||u.pathname.startsWith('/conecta-ia/'))) throw Error('Destino nao autorizado');
 return u.href;
}
export function authorizeRequest(r) {
 if(r.method()!=='GET') return false;
 try {let u=new URL(r.url()); if(['data:','blob:'].includes(u.protocol)) return true; authorizeUrl(u.href); return true} catch{return false}
}