/**
 * Correção automática em cadeia. Função pura: aplica as correções sugeridas pelo
 * motor de conformidade, uma a uma, aceitando apenas as que REDUZEM a pontuação
 * de alertas (vermelho pesa mais que amarelo). Isso evita ciclos (ex.: uma
 * correção de cobertura que recria um alerta de domingo).
 *
 * Exceção deliberada (decisão do usuário): a troca do descanso para o domingo
 * ("repousoPreferencialDomingo") é aplicada mesmo quando apenas troca o alerta
 * por um furo de cobertura de mesmo peso — a regra legal do domingo tem
 * prioridade. Estados já visitados são ignorados para impedir ciclos.
 */
import type { Escala, ResultadoConformidade } from '../types'
import { aplicarCorrecao } from './conformidade'

export type Validador = (escala: Escala) => ResultadoConformidade

const PESO = { vermelho: 10, amarelo: 1 } as const

/** Correções aceitas mesmo sem reduzir a pontuação, desde que resolvam o próprio alerta. */
const PRIORIDADE_LEGAL = /(repousoPreferencialDomingo|domingoRodizio|domingoMulher)$/

export function pontuacao(r: ResultadoConformidade): number {
  return r.contagem.vermelho * PESO.vermelho + r.contagem.amarelo * PESO.amarelo
}

export interface ResultadoAutocorrecao {
  escala: Escala
  aplicadas: number
}

export function corrigirTudo(
  escala: Escala,
  validar: Validador,
  maxPassos = 150,
  maxTentativasPorPasso = 20,
): ResultadoAutocorrecao {
  let atual = escala
  let resultado = validar(atual)
  let aplicadas = 0
  const visitados = new Set<string>([JSON.stringify(atual.celulas)])

  for (let passo = 0; passo < maxPassos; passo++) {
    const candidatos = resultado.alertas
      .filter((a) => a.correcao && a.correcao.length > 0)
      .sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === 'vermelho' ? -1 : 1))
      .slice(0, maxTentativasPorPasso * 3)
    if (candidatos.length === 0) break

    const base = pontuacao(resultado)
    let melhorou = false
    for (const c of candidatos) {
      const tentativa = aplicarCorrecao(atual, c.correcao!)
      const r = validar(tentativa)
      const pontos = pontuacao(r)
      const resolveuAlerta = !r.alertas.some((x) => x.id === c.id)
      const aceita =
        pontos < base || (pontos === base && resolveuAlerta && PRIORIDADE_LEGAL.test(c.regraId))
      const chave = aceita ? JSON.stringify(tentativa.celulas) : ''
      if (aceita && !visitados.has(chave)) {
        visitados.add(chave)
        atual = tentativa
        resultado = r
        aplicadas++
        melhorou = true
        break
      }
    }
    if (!melhorou) break
  }
  return { escala: atual, aplicadas }
}
