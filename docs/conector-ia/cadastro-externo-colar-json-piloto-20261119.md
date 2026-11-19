# Conecta.IA — piloto de cadastro recebido de outra IA (frontend, sem gravação)

## O que entrega
- Dentro da tela autenticada `Conectar meu agente` (`#/meu-agente`), a seção **Colar cadastro preparado por outra IA**.
- Campo SKU e botão para copiar instruções que solicitam a outro modelo um JSON no formato `conecta-cadastro-v1`.
- Caixa de colagem, validação local estrita, visualização por SKU, resumo de OEM e aplicações candidatos e avisos.
- Botão para copiar o JSON validado, sempre rotulado **sem gravar**.

## Contrato inicial
```json
{
  "formato": "conecta-cadastro-v1",
  "sku": "CODIGO_DA_NOTA_OU_BLING",
  "erp_origem": "Bling",
  "operacao": "propor_enriquecimento",
  "produto": {
    "descricao": null,
    "marca": null,
    "codigo_fabricante": null,
    "gtin": null,
    "especificacoes": []
  },
  "referencias_oem": [],
  "aplicacoes_veiculares": [],
  "fontes": [],
  "pendencias": ["Confirmar identificação e aplicação no ERP"],
  "publicar": false,
  "status": "a_confirmar"
}
```
Listas opcionalmente preenchidas exigem: `especificacoes[] = {campo,valor,fonte}`; `referencias_oem[] = {montadora,codigo,fonte,status}`; `aplicacoes_veiculares[] = {montadora,modelo,versao,motor,ano_inicial,ano_final,fonte,status}`; `fontes[] = {titulo,url}` com URL HTTPS. Todos os OEMs e aplicações são normalizados para `status=a_confirmar`, independentemente do valor declarado pelo agente.

## Limitações deliberadas
- **Não há gravação** no catálogo, Supabase, Bling, arquivos ou fila de aprovação nesta etapa. Resultado existe só na memória do navegador enquanto a tela está aberta.
- Validação cobre formato, limites, campos permitidos e rejeição de `preco,custo,estoque,ncm,service_role` etc.; não comprova verdade técnica, NF, OEM ou aplicação.
- Não contém mecanismo OAuth, chave API ou integração com Gmail. Agente externo não ganha acesso por colar texto.
- A proposta deve ser comparada ao SKU físico e à NF existente no ERP antes de qualquer persistência. Uma peça física no Bling pode ter N páginas editoriais por veículo somente se as aplicações forem aprovadas.
- Produto pausado como CI003696 continua pausado: esta interface não altera esse status nem permite criar propostas persistentes desse SKU.

## Próxima etapa (exige projeto e homologação específicos)
Criar endpoint server-side com identidade da loja e validação de sessão, verificar SKU real em leitura, exigir idempotência, verificar links/fontes, armazenar **candidaturas separadas**, gerar diff, inserir na fila de aprovação, bloquear produtos pausados, registrar auditoria e somente executar mudanças autorizadas por destino/campo. Nenhum dado fiscal, estoque, preço ou nota é escrito por esse fluxo. A futura integração ao Bling deve ser independente e exigir autorização explícita.
