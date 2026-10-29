import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { Icone } from "../componentes/Icone.tsx";
import { totalLegivel, estadoBling, linkFonteSegura } from "../lib/dashboard.ts";
import "./visao-geral.css";

type Notificacao = { id: string; titulo: string; corpo: string | null; severidade: string; fonte_url: string | null; lida_em: string | null };
type Contadores = { produtos: number | null; publicados: number | null; pendentes: number | null };
const INDICADORES = [
  { id: "produtos", titulo: "Produtos espelhados", icone: "catalogo", descricao: "Catálogo sincronizado com o ERP" },
  { id: "publicados", titulo: "Produtos na vitrine", icone: "loja", descricao: "Visíveis aos clientes" },
  { id: "pendentes", titulo: "Revisões pendentes", icone: "fila", descricao: "Aguardando decisão do lojista" },
] as const;

const ACESSOS = [
  { titulo: "Conversar com Nano.IA", descricao: "Consultar produtos e preparar propostas", rota: "/assistente", icone: "agentes", destaque: true },
  { titulo: "Catálogo inteligente", descricao: "Produtos, marcas, aplicações e SKUs", rota: "/catalogo", icone: "catalogo" },
  { titulo: "Fila de aprovação", descricao: "Revisar sugestões antes de qualquer alteração", rota: "/fila", icone: "escudo" },
  { titulo: "Conexão com o Bling", descricao: "Consultar a situação do espelhamento", rota: "/bling", icone: "erp" },
  { titulo: "Taxonomia técnica", descricao: "Organizar famílias e categorias de peças", rota: "/taxonomia", icone: "arvore" },
  { titulo: "Imagens e SEO", descricao: "Conferir fotos e dados de publicação", rota: "/imagens", icone: "imagem" },
] as const;

