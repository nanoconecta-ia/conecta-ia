import type { MouseEvent } from "react";
import type { PoliticasLojaPublicas } from "./RodapeLoja.tsx";
import { linkWhatsAppPublico, REDES_OFICIAIS_MOBIS } from "../lib/publicoLoja.ts";
import { IconeRedeMobis } from "./IconeRedeMobis.tsx";
import logoMobis from "../assets/marcas/mobis-mstyle-v3-sem-slogan.svg";
import "./rodape-enxuto-mobis.css";

/** Apenas perfis oficiais confirmados podem receber links no rodapé. */
type RedesConfirmadas = { instagram?: string | null; facebook?: string | null };

function redeSegura(valor: string | null | undefined, dominio: string): string | null {
  if (!valor) return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && (url.hostname === dominio || url.hostname === "www." + dominio)
      ? url.toString() : null;
  } catch {
    return null;
  }
}

function cnpjFormatado(valor: string | null | undefined): string | null {
  const digitos = (valor ?? "").replace(/\D/g, "");
  return digitos.length === 14
    ? digitos.slice(0, 2) + "." + digitos.slice(2, 5) + "." + digitos.slice(5, 8) + "/" + digitos.slice(8, 12) + "-" + digitos.slice(12)
    : null;
}

const DOCUMENTOS = [
  { nome: "Privacidade", campo: "privacidade_texto" },
  { nome: "Trocas e devoluções", campo: "troca_devolucao_texto" },
  { nome: "Entrega", campo: "entrega_texto" },
  { nome: "Garantia", campo: "garantia_texto" },
  { nome: "Termos de uso", campo: "termos_texto" },
] as const;

