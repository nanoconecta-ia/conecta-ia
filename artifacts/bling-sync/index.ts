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
const __m7 = (() => {
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
async function sincronizar(lojaId, p, orcamentoMs = 100_000) {
    const ini = p.agora();
    const r = {
        paginas: 0,
        vistos: 0,
        gravados: 0,
        detalhes: 0,
        ausentes: 0,
        completo: false
    };
    const ex = new Map((await p.existentes()).map((e)=>[
            e.bling_id,
            e
        ]));
    const vistos = new Set();
    let lote = [];
    const descarregar = async ()=>{
        if (lote.length) {
            await p.gravar(lote);
            r.gravados += lote.length;
            lote = [];
        }
    };
    for (const grupo of [
        "ativos",
        "inativos"
    ]){
        for(let pagina = 1;; pagina++){
            if (p.agora() - ini > orcamentoMs) {
                await descarregar();
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
                vistos.add(String(it.id));
                r.vistos++;
                let d = null;
                if (precisaDetalhe(it, ex.get(String(it.id)), p.agora())) {
                    if (p.agora() - ini > orcamentoMs) continue;
                    d = await p.detalhe(it.id);
                    r.detalhes++;
                    await p.espera(INTERVALO_MS);
                    if (!d) {
                        await p.registrarErro("detalhe indisponível", {
                            bling_id: it.id
                        });
                        continue;
                    }
                } else continue;
                lote.push(mapearProduto(lojaId, it, d, new Date(p.agora()).toISOString()));
                if (lote.length >= 50) await descarregar();
            }
            if (pg.itens.length < LIMITE) break;
        }
    }
    await descarregar();
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

return { mapearProduto: mapearProduto, precisaDetalhe: precisaDetalhe, sincronizar: sincronizar };
})();

// ---------- supabase/functions/_shared/bling_categorias.ts ----------
const __m8 = (() => {
const LIMITE = 100, INTERVALO_MS = 350, MAX_PAGINAS = 20;
const txt = (v)=>typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 200) : null;
function mapearCategoria(lojaId, c, agoraISO) {
    const nome = txt(c.descricao);
    if (c.id == null || String(c.id).trim() === "" || !nome) return null;
    const pai = c.categoriaPai?.id;
    return {
        loja_id: lojaId,
        bling_id: String(c.id),
        nome,
        pai_bling_id: pai == null || String(pai) === "0" || String(pai) === String(c.id) ? null : String(pai),
        sincronizado_em: agoraISO
    };
}
async function sincronizarCategorias(lojaId, p) {
    const r = {
        paginas: 0,
        vistas: 0,
        gravadas: 0,
        removidas: 0,
        completo: false
    };
    const vistas = new Map();
    for(let pagina = 1; pagina <= MAX_PAGINAS; pagina++){
        const pg = await p.listarPagina(pagina, LIMITE);
        await p.espera(INTERVALO_MS);
        if ("erro" in pg) {
            r.erro = pg.erro;
            await p.registrarErro(pg.erro, {
                pagina,
                recurso: "categorias"
            });
            return r;
        }
        r.paginas++;
        for (const c of pg.itens){
            const l = mapearCategoria(lojaId, c, new Date(p.agora()).toISOString());
            if (l) vistas.set(l.bling_id, l);
        }
        if (pg.itens.length < LIMITE) {
            r.completo = true;
            break;
        }
    }
    r.vistas = vistas.size;
    if (!r.completo) {
        r.erro = "listagem de categorias incompleta";
        await p.registrarErro(r.erro, {
            recurso: "categorias"
        });
        return r;
    }
    if (vistas.size === 0) return r;
    const linhas = [
        ...vistas.values()
    ];
    await p.gravar(linhas);
    r.gravadas = linhas.length;
    const sobras = (await p.existentes()).filter((id)=>!vistas.has(id));
    if (sobras.length) {
        await p.remover(sobras);
        r.removidas = sobras.length;
    }
    return r;
}

return { mapearCategoria: mapearCategoria, sincronizarCategorias: sincronizarCategorias };
})();

