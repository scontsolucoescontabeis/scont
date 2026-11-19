import { Plus, Trash2 } from 'lucide-react'
import { fmtHoras, horasLiquidasMin } from '../engine/conformidade'
import { useStore } from '../store/useStore'
import type { Turno } from '../types'
import { Campo } from './ui'

export function StepCobertura() {
  const turnos = useStore((s) => s.turnos)
  const cobertura = useStore((s) => s.cobertura)
  const set = useStore((s) => s.set)

  const limpar = { escala: null, propostas: [] }

  const atualizarTurno = (id: string, p: Partial<Turno>) =>
    set({ turnos: turnos.map((t) => (t.id === id ? { ...t, ...p } : t)), ...limpar })

  const atualizarCob = (id: string, chave: 'util' | 'sab' | 'dom', v: number) =>
    set({ cobertura: { ...cobertura, [id]: { ...cobertura[id], [chave]: Math.max(0, v) } }, ...limpar })

  const adicionar = () => {
    const id = `turno-${Date.now()}`
    set({
      turnos: [...turnos, { id, nome: 'Novo turno', inicio: '13:00', fim: '22:00', intervaloMin: 60 }],
      cobertura: { ...cobertura, [id]: { util: 1, sab: 1, dom: 0 } },
      ...limpar,
    })
  }

  const remover = (id: string) => {
    const resto = { ...cobertura }
    delete resto[id]
    set({ turnos: turnos.filter((t) => t.id !== id), cobertura: resto, ...limpar })
  }

  return (
    <section className="cartao space-y-4" aria-labelledby="t-cob">
      <h2 id="t-cob" className="text-xl font-bold">
        3. Turnos e cobertura
      </h2>
      <p className="text-sm text-soft">
        Defina os turnos de trabalho e quantas pessoas, no mínimo, precisam estar presentes em cada um. Dias em que a
        empresa não funciona (passo 1) são ignorados.
      </p>

      {turnos.map((t) => {
        const c = cobertura[t.id] ?? { util: 0, sab: 0, dom: 0 }
        return (
          <div key={t.id} className="space-y-3 rounded-lg border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="sm:col-span-2">
                <Campo rotulo="Nome do turno">
                  <input className="campo" value={t.nome} onChange={(e) => atualizarTurno(t.id, { nome: e.target.value })} />
                </Campo>
              </div>
              <Campo rotulo="Entrada">
                <input type="time" className="campo" value={t.inicio} onChange={(e) => atualizarTurno(t.id, { inicio: e.target.value })} />
              </Campo>
              <Campo rotulo="Saída">
                <input type="time" className="campo" value={t.fim} onChange={(e) => atualizarTurno(t.id, { fim: e.target.value })} />
              </Campo>
              <Campo
                rotulo="Intervalo (min)"
                ajuda="Mais de 6h de jornada exige no mínimo 60 min de intervalo; de 4h a 6h, 15 min."
              >
                <input
                  type="number"
                  min={0}
                  className="campo"
                  value={t.intervaloMin}
                  onChange={(e) => atualizarTurno(t.id, { intervaloMin: Number(e.target.value) || 0 })}
                />
              </Campo>
            </div>
            <p className="text-xs text-soft">Horas trabalhadas por dia neste turno: {fmtHoras(horasLiquidasMin(t))}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Pessoas mínimas — segunda a sexta">
                <input type="number" min={0} className="campo" value={c.util} onChange={(e) => atualizarCob(t.id, 'util', Number(e.target.value))} />
              </Campo>
              <Campo rotulo="Pessoas mínimas — sábado">
                <input type="number" min={0} className="campo" value={c.sab} onChange={(e) => atualizarCob(t.id, 'sab', Number(e.target.value))} />
              </Campo>
              <Campo rotulo="Pessoas mínimas — domingo">
                <input type="number" min={0} className="campo" value={c.dom} onChange={(e) => atualizarCob(t.id, 'dom', Number(e.target.value))} />
              </Campo>
            </div>
            {turnos.length > 1 && (
              <button type="button" className="btn-sec" onClick={() => remover(t.id)}>
                <Trash2 size={16} aria-hidden /> Remover turno
              </button>
            )}
          </div>
        )
      })}

      <button type="button" className="btn-sec" onClick={adicionar}>
        <Plus size={16} aria-hidden /> Adicionar turno
      </button>
    </section>
  )
}
