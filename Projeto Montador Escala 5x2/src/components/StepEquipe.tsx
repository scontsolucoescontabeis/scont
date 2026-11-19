import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Funcao } from '../types'
import { Campo } from './ui'

const JORNADAS: { rotulo: string; horas: number }[] = [
  { rotulo: '44h semanais', horas: 44 },
  { rotulo: '6x1 (44h)', horas: 44 },
  { rotulo: '40h semanais', horas: 40 },
  { rotulo: '36h semanais', horas: 36 },
  { rotulo: '12x36 (média ~42h)', horas: 42 },
  { rotulo: 'Outra', horas: 0 },
]

export function StepEquipe() {
  const funcoes = useStore((s) => s.funcoes)
  const set = useStore((s) => s.set)

  const atualizar = (id: string, p: Partial<Funcao>) =>
    set({ funcoes: funcoes.map((f) => (f.id === id ? { ...f, ...p } : f)), escala: null, propostas: [] })

  const adicionar = () =>
    set({
      funcoes: [
        ...funcoes,
        {
          id: `fn-${Date.now()}`,
          nome: 'Nova função',
          quantidade: 1,
          jornadaContratual: '44h semanais',
          horasSemanaisAtuais: 44,
        },
      ],
      escala: null,
      propostas: [],
    })

  return (
    <section className="cartao space-y-4" aria-labelledby="t-equipe">
      <h2 id="t-equipe" className="text-xl font-bold">
        2. Sua equipe
      </h2>
      <p className="text-sm text-soft">
        Liste as funções, quantas pessoas há em cada uma e como trabalham hoje. O salário é opcional e só serve para
        estimar custos.
      </p>

      {funcoes.map((f) => {
        const preset = JORNADAS.find((j) => j.rotulo === f.jornadaContratual)
        return (
          <div key={f.id} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Campo rotulo="Função">
                <input className="campo" value={f.nome} onChange={(e) => atualizar(f.id, { nome: e.target.value })} />
              </Campo>
            </div>
            <Campo rotulo="Quantidade">
              <input
                type="number"
                min={1}
                className="campo"
                value={f.quantidade}
                onChange={(e) => atualizar(f.id, { quantidade: Math.max(1, Number(e.target.value) || 1) })}
              />
            </Campo>
            <Campo rotulo="Jornada atual">
              <select
                className="campo"
                value={preset ? preset.rotulo : 'Outra'}
                onChange={(e) => {
                  const j = JORNADAS.find((x) => x.rotulo === e.target.value)!
                  atualizar(f.id, {
                    jornadaContratual: j.rotulo,
                    horasSemanaisAtuais: j.horas || f.horasSemanaisAtuais,
                  })
                }}
              >
                {JORNADAS.map((j) => (
                  <option key={j.rotulo}>{j.rotulo}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Horas por semana">
              <input
                type="number"
                min={1}
                max={60}
                className="campo"
                value={f.horasSemanaisAtuais}
                onChange={(e) =>
                  atualizar(f.id, { horasSemanaisAtuais: Number(e.target.value) || 0, jornadaContratual: 'Outra' })
                }
              />
            </Campo>
            <Campo rotulo="Salário-base (opcional)">
              <input
                type="number"
                min={0}
                className="campo"
                value={f.salarioBase ?? ''}
                onChange={(e) => atualizar(f.id, { salarioBase: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="R$"
              />
            </Campo>
            {funcoes.length > 1 && (
              <div className="sm:col-span-6">
                <button
                  type="button"
                  className="btn-sec"
                  onClick={() => set({ funcoes: funcoes.filter((x) => x.id !== f.id), escala: null, propostas: [] })}
                >
                  <Trash2 size={16} aria-hidden /> Remover {f.nome}
                </button>
              </div>
            )}
          </div>
        )
      })}

      <button type="button" className="btn-sec" onClick={adicionar}>
        <Plus size={16} aria-hidden /> Adicionar função
      </button>
    </section>
  )
}
