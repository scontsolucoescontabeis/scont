import { useMemo } from 'react'
import { calcularQuadro } from '../engine/contratacoes'
import { REGRAS } from '../config/regras'
import { useStore } from '../store/useStore'
import { formatarMoeda } from '../utils/analise'

export function QuadroContratacoes() {
  const empresa = useStore((s) => s.empresa)
  const funcoes = useStore((s) => s.funcoes)
  const turnos = useStore((s) => s.turnos)
  const cobertura = useStore((s) => s.cobertura)
  const custo = useStore((s) => s.custo)
  const etapa = useStore((s) => s.etapaImpacto)
  const set = useStore((s) => s.set)

  const q = useMemo(
    () => calcularQuadro({ empresa, funcoes, turnos, cobertura, custo }, etapa),
    [empresa, funcoes, turnos, cobertura, custo, etapa],
  )

  return (
    <section className="cartao space-y-4" aria-labelledby="t-quadro">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="t-quadro" className="mr-auto text-lg font-bold">
          Quadro sugerido de contratações{' '}
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-900">ESTIMATIVA</span>
        </h3>
        <select
          aria-label="Etapa a simular"
          className="campo !w-auto"
          value={etapa}
          onChange={(e) => set({ etapaImpacto: e.target.value as 'etapa1' | 'etapa2' })}
        >
          <option value="etapa1">1ª etapa — {REGRAS.etapa1.jornadaSemanalMax}h</option>
          <option value="etapa2">2ª etapa — {REGRAS.etapa2.jornadaSemanalMax}h</option>
        </select>
      </div>

      <p
        className={`rounded-lg border p-3 text-sm font-medium ${
          q.contratar > 0 ? 'border-yellow-400 bg-yellow-50 text-yellow-900' : 'border-green-300 bg-green-50 text-green-800'
        }`}
        role="status"
      >
        {q.contratar > 0
          ? `Para cobrir a cobertura mínima na escala 5x2 são necessárias ${q.necessarioTotal} pessoas; a equipe atual tem ${q.equipeAtual}. Sugestão: contratar ${q.contratar}.`
          : `A equipe atual (${q.equipeAtual}) é suficiente para a cobertura mínima informada (necessárias: ${q.necessarioTotal}).`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Pessoas necessárias por período</caption>
          <thead>
            <tr className="border-b border-line">
              <th className="py-1 pr-2">Período</th>
              <th className="px-2">Pessoa-dia/semana</th>
              <th className="px-2">Dias por pessoa</th>
              <th className="px-2">Necessárias (5x2)</th>
              <th className="px-2">Seriam (6x1)</th>
            </tr>
          </thead>
          <tbody>
            {q.linhasTurno.map((l) => (
              <tr key={l.turnoId} className="border-b border-line/60">
                <td className="py-1 pr-2">{l.nome}</td>
                <td className="px-2">{l.presencasSemana}</td>
                <td className="px-2">{l.turnosPorPessoa}</td>
                <td className="px-2 font-semibold">{l.necessarios}</td>
                <td className="px-2 text-soft">{l.necessariosNa6x1}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-1 pr-2">Total</td>
              <td className="px-2" />
              <td className="px-2" />
              <td className="px-2">{q.necessarioTotal}</td>
              <td className="px-2" />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="mb-1 text-left font-semibold">Quadro de pessoal sugerido</caption>
          <thead>
            <tr className="border-b border-line">
              <th className="py-1 pr-2">Função</th>
              <th className="px-2">Hoje</th>
              <th className="px-2">Sugerido</th>
              <th className="px-2">Contratar</th>
              <th className="px-2">Custo mensal (aprox.)</th>
            </tr>
          </thead>
          <tbody>
            {q.porFuncao.map((p) => (
              <tr key={p.funcaoId} className="border-b border-line/60">
                <td className="py-1 pr-2">{p.nome}</td>
                <td className="px-2">{p.atual}</td>
                <td className="px-2">{p.sugerido}</td>
                <td className="px-2 font-semibold">{p.contratar > 0 ? `+${p.contratar}` : '—'}</td>
                <td className="px-2">{formatarMoeda(p.custoMensal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-1 pr-2">Total</td>
              <td className="px-2">{q.equipeAtual}</td>
              <td className="px-2">{q.equipeAtual + q.contratar}</td>
              <td className="px-2">{q.contratar > 0 ? `+${q.contratar}` : '—'}</td>
              <td className="px-2">{formatarMoeda(q.custoMensal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-soft">
        ESTIMATIVA: cada pessoa trabalha no máximo 5 dias por semana, em jornada de até 8h24 líquidas e respeita o limite de horas da etapa. As contratações
        são distribuídas entre as funções na proporção da equipe atual — ajuste conforme a necessidade real de cada
        função. Custo = salário-base × (1 + encargos); sem salário informado aparece “—”. Não considera férias, faltas
        nem rodízio de domingos.
      </p>
    </section>
  )
}
