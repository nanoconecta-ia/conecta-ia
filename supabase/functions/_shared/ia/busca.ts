// Contrato de provedor de pesquisa (imagens e técnica) do Nano.ia. O Google é só UM adaptador, legado: a Custom Search JSON API está fechada
// a novos clientes desde 20/01/2026 e encerra para os atuais em 01/01/2027. A ausência de provedor é um ESTADO explícito, não "falta de ferramenta".
// Nada aqui grava, publica ou envia dados de custo/fornecedor: só devolve candidatos para conferência humana.
import { IaErro } from "./tipos.ts";

export interface Candidata { titulo: string; url: string; miniatura: string | null; pagina: string }
export interface ResultadoTecnico { titulo: string; pagina: string; resumo: string; fonte: string }

export type MotivoBusca = "sem_provedor" | "credencial_invalida" | "api_indisponivel" | "recusada" | "limite" | "timeout" | "erro_provedor";

export class BuscaErro extends IaErro {
  motivo: MotivoBusca;
  constructor(status: number, motivo: MotivoBusca, msg: string) { super(status, msg); this.motivo = motivo; }
}

export interface ProvedorBusca {
  id: string;
  imagens(consulta: string, limite?: number): Promise<Candidata[]>;
  tecnico(consulta: string, limite?: number): Promise<ResultadoTecnico[]>;
}

export const MSG_SEM_PROVEDOR =
  "Busca indisponível: não há provedor de pesquisa configurado nesta loja. A ferramenta existe; falta o provedor. " +
  "O Google encerrou novas contas da Custom Search API em 20/01/2026 (clientes atuais têm até 01/01/2027), então não adianta criar uma chave nova do Google. " +
  "Enquanto isso, posso receber o link da imagem junto com a fonte, ou uma foto sua, e registrar como proposta.";

/** Resposta padronizada da ferramenta quando algo falha: o motivo real, em texto, e o código para o app decidir. */
export function erroDeBusca(err: unknown, padrao = "Falha na busca."): { erro: string; motivo: MotivoBusca } {
  if (err instanceof BuscaErro) return { erro: err.message, motivo: err.motivo };
  return { erro: err instanceof Error ? err.message : padrao, motivo: "erro_provedor" };
}

export const SEM_PROVEDOR = () => ({ erro: MSG_SEM_PROVEDOR, motivo: "sem_provedor" as MotivoBusca });
