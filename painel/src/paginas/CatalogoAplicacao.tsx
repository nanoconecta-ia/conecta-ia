import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase.ts";
import type { Loja } from "../lib/dados.ts";
import { Icone } from "../componentes/Icone.tsx";
import { IconePeca } from "../componentes/IconePeca.tsx";
import { iconeDaCategoria } from "../lib/icones.ts";
import "./catalogo-aplicacao.css";

/**
 * Catálogo por aplicação — adaptação funcional do modelo aprovado no Canva:
 * https://www.canva.com/d/vfcZIrvZGwU1VMf
 *
 * Só dados autorizados por RLS e vinculados à loja autenticada.
 * Sem snapshots de Bling, dados fiscais, custo, escrita, publicação ou indicação
 * implícita de compatibilidade. Nano E02, hologramas e painel original intocados.
 */
type Produto = {
  id: string; sku: string | null; nome: string | null; marca: string | null;
  publicado: boolean; taxonomia_no_id: string | null;
};
type Aplicacao = {
  produto_id: string; status: string; modelo: string | null; motorizacao: string | null;
  ano_inicial: number | null; ano_final: number | null;
};
type Espelho = {
  produtos: Produto[]; aplicacoes: Aplicacao[];
  totalProdutos: number | null; totalAplicacoes: number | null;
  fila: number | null; erro: string | null;
};

