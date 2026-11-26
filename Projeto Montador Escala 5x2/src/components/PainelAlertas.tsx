import { AlertTriangle, Wand2, Wrench, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Escala, ResultadoConformidade } from '../types'
import { explicacao, fraseCorrecao, resumoCorrecao } from '../utils/passo4'
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
  const corrigirAutomaticamente = useStore((s) => s.corrigirAutomaticamente)
  // resultado da última correção geral, válido só enquanto a escala for a que ela produziu
  const [ultima, setUltima] = useState<{ escala: Escala; frase: string } | null>(null)
  const temCorrigivel = resultado.alertas.some((a) => a.correcao && a.correcao.length > 0)
  const nome = (id?: string) => escala.funcionarios.find((f) => f.id === id)?.nome

  return (
    <section className="cartao space-y-3" aria-labelledby="t-alertas" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="t-alertas" className="text-lg font-bold">
          Alertas da escala
        </h3>
        <Semaforo nivel={resultado.semaforo} />
      </div>
      <p className="text-sm text-soft">
        {resultado.contagem.vermelho} fora da regra · {resultado.contagem.amarelo} pedem atenção
      </p>

      {ultima && ultima.escala === escala && resultado.alertas.length === 0 && (
        <p className="rounded-lg border border-green-300 bg-green-50 p-2 text-sm font-semibold text-green-800" role="status">
          {ultima.frase} Se não gostar, clique em Desfazer.
        </p>
      )}
      {resultado.alertas.length > 0 && (
        <div className="rounded-lg border border-brand bg-brand-light p-3">
          <button
            type="button"
            className="btn-primario w-full sm:w-auto"
            disabled={!temCorrigivel}
            onClick={() => {
              const r = corrigirAutomaticamente()
              setUltima({ escala: useStore.getState().escala!, frase: fraseCorrecao(resumoCorrecao(r.antes, r.depois)) })
            }}
          >
            <Wand2 size={16} aria-hidden /> Corrigir alertas automaticamente
          </button>
          <p className="mt-2 text-xs text-soft">
            {temCorrigivel
              ? 'Ajustamos os dias que o sistema sabe resolver sozinho. Se não gostar, é só clicar em Desfazer.'
              : 'Os alertas que sobraram não têm correção automática: ajuste os dias no calendário.'}
          </p>
          {ultima && ultima.escala === escala && (
            <p className="mt-2 text-sm font-semibold" role="status">
              {ultima.frase}
            </p>
          )}
        </div>
      )}

      {autoCorrigidas > 0 && (
        <p className="rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-800" role="status">
          <Wrench size={14} className="mr-1 inline" aria-hidden />
          {autoCorrigidas} correção(ões) automática(s) já aplicada(s) nesta escala. O que sobrou abaixo precisa de decisão
          sua.
        </p>
      )}

      {resultado.alertas.length === 0 && <p className="text-sm">Tudo certo: nenhum alerta. A escala atende às regras cadastradas.</p>}

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
              {explicacao(a).titulo}
            </p>
            <p className="mt-1">{a.mensagem}</p>
            {nome(a.funcionarioId) && <p className="mt-1 text-xs text-soft">Funcionário: {nome(a.funcionarioId)}</p>}
            <p className="mt-1 text-xs">
              <strong>Como resolver: </strong>
              {a.sugestao}
            </p>
            {a.correcao && (
              <button type="button" className="btn-sec mt-2 !py-1 text-xs" onClick={() => corrigir(a.correcao!)}>
                <Wrench size={14} aria-hidden /> Corrigir só este
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
