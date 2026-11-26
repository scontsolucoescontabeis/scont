import { Award, CheckCircle2, Sparkles, UserPlus } from 'lucide-react'
import { totalDeVagas } from '../engine/vagas'
import { useStore } from '../store/useStore'
import { analisar } from '../utils/analise'
import { destaquesPropostas, resumoProposta, type ResumoProposta } from '../utils/passo4'
import type { Proposta } from '../types'
import { Semaforo } from './ui'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Frase simples do resumo de uma proposta. */
function fraseResumo(r: ResumoProposta): string {
  const alertas =
    r.vermelhos + r.amarelos === 0
      ? 'nenhum alerta'
      : [r.vermelhos && plural(r.vermelhos, 'alerta vermelho', 'alertas vermelhos'), r.amarelos && plural(r.amarelos, 'amarelo', 'amarelos')]
          .filter(Boolean)
          .join(' e ')
  return `${plural(r.domingosTrabalhados, 'domingo trabalhado', 'domingos trabalhados')} no total; ${alertas}.`
}

/** Quantas contratações a proposta exige, por função. */
function Contratacoes({ proposta }: { proposta: Proposta }) {
  const n = totalDeVagas(proposta.contratacoes)
  if (n === 0) {
    return (
      <p className="mt-2 rounded border border-green-300 bg-green-50 p-2 text-xs text-green-800">
        Nenhuma contratação: a equipe atual dá conta da cobertura mínima.
      </p>
    )
  }
  const lista = (proposta.contratacoes ?? []).map((c) => `${c.quantidade} ${c.nome}`).join(', ')
  return (
    <p className="mt-2 rounded border border-yellow-400 bg-yellow-50 p-2 text-xs text-yellow-900">
      <UserPlus size={12} className="mr-1 inline" aria-hidden />
      <strong>
        Contratar {n} {n === 1 ? 'pessoa' : 'pessoas'}
      </strong>{' '}
      ({lista}). Já aparecem no calendário como “Vaga”, com a escala proposta.
    </p>
  )
}

export function Propostas() {
  const dados = useStore()
  const { set, usarProposta, sugerirEscala, propostas, comparar } = dados
  const temAjustes = dados.historico.passado.length > 0
  const confirmaPerderAjustes = () =>
    !temAjustes ||
    window.confirm('Os ajustes que você fez no calendário serão perdidos (não dá para desfazer). Continuar?')

  const analises = Object.fromEntries(propostas.map((p) => [p.id, analisar(dados, p.escala)]))
  const resumos = Object.fromEntries(
    propostas.filter((p) => comparar.includes(p.id)).map((p) => [p.id, resumoProposta(p.escala, analises[p.id].alertas)]),
  )
  const destaques = destaquesPropostas(resumos)

  const alternarContratacoes = (marcado: boolean) => {
    if (propostas.length > 0 && !confirmaPerderAjustes()) return
    set({ incluirContratacoes: marcado })
    if (propostas.length > 0) sugerirEscala()
  }

  const alternar = (id: string) => {
    const lista = comparar.includes(id) ? comparar.filter((x) => x !== id) : [...comparar, id].slice(-3)
    set({ comparar: lista })
  }

  return (
    <section className="cartao space-y-4" aria-labelledby="t-prop">
      <div className="flex flex-wrap items-end gap-3">
        <h3 id="t-prop" className="mr-auto text-lg font-bold">
          {propostas.length > 0 ? 'Escolha uma sugestão' : 'Período da escala'}
        </h3>
        <label className="text-sm">
          Início (a escala começa no domingo da semana)
          <input
            type="date"
            className="campo ml-2 !w-auto"
            value={dados.inicioEscala}
            onChange={(e) => set({ inicioEscala: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Semanas
          <select
            className="campo ml-2 !w-auto"
            value={dados.semanas}
            onChange={(e) => set({ semanas: Number(e.target.value) })}
          >
            {[4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        {propostas.length > 0 && (
          <button
            type="button"
            className="btn-sec"
            onClick={() => confirmaPerderAjustes() && sugerirEscala()}
            title="Gera as sugestões de novo com os dados atuais (período, equipe, horários)"
          >
            <Sparkles size={16} aria-hidden /> Gerar de novo
          </button>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={dados.incluirContratacoes}
          onChange={(e) => alternarContratacoes(e.target.checked)}
        />
        <span>
          <strong>Incluir na escala as contratações necessárias</strong>
          <span className="block text-xs text-soft">
            Se a equipe atual não der conta da cobertura mínima, cada sugestão acrescenta as vagas que faltam (“Vaga 1 —
            Atendente”), já com a escala proposta para elas. Férias não geram contratação.
          </span>
        </span>
      </label>

      {propostas.length > 0 && (
        <>
          <p className="text-sm text-soft">
            Compare as sugestões e clique em <strong>Usar esta</strong> na que preferir; ela vai para o calendário logo abaixo.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {propostas
              .filter((p) => comparar.includes(p.id))
              .map((p) => {
                const r = analises[p.id]
                const furos = r.alertas.filter((a) => a.regraId === 'cobertura').length
                const escolhida = dados.propostaAtivaId === p.id
                const ajustada = escolhida && dados.escala !== p.escala
                return (
                  <article
                    key={p.id}
                    aria-current={escolhida ? 'true' : undefined}
                    className={`rounded-lg border p-3 ${escolhida ? 'border-2 border-brand bg-brand-light' : 'border-line'}`}
                  >
                    {escolhida && (
                      <p className="mb-1 flex items-center gap-1 text-xs font-bold text-brand">
                        <CheckCircle2 size={14} aria-hidden /> Escolhida{ajustada ? ' (com seus ajustes)' : ''}
                      </p>
                    )}
                    <h4 className="font-bold">{p.nome}</h4>
                    <p className="mb-2 text-xs text-soft">{p.descricao}</p>
                    {(destaques[p.id] ?? []).length > 0 && (
                      <ul className="mb-2 flex flex-wrap gap-1" aria-label="Destaques">
                        {destaques[p.id].map((d) => (
                          <li
                            key={d}
                            className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800"
                          >
                            <Award size={12} aria-hidden /> {d}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Semaforo nivel={r.semaforo} />
                    {dados.incluirContratacoes && <Contratacoes proposta={p} />}
                    <p className="mt-2 text-sm">{fraseResumo(resumos[p.id])}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <dt>Fora da regra</dt>
                      <dd className="font-semibold">{r.contagem.vermelho}</dd>
                      <dt>Atenção</dt>
                      <dd className="font-semibold">{r.contagem.amarelo}</dd>
                      <dt>Furos de cobertura</dt>
                      <dd className="font-semibold">{furos}</dd>
                      <dt>Domingos trabalhados</dt>
                      <dd className="font-semibold">{resumos[p.id].domingosTrabalhados}</dd>
                    </dl>
                    <button
                      type="button"
                      className="btn-primario mt-3 w-full"
                      disabled={escolhida && !ajustada}
                      onClick={() => confirmaPerderAjustes() && usarProposta(p.id)}
                    >
                      {escolhida ? (ajustada ? 'Voltar à versão original' : 'Em uso no calendário') : 'Usar esta'}
                    </button>
                  </article>
                )
              })}
          </div>
          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="mr-1 text-soft">Mostrar na comparação:</legend>
            {propostas.map((p) => (
              <label key={p.id} className="flex items-center gap-1">
                <input type="checkbox" checked={comparar.includes(p.id)} onChange={() => alternar(p.id)} />
                {p.nome}
              </label>
            ))}
          </fieldset>
        </>
      )}
    </section>
  )
}
