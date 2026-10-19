// Tela "Backup do Bling": textos e formatações. O backup guarda custo e fornecedor; só o administrador da loja chega nele (o banco garante).
export type StatusBackup = "em_andamento" | "completo" | "parcial" | "falhou";
export interface Snapshot { id: string; criado_em: string; concluido_em: string | null; origem: "manual" | "diario"; status: StatusBackup; contagens: { produtos?: number; categorias?: number; contatos?: number } | null; erro: string | null }

export const ROTULO_STATUS: Record<StatusBackup, string> = { em_andamento: "Em andamento", completo: "Completo", parcial: "Parcial", falhou: "Falhou" };
export const ROTULO_ORIGEM: Record<Snapshot["origem"], string> = { manual: "Feito por você", diario: "Automático (diário)" };

/** "12 produtos, 13 categorias, 2 fornecedores" */
export function resumoContagens(c: Snapshot["contagens"]): string {
  const n = (v: number | undefined, um: string, varios: string) => `${v ?? 0} ${(v ?? 0) === 1 ? um : varios}`;
  return [n(c?.produtos, "produto", "produtos"), n(c?.categorias, "categoria", "categorias"), n(c?.contatos, "fornecedor", "fornecedores")].join(", ");
}

/** Último backup que serve de cópia: o mais recente completo (ou, na falta dele, parcial). */
export function ultimoUtil(lista: Snapshot[]): Snapshot | null {
  const ordem = [...lista].sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em));
  return ordem.find((s) => s.status === "completo") ?? ordem.find((s) => s.status === "parcial") ?? null;
}

/** Aviso honesto sobre a idade da cópia (para o lojista saber quanto está desatualizada se o Bling cair). */
export function avisoIdade(s: Snapshot | null, agora = Date.now()): { ok: boolean; texto: string } {
  if (!s) return { ok: false, texto: "Ainda não há cópia do cadastro. Faça o primeiro backup." };
  const horas = Math.floor((agora - Date.parse(s.criado_em)) / 3_600_000);
  const quando = horas < 1 ? "há menos de 1 hora" : horas < 48 ? `há ${horas} h` : `há ${Math.floor(horas / 24)} dias`;
  const parcial = s.status === "parcial" ? " (parcial: faltou parte do cadastro)" : "";
  return { ok: s.status === "completo" && horas < 48, texto: `Última cópia ${quando}${parcial}.` };
}

export function nomeArquivoCsv(snapshotId: string, criadoEm: string): string {
  const dia = criadoEm.slice(0, 10).replace(/[^0-9-]/g, "");
  return `bling-produtos-${dia}-${snapshotId.slice(0, 8)}.csv`;
}