/** Tela de comando: apenas leituras. Nenhuma ação do dashboard escreve no Bling. */
export function VisaoGeral({ loja }: { loja: Loja }) {
  const [conexao, setConexao] = useState<string | null>(null);
  const [contadores, setContadores] = useState<Contadores>({ produtos: null, publicados: null, pendentes: null });
  const [avisos, setAvisos] = useState<Notificacao[]>([]);
  const [avisosErro, setAvisosErro] = useState("");
  const [resolvendo, setResolvendo] = useState<string | null>(null);

  async function carregarAvisos(lojaId: string) {
    return supabase.from("notificacoes")
      .select("id, titulo, corpo, severidade, fonte_url, lida_em")
      .eq("loja_id", lojaId)
      .is("resolvida_em", null)
      .order("criada_em", { ascending: false })
      .limit(20);
  }

  useEffect(() => {
    let ativo = true;
    setConexao(null);
    setContadores({ produtos: null, publicados: null, pendentes: null });
    setAvisos([]);
    setAvisosErro("");

    void Promise.all([
      supabase.from("bling_conexoes").select("status").eq("loja_id", loja.id).maybeSingle(),
      supabase.from("produtos").select("id", { count: "exact", head: true }).eq("loja_id", loja.id),
      supabase.from("produtos").select("id", { count: "exact", head: true }).eq("loja_id", loja.id).eq("publicado", true),
      supabase.from("produto_enriquecimento").select("id", { count: "exact", head: true }).eq("loja_id", loja.id).eq("status", "a_confirmar"),
      carregarAvisos(loja.id),
    ]).then(([bling, produtos, publicados, pendentes, notificacoes]) => {
      if (!ativo) return;
      setConexao(bling.error ? "indisponível" : bling.data?.status ?? "pendente");
      setContadores({
        produtos: produtos.error ? null : produtos.count ?? 0,
        publicados: publicados.error ? null : publicados.count ?? 0,
        pendentes: pendentes.error ? null : pendentes.count ?? 0,
      });
      if (notificacoes.error) setAvisosErro("Não foi possível consultar os avisos desta loja.");
      else setAvisos((notificacoes.data ?? []) as Notificacao[]);
    }).catch(() => { if (ativo) { setConexao("indisponível"); setAvisosErro("Serviço de consulta indisponível."); } });
    return () => { ativo = false; };
  }, [loja.id]);

  async function resolver(id: string) {
    setResolvendo(id);
    setAvisosErro("");
    // Mesmo com RLS, restringir explicitamente toda atualização à loja corrente.
    const { error } = await supabase.from("notificacoes")
      .update({ resolvida_em: new Date().toISOString() })
      .eq("loja_id", loja.id).eq("id", id);
    if (error) {
      setAvisosErro("Não foi possível resolver este aviso. Tente novamente.");
    } else {
      const { data, error: erroConsulta } = await carregarAvisos(loja.id);
      if (erroConsulta) setAvisosErro("Aviso atualizado, mas não foi possível atualizar a lista.");
      else setAvisos((data ?? []) as Notificacao[]);
    }
    setResolvendo(null);
  }

  const bling = estadoBling(conexao);
  return (
    <div className="visao-premium">
      <section className="visao-hero" aria-labelledby="visao-titulo">
        <div className="visao-hero-conteudo">
          <span className="visao-eyebrow"><span className="visao-pulso" /> CENTRAL DE OPERAÇÕES · CONECTA.IA</span>
          <h1 id="visao-titulo">Sua loja, sob <em>controle.</em></h1>
          <p>Bom trabalho, equipe {loja.nome}. Um painel para acompanhar o catálogo, conversar com o Nano.IA e revisar propostas antes de qualquer mudança no Bling.</p>
          <div className="visao-hero-acoes">
            <a className="visao-acao-primaria" href="#/assistente"><Icone nome="agentes" tamanho={19} /> Abrir Nano.IA</a>
            <a className="visao-acao-secundaria" href="#/catalogo"><Icone nome="catalogo" tamanho={18} /> Explorar catálogo</a>
          </div>
          <div className="visao-ambiente">Loja: <strong>{loja.nome}</strong><span aria-hidden="true">•</span>Ambiente: <strong>{loja.ambiente === "teste" ? "Teste" : loja.ambiente || "Não informado"}</strong></div>
        </div>
        <div className="visao-arte" aria-hidden="true">
          <div className="visao-arte-aneis"><span /><span /><span /></div>
          <div className="visao-arte-nucleo" />
          <div className="visao-arte-codigo">NANO / IA</div>
        </div>
      </section>

      <section className="visao-indicadores" aria-label="Indicadores da loja">
        {INDICADORES.map((item) => (
          <div className="visao-kpi" key={item.id}>
            <div className="visao-kpi-topo"><span className="visao-kpi-icone"><Icone nome={item.icone} tamanho={21} /></span><span className="visao-kpi-sistema">ERP / ESPELHO</span></div>
            <span className="visao-kpi-numero">{totalLegivel(contadores[item.id])}</span>
            <strong>{item.titulo}</strong>
            <small>{item.descricao}</small>
          </div>
        ))}
        <div className="visao-kpi visao-kpi-conexao">
          <div className="visao-kpi-topo"><span className="visao-kpi-icone"><Icone nome="erp" tamanho={21} /></span><span className="visao-kpi-sistema">INTEGRAÇÃO</span></div>
          <span className="visao-status" data-tipo={bling.tipo}><i aria-hidden="true" />{bling.rotulo}</span>
          <strong>Bling ERP</strong>
          <small>Estado informado pela conexão da loja</small>
        </div>
      </section>

      <div className="visao-colunas">
        <section className="visao-modulos" aria-labelledby="modulos-titulo">
          <div className="visao-secao-titulo"><div><span>SEU WORKSPACE</span><h2 id="modulos-titulo">Acesso rápido</h2></div><p>Ferramentas com as permissões da sua loja</p></div>
          <div className="visao-acessos">
            {ACESSOS.map((item) => (
              <a key={item.rota} href={`#${item.rota}`} className={`visao-acesso ${"destaque" in item && item.destaque ? "visao-acesso-destaque" : ""}`}>
                <span className="visao-acesso-icone"><Icone nome={item.icone} tamanho={24} /></span>
                <span className="visao-acesso-info"><strong>{item.titulo}</strong><small>{item.descricao}</small></span>
                <span className="visao-acesso-seta" aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </section>
        <section className="visao-alertas" aria-labelledby="avisos-titulo">
          <div className="visao-secao-titulo"><div><span>ACOMPANHAMENTO</span><h2 id="avisos-titulo">Avisos da loja</h2></div></div>
          {avisosErro && <p role="alert" className="visao-aviso-erro">{avisosErro}</p>}
          {avisos.length === 0 && !avisosErro ? <div className="visao-sem-aviso"><Icone nome="escudo" tamanho={28}/><strong>Sem avisos pendentes</strong><small>Os avisos que exigirem atenção aparecerão aqui.</small></div> : avisos.map((a) => (
            <article className="visao-notificacao" key={a.id}>
              <div className="visao-notificacao-titulo"><strong>{a.titulo}</strong><span className={`selo ${a.severidade === "bloqueio" ? "erro" : a.severidade === "atencao" ? "atencao" : ""}`}>{a.severidade}</span></div>
              {a.corpo && <p>{a.corpo}</p>}
              <div className="visao-notificacao-acoes">
                {linkFonteSegura(a.fonte_url) && <a href={linkFonteSegura(a.fonte_url)!} target="_blank" rel="noreferrer noopener">Ver referência</a>}
                <button type="button" className="sec" disabled={resolvendo !== null} onClick={() => void resolver(a.id)}>{resolvendo === a.id ? "Atualizando…" : "Marcar resolvido"}</button>
              </div>
            </article>
          ))}
          <div className="visao-politica"><Icone nome="escudo" tamanho={16}/><span>O Nano.IA prepara propostas; apenas você aprova alterações no ERP.</span></div>
        </section>
      </div>
    </div>
  );
}
