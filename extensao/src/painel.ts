// Painel lateral do Nano Guardião.
// Fase 1 (piloto): lê a tela do ERP, reconhece o cadastro de produto pelo mapa (a confirmar), mostra o que falta, sugere tags.
// Fase 2: conecta à loja pelo Conecta Pair (aprovação do lojista no painel), compara a tela com o ESPELHO do Conecta.IA
// e envia PROPOSTAS com fonte para a Fila de aprovação. Nunca preenche, salva ou escreve no ERP.
import { MAPA_PRODUTO_BLING } from "./mapa-produto.ts";
import { reconhecer, type Reconhecimento } from "./reconhecer.ts";
import { sugerir } from "./sugestoes.ts";
import { estruturaParaRegistro, type Leitura } from "./registro.ts";
import { chamarFerramenta, consultarPareamento, encerrarPareamento, iniciarPareamento, SessaoExpirada, tokenCompleto, type Desafio } from "./pareamento.ts";
import { compararComEspelho, montarProposta, PROPONIVEIS, type ProdutoEspelho } from "./espelho.ts";
import { conferido, planejarPreenchimento, type ItemPreenchimento, type ValorAprovado } from "./preenchimento.ts";
import type { AlvoCampo, ResultadoPreencher } from "./leitor-dom.ts";

/** Tudo que depende do navegador fica aqui, para o teste visual rodar o painel real sem Chrome. */
export interface Ambiente {
  lerAba(): Promise<Leitura | { erro: string }>;
  abrirAba(url: string): void;
  guardar(v: Conexao | null): Promise<void>;
  carregar(): Promise<Conexao | null>;
  esperar(ms: number): Promise<void>;
  baixar(nome: string, conteudo: string): void;
  /** Fase 3: preenche UM campo na aba do ERP (nunca salva). */
  preencher(alvo: AlvoCampo, valor: string): Promise<ResultadoPreencher>;
}
export interface Conexao { token: string; loja_id: string; expira_em: string }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
let amb: Ambiente;
let conexao: Conexao | null = null;
let ultima: { leitura: Leitura; r: Reconhecimento } | null = null;
let pareando = false;

// ---------------------------------------------------------------------------------------------- conexão com a loja
function mostrarConexao(): void {
  const el = $("loja");
  if (conexao) el.innerHTML = `<p class="estado"><span class="ponto ok"></span>Conectado à loja <small>até ${esc(new Date(conexao.expira_em).toLocaleString("pt-BR"))}</small></p><button id="desconectar" type="button" class="sec">Desconectar</button>`;
  else if (!pareando) el.innerHTML = `<p class="aviso">Conecte à sua loja para comparar com o espelho e enviar propostas para a Fila de aprovação.</p><button id="conectar" type="button" class="sec">Conectar à loja</button>`;
  $("desconectar")?.addEventListener("click", () => void desconectar());
  $("conectar")?.addEventListener("click", () => void conectar());
}

async function conectar(): Promise<void> {
  const el = $("loja"); pareando = true;
  let d: Desafio;
  try { d = await iniciarPareamento("Nano.IA Guardião (navegador)"); }
  catch (e) { pareando = false; mostrarConexao(); $("erro").textContent = (e as Error).message; return; }
  el.innerHTML = `<p class="estado"><span class="ponto atencao"></span>Aguardando sua aprovação</p>
    <p class="aviso">Abra a aprovação no painel do Conecta.IA e confira o código <b class="codigo">${esc(d.verificacao)}</b>. Permissões pedidas: ler produtos e <b>propor</b> (nunca aprovar nem gravar no ERP).</p>
    <button id="abrir-aprovacao" type="button">Abrir aprovação</button>`;
  $("abrir-aprovacao").addEventListener("click", () => amb.abrirAba(d.url));
  const limite = Date.parse(d.expira_em) || Date.now() + 120_000;
  while (pareando && Date.now() < limite + 5000) {
    await amb.esperar(3000);
    let s;
    try { s = await consultarPareamento(d); } catch { continue; }
    if (s.estado === "pendente") continue;
    pareando = false;
    if (s.estado === "resgatado") { conexao = { token: tokenCompleto(d.metade, d.sal), loja_id: s.loja_id, expira_em: s.sessao_expira_em }; await amb.guardar(conexao); }
    else $("erro").textContent = s.estado === "recusado" ? "Pareamento recusado no painel." : "O pedido expirou. Tente conectar de novo.";
    mostrarConexao(); if (conexao && ultima) void compararEspelho(); return;
  }
  pareando = false; $("erro").textContent = "O pedido expirou. Tente conectar de novo."; mostrarConexao();
}

