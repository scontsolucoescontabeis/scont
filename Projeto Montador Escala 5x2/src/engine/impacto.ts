/** Calculadora de impacto — tudo é ESTIMATIVA. Função pura. */
import { REGRAS, limitesDaEtapa, type EtapaId, type RegrasLegais } from '../config/regras'
import type { Funcao, ParametrosCusto } from '../types'

const SEMANAS_POR_MES = 52 / 12

export interface ImpactoFuncao {
  funcaoId: string
  nome: string
  quantidade: number
  horasAtuais: number
  horasNovas: number
  horasADescobrirSemana: number
  contratacoesEquivalentes: number
  custoMensalAtual: number | null
  custoMensalContratando: number | null
  custoMensalHoraExtra: number | null
}

export interface ResultadoImpacto {
  etapa: Exclude<EtapaId, 'legado'>
  jornadaAlvo: number
  porFuncao: ImpactoFuncao[]
  horasSemanaisAtuais: number
  horasSemanaisNovas: number
  deficitHorasSemana: number
  contratacoesEquivalentes: number
  custoMensalAtual: number | null
  custoMensalContratando: number | null
  custoMensalHoraExtra: number | null
  rotulo: 'ESTIMATIVA'
}

export const CUSTO_PADRAO: ParametrosCusto = { encargosPct: 70, horaExtraPct: 50 }

export function calcularImpacto(
  funcoes: Funcao[],
  etapa: Exclude<EtapaId, 'legado'>,
  custo: ParametrosCusto = CUSTO_PADRAO,
  regras: RegrasLegais = REGRAS,
): ResultadoImpacto {
  const alvo = limitesDaEtapa(etapa, regras).jornadaSemanalMax
  const fator = 1 + custo.encargosPct / 100
  const temSalario = funcoes.some((f) => f.salarioBase && f.salarioBase > 0)

  const porFuncao: ImpactoFuncao[] = funcoes.map((f) => {
    const atuais = f.horasSemanaisAtuais
    // Quem já trabalha menos que o novo limite não "libera" horas.
    const horasNovas = Math.min(atuais, alvo)
    const deficit = Math.max(0, atuais - alvo) * f.quantidade
    const contrat = horasNovas > 0 ? deficit / horasNovas : 0
    const sal = f.salarioBase && f.salarioBase > 0 ? f.salarioBase : null
    // Salário mensal mantido (irredutibilidade): a hora trabalhada fica mais cara.
    const valorHoraNova = sal && horasNovas > 0 ? sal / (horasNovas * SEMANAS_POR_MES) : 0
    const base = sal ? f.quantidade * sal * fator : null
    return {
      funcaoId: f.id,
      nome: f.nome,
      quantidade: f.quantidade,
      horasAtuais: atuais,
      horasNovas,
      horasADescobrirSemana: deficit,
      contratacoesEquivalentes: contrat,
      custoMensalAtual: base,
      custoMensalContratando: sal && base !== null ? base + contrat * sal * fator : null,
      custoMensalHoraExtra:
        sal && base !== null
          ? base + deficit * SEMANAS_POR_MES * valorHoraNova * (1 + custo.horaExtraPct / 100) * fator
          : null,
    }
  })

  const soma = (k: 'custoMensalAtual' | 'custoMensalContratando' | 'custoMensalHoraExtra') =>
    temSalario ? porFuncao.reduce((s, p) => s + (p[k] ?? 0), 0) : null

  return {
    etapa,
    jornadaAlvo: alvo,
    porFuncao,
    horasSemanaisAtuais: porFuncao.reduce((s, p) => s + p.horasAtuais * p.quantidade, 0),
    horasSemanaisNovas: porFuncao.reduce((s, p) => s + p.horasNovas * p.quantidade, 0),
    deficitHorasSemana: porFuncao.reduce((s, p) => s + p.horasADescobrirSemana, 0),
    contratacoesEquivalentes: porFuncao.reduce((s, p) => s + p.contratacoesEquivalentes, 0),
    custoMensalAtual: soma('custoMensalAtual'),
    custoMensalContratando: soma('custoMensalContratando'),
    custoMensalHoraExtra: soma('custoMensalHoraExtra'),
    rotulo: 'ESTIMATIVA',
  }
}
