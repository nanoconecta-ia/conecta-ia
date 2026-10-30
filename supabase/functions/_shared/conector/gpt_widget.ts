/** UI do MCP Apps: nenhuma chave, cookie ou script externo é enviado ao iframe. */
export const URI_WIDGET_GPT = "ui://conecta-ia/gpt-workspace.html";
export const HTML_GPT_WORKSPACE = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conecta.IA — resumo do catálogo</title>
<style>
:root{font-family:Inter,system-ui,-apple-system,sans-serif;color-scheme:light dark}
*{box-sizing:border-box}body{margin:0;padding:18px;background:var(--bg,#101a27);color:var(--fg,#edf3f7)}
main{max-width:920px;margin:auto}.top{display:flex;justify-content:space-between;align-items:center;gap:12px}
.kicker{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#6ce4b6;font-weight:800}
h1{font-size:clamp(22px,4vw,34px);letter-spacing:-.04em;margin:8px 0}.status{font-size:11px;border:1px solid #638677;border-radius:99px;padding:7px 10px}
p{line-height:1.55;color:#b5c6d2;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:18px 0}.metric{padding:16px;background:#203045;border:1px solid #34465a;border-radius:12px}
.metric strong{display:block;font-size:clamp(22px,4vw,36px);letter-spacing:-.05em;margin:7px 0}.metric span{font-size:11px;color:#bed0df}
.panel{padding:16px;border:1px solid #34465a;border-radius:12px;background:#192738}.panel h2{font-size:16px;margin:0 0 12px}
ul{margin:0;padding:0;list-style:none}li{padding:10px 0;border-bottom:1px solid #354558;display:flex;justify-content:space-between;gap:10px;font-size:13px}
li:last-child{border:0}code{font-size:11px;color:#9be2c8}footer{font-size:11px;color:#b5c6d2;padding:12px 0}
@media(prefers-color-scheme:light){body{--bg:#f5f8fc;--fg:#192a3a}.metric{background:#fff;border-color:#dbe3ec}.metric span,p,footer{color:#4b6270}.panel{background:#fff;border-color:#dbe3ec}li{border-color:#dbe3ec}.kicker,code{color:#147b5c}.status{border-color:#7abca9}}
@media(max-width:440px){body{padding:12px}.grid{gap:5px}.metric{padding:10px}li{flex-wrap:wrap}}
</style></head><body><main>
<div class="top"><div class="kicker">NANOIA / CHATGPT CONNECTOR</div><div class="status">Somente leitura</div></div>
<h1>Catálogo operacional</h1><p>Resumo real da loja autorizada. Produtos, aprovações e dados técnicos permanecem sob as regras do Conecta.IA.</p>
<div id="erro" role="status"></div><section class="grid" aria-label="Indicadores">
  <div class="metric"><span>Produtos</span><strong id="produtos">—</strong></div>
  <div class="metric"><span>Publicados</span><strong id="publicados">—</strong></div>
  <div class="metric"><span>Enriquecimentos pendentes</span><strong id="pendentes">—</strong></div>
</section>
<section class="panel"><h2>Produtos ainda não publicados (amostra)</h2><ul id="lista"><li>Carregando resultado autorizado…</li></ul></section>
<footer>Não é possível cadastrar, aprovar ou alterar o Bling por este painel. Sem dados de fornecedor, custo ou segredo.</footer>
</main><script>
(function(){
  const byId=(x)=>document.getElementById(x);
  function render(payload){
    const d=payload&&typeof payload==="object"?(payload.structuredContent||payload.result?.structuredContent||payload):null;
    if(!d||!d.resumo)return;
    ["produtos","publicados"].forEach(k=>byId(k).textContent=String(d.resumo[k]??"—"));
    byId("pendentes").textContent=String(d.resumo.aguardando_aprovacao??"—");
    const ul=byId("lista");ul.replaceChildren();
    const lista=Array.isArray(d.nao_publicados)?d.nao_publicados:[];
    if(!lista.length){const li=document.createElement("li");li.textContent="Nenhum registro retornado nesta amostra.";ul.append(li);return;}
    lista.slice(0,10).forEach(p=>{
      const li=document.createElement("li"),a=document.createElement("span"),b=document.createElement("code");
      a.textContent=String(p.nome||"Produto sem nome");b.textContent=String(p.sku||"SKU não preenchido");
      li.append(a,b);ul.append(li);
    });
  }
  try{if(window.openai?.toolOutput)render(window.openai.toolOutput);}catch{}
  window.addEventListener("message",(event)=>{
    if(event.source!==window.parent)return;
    const msg=event.data;
    if(msg?.method==="ui/notifications/tool-result")render(msg.params?.result||msg.params);
  });
})();
</script></body></html>`;
