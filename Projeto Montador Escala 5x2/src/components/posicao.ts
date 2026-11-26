export const LARGURA_POPOVER = 288

/** Posição fixa (viewport) logo abaixo da âncora, ou acima se não couber. */
export function posicaoJunto(r: DOMRect, altura: number, largura = LARGURA_POPOVER): { top: number; left: number } {
  const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))
  const abaixo = r.bottom + 4
  const top = abaixo + altura > window.innerHeight - 8 && r.top - altura - 4 > 8 ? r.top - altura - 4 : abaixo
  return { top, left }
}
