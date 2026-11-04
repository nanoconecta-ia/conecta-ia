import { useEffect, useState } from "react";
import { supabase } from "../supabase.ts";
import { calcularCota, nomeProvedor, type RegistroMedidor } from "../lib/medidorNano.ts";

type Props = {
  lojaId: string;
  estadoMotor: string;
  textoMotor: string;
  provedorSelecionado: string;
  atualizarEm: number;
  abrirModelos: () => void;
};
const numero = (n: number) => n.toLocaleString("pt-BR");

/** Mesmo chat Nano: só lê metadados autorizados por RLS, nunca chave ou conteúdo da conversa. */
export function MostradorNano({ lojaId, estadoMotor, textoMotor, provedorSelecionado, atualizarEm, abrirModelos }: Props) {
  const [linhas, setLinhas] = useState<RegistroMedidor[] | null>(null);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [manual, setManual] = useState(0);

  useEffect(() => {
    let valido = true;
    setAtualizando(true);
    setErro(false);
    setLinhas(null);
    void supabase.from("loja_chaves_ia")
      .select("provedor,ativa,principal,modelo,base_url,tokens_mes,limite_mensal_tokens,mes_ref")
      .eq("loja_id", lojaId).then(({ data, error }) => {
        if (!valido) return;
        if (error || !Array.isArray(data)) {
          setErro(true);
          setLinhas(null);
        } else {
          setLinhas(data as RegistroMedidor[]);
        }
        setAtualizando(false);
      }).then(undefined, () => {
        if (valido) { setLinhas(null); setErro(true); setAtualizando(false); }
      });
    return () => { valido = false; };
  }, [lojaId, atualizarEm, manual]);

  const mesAtual = new Date().toISOString().slice(0, 7);
  const ordenadas = [...(linhas ?? [])].sort((a, b) => Number(b.principal) - Number(a.principal) || Number(b.ativa) - Number(a.ativa));
  return (
    <section className="nano-mostrador" aria-label="Mostrador de IA e consumo">
      <div className="nano-motor-status" data-estado={estadoMotor} role="status" aria-live="polite">
        <span className="nano-motor-ponto" aria-hidden="true" />
        <span className="nano-motor-texto">{textoMotor}</span>
        <button type="button" className="sec mini nano-motor-config" onClick={abrirModelos}>Modelos</button>
        <button type="button" className="sec mini" aria-label="Atualizar consumo dos modelos" title="Atualizar consumo" disabled={atualizando} onClick={() => setManual(x => x + 1)}>↻</button>
      </div>
      <div className="nano-mostrador-faixa" aria-label="Consumo mensal por provedor">
        {atualizando && !linhas && <span className="nano-mostrador-aviso">Consultando consumo…</span>}
        {!atualizando && erro && <span className="nano-mostrador-aviso">Consumo não disponível — confira suas permissões</span>}
        {!atualizando && !erro && ordenadas.length === 0 && <span className="nano-mostrador-aviso">Nenhum modelo cadastrado</span>}
        {ordenadas.map(registro => {
          const cota = calcularCota(registro, mesAtual);
          const selecionado = registro.provedor === provedorSelecionado;
          const consumo = cota.usados === null ? "Consumo indisponível" : numero(cota.usados) + " tokens";
          const teto = cota.limite === null ? "sem teto interno" : "de " + numero(cota.limite);
          return <div key={registro.provedor} className="nano-medidor-item" data-cota={cota.estado} data-selecionado={selecionado ? "sim" : "nao"}
            title={`${nomeProvedor(registro)} — ${cota.descricao}. Os limites externos do provedor são independentes.`}>
            <span className="nano-medidor-topo">
              <strong>{nomeProvedor(registro)}</strong>
              {registro.principal && <span className="nano-medidor-etiqueta">Principal</span>}
              {selecionado && !registro.principal && <span className="nano-medidor-etiqueta">Selecionado</span>}
            </span>
            <span className="nano-medidor-contagem">{cota.estado === "desativado" ? "Desativado" : `${consumo} · ${teto}`}</span>
            {cota.percentual !== null && <span className="nano-medidor-barra" role="meter" aria-label={`Consumo local ${nomeProvedor(registro)}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={cota.percentual} aria-valuetext={cota.descricao}>
              <span style={{ width: `${cota.percentual}%` }} />
            </span>}
            <small>{cota.descricao}</small>
          </div>;
        })}
      </div>
      <small className="nano-mostrador-rodape">Consumo registrado no Conecta.IA · limites externos gratuitos podem ser menores</small>
    </section>
  );
}
