// Barra de status fixa no rodapé: onde estou, em qual loja, em que modo. Só mostra o que o App já sabe (nada inventado).
export function BarraStatus({ loja, tela, demo }: { loja: string | null; tela: string; demo: boolean }) {
  return (
    <footer className="barra-status" role="status" aria-label="Estado do painel">
      <span className="ponto" aria-hidden="true" />
      <span>{demo ? "Modo demonstração" : "Conectado"}</span>
      <span className="sep" aria-hidden="true">/</span>
      <span className="mono">{loja ?? "sem loja"}</span>
      <span className="sep" aria-hidden="true">/</span>
      <span>{tela}</span>
      <span className="direita suave"><kbd>Ctrl</kbd>+<kbd>K</kbd> comandos</span>
    </footer>
  );
}
