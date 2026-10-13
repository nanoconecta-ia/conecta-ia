# Conecta.IA — instruções para sessões do Claude Code

Site inteligente que conecta ERPs (piloto: Bling) a uma loja online, de forma autônoma.
Este arquivo é lido em toda sessão. Se algo aqui conflitar com um pedido no chat, pergunte.

## Isolamento (regra 0)
- Projeto **isolado** dos demais projetos e repositórios.
- Nunca escreva em outros repositórios nem use o projeto Supabase **NanoShell IA**: ele é de outro produto e não pode ser tocado, pausado ou alterado.
- Supabase deste projeto: `conecta-ia`, ref `dsfzhsrudriqkumtlqwj` (sa-east-1, plano gratuito). Confirme que o ref bate antes de qualquer operação. O ref `ptilvkzuhjnqnfydjcly` (NanoShell IA) NUNCA deve ser usado aqui.

## Modelo
1. O ERP (Bling) é a **fonte** de cadastro, preço e estoque. Ninguém cadastra o mesmo produto duas vezes.
2. **Cada cliente tem seu indexador independente**, com agente próprio, e escolhe como os dados entram:
   - **Modo externo:** o agente NanoShell envia cada mudança por API (chave por loja).
   - **Modo nativo:** o indexador do próprio Conecta.IA lê os produtos do Bling do cliente (credencial por cliente) e o agente do cliente melhora imagens, cadastro e SEO.
3. **O NanoShell nunca é ponto único de falha.** Se ele falhar, o cliente continua: o modo nativo assume e o site segue no ar.
4. O Conecta.IA é a frente de venda (como um PDV do site). O ERP é a retaguarda.
5. O lojista edita só o que é do site: banners, páginas, SEO, tema e regras de venda. O cadastro do produto vem do ERP.
6. **Enriquecimento nunca inventa.** Cada dado enriquecido guarda fonte, data e nível de confiança, separado do dado original do ERP. Sem evidência, fica "a confirmar" ou vazio. Nunca inventar preço, estoque, GTIN, NCM, compatibilidade ou especificação.
7. **Escrita de volta no Bling: padrão é NÃO escrever.** O que o agente melhora fica na camada do Conecta.IA. Gravar no Bling só com autorização explícita do cliente, por campo (decisão em aberto).
8. Produto incompleto não é publicado.
9. **Cada cliente tem o próprio domínio** (o piloto usa `www.mobisautoparts.com.br`). A loja é resolvida pelo domínio, no servidor. Um domínio só entra em produção depois de verificar DNS e SSL. **Nunca alterar DNS, domínio ou hospedagem de um cliente sem autorização explícita**, e sempre com plano de volta (o site atual continua no ar até o novo ser validado).

## Controle de venda (dois níveis)
- **Super admin** (pessoa com login próprio e verificação em duas etapas) bloqueia vendas por **UF**, em qualquer loja.
- **Lojista**, dentro do que o super admin permite: limita campanha por UF, vende só para pessoa física ou só jurídica, ou opera só como catálogo.
- Permissão efetiva = o que o super admin permite **∩** o que o lojista escolheu. O lojista nunca libera o que foi bloqueado.
- UF vem do **CEP de entrega** no checkout (não do IP). Pessoa física/jurídica vem do CPF/CNPJ do checkout. Tudo validado **no servidor**.
- Cliente de UF bloqueada ainda vê o catálogo e vai para o WhatsApp, exceto em loja só catálogo.
- Toda mudança de regra gera registro de auditoria.

## Checkout
- Modo de venda por loja: `checkout`, `whatsapp` ou `hibrido` (no híbrido, escolha por produto).
- Modo WhatsApp não simula checkout. Link de WhatsApp com nome, referência, código interno e URL.
- Antes de cobrar, revalidar preço e estoque. Dado do agente mais velho que a idade máxima (padrão sugerido: 15 min) bloqueia a compra e leva ao WhatsApp. Preço mudou: avisar o cliente com o valor atual.
- Se o agente ou o ERP ficar fora do ar, o site continua mostrando o último catálogo válido.

## Segurança
- Nenhum segredo (super admin, chaves de loja, tokens, service role do Supabase) no frontend, no repositório ou em log.
- Isolamento total entre lojas no servidor e no banco (RLS quando suportado).
- Não fazer deploy, migração destrutiva nem mudança de DNS/domínio sem autorização explícita.
- Super admin e agente usam credenciais **separadas**: login com MFA para pessoas, chave por loja só para o agente externo.
- **Credenciais do Bling por cliente** (modo nativo): guardadas cifradas, só no servidor, isoladas por loja, nunca em log nem no navegador. O JWT do Bling tem ~1.500 a 3.000 caracteres: não truncar. Header `enable-jwt: 1` na obtenção, na renovação e em todas as requisições.

## Como trabalhar aqui
- Antes de escolher stack, banco ou estrutura: **leia o site pronto** neste repositório e mostre o que encontrou. Reaproveite o que existe.
- Antes de criar tabelas ou migrações: mostre o desenho e espere aprovação.
- Entregue por etapas, com testes e evidências. Não declare concluído só porque compila.
- Informe sempre: arquivos alterados, decisões, testes rodados, limitações reais.

## Cuidados com o enriquecimento
- Regras fiscais (NCM, CEST, CST, CFOP) e logísticas aplicadas pelo agente devem ser validadas pelo contador do cliente antes de entrar em produção. Não fixar uma regra única para todos os produtos nem para todos os clientes.
- Compatibilidade de peça só com relação técnica, fonte e data registradas.
- Custo de IA é por cliente: medir e limitar o uso do agente de cada loja.

Detalhes e decisões em aberto: `docs/ARQUITETURA.md`.
