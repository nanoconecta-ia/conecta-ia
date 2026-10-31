# Torre GPT (piloto local) — pasta para revisão

**Situação: aguardando os arquivos.** Esta pasta existe para receber, **em rascunho e só para revisão**, a versão **sanitizada** da extensão
"Mobis Torre GPT" que o ChatGPT desenvolveu no notebook Windows `mobis`. Autorizado pelo proprietário em 31/10/2026 (PEND-1, issue #178).

- **Origem:** notebook `mobis`. Versão informada pelo GPT: **0.4.0 piloto** (pasta `extension-piloto`) e ponte local `bridge-piloto.js`.
  Esses dados são **relato do GPT**, ainda não verificados por quem revisa.
- **Não é o Nano Guardião.** O Guardião é outro código, na pasta `extensao/`. Não misturar e não alterar `extensao/` nesta PR.
- **Regras:** nada de segredos, chaves, tokens, cookies, capturas de tela ou conversas de clientes. **Sem merge e sem publicação.**
  A cópia original no notebook **não** deve ser alterada.

## Como enviar (no notebook, PowerShell, com `git` instalado e login no GitHub já feito)
```powershell
git clone https://github.com/nanoconecta-ia/conecta-ia
cd conecta-ia
git checkout feat/torre-gpt-piloto
mkdir torre-gpt\piloto\ponte
copy "<pasta>\extension-piloto\*" torre-gpt\piloto\
copy "<pasta>\bridge-piloto.js" torre-gpt\piloto\ponte\
node torre-gpt/ferramentas/verificar-sanitizacao.mjs
```
`<pasta>` é a pasta da Torre no notebook (ajuste o caminho). Se o verificador apontar algo, **corrija antes de continuar**.
Ele **não substitui a sua leitura**: abra os arquivos e confira. Depois:
```powershell
git add torre-gpt
git commit -m "torre-gpt: fontes sanitizadas do piloto 0.4.0"
git push origin feat/torre-gpt-piloto
```
A PR já existe em rascunho; o envio atualiza a mesma PR.

## O que será revisado (sem alterar nada)
1. **`manifest.json`:** permissões e sites que a extensão pode acessar.
2. **`sidepanel.js`:** o que lê da página, o que envia e para onde, e o tratamento de telefone e e-mail.
3. **Ponte local:** autenticação, porta (somente `127.0.0.1`), conteúdo do `/health` e do `/draft`, e como a chave efêmera é gerada.
4. Se algo envia mensagem, grava no ERP ou guarda conversa. **O piloto declara que não faz isso; a revisão confere.**
5. Sobreposição com o Nano Guardião (decisão de unificar é do proprietário, PEND-2).
