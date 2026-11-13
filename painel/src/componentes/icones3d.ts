// Ícones 3D aprovados pelo dono (12/11/2026), gerados no Canva e recortados em blocos de 256 px. Cobrem as peças e os veículos mais usados;
// o que não está aqui continua no sprite SVG (IconePeca/IconeVeiculo decidem). Só apresentação: não afirmam aplicação nem marca de montadora.
import motor from "../assets/icones3d/peca-motor.webp";
import arrefecimento from "../assets/icones3d/peca-arrefecimento.webp";
import freios from "../assets/icones3d/peca-freios.webp";
import suspensao from "../assets/icones3d/peca-suspensao.webp";
import eletrica from "../assets/icones3d/peca-eletrica.webp";
import transmissao from "../assets/icones3d/peca-transmissao.webp";
import picape from "../assets/icones3d/veiculo-picape.webp";
import furgao from "../assets/icones3d/veiculo-furgao.webp";
import caminhao from "../assets/icones3d/veiculo-caminhao.webp";
import passeio from "../assets/icones3d/veiculo-passeio.webp";
import suv from "../assets/icones3d/veiculo-suv.webp";
import alimentacao from "../assets/icones3d/peca-alimentacao.webp";
import lubrificantes from "../assets/icones3d/peca-lubrificantes.webp";
import todas from "../assets/icones3d/peca-todas.webp";
import turbo from "../assets/icones3d/peca-turbo.webp";
import distribuicao from "../assets/icones3d/peca-distribuicao.webp";
import ui_inicio from "../assets/icones3d/ui-inicio.webp";
import ui_agentes from "../assets/icones3d/ui-agentes.webp";
import ui_catalogo from "../assets/icones3d/ui-catalogo.webp";
import ui_arvore from "../assets/icones3d/ui-arvore.webp";
import ui_caixas from "../assets/icones3d/ui-caixas.webp";
import ui_fila from "../assets/icones3d/ui-fila.webp";
import ui_grafico from "../assets/icones3d/ui-grafico.webp";
import ui_escudo from "../assets/icones3d/ui-escudo.webp";
import ui_imagem from "../assets/icones3d/ui-imagem.webp";
import ui_arquivo from "../assets/icones3d/ui-arquivo.webp";
import ui_conversa from "../assets/icones3d/ui-conversa.webp";

export const ICONE_3D_PECA: Readonly<Record<string, string>> = { motor, arrefecimento, freios, suspensao, eletrica, transmissao, alimentacao, lubrificantes, todas, turbo, distribuicao };
export const ICONE_3D_VEICULO: Readonly<Record<string, string>> = { picape, furgao, caminhao, passeio, suv };
/** Ícones 3D da interface (menu e atalhos), no mesmo mapa da matriz HTML aprovada (UI_ASSET). Glifos pequenos de ação (menu, fechar, busca, check) continuam em traço. */
export const ICONE_3D_UI: Readonly<Record<string, string>> = { inicio: ui_inicio, agentes: ui_agentes, catalogo: ui_catalogo, arvore: ui_arvore, caixas: ui_caixas, fila: ui_fila, grafico: ui_grafico, escudo: ui_escudo, imagem: ui_imagem, arquivo: ui_arquivo, conversa: ui_conversa, monitor: ui_grafico, loja: ui_inicio };
