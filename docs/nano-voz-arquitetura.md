# Nano IA — voz conversacional (especificação, não implementado)

## Decisão
Manter o Assistente Nano como único orquestrador de intenções e ferramentas. Adicionar uma camada de entrada/saída de voz desacoplada, não um segundo agente com acesso direto ao Bling.

## Fases
1. MVP barato: botão push-to-talk no chat existente, permissão explícita de microfone, STT em pt-BR, transcrição editável, envio ao mesmo endpoint de chat, resposta textual e TTS opcional. Não iniciar gravação em segundo plano. Suportar cancelamento e fallback para texto.
2. Avaliar motor: STT/TTS locais (Whisper/faster-whisper e Piper, sujeito a benchmark e licença de vozes) ou APIs mediante consentimento e orçamento; navegador Web Speech somente como fallback experimental por diferenças de plataforma e privacidade.
3. Conversa fluida: prova de conceito isolada com LiveKit Agents ou Pipecat e WebRTC; comparar latência, interrupção (barge-in), VAD, áudio duplex, rede móvel, custo e qualidade pt-BR. GPT-Live/Reatime como opção paga, sem chave exposta no frontend.
4. Só após homologação: ativação por feature flag, quotas por usuário, consentimento, telemetria mínima e controles de privacidade.

## Regras de segurança
- Áudio não dá permissões adicionais ao Nano; operações de escrita exigem prévia de alterações e confirmação explícita na interface, nunca aprovação apenas por voz.
- Não enviar áudio contendo custos, dados fiscais, fornecedor privado, CPF/CNPJ, credenciais ou dados de clientes a provedores gratuitos externos. Oferecer modo texto/local quando houver dados sensíveis.
- Exibir microfone ativo, botão de parar, origem da transcrição e opção de não reter áudio; não gravar nem armazenar áudio por padrão.
- Não enviar mensagens WhatsApp nem escrever no Bling automaticamente.
- STT deve confirmar termos ambíguos como HR, D4BH, D4CB, 4D56, OEM, GTIN, SKU e medidas antes de qualquer ação.
- Logs redigidos sem conteúdo sensível; autenticação e limites de sessão no backend.

## Testes de aceite
- pt-BR em desktop Chrome e Android; microfone negado; conexão interrompida; silêncio; ruído de oficina; interrupção da resposta.
- 'bomba HR 2008' -> pergunta sobre aplicação, sem inferir motor; 'D4BH' não se torna D4CB; confirmar códigos por tela.
- Texto e voz retornam o mesmo resultado técnico verificado e mesma trilha de auditoria.
- Sem credenciais no cliente; sem gravação contínua; sem write no Bling por comando falado.
- Benchmark de latência, uso de RAM no notebook 8 GB, custo por minuto e falhas; não declarar desempenho sem medições.

## Instruções para Claude Code
Inspecionar frontend, auth, assistente e deployment existentes; propor contratos de áudio e feature flag, reusar chat e endpoints. Implementar no PR #242 em commits incrementais, sem merge/deploy automático. Separar especificação de código entregue e documentar dependências, custos e testes reais.
