// GERADO por scripts/gerar-autocontido.mjs. Não editar. Nenhuma publicação autorizada.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const __sdk = { createClient };

// ---------- supabase/functions/_shared/estado.ts ----------
const __m3 = (() => {
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

// ---------- supabase/functions/_shared/pair/cripto.ts ----------
const __m2 = (() => {
const { b64u: b64u } = __m3;
const enc = new TextEncoder();
function aleatorioB64u(bytes = 32) {
    const b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    return b64u(b);
}
async function sha256Hex(texto) {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texto)));
    return Array.from(d, (x)=>x.toString(16).padStart(2, "0")).join("");
}
function codigoVerificacao() {
    const limite = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf);
    while (buf[0] >= limite)
    return String(buf[0] % 1_000_000).padStart(6, "0");
}
function iguais(a, b) {
    if (a.length !== b.length) return false;
    let d = 0;
    for(let i = 0; i < a.length; i++)d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
}
const SEGREDO_RE = /^[A-Za-z0-9_-]{43,128}$/;
const HASH_RE = /^[0-9a-f]{64}$/;
function separarToken(completo) {
    const partes = (completo ?? "").split(".");
    if (partes.length !== 2 || !SEGREDO_RE.test(partes[0]) || !SEGREDO_RE.test(partes[1])) return null;
    return {
        token: partes[0],
        sal: partes[1]
    };
}
function montarUrlPareamento(appUrl, codigo) {
    if (!SEGREDO_RE.test(codigo)) throw new Error("código de pareamento inválido");
    const u = new URL(appUrl);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !local) throw new Error("APP_URL deve ser https");
    if (u.username || u.password || u.search || u.hash) throw new Error("APP_URL não pode ter credenciais, query nem fragmento");
    return `${u.origin}${u.pathname.replace(/\/+$/, "")}/#/parear?c=${codigo}`;
}
function codigoDaUrl(url) {
    const m = /#\/parear\?c=([A-Za-z0-9_-]{43,128})$/.exec(url.trim());
    return m ? m[1] : null;
}

return { aleatorioB64u: aleatorioB64u, sha256Hex: sha256Hex, codigoVerificacao: codigoVerificacao, iguais: iguais, SEGREDO_RE: SEGREDO_RE, HASH_RE: HASH_RE, separarToken: separarToken, montarUrlPareamento: montarUrlPareamento, codigoDaUrl: codigoDaUrl };
})();

// ---------- supabase/functions/_shared/pair/escopos.ts ----------
const __m4 = (() => {
const ESCOPOS = [
    "produtos:ler",
    "bling:consultar",
    "enriquecimento:propor",
    "banners:propor",
    "categorias:propor",
    "paginas:propor",
    "catalogo:propor",
    "campanhas:propor",
    "aprovacoes:ler",
    "tarefas:ler"
];
const ROTULOS = {
    "bling:consultar": "Consultar produto na API Bling (somente leitura, com fallback identificado)",
    "produtos:ler": "Ver produtos da loja (nome, SKU, preço, estoque)",
    "enriquecimento:propor": "Sugerir dados técnicos (vão para a Fila de aprovação)",
    "banners:propor": "Sugerir banners (nada é publicado sem sua aprovação)",
    "categorias:propor": "Sugerir novas categorias",
    "paginas:propor": "Sugerir alterações de páginas",
    "catalogo:propor": "Sugerir a publicação do catálogo",
    "campanhas:propor": "Sugerir campanhas e orçamentos",
    "aprovacoes:ler": "Ver quais aprovações estão pendentes",
    "tarefas:ler": "Ver o andamento das tarefas que ele pediu"
};
const TIPOS_DISPOSITIVO = [
    "navegador",
    "computador",
    "smartphone",
    "agente_externo",
    "agente_desktop"
];
const ehEscopo = (v)=>typeof v === "string" && ESCOPOS.includes(v);
function escoposValidos(v) {
    return Array.isArray(v) && v.length >= 1 && v.length <= 12 && new Set(v).size === v.length && v.every(ehEscopo);
}
const ehTipo = (v)=>typeof v === "string" && TIPOS_DISPOSITIVO.includes(v);

return { ESCOPOS: ESCOPOS, ROTULOS: ROTULOS, TIPOS_DISPOSITIVO: TIPOS_DISPOSITIVO, ehEscopo: ehEscopo, escoposValidos: escoposValidos, ehTipo: ehTipo };
})();

