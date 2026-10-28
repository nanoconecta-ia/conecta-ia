import { useEffect, useState } from "react";
import { VERSAO_LOCAL, desatualizada, rotuloVersao, type Versao } from "../lib/versao.ts";

/** Compara a versão rodando com a publicada (version.json, sempre da rede). Se houver uma mais nova, avisa e oferece atualizar:
 *  limpa o cache do app e recarrega. Não mexe em login nem em dados (só no cache da casca). */
export function AvisoVersao() {
  const [nova, setNova] = useState<Versao | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  useEffect(() => {
    let vivo = true;
    const checar = () => {
      fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null)).then((v: unknown) => { if (vivo && desatualizada(VERSAO_LOCAL, v)) setNova(v); }).catch(() => { /* sem rede: sem aviso */ });
    };
    checar();
    const aoVoltar = () => { if (document.visibilityState === "visible") checar(); };
    document.addEventListener("visibilitychange", aoVoltar);
    const id = window.setInterval(checar, 5 * 60 * 1000);
    return () => { vivo = false; document.removeEventListener("visibilitychange", aoVoltar); window.clearInterval(id); };
  }, []);
  async function atualizar() {
    setAtualizando(true);
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
      const chaves = await caches?.keys?.();
      await Promise.all((chaves ?? []).map((k) => caches.delete(k)));
    } catch { /* segue para o recarregamento mesmo assim */ }
    window.location.reload();
  }
  if (!nova) return null;
  return (
    <div className="aviso-versao" role="status">
      <span>Há uma versão nova do painel (<span className="mono">{rotuloVersao(nova)}</span>). Você está na <span className="mono">{rotuloVersao(VERSAO_LOCAL)}</span>.</span>
      <button type="button" disabled={atualizando} onClick={() => void atualizar()}>{atualizando ? "Atualizando…" : "Atualizar agora"}</button>
    </div>
  );
}
