/** Símbolos de canais oficiais, vetoriais, locais e independentes de CDN.
 * As cores de cada plataforma são aplicadas no botão do rodapé MOBIS.
 * Este componente não adiciona vínculos externos nem recolhe dados do visitante.
 */
export type CanalRedeMobis = "facebook" | "instagram" | "whatsapp";
export function IconeRedeMobis({ canal }: { canal: CanalRedeMobis }) {
  if (canal === "facebook") return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M14.1 21v-7.8h2.6l.4-3.4h-3V7.7c0-1 .3-1.7 1.7-1.7h1.6V3a22 22 0 0 0-2.4-.1c-2.5 0-4.2 1.5-4.2 4.4v2.5H8.3v3.4h2.5V21h3.3Z" />
    </svg>
  );
  if (canal === "instagram") return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5.2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 11.5a8.7 8.7 0 0 1-12.7 7.7L3 20.9l1.7-4.8A8.7 8.7 0 1 1 20.6 11.5Z" />
      <path d="M8.4 7.5c.3-.4.8-.5 1.1-.1l1.3 1.7c.2.3.1.7-.2 1l-.5.6c.7 1.4 1.8 2.5 3.3 3.2l.7-.7c.3-.3.7-.4 1.1-.2l1.7 1c.4.2.5.7.2 1.2-.6 1.3-1.9 1.8-3.4 1.4-3.1-.9-5.9-3.6-6.6-6.5-.3-1.2 0-2.4.3-2.6Z" />
    </svg>
  );
}
