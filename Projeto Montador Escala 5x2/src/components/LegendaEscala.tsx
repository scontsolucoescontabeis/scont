import { AlertTriangle, XCircle } from 'lucide-react'
import type { TipoDia } from '../types'
import { NOME_TIPO, SIGLA_TIPO } from '../utils/analise'
import { COR_TIPO } from './cores'

const SIGNIFICADO: Record<TipoDia, string> = {
  trabalho: 'dia de trabalho (mostra o horário)',
  folga: 'dia livre',
  dsr: 'descanso semanal remunerado',
  feriado: 'feriado sem trabalho',
  ausencia: 'férias, atestado ou outra ausência',
}

const TIPOS: TipoDia[] = ['trabalho', 'folga', 'dsr', 'feriado', 'ausencia']

/** Legenda das cores do calendário (fica sempre visível acima da grade). */
export function LegendaEscala() {
  return (
    <ul aria-label="Legenda do calendário" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {TIPOS.map((t) => (
        <li key={t} className="flex items-center gap-1">
          <span className={`inline-flex h-5 min-w-[28px] items-center justify-center rounded border px-1 text-[10px] font-semibold ${COR_TIPO[t]}`} aria-hidden>
            {t === 'trabalho' ? '08:00' : SIGLA_TIPO[t]}
          </span>
          <span>
            <strong>{NOME_TIPO[t]}</strong> — {SIGNIFICADO[t]}
          </span>
        </li>
      ))}
      <li className="flex items-center gap-1">
        <XCircle size={14} className="text-red-700" aria-hidden />
        <span>
          <strong>Marca vermelha</strong> — fora da regra, precisa ajustar
        </span>
      </li>
      <li className="flex items-center gap-1">
        <AlertTriangle size={14} className="text-yellow-700" aria-hidden />
        <span>
          <strong>Marca amarela</strong> — atenção, vale conferir
        </span>
      </li>
    </ul>
  )
}
