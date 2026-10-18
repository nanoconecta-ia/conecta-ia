// Reusa a mesma regra M6 do backend atual, com JWT do usuário e falha fechada.
import { podeDecidir, type RpcUsuario } from '../../../../supabase/functions/_shared/assistente/permissao.ts';
export const oauthLegadoAtivo = (env: { WEB_OAUTH_LEGADO_ATIVO?: string } = process.env) => env.WEB_OAUTH_LEGADO_ATIVO === '1';
export const podeConectarBling = (usuario: RpcUsuario, lojaId: string) => podeDecidir(usuario, lojaId);
