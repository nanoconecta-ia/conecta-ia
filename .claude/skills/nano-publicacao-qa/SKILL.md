---
name: nano-publicacao-qa
description: Verificar e bloquear rascunhos e publicações de conteúdo automotivo, descrições do Bling, SEO, banners e feeds que contenham alegações técnicas, preços ou licenças sem comprovação.
---

# Skill: validação objetiva, rascunho e publicação por canal

**Acionar** ao propor/escrever qualquer texto de catálogo no Bling, exibir em PDV/site, gerar Merchant feed, criar material social/WhatsApp, editar foto ou publicar banner.

## Portões que o Nano não pode ultrapassar

1. **Identidade**: SKU/loja/marca/MPN/OEM não podem contradizer documento do fabricante e aplicação aprovada.
2. **Segurança**: normalizar texto com escaping HTML/JSON, evitar HTML não permitido pelo Bling e não incluir scripts, links de credencial, dados fiscais, margens, custos, fornecedores privados ou PII.
3. **Paridade**: conteúdo curto/long e marketing não devem contradizer ficha técnica nem oferecer aplicações descartadas; mídia tem licença e foto técnica preservada.
4. **Estado**: workflow sempre `rascunho -> em_revisao -> aprovado_por_canal -> aplicado_verificado`; o agente só cria **proposta**. Cada alteração gera hash/version e invalida aprovações antigas do conteúdo que mudou.
5. **Ferramenta**: nunca usar ferramenta de escrita em Bling via chat sem autorização explícita por campo; diff antes/depois, permissão do responsável, idempotency key, log de auditoria e leitura de confirmação depois de gravar.
6. **Canal**: aprovação de descrição curta/complementar do Bling não autoriza o envio pelo WhatsApp, Instagram ou Merchant, nem publicar no site. Destinos separados.
7. **Falha**: se ERP/site/Drive/Google API cair, manter rascunho, registrar erro e reprocessar com idempotência; não declarar sucesso e não repetir escrita cega.
8. **Conformidade**: texto comercial só usa preços/parcelas/frete/garantia verificados; nenhum 'menor preço', '100% original', nota fiscal, frete, suporte ou atendimento é inferido.

## Validadores e evidências

Pedir implementação de `validarConteudoMulticanal(ficha, versoes, canais, direitos)` em lógica pura **+ verificação server-side**. Relatório por campo: status `ok|pendente|bloqueado`, motivo, evidência, versão e alvo. A Skill não substitui os validadores.

### Testes negativos obrigatórios

- 8V/16V confundidos, fabricante dito como OEM, número de dentes trocado, foto de SKU errado ou sem licença.
- Descrição complementar com custo de fornecedor; PDV com margem interna; texto social com promoção não autorizada.
- HTML/JSON-LD no campo de descrição do Bling; texto rich HTML que não renderiza na loja; links de Drive privados.
- Preço/estoque divergente, produto sem estoque anunciado pronto-entrega, parcelas vencidas.
- Tentativa de aprovar própria proposta, publicar duas vezes após timeout e escrever no Bling sem autorização.
- Política RLS e dados de outra loja inacessíveis em prévia, exportação, feed e chat.

Relatório de teste local/mock não comprova implantação, ranking, entrega de mensagens nem indexação. Sem aprovação explícita: nenhum merge/deploy/write.
