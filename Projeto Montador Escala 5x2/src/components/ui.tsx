import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import type { Severidade } from '../types'

/**
 * Número com botões − / + (aceita digitação; nunca abaixo de 0).
 * `descricao` completa os rótulos acessíveis: "Aumentar mínimo de pessoas — {descricao}".
 * Com `aria`, os rótulos ficam "Mínimo de pessoas {aria}" (ex.: "na segunda-feira, Manhã").
 */
export function Contador({
  rotulo,
  descricao,
  valor,
  onChange,
  desabilitado = false,
  aria,
}: {
  rotulo: string
  descricao: string
  aria?: string
  valor: number
  onChange: (v: number) => void
  desabilitado?: boolean
}) {
  const id = useId()
  const sufixo = aria ? ` ${aria}` : ` — ${descricao}`
  const mudar = (v: number) => onChange(Math.max(0, Math.floor(Number.isFinite(v) ? v : 0)))
  return (
    <div>
      {desabilitado ? (
        <p className="mb-1 text-sm font-medium">{rotulo}</p>
      ) : (
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          {rotulo}
        </label>
      )}
      {desabilitado ? (
        <p className="rounded-lg border border-line bg-gray-100 px-3 py-2 text-sm text-soft">
          fechado <span className="sr-only">— a empresa não abre nesse dia</span>
        </p>
      ) : (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn-sec !px-3"
            aria-label={`Diminuir mínimo de pessoas${sufixo}`}
            disabled={valor <= 0}
            onClick={() => mudar(valor - 1)}
          >
            −
          </button>
          <input
            id={id}
            type="number"
            min={0}
            inputMode="numeric"
            className="campo !w-16 text-center"
            aria-label={`Mínimo de pessoas${sufixo}`}
            value={valor}
            onChange={(e) => mudar(e.target.value === '' ? 0 : Number(e.target.value))}
          />
          <button
            type="button"
            className="btn-sec !px-3"
            aria-label={`Aumentar mínimo de pessoas${sufixo}`}
            onClick={() => mudar(valor + 1)}
          >
            +
          </button>
        </div>
      )}
    </div>
  )
}

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
