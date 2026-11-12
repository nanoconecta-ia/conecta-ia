// GERADO por scripts/gerar-autocontido.mjs. Não editar. Nenhuma publicação autorizada.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const __sdk = { createClient };

// ---------- supabase/functions/_shared/bling_armazem.ts ----------
const __m1 = (() => {
function armazemSupabase(admin) {
    return {
        async ler (lojaId) {
            const { data, error } = await admin.rpc("bling_ler_credenciais", {
                p_loja_id: lojaId
            });
            if (error) throw new Error("falha ao ler credenciais");
            return (data ?? [])[0] ?? null;
        },
        async reservar (lojaId, por, ttlS) {
            const { data, error } = await admin.rpc("bling_reservar_renovacao", {
                p_loja_id: lojaId,
                p_por: por,
                p_ttl_s: ttlS
            });
            if (error) throw new Error("falha ao reservar renovação");
            return data === true;
        },
        async liberar (lojaId, por) {
            await admin.rpc("bling_liberar_renovacao", {
                p_loja_id: lojaId,
                p_por: por
            });
        },
        async salvar (lojaId, access, refresh, expiraEm) {
            const { error } = await admin.rpc("bling_salvar_credenciais", {
                p_loja_id: lojaId,
                p_access: access,
                p_refresh: refresh,
                p_expira_em: expiraEm
            });
            if (error) throw new Error("falha ao salvar credenciais");
        },
        async lerApp (lojaId) {
            const { data, error } = await admin.rpc("bling_ler_app", {
                p_loja_id: lojaId
            });
            if (error) throw new Error("falha ao ler o app do Bling");
            return (data ?? [])[0] ?? null;
        },
        async marcar (lojaId, status, erro) {
            await admin.rpc("bling_marcar_status", {
                p_loja_id: lojaId,
                p_status: status,
                p_erro: erro
            });
        }
    };
}

return { armazemSupabase: armazemSupabase };
})();

// ---------- supabase/functions/_shared/estado.ts ----------
const __m5 = (() => {
const enc = new TextEncoder();
const dec = new TextDecoder();
function b64u(b) {
    let s = "";
    for (const x of b)s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s) {
    const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4);
    return Uint8Array.from(atob(p), (c)=>c.charCodeAt(0));
}
const chaveHmac = (segredo)=>crypto.subtle.importKey("raw", enc.encode(segredo), {
        name: "HMAC",
        hash: "SHA-256"
    }, false, [
        "sign",
        "verify"
    ]);
async function assinarEstado(est, segredo) {
    const corpo = b64u(enc.encode(JSON.stringify(est)));
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chaveHmac(segredo), enc.encode(corpo)));
    return `${corpo}.${b64u(sig)}`;
}
async function verificarEstado(token, segredo, agora = Date.now()) {
    const [corpo, sig, resto] = token.split(".");
    if (!corpo || !sig || resto !== undefined) return null;
    try {
        const ok = await crypto.subtle.verify("HMAC", await chaveHmac(segredo), unb64u(sig), enc.encode(corpo));
        if (!ok) return null;
        const est = JSON.parse(dec.decode(unb64u(corpo)));
        if (typeof est.l !== "string" || typeof est.u !== "string" || typeof est.e !== "number" || est.e < agora) return null;
        return est;
    } catch  {
        return null;
    }
}

return { b64u: b64u, unb64u: unb64u, assinarEstado: assinarEstado, verificarEstado: verificarEstado };
})();

