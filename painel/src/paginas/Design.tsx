import { PECAS, TIPOS_VEICULO } from "../lib/icones.ts";
import { VISTAS } from "../lib/vistas.ts";
import { IconePeca, IconeVeiculo } from "../componentes/IconePeca.tsx";
import { LogoConecta } from "../componentes/LogoConecta.tsx";
import { Icone } from "../componentes/Icone.tsx";
import { VistaExplodida } from "../componentes/VistaExplodida.tsx";

// Guia vivo do Design System: mostra os tokens e componentes reais, para todas as telas compartilharem o mesmo padrão.
const CORES: [string, string][] = [["--fundo", "Fundo"], ["--cartao", "Cartão"], ["--realce", "Realce"], ["--borda", "Borda (decorativa)"], ["--borda-forte", "Borda de campo (3:1)"], ["--texto", "Texto"], ["--suave", "Texto suave"], ["--marca", "Terracota (primário)"], ["--marca-forte", "Terracota forte"], ["--ciano", "Azul-petróleo (dados)"], ["--verde", "Verde (WhatsApp)"], ["--grafite", "Grafite"], ["--ok", "OK"], ["--atencao", "Atenção"], ["--erro", "Erro"]];

export function Design() {
  return (
    <>
      <div className="cartao">
        <h1>Design System <span className="selo atencao">referência</span></h1>
        <p className="suave">Tokens e componentes compartilhados por todos os módulos. Telas novas reaproveitam isto; nada de cor ou fonte solta. Use o seletor de aparência no topo para ver os modos Automático, Claro, Escuro, Noturno e Alto contraste.</p>
      </div>
      <div className="cartao">
        <h2>Cores (tokens)</h2>
        <div className="grade">{CORES.map(([v, n]) => (
          <div key={v} className="linha"><span style={{ width: 28, height: 28, borderRadius: 6, background: `var(${v})`, border: "1px solid var(--borda)" }} /><span><strong>{n}</strong><br /><code>{v}</code></span></div>
        ))}</div>
      </div>
      <div className="cartao">
        <h2>Tipografia</h2>
        <p style={{ fontFamily: "var(--titulo)", fontSize: "1.6rem", margin: 0 }}>Títulos e números grandes</p>
        <p style={{ margin: "4px 0" }}>Corpo de texto, rótulos e botões.</p>
        <p className="mono" style={{ margin: 0 }}>SKU CI001086 · NCM 8409.99.49 · 2026-10-17 12:00</p>
      </div>
      <div className="cartao">
        <h2>Marca e agente</h2>
        <p className="suave">Identidade do Conecta.IA e ícone estático do Nano.IA. Estado operacional é comunicado por texto acessível, sem esfera animada.</p>
        <div className="linha" style={{ gap: 28 }}>
          <LogoConecta tamanho={64} nome />
          <span className="agente-identidade-icone" role="img" aria-label="Nano.IA"><Icone nome="agentes" tamanho={22}/></span>
        </div>
      </div>
      <div className="cartao">
        <h2>Ícones da plataforma</h2>
        <p className="suave">Desenho próprio, com volume. O agente usa o slug da taxonomia para escolher o ícone; sem slug conhecido, cai no nome e depois no genérico.</p>
        <h3>Peças e categorias</h3>
        <div className="galeria-icones">{PECAS.map((k) => (
          <figure key={k}><IconePeca nome={k} tamanho={64} /><figcaption className="mono">{k}</figcaption></figure>
        ))}</div>
        <h3>Tipos de veículo (um tom por tipo)</h3>
        <div className="galeria-icones galeria-veiculos">{TIPOS_VEICULO.map((t) => (
          <figure key={t.chave}><IconeVeiculo tipo={t} largura={150} /><figcaption>{t.rotulo}</figcaption></figure>
        ))}</div>
        <h3>Vistas explodidas</h3>
        <div className="galeria-vistas">{VISTAS.map((v) => <VistaExplodida key={v.area} vista={v} aoEscolher={() => undefined} />)}</div>
      </div>
      <div className="cartao">
        <h2>Componentes</h2>
        <p className="linha"><button>Primário</button><button className="sec">Secundário</button><button className="perigo">Perigo</button><button disabled>Desabilitado</button></p>
        <p className="linha"><span className="selo ok">Aprovado</span><span className="selo atencao">A confirmar</span><span className="selo erro">Bloqueado</span><span className="selo">Neutro</span></p>
        <p className="linha"><span className="selo ok">Foto real</span><span className="selo atencao">Imagem sintética</span></p>
        <form><label>Campo de texto<input placeholder="Exemplo" /></label></form>
        <div className="rolagem"><table><thead><tr><th>Produto</th><th>Campo</th><th>Confiança</th></tr></thead>
          <tbody><tr><td className="mono">EXEMPLO-001</td><td>marca_peca</td><td>70%</td></tr></tbody></table></div>
      </div>
    </>
  );
}