async function desconectar(): Promise<void> {
  if (conexao) await encerrarPareamento(conexao.token);
  conexao = null; await amb.guardar(null); $("espelho").innerHTML = ""; mostrarConexao(); if (ultima) mostrar(ultima.leitura);
}

async function comSessao<T>(f: (token: string) => Promise<T>): Promise<T> {
  if (!conexao) throw new Error("Conecte à loja primeiro.");
  try { return await f(conexao.token); }
  catch (e) { if (e instanceof SessaoExpirada) { conexao = null; await amb.guardar(null); mostrarConexao(); } throw e; }
}

// ---------------------------------------------------------------------------------------------- tela e espelho
const skuDaTela = (r: Reconhecimento) => r.casados.find((c) => c.mapa.canonico === "codigo")?.lido.valor.trim() ?? "";

async function compararEspelho(): Promise<void> {
  if (!ultima || !conexao || ultima.r.estado !== "reconhecida") return;
  const el = $("espelho"), sku = skuDaTela(ultima.r);
  if (!sku) { el.innerHTML = `<li class="suave">Sem código (SKU) na tela: não dá para achar o produto no espelho.</li>`; return; }
  el.innerHTML = `<li class="suave">Consultando o espelho do Conecta.IA…</li>`;
  try {
    const p = await comSessao((t) => chamarFerramenta<ProdutoEspelho & { erro?: string }>(t, "conecta.get_product", { sku }));
    if (p.erro) { el.innerHTML = `<li class="suave">SKU ${esc(sku)} não está no espelho desta loja. Sincronize o Bling no painel.</li>`; return; }
    const div = compararComEspelho(ultima.r, p);
    const falta = p.faltando_para_publicar ?? [];
    el.innerHTML = (div.length ? div.map((d) => `<li><b>${esc(d.campo)}</b> difere do espelho<p>Tela: ${esc(d.tela.slice(0, 80))}</p><p>Espelho: ${esc(d.espelho.slice(0, 80))}</p><small>O espelho pode estar desatualizado: confira a sincronização com o Bling.</small></li>`).join("") : `<li><b>Tela e espelho iguais</b> <small>nos campos comparados (nome, marca, GTIN, descrição curta).</small></li>`)
      + `<li><b>${p.publicado ? "Publicado no site" : "Ainda não publicado"}</b>${falta.length ? ` <small>Falta para publicar: ${esc(falta.join(", "))}.</small>` : ""}</li>`
      + (p.automacao_pausada ? `<li class="suave">Automação pausada para este produto: propostas serão recusadas.</li>` : "");
    void carregarAprovados(sku);
  } catch (e) { el.innerHTML = `<li class="erro">${esc((e as Error).message)}</li>`; }
}

// ---------------------------------------------------------------------------------------------- fase 3: preencher aprovados
const historico: string[] = [];
function registrarLocal(t: string): void {
  historico.unshift(`${new Date().toLocaleTimeString("pt-BR")} · ${t}`);
  $("historico").innerHTML = historico.slice(0, 20).map((h) => `<li>${esc(h)}</li>`).join("");
  $("bloco-historico").hidden = false;
}

