import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import { ir } from "../lib/rota.ts";
import { useFonte } from "../lib/useFonte.ts";
import type { Loja } from "../lib/dados.ts";
import { montarConexoes, ROTULO_ESTADO, type EntradaConexoes } from "../lib/conexoesAgente.ts";
import { REGRAS_DO_AGENTE } from "../lib/meuAgente.ts";

const CLASSE: Record<string, string> = { ok: "ok", atencao: "atencao", inativo: "", nao_verificado: "atencao" };

/** Central de conexões: uma linha por caminho (agente nativo, API, MCP, plugins, contingência), só com o que é verificável. Nada de nome de provedor (regra 5). */
export function MeuAgente({ loja }: { loja: Loja }) {
  const fonte = useFonte();
  const [dados, setDados] = useState<EntradaConexoes | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [ia, plug, mcp] = await Promise.all([
          supabase.from("loja_chaves_ia").select("provedor, ativa, principal").eq("loja_id", loja.id),
          supabase.from("loja_plugins").select("ativo, ultimo_teste_ok").eq("loja_id", loja.id),
          fonte ? fonte.chaves(loja.id) : Promise.resolve([]),
        ]);
        if (!vivo) return;
        setDados({ chavesIa: (ia.data ?? []) as EntradaConexoes["chavesIa"], plugins: (plug.data ?? []) as EntradaConexoes["plugins"], chavesMcp: mcp });
      } catch { if (vivo) setErro(true); }
    })();
    return () => { vivo = false; };
  }, [loja.id, fonte]);
  const cartoes = dados ? montarConexoes(dados) : [];
  return (
    <div className="cartao">
      <h1>Conectar meu agente</h1>
      <p className="suave">Os caminhos para usar IA na sua loja, num só lugar. Cada linha mostra só o que dá para conferir; o que não dá fica como “não verificado”.</p>
      {erro && <p className="msg-erro" role="alert">Não consegui ler o estado das conexões agora.</p>}
      {!dados && !erro && <p className="suave">Carregando…</p>}
      <div className="grade">
        {cartoes.map((c) => (
          <div key={c.id} className="cartao" style={{ margin: "8px 0" }}>
            <div className="linha" style={{ justifyContent: "space-between" }}><strong>{c.titulo}</strong><span className={`selo ${CLASSE[c.estado]}`}>{ROTULO_ESTADO[c.estado]}</span></div>
            <p style={{ margin: "4px 0" }}>{c.resumo}</p>
            <p className="suave" style={{ margin: "0 0 8px" }}>{c.detalhe}</p>
            <button className="sec" onClick={() => ir(c.rota)}>{c.acao}</button>
          </div>
        ))}
      </div>
      <h2>Regras que valem para qualquer agente</h2>
      <ul>{REGRAS_DO_AGENTE.map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}
