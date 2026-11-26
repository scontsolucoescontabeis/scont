import { AlertTriangle, Check, XCircle } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Alerta, DiaEscala } from '../types'
import { explicacao, type OpcaoCelula } from '../utils/passo4'
import { LARGURA_POPOVER as LARGURA, posicaoJunto } from './posicao'

/** Explicações (sem repetir) dos alertas de uma célula. */
export function ExplicacoesAlertas({ alertas }: { alertas: Alerta[] }) {
  const vistos = new Set<string>()
  const itens = alertas.filter((a) => {
    const t = explicacao(a).titulo
    if (vistos.has(t)) return false
    vistos.add(t)
    return true
  })
  return (
    <ul className="space-y-2">
      {itens.map((a) => {
        const ex = explicacao(a)
        return (
          <li key={a.id} className="flex gap-2">
            {a.severidade === 'vermelho' ? (
              <XCircle size={16} className="mt-0.5 shrink-0 text-red-700" aria-label="Fora da regra" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-700" aria-label="Atenção" />
            )}
            <span>
              <strong className="block">{ex.titulo}</strong>
              <span className="text-soft">{ex.oQueFazer}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Menu de escolha do dia de uma célula. Setas ↑/↓ movem, Enter escolhe,
 * Esc fecha (o foco volta para a célula); clique fora também fecha.
 */
export function MenuCelula({
  ancora,
  titulo,
  opcoes,
  alertas,
  onEscolher,
  onFechar,
}: {
  ancora: HTMLElement
  titulo: string
  opcoes: OpcaoCelula[]
  alertas: Alerta[]
  onEscolher: (v: DiaEscala) => void
  /** `devolverFoco`: true quando o foco deve voltar para a célula (Esc, escolha). */
  onFechar: (devolverFoco: boolean) => void
}) {
  const caixa = useRef<HTMLDivElement>(null)
  const itens = useRef<(HTMLButtonElement | null)[]>([])
  const [pos, setPos] = useState<{ top: number; left: number }>(() => posicaoJunto(ancora.getBoundingClientRect(), 0))

  useLayoutEffect(() => {
    setPos(posicaoJunto(ancora.getBoundingClientRect(), caixa.current?.offsetHeight ?? 0))
  }, [ancora])

  // Foco inicial só ao abrir (o menu é recriado por célula via `key`), na opção atual.
  const [indiceInicial] = useState(() => Math.max(0, opcoes.findIndex((o) => o.atual)))
  useEffect(() => {
    itens.current[indiceInicial]?.focus()
  }, [indiceInicial])

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node) && !ancora.contains(e.target as Node)) onFechar(false)
    }
    const rolar = (e: Event) => {
      if (caixa.current && e.target instanceof Node && caixa.current.contains(e.target)) return
      onFechar(false)
    }
    document.addEventListener('mousedown', fora)
    window.addEventListener('scroll', rolar, true)
    window.addEventListener('resize', rolar)
    return () => {
      document.removeEventListener('mousedown', fora)
      window.removeEventListener('scroll', rolar, true)
      window.removeEventListener('resize', rolar)
    }
  }, [ancora, onFechar])

  const teclas = (e: KeyboardEvent) => {
    const atual = itens.current.findIndex((b) => b === document.activeElement)
    const mover = (i: number) => {
      e.preventDefault()
      itens.current[(i + opcoes.length) % opcoes.length]?.focus()
    }
    if (e.key === 'ArrowDown') mover(atual + 1)
    else if (e.key === 'ArrowUp') mover(atual - 1)
    else if (e.key === 'Home') mover(0)
    else if (e.key === 'End') mover(opcoes.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      onFechar(true)
    } else if (e.key === 'Tab') onFechar(false)
  }

  return (
    <div
      ref={caixa}
      onKeyDown={teclas}
      style={{ top: pos.top, left: pos.left, width: LARGURA }}
      className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-white p-2 text-sm shadow-lg"
    >
      <p className="px-2 pb-1 text-xs font-semibold text-soft">{titulo}</p>
      {alertas.length > 0 && (
        <div className="mb-2 rounded-md bg-gray-50 p-2 text-xs">
          <ExplicacoesAlertas alertas={alertas} />
        </div>
      )}
      <div role="menu" aria-label={`Escolha o dia — ${titulo}`}>
        {opcoes.map((o, i) => (
          <button
            key={o.id}
            ref={(el) => {
              itens.current[i] = el
            }}
            type="button"
            role="menuitemradio"
            aria-checked={o.atual}
            tabIndex={-1}
            onClick={() => {
              onEscolher(o.valor)
              onFechar(true)
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-brand-light focus:bg-brand-light focus:outline-none ${
              o.atual ? 'font-semibold' : ''
            }`}
          >
            <span className="w-4" aria-hidden>
              {o.atual && <Check size={14} />}
            </span>
            {o.rotulo}
            {o.atual && <span className="ml-auto text-xs text-soft">atual</span>}
          </button>
        ))}
      </div>
      <p className="px-2 pt-1 text-[11px] text-soft">Use ↑ ↓ e Enter para escolher; Esc para fechar.</p>
    </div>
  )
}
