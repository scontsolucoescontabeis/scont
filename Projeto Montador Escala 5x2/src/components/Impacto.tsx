import { REGRAS } from '../config/regras'
import { calcularImpacto } from '../engine/impacto'
import { useStore } from '../store/useStore'
import { formatarMoeda } from '../utils/analise'
import { Campo } from './ui'

export function Impacto() {
  const funcoes = useStore((s) => s.funcoes)
  const custo = useStore((s) => s.custo)
  const etapa = useStore((s) => s.etapaImpacto)
  const set = useStore((s) => s.set)
  const r = calcularImpacto(funcoes, etapa, custo)

  return (
    <section className="cartao space-y-4" aria-labelledby="t-imp">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="t-imp" className="mr-auto text-lg font-bold">
          Impacto da nova regra{' '}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Encargos sobre a folha (%)" ajuda="Parâmetro editável de encargos (INSS patronal, FGTS, provisões). Ajuste ao regime tributário da empresa.">
          <input type="number" min={0} className="campo" value={custo.encargosPct} onChange={(e) => set({ custo: { ...custo, encargosPct: Number(e.target.value) || 0 } })} />
        </Campo>
        <Campo rotulo="Adicional de hora extra (%)" ajuda="Padrão de 50%. Sua convenção pode prever percentual maior.">
          <input type="number" min={0} className="campo" value={custo.horaExtraPct} onChange={(e) => set({ custo: { ...custo, horaExtraPct: Number(e.target.value) || 0 } })} />
        </Campo>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Comparação entre a situação atual e a nova regra</caption>
          <thead>
            <tr className="border-b border-line">
              <th className="py-1 pr-2">Função</th>
              <th className="px-2">Hoje (h/sem)</th>
              <th className="px-2">Nova regra</th>
              <th className="px-2">Horas a cobrir/sem</th>
              <th className="px-2">Contratações eq.</th>
            </tr>
          </thead>
          <tbody>
            {r.porFuncao.map((p) => (
              <tr key={p.funcaoId} className="border-b border-line/60">
                <td className="py-1 pr-2">
                  {p.nome} ({p.quantidade})
                </td>
                <td className="px-2">{p.horasAtuais}h</td>
                <td className="px-2">{p.horasNovas}h</td>
                <td className="px-2">{p.horasADescobrirSemana.toFixed(1)}h</td>
                <td className="px-2">{p.contratacoesEquivalentes.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-1 pr-2">Total</td>
              <td className="px-2">{r.horasSemanaisAtuais}h</td>
              <td className="px-2">{r.horasSemanaisNovas}h</td>
              <td className="px-2">{r.deficitHorasSemana.toFixed(1)}h</td>
              <td className="px-2">{r.contratacoesEquivalentes.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-line p-3">
          <dt className="text-soft">Custo mensal hoje (aprox.)</dt>
          <dd className="text-lg font-bold">{formatarMoeda(r.custoMensalAtual)}</dd>
        </div>
        <div className="rounded-lg border border-line p-3">
          <dt className="text-soft">Cobrindo com contratações (aprox.)</dt>
          <dd className="text-lg font-bold">{formatarMoeda(r.custoMensalContratando)}</dd>
        </div>
        <div className="rounded-lg border border-line p-3">
          <dt className="text-soft">Cobrindo com horas extras (aprox.)</dt>
          <dd className="text-lg font-bold">{formatarMoeda(r.custoMensalHoraExtra)}</dd>
        </div>
      </dl>
      <p className="text-xs text-soft">
        ESTIMATIVA: assume salário mensal mantido, 52/12 semanas por mês e os percentuais acima. Sem salário-base
        informado, os valores aparecem como “—”.
      </p>
    </section>
  )
}
