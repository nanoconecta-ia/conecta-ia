# Mobis — revisão da loja e amostra de produto

13/11/2026. Escopo: vitrine pública, mantendo o desenho aprovado, a administração autenticada e o ambiente de teste. Nenhuma alteração no Bling, banco, preços, estoque, permissões ou regras de venda.

## Diagnóstico

| Prioridade | Evidência / risco | Tratamento |
| --- | --- | --- |
| P0 | O navegador mostra “Não seguro”; curl com verificação normal de TLS retorna SEC_E_WRONG_PRINCIPAL para raiz e www. | DNS já confirmado em Google/Cloudflare. Certificado e Enforce HTTPS ainda precisam ser concluídos no GitHub Pages. Não ignorar certificados nem prometer segurança antes do teste real. |
| P1 | Busca principal distante da primeira tela. | Busca rápida imediatamente após o cabeçalho, preservando o restante do layout. |
| P1 | Atalho de veículo usava q textual, embora a API filtre aplicações pelo nome exato do modelo. | Resolver o nome aprovado do modelo; versões ambíguas permanecem para seleção explícita. Não supor aplicação pela descrição comercial. |
| P1 | Trocar atalho não limpava ano/modelo/categoria dos controles visíveis. | Sincronizar controles e filtros enviados, limpando os anteriores. |
| P1 | Catálogo vazio era apresentado como indisponibilidade de peças. | Explicar ausência de anúncio aprovado, sem afirmar falta de estoque físico. |
| P1 | Não havia peça para avaliar a apresentação durante o piloto vazio. | Cartão demonstrativo isolado, sem preço, SKU de ERP, disponibilidade, WhatsApp, lista comercial ou checkout. Só aparece para Mobis quando ambiente=teste e venda_habilitada=false estiverem explícitos na resposta. |
| P2 | Atalho L200 / Pajero filtrava só L200. | Rótulo ajustado para L200, sem prometer uma busca conjunta que não era feita. |
| P2 | Campo de busca por código não recebia foco; movimento reduzido não era respeitado pelo scroll em JavaScript. | Nome acessível da busca, foco ao usar o atalho de código e respeito à preferência de movimento reduzido. |

Não há evidência analítica de quantos clientes abandonaram o site. O aviso de segurança é um risco de confiança observado, não uma medição de perda de vendas.

## Pontos fortes preservados

- Identidade visual consistente com o posicionamento em picapes, vans e utilitários diesel.
- Entrada por veículo, sistema e referência de peça.
- Conferência humana de aplicação e disponibilidade, sem compatibilidade ou estoque inventados.
- Lista de consulta distinta de pedido; ausência de cobrança durante o piloto.
- Rota de loja por hostname separada da administração com sessão. A inspeção de código não substitui auditoria de autorização no servidor.

## Produto demonstrativo

“Motor parcial para HR / Bongo”, com ilustração de categoria identificada e ficha expansível. É uma amostra visual, não anúncio comercial nem cadastro. Nenhuma alteração no cadastro real CI003696 ou em suas condições comerciais.

O catálogo público continua recebendo exclusivamente produtos aprovados. Falha de API, produção, venda habilitada ou flags ausentes não autorizam mostrar a amostra. Ela não conta nos resultados, não é persistida no ERP e não entra na lista de consulta.

## Validação e limites

- Build TypeScript/Vite e 399 testes de unidade passaram localmente.
- Regressão visual dedicada cobre 360, 390, 720 e 1280 pixels, ficha expansível, filtros, busca, foco e ausência da amostra em produção/erro/flags ausentes. Seus dados são SIMULADOS e não homologam a integração real.
- O executor local não permitiu abrir Chromium (socket: Operation not permitted). O workflow de interface existente executa os testes de navegador em runner próprio e guarda screenshots com o sufixo SIMULADO.
- SSL, acesso anônimo ao domínio, dados reais e checkout desabilitado ainda exigem validação de ponta a ponta após a publicação autorizada. Não declarar homologação apenas por compilação ou testes com fixture.

## Publicação e retorno

Revisar os checks da PR e publicar pelo workflow existente Painel (GitHub Pages), mantendo teste e vendas desabilitadas. Nenhuma alteração de escopos/permissões é necessária.

Para desfazer a mudança visual, reverter o commit da PR e publicar novamente o artefato anterior. DNS e dados do ERP permanecem independentes desta alteração.

Para HTTPS: verificar em Settings > Pages o estado do domínio e do certificado, aguardar emissão ou seguir o reinício de provisionamento documentado pelo GitHub quando aplicável. Habilitar Enforce HTTPS após disponibilidade e testar certificado e redirecionamentos para raiz e www, sem opções de ignorar TLS.

Documentação oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
