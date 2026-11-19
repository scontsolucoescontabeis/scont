import { useStore } from '../store/useStore'
import type { AcordoColetivo } from '../types'
import { DIAS_CURTOS } from '../utils/analise'
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Abre às">
          <input
            type="time"
            className="campo"
            value={empresa.horaAbertura}
            onChange={(e) => setEmpresa({ horaAbertura: e.target.value })}
          />
        </Campo>
        <Campo rotulo="Fecha às">
          <input
            type="time"
            className="campo"
            value={empresa.horaFechamento}
            onChange={(e) => setEmpresa({ horaFechamento: e.target.value })}
          />
        </Campo>
      </div>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={empresa.funcionaFeriados}
          onChange={(e) => setEmpresa({ funcionaFeriados: e.target.checked })}
        />
        <span className="text-sm">A empresa funciona em feriados.</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="Tem convenção ou acordo coletivo?"
          ajuda="Convenções coletivas podem trazer regras próprias de jornada, domingos e feriados. Se não souber, o DP da SCONT confere para você."
        >
          <select
            className="campo"
            value={empresa.acordoColetivo}
            onChange={(e) => setEmpresa({ acordoColetivo: e.target.value as AcordoColetivo })}
          >
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
            <option value="nao_sei">Não sei</option>
          </select>
        </Campo>
        <Campo
          rotulo="Existe compensação de jornada (banco de horas)?"
          ajuda="Com acordo de compensação, passar de 8h em um dia é aceitável (vira alerta amarelo). Sem acordo, é erro (vermelho)."
        >
          <select
            className="campo"
            value={empresa.compensacaoDiaria ? 'sim' : 'nao'}
            onChange={(e) => setEmpresa({ compensacaoDiaria: e.target.value === 'sim' })}
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </Campo>
      </div>
    </section>
  )
}