// ---------- supabase/functions/_shared/cripto.ts ----------
const __m4 = (() => {
const { b64u: b64u, unb64u: unb64u } = __m5;
const enc = new TextEncoder();
const dec = new TextDecoder();
function anel(c) {
    if (!c) throw new Error("chave de cifra não configurada");
    return typeof c === "string" ? {
        atual: "k1",
        chaves: {
            k1: c
        }
    } : c;
}
function chaveiroDoAmbiente(get) {
    const json = get("CREDENCIAIS_CHAVES");
    if (json) {
        try {
            const chaves = JSON.parse(json);
            const atual = get("CREDENCIAIS_CHAVE_ATUAL") ?? Object.keys(chaves).sort().at(-1);
            if (chaves[atual]) return {
                atual,
                chaves
            };
        } catch  {}
    }
    return get("CREDENCIAIS_CHAVE_CIFRA");
}
async function importar(b64) {
    const raw = Uint8Array.from(atob(b64), (c)=>c.charCodeAt(0));
    if (raw.length !== 32) throw new Error("a chave de cifra deve ter 32 bytes (base64)");
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
        "encrypt",
        "decrypt"
    ]);
}
async function cifrar(texto, chaveiro) {
    const a = anel(chaveiro);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const tudo = new Uint8Array(await crypto.subtle.encrypt({
        name: "AES-GCM",
        iv
    }, await importar(a.chaves[a.atual]), enc.encode(texto)));
    const tag = tudo.slice(tudo.length - 16);
    const corpo = tudo.slice(0, tudo.length - 16);
    return `v2.${a.atual}.${b64u(iv)}.${b64u(tag)}.${b64u(corpo)}`;
}
async function abrir(chaveB64, iv, tag, ct) {
    const corpo = unb64u(ct), t = unb64u(tag);
    const junto = new Uint8Array(corpo.length + t.length);
    junto.set(corpo);
    junto.set(t, corpo.length);
    return dec.decode(await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: unb64u(iv)
    }, await importar(chaveB64), junto));
}
async function decifrar(valor, chaveiro) {
    const a = anel(chaveiro);
    const p = valor.split(".");
    if (p[0] === "v2" && p.length === 5) {
        const chave = a.chaves[p[1]];
        if (!chave) throw new Error("chave de cifra desconhecida (kid)");
        return abrir(chave, p[2], p[3], p[4]);
    }
    if (p[0] === "v1" && p.length === 4) {
        for (const k of [
            a.atual,
            ...Object.keys(a.chaves).filter((x)=>x !== a.atual)
        ]){
            try {
                return await abrir(a.chaves[k], p[1], p[2], p[3]);
            } catch  {}
        }
        throw new Error("não foi possível decifrar (formato v1)");
    }
    throw new Error("Formato de segredo cifrado inválido");
}
async function recifrar(valor, chaveiro) {
    const a = anel(chaveiro);
    if (valor.startsWith(`v2.${a.atual}.`)) return valor;
    return cifrar(await decifrar(valor, chaveiro), chaveiro);
}

return { chaveiroDoAmbiente: chaveiroDoAmbiente, cifrar: cifrar, decifrar: decifrar, recifrar: recifrar };
})();

// ---------- supabase/functions/_shared/bling_token.ts ----------
const __m3 = (() => {
const { decifrar: decifrar, cifrar: cifrar } = __m4;
const ANTECEDENCIA_MS = 30 * 60_000;
const RESERVA_S = 60;
const TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";
async function renovarLoja(arm, lojaId, cfg, forcar = false) {
    const agora = cfg.agora ?? Date.now;
    const f = cfg.fetch ?? fetch;
    const espera = cfg.espera ?? ((ms)=>new Promise((r)=>setTimeout(r, ms)));
    const por = cfg.id ?? crypto.randomUUID();
    const antes = await arm.ler(lojaId);
    if (!antes) return "sem_conexao";
    if (!forcar && Date.parse(antes.expira_em) - agora() > ANTECEDENCIA_MS) return "ja_valida";
    if (!await arm.reservar(lojaId, por, RESERVA_S)) {
        for(let i = 0; i < 5; i++){
            await espera(1000);
            const dep = await arm.ler(lojaId);
            if (dep && dep.refresh_token_cifrado !== antes.refresh_token_cifrado) return "outra_renovacao";
        }
        return "falha_temporaria";
    }
    try {
        const atual = await arm.ler(lojaId) ?? antes;
        if (!forcar && atual.refresh_token_cifrado !== antes.refresh_token_cifrado) {
            await arm.liberar(lojaId, por);
            return "outra_renovacao";
        }
        const app = await arm.lerApp(lojaId);
        if (!app) {
            await arm.marcar(lojaId, "erro", "App do Bling não cadastrado. Informe o Client ID e o Client Secret no painel.");
            await arm.liberar(lojaId, por);
            return "reconectar";
        }
        const clientSecret = await decifrar(app.client_secret_cifrado, cfg.chaveCifra);
        const refresh = await decifrar(atual.refresh_token_cifrado, cfg.chaveCifra);
        let r;
        try {
            r = await f(TOKEN_URL, {
                method: "POST",
                redirect: "manual",
                headers: {
                    Authorization: "Basic " + btoa(`${app.client_id}:${clientSecret}`),
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "1.0",
                    "enable-jwt": "1"
                },
                body: new URLSearchParams({
                    grant_type: "refresh_token",
                    refresh_token: refresh
                }).toString(),
                signal: AbortSignal.timeout(15_000)
            });
        } catch  {
            await arm.liberar(lojaId, por);
            return "falha_temporaria";
        }
        if (r.status === 400 || r.status === 401) {
            await arm.marcar(lojaId, "expirada", "Acesso ao Bling expirou. Reconecte no painel.");
            await arm.liberar(lojaId, por);
            return "reconectar";
        }
        if (!r.ok) {
            await arm.liberar(lojaId, por);
            return "falha_temporaria";
        }
        const t = await r.json().catch(()=>null);
        if (!t?.access_token || !t.refresh_token || !t.expires_in) {
            await arm.liberar(lojaId, por);
            return "falha_temporaria";
        }
        await arm.salvar(lojaId, await cifrar(t.access_token, cfg.chaveCifra), await cifrar(t.refresh_token, cfg.chaveCifra), new Date(agora() + t.expires_in * 1000).toISOString());
        return "renovada";
    } catch  {
        await arm.liberar(lojaId, por).catch(()=>{});
        return "falha_temporaria";
    }
}
async function obterAccessToken(arm, lojaId, cfg) {
    let c = await arm.ler(lojaId);
    if (!c) return null;
    if (Date.parse(c.expira_em) - (cfg.agora ?? Date.now)() <= ANTECEDENCIA_MS) {
        const r = await renovarLoja(arm, lojaId, cfg);
        if (r === "reconectar" || r === "sem_conexao") return null;
        c = await arm.ler(lojaId);
        if (!c) return null;
    }
    return decifrar(c.access_token_cifrado, cfg.chaveCifra);
}

return { ANTECEDENCIA_MS: ANTECEDENCIA_MS, RESERVA_S: RESERVA_S, renovarLoja: renovarLoja, obterAccessToken: obterAccessToken };
})();