// ---------- supabase/functions/_shared/pair/servico.ts ----------
const __m1 = (() => {
const { aleatorioB64u: aleatorioB64u, codigoVerificacao: codigoVerificacao, HASH_RE: HASH_RE, montarUrlPareamento: montarUrlPareamento, SEGREDO_RE: SEGREDO_RE, separarToken: separarToken, sha256Hex: sha256Hex } = __m2;
const { ehTipo: ehTipo, escoposValidos: escoposValidos } = __m4;
const res = (status, corpo, headers)=>({
        status,
        corpo,
        headers
    });
const CONTROLE = /[\u0000-\u001f\u007f<>]/;
const CAP_RE = /^[a-z0-9_.:-]{3,60}$/;
async function tratarPair(req, p) {
    if (req.metodo !== "POST") return res(405, {
        erro: "Use POST."
    }, {
        Allow: "POST"
    });
    if (req.corpo.length > 8 * 1024) return res(413, {
        erro: "Corpo grande demais."
    });
    let c;
    try {
        const j = JSON.parse(req.corpo);
        if (!j || typeof j !== "object" || Array.isArray(j)) throw 0;
        c = j;
    } catch  {
        return res(400, {
            erro: "JSON inválido."
        });
    }
    const ip = req.ip ?? "?";
    switch(c.acao){
        case "iniciar":
            return iniciar(c, ip, p);
        case "consultar":
            return consultar(c, ip, p);
        case "renovar":
            return renovar(c, req.authorization, ip, p);
        case "encerrar":
            return encerrar(req.authorization, ip, p);
        default:
            return res(400, {
                erro: "Ação desconhecida."
            });
    }
}
async function iniciar(c, ip, p) {
    if (!await p.limite(`pair-iniciar:${ip}`, 10, 600)) return res(429, {
        erro: "Muitos pedidos de pareamento. Aguarde alguns minutos."
    }, {
        "Retry-After": "120"
    });
    const nome = typeof c.nome === "string" ? c.nome.trim() : "";
    if (nome.length < 1 || nome.length > 80 || CONTROLE.test(nome)) return res(400, {
        erro: "Nome do dispositivo inválido (1 a 80 caracteres, sem marcação)."
    });
    if (!ehTipo(c.tipo)) return res(400, {
        erro: "Tipo de dispositivo inválido."
    });
    if (!escoposValidos(c.escopos)) return res(400, {
        erro: "Escopos inválidos."
    });
    const caps = c.capacidades === undefined ? [] : c.capacidades;
    if (!Array.isArray(caps) || caps.length > 20 || !caps.every((x)=>typeof x === "string" && CAP_RE.test(x))) return res(400, {
        erro: "Capacidades inválidas."
    });
    if (c.tipo !== "agente_desktop" && caps.length) return res(400, {
        erro: "Capacidades só existem para agente desktop."
    });
    const dur = c.duracao_min === undefined ? 60 : c.duracao_min;
    if (!Number.isInteger(dur) || dur < 5 || dur > 480) return res(400, {
        erro: "Duração deve ficar entre 5 e 480 minutos."
    });
    const renovavel = c.renovavel === undefined ? true : c.renovavel;
    if (typeof renovavel !== "boolean") return res(400, {
        erro: "renovavel deve ser verdadeiro/falso."
    });
    if (typeof c.token_hash !== "string" || !HASH_RE.test(c.token_hash)) return res(400, {
        erro: "token_hash deve ser o SHA-256 (hex) do token gerado no dispositivo."
    });
    for(let tentativa = 0; tentativa < 3; tentativa++){
        const codigo = aleatorioB64u(32), segredo = aleatorioB64u(32), sal = aleatorioB64u(32), verificacao = codigoVerificacao();
        const { data, error } = await p.rpc("pair_iniciar", {
            p_codigo_hash: await sha256Hex(codigo),
            p_segredo_hash: await sha256Hex(segredo),
            p_verificacao_hash: await sha256Hex(verificacao),
            p_token_hash: c.token_hash,
            p_sal_hash: await sha256Hex(sal),
            p_nome: nome,
            p_tipo: c.tipo,
            p_escopos: c.escopos,
            p_capacidades: caps,
            p_duracao_min: dur,
            p_ttl_s: 120,
            p_renovavel: renovavel
        });
        if (error?.code === "23505") {
            if (tentativa === 2) break;
            continue;
        }
        if (error || !data) return res(500, {
            erro: "Não foi possível iniciar o pareamento agora."
        });
        const d = data;
        return res(200, {
            desafio_id: d.id,
            codigo,
            url: montarUrlPareamento(p.appUrl, codigo),
            verificacao,
            segredo,
            sal,
            token_formato: "<token>.<sal>",
            expira_em: d.expira_em,
            ttl_s: 120,
            renovavel
        }, {
            "Cache-Control": "no-store"
        });
    }
    return res(409, {
        erro: "Token já usado. Gere um token novo e tente de novo."
    });
}
async function consultar(c, ip, p) {
    if (typeof c.codigo !== "string" || typeof c.segredo !== "string" || !SEGREDO_RE.test(c.codigo) || !SEGREDO_RE.test(c.segredo)) return res(400, {
        erro: "Código ou segredo inválido."
    });
    const hc = await sha256Hex(c.codigo);
    if (!await p.limite(`pair-poll:${hc.slice(0, 16)}`, 90, 60) || !await p.limite(`pair-poll-ip:${ip}`, 300, 60)) return res(429, {
        erro: "Consultando rápido demais."
    }, {
        "Retry-After": "5"
    });
    const { data, error } = await p.rpc("pair_consultar", {
        p_codigo_hash: hc,
        p_segredo_hash: await sha256Hex(c.segredo)
    });
    if (error || !data) return res(500, {
        erro: "Não foi possível consultar agora."
    });
    return res(200, data, {
        "Cache-Control": "no-store"
    });
}
function bearer(a) {
    const m = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(a ?? "");
    return m ? separarToken(m[1]) : null;
}
async function renovar(c, auth, ip, p) {
    const t = bearer(auth);
    if (!t || typeof c.novo_token_hash !== "string" || !HASH_RE.test(c.novo_token_hash)) return res(400, {
        erro: "Informe o token completo atual (Authorization: Bearer <token>.<sal>) e novo_token_hash."
    });
    if (!await p.limite(`pair-renovar:${ip}`, 60, 600)) return res(429, {
        erro: "Muitas renovações."
    });
    const { data, error } = await p.rpc("pair_renovar", {
        p_token_hash: await sha256Hex(t.token),
        p_sal_hash: await sha256Hex(t.sal),
        p_novo_hash: c.novo_token_hash
    });
    const d = data;
    if (error) return res(500, {
        erro: "Não foi possível renovar agora."
    });
    return d?.ok ? res(200, data, {
        "Cache-Control": "no-store"
    }) : res(401, {
        erro: "Sessão inválida, expirada ou revogada. Faça um novo pareamento."
    });
}
async function encerrar(auth, ip, p) {
    const t = bearer(auth);
    if (!t) return res(401, {
        erro: "Informe o token completo (Authorization: Bearer <token>.<sal>)."
    });
    if (!await p.limite(`pair-encerrar:${ip}`, 30, 600)) return res(429, {
        erro: "Muitas tentativas."
    });
    const { data } = await p.rpc("pair_encerrar", {
        p_token_hash: await sha256Hex(t.token),
        p_sal_hash: await sha256Hex(t.sal)
    });
    return res(200, {
        ok: data?.ok === true
    });
}

return { tratarPair: tratarPair };
})();

// ---------- supabase/functions/pair/index.ts ----------
const __m0 = (() => {
const { createClient: createClient } = __sdk;
const { tratarPair: tratarPair } = __m1;
const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};
Deno.serve(async (req)=>{
    if (req.method === "OPTIONS") return new Response("ok", {
        headers: CORS
    });
    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) return new Response(JSON.stringify({
        erro: "Pareamento ainda não configurado no servidor."
    }), {
        status: 503,
        headers: {
            ...CORS,
            "Content-Type": "application/json"
        }
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: {
            persistSession: false
        }
    });
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined;
    const r = await tratarPair({
        metodo: req.method,
        authorization: req.headers.get("Authorization"),
        corpo: await req.text(),
        ip
    }, {
        appUrl,
        rpc: (fn, args)=>admin.rpc(fn, args),
        limite: async (chave, max, janelaS)=>(await admin.rpc("limite_chamada", {
                p_chave: chave,
                p_max: max,
                p_janela_s: janelaS
            })).data === true
    });
    return new Response(JSON.stringify(r.corpo), {
        status: r.status,
        headers: {
            ...CORS,
            "Content-Type": "application/json",
            ...r.headers ?? {}
        }
    });
});

return {  };
})();
