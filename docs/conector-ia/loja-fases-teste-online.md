# Conecta.IA — duas fases da loja pública (piloto Mobis)

## Finalidade

A rota administrativa **Publicação da loja** apresenta um controle com **Loja teste** e **Loja publicada online**.
Usa o campo existente de banco (lojas.ambiente = teste/producao). Não cria tabelas, notas fiscais, produtos ou integrações de pagamento.

### Loja teste

- A prévia de avaliação dos clientes é aberta no link de teste do próprio painel, usando o slug da loja.
- O cliente vê um aviso claro de teste, pode navegar no catálogo homologado, usar filtros, chat e pedir esclarecimentos ao vendedor.
- Não há checkout, emissão de pedido, pagamento, nota ou baixa automática de estoque.
- Apenas produtos já publicados e dados técnicos aprovados podem aparecer. O modo teste **não** dá permissão para mostrar rascunhos privados.
- O link compartilhável **não tem controle de acesso por convite**. Pessoas que o receberem podem repassá-lo. Não usar dados fictícios sensíveis nem chamar a prévia de "privada".
- A função de SEO (sitemap, feed e páginas indexáveis) bloqueia conteúdo da loja em teste. A aplicação também sugere noindex no navegador, mas isso não equivale a controle de acesso.

### Loja publicada online

O botão não muda a fase sozinho ao ser selecionado. Requer:

1. Responsável autenticado e autorizado pela RPC pode_administrar_loja (editor não pode).
2. Cadastro da loja ativo.
3. Políticas e dados empresariais formalmente aprovados (loja_politicas.status = aprovada).
4. Domínio principal com DNS e SSL verificados em loja_dominios.
5. Na Mobis, domínio oficialmente vinculado a mobisautopecas.com.br (com ou sem www), não o antigo mobisautoparts.com.br.
6. Pelo menos um produto publicado sob as travas normais do catálogo.
7. Modo de venda seguro para o piloto: whatsapp ou catalogo; checkout/hibrido precisam homologação independente.
8. Número WhatsApp válido, quando requerido.
9. Confirmação manual da existência de backup recuperável e teste real com clientes no celular.
10. Confirmação digitada PUBLICAR e confirmação explícita no navegador.

A função de servidor loja-publicacao revalida o estado inteiro e realiza a atualização com prevenção de conflito, rate limit, trigger de segurança e auditoria.
O retorno à fase Teste requer confirmação VOLTAR PARA TESTE.

## Separação crucial: modo no banco versus site publicado

Mesmo após alterar ambiente para producao no banco, o site só abre no domínio oficial quando a implantação, roteamento,
certificado, testes de regressão e infraestrutura forem concluídos. A mudança de fase **não faz deploy**, troca de DNS,
ativação de checkout, sincronização nem publicação automática de produtos.

Antes de implantar o código:
- Revisar PR e CI. Fazer cópia de segurança e validar restauração. Confirmar conformidade legal das políticas.
- Implantar a função autenticada loja-publicacao e atualizar loja-publica/loja-seo em janela controlada.
- Verificar RLS, tokens, rate limit e CORS; testar lojista autorizado, editor bloqueado e chamada anônima bloqueada.
- Validar visual de teste no celular e desktop sem checkout real.
- Verificar DNS/SSL do domínio mobisautopecas.com.br e registro principal da loja (a entrada www ainda precisa de conferência).
- Testar retorno seguro para teste caso alguma condição falhe.
- Fazer deploy da vitrine separadamente e repetir teste de link de produto, WhatsApp e SEO.
- **Não ativar modo online antes de todas essas etapas.**

## Estado real encontrado em 12/11/2026

- Mobis: loja ativa; ambiente teste; modo_venda whatsapp.
- Produtos publicados: 0.
- Políticas: rascunho.
- Domínios verificados vinculados: 0.

Esse estado é intencionalmente preservado. O painel mostrará a opção online bloqueada até os pré-requisitos serem resolvidos.

## Base técnica

- Painel: painel/src/paginas/PublicacaoLoja.tsx
- API autenticada: supabase/functions/loja-publicacao/index.ts
- Testes puros: supabase/functions/_shared/loja/publicacao.test.ts
- Loja do cliente: painel/src/paginas/Loja.tsx
- API de vitrine: supabase/functions/loja-publica/index.ts
- SEO (bloqueio em teste): supabase/functions/loja-seo/index.ts

Atenção: branch/PR não equivalem a deploy nem ativação. Nenhuma alteração no Bling foi realizada.
