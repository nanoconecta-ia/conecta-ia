import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import "./publicacao-loja.css";

type Fase = "teste" | "producao";
type Item = { codigo: string; titulo: string; ok: boolean; detalhe: string };
type Diagnostico = {
  loja: { nome: string; slug: string; ambiente: Fase; dominio_online: string | null };
  pronto_online: boolean;
  checks: Item[];
  mensagem?: string;
};
const rotulo = (fase: Fase) => fase === "teste" ? "Loja teste" : "Loja publicada online";

export function PublicacaoLoja({ loja }: { loja: Loja }) {
  const [dados, setDados] = useState<Diagnostico | null>(null);
  const [destino, setDestino] = useState<Fase>(loja.ambiente === "producao" ? "producao" : "teste");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [senha, setSenha] = useState("");
  const [backup, setBackup] = useState(false);
  const [teste, setTeste] = useState(false);

  const atualizar = useCallback(async () => {
    setErro("");
    const { data, error } = await supabase.functions.invoke("loja-publicacao", { body: { acao:"consultar", loja_id:loja.id } });
    if (error || !data || data.erro) {
      setDados(null);
      setErro("Diagnóstico indisponível. A função segura de publicação precisa estar implantada e sua sessão autorizada.");
      return;
    }
    const d = data as Diagnostico;
    setDados(d);
    setDestino(d.loja.ambiente);
  }, [loja.id]);

  useEffect(() => { void atualizar(); }, [atualizar]);

  const pronto = dados?.pronto_online === true;
  const atual = dados?.loja.ambiente ?? (loja.ambiente === "producao" ? "producao" : "teste");
  const pendentes = useMemo(() => (dados?.checks ?? []).filter((c) => !c.ok), [dados]);
  const alterando = destino !== atual;
  const podeAplicar = !!dados && alterando && !ocupado &&
    (destino === "teste" || (pronto && backup && teste && senha.trim().toUpperCase() === "PUBLICAR"));

  const linkTeste = typeof window !== "undefined"
    ? window.location.origin + window.location.pathname + "#/loja/" + encodeURIComponent(loja.slug)
    : "";

  async function copiarTeste() {
    if (!linkTeste) return;
    try { await navigator.clipboard.writeText(linkTeste); setSucesso("Link da fase de testes copiado."); }
    catch { setErro("Não foi possível copiar automaticamente. Abra o link e copie o endereço do navegador."); }
  }

  async function confirmar() {
    if (!podeAplicar || !dados) return;
    const frase = destino === "teste" ? "Retornar a loja para teste? Ela deixará de operar como online." :
      "Ativar a loja online? Confira domínio, clientes, backup, produtos e textos legais. Esta ação não configura DNS nem faz deploy.";
    if (!window.confirm(frase)) return;
    setOcupado(true); setErro(""); setSucesso("");
    const { data, error } = await supabase.functions.invoke("loja-publicacao", {
      body: {
        acao:"mudar", loja_id:loja.id, fase:destino,
        confirmacao:destino === "teste" ? "VOLTAR PARA TESTE" : "PUBLICAR",
        backup_conferido:backup, teste_concluido:teste,
      },
    });
    setOcupado(false);
    if (error || data?.erro) {
      setErro(typeof data?.erro === "string" ? data.erro : "Não foi possível mudar a fase. Nenhuma mudança foi confirmada.");
      return;
    }
    setSucesso(typeof data?.mensagem === "string" ? data.mensagem : "Fase atualizada.");
    setBackup(false); setTeste(false); setSenha("");
    await atualizar();
  }

  return (
    <div className="cartao publicar-loja">
      <header className="publicar-cabecalho">
        <div><h1>Publicação da loja</h1>
          <p className="suave">Controle de lançamento independente do catálogo e do Bling. Trocar a fase nunca altera produtos, estoque, notas fiscais ou DNS.</p></div>
        <div className="publicar-situacao" role="status">Fase atual: <strong>{rotulo(atual)}</strong></div>
      </header>
      {erro && <p role="alert" className="msg-erro">{erro}</p>}
      {sucesso && <p role="status" className="msg-ok">{sucesso}</p>}
      <div className="publicar-opcoes" role="group" aria-label="Escolha a fase da loja">
        <button type="button" aria-pressed={destino === "teste"} disabled={ocupado} className={destino === "teste" ? "selecionado" : ""}
          onClick={() => { setDestino("teste"); setErro(""); }}>
          <span className="publicar-icone" aria-hidden="true">◉</span>
          <strong>Loja teste</strong>
          <small>Clientes experimentam a busca, os produtos aprovados e o chat. Sem compra ou cobrança pelo site.</small>
        </button>
        <button type="button" aria-pressed={destino === "producao"} disabled={ocupado || !dados} className={destino === "producao" ? "selecionado" : ""}
          onClick={() => { setDestino("producao"); setErro(""); }}>
          <span className="publicar-icone" aria-hidden="true">✓</span>
          <strong>Loja publicada online</strong>
          <small>Somente após políticas, catálogo, domínio e SSL homologados. A mudança exige confirmação.</small>
        </button>
      </div>
      <section className="publicar-acesso" aria-label="Link de teste com clientes">
        <div>
          <h2>Avaliação com clientes</h2>
          <p>Compartilhe o endereço de teste para receber feedback. Este link não é privado: qualquer pessoa que o receba poderá acessar a prévia.</p>
          <code>{linkTeste || "Link disponível no navegador."}</code>
        </div>
        <div className="publicar-acoes">
          <button type="button" className="sec" onClick={() => void copiarTeste()}>Copiar link de teste</button>
          <a className="botao sec" href={"#/loja/" + encodeURIComponent(loja.slug)} target="_blank" rel="noopener noreferrer">Abrir loja teste</a>
        </div>
      </section>
      <section aria-labelledby="publicar-checklist">
        <div className="publicar-linha"><h2 id="publicar-checklist">Verificação para lançamento</h2>
          <button type="button" className="sec" onClick={() => void atualizar()} disabled={ocupado}>Atualizar conferência</button></div>
        {!dados ? <p className="suave">Não foi possível consultar os requisitos. Publicação bloqueada.</p> :
        <ul className="publicar-checks">
          {dados.checks.map((c) => (
            <li key={c.codigo}>
              <span aria-hidden="true" className={c.ok ? "publicar-ok" : "publicar-falta"}>{c.ok ? "✓" : "!"}</span>
              <div><strong>{c.titulo}</strong><small>{c.detalhe}</small></div>
            </li>
          ))}
        </ul>}
        {dados && <p className={pronto ? "msg-ok" : "suave"} aria-live="polite">
          {pronto ? "Todos os requisitos verificáveis foram atendidos." : String(pendentes.length) + " requisito(s) pendente(s). O modo online permanece bloqueado."}
        </p>}
      </section>
      {destino === "producao" && alterando && (
        <div className="publicar-confirmacoes">
          <h2>Confirmação do responsável</h2>
          <label><input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} /> Confirmei uma cópia de segurança recuperável da operação.</label>
          <label><input type="checkbox" checked={teste} onChange={(e) => setTeste(e.target.checked)} /> Testei a loja com clientes, inclusive no celular, e conferi os canais de atendimento.</label>
          <label>Digite <strong>PUBLICAR</strong> para confirmar
            <input value={senha} onChange={(e) => setSenha(e.target.value)} maxLength={12} autoComplete="off" placeholder="PUBLICAR" />
          </label>
          <p className="suave">Esses dois itens são declarações do responsável, não verificações automáticas do sistema.</p>
        </div>
      )}
      <div className="publicar-rodape">
        <button type="button" disabled={!podeAplicar} onClick={() => void confirmar()}>
          {ocupado ? "Aplicando..." : alterando ? "Confirmar: " + rotulo(destino) : "Fase atual: " + rotulo(atual)}
        </button>
        <p className="suave">Publicação do código, domínio e certificado HTTPS são etapas de infraestrutura separadas. Este botão altera somente a fase autorizada no cadastro da loja.</p>
      </div>
    </div>
  );
}
