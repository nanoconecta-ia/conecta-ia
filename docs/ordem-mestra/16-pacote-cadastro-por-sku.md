# 16 — Contrato de entrega de cadastro completo por peça física (Nano + GPT pareado)

**Estado:** RASCUNHO TÉCNICO, para aprovação humana; **sem deploy, sem escrita no Bling, sem autorização para publicação**.
**Dependências:** ordem-mestra 15 (rascunho), `_shared/conector/registro.ts`, `handlers.ts`, `gateway.ts`, `_shared/busca_segura/evidencia.ts`, `galeria.ts`, fila de propostas existente.
**Branch isolada do piloto visual #399.**

## 1. Resultado buscado

O agente integrado Nano, GPT via pareamento MCP, Claude ou qualquer outro provedor entrega **um pacote por identidade de peça**, com origem e estados por bloco. O servidor faz a validação determinística. O lojista revisa **uma proposta-pai por peça** com itens individuais e antes/depois. **Uma peça física com um ID Bling, preço e estoque; diversas ofertas de aplicações verificadas exclusivamente na Conecta.IA.**

**Identificador:** `(loja_id, bling_id)` é obrigatório na edição de peça existente. `sku` pode ser `null` se está vazio no ERP; nunca adivinhar SKU a partir de título, OEM, GTIN ou código de fornecedor. Um GTIN comum a dois IDs Bling aciona **conflito de duplicidade**, não merge automático. Cadastro novo em Bling é operação diferente, fora do pacote nesta fase.

## 2. Contrato proposto: `conecta.cadastro.entregar_pacote`

**Situação REAL nesta PR:** `planejada`. Não está anunciada como ativa no registro, não possui handler MCP, não aceita chamadas externas e **não registra propostas automaticamente**. O módulo `pacote_cadastro/contrato.ts` valida somente estrutura / segurança em memória, sem banco ou rede.

### Entrada v1 (estrutura-base)

```json
{
  "versao": 1,
  "bling_id": "16275882008",
  "sku": null,
  "idempotency_key": "quadro-oc1224-v1",
  "origem_agente": {"agente": "GPT pareado", "modelo": "modelo-declarado"},
  "identidade": {
    "marca": null, "codigo_fabricante": "OC1224", "gtin": "7894766669907"
  },
  "evidencias": [{
    "id": "fabricante-1",
    "classe": "fabricante_oficial",
    "url": "https://dominio-oficial-validado/exemplo",
    "documento": null,
    "trecho": "OC1224 ... HR 2.5 ...",
    "codigo_exato": "OC1224",
    "consultado_em": "2026-11-16",
    "reivindicacoes": ["aplicacao-hr-8v"]
  }],
  "aplicacoes": [{
    "id": "aplicacao-hr-8v",
    "montadora": "Hyundai",
    "modelo": "HR",
    "modelo_id": "uuid-da-arvore-existente",
    "geracao": "a confirmar",
    "motor": "2.5 8V",
    "ano_inicial": 2006,
    "ano_final": 2012,
    "codigo_oem": null,
    "nao_se_aplica": ["Aplicações de outras gerações não homologadas"],
    "evidencia_ids": ["fabricante-1"],
    "estado": "a_confirmar"
  }],
  "imagens": [],
  "taxonomia": {"no_id": null, "estado": "ausente"},
  "texto": {"titulo": null, "descricao_pdv": null, "descricao_tecnica": null, "alt_imagem": null},
  "logistica": {"peso_kg": null, "dimensoes_cm": null, "estimado": false, "base": null, "margem_percentual": null}
}
```

A entrada não inclui NCM, CST, CFOP, valor de compra, fornecedor, nota, preço de venda nem estoque: **esses valores nunca são aceitos como alterações de um LLM**. A data da NF de entrada e sua proveniência são lidas pelo backend exclusivamente para a revisão fiscal interna; NCM público somente como informação cadastral existente.

### Saída planejada

```json
{
  "estado": "pacote_validado_para_revisao | incompleto | divergente",
  "proposta_id": null,
  "versao": 1,
  "hash": "hash-canonico-servidor",
  "idempotency_key": "quadro-oc1224-v1",
  "blocos": [{"nome": "aplicacoes", "estado": "a_confirmar", "pendencias": []}],
  "pendencias": ["evidência insuficiente", "falta aprovação de direitos de imagem"],
  "autorizacoes": {"bling": false, "publicacao": false}
}
```

**`pacote_validado_para_revisao` não significa `aprovado`, compatibilidade confirmada nem publicável.** Nenhum `percentual` isolado autoriza aplicação.

## 3. Regras por bloco