const SISTEMAS = [
  { id: "motor", nome: "Motor", pesquisa: /motor|cabecot|pist|biela|bloco|camisa|junta|virabrequim/i },
  { id: "arrefecimento", nome: "Arrefecimento", pesquisa: /arrefec|radiador|bomba.d.?agua|mangueira|termost|reservatorio/i },
  { id: "freios", nome: "Freios", pesquisa: /freio|pastilha|disco|cilindro.mestre|pin[cç]a/i },
  { id: "suspensao", nome: "Suspensão", pesquisa: /suspens|amortec|bandeja|pivo|bieleta|mola/i },
  { id: "eletrica", nome: "Elétrica", pesquisa: /eletric|alternador|bateria|motor.de.partida|sensor/i },
  { id: "transmissao", nome: "Transmissão", pesquisa: /transmiss|embreag|cambio|rolamento/i },
  { id: "filtros", nome: "Filtros", pesquisa: /filtro|separador/i },
  { id: "lubrificantes", nome: "Lubrificantes", pesquisa: /[oó]leo|lubrif|fluido/i },
] as const;
const MODELOS: Record<string, string[]> = {
  Hyundai: ["HR", "H100"], Kia: ["Bongo K2500", "Bongo K2700"],
  Mitsubishi: ["L200", "Pajero"], Mercedes: ["Sprinter"],
  Iveco: ["Daily"], Ford: ["Ranger"], Volkswagen: ["Amarok"],
  Fiat: ["Toro", "Ducato"],
};
const limpar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const csvCelula = (v: string) => {
  // Evita execução de fórmulas ao abrir CSV em planilhas.
  const s = v.replace(/[\r\n\t]+/g, " ").slice(0, 300);
  return '"' + (/^[\s]*[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"';
};
const SUBCATEGORIAS: Record<string, string[]> = {
  motor: ["Cabeçotes", "Pistões", "Juntas", "Virabrequins", "Correias", "Turbinas"],
  arrefecimento: ["Bombas d'água", "Radiadores", "Válvulas termostáticas", "Reservatórios", "Mangueiras", "Aditivos"],
  freios: ["Discos", "Pastilhas", "Pinças", "Cilindros", "Servofreio"],
  suspensao: ["Bandejas", "Amortecedores", "Molas", "Pivôs", "Bieletas"],
  eletrica: ["Alternadores", "Partida", "Sensores", "Baterias", "Chicotes"],
  transmissao: ["Embreagens", "Caixas", "Rolamentos", "Retentores"],
  filtros: ["Ar", "Óleo", "Combustível", "Cabine"],
  lubrificantes: ["Óleo de motor", "Óleo de transmissão", "Fluidos"],
};

export function CatalogoAplicacao({ loja }: { loja: Loja }) {
  const [espelho, setEspelho] = useState<Espelho | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [montadora, setMontadora] = useState("Hyundai");
  const [modelo, setModelo] = useState("HR");
  const [ano, setAno] = useState("");
  const [motor, setMotor] = useState("");
  const [tecnologia, setTecnologia] = useState("");
  const [sistema, setSistema] = useState("arrefecimento");
  const [termo, setTermo] = useState("");
  const [aplicado, setAplicado] = useState({ modelo: "HR", ano: "", motor: "", tecnologia: "", sistema: "arrefecimento", termo: "" });
  const [paleta, setPaleta] = useState<"cobre" | "petroleo" | "neutra">("cobre");
  const [exportando, setExportando] = useState(false);
  const mobis = loja.slug === "mobis";

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setEspelho(null);
    const executar = async () => {
      const [p, a, fila] = await Promise.all([
        supabase.from("produtos").select("id,sku,nome,marca,publicado,taxonomia_no_id", { count: "exact" })
          .eq("loja_id", loja.id).order("nome").limit(500),
        supabase.from("produto_aplicacoes").select("produto_id,status,modelo,motorizacao,ano_inicial,ano_final", { count: "exact" })
          .eq("loja_id", loja.id).limit(700),
        supabase.from("aprovacoes").select("id", { count: "exact", head: true })
          .eq("loja_id", loja.id).eq("estado", "pendente"),
      ]);
      if (!ativo) return;
      setEspelho({
        produtos: (p.data ?? []) as Produto[],
        aplicacoes: (a.data ?? []) as Aplicacao[],
        totalProdutos: p.error ? null : p.count,
        totalAplicacoes: a.error ? null : a.count,
        fila: fila.error ? null : fila.count,
        erro: p.error || a.error ? "Não foi possível conferir integralmente os dados autorizados desta loja. Os resultados foram bloqueados." : null,
      });
      setCarregando(false);
    };
    void executar();
    return () => { ativo = false; };
  }, [loja.id]);

  const dadosValidos = !!espelho && !espelho.erro;
  const aprovadas = dadosValidos ? espelho.aplicacoes.filter((a) => a.status === "aprovado") : [];
  const publ = dadosValidos ? espelho.produtos.filter((p) => p.publicado === true) : [];
  const pendentes = dadosValidos ? espelho.aplicacoes.filter((a) => a.status === "a_confirmar") : [];
  const opcao = SISTEMAS.find((x) => x.id === aplicado.sistema);
  const resultados = useMemo(() => {
    if (!dadosValidos || !espelho) return [];
    const palavras = [aplicado.modelo, aplicado.motor, aplicado.termo].map((x) => limpar(x.trim())).filter(Boolean);
    return espelho.produtos.filter((p) => {
      const n = limpar([p.nome, p.sku, p.marca].filter(Boolean).join(" "));
      return palavras.every((x) => n.includes(x)) && (!opcao || opcao.pesquisa.test(n));
    }).slice(0, 24);
    // Resultado textual não comprova ano, versão, aplicação, OEM ou tecnologia.
  }, [espelho, aplicado, dadosValidos, opcao]);

  const publicadosCompativeis = useMemo(() => {
    if (!dadosValidos) return [];
    const status = new Map<string, Aplicacao[]>();
    for (const a of aprovadas) status.set(a.produto_id, [...(status.get(a.produto_id) ?? []), a]);
    return publ.filter((p) => {
      if (!aplicado.modelo && !aplicado.ano && !aplicado.motor) return true;
      return (status.get(p.id) ?? []).some((a) => {
        if (aplicado.modelo && !limpar(a.modelo ?? "").includes(limpar(aplicado.modelo))) return false;
        if (aplicado.motor && !limpar(a.motorizacao ?? "").includes(limpar(aplicado.motor))) return false;
        const n = Number(aplicado.ano);
        return !n || (!!a.ano_inicial && !!a.ano_final && n >= a.ano_inicial && n <= a.ano_final);
      });
    }).slice(0, 18);
  }, [dadosValidos, aprovadas, publ, aplicado]);

  const totalAprovadas = espelho?.totalAplicacoes === null || !dadosValidos ? "—"
    : aprovadas.length.toLocaleString("pt-BR") + (espelho.aplicacoes.length < (espelho.totalAplicacoes ?? 0) ? "+" : "");
  const totalPublicados = !dadosValidos ? "—" : publ.length.toLocaleString("pt-BR");
  const totalFila = espelho?.fila === null || !dadosValidos ? "—" : String(espelho.fila + pendentes.length);
  const linkContato = mobis ? "https://wa.me/5562991654515?text=" +
    encodeURIComponent("Olá! Vim pelo painel de catálogo Mobis e gostaria de consultar uma peça.") : null;

  const filtrar = () => setAplicado({ modelo, ano, motor, tecnologia, sistema, termo });
  const limparTudo = () => {
    setMontadora(""); setModelo(""); setAno(""); setMotor(""); setTecnologia("");
    setSistema(""); setTermo("");
    setAplicado({ modelo:"", ano:"", motor:"", tecnologia:"", sistema:"", termo:"" });
  };
  function exportarTriagem() {
    if (!dadosValidos || resultados.length === 0) return;
    setExportando(true);
    const cab = ["SKU", "Descrição", "Marca", "Situação", "Observação"];
    const linhas = resultados.map((p) => [p.sku ?? "", p.nome ?? "", p.marca ?? "", "NÃO HOMOLOGADO",
      "Candidato por texto; verificar ano, motor, chassi, OEM, restrições e fonte"]);
    const texto = "\uFEFF" + [cab, ...linhas].map((r) => r.map(csvCelula).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "mobis-triagem-nao-homologada.csv";
    a.click(); URL.revokeObjectURL(url); setExportando(false);
  }
  return (
    <div className="ca-pagina" data-paleta-catalogo={paleta}>
      <header className="ca-titulo">
        <div>
          <span className="ca-eyebrow">CATÁLOGO INTELIGENTE · REVISÃO TÉCNICA E GOVERNANÇA</span>
          <h1>Catálogo por aplicação<span>.</span></h1>
          <p>Peças e sistemas automotivos, com aplicações verificadas separadas dos candidatos à conferência.</p>
        </div>
        <div className="ca-topo-acoes">
          <a className="ca-sec" href="#/catalogo-espelho"><Icone nome="arquivo" tamanho={17}/> Abrir espelho ERP</a>
          <a className="ca-primario" href="#/fila"><Icone nome="fila" tamanho={17}/> Revisar pendências</a>
        </div>
      </header>
      <div className="ca-aviso" role="note">
        <Icone nome="escudo" tamanho={17}/>
        <span>Ambiente administrativo · somente dados autorizados pela loja. O Bling continua como fonte oficial. Nenhum resultado textual constitui aplicação homologada.</span>
        <a href="#/assistente">Conversar com Nano.IA</a>
      </div>

      <section className="ca-metricas" aria-label="Indicadores reais do espelho">
        {[
          { rotulo: "Produtos no espelho", valor: carregando ? "…" : espelho?.totalProdutos == null ? "—" : espelho.totalProdutos.toLocaleString("pt-BR"), detalhe: "Base atual, sem duplicar SKU" },
          { rotulo: "Aplicações homologadas", valor: carregando ? "…" : totalAprovadas, detalhe: "Validadas tecnicamente" },
          { rotulo: "Pendências de aprovação", valor: carregando ? "…" : totalFila, detalhe: "Fila e aplicações por conferir" },
          { rotulo: "Produtos publicados", valor: carregando ? "…" : totalPublicados, detalhe: "Visíveis na loja do cliente" },
        ].map((m) => <div key={m.rotulo} className="ca-metrica"><span>{m.rotulo}</span><strong>{m.valor}</strong><small>{m.detalhe}</small></div>)}
      </section>

      <section className="ca-conteudo" aria-label="Vitrine interna e filtros da Mobis">
        <div className="ca-identificacao"><span>CONECTA.IA / VISÃO DE LOJA</span><span className="ca-selo">Prévia interna · não publicada</span></div>
        <div className="ca-hero">
          <div className="ca-hero-texto">
            <span>{mobis ? "MOBIS AUTOPEÇAS · CATÁLOGO DIESEL" : loja.nome.toUpperCase() + " · CATÁLOGO"}</span>
            <h2>A peça certa para o seu veículo<span>.</span></h2>
            <p>Explore sistemas automotivos, visualize produtos e confira aplicações com rastreabilidade técnica antes da publicação.</p>
            <div className="ca-hero-acoes">
              <a href="#ca-filtros" className="ca-botao-laranja">Buscar minha peça</a>
              {linkContato && <a href={linkContato} className="ca-botao-contorno" target="_blank" rel="noopener noreferrer">Contato comercial</a>}
            </div>
          </div>
          <div className="ca-brand">
            {mobis ? <img src="./marcas/mobis-canva-oficial.jpg" alt="Logotipo oficial Mobis Autopeças" width={150} height={150} /> :
              <><span className="ca-brand-simbolo" aria-hidden="true">M</span><strong>{loja.nome}</strong><small>CATÁLOGO</small></>}
          </div>
        </div>
        <div className="ca-vitrine-metricas">
          <div><strong>{totalPublicados}</strong><span>Produtos publicados</span></div>
          <div><strong>{totalAprovadas}</strong><span>Aplicações aprovadas</span></div>
          <div><strong>{carregando ? "…" : "0"}</strong><span>Imagens exibidas nesta prévia</span></div>
          <div><strong>Somente consulta</strong><span>Sem lançamento de anúncios</span></div>
        </div>
        <div className="ca-paletas"><span>Prévia de identidade visual</span>
          <div role="group" aria-label="Paleta visual do catálogo">
            <button type="button" aria-pressed={paleta === "cobre"} onClick={() => setPaleta("cobre")}>Grafite e cobre</button>
            <button type="button" aria-pressed={paleta === "petroleo"} onClick={() => setPaleta("petroleo")}>Azul petróleo</button>
            <button type="button" aria-pressed={paleta === "neutra"} onClick={() => setPaleta("neutra")}>Neutra</button>
          </div>
        </div>

        <section className="ca-bloco" id="ca-filtros">
          <div className="ca-numero">01 / ENCONTRE SUA PEÇA</div>
          <h2>Da montadora à peça certa.</h2>
          <p className="ca-subtitulo">A pesquisa interna localiza candidatos; aplicação real depende de comprovação de modelo, ano, motor e tecnologia.</p>
          <div className="ca-formulario">
            <label>Montadora
              <select value={montadora} onChange={(e) => { setMontadora(e.target.value); setModelo(""); }}>
                <option value="">Todas</option>{Object.keys(MODELOS).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Modelo
              <select value={modelo} onChange={(e) => setModelo(e.target.value)}>
                <option value="">Todos / a confirmar</option>{(MODELOS[montadora] ?? []).map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>Motorização
              <input value={motor} maxLength={40} onChange={(e) => setMotor(e.target.value)} placeholder="D4CB, 2.5 16V…" />
            </label>
            <label>Ano
              <select value={ano} onChange={(e) => setAno(e.target.value)}>
                <option value="">Todos / a confirmar</option>
                {Array.from({ length: 24 }, (_, i) => String(2026 - i)).map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>Tecnologia
              <select value={tecnologia} onChange={(e) => setTecnologia(e.target.value)}>
                <option value="">Todas / a confirmar</option>
                {["8V", "16V", "Euro 3", "Euro 4", "Euro 5", "ABS", "Sem ABS"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label>Sistema
              <select value={sistema} onChange={(e) => setSistema(e.target.value)}>
                <option value="">Todos os sistemas</option>{SISTEMAS.map((v) => <option value={v.id} key={v.id}>{v.nome}</option>)}
              </select>
            </label>
            <label className="ca-busca-label">Nome da peça / SKU
              <input value={termo} maxLength={60} onChange={(e) => setTermo(e.target.value)} placeholder="bomba, radiador, correia, código…" />
            </label>
            <div className="ca-form-acoes">
              <button type="button" className="ca-sec" onClick={limparTudo}>Limpar filtros</button>
              <button type="button" className="ca-primario" onClick={filtrar}><Icone nome="busca" tamanho={17}/> Buscar filtros</button>
            </div>
          </div>
        </section>

        <section className="ca-bloco ca-sistemas">
          <div className="ca-numero">02 / SISTEMAS E SUBCONJUNTOS</div>
          <h2>Explore a taxonomia automotiva.</h2>
          <p className="ca-subtitulo">Selecione um sistema para triagem. Os ícones existentes do Conecta.IA continuam sendo os oficiais.</p>
          <div className="ca-grade-pecas">
            {SISTEMAS.map((v) => (
              <button type="button" key={v.id} aria-pressed={sistema === v.id} onClick={() => {
                setSistema(v.id); setAplicado((a) => ({ ...a, sistema:v.id }));
              }}>
                <IconePeca nome={v.id} tamanho={70} titulo={v.nome}/>
                <span>{v.nome}</span>
              </button>
            ))}
          </div>
          {sistema && <div className="ca-subcategorias"><strong>{SISTEMAS.find((s) => s.id === sistema)?.nome} · subconjuntos</strong>
            <div>{(SUBCATEGORIAS[sistema] ?? []).map((v) => (
              <button type="button" key={v} onClick={() => { setTermo(v); setAplicado((a) => ({ ...a, sistema, termo:v })); }}>{v}</button>
            ))}</div>
          </div>}
        </section>

        <section className="ca-bloco">
          <div className="ca-numero">03 / RESULTADOS COMERCIAIS</div>
          <h2>Catálogo publicado.</h2>
          <p className="ca-subtitulo">Produtos públicos sujeitos às regras de homologação. Filtros de veículo usam somente aplicações explicitamente aprovadas.</p>
          {!dadosValidos ? <div className="ca-vazio" role="status">{carregando ? "Consultando dados autorizados…" : espelho?.erro ?? "Dados indisponíveis."}</div> :
            publicadosCompativeis.length ? <div className="ca-grade-publicados">{publicadosCompativeis.map((p) => (
              <div className="ca-produto-pub" key={p.id}>
                <IconePeca nome={iconeDaCategoria(null,p.nome)} tamanho={48}/>
                <div><strong>{p.nome ?? "Produto"}</strong><small>SKU: {p.sku ?? "não informado"} · confirme compatibilidade</small></div>
                <a href={"#/catalogo-espelho?q=" + encodeURIComponent(p.sku ?? "")}>Conferir ficha</a>
              </div>
            ))}</div> :
            <div className="ca-vazio"><Icone nome="escudo" tamanho={25}/><div><strong>Nenhum produto homologado para esta seleção.</strong><p>Os cadastros internos não são anúncios. A liberação depende de evidências, revisão e aprovação.</p></div>
              <a href="#/fila">Ver pendências</a></div>}
        </section>
        <section className="ca-bloco ca-candidatos">
          <div className="ca-numero">04 / EXCLUSIVO DO LOJISTA · NÃO PUBLICADO</div>
          <h2>Conferência interna dos candidatos.</h2>
          <p className="ca-subtitulo">A busca textual encontra registros do espelho para triagem. Não indica compatibilidade, origem OEM ou disponibilidade.</p>
          <div className="ca-candidatos-controles">
            <p><strong>{dadosValidos ? resultados.length : "—"} registro(s) candidato(s)</strong><br/>Pesquisa textual na amostra autorizada; todos exigem análise individual antes de serem vinculados a veículos.</p>
            <button type="button" className="ca-sec" disabled={!resultados.length || !dadosValidos || exportando} onClick={exportarTriagem}>Exportar revisão CSV</button>
          </div>
          {dadosValidos && resultados.length ? <div className="ca-grade-candidatos">
            {resultados.slice(0,12).map((p) => <article key={p.id} className="ca-candidato">
              <div className="ca-candidato-icone"><IconePeca nome={iconeDaCategoria(null,p.nome)} tamanho={48}/><span>Não homologado</span></div>
              <strong>{p.nome ?? "Produto sem descrição"}</strong>
              <small>SKU: {p.sku ?? "—"}</small><small>Marca: {p.marca ?? "não informada"}</small>
              <p>Conferir modelo, motorização, versão, ano, OEM, notas e restrições técnicas.</p>
              <a href={"#/catalogo-espelho?q=" + encodeURIComponent(p.sku ?? "")}>Conferir cadastro</a>
            </article>)}
          </div> : <p className="ca-nenhum">{carregando ? "Carregando registros…" : "Nenhum candidato encontrado com os filtros atuais. Tente limpar o termo ou selecionar outro sistema."}</p>}
          {(aplicado.ano || aplicado.tecnologia) && <p className="ca-ressalva">Ano e tecnologia selecionados: {aplicado.ano} {aplicado.tecnologia}. Esses campos não podem ser comprovados pela busca textual. Apenas aplicações homologadas utilizam essas informações como filtro definitivo.</p>}
        </section>
        <section className="ca-bloco">
          <div className="ca-numero">05 / GOVERNANÇA E PUBLICAÇÃO</div>
          <h2>Portão de liberação comercial.</h2>
          <p className="ca-subtitulo">O registro físico no Bling é único. Cada aplicação, imagem e anúncio depende de aprovação antes de entrar na vitrine pública.</p>
          <div className="ca-portao">
            {[
              { n:"01", nome:"Identidade física", detalhe:"SKU, fabricante, NF, GTIN e conservação de origem.", url:"#/catalogo-espelho" },
              { n:"02", nome:"Compatibilidade", detalhe:"Modelo, ano, motor, tecnologia, OEM e contraindicações.", url:"#/taxonomia" },
              { n:"03", nome:"Conteúdo", detalhe:"Descrição técnica, fotos, direitos de uso e evidências.", url:"#/imagens" },
              { n:"04", nome:"Publicação", detalhe:"Aprovação formal da loja; sem atualização automática do Bling.", url:"#/fila" },
            ].map((v) => <a key={v.n} href={v.url}><span>{v.n}</span><strong>{v.nome}</strong><small>{v.detalhe}</small></a>)}
          </div>
          <p className="ca-bloqueio"><Icone nome="escudo" tamanho={17}/> Modo de auditoria: esta tela não publica produtos, não altera estoque, não emite notas e não muda dados fiscais.</p>
        </section>
        <section className="ca-bloco ca-conclusao">
          <div className="ca-numero">FICHA DE REFERÊNCIA · NÃO LANÇAR ANÚNCIO</div>
          <h2>Conferir origem, sem lançar anúncio.</h2>
          <div className="ca-conclusao-linha"><IconePeca nome="arrefecimento" tamanho={58}/><p><strong>Trabalho por evidências, produto físico único e múltiplas aplicações verificadas.</strong><span>Revisão antes de liberar; sem inferir equivalência entre marcas apenas por semelhança de código ou descrição.</span></p>
            <a href="#/catalogo-espelho">Abrir auditoria técnica</a></div>
        </section>
        <footer className="ca-rodape"><span>Conecta.IA · painel autenticado · Layout Canva aprovado</span><span>Mobis Autopeças · somentes dados da própria loja</span></footer>
      </section>
    </div>
  );
}