// ---------- supabase/functions/_shared/bling_api.ts ----------
const __m2 = (() => {
const { obterAccessToken: obterAccessToken, renovarLoja: renovarLoja } = __m3;
const BASE = "https://api.bling.com.br/Api/v3";
const RECUOS_MS = [
    1000,
    3000,
    8000
];
class BlingErro extends Error {
    status;
    constructor(status, msg){
        super(msg);
        this.status = status;
    }
}
async function blingFetch(arm, lojaId, caminho, cfg, op = {}) {
    if (!/^\/[a-z0-9/_-]*(\?[A-Za-z0-9%=&_.,\[\]-]*)?$/i.test(caminho)) throw new BlingErro(400, "Caminho inválido para a API do Bling.");
    const f = cfg.fetch ?? fetch;
    const espera = cfg.espera ?? ((ms)=>new Promise((r)=>setTimeout(r, ms)));
    const recuos = op.recuos ?? RECUOS_MS;
    const metodo = op.metodo ?? "GET";
    let token = await obterAccessToken(arm, lojaId, cfg);
    if (!token) throw new BlingErro(401, "Bling não conectado. Reconecte no painel.");
    let renovou = false;
    for(let tentativa = 0;; tentativa++){
        const r = await f(BASE + caminho, {
            method: metodo,
            redirect: "manual",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                "enable-jwt": "1",
                ...op.corpo !== undefined ? {
                    "Content-Type": "application/json"
                } : {}
            },
            body: op.corpo !== undefined ? JSON.stringify(op.corpo) : undefined,
            signal: AbortSignal.timeout(op.timeoutMs ?? 20_000)
        });
        if (r.status === 401 && !renovou) {
            renovou = true;
            const res = await renovarLoja(arm, lojaId, cfg, true);
            if (res === "reconectar") throw new BlingErro(401, "Acesso ao Bling expirou. Reconecte no painel.");
            token = await obterAccessToken(arm, lojaId, cfg);
            if (!token) throw new BlingErro(401, "Bling não conectado. Reconecte no painel.");
            continue;
        }
        const repetivel = metodo === "GET" && (r.status === 429 || r.status >= 500);
        if (repetivel && tentativa < recuos.length) {
            await espera(recuos[tentativa]);
            continue;
        }
        return r;
    }
}

return { RECUOS_MS: RECUOS_MS, BlingErro: BlingErro, blingFetch: blingFetch };
})();

// ---------- supabase/functions/_shared/plataforma.ts ----------
const __m6 = (() => {
const { chaveiroDoAmbiente: chaveiroDoAmbiente } = __m4;
async function doVault(admin, nome) {
    const { data } = await admin.rpc("plataforma_segredo", {
        p_nome: nome
    });
    return typeof data === "string" && data ? data : undefined;
}
async function segredoEstado(admin, get) {
    return get("ESTADO_SEGREDO") || await doVault(admin, "plataforma_estado_segredo");
}
async function chaveiroPlataforma(admin, get) {
    return chaveiroDoAmbiente(get) ?? await doVault(admin, "plataforma_chave_cifra_k1");
}

return { segredoEstado: segredoEstado, chaveiroPlataforma: chaveiroPlataforma };
})();

