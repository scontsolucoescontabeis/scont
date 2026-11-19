/**
 * Correção automática em cadeia. Função pura: aplica as correções sugeridas pelo
 * motor de conformidade, uma a uma, aceitando apenas as que REDUZEM a pontuação
 * de alertas (vermelho pesa mais que amarelo). Isso evita ciclos (ex.: uma
 * correção de cobertura que recria um alerta de domingo).
 */
import type { Escala, ResultadoConformidade } from '../types'
import { aplicarCorrecao } from './conformidade'

export type Validador = (escala: Escala) => ResultadoConformidade

const PESO = { vermelho: 10, amarelo: 1 } as const

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

  for (let passo = 0; passo < maxPassos; passo++) {
    const candidatos = resultado.alertas
      .filter((a) => a.correcao && a.correcao.length > 0)
      .sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === 'vermelho' ? -1 : 1))
      .slice(0, maxTentativasPorPasso)
    if (candidatos.length === 0) break

    const base = pontuacao(resultado)
    let melhorou = false
    for (const c of candidatos) {
      const tentativa = aplicarCorrecao(atual, c.correcao!)
      const r = validar(tentativa)
      if (pontuacao(r) < base) {
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
