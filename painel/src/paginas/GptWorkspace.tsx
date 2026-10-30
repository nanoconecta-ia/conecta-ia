import { useEffect, useMemo, useState } from "react";
import type { Loja } from "../lib/dados.ts";
import { CONECTOR_ATIVO } from "../lib/flags.ts";
import { ir } from "../lib/rota.ts";
import { supabase } from "../supabase.ts";
import { buscarProdutosPendentes, diagnosticoCatalogo, pendenciasProduto, type ProdutoEspelho } from "../lib/qualidadeProduto.ts";
import { auditarArvore, type NoTaxonomiaCompleto } from "../lib/taxonomiaQualidade.ts";
import "./gpt-workspace.css";

type Motor = { provedor: string; modelo: string | null; principal: boolean };
type Situacao = { status: string; ultimo_sync_ok_em: string | null };
type Estado = {
  produtos: ProdutoEspelho[]; totalProdutos: number | null;
  nos: NoTaxonomiaCompleto[]; totalNos: number | null; bling: Situacao | null;
  modelos: Motor[]; aviso: string | null; carregando: boolean;
};
const inicial: Estado = { produtos: [], totalProdutos: null, nos: [], totalNos: null, bling: null, modelos: [], aviso: null, carregando: true };
const chat = () => ir(CONECTOR_ATIVO ? "/conector" : "/assistente");
const rotuloMotor = (p: string) => p === "compativel_openai" ? "GPT / OpenAI-compatible" : p === "gemini" ? "Gemini" : p === "claude" ? "Claude" : p;
const dataLocal = (t: string | null) => t ? new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "sem sincronização confirmada";

