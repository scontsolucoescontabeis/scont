import { useStore } from '../store/useStore'
import { DIAS_CURTOS, horarioDoDia } from '../utils/analise'
import {
  MODELOS_FUNCIONAMENTO,
  aplicarModeloFuncionamento,
  resumoFuncionamento,
  validarHorarioDia,
} from '../utils/passo1'
import { Campo } from './ui'

const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0]

export function StepEmpresa() {
  const empresa = useStore((s) => s.empresa)
  const setEmpresa = useStore((s) => s.setEmpresa)
  const noPortal = useStore((s) => s.portal !== null)

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

  const usarModelo = (id: string) => {
    const p = aplicarModeloFuncionamento(empresa, id)
    if (Object.keys(p).length > 0) setEmpresa(p)
  }

  return (
    <section className="cartao space-y-5" aria-labelledby="t-empresa">
      <h2 id="t-empresa" className="text-xl font-bold">
        1. Sobre a empresa
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {noPortal ? (
          <div>
            <p className="mb-1 text-sm font-medium">Nome da empresa</p>
            <p className="rounded-lg border border-line bg-brand-light/40 px-3 py-2 text-base">
              {empresa.nome || 'Carregando…'}{' '}
              <span className="text-xs text-soft">(vem do cadastro do RH)</span>
            </p>
          </div>
        ) : (
          <Campo rotulo="Nome da empresa">
            <input
              className="campo"
              value={empresa.nome}
              onChange={(e) => setEmpresa({ nome: e.target.value })}
              placeholder="Ex.: Padaria Pão Quente"
            />
          </Campo>
        )}
        <Campo rotulo="Setor">
          <input
            className="campo"
            value={empresa.setor}
            onChange={(e) => setEmpresa({ setor: e.target.value })}
            placeholder="Ex.: Comércio, indústria, serviços..."
          />
        </Campo>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Comece por um modelo</p>
        <div className="flex flex-wrap gap-2">
          {MODELOS_FUNCIONAMENTO.map((m) => (
            <button key={m.id} type="button" className="btn-sec" onClick={() => usarModelo(m.id)}>
              {m.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-soft">Depois você pode mudar qualquer dia ou horário.</p>
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
        <legend className="mb-1 text-sm font-medium">Horário de cada dia</legend>
        <p className="mb-2 text-xs text-soft">Cada dia pode ter seu próprio horário (ex.: sábado só até o meio-dia).</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ORDEM_DIAS.filter((d) => empresa.diasFuncionamento[d]).map((d) => {
            const h = horarioDoDia(empresa, d)
            const v = validarHorarioDia(h.abre, h.fecha)
            const idMsg = `horario-msg-${d}`
            return (
              <div
                key={d}
                className={`rounded-lg border p-2 ${
                  v?.tipo === 'erro' ? 'border-red-400' : v?.tipo === 'aviso' ? 'border-amber-300' : 'border-line'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-10 text-sm font-semibold">{DIAS_CURTOS[d]}</span>
                  <input
                    type="time"
                    className="campo"
                    aria-label={`Abre às, ${DIAS_CURTOS[d]}`}
                    aria-describedby={v ? idMsg : undefined}
                    aria-invalid={v?.tipo === 'erro' || undefined}
                    value={h.abre}
                    onChange={(e) => alterarHorario(d, { abre: e.target.value })}
                  />
                  <span className="text-xs text-soft">às</span>
                  <input
                    type="time"
                    className="campo"
                    aria-label={`Fecha às, ${DIAS_CURTOS[d]}`}
                    aria-describedby={v ? idMsg : undefined}
                    aria-invalid={v?.tipo === 'erro' || undefined}
                    value={h.fecha}
                    onChange={(e) => alterarHorario(d, { fecha: e.target.value })}
                  />
                </div>
                {v && (
                  <p
                    id={idMsg}
                    role={v.tipo === 'erro' ? 'alert' : undefined}
                    className={`mt-1 text-xs ${v.tipo === 'erro' ? 'text-red-700' : 'text-amber-800'}`}
                  >
                    {v.texto}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" className="btn-sec mt-2" onClick={copiarParaTodos}>
          Copiar o horário de segunda para todos os dias
        </button>
      </fieldset>

      <p className="rounded-lg border border-line bg-brand-light/40 p-3 text-sm font-medium" aria-live="polite">
        {resumoFuncionamento(empresa)}
      </p>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={empresa.funcionaFeriados}
          onChange={(e) => setEmpresa({ funcionaFeriados: e.target.checked })}
        />
        <span className="text-sm">
          A empresa funciona em feriados.
          <span className="block text-xs text-soft">
            Se desmarcado, nos feriados ninguém é escalado e o dia aparece como feriado na escala.
          </span>
        </span>
      </label>
    </section>
  )
}
