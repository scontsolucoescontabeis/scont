import { CalendarDays, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { analisar, formatarData } from '../utils/analise'
import { Calendario } from './Calendario'
import { PainelAlertas } from './PainelAlertas'
import { QuadroContratacoes } from './QuadroContratacoes'
import { Propostas } from './Propostas'
import { Saida } from './Saida'

function Feriados() {
  const feriados = useStore((s) => s.feriados)
  const atualizarFeriados = useStore((s) => s.atualizarFeriados)
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
            atualizarFeriados(
              [...feriados.filter((f) => f.data !== data), { data, nome: nome || 'Feriado local' }].sort((a, b) =>
                a.data.localeCompare(b.data),
              ),
            )
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
              onClick={() => atualizarFeriados(feriados.filter((x) => x.data !== f.data))}
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
  const regrasPessoais = useStore((s) => s.regrasPessoais)

  const autoCorrigirInicial = useStore((s) => s.autoCorrigirInicial)
  const sugerirEscala = useStore((s) => s.sugerirEscala)
  const semHistorico = useStore((s) => s.historico.passado.length === 0 && s.historico.futuro.length === 0)
  const [autoCorrigidas, setAutoCorrigidas] = useState(0)

  // Correção automática silenciosa: só enquanto a pessoa não mexeu à mão na escala
  // (escala recém-gerada/carregada). Depois da primeira edição, as escolhas manuais
  // são respeitadas e a correção fica no botão "Corrigir alertas automaticamente"
  // (que passa pelo Desfazer).
  useEffect(() => {
    if (!escala || !semHistorico) return
    // Respeita os dias travados (ajustes manuais mantidos ao refazer a escala).
    const n = autoCorrigirInicial()
    if (n > 0) setAutoCorrigidas((x) => x + n)
  }, [escala, semHistorico, empresa, cobertura, feriados, turnos, funcoes, regrasPessoais, autoCorrigirInicial])

  const vagas = useMemo(() => escala?.funcionarios.filter((f) => f.vaga) ?? [], [escala])

  const resultado = useMemo(
    () => (escala ? analisar({ empresa, cobertura, feriados, turnos, funcoes, regrasPessoais }, escala) : null),
    [escala, empresa, cobertura, feriados, turnos, funcoes, regrasPessoais],
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">4. Monte a escala</h2>
        <p className="text-sm text-soft">
          Geramos sugestões prontas; escolha uma e ajuste os dias no calendário. Tudo pode ser desfeito.
        </p>
      </div>
      {!escala && (
        <section className="cartao space-y-3 border-2 border-brand" aria-labelledby="t-primeiro">
          <h3 id="t-primeiro" className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays size={20} aria-hidden /> Primeiro passo: gerar a escala
          </h3>
          <p className="text-sm">
            Com os dados dos passos anteriores, montamos 3 sugestões de escala e já corrigimos o que for possível. Depois
            é só escolher a melhor e ajustar os dias que quiser. Se precisar, confira antes o início e o número de semanas
            logo abaixo.
          </p>
          <button type="button" className="btn-primario" onClick={sugerirEscala}>
            <Sparkles size={16} aria-hidden /> Gerar escala sugerida
          </button>
        </section>
      )}
      <Propostas />
      <Feriados />
      {escala && resultado && (
        <>
          <section className="cartao space-y-2" aria-labelledby="t-cal">
            <h3 id="t-cal" className="text-lg font-bold">
              Ajuste os dias
            </h3>
            {vagas.length > 0 && (
              <p className="rounded border border-yellow-400 bg-yellow-50 p-2 text-sm text-yellow-900" role="note">
                <strong>
                  Esta escala inclui {vagas.length} {vagas.length === 1 ? 'vaga' : 'vagas'} a contratar
                </strong>{' '}
                ({vagas.map((v) => v.nome).join('; ')}). Elas aparecem no calendário com a etiqueta “a contratar” e têm
                escala proposta como as demais pessoas (as de “tempo parcial” têm jornada menor, até 30 h por semana, CLT art.
                58-A). Sem contratar, esses horários teriam de ser cobertos com horas
                extras (CLT art. 59: até 2 h por dia, com adicional de 50% no mínimo), o que a ferramenta não monta; para
                ver os furos de cobertura sem as vagas, desmarque “Incluir na escala as contratações necessárias”.
              </p>
            )}
            <Calendario escala={escala} alertas={resultado.alertas} />
          </section>
          <div className="space-y-4">
            <PainelAlertas escala={escala} resultado={resultado} autoCorrigidas={autoCorrigidas} />
            <Saida escala={escala} resultado={resultado} />
          </div>
          <QuadroContratacoes />
        </>
      )}
    </div>
  )
}
