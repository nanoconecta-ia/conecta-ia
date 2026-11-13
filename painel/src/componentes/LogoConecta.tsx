import { type EstadoEsfera } from "./Esfera.tsx";

/**
 * Marca institucional do Conecta.IA.
 * O Nano.IA continua sendo o agente animado em seus componentes próprios.
 * Não modificar RoboNano, Nano Eye E02, hologramas ou qualquer HTML já homologado.
 */
export function LogoConecta({ tamanho = 40, nome = false, estado: _estado = "ocioso" }: { tamanho?: number; nome?: boolean; estado?: EstadoEsfera }) {
  const lado = Math.max(24, Math.min(144, tamanho));
  return (
    <span className="logo-conecta" aria-label={nome ? undefined : "Conecta.IA — plataforma"}>
      <svg
        width={lado} height={lado} viewBox="0 0 64 64"
        role="img" aria-label="Conecta.IA" focusable="false"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#111F2B" stroke="#376075" strokeWidth="2" />
        <path d="M44.5 16.8A23 23 0 1 0 44.5 47.2" stroke="#4DCAE0" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M27 32H42" stroke="#E8F5F5" strokeWidth="5" strokeLinecap="round" />
        <circle cx="46" cy="16.8" r="5" fill="#67E2BA" stroke="#111F2B" strokeWidth="1.6" />
        <circle cx="46" cy="47.2" r="5" fill="#67E2BA" stroke="#111F2B" strokeWidth="1.6" />
        <circle cx="44" cy="32" r="4" fill="#E8F5F5" stroke="#111F2B" strokeWidth="1.4" />
      </svg>
      {nome && <b>Conecta<span>.IA</span></b>}
    </span>
  );
}
