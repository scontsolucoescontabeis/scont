import { useMemo } from 'react'
import { calcularQuadro } from '../engine/contratacoes'
import { REGRAS } from '../config/regras'
import { totalDeVagas } from '../engine/vagas'
import { useStore } from '../store/useStore'
import { formatarMoeda } from '../utils/analise'

export function QuadroContratacoes() {
  const empresa = useStore((s) => s.empresa)
  const funcoes = useStore((s) => s.funcoes)
  const turnos = useStore((s) => s.turnos)
  const cobertura = useStore((s) => s.cobertura)
  const custo = useStore((s) => s.custo)
  const etapa = useStore((s) => s.etapaImpacto)
  const regrasPessoais = useStore((s) => s.regrasPessoais)
  const propostas = useStore((s) => s.propostas)
  const incluir = useStore((s) => s.incluirContratacoes)
  const set = useStore((s) => s.set)

  const q = useMemo(
    () => calcularQuadro({ empresa, funcoes, turnos, cobertura, custo }, etapa, REGRAS, regrasPessoais),
    [empresa, funcoes, turnos, cobertura, custo, etapa, regrasPessoais],
  )
  const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  const difere = Math.abs(q.equipeEquivalente - q.equipeAtual) > 0.05
  const equipeTxt = difere
    ? `${q.equipeAtual} pessoas, ≈ ${fmt1(q.equipeEquivalente)} em tempo integral`
    : `${q.equipeAtual} pessoas`
  const somaLinhas = q.linhasTurno.reduce((s, l) => s + l.necessarios, 0)
  const nasPropostas = propostas.map((p) => ({
    nome: p.nome,
    n: totalDeVagas(p.contratacoes),
    parciais: (p.contratacoes ?? []).flatMap((c) => c.parciais ?? []),
  }))

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
          ? `Para cobrir a cobertura mínima na escala 5x2 são necessárias ${q.necessarioTotal} pessoas em tempo integral; a equipe atual tem ${
              difere ? `${q.equipeAtual} (≈ ${fmt1(q.equipeEquivalente)} em tempo integral)` : q.equipeAtual
            }. Sugestão: contratar ${q.contratar}.`
          : `A equipe atual (${equipeTxt}) é suficiente para a cobertura mínima informada (necessárias: ${q.necessarioTotal} em tempo integral).`}
      </p>
      {incluir && propostas.length > 0 && (
        <p className="text-sm">
          <strong>Nas sugestões de escala:</strong>{' '}
          {nasPropostas.map((x) => `${x.nome}: ${x.n === 0 ? 'nenhuma contratação' : `contratar ${x.n}${x.parciais.length > 0 ? ` (${x.parciais.length} em tempo parcial)` : ''}`}`).join(' · ')}. O gerador
          acrescenta uma vaga por vez até a cobertura mínima fechar, então o número pode diferir da estimativa abaixo.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Pessoas necessárias por período</caption>
          <thead>
            <tr className="border-b border-line">
              <th className="py-1 pr-2">Período</th>
              <th className="px-2">Turnos/semana</th>
              <th className="px-2">Turnos por pessoa</th>
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
              <td className="py-1 pr-2">Total (todos os períodos juntos)</td>
              <td className="px-2">{q.turnosSemana}</td>
              <td className="px-2" />
              <td className="px-2">{q.necessarioTotal}</td>
              <td className="px-2" />
            </tr>
          </tfoot>
        </table>
        {somaLinhas !== q.necessarioTotal && (
          <p className="mt-1 text-xs text-soft">
            Turnos compartilhados entre períodos: o total não é a soma das linhas, porque a mesma jornada cobre mais de um
            período (ou um período curto exige jornadas inteiras que também servem aos vizinhos).
          </p>
        )}
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

      {q.observacoes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-yellow-900">
          {q.observacoes.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
      )}

      <p className="text-xs text-soft">
        ESTIMATIVA: cada pessoa cumpre jornadas inteiras (até 8h24 líquidas + intervalo), sempre no mesmo horário, no
        máximo 5 dias por semana e dentro do limite de horas da etapa; um período mais curto que a jornada ainda exige a
        jornada inteira. Considera o rodízio de domingos do setor. Na equipe atual, quem tem carga menor conta
        proporcionalmente (ex.: estagiário de 30h ≈ 0,7 pessoa em tempo integral). As contratações são distribuídas
        entre as funções na proporção da equipe atual — ajuste conforme a necessidade real de cada função. Custo =
        salário-base × (1 + encargos); sem salário informado aparece “—”. Não considera férias nem faltas.
      </p>
    </section>
  )
}
