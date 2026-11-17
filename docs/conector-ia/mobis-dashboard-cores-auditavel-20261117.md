# Mobis Autopeças — Dashboard / Loja / Cores e identidade
Data: 17/11/2026 · Proposta técnica em branch, sujeita à CI e aprovação.

## Objetivo
Permitir que o lojista configure as cores de blocos já montados, com prévia fiel,
sem trocar a tipografia, o logotipo oficial, mascotes ou fotografias.
O **Dashboard Conecta.IA** mantém sua identidade própria.
O Bling continua EXCLUSIVAMENTE LEITURA. O editor de cores nunca recebe custos,
fornecedores, notas fiscais, dados fiscais, preços, estoque, códigos ou credenciais.

## O que já existia
`painel/src/paginas/Aparencia.tsx`: editor genérico de `loja_tema`, que salva o tema
imediatamente. Para Mobis o cadastro antigo contém cores/fonte que não correspondem
à vitrine clara específica. **O registro original não é apagado ou sobrescrito.**
O tema genérico segue funcionando inalterado para as outras lojas.

## O novo painel
A rota autenticada `#/aparencia` apresenta `AparenciaMobis` quando `loja.slug=mobis`.
A rota `#/estrutura-loja` oferece link direto para esta aba.

**Cinco cores editáveis**:
- `cor_fundo`: fundo geral branco neve/gelo
- `cor_superficie`: painéis, banner e áreas de filtro
- `cor_texto`: tipografia já existente, sem troca da fonte
- `cor_botao`: botões comerciais cinza/grafite
- `cor_acento`: detalhe discreto de marca (cobre/vermelho com contraste)

Modelos de partida: Neve e grafite; Gelo e vinho discreto; Neve com grafite intenso.
A prévia no Dashboard é LOCAL e ilustrativa, sem produtos ou descontos inventados.
Cores são validadas para formato hexadecimal, superfície clara e contraste WCAG AA
tanto no navegador quanto no PostgreSQL.

## Fluxo auditável (análogo ao editor de blocos)
1. Lojista altera as cores ou carrega uma combinação — a loja pública não muda.
2. **Salvar nova versão**: insere snapshot em `loja_paleta_versoes` com autor e horário.
3. **Aprovar versão**: somente `papel=lojista` pode registrar aprovação no banco.
4. **Publicar versão aprovada**: somente `papel=lojista` altera ponteiro `loja_paleta_publicada`.
5. **Restaurar**: publicar novamente uma versão antiga já aprovada, sem apagar histórico.
6. `private.auditar_regra` registra antes/depois e identidade no log append-only.

As versões são imutáveis. Só o ponteiro de publicação muda, sempre auditado.
RLS e grants impedem leitura pública do histórico e escrita direta pelo navegador.
A API pública envia somente cinco cores da versão publicada, sem autores,
eventos, origens do ERP nem registros de versões.

## Comportamento da vitrine
- Sem `paleta` publicada: CSS institucional da Mobis permanece o mesmo.
- Com `paleta` publicada: `data-paleta-publicada=sim` ativa tokens nos blocos
  institucionais, busca, banner Flash, montadoras, taxonomia, catálogo e botões.
- A paleta não altera o conteúdo ou a visibilidade dos produtos, links por veículo,
  fotos homologadas, ícones, identidade oficial, fontes, rodapé ou políticas de privacidade.
- A API só lê o ponteiro autorizado; salvar/aprovar **não afeta o site**.

## Implantação e segurança
- Esta branch não faz merge, deploy, migração em produção ou publicação de cores.
- Validar primeiro os testes de banco e front-end em CI.
- Aplicar `supabase/migrations/20261117180000_mobis_paleta_versoes.sql`.
- Implantar frontend + Edge Function `loja-publica`, verificar resposta `paleta:null`
  enquanto não houver nenhuma versão de cores aprovada/publicada.
- Testar com sessão real de lojista: criar rascunho, aprovar, publicar, verificar
  auditoria e paleta aplicada com largura 390/1280 px.
- Preservar os padrões de cores/tipografia da marca aprovados antes de qualquer publicação.