/** Rodapé exclusivo da MOBIS V3. Identificação e textos legais vêm somente das políticas aprovadas na API pública. */
export function RodapeMobisEnxuto({
  nome, whatsapp, politicas, redes = REDES_OFICIAIS_MOBIS,
}: {
  nome: string;
  whatsapp?: string | null;
  politicas?: PoliticasLojaPublicas | null;
  redes?: RedesConfirmadas;
}) {
  const ano = new Date().getFullYear();
  const wa = linkWhatsAppPublico(whatsapp, "Olá! Vim pelo site " + nome + " e gostaria de falar com um vendedor.");
  const telefone = politicas?.telefone?.trim() || null;
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const ligar = digitos.length === 10 || digitos.length === 11 ? "tel:+55" + digitos
    : digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13) ? "tel:+" + digitos : null;
  const email = politicas?.email_contato?.trim() || null;
  const endereco = politicas?.endereco?.trim() || null;
  const maps = endereco ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco) : null;
  const cnpj = cnpjFormatado(politicas?.cnpj);
  const instagram = redeSegura(redes?.instagram, "instagram.com");
  const facebook = redeSegura(redes?.facebook, "facebook.com");
  const legais = DOCUMENTOS.filter(doc => !!politicas?.[doc.campo]?.trim());

  // Na ficha do produto, o mesmo link retorna à vitrine. Na home, rola até a seção.
  const irPara = (id: string) => (evento: MouseEvent<HTMLAnchorElement>) => {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    evento.preventDefault();
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <footer id="m2-privacidade" data-bloco="rodape" className="m4-rodape-enxuto" aria-label="Informações oficiais da Mobis Autopeças">
      <div className="m4-rodape-linha">
        <div className="m4-rodape-marca">
          <a href="#/loja/mobis" aria-label="Voltar à página inicial da Mobis Autopeças">
            <img src={logoMobis} alt="MOBIS AUTOPEÇAS" loading="lazy" width={1983} height={793} />
          </a>
          <p>Peças e componentes com identificação e aplicação conferidas pela equipe.</p>
        </div>

        <section className="m4-rodape-coluna" aria-label="Atendimento">
          <h2>Atendimento</h2>
          {telefone && (ligar ? <a href={ligar}>{telefone}</a> : <span>{telefone}</span>)}
          {email && <a href={"mailto:" + email}>{email}</a>}
          {!wa && !telefone && !email && <p>Atendimento em atualização.</p>}
        </section>

        <section className="m4-rodape-coluna" aria-label="Redes sociais e atendimento online">
          <h2>Redes sociais</h2>
          <nav className="m4-rodape-canais" aria-label="Perfis oficiais e WhatsApp da Mobis">
            {facebook && <a className="m4-canal m4-canal-facebook" href={facebook} target="_blank" rel="noopener noreferrer"
              aria-label="Abrir a página principal da Mobis Autopeças no Facebook">
              <span className="m4-canal-icone"><IconeRedeMobis canal="facebook" /></span>
              <span className="m4-canal-nome">Facebook</span>
            </a>}
            {instagram && <a className="m4-canal m4-canal-instagram" href={instagram} target="_blank" rel="noopener noreferrer"
              aria-label="Abrir Instagram oficial da Mobis Autopeças">
              <span className="m4-canal-icone"><IconeRedeMobis canal="instagram" /></span>
              <span className="m4-canal-nome">Instagram</span>
            </a>}
            {wa && <a className="m4-canal m4-canal-whatsapp" href={wa} target="_blank" rel="noopener noreferrer"
              aria-label="Falar com a Mobis Autopeças no WhatsApp">
              <span className="m4-canal-icone"><IconeRedeMobis canal="whatsapp" /></span>
              <span className="m4-canal-nome">WhatsApp</span>
            </a>}
          </nav>
          {!instagram && !facebook && !wa && <p>Perfis oficiais em confirmação.</p>}
        </section>

        <section className="m4-rodape-coluna" aria-label="Localização e identificação da empresa">
          <h2>Localização</h2>
          <strong>Goiânia — GO</strong>
          {endereco && <address>{endereco}</address>}
          {maps && <a href={maps} target="_blank" rel="noopener noreferrer">Ver no Google Maps ↗</a>}
          {politicas?.razao_social && <small>{politicas.razao_social}</small>}
          {cnpj && <small>CNPJ: {cnpj}</small>}
        </section>

        <nav className="m4-rodape-coluna m4-rodape-institucional" aria-label="Institucional e políticas">
          <h2>Institucional</h2>
          <a href="#/loja/mobis/empresa">Sobre a Mobis e como consultar</a>
          <a href="#/loja/mobis" onClick={irPara("m2-catalogo")}>Catálogo</a>
          <a href="#/loja/mobis" onClick={irPara("ms-aplicacoes")}>Buscar por veículo</a>
          <a href="#/loja/mobis" onClick={irPara("ms-departamentos")}>Peças por sistema</a>
          {legais.map(doc => <details key={doc.campo} className="m4-rodape-documento">
            <summary>{doc.nome}</summary>
            <p>{politicas?.[doc.campo]}</p>
          </details>)}
          {!legais.length && <small>Políticas institucionais em revisão.</small>}
          <details className="m4-rodape-documento">
            <summary>Aplicativos Mobis para instalar</summary>
            <p>São dois aplicativos independentes. Abra cada endereço no Chrome do celular e use “Instalar app” no menu do navegador.</p>
            <p><a href="./" aria-label="Abrir o aplicativo público Mobis Autopeças">Abrir App Loja Mobis</a></p>
            <p><a href="./conecta.html" target="_blank" rel="noopener noreferrer" aria-label="Abrir Conecta.IA, área restrita do lojista, para instalar">Abrir App Conecta.IA · área restrita</a></p>
          </details>
        </nav>
      </div>
      <div className="m4-rodape-faixa">
        <span>© {ano} {nome}. Todos os direitos reservados.</span>
        <span>Informações comerciais e compatibilidade sujeitas à confirmação.</span>
        <a href="#/loja/mobis" onClick={irPara("m2-topo")}>Voltar ao topo ↑</a>
      </div>
    </footer>
  );
}
