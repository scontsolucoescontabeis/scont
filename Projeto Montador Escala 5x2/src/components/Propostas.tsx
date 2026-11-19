import { Sparkles } from 'lucide-react'
import { contarDomingosTrabalhados } from '../engine/gerador'
import { useStore } from '../store/useStore'
import { analisar } from '../utils/analise'
import { Semaforo } from './ui'

export function Propostas() {
  const dados = useStore()
  const { set, usarProposta, sugerirEscala, propostas, comparar } = dados

  const alternar = (id: string) => {
    const lista = comparar.includes(id) ? comparar.filter((x) => x !== id) : [...comparar, id].slice(-3)
    set({ comparar: lista })
  }

  return (
    <section className="cartao space-y-4" aria-labelledby="t-prop">
      <div className="flex flex-wrap items-end gap-3">
        <h3 id="t-prop" className="mr-auto text-lg font-bold">
          Sugestões de escala
        </h3>
        <label className="text-sm">
          Início
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
        <button type="button" className="btn-primario" onClick={sugerirEscala}>
          <Sparkles size={16} aria-hidden /> Sugerir escala
        </button>
      </div>

      {propostas.length > 0 && (
        <>
          <p className="text-sm text-soft">Compare até 3 propostas lado a lado e escolha qual levar para o calendário.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {propostas
              .filter((p) => comparar.includes(p.id))
              .map((p) => {
                const r = analisar(dados, p.escala)
                const furos = r.alertas.filter((a) => a.regraId === 'cobertura').length
                const emUso = dados.escala === p.escala
                return (
                  <article key={p.id} className={`rounded-lg border p-3 ${emUso ? 'border-brand bg-brand-light' : 'border-line'}`}>
                    <h4 className="font-bold">{p.nome}</h4>
                    <p className="mb-2 text-xs text-soft">{p.descricao}</p>
                    <Semaforo nivel={r.semaforo} />
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <dt>Fora da regra</dt>
                      <dd className="font-semibold">{r.contagem.vermelho}</dd>
                      <dt>Atenção</dt>
                      <dd className="font-semibold">{r.contagem.amarelo}</dd>
                      <dt>Furos de cobertura</dt>
                      <dd className="font-semibold">{furos}</dd>
                      <dt>Domingos trabalhados</dt>
                      <dd className="font-semibold">{contarDomingosTrabalhados(p.escala)}</dd>
                    </dl>
                    <button
                      type="button"
                      className="btn-primario mt-3 w-full"
                      disabled={emUso}
                      onClick={() => usarProposta(p.id)}
                    >
                      {emUso ? 'Em uso no calendário' : 'Usar esta proposta'}
                    </button>
                  </article>
                )
              })}
          </div>
          <fieldset className="flex flex-wrap gap-3 text-sm">
            <legend className="sr-only">Propostas exibidas na comparação</legend>
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
