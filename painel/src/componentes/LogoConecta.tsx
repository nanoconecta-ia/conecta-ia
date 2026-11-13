import { type EstadoEsfera } from "./Esfera.tsx";
import { RoboNano } from "./RoboNano.tsx";

/**
 * Marca institucional Conecta.IA em azul-elétrico, laranja e grafite.
 * O avatar E02 do Nano permanece montado com os estados/animações originais.
 * Somente a marca é nova. Não altera o HTML, os hologramas, o chat ou a matriz.
 */
export function LogoConecta({ tamanho = 40, nome = false, estado = "ocioso" }: {
  tamanho?: number; nome?: boolean; estado?: EstadoEsfera;
}) {
  const lado = Math.max(24, Math.min(144, tamanho));
  return (
    <span className="logo-conecta">
      <span style={{ display: "inline-flex", alignItems: "center", position: "relative", flex: "none" }}>
        <svg width={lado} height={lado} viewBox="0 0 64 64" role="img"
          aria-label="Conecta.IA — símbolo institucional" focusable="false" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="conecta-metalico" x1="14" y1="4" x2="52" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" /><stop offset=".46" stopColor="#BDDAE8" /><stop offset="1" stopColor="#788DA6" />
            </linearGradient>
            <linearGradient id="conecta-energia" x1="14" y1="18" x2="48" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFB538" /><stop offset=".52" stopColor="#FF6A00" /><stop offset="1" stopColor="#B53E0C" />
            </linearGradient>
            <linearGradient id="conecta-orbita" x1="4" y1="30" x2="62" y2="62" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0B1F2A" /><stop offset=".5" stopColor="#00AEEF" /><stop offset="1" stopColor="#66D8FF" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="62" height="62" rx="14" fill="#0B1F2A" />
          <path d="M51 13.5A25 25 0 1 0 51 50.5" stroke="url(#conecta-metalico)" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M48 18A20.5 20.5 0 1 0 48 46" stroke="url(#conecta-energia)" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M46 47C38 58 17 61 5 54" stroke="url(#conecta-orbita)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <g stroke="#FF8A00" strokeWidth="2.3" strokeLinecap="round">
            <path d="M11 25H3" /><path d="M9 33H2" /><path d="M11 41H3" />
          </g>
          <g fill="#FFA323"><circle cx="3" cy="25" r="2.5" /><circle cx="2" cy="33" r="2.5" /><circle cx="3" cy="41" r="2.5" /></g>
        </svg>
        {/* Preserva a presença do Nano e sua ligação com o estado real, sem redesenhar o E02. */}
        <span style={{ position: "absolute", right: -3, bottom: -3, borderRadius: "50%", background: "#0B1F2A", height: 18, width: 18, display: "grid", placeItems: "center" }}>
          <RoboNano estado={estado} tamanho={17} decorativo />
        </span>
      </span>
      {nome && <b>Conecta<span>.IA</span></b>}
    </span>
  );
}