async function carregarAprovados(sku: string): Promise<void> {
  const el = $("aprovados"); $("bloco-aprovados").hidden = false;
  el.innerHTML = `<li class="suave">Buscando valores já aprovados na Fila…</li>`;
  try {
    const d = await comSessao((t) => chamarFerramenta<{ campos?: ValorAprovado[]; erro?: string }>(t, "conecta.get_validated_fields", { sku }));
    if (d.erro || !ultima) { el.innerHTML = `<li class="suave">${esc(d.erro ?? "Sem leitura da tela.")}</li>`; return; }
    desenharAprovados(planejarPreenchimento(ultima.r, d.campos ?? []), sku);
  } catch (e) {
    const m = (e as Error).message;
    el.innerHTML = `<li class="suave">${/desconhecida/i.test(m) ? "O servidor do Conecta.IA ainda não tem a fase 3 (publicar o conecta-gateway atualizado). Nada a preencher por enquanto." : esc(m)}</li>`;
  }
}

function desenharAprovados(itens: ItemPreenchimento[], sku: string): void {
  const el = $("aprovados");
  if (!itens.length) { el.innerHTML = `<li class="suave">Nenhum valor aprovado na Fila para o SKU ${esc(sku)} ainda.</li>`; return; }
  el.innerHTML = itens.map((i, n) => {
    const origem = `<small>Fonte: ${esc(i.fonte ?? "—")}${i.aprovadoEm ? ` · aprovado em ${esc(new Date(i.aprovadoEm).toLocaleDateString("pt-BR"))}` : ""}</small>`;
    const corpo = i.acao === "igual" ? `<small class="ok">Já está na tela.</small>`
      : i.acao === "bloqueado" ? `<small>${esc(i.motivo ?? "")}</small>`
      : `${i.acao === "substituir" ? `<p>Na tela: ${esc(i.atual.slice(0, 80))}</p>` : ""}<p>Aprovado: ${esc(i.novo.slice(0, 120))}</p>${origem}
         ${i.acao === "substituir" ? `<label class="confirma"><input type="checkbox" data-n="${n}"> Substituir o valor que está na tela</label>` : ""}
         <button type="button" class="mini preencher" data-n="${n}" ${i.acao === "substituir" ? "disabled" : ""}>Preencher na tela</button>`;
    return `<li data-n="${n}"><b>${esc(i.descricao)}</b> ${corpo}</li>`;
  }).join("");
  el.querySelectorAll<HTMLInputElement>("label.confirma input").forEach((c) => c.addEventListener("change", () => { (el.querySelector(`button.preencher[data-n="${c.dataset.n}"]`) as HTMLButtonElement).disabled = !c.checked; }));
  el.querySelectorAll<HTMLButtonElement>("button.preencher").forEach((b) => b.addEventListener("click", () => void preencher(itens[Number(b.dataset.n)], b.closest("li")!)));
}

