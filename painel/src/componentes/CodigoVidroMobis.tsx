import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import "./codigo-vidro-mobis.css";

/**
 * Entrada de código (OTP) no visual "Grafite Glass" da Mobis (opção 01).
 * Funcional e acessível: numérico, N caixas, cola distribuída, autofill do SO
 * (autocomplete one-time-code na primeira caixa). `valor` é a string só de
 * dígitos (ex.: "482517"); `onChange` recebe a string montada, limitada a `tamanho`.
 * Não envia nada nem valida regra de negócio — quem decide é o fluxo que o usa.
 */
export function CodigoVidroMobis({
  valor, onChange, tamanho = 6, id, rotulo, autoFocus = false,
}: {
  valor: string;
  onChange: (v: string) => void;
  tamanho?: number;
  id?: string;
  rotulo?: string;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digitos = valor.replace(/\D/g, "").slice(0, tamanho).split("");
  const foco = (i: number) => refs.current[Math.max(0, Math.min(i, tamanho - 1))]?.focus();

  const inserir = (inicio: number, texto: string) => {
    const base = valor.replace(/\D/g, "").slice(0, tamanho).split("");
    const chars = texto.replace(/\D/g, "").split("");
    let j = inicio;
    for (const c of chars) { if (j >= tamanho) break; base[j] = c; j++; }
    onChange(base.join("").slice(0, tamanho));
    return j;
  };

  const aoDigitar = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const c = e.target.value.replace(/\D/g, "");
    if (!c) { // apagou a caixa
      const base = valor.replace(/\D/g, "").slice(0, tamanho).split("");
      base[i] = ""; onChange(base.join(""));
      return;
    }
    const prox = inserir(i, c);
    foco(prox);
  };

  const aoTecla = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digitos[i] && i > 0) { e.preventDefault(); foco(i - 1); }
    else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); foco(i - 1); }
    else if (e.key === "ArrowRight" && i < tamanho - 1) { e.preventDefault(); foco(i + 1); }
  };

  const aoColar = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, tamanho);
    if (!t) return;
    e.preventDefault();
    const prox = inserir(0, t);
    foco(prox);
  };

  return (
    <div className="otp-vidro" role="group" aria-label={rotulo ?? `Código de ${tamanho} dígitos`}>
      <div className="otp-vidro-caixas">
        {Array.from({ length: tamanho }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="otp-vidro-caixa"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={tamanho}
            value={digitos[i] ?? ""}
            id={i === 0 ? id : undefined}
            aria-label={`Dígito ${i + 1} de ${tamanho}`}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => aoDigitar(i, e)}
            onKeyDown={(e) => aoTecla(i, e)}
            onPaste={aoColar}
            onFocus={(e) => e.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
