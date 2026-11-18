# MOBIS — emblemas aprovados para sistemas do catálogo (18/11/2026)

Aprovação explícita do responsável: emblemas metálicos para Motor, Cabeçote, Suspensão, Transmissão, Elétrica, Carroceria e Acessórios.

## Regras de aplicação
- Imagens PNG originais na pasta oficial [Google Drive](https://drive.google.com/drive/folders/133RXZQVXEf2OzW8ME16E0GrQ78Iky4xx), subpasta `01_ORIGINAIS_PNG`.
- Imagens WebP otimizadas 512 px em `painel/public/icones-catalogo-mobis/`; o caminho de uso está definido **apenas** no componente `BlocosCatalogoMobis.tsx`.
- Usar o emblema aprovado com moldura metálica prateada escovada, grafite `#1F2327`, faixa vermelho `#E2181A`, fundo gelo `#EAF2F6`. A tipografia faz parte do raster original.
- Mapear corretamente o sistema da peça por nome/slug; manter os nomes e contagens da API pública, sem criar produto fictício.
- Outros sistemas (como Freios e Arrefecimento) continuam com o ícone técnico anterior até haver aprovação de novas artes. Não substituir automaticamente por Motor.
- Não alterar a identidade própria do Conecta.IA, nem de outras lojas. Não alterar estoque, compatibilidade, SKU, anúncio ou dados fiscais.
- Na documentação/Canva, não chamar WebP/PNG de SVG vetorial ou CorelDRAW editável por curvas.

## Revisão do código
PR de atualização [MOBIS #445](https://github.com/nanoconecta-ia/conecta-ia/pull/445). A integração é proposta de código sujeita à verificação e publicação, não mudança de produção automaticamente.