async function preencher(i: ItemPreenchimento, li: HTMLElement): Promise<void> {
  li.querySelectorAll("button").forEach((b) => (b as HTMLButtonElement).disabled = true);
  const r = await amb.preencher(i.alvo, i.novo).catch(() => ({ ok: false, erro: "Não consegui falar com a aba do ERP." } as ResultadoPreencher));
  if (!r.ok) { li.insertAdjacentHTML("beforeend", `<small class="erro"> ${esc(r.erro ?? "Falhou.")}</small>`); registrarLocal(`${i.descricao}: não preenchido (${r.erro})`); return; }
  // conferência: lê a tela de novo e compara com o valor aprovado (não confia só no retorno do preenchimento)
  const nova = await amb.lerAba().catch(() => null);
  const lido = nova && !("erro" in nova) ? nova.campos.find((c) => c.rotulo === i.alvo.rotulo)?.valor ?? r.depois ?? "" : r.depois ?? "";
  const ok = conferido(lido, i.novo);
  li.innerHTML = `<b>${esc(i.descricao)}</b> <small class="${ok ? "ok" : "erro"}">${ok ? "Preenchido e conferido na tela. Revise e clique em salvar no ERP." : "Preenchido, mas a tela mostra outro valor: confira antes de salvar."}</small> <button type="button" class="sec mini desfazer">Desfazer</button>`;
  registrarLocal(`${i.descricao}: ${ok ? "preenchido e conferido" : "divergente após preencher"} (aprovação ${i.aprovadoId.slice(0, 8)})`);
  li.querySelector("button.desfazer")!.addEventListener("click", () => void (async () => {
    const d = await amb.preencher(i.alvo, r.antes ?? "").catch(() => ({ ok: false } as ResultadoPreencher));
    li.innerHTML = `<b>${esc(i.descricao)}</b> <small class="${d.ok ? "" : "erro"}">${d.ok ? "Desfeito: a tela voltou ao valor anterior." : "Não consegui desfazer: corrija à mão antes de salvar."}</small>`;
    registrarLocal(`${i.descricao}: ${d.ok ? "desfeito" : "falha ao desfazer"}`);
  })());
}

function formProposta(li: HTMLElement, canonico: string): void {
  if (li.querySelector("form")) return;
  const f = document.createElement("form"); f.className = "proposta";
  f.innerHTML = `<label>Valor<input name="valor" required autocomplete="off"></label><label>Fonte (link ou documento)<input name="fonte" required autocomplete="off" placeholder="https://fabricante…"></label><div class="linha"><button type="submit">Enviar proposta</button><button type="button" class="sec cancelar">Cancelar</button></div><p class="msg" role="status"></p>`;
  li.append(f);
  f.querySelector(".cancelar")!.addEventListener("click", () => f.remove());
  f.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const msg = f.querySelector(".msg")!, dados = new FormData(f);
    void (async () => {
      try {
        const { ferramenta, args } = montarProposta(canonico, skuDaTela(ultima!.r), String(dados.get("valor") ?? ""), String(dados.get("fonte") ?? ""));
        await comSessao((t) => chamarFerramenta(t, ferramenta, args));
        li.innerHTML = `<b>${esc(li.dataset.campo ?? "")}</b> <small class="ok">Proposta enviada à Fila de aprovação como “a confirmar”. Nada foi gravado no ERP.</small>`;
      } catch (e) { msg.textContent = (e as Error).message; msg.classList.add("erro"); }
    })();
  });
}

/** Monta o painel a partir de uma leitura. */
export function mostrar(leitura: Leitura): void {
  const r = reconhecer(leitura.campos, MAPA_PRODUTO_BLING);
  const { sugestoes, pendencias } = sugerir(r);
  ultima = { leitura, r };
  const reconhecida = r.estado === "reconhecida";
  $("estado").innerHTML = reconhecida
    ? `<span class="ponto ok"></span>Cadastro de produto reconhecido <small>(mapa v${r.versaoMapa}${r.mapaConferido ? "" : " · a confirmar"})</small>`
    : `<span class="ponto atencao"></span>Tela não reconhecida <small>— o Nano não sugere nada aqui</small>`;
  $("site").textContent = `${leitura.origem}${leitura.caminho}`;
  $("campos").innerHTML = reconhecida ? r.casados.map((c) => `<li><span class="rot">${esc(c.mapa.descricao)}</span><span class="val ${c.lido.mascarado ? "oculto" : c.lido.valor.trim() ? "" : "vazio"}">${c.lido.mascarado ? "oculto" : c.lido.valor.trim() ? esc(c.lido.valor.slice(0, 80)) : "vazio"}</span></li>`).join("") : "";
  $("sugestoes").innerHTML = sugestoes.map((s) => `<li><b>${esc(s.campo)}</b><p>${esc(s.valor)}</p><small>Origem: ${esc(s.origem)}. Não aplicado: copie se quiser usar.</small></li>`).join("") || (reconhecida ? "<li class=\"suave\">Sem sugestões nesta tela.</li>" : "");
  $("pendencias").innerHTML = pendencias.map((p) => `<li data-canonico="${esc(p.canonico)}" data-campo="${esc(p.campo)}"><b>${esc(p.campo)}</b> <small>${esc(p.motivo)}</small>${conexao && PROPONIVEIS[p.canonico] ? ` <button type="button" class="sec mini propor">Propor com fonte</button>` : ""}</li>`).join("") || (reconhecida ? "<li class=\"suave\">Nenhum campo essencial vazio.</li>" : "");
  $("pendencias").querySelectorAll<HTMLButtonElement>("button.propor").forEach((b) => b.addEventListener("click", () => formProposta(b.closest("li")!, b.closest("li")!.dataset.canonico!)));
  $("bloco-espelho").hidden = !(reconhecida && conexao);
  $("bloco-aprovados").hidden = true;
  $("resultado").hidden = false;
  $("registrar").removeAttribute("disabled");
  if (reconhecida && conexao) void compararEspelho();
}

