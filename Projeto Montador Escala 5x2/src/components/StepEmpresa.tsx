import { useStore } from '../store/useStore'
import { DIAS_CURTOS, horarioDoDia } from '../utils/analise'
import { Campo } from './ui'

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

export function StepEmpresa() {
  const empresa = useStore((s) => s.empresa)
  const setEmpresa = useStore((s) => s.setEmpresa)

  const alternarDia = (d: number) => {
    const dias = [...empresa.diasFuncionamento]
    dias[d] = !dias[d]
    setEmpresa({ diasFuncionamento: dias })
  }

  const alterarHorario = (d: number, p: Partial<{ abre: string; fecha: string }>) =>
    setEmpresa({ horarios: { ...empresa.horarios, [d]: { ...horarioDoDia(empresa, d), ...p } } })

  const copiarParaTodos = () => {
    const ref = horarioDoDia(empresa, empresa.diasFuncionamento[1] ? 1 : ORDEM_DIAS.find((d) => empresa.diasFuncionamento[d]) ?? 1)
    const horarios: Record<number, { abre: string; fecha: string }> = {}
    for (let d = 0; d < 7; d++) horarios[d] = { ...ref }
    setEmpresa({ horarios })
  }

  return (
    <section className="cartao space-y-5" aria-labelledby="t-empresa">
      <h2 id="t-empresa" className="text-xl font-bold">
        1. Sobre a empresa
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome da empresa">
          <input
            className="campo"
            value={empresa.nome}
            onChange={(e) => setEmpresa({ nome: e.target.value })}
            placeholder="Ex.: Padaria Pão Quente"
          />
        </Campo>
        <Campo rotulo="Setor">
          <input
            className="campo"
            value={empresa.setor}
            onChange={(e) => setEmpresa({ setor: e.target.value })}
            placeholder="Ex.: Comércio, indústria, serviços..."
          />
        </Campo>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Em quais dias a empresa funciona?</legend>
        <div className="flex flex-wrap gap-2">
          {ORDEM_DIAS.map((d) => (
            <label
              key={d}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                empresa.diasFuncionamento[d] ? 'border-brand bg-brand-light font-semibold' : 'border-line bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={empresa.diasFuncionamento[d]}
                onChange={() => alternarDia(d)}
              />
              {DIAS_CURTOS[d]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Horário de funcionamento por dia</legend>
        <p className="mb-2 text-xs text-soft">
          Cada dia pode ter seu próprio horário (ex.: sábado só até o meio-dia). Dias desmarcados acima não aparecem aqui.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ORDEM_DIAS.filter((d) => empresa.diasFuncionamento[d]).map((d) => {
            const h = horarioDoDia(empresa, d)
            return (
              <div key={d} className="flex items-center gap-2 rounded-lg border border-line p-2">
                <span className="w-10 text-sm font-semibold">{DIAS_CURTOS[d]}</span>
                <input
                  type="time"
                  className="campo"
                  aria-label={`Abre às, ${DIAS_CURTOS[d]}`}
                  value={h.abre}
                  onChange={(e) => alterarHorario(d, { abre: e.target.value })}
                />
                <span className="text-xs text-soft">às</span>
                <input
                  type="time"
                  className="campo"
                  aria-label={`Fecha às, ${DIAS_CURTOS[d]}`}
                  value={h.fecha}
                  onChange={(e) => alterarHorario(d, { fecha: e.target.value })}
                />
              </div>
            )
          })}
        </div>
        <button type="button" className="btn-sec mt-2" onClick={copiarParaTodos}>
          Copiar o horário de segunda para todos os dias
        </button>
      </fieldset>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={empresa.funcionaFeriados}
          onChange={(e) => setEmpresa({ funcionaFeriados: e.target.checked })}
        />
        <span className="text-sm">A empresa funciona em feriados.</span>
      </label>
    </section>
  )
}