| Bloco | Entrada mínima | Validação firme no servidor | Resultado |
|---|---|---|---|
| Identidade | `bling_id`, marca/código/GTIN quando conhecidos | ler espelho Bling, comparar GTIN/check digit, marca e duplicidade por ID | candidato ou conflito |
| Evidências | `classe`, URL/documento, trecho com código literal, data, fonte | usar `busca_segura/evidencia.ts`, domínio oficialmente **verificado pelo lojista**, SHA-256 no servidor, mesma entidade não é segunda fonte independente | candidata |
| Aplicações | modelo existente, motor, geração e anos válidos, contraindicações | reutilizar `aplicacoes/regras_aplicacao.ts`; exigir duas fontes independentes, ao menos uma montadora ou fabricante verificado; atenção à região/ano | `a_confirmar` |
| Taxonomia | `no_id` da árvore existente | rejeitar nós inexistentes ou de outra loja; agente não cria nova árvore | candidata |
| Fotografias | até 8 URLs HTTPS candidatas com evidência por SKU/GTIN/OEM | `busca_segura/galeria.ts`; licença real e foto da peça exata aprovadas por pessoa, conservar hash original | `aprovada=false` |
| Texto e SEO | título, PDV curto, descrição e alt | gerar **somente** a partir de informações individualmente aprovadas; sem keywords de aplicações pendentes; títulos Shopping <=150 caracteres | texto proposto |
| Logística | valor real + unidade + origem e foto/nota de embalagem | dados ausentes ficam ausentes; +10% a +20% só sobre uma **base documentada**; sempre marcar `estimado`; não sobrescrever medição real | pendência de medição quando faltar |
| Fiscal | só leitura do ERP e XML da nota de entrada | nunca inferir NCM/CEST/CFOP por IA; fiscal só com conferência de NF | valor de origem, sem escrita |

**Hierarquia:** documentação oficial do fabricante/montadora > distribuidor autorizado > cruzamento > marketplace > saída de outra IA. PartSouq EPC não prova equivalência com uma peça aftermarket. Mercado Livre, Alibaba e Qwen servem para descoberta e comparação, não são 2ª fonte forte por si mesmos.

## 4. Persistência e idempotência — implementação futura

- O cliente MCP chama `conecta.cadastro.entregar_pacote` com escopo `propor` da loja, autenticado por chave curta/OAuth do gateway. Nenhuma credencial Bling é enviada ao LLM.
- O handler valida shape estrito e limites, consulta produto físico real por `loja_id + bling_id`, confirma a origem do SKU, valida campos/dados e cruza fontes.
- Em transação única: inserir `pacote_cadastro` + `pacote_blocos` + `pacote_evidencias` (ou evento versionado equivalente) **e** as propostas existentes via `agente_proposta_criar`, com hash/versionamento. Se um bloco falhar, rollback completo; jamais gravar metade.
- `(loja_id, idempotency_key)` é único. Mesma chave + mesmo hash devolve a mesma proposta; mesma chave + conteúdo diferente => conflito 409, nenhuma sobrescrita. Request sem chave => recusado.
- `snapshot_original` registra versão/hash do espelho na criação. Na aprovação, servidor compara snapshot atual; se mudou no Bling, exige reconciliação e nova revisão.
- `agente_proposta_itens` e Fila exibem cada bloco como `confirmado_por_fonte`, `a_confirmar`, `ausente`, `divergente`. Aprovar pacote não dispensa a autorização **por campo e hash**. Imagem, OEM e aplicação exigem revisão específica.
- Gravar no Bling, emitir NF, alterar preço/estoque, transferir produtos ou publicar são operações **fora** desta ferramenta e permanecem bloqueadas.
- Dados de fornecedor, custo, nota fiscal, VIN e outros dados privados não entram em prompts, histórico público nem indexação.

## 5. Resposta ao caso OC1224

- `bling_id=7240211589` está associado a GTIN `7894766669907` e `sku=1` no espelho; no Bling foi observado um código divergente. `bling_id=16275882008` também tem o mesmo GTIN, mas `sku` vazio. **Bloqueio P0: reconciliar antes de decidir cadastro mestre**.
- Qwen forneceu JSON com preço 39,90, regras tributárias genéricas, pesos 0,568/0,682 kg, aplicação estendida até 2026 e muitas equivalências. **Tudo é hipótese**, não pode ser executado como `POST /produtos`.
- Pesquisa PartSouq/MAHLE e catálogo do fabricante devem ser relacionados **por afirmação**, distinguindo OC1224, OC540 e OEM 2630042040 conforme região e especificações.
- Duas aplicações de HR já foram propostas em outra ramificação; esta ordem não as publica e não cria aplicações novas.

## 6. Provas para declarar a ferramenta 'ativa'

1. Teste de contrato rejeita chave idempotente vazia, SKU inventado, GTIN errado, campo fiscal/comercial proibido, URL insegura, excesso de imagens/volume e ausência de provas.
2. Teste com banco simulado verifica `loja_id` e id Bling existentes, transação atômica e rollback.
3. Teste de concorrência: repetição da mesma chave não duplica, hash diferente não sobrescreve.
4. Teste do gateway MCP autenticado com chave limitada e OAuth, simulação e revogação; **pareamento ChatGPT não foi comprovado**.
5. Teste da Fila: pacote-pai e itens exibidos, aprovação exige hash exato; revogação/revisão não autoriza gravação.
6. Teste de segurança: fornecedor/NF/custo/VIN nunca retornam pelo gateway nem pelos logs; `anon` não lê propostas administrativas.
7. CI automatizado + teste de sessão real do lojista + revisão de implementação, antes de mudar `estado` do registro para `ativa`.

**Entrega desta branch:** documento + validador estrutural puro + testes. **Não entrega:** RPC/migração persistente, tool MCP ativa, associação real com conta ChatGPT ou deployment.
