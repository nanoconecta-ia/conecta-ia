import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import type { EscopoCatalogo } from "../../../supabase/functions/_shared/agente/catalogo_lotes.ts";

interface Resumo {
  escopo: EscopoCatalogo; consultados: number; ativos_elegiveis: number;
  inativos_excluidos: number; pausados: number; nao_localizados: number;
  entrariam_na_fila: number; ja_na_fila: number; sem_receita: number; sem_tipo: number;
}
interface Relatorio {
  resumo: Resumo; gravou: boolean; criadas?: number; restantes?: number;
  aviso?: string; limite_por_lote: number;
}
const nomeEscopo = (e: EscopoCatalogo) => e === "selecionados" ? "selecionados" : "todos os ativos";

export function EnriquecerCatalogo({
  loja, idsSelecionados,
}: { loja: Loja; idsSelecionados: readonly string[] }) {
  const [aberto, setAberto] = useState(false);
  const [escopo, setEscopo] = useState<EscopoCatalogo>("selecionados");
  const [limite, setLimite] = useState(25);
  const [previa, setPrevia] = useState<Relatorio | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const chaveSelecao = idsSelecionados.join("|");
  useEffect(() => {
    setPrevia(null); setErro(""); setMensagem("");
  }, [loja.id,escopo,limite,chaveSelecao]);

  async function consultar(confirmar: boolean) {
    setOcupado(true);setErro("");setMensagem("");
    try {
      const body = {
        loja_id: loja.id,
        acao: confirmar ? "enfileirar" : "relatorio",
        escopo, produto_ids: escopo === "selecionados" ? [...idsSelecionados] : [],
        confirmar, limite,
      };
      const { data, error } = await supabase.functions.invoke("enriquecimento-fila", { body });
      if (error || data?.erro) {
        const texto = typeof data?.erro === "string" ? data.erro : "Não foi possível consultar a fila. Confira a conexão e o acesso de administrador.";
        setErro(texto);setPrevia(null);return;
      }
      if (!data?.resumo || typeof data.resumo.entrariam_na_fila !== "number") {
        setErro("O servidor não retornou a prévia esperada. Nenhuma ação foi presumida.");
        return;
      }
      if (confirmar) {
        setMensagem(data.gravou
          ? `${data.criadas ?? 0} tarefa(s) criada(s) na fila. O Nano ainda precisa executá-las; nenhuma aplicação foi aprovada.`
          : data.aviso ?? "Nenhuma tarefa criada.");
        setPrevia(null); // exige consulta renovada antes de outro lote
      } else setPrevia(data as Relatorio);
    } catch {
      setErro("Falha de comunicação com o servidor. Nenhum cadastro foi considerado enriquecido.");
      setPrevia(null);
    } finally { setOcupado(false); }
  }

  return <section className="catalogo-enriquecer" aria-label="Enriquecimento técnico com aprovação do Nano">
    <div className="catalogo-enriquecer-topo">
      <div>
        <strong><span aria-hidden="true">✦</span> Enriquecer cadastro com Nano.IA</strong>
        <p>Primeiro identidade, OEM, descrições, taxonomia e aplicações. Imagens só depois, usando a ficha técnica como evidência. Nenhuma alteração automática no Bling.</p>
      </div>
      <button type="button" className="sec" onClick={()=>setAberto(x=>!x)}
        aria-expanded={aberto}>{aberto?"Fechar controle":"Abrir enriquecimento"}</button>
    </div>
    {aberto && <div className="catalogo-enriquecer-corpo">
      <div role="group" aria-label="Escopo de enriquecimento" className="catalogo-enriquecer-opcoes">
        <label><input type="radio" checked={escopo==="selecionados"} onChange={()=>setEscopo("selecionados")}/>
          Selecionados ({idsSelecionados.length})</label>
        <label><input type="radio" checked={escopo==="todos_ativos"} onChange={()=>setEscopo("todos_ativos")}/>
          Todos os ativos da loja (não só os 100 carregados)</label>
        <label>Máximo por confirmação
          <select value={limite} onChange={e=>setLimite(Number(e.target.value))}>
            <option value={10}>10 tarefas</option>
            <option value={25}>25 tarefas</option>
            <option value={50}>50 tarefas</option>
          </select>
        </label>
      </div>
      <p className="catalogo-enriquecer-nota">Produtos excluídos, inativos ou com automação pausada não entram. A tarefa entra na fila como pesquisa pendente, não como informação aprovada. Controle o consumo do Firecrawl e do provedor de IA.</p>
      <button type="button" disabled={ocupado || (escopo==="selecionados" && idsSelecionados.length===0)}
        onClick={()=>void consultar(false)}>{ocupado?"Consultando…":`Conferir ${nomeEscopo(escopo)} antes de enviar`}</button>
      {erro && <p role="alert" className="msg-erro">{erro}</p>}
      {mensagem && <p role="status" className="msg-ok">{mensagem}</p>}
      {previa && <div className="catalogo-enriquecer-previa" role="region" aria-label="Prévia das tarefas a enfileirar">
        <h3>Prévia — nenhuma tarefa foi criada</h3>
        <div className="catalogo-enriquecer-numeros">
          <span><b>{previa.resumo.ativos_elegiveis}</b> ativos e não pausados</span>
          <span><b>{previa.resumo.entrariam_na_fila}</b> aptos para enfileirar</span>
          <span><b>{previa.resumo.ja_na_fila}</b> já aguardam execução</span>
          <span><b>{previa.resumo.sem_receita+previa.resumo.sem_tipo}</b> sem receita/tipo</span>
        </div>
        <p>Excluídos/inativos: {previa.resumo.inativos_excluidos} · Pausados: {previa.resumo.pausados} · Não localizados: {previa.resumo.nao_localizados}.</p>
        <p>Até {Math.min(limite,previa.resumo.entrariam_na_fila)} tarefas no próximo lote. Produtos sem receita ficam pendentes de classificação, não recebem informações inventadas.</p>
        <button type="button" disabled={ocupado || previa.resumo.entrariam_na_fila===0}
          onClick={()=>void consultar(true)}>Confirmar envio à fila de pesquisa</button>
      </div>}
    </div>}
  </section>;
}
