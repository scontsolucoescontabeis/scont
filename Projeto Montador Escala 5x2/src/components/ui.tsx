import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Severidade } from '../types'

export function Campo({
  rotulo,
  ajuda,
  children,
}: {
  rotulo: string
  ajuda?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-sm font-medium">
        {rotulo}
        {ajuda && <Dica texto={ajuda} />}
      </span>
      {children}
    </label>
  )
}

/** Dica acessível: foco/hover mostram o texto; também disponível a leitores de tela. */
export function Dica({ texto }: { texto: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Ajuda: ${texto}`}
        className="rounded-full text-soft hover:text-brand"
      >
        <HelpCircle size={16} aria-hidden />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-64 -translate-x-1/2 rounded-lg bg-ink p-2 text-xs font-normal text-white shadow-lg group-focus-within:block group-hover:block"
      >
        {texto}
      </span>
    </span>
  )
}

const ESTILO_SEMAFORO: Record<Severidade, { cls: string; rotulo: string; Icone: typeof XCircle }> = {
  verde: { cls: 'bg-green-50 text-green-800 border-green-300', rotulo: 'Em conformidade', Icone: CheckCircle2 },
  amarelo: { cls: 'bg-yellow-50 text-yellow-900 border-yellow-400', rotulo: 'Atenção', Icone: AlertTriangle },
  vermelho: { cls: 'bg-red-50 text-red-800 border-red-300', rotulo: 'Fora da regra', Icone: XCircle },
}

export function Semaforo({ nivel }: { nivel: Severidade }) {
  const { cls, rotulo, Icone } = ESTILO_SEMAFORO[nivel]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${cls}`}>
      <Icone size={16} aria-hidden />
      {rotulo}
    </span>
  )
}

export function AvisoLegal({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-yellow-400 bg-yellow-50 p-3 text-xs text-yellow-900" role="note">
      <strong>Aviso: </strong>
      {texto}
    </p>
  )
}