// ---------- supabase/functions/_shared/bling_sync.ts ----------
const __m8 = (() => {
const txt = (v)=>typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const pos = (v)=>typeof v === "number" && v > 0 ? v : null;
function mapearProduto(lojaId, lista, d, agoraISO) {
    const x = d ?? {};
    return {
        loja_id: lojaId,
        bling_id: String(lista.id),
        sku: txt(x.codigo ?? lista.codigo),
        nome: txt(x.nome ?? lista.nome),
        preco: typeof (x.preco ?? lista.preco) === "number" ? x.preco ?? lista.preco : null,
        estoque: typeof (x.estoque?.saldoVirtualTotal ?? lista.estoque?.saldoVirtualTotal) === "number" ? x.estoque?.saldoVirtualTotal ?? lista.estoque?.saldoVirtualTotal : null,
        situacao: txt(x.situacao ?? lista.situacao),
        categoria_bling_id: x.categoria?.id ? String(x.categoria.id) : null,
        marca: txt(x.marca),
        gtin: txt(x.gtin),
        gtin_tributario: txt(x.gtinEmbalagem),
        descricao_curta: txt(x.descricaoCurta),
        descricao_complementar: txt(x.descricaoComplementar),
        peso_kg: pos(x.pesoBruto) ?? pos(x.pesoLiquido),
        largura_cm: pos(x.dimensoes?.largura),
        altura_cm: pos(x.dimensoes?.altura),
        profundidade_cm: pos(x.dimensoes?.profundidade),
        unidade: txt(x.unidade),
        condicao: x.condicao != null ? String(x.condicao) : null,
        formato: txt(x.formato ?? lista.formato),
        pai_bling_id: lista.idProdutoPai ? String(lista.idProdutoPai) : null,
        volumes: pos(x.volumes),
        sincronizado_em: agoraISO
    };
}
function precisaDetalhe(l, e, agora, maxIdadeMs = 24 * 3600_000) {
    if (!e) return true;
    const num = (v)=>v == null ? null : Number(v);
    if ((l.nome ?? null) !== (e.nome ?? null) || (l.codigo || null) !== (e.sku ?? null) || (l.situacao ?? null) !== (e.situacao ?? null)) return true;
    if (num(l.preco) !== num(e.preco) || num(l.estoque?.saldoVirtualTotal) !== num(e.estoque)) return true;
    return !e.sincronizado_em || agora - Date.parse(e.sincronizado_em) > maxIdadeMs;
}
const LIMITE = 100, INTERVALO_MS = 350;
function resumirExcluido(lojaId, item, anterior, agoraISO) {
    const base = mapearProduto(lojaId, {
        ...item,
        situacao: "E"
    }, null, agoraISO);
    return {
        ...base,
        ...anterior,
        loja_id: lojaId,
        bling_id: String(item.id),
        sku: txt(item.codigo) ?? anterior?.sku ?? null,
        nome: txt(item.nome) ?? anterior?.nome ?? null,
        preco: typeof item.preco === "number" ? item.preco : anterior?.preco ?? null,
        estoque: typeof item.estoque?.saldoVirtualTotal === "number" ? item.estoque.saldoVirtualTotal : anterior?.estoque ?? null,
        situacao: "E",
        sincronizado_em: agoraISO
    };
}
async function sincronizar(lojaId, p, orcamentoMs = 100_000) {
    const ini = p.agora();
    const r = {
        paginas: 0,
        vistos: 0,
        gravados: 0,
        detalhes: 0,
        resumosExcluidos: 0,
        ausentes: 0,
        completo: false
    };
    const ex = new Map((await p.existentes()).map((e)=>[
            e.bling_id,
            e
        ]));
    const skuDono = new Map();
    for (const e of ex.values())if (e.sku) skuDono.set(e.sku, e.bling_id);
    const vistos = new Set();
    let lote = [];
    let falhasDetalhe = 0;
    let falhasSku = 0;
    const descarregar = async ()=>{
        if (lote.length) {
            await p.gravar(lote);
            r.gravados += lote.length;
            lote = [];
        }
    };
    const incluir = async (linha)=>{
        if (linha.sku && skuDono.has(linha.sku) && skuDono.get(linha.sku) !== linha.bling_id) {
            falhasSku++;
            await p.registrarErro("SKU repetido entre IDs do Bling", {
                bling_id: linha.bling_id,
                sku: linha.sku
            });
            return;
        }
        if (linha.sku) skuDono.set(linha.sku, linha.bling_id);
        lote.push(linha);
        if (lote.length >= 50) await descarregar();
    };
    for (const grupo of [
        "ativos",
        "inativos",
        "excluidos"
    ]){
        for(let pagina = 1;; pagina++){
            if (p.agora() - ini > orcamentoMs) {
                await descarregar();
                r.erro = "tempo esgotado antes de concluir a varredura";
                return r;
            }
            const pg = await p.listarPagina(pagina, LIMITE, grupo);
            await p.espera(INTERVALO_MS);
            if ("erro" in pg) {
                await descarregar();
                r.erro = pg.erro;
                await p.registrarErro(pg.erro, {
                    pagina,
                    grupo
                });
                return r;
            }
            r.paginas++;
            for (const it of pg.itens){
                if (!Number.isSafeInteger(it.id) || it.id <= 0) {
                    await descarregar();
                    r.erro = "ID inválido na listagem do Bling";
                    await p.registrarErro(r.erro, {
                        pagina,
                        grupo
                    });
                    return r;
                }
                const id = String(it.id);
                if (vistos.has(id)) {
                    await descarregar();
                    r.erro = "ID repetido na listagem do Bling";
                    await p.registrarErro(r.erro, {
                        pagina,
                        grupo,
                        bling_id: id
                    });
                    return r;
                }
                vistos.add(id);
                r.vistos++;
                const anterior = ex.get(id);
                const listado = grupo === "excluidos" ? {
                    ...it,
                    situacao: "E"
                } : it;
                if (!precisaDetalhe(listado, anterior, p.agora())) continue;
                if (p.agora() - ini > orcamentoMs) {
                    await descarregar();
                    r.erro = "tempo esgotado durante a leitura dos detalhes";
                    return r;
                }
                const d = await p.detalhe(it.id);
                r.detalhes++;
                await p.espera(INTERVALO_MS);
                if (!d) {
                    if (grupo === "excluidos") {
                        await incluir(resumirExcluido(lojaId, listado, anterior, new Date(p.agora()).toISOString()));
                        r.resumosExcluidos++;
                        continue;
                    }
                    falhasDetalhe++;
                    await p.registrarErro("detalhe indisponível", {
                        bling_id: it.id,
                        grupo
                    });
                    continue;
                }
                const linha = mapearProduto(lojaId, listado, d, new Date(p.agora()).toISOString());
                if (grupo === "excluidos") linha.situacao = "E";
                await incluir(linha);
            }
            if (pg.itens.length < LIMITE) break;
        }
    }
    await descarregar();
    if (falhasDetalhe || falhasSku) {
        r.erro = `varredura parcial: ${falhasDetalhe} detalhes indisponíveis, ${falhasSku} conflitos de SKU`;
        return r;
    }
    if (vistos.size === 0 && ex.size > 0) {
        r.erro = "listagem vazia inesperada para loja com produtos";
        await p.registrarErro(r.erro, {
            existentes: ex.size
        });
        return r;
    }
    const ausentes = [
        ...ex.keys()
    ].filter((id)=>!vistos.has(id) && ex.get(id).situacao !== "ausente");
    if (ausentes.length) {
        await p.marcarAusentes(ausentes);
        r.ausentes = ausentes.length;
    }
    r.completo = true;
    return r;
}

return { mapearProduto: mapearProduto, precisaDetalhe: precisaDetalhe, resumirExcluido: resumirExcluido, sincronizar: sincronizar };
})();