export async function iniciar(a: Ambiente): Promise<void> {
  amb = a;
  conexao = await amb.carregar();
  if (conexao && Date.parse(conexao.expira_em) < Date.now()) { conexao = null; await amb.guardar(null); }
  mostrarConexao();
  $("ler").addEventListener("click", () => { $("erro").textContent = ""; void amb.lerAba().then((l) => { if ("erro" in l) $("erro").textContent = l.erro; else mostrar(l); }).catch(() => { $("erro").textContent = "Não consegui ler esta página."; }); });
  $("registrar").addEventListener("click", () => { if (ultima) amb.baixar(`nano-guardiao-tela-${Date.now()}.json`, JSON.stringify(estruturaParaRegistro(ultima.leitura, ultima.r), null, 2)); });
}

// ---------------------------------------------------------------------------------------------- ambiente real (Chrome/Edge)
const ambienteChrome: Ambiente = {
  async lerAba() {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!aba?.id || !aba.url || !/^https:\/\//.test(aba.url)) return { erro: "Abra o cadastro de produto do ERP numa aba https e tente de novo." };
    const origem = new URL(aba.url).origin;
    if (!(await chrome.permissions.request({ origins: [`${origem}/*`] }))) return { erro: `Sem permissão para ler ${origem}. Nada foi lido.` };
    await chrome.scripting.executeScript({ target: { tabId: aba.id }, files: ["conteudo.js"] });
    const [res] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: () => window.__nanoGuardiaoLer?.() ?? null });
    return (res?.result as Leitura | null) ?? { erro: "Não consegui ler esta página." };
  },
  abrirAba: (url) => { void chrome.tabs.create({ url }); },
  // Sessão do navegador: o token some ao fechar o navegador (nunca vai para disco nem para sincronização).
  guardar: async (v) => { if (v) await chrome.storage.session.set({ conexao: v }); else await chrome.storage.session.remove("conexao"); },
  carregar: async () => ((await chrome.storage.session.get("conexao")).conexao as Conexao | undefined) ?? null,
  esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
  async preencher(alvo, valor) {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!aba?.id) return { ok: false, erro: "Aba do ERP não encontrada." };
    const [res] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: (a: AlvoCampo, v: string) => window.__nanoGuardiaoPreencher?.(a, v) ?? { ok: false, erro: "Leia a tela antes de preencher." }, args: [alvo, valor] });
    return (res?.result as ResultadoPreencher | undefined) ?? { ok: false, erro: "Sem resposta da aba do ERP." };
  },
  baixar: (nome, conteudo) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([conteudo], { type: "application/json" })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); },
};

if (typeof chrome !== "undefined" && chrome.tabs) void iniciar(ambienteChrome);
Object.assign(window as object, { __nanoIniciar: iniciar, __nanoMostrar: mostrar });
