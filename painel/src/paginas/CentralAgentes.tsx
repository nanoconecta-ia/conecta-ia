import { useState } from "react";

// PROTÓTIPO: seleção de tarefa e executor, sem chamar nenhum agente nem gravar nada.
const TAREFAS: { id: string; titulo: string; descricao: string }[] = [
  { id: "enriquecer", titulo: "Enriquecer cadastro e taxonomia", descricao: "Pesquisar dados técnicos, classificar a peça e propor enriquecimento com evidências." },
  { id: "imagens", titulo: "Gerar imagens comerciais", descricao: "Criar banners e composições. Toda imagem sintética é identificada e só vai ao ar com a sua aprovação; nunca substitui a foto real." },
  { id: "seo", titulo: "Otimizar SEO do produto", descricao: "Propor título, descrição e dados estruturados usando só fatos já aprovados." },
  { id: "validar", titulo: "Validar aplicações e códigos cruzados", descricao: "Conferir aplicação veicular e equivalências, sem presumir equivalência por transitividade." },
];
const EXECUTORES: { id: string; nome: string }[] = [
  { id: "auto", nome: "Automático (por capacidade)" }, { id: "integrado", nome: "Agente integrado" },
  { id: "nanoshell", nome: "NanoShell IA" }, { id: "gpt", nome: "GPT / OpenAI" }, { id: "claude", nome: "Claude" },
];

export function CentralAgentes() {
  const [tarefa, setTarefa] = useState(TAREFAS[0].id);
  const [exec, setExec] = useState("auto");
  const t = TAREFAS.find((x) => x.id === tarefa)!;
  const e = EXECUTORES.find((x) => x.id === exec)!;
  const config = JSON.stringify({ sdk: "1", capacidade: tarefa, executor: exec, aprovacao_humana: true }, null, 2);
  return (
    <div className="cartao">
      <h1>Central de Agentes <span className="selo atencao">protótipo</span></h1>
      <p className="suave">Exemplo interativo. Nenhuma tarefa real é criada e nada é gravado.</p>
      <h2>O que deseja executar?</h2>
      <div className="grade">
        {TAREFAS.map((x) => (
          <button key={x.id} className={x.id === tarefa ? "" : "sec"} onClick={() => setTarefa(x.id)} aria-pressed={x.id === tarefa}>{x.titulo}</button>
        ))}
      </div>
      <h2 style={{ marginTop: 16 }}>Agente executor</h2>
      <div className="linha">
        {EXECUTORES.map((x) => (
          <button key={x.id} className={x.id === exec ? "" : "sec"} onClick={() => setExec(x.id)} aria-pressed={x.id === exec}>{x.nome}</button>
        ))}
      </div>
      <h2 style={{ marginTop: 16 }}>Prévia da solicitação</h2>
      <p>{t.descricao}</p>
      <p className="suave">Executor: {e.nome}. O resultado volta como "a confirmar", com fonte e confiança, e só vale depois da sua aprovação.</p>
      <pre className="mono" style={{ overflowX: "auto", background: "var(--realce)", padding: 12, borderRadius: 10 }}>{config}</pre>
      <button className="sec" onClick={() => void navigator.clipboard?.writeText(config)}>Copiar configuração de exemplo</button>
    </div>
  );
}