// ---------- supabase/functions/_shared/bling_webhook.ts ----------
const __m7 = (() => {
const { mapearProduto: mapearProduto, resumirExcluido: resumirExcluido } = __m8;
const EVENTOS_ACEITOS = [
    "product.created",
    "product.updated",
    "product.deleted",
    "stock.created",
    "stock.updated",
    "stock.deleted"
];
const TAMANHO_MAX_CORPO = 64 * 1024;
const MAX_TENTATIVAS = 8;
const enc = new TextEncoder();
const hex = (b)=>[
        ...new Uint8Array(b)
    ].map((x)=>x.toString(16).padStart(2, "0")).join("");
function iguais(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for(let i = 0; i < a.length; i++)d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}
async function assinaturaValida(corpoCru, cabecalho, segredo) {
    if (!cabecalho || !segredo || !cabecalho.startsWith("sha256=")) return false;
    const chave = await crypto.subtle.importKey("raw", enc.encode(segredo), {
        name: "HMAC",
        hash: "SHA-256"
    }, false, [
        "sign"
    ]);
    const esperado = hex(await crypto.subtle.sign("HMAC", chave, enc.encode(corpoCru)));
    return iguais(esperado, cabecalho.slice("sha256=".length).toLowerCase());
}
const idBling = (v)=>typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? String(v) : typeof v === "string" && /^\d{1,20}$/.test(v) ? v : null;
function lerEvento(corpoCru) {
    if (corpoCru.length > TAMANHO_MAX_CORPO) return {
        ok: false,
        motivo: "corpo grande demais"
    };
    let j;
    try {
        j = JSON.parse(corpoCru);
    } catch  {
        return {
            ok: false,
            motivo: "JSON inválido"
        };
    }
    if (!j || typeof j !== "object" || Array.isArray(j)) return {
        ok: false,
        motivo: "formato inválido"
    };
    const o = j;
    const { eventId, date, version, event, companyId, data } = o;
    if (typeof eventId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(eventId)) return {
        ok: false,
        motivo: "eventId inválido"
    };
    if (typeof date !== "string" || Number.isNaN(Date.parse(date))) return {
        ok: false,
        motivo: "date inválida"
    };
    if (typeof companyId !== "string" || !/^[A-Za-z0-9]{8,64}$/.test(companyId)) return {
        ok: false,
        motivo: "companyId inválido"
    };
    if (typeof event !== "string" || !EVENTOS_ACEITOS.includes(event)) return {
        ok: false,
        motivo: "evento não tratado"
    };
    if (!data || typeof data !== "object" || Array.isArray(data)) return {
        ok: false,
        motivo: "data inválido"
    };
    return {
        ok: true,
        evento: {
            eventId,
            date,
            version: typeof version === "string" ? version : "v1",
            event: event,
            companyId,
            data: data
        }
    };
}
function eventoParaFila(e) {
    const produto = e.event.startsWith("product.");
    const id = idBling(produto ? e.data.id : e.data.produto?.id);
    if (!id) return null;
    const situacao = produto && typeof e.data.situacao === "string" ? e.data.situacao.slice(0, 2) : undefined;
    return {
        tipo: !produto ? "estoque" : e.event === "product.deleted" ? "inativacao" : "produto",
        bling_id: id,
        versao_origem: new Date(e.date).toISOString(),
        chave_idempotencia: e.eventId,
        payload: {
            evento: e.event,
            ...situacao ? {
                situacao
            } : {}
        }
    };
}
async function aplicarEvento(lojaId, ev, p) {
    const agoraISO = new Date(p.agora()).toISOString();
    const anterior = await p.existente(ev.bling_id);
    if (anterior?.sincronizado_em && ev.versao_origem && Date.parse(anterior.sincronizado_em) > Date.parse(ev.versao_origem)) {
        return {
            status: "ignorado",
            motivo: "espelho já sincronizado depois deste evento"
        };
    }
    if (ev.tipo === "inativacao") {
        await p.marcarExcluido(ev.bling_id, agoraISO);
        return {
            status: "aplicado",
            motivo: "produto apagado no Bling; espelho marcado como excluído"
        };
    }
    const d = await p.detalhe(Number(ev.bling_id));
    if (d === "erro") return {
        status: "erro",
        motivo: "Bling indisponível ou limite atingido; tentar de novo",
        definitivo: ev.tentativas + 1 >= MAX_TENTATIVAS
    };
    if (d === null) {
        if (ev.payload?.situacao === "E") {
            await p.gravar(resumirExcluido(lojaId, {
                id: Number(ev.bling_id)
            }, anterior, agoraISO));
            return {
                status: "aplicado",
                motivo: "excluído sem detalhe: espelho marcado como excluído"
            };
        }
        return {
            status: "erro",
            motivo: "Bling não devolveu o produto",
            definitivo: ev.tentativas + 1 >= MAX_TENTATIVAS
        };
    }
    const linha = mapearProduto(lojaId, {
        id: Number(ev.bling_id),
        idProdutoPai: typeof d?.idProdutoPai === "number" ? d.idProdutoPai : undefined
    }, d, agoraISO);
    await p.gravar(linha);
    return {
        status: "aplicado",
        motivo: ev.tipo === "estoque" ? "saldo atualizado a partir do Bling" : "produto atualizado a partir do Bling"
    };
}
function proximaTentativaEm(tentativas, agoraMs) {
    return new Date(agoraMs + Math.min(30_000 * 2 ** Math.max(0, tentativas), 3_600_000)).toISOString();
}
const LIMITE_FALHAS_SEGUIDAS = 5;
const disjuntorAberto = (falhasSeguidas)=>falhasSeguidas >= LIMITE_FALHAS_SEGUIDAS;
function agruparPorProduto(pendentes) {
    const m = new Map();
    for (const e of pendentes)(m.get(e.bling_id) ?? m.set(e.bling_id, []).get(e.bling_id)).push(e);
    return m;
}

return { EVENTOS_ACEITOS: EVENTOS_ACEITOS, TAMANHO_MAX_CORPO: TAMANHO_MAX_CORPO, MAX_TENTATIVAS: MAX_TENTATIVAS, assinaturaValida: assinaturaValida, lerEvento: lerEvento, eventoParaFila: eventoParaFila, aplicarEvento: aplicarEvento, proximaTentativaEm: proximaTentativaEm, LIMITE_FALHAS_SEGUIDAS: LIMITE_FALHAS_SEGUIDAS, disjuntorAberto: disjuntorAberto, agruparPorProduto: agruparPorProduto };
})();

