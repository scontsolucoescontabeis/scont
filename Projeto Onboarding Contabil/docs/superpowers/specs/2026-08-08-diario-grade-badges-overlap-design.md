# Grade mensal: corrigir sobreposição dos badges de canto

## Contexto

Na grade mensal (`diario.js:renderGradeMensal`), dois badges de canto
existem hoje:

- `.btn-icone-fechamento` (📤/⏳/✅), célula "Concluído", `top:-6px; right:-6px`.
- `.btn-icone-doc` (📄), célula "Não Iniciado", `top:-6px; left:-6px`.

Ambos têm 20px de diâmetro com offset negativo — cada um vaza ~14px para
fora da própria célula. O grid (`.mapa-grade-linha`) usa `gap:6px` entre as
12 colunas do ano. Quando um mês concluído (badge de fechamento, vazando
pela direita) fica ao lado de um mês não iniciado com documentação
disponível (badge de documentação, vazando pela esquerda), os dois vazamentos
somam mais que o gap disponível e colidem visualmente — exatamente o cenário
relatado (Jan = "Encerrar mês" / Fev = "Documentação disponível").

## O que muda

Os dois badges deixam de vazar a borda da célula — ficam contidos dentro
dela, independente do tamanho do gap entre colunas:

- `.btn-icone-fechamento`: `top:2px; right:2px` (era `-6px;-6px`), 16px de
  diâmetro (era 20px).
- `.btn-icone-doc`: `top:2px; left:2px` (era `-6px;-6px`), 16px de diâmetro
  (era 20px).
- Fonte interna dos ícones ajustada de 11px para 9px, `line-height`
  acompanhando os 16px de altura, para caber no badge menor.

Como os dois só aparecem em estados mutuamente exclusivos da mesma célula
(fechamento só em "Concluído", documentação só em "Não Iniciado" — nunca os
dois ao mesmo tempo numa célula), continuam em cantos opostos (direita vs.
esquerda) só por consistência com o padrão visual atual; a mudança real é
tirar o offset negativo, que é a causa raiz do vazamento entre células
vizinhas.

Sem mudança de comportamento de clique, título (`title`), estados visuais
(`doc-disponivel`/`doc-nao-marcado`, ícones de fechamento por status) ou
lógica de quando cada badge aparece — só posicionamento/tamanho em CSS.

## Fora de escopo

- Responsividade da grade em telas muito estreitas (12 colunas fixas) — já
  era uma limitação pré-existente, não é o que foi reportado.
- Redesenho do estilo visual dos ícones (poderiam virar barra colorida,
  texto, etc.) — o pedido foi resolver a sobreposição, não trocar a
  linguagem visual.