// ---------- supabase/functions/bling-sync/index.ts ----------
const __m0 = (() => {
const { createClient: createClient } = __sdk;
const { armazemSupabase: armazemSupabase } = __m1;
const { blingFetch: blingFetch } = __m2;
const { chaveiroPlataforma: chaveiroPlataforma } = __m6;
const { sincronizar: sincronizar } = __m7;
const { sincronizarCategorias: sincronizarCategorias } = __m8;
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-cron-segredo",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const json = (o, status = 200)=>new Response(JSON.stringify(o), {
        status,
        headers: {
            ...CORS,
            "Content-Type": "application/json"
        }
    });
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
        async listarPagina (pagina, limite, grupo = "ativos") {
            try {
                const r = await blingFetch(arm, lojaId, `/produtos?pagina=${pagina}&limite=${limite}&criterio=${grupo === "inativos" ? 3 : 2}&tipo=T`, cfg);
                if (!r.ok) return {
                    erro: `Bling respondeu ${r.status} ao listar produtos`
                };
                const j = await r.json().catch(()=>null);
                return {
                    itens: Array.isArray(j?.data) ? j.data : []
                };
            } catch (e) {
                return {
                    erro: e instanceof Error ? e.message : "falha ao listar produtos"
                };
            }
        },
        async detalhe (id) {
            try {
                const r = await blingFetch(arm, lojaId, `/produtos/${id}`, cfg);
                if (!r.ok) return null;
                return (await r.json().catch(()=>null))?.data ?? null;
            } catch  {
                return null;
            }
        },
        async existentes () {
            const out = [];
            for(let de = 0;; de += 1000){
                const { data, error } = await admin.from("produtos").select("bling_id, sku, nome, preco, estoque, situacao, sincronizado_em").eq("loja_id", lojaId).range(de, de + 999);
                if (error) throw new Error("falha ao ler o espelho");
                out.push(...data ?? []);
                if ((data ?? []).length < 1000) break;
            }
            return out;
        },
        async gravar (linhas) {
            const inativos = linhas.filter((l)=>l.situacao !== "A").map((l)=>({
                    ...l,
                    publicado: false
                }));
            const ativos = linhas.filter((l)=>l.situacao === "A");
            for (const grupo of [
                ativos,
                inativos
            ]){
                if (!grupo.length) continue;
                const { error } = await admin.from("produtos").upsert(grupo, {
                    onConflict: "loja_id,bling_id"
                });
                if (error) throw new Error("falha ao gravar o espelho");
            }
        },
        async marcarAusentes (ids) {
            for(let i = 0; i < ids.length; i += 200){
                await admin.from("produtos").update({
                    situacao: "ausente",
                    publicado: false
                }).eq("loja_id", lojaId).in("bling_id", ids.slice(i, i + 200));
            }
        },
        async registrarErro (mensagem, detalhe) {
            await admin.from("sync_erros").insert({
                loja_id: lojaId,
                mensagem: mensagem.slice(0, 300),
                detalhe: detalhe ?? null
            });
        },
        espera: (ms)=>new Promise((r)=>setTimeout(r, ms)),
        agora: ()=>Date.now()
    };
}
function portasCategorias(admin, lojaId, chaveCifra) {
    const arm = armazemSupabase(admin);
    const cfg = {
        chaveCifra
    };
    return {
        async listarPagina (pagina, limite) {
            try {
                const r = await blingFetch(arm, lojaId, `/categorias/produtos?pagina=${pagina}&limite=${limite}`, cfg);
                if (!r.ok) return {
                    erro: `Bling respondeu ${r.status} ao listar categorias`
                };
                const j = await r.json().catch(()=>null);
                return {
                    itens: Array.isArray(j?.data) ? j.data : []
                };
            } catch (e) {
                return {
                    erro: e instanceof Error ? e.message : "falha ao listar categorias"
                };
            }
        },
        async existentes () {
            const { data, error } = await admin.from("bling_categorias").select("bling_id").eq("loja_id", lojaId).limit(5000);
            if (error) throw new Error("falha ao ler as categorias do espelho");
            return (data ?? []).map((l)=>l.bling_id);
        },
        async gravar (linhas) {
            const { error } = await admin.from("bling_categorias").upsert(linhas, {
                onConflict: "loja_id,bling_id"
            });
            if (error) throw new Error("falha ao gravar as categorias do espelho");
        },
        async remover (ids) {
            for(let i = 0; i < ids.length; i += 200)await admin.from("bling_categorias").delete().eq("loja_id", lojaId).in("bling_id", ids.slice(i, i + 200));
        },
        async registrarErro (mensagem, detalhe) {
            await admin.from("sync_erros").insert({
                loja_id: lojaId,
                mensagem: mensagem.slice(0, 300),
                detalhe: detalhe ?? null
            });
        },
        espera: (ms)=>new Promise((r)=>setTimeout(r, ms)),
        agora: ()=>Date.now()
    };
}
Deno.serve(async (req)=>{
    if (req.method === "OPTIONS") return new Response("ok", {
        headers: CORS
    });
    if (req.method !== "POST") return json({
        erro: "Método não permitido."
    }, 405);
    const url = Deno.env.get("SUPABASE_URL");
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: {
            persistSession: false
        }
    });
    const chaveCifra = await chaveiroPlataforma(admin, (n)=>Deno.env.get(n));
    if (!chaveCifra) return json({
        erro: "Conexão com o Bling ainda não configurada no servidor."
    }, 503);
    const corpo = await req.json().catch(()=>({}));
    let lojas = [];
    const enviado = req.headers.get("x-cron-segredo");
    if (enviado) {
        const { data: esperado } = await admin.rpc("bling_cron_segredo");
        if (typeof esperado !== "string" || !esperado || !igual(enviado, esperado)) return json({
            erro: "Não autorizado."
        }, 401);
        const { data } = await admin.from("bling_conexoes").select("loja_id").eq("status", "conectada");
        lojas = (data ?? []).map((l)=>l.loja_id);
    } else {
        const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY"), {
            global: {
                headers: {
                    Authorization: req.headers.get("Authorization") ?? ""
                }
            },
            auth: {
                persistSession: false
            }
        });
        const { data: u } = await usuario.auth.getUser();
        if (!u.user) return json({
            erro: "Não autenticado."
        }, 401);
        const lojaId = typeof corpo?.loja_id === "string" ? corpo.loja_id : "";
        const { data: adm } = await usuario.rpc("pode_administrar_loja", {
            p_loja_id: lojaId
        });
        if (adm !== true) return json({
            erro: "Só o responsável da loja pode sincronizar."
        }, 403);
        const { data: dentro } = await admin.rpc("limite_chamada", {
            p_chave: `bling-sync:${lojaId}`,
            p_max: 6,
            p_janela_s: 3600
        });
        if (dentro !== true) return json({
            erro: "Sincronização já pedida várias vezes. Aguarde um pouco."
        }, 429);
        lojas = [
            lojaId
        ];
    }
    const resultado = [];
    for (const lojaId of lojas){
        try {
            let cat;
            try {
                const rc = await sincronizarCategorias(lojaId, portasCategorias(admin, lojaId, chaveCifra));
                cat = {
                    vistas: rc.vistas,
                    removidas: rc.removidas,
                    completo: rc.completo && !rc.erro
                };
            } catch  {
                cat = {
                    vistas: 0,
                    removidas: 0,
                    completo: false
                };
            }
            const r = await sincronizar(lojaId, portasDaLoja(admin, lojaId, chaveCifra));
            if (r.completo) {
                await admin.from("bling_conexoes").update({
                    ultimo_sync_ok_em: new Date().toISOString(),
                    ultimo_erro: null
                }).eq("loja_id", lojaId);
                await admin.rpc("bling_categoria_taxonomia_aplicar", {
                    p_loja: lojaId
                });
            } else if (r.erro) await admin.from("bling_conexoes").update({
                ultimo_erro: r.erro.slice(0, 300)
            }).eq("loja_id", lojaId);
            resultado.push({
                categorias: cat,
                paginas: r.paginas,
                vistos: r.vistos,
                gravados: r.gravados,
                detalhes: r.detalhes,
                ausentes: r.ausentes,
                completo: r.completo,
                erro: r.erro ? true : undefined
            });
        } catch  {
            resultado.push({
                completo: false,
                erro: true
            });
        }
    }
    return json({
        lojas: lojas.length,
        resultado
    });
});

return {  };
})();
