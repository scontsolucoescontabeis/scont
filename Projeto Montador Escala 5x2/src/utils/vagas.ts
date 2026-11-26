/**
 * Liga o gerador de vagas (engine/vagas.ts) aos dados da tela: mede as faltas de cobertura como o
 * Passo 4 faz (já com as correções automáticas) e usa o quadro de contratações para ordenar as vagas.
 */
import { REGRAS } from '../config/regras'
import { corrigirTudo } from '../engine/autocorrecao'
import { furoComAusencia } from '../engine/conformidade'
import { calcularQuadro } from '../engine/contratacoes'
import { ordemDasVagas } from '../engine/vagas'
import type { Escala } from '../types'
import type { Dados } from '../store/useStore'
import { analisar, type DadosAnalise } from './analise'

/**
 * Conta as faltas de gente da escala depois das correções automáticas, sem as que acontecem com alguém
 * ausente (férias/atestado) no dia: essas contratar não resolve.
 */
export function criarMedidorDeFuros(d: DadosAnalise): (escala: Escala) => number {
  return (escala) => {
    const corrigida = corrigirTudo(escala, (e) => analisar(d, e)).escala
    return analisar(d, corrigida).alertas.filter((a) => a.regraId === 'cobertura' && !furoComAusencia(a)).length
  }
}

/** Ordem em que as vagas entram na escala: a do quadro de contratações da etapa escolhida, mais uma folga. */
export function ordemDeVagasDosDados(
  d: Pick<Dados, 'empresa' | 'funcoes' | 'turnos' | 'cobertura' | 'custo' | 'etapaImpacto' | 'regrasPessoais'>,
): string[] {
  const q = calcularQuadro(d, d.etapaImpacto, REGRAS, d.regrasPessoais)
  return ordemDasVagas(d.funcoes, Object.fromEntries(q.porFuncao.map((p) => [p.funcaoId, p.contratar])))
}
