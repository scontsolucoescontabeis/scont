/** Férias da pessoa recortadas na janela da escala. Função pura. */
import { diffDias } from './datas'

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Índices de dia (0 = `inicioEscala`) da janela de `dias` dias que caem em algum
 * período de férias (limites inclusivos). Períodos que começam antes ou terminam
 * depois da janela são recortados; períodos inválidos (data malformada ou
 * início depois do fim) são ignorados.
 */
export function diasDeFerias(
  inicioEscala: string,
  dias: number,
  ferias: { inicio: string; fim: string }[],
): Set<number> {
  const out = new Set<number>()
  for (const p of ferias) {
    if (!DATA_RE.test(p.inicio ?? '') || !DATA_RE.test(p.fim ?? '') || p.inicio > p.fim) continue
    const a = Math.max(0, diffDias(inicioEscala, p.inicio))
    const b = Math.min(dias - 1, diffDias(inicioEscala, p.fim))
    for (let i = a; i <= b; i++) out.add(i)
  }
  return out
}
