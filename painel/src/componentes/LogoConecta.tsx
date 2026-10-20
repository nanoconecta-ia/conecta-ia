/** Marca do Conecta.IA: esfera com nuvem e órbita (símbolo "conecta" do sprite). Com `nome`, mostra também o nome. */
export function LogoConecta({ tamanho = 32, nome = false }: { tamanho?: number; nome?: boolean }) {
  return (
    <span className="logo-conecta">
      <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" role={nome ? undefined : "img"} aria-label={nome ? undefined : "Conecta.IA"} aria-hidden={nome ? true : undefined} focusable="false"><use href="#conecta" /></svg>
      {nome && <b>Conecta<span>.IA</span></b>}
    </span>
  );
}
