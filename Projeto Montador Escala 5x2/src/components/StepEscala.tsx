import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { corrigirTudo } from '../engine/autocorrecao'
import { useStore } from '../store/useStore'
import { analisar, formatarData } from '../utils/analise'
import { Calendario } from './Calendario'
import { PainelAlertas } from './PainelAlertas'
import { QuadroContratacoes } from './QuadroContratacoes'
import { Propostas } from './Propostas'
import { Saida } from './Saida'

function Feriados() {
  const feriados = useStore((s) => s.feriados)
  const set = useStore((s) => s.set)
  const [data, setData] = useState('')
  const [nome, setNome] = useState('')

  return (
    <details className="cartao">
      <summary className="cursor-pointer text-sm font-semibold">Feriados considerados ({feriados.length}) — editar</summary>
      <p className="my-2 text-xs text-soft">
        Lista nacional de 2026–2027. Adicione feriados estaduais/municipais e remova os que não valem para sua empresa
        (ex.: pontos facultativos).
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Data
          <input type="date" className="campo" value={data} onChange={(e) => setData(e.target.value)} />
        </label>
        <label className="text-sm">
          Nome
          <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <button
          type="button"
          className="btn-sec"
          disabled={!data}
          onClick={() => {
            set({
              feriados: [...feriados.filter((f) => f.data !== data), { data, nome: nome || 'Feriado local' }].sort((a, b) =>
                a.data.localeCompare(b.data),
              ),
            })
            setData('')
            setNome('')
          }}
        >
          <Plus size={16} aria-hidden /> Adicionar
        </button>
      </div>
      <ul className="mt-3 grid max-h-48 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
        {feriados.map((f) => (
          <li key={f.data} className="flex items-center justify-between rounded border border-line px-2 py-1">
            <span>
              {formatarData(f.data)} — {f.nome}
              {f.facultativo ? ' (facultativo)' : ''}
            </span>
            <button
              type="button"
              aria-label={`Remover ${f.nome} ${formatarData(f.data)}`}
              onClick={() => set({ feriados: feriados.filter((x) => x.data !== f.data) })}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function StepEscala() {
  const escala = useStore((s) => s.escala)
  const empresa = useStore((s) => s.empresa)
  const cobertura = useStore((s) => s.cobertura)
  const funcoes = useStore((s) => s.funcoes)
  const turnos = useStore((s) => s.turnos)
  const feriados = useStore((s) => s.feriados)

  const set = useStore((s) => s.set)
  const [autoCorrigidas, setAutoCorrigidas] = useState(0)

  // Correção automática: tudo que o motor sabe corrigir é corrigido assim que a escala muda.
  useEffect(() => {
    if (!escala) return
    const r = corrigirTudo(escala, (e) => analisar({ empresa, cobertura, feriados, turnos, funcoes }, e))
    if (r.aplicadas > 0) {
      setAutoCorrigidas((n) => n + r.aplicadas)
      set({ escala: r.escala })
    }
  }, [escala, empresa, cobertura, feriados, turnos, funcoes, set])

  const resultado = useMemo(
    () => (escala ? analisar({ empresa, cobertura, feriados, turnos, funcoes }, escala) : null),
    [escala, empresa, cobertura, feriados, turnos, funcoes],
  )

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">4. Monte a escala</h2>
      <Propostas />
      <Feriados />
      {escala && resultado ? (
        <>
          <div className="cartao">
            <Calendario escala={escala} alertas={resultado.alertas} />
          </div>
          <div className="space-y-4">
            <PainelAlertas escala={escala} resultado={resultado} autoCorrigidas={autoCorrigidas} />
            <Saida escala={escala} resultado={resultado} />
          </div>
          <QuadroContratacoes />
        </>
      ) : (
        <p className="cartao text-sm">
          Clique em <strong>Sugerir escala</strong> para gerar as propostas e abrir o calendário.
        </p>
      )}
    </div>
  )
}
