import { AlertTriangle, Wrench, XCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Escala, ResultadoConformidade } from '../types'
import { Semaforo } from './ui'

export function PainelAlertas({
  escala,
  resultado,
  autoCorrigidas,
}: {
  escala: Escala
  resultado: ResultadoConformidade
  autoCorrigidas: number
}) {
  const corrigir = useStore((s) => s.corrigir)
  const nome = (id?: string) => escala.funcionarios.find((f) => f.id === id)?.nome

  return (
    <section className="cartao space-y-3" aria-labelledby="t-alertas" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="t-alertas" className="text-lg font-bold">
          Conformidade
        </h3>
        <Semaforo nivel={resultado.semaforo} />
      </div>
      <p className="text-sm text-soft">
        {resultado.contagem.vermelho} fora da regra · {resultado.contagem.amarelo} pedem atenção
      </p>

      {autoCorrigidas > 0 && (
        <p className="rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-800" role="status">
          <Wrench size={14} className="mr-1 inline" aria-hidden />
          {autoCorrigidas} correção(ões) automática(s) já aplicada(s) nesta escala. O que sobrou abaixo precisa de decisão
          sua.
        </p>
      )}

      {resultado.alertas.length === 0 && <p className="text-sm">Nenhum alerta. A escala atende às regras cadastradas.</p>}

      <ul className="max-h-[420px] space-y-2 overflow-y-auto">
        {resultado.alertas.map((a) => (
          <li
            key={a.id}
            className={`rounded-lg border p-3 text-sm ${
              a.severidade === 'vermelho' ? 'border-red-300 bg-red-50' : 'border-yellow-400 bg-yellow-50'
            }`}
          >
            <p className="flex items-center gap-1 font-semibold">
              {a.severidade === 'vermelho' ? (
                <XCircle size={16} className="text-red-700" aria-label="Fora da regra" />
              ) : (
                <AlertTriangle size={16} className="text-yellow-700" aria-label="Atenção" />
              )}
              {a.titulo}
            </p>
            <p className="mt-1">{a.mensagem}</p>
            {nome(a.funcionarioId) && <p className="mt-1 text-xs text-soft">Funcionário: {nome(a.funcionarioId)}</p>}
            <p className="mt-1 text-xs">
              <strong>Como resolver: </strong>
              {a.sugestao}
            </p>
            {a.correcao && (
              <button type="button" className="btn-sec mt-2 !py-1 text-xs" onClick={() => corrigir(a.correcao!)}>
                <Wrench size={14} aria-hidden /> Corrigir automaticamente
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