/** Estação GPT: somente consulta por RLS. Não altera produtos, prompts, chaves ou permissões. */
export function GptWorkspace({ loja }: { loja: Loja }) {
  const [estado, setEstado] = useState<Estado>(inicial);
  const [consulta, setConsulta] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(true);
  const [revisao, setRevisao] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado({ ...inicial });
    void Promise.all([
      supabase.from("produtos")
        .select("id,sku,nome,marca,gtin,descricao_curta,peso_kg,largura_cm,altura_cm,profundidade_cm,taxonomia_no_id,publicado,situacao", { count: "exact" })
        .eq("loja_id", loja.id).order("nome").limit(500),
      supabase.from("taxonomia_nos").select("id,pai_id,nome,slug,status", { count: "exact" }).limit(500),
      supabase.from("bling_conexoes").select("status,ultimo_sync_ok_em").eq("loja_id", loja.id).maybeSingle(),
      supabase.from("loja_chaves_ia").select("provedor,modelo,principal").eq("loja_id", loja.id).eq("ativa", true),
    ]).then(([p, n, b, m]) => {
      if (!ativo) return;
      const falhas = [p.error && "produtos", n.error && "taxonomia", b.error && "Bling", m.error && "provedores"].filter(Boolean);
      setEstado({
        produtos: p.error ? [] : (p.data ?? []) as ProdutoEspelho[],
        totalProdutos: p.error ? null : (p.count ?? 0),
        nos: n.error ? [] : (n.data ?? []) as NoTaxonomiaCompleto[],
        totalNos: n.error ? null : (n.count ?? 0),
        bling: b.error ? null : (b.data as Situacao | null),
        modelos: m.error ? [] : (m.data ?? []) as Motor[],
        aviso: falhas.length ? `Alguns dados não puderam ser carregados: ${falhas.join(", ")}. Confira permissões e conexão.` : null,
        carregando: false,
      });
    }).catch(() => { if (ativo) setEstado((e) => ({ ...e, carregando: false, aviso: "Não foi possível consultar a loja agora." })); });
    return () => { ativo = false; };
  }, [loja.id, revisao]);

  const diagnostico = useMemo(() => diagnosticoCatalogo(estado.produtos, estado.nos), [estado.produtos, estado.nos]);
  const arvore = useMemo(() => auditarArvore(estado.nos), [estado.nos]);
  const arvoreCompleta = estado.totalNos !== null && estado.totalNos <= estado.nos.length;
  const lista = useMemo(() => buscarProdutosPendentes(estado.produtos, consulta, somentePendentes).slice(0, 12), [estado.produtos, consulta, somentePendentes]);
  const parcial = (estado.totalProdutos ?? 0) > estado.produtos.length || (estado.totalNos ?? 0) > estado.nos.length;
  const modeloPrincipal = estado.modelos.find((p) => p.principal) ?? estado.modelos[0];

  return <div className="gptw">
    <section className="gptw-hero" aria-labelledby="gptw-title">
      <div className="gptw-hero-conteudo">
        <span className="gptw-kicker">CONECTA.IA / AGENT WORKSPACE</span>
        <h1 id="gptw-title">NanoIA <em>GPT Workspace</em></h1>
        <p>Centro de operação multimodelo. A IA organiza e propõe; as regras, fontes e aprovações permanecem no Conecta.IA. O Bling continua sendo a origem do cadastro.</p>
        <div className="gptw-acoes">
          <button type="button" onClick={chat} className="gptw-acao">Abrir {CONECTOR_ATIVO ? "NanoIA" : "assistente atual"} <span aria-hidden="true">↗</span></button>
          <button type="button" className="gptw-secundario" onClick={() => ir("/catalogo")}>Explorar catálogo</button>
        </div>
        <p className="gptw-observacao" role="status">{CONECTOR_ATIVO ? "Interface do conector liberada neste build; confirme a implantação no servidor." : "Novo conector indisponível neste build. O assistente atual permanece acessível."}</p>
      </div>
      <div className="gptw-hero-painel">
        <span className="gptw-mini">MODO DE OPERAÇÃO</span>
        <strong>Leitura + propostas</strong>
        <span className="gptw-progresso"><i /></span>
        <div className="gptw-pilulas"><span>Sem escrita automática</span><span>Multimodelo</span><span>RLS por loja</span></div>
        <p>Memória operacional: histórico e fontes autorizadas do Conecta.IA. Não importa a memória privada do ChatGPT nem envia custos e fornecedores automaticamente.</p>
      </div>
    </section>

    <div className="gptw-status" aria-label="Conexões e serviços">
      <span><i className={estado.bling?.status === "conectada" ? "gptw-dot ok" : "gptw-dot"} /> Bling: {estado.carregando ? "consultando" : estado.bling?.status ?? "não verificado"}</span>
      <span>Última sincronização: {dataLocal(estado.bling?.ultimo_sync_ok_em ?? null)}</span>
      <span>Motor preferencial: {modeloPrincipal ? rotuloMotor(modeloPrincipal.provedor) : "não confirmado"}</span>
      <button type="button" onClick={() => setRevisao((v) => v + 1)} disabled={estado.carregando}>Atualizar dados</button>
    </div>
    {estado.aviso && <p className="gptw-aviso" role="alert">{estado.aviso}</p>}
    {parcial && <p className="gptw-aviso">Indicadores calculados sobre uma amostra de até 500 registros por coleção; não são totais completos.</p>}

    <section className="gptw-metricas" aria-label="Qualidade do catálogo">
      <article><span>Produtos analisados</span><strong>{estado.totalProdutos ?? "—"}</strong><small>Espelho com escopo da loja</small></article>
      <article><span>Sem marca</span><strong>{estado.carregando || estado.totalProdutos == null ? "—" : diagnostico.semMarca}</strong><small>Exigem identificação real</small></article>
      <article><span>Logística incompleta</span><strong>{estado.carregando || estado.totalProdutos == null ? "—" : diagnostico.logisticaIncompleta}</strong><small>Peso e dimensões</small></article>
      <article><span>Nós a homologar</span><strong>{estado.carregando || estado.totalNos == null ? "—" : diagnostico.nosPropostos}</strong><small>De {estado.totalNos ?? "—"} nós acessíveis</small></article>
    </section>

    <div className="gptw-grade">
      <section className="gptw-modulo gptw-lista" aria-labelledby="gptw-fila-title">
        <header className="gptw-modulo-topo">
          <div><span className="gptw-mini">QUALIDADE / CATÁLOGO</span><h2 id="gptw-fila-title">Fila técnica de produtos</h2><p>Triagem por dados ausentes, sem inventar OEM, medidas ou aplicações.</p></div>
          <button type="button" className="gptw-link" onClick={() => ir("/fila")}>Fila de aprovação ↗</button>
        </header>
        <div className="gptw-filtros">
          <label htmlFor="gptw-busca" className="gptw-busca-label">Localizar produto</label>
          <input id="gptw-busca" value={consulta} onChange={(e) => setConsulta(e.target.value)} placeholder="Nome, código SKU ou marca" />
          <label className="gptw-check"><input type="checkbox" checked={somentePendentes} onChange={(e) => setSomentePendentes(e.target.checked)} /> Apenas com pendências</label>
        </div>
        <div className="gptw-produtos" aria-live="polite">
          {estado.carregando ? <p className="gptw-vazio">Consultando dados autorizados…</p>
          : lista.length === 0 ? <p className="gptw-vazio">Nenhum produto encontrado neste filtro ou sem permissão de leitura.</p>
          : lista.map((p) => {
            const faltas = pendenciasProduto(p);
            return <article className="gptw-produto" key={p.id}>
              <div><strong>{p.nome || "Produto sem nome"}</strong><small>{p.sku || "SKU ausente"} · {p.marca || "Marca não identificada"}</small>
                <div className="gptw-tags">{faltas.length ? faltas.map((f) => <span key={f}>{f}</span>) : <span className="completo">Sem pendências básicas</span>}</div>
              </div>
              <button type="button" onClick={() => ir(CONECTOR_ATIVO ? `/studio?produto=${encodeURIComponent(p.id)}` : "/catalogo")} aria-label={`Revisar ${p.nome || p.sku || "produto"}`}>Revisar ↗</button>
            </article>;
          })}
        </div>
      </section>

      <aside className="gptw-lateral" aria-label="Módulos do orquestrador">
        <section className="gptw-modulo">
          <span className="gptw-mini">ORQUESTRAÇÃO</span><h2>Motores de IA</h2>
          <p>Seleção de provedor por loja, mantendo os dados técnicos e o ERP no núcleo nativo.</p>
          {estado.modelos.length ? <ul className="gptw-motores">{estado.modelos.map((m) => <li key={m.provedor}><strong>{rotuloMotor(m.provedor)}</strong><span>{m.principal ? "Preferencial" : "Alternativo"} · configurado, não testado</span></li>)}</ul>
            : <p className="gptw-vazio">Nenhum motor disponível na leitura atual.</p>}
          <button type="button" className="gptw-link" onClick={() => ir("/integracoes")}>Gerenciar integrações ↗</button>
        </section>
        <section className="gptw-modulo">
          <span className="gptw-mini">TAXONOMIA / RASTREABILIDADE</span><h2>Árvore técnica</h2>
          <p>Montadora → veículo/versão → motor → peça → SKU. Referência cruzada não comprova equivalência.</p>
          <div className="gptw-taxo">
            <span>Nós propostos <b>{estado.totalNos == null ? "—" : diagnostico.nosPropostos}</b></span>
            <span>Produtos sem nó <b>{estado.totalProdutos == null ? "—" : diagnostico.semTaxonomia}</b></span>
            <span>Nós órfãos <b>{arvoreCompleta ? arvore.orfaos.length : "—"}</b></span>
            <span>Ciclos na árvore <b>{arvoreCompleta ? arvore.ciclos.length : "—"}</b></span>
            <span>Duplicidades entre irmãos <b>{arvoreCompleta ? arvore.duplicados.length : "—"}</b></span>
          </div>
          <button type="button" className="gptw-link" onClick={() => ir("/taxonomia")}>Abrir taxonomia ↗</button>
        </section>
        <section className="gptw-modulo">
          <span className="gptw-mini">AUTOMAÇÕES COM CONTROLE</span><h2>Processos auditáveis</h2>
          <p>Capturar → identificar → cruzar fontes → propor → aprovar → reconciliar. Nenhuma etapa publica ou grava no Bling sem autorização específica.</p>
          <div className="gptw-atalhos">
            <button type="button" onClick={() => ir("/bling")}>Bling</button>
            <button type="button" onClick={() => ir("/catalogo")}>Produtos</button>
            <button type="button" onClick={() => ir("/fila")}>Aprovações</button>
          </div>
        </section>
      </aside>
    </div>
  </div>;
}
