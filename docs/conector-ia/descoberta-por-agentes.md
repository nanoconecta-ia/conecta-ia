# Descoberta por buscadores e agentes de IA (Google, Gemini e similares)

## O que o cliente faz
Pergunta em linguagem natural: "qual é o motor para o caminhão HR 2011?". O agente do buscador interpreta, faz perguntas e recomenda lojas. Queremos que a **nossa página** seja a melhor resposta, e que o agente do Conecta.IA, dentro do site, conduza a mesma conversa com dado confiável.

## O que esta etapa entrega (código, sem deploy)
1. **Interpretador de consulta** (`_shared/consulta/interpretar.ts`, ferramenta `engenharia.consulta.interpretar`): reconhece veículo, ano e peça **só pelo cadastro** (`vocabulario_de_busca`, migração `…0015`) e devolve o que falta perguntar. "Motor" é ambíguo (completo, de arranque...): vira pergunta com as opções do cadastro. "Caminhão" dito pelo cliente x categoria cadastrada: aviso, sem correção silenciosa. Termo fora do cadastro vai para `nao_reconhecido`, nunca é adivinhado.
2. **Resposta ao cliente** (`resposta.ts`): lista só produto publicado, com estoque e **aplicação aprovada** para a versão; sem produto diz "NÃO CONFIRMADO", nunca "incompatível". Condições (arrependimento, garantia legal, entrega) vêm **do cadastro do lojista**. O que o lojista não cadastrou (prazo, frete, formas de pagamento, distância) aparece em `lacunas` e a conversa pede o CEP: nada é prometido.
3. **Dados estruturados para buscadores** (`jsonld.ts`): política de devolução e garantia no JSON-LD **somente com o prazo cadastrado**, e `isAccessoryOrSparePartFor` com os veículos de aplicação aprovada, que ajudam o buscador a ligar a peça ao veículo.

## O que depende de outras decisões (não feito)
- **"Conectar ao Gemini do Google"**: o Google não oferece, que eu tenha conferido, um ponto de conexão direta para o nosso agente dentro da busca. Os caminhos reais são: página rápida e legível, dados estruturados corretos, feed do Google Merchant Center (já geramos o feed) e, se o Google ou outro agente oferecer protocolo de compra por agente, avaliar depois. **Ranking não é garantido por nós.** Antes de prometer qualquer integração, conferir a documentação vigente do Google.
- **Endpoint público para agentes externos** (leitura de catálogo e consulta por veículo): exige deploy, limite de uso e revisão de segurança. Precisa de autorização específica.
- **Entrega rápida e "perto do cliente"**: exige dados reais de frete/prazo por CEP (transportadora ou tabela do lojista) e endereço(s) de estoque. Não existem hoje; sem eles não afirmamos proximidade.
- **Pagamento e selos de segurança**: exige cadastro das formas aceitas e do gateway real; hoje não existe cadastro, então não aparecem.
- **Código de Defesa do Consumidor**: o sistema só exibe prazos que o lojista cadastra e não escreve texto jurídico por ele. A revisão do texto das políticas é do lojista e do advogado dele.
- **Tela de conversa no site** e métricas (o que o cliente perguntou e não achou) são a próxima etapa.
