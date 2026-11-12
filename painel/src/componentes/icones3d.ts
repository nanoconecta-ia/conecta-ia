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

export const ICONE_3D_PECA: Readonly<Record<string, string>> = { motor, arrefecimento, freios, suspensao, eletrica, transmissao };
export const ICONE_3D_VEICULO: Readonly<Record<string, string>> = { picape, furgao, caminhao, passeio, suv };