// ---------- supabase/functions/bling-webhook/index.ts ----------
const __m0 = (() => {
const { createClient: createClient } = __sdk;
const { armazemSupabase: armazemSupabase } = __m1;
const { blingFetch: blingFetch } = __m2;
const { decifrar: decifrar } = __m4;
const { chaveiroPlataforma: chaveiroPlataforma } = __m6;
const { aplicarEvento: aplicarEvento, assinaturaValida: assinaturaValida, disjuntorAberto: disjuntorAberto, eventoParaFila: eventoParaFila, lerEvento: lerEvento, MAX_TENTATIVAS: MAX_TENTATIVAS, proximaTentativaEm: proximaTentativaEm, TAMANHO_MAX_CORPO: TAMANHO_MAX_CORPO } = __m7;
const json = (o, status = 200)=>new Response(JSON.stringify(o), {
        status,
        headers: {
            "Content-Type": "application/json"
        }
    });
const COLUNAS = "bling_id, sku, nome, preco, estoque, situacao, sincronizado_em, categoria_bling_id, marca, gtin, gtin_tributario, descricao_curta, descricao_complementar, peso_kg, largura_cm, altura_cm, profundidade_cm, unidade, condicao, formato, pai_bling_id, volumes";
const ESPERA_ENTRE_CHAMADAS_MS = 1000;
const ORCAMENTO_MS = 40_000;
function igual(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for(let i = 0; i < a.length; i++)d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}
function portasDaLoja(admin, lojaId, chaveCifra) {
    const arm = armazemSupabase(admin);
    const cfg = {
        chaveCifra
    };
    return {
        async detalhe (id) {
            try {
                const r = await blingFetch(arm, lojaId, `/produtos/${id}`, cfg);
                if (r.status === 404) return null;
                if (!r.ok) return "erro";
                return (await r.json().catch(()=>null))?.data ?? "erro";
            } catch  {
                return "erro";
            }
        },
        async existente (blingId) {
            const { data } = await admin.from("produtos").select(COLUNAS).eq("loja_id", lojaId).eq("bling_id", blingId).maybeSingle();
            return data ?? undefined;
        },
        async gravar (linha) {
            const l = linha.situacao === "A" ? linha : {
                ...linha,
                publicado: false
            };
            const { error } = await admin.from("produtos").upsert(l, {
                onConflict: "loja_id,bling_id"
            });
            if (error) throw new Error("falha ao gravar o espelho");
        },
        async marcarExcluido (blingId, agoraISO) {
            const { error } = await admin.from("produtos").update({
                situacao: "E",
                publicado: false,
                sincronizado_em: agoraISO
            }).eq("loja_id", lojaId).eq("bling_id", blingId);
            if (error) throw new Error("falha ao marcar o produto como excluído");
        },
        agora: ()=>Date.now()
    };
}
async function concluir(admin, ev, r, agora) {
    if (r.status === "erro") {
        await admin.rpc("bling_evento_concluir", {
            p_id: ev.id,
            p_status: "erro",
            p_motivo: r.motivo,
            p_proxima: r.definitivo ? null : proximaTentativaEm(ev.tentativas, agora)
        });
    } else {
        await admin.rpc("bling_evento_concluir", {
            p_id: ev.id,
            p_status: r.status,
            p_motivo: r.motivo
        });
    }
}
async function processarFila(admin, chaveCifra) {
    const t0 = Date.now();
    const res = {
        lidos: 0,
        aplicados: 0,
        ignorados: 0,
        erros: 0,
        pausado: false
    };
    const { data } = await admin.rpc("bling_eventos_reservar", {
        p_limite: 20
    });
    const eventos = Array.isArray(data) ? data : [];
    res.lidos = eventos.length;
    const porLoja = new Map();
    for (const e of eventos)(porLoja.get(e.loja_id) ?? porLoja.set(e.loja_id, []).get(e.loja_id)).push(e);
    let falhasSeguidas = 0;
    for (const [lojaId, lista] of porLoja){
        const portas = portasDaLoja(admin, lojaId, chaveCifra);
        const porProduto = new Map();
        for (const e of lista)(porProduto.get(e.bling_id) ?? porProduto.set(e.bling_id, []).get(e.bling_id)).push(e);
        for (const grupo of porProduto.values()){
            if (disjuntorAberto(falhasSeguidas) || Date.now() - t0 > ORCAMENTO_MS) {
                res.pausado = true;
                break;
            }
            const ordenado = [
                ...grupo
            ].sort((a, b)=>Date.parse(b.versao_origem ?? "") - Date.parse(a.versao_origem ?? ""));
            let primeiro;
            try {
                primeiro = await aplicarEvento(lojaId, ordenado[0], portas);
            } catch  {
                primeiro = {
                    status: "erro",
                    motivo: "falha ao aplicar no espelho",
                    definitivo: ordenado[0].tentativas + 1 >= MAX_TENTATIVAS
                };
            }
            await concluir(admin, ordenado[0], primeiro, Date.now());
            if (primeiro.status === "aplicado") res.aplicados++;
            else if (primeiro.status === "ignorado") res.ignorados++;
            else res.erros++;
            for (const outro of ordenado.slice(1)){
                const r = primeiro.status === "erro" ? primeiro : {
                    status: "ignorado",
                    motivo: "coberto por evento mais recente do mesmo produto"
                };
                await concluir(admin, outro, r, Date.now());
                if (r.status === "ignorado") res.ignorados++;
                else res.erros++;
            }
            falhasSeguidas = primeiro.status === "erro" ? falhasSeguidas + 1 : 0;
            await new Promise((r)=>setTimeout(r, ESPERA_ENTRE_CHAMADAS_MS));
        }
    }
    return res;
}
async function preencherCompanyIds(admin, chaveCifra) {
    const { data } = await admin.from("bling_conexoes").select("loja_id").eq("status", "conectada").is("bling_company_id", null).limit(5);
    const arm = armazemSupabase(admin);
    let n = 0;
    for (const l of data ?? []){
        try {
            const r = await blingFetch(arm, l.loja_id, "/empresas/me/dados-basicos", {
                chaveCifra
            });
            if (!r.ok) continue;
            const id = (await r.json().catch(()=>null))?.data?.id;
            if (typeof id === "string" && /^[A-Za-z0-9]{8,64}$/.test(id)) {
                const { data: ok } = await admin.rpc("bling_registrar_company", {
                    p_loja: l.loja_id,
                    p_company: id
                });
                if (ok === true) n++;
            }
        } catch  {}
        await new Promise((r)=>setTimeout(r, ESPERA_ENTRE_CHAMADAS_MS));
    }
    return n;
}
Deno.serve(async (req)=>{
    if (req.method !== "POST") return json({
        erro: "Método não permitido."
    }, 405);
    const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: {
            persistSession: false
        }
    });
    const chaveCifra = await chaveiroPlataforma(admin, (n)=>Deno.env.get(n));
    if (!chaveCifra) return json({
        erro: "Conexão com o Bling ainda não configurada no servidor."
    }, 503);
    const cron = req.headers.get("x-cron-segredo");
    if (cron) {
        const { data: esperado } = await admin.rpc("bling_cron_segredo");
        if (typeof esperado !== "string" || !esperado || !igual(cron, esperado)) return json({
            erro: "Não autorizado."
        }, 401);
        const vinculos = await preencherCompanyIds(admin, chaveCifra);
        return json({
            ok: true,
            vinculos,
            ...await processarFila(admin, chaveCifra)
        });
    }
    const tam = Number(req.headers.get("content-length") ?? "0");
    if (tam > TAMANHO_MAX_CORPO) return json({
        erro: "Corpo grande demais."
    }, 413);
    const corpo = await req.text();
    const lido = lerEvento(corpo);
    if (!lido.ok) return json({
        ok: true
    });
    const { data: lojaId } = await admin.rpc("loja_por_bling_company", {
        p_company: lido.evento.companyId
    });
    if (typeof lojaId !== "string") return json({
        ok: true
    });
    const { data: appRows } = await admin.rpc("bling_ler_app", {
        p_loja_id: lojaId
    });
    const app = Array.isArray(appRows) ? appRows[0] : appRows;
    let segredo = "";
    try {
        segredo = app?.client_secret_cifrado ? await decifrar(app.client_secret_cifrado, chaveCifra) : "";
    } catch  {
        segredo = "";
    }
    if (!await assinaturaValida(corpo, req.headers.get("x-bling-signature-256"), segredo)) return json({
        erro: "Assinatura inválida."
    }, 401);
    const linha = eventoParaFila(lido.evento);
    if (linha) {
        await admin.rpc("bling_evento_enfileirar", {
            p_loja: lojaId,
            p_tipo: linha.tipo,
            p_bling_id: linha.bling_id,
            p_versao: linha.versao_origem,
            p_chave: linha.chave_idempotencia,
            p_payload: linha.payload
        });
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(processarFila(admin, chaveCifra).catch(()=>undefined));
    }
    return json({
        ok: true
    });
});

return {  };
})();
