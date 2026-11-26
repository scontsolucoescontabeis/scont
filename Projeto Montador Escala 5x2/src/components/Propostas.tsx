import { Award, CheckCircle2, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { analisar } from '../utils/analise'
import { destaquesPropostas, resumoProposta, type ResumoProposta } from '../utils/passo4'
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
