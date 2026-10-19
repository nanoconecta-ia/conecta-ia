import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { avisoIdade, nomeArquivoCsv, resumoContagens, ROTULO_ORIGEM, ROTULO_STATUS, ultimoUtil, type Snapshot } from "../lib/backup.ts";

async function mensagemDoErro(error: unknown, padrao: string) {
  try { const j = await (error as { context?: Response }).context?.json(); if (j?.erro) return String(j.erro); } catch { /* mantém o padrão */ }
  return padrao;
}

/** Backup do cadastro do Bling: cópia completa e datada dentro do Conecta, com CSV no formato do Bling. Só leitura do Bling. */
export function Backup({ loja }: { loja: Loja }) {
  const [lista, setLista] = useState<Snapshot[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("bling_snapshots").select("id, criado_em, concluido_em, origem, status, contagens, erro").eq("loja_id", loja.id).order("criado_em", { ascending: false }).limit(30);
    if (error) { setMsg({ ok: false, texto: "Não foi possível ler os backups. Só o responsável da loja tem acesso." }); setLista([]); return; }
    setLista((data ?? []) as Snapshot[]);
  }, [loja.id]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function fazerBackup() {
    setOcupado(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("bling-backup", { body: { acao: "executar", loja_id: loja.id } });
    setOcupado(false);
    if (error) { setMsg({ ok: false, texto: await mensagemDoErro(error, "Não foi possível fazer o backup agora.") }); return; }
    const r = data as { status?: string; erro?: string };
    setMsg(r.status === "completo" ? { ok: true, texto: "Backup completo." } : { ok: false, texto: `Backup ${r.status === "parcial" ? "parcial" : "não concluído"}${r.erro ? `: ${r.erro}` : "."}` });
    await carregar();
  }

  async function baixar(s: Snapshot) {
    setOcupado(true); setMsg(null);
    const { data, error } = await supabase.functions.invoke("bling-backup", { body: { acao: "csv", loja_id: loja.id, snapshot_id: s.id } });
    setOcupado(false);
    if (error || typeof data !== "string") { setMsg({ ok: false, texto: error ? await mensagemDoErro(error, "Não foi possível gerar o CSV.") : "Resposta inesperada ao gerar o CSV." }); return; }
    const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = nomeArquivoCsv(s.id, s.criado_em); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const util = lista ? ultimoUtil(lista) : null;
  const idade = avisoIdade(util);
  return (
    <div className="cartao">
      <h1>Backup do Bling</h1>
      <p className="suave">Uma cópia completa e datada do seu cadastro (produtos, fornecedores, categorias), guardada aqui. Se a conexão com o Bling cair, o Conecta continua com a última cópia; quando o Bling voltar, atualizamos. O Conecta só lê o Bling, nunca grava nele por este backup.</p>
      <p className="suave">A cópia tem custo e fornecedor: só o responsável da loja a vê, e ela nunca vai para o site nem para os agentes.</p>
      {lista && <p className={idade.ok ? "msg-ok" : "msg-erro"}>{idade.texto}</p>}
      {msg && <p className={msg.ok ? "msg-ok" : "msg-erro"}>{msg.texto}</p>}
      <div className="linha"><button disabled={ocupado} onClick={() => void fazerBackup()}>{ocupado ? "Trabalhando…" : "Fazer backup agora"}</button></div>
      <h2>Cópias guardadas</h2>
      {lista === null ? <p className="suave">Carregando…</p> : lista.length === 0 ? <p className="suave">Nenhum backup ainda.</p> : (
        <ul className="lista-simples">
          {lista.map((s) => (
            <li key={s.id}>
              <strong>{new Date(s.criado_em).toLocaleString("pt-BR")}</strong> · {ROTULO_STATUS[s.status]} · {ROTULO_ORIGEM[s.origem]}
              <br /><span className="suave">{resumoContagens(s.contagens)}{s.erro ? ` · ${s.erro}` : ""}</span>
              {(s.status === "completo" || s.status === "parcial") && <div className="linha"><button className="sec" disabled={ocupado} onClick={() => void baixar(s)}>Baixar CSV (formato do Bling)</button></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
