import "./RoboNano.css";
import { useId } from "react";
import type { EstadoEsfera } from "./Esfera.tsx";

/** Avatar vetorial leve, criado para o Nano.IA. Não substitui os dados nem a lógica do agente. */
export function RoboNano({ tamanho = 44, estado = "ocioso", decorativo = false }: { tamanho?: number; estado?: EstadoEsfera; decorativo?: boolean }) {
  const base = useId().replace(/:/g, "");
  const grad = `nano-metal-${base}`, rosto = `nano-rosto-${base}`, halo = `nano-halo-${base}`;
  return <span className="nano-robo" data-estado={estado} style={{ ["--nano-robo-d" as string]: `${tamanho}px` }}
    role={decorativo ? undefined : "img"} aria-label={decorativo ? undefined : "Nano.IA, assistente da Mobis"} aria-hidden={decorativo || undefined}>
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={grad} x1="13" y1="6" x2="90" y2="98" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF"/><stop offset=".3" stopColor="#F2A59A"/><stop offset=".58" stopColor="#716D86"/><stop offset=".83" stopColor="#F9E2E0"/><stop offset="1" stopColor="#332A3C"/></linearGradient>
        <linearGradient id={rosto} x1="30" y1="29" x2="72" y2="77" gradientUnits="userSpaceOnUse"><stop stopColor="#291F37"/><stop offset=".5" stopColor="#090D18"/><stop offset="1" stopColor="#241B34"/></linearGradient>
        <radialGradient id={halo}><stop stopColor="#FB5B52" stopOpacity=".22"/><stop offset="1" stopColor="#FB5B52" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="49" fill={`url(#${halo})`}/>
      <path d="M46 14V10a4 4 0 018 0v4" stroke="#E1A49B" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="50" cy="11" r="4" fill="#FF685F"/>
      <rect x="5" y="39" width="13" height="22" rx="6" fill={`url(#${grad})`} stroke="#F7C0BB" strokeWidth="2"/>
      <rect x="82" y="39" width="13" height="22" rx="6" fill={`url(#${grad})`} stroke="#F7C0BB" strokeWidth="2"/>
      <rect x="15" y="17" width="70" height="70" rx="28" fill={`url(#${grad})`} stroke="#FFC0B8" strokeWidth="2"/>
      <rect x="23" y="27" width="54" height="47" rx="20" fill={`url(#${rosto})`}/>
      <path d="M32 44Q39 39 46 45M54 45Q61 39 68 44" stroke="#FF817E" strokeWidth="4.3" strokeLinecap="round"/>
      <path d="M38 57Q50 69 62 57" stroke="#FF817E" strokeWidth="4" strokeLinecap="round"/>
      <ellipse cx="34" cy="31" rx="13" ry="4" transform="rotate(-23 34 31)" fill="white" opacity=".4"/>
      <path d="M33 79Q50 90 67 79" stroke="#FFF2F0" strokeWidth="3" strokeLinecap="round" opacity=".58"/>
    </svg>
  </span>;
}
