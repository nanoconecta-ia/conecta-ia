// Reusa a mesma regra M6 do backend atual, com JWT do usuário e falha fechada.
import { podeDecidir, type RpcUsuario } from './_permissao_shared.ts';
export const oauthLegadoAtivo = (env: Record<string, string | undefined> = process.env) => env.WEB_OAUTH_LEGADO_ATIVO === '1';
export const podeConectarBling = (usuario: RpcUsuario, lojaId: string) => podeDecidir(usuario, lojaId);
