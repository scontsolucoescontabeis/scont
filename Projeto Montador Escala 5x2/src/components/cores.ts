import type { TipoDia } from '../types'

/** Cores de cada tipo de dia no calendário e na legenda. */
export const COR_TIPO: Record<TipoDia, string> = {
  trabalho: 'bg-white border-line text-ink',
  folga: 'bg-blue-100 border-blue-300 text-blue-900',
  dsr: 'bg-indigo-100 border-indigo-300 text-indigo-900',
  feriado: 'bg-amber-100 border-amber-300 text-amber-900',
  ausencia: 'bg-gray-200 border-gray-400 text-gray-800',
}
