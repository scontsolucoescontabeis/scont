import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Funcao, Turno } from '../types'
import { validarEscala } from './conformidade'
import { calcularQuadro } from './contratacoes'
import { coberturaParaRegras, gerarPropostas, perfilNecessidade, type EntradaGerador } from './gerador'
import { CUSTO_PADRAO } from './impacto'

const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:24', intervaloMin: 0 }]
const funcoes: Funcao[] = [
  { id: 'cx', nome: 'Caixa', quantidade: 3, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
  { id: 'rep', nome: 'Repositor', quantidade: 3, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
]
const empresa: Empresa = {
  nome: 'Loja',
  setor: 'Varejo',
  diasFuncionamento: [false, true, true, true, true, true, true],
  horaAbertura: '08:00',
  horaFechamento: '17:24',
  funcionaFeriados: true,
  acordoColetivo: 'nao',
  compensacaoDiaria: false,
}
const cob = (c: CoberturaTurno) => ({ t1: c })

describe('mínimo de pessoas por função', () => {
  it('gera uma regra de cobertura por função, com o nome da função', () => {
    const regras = coberturaParaRegras(
      cob({ util: 3, sab: 2, dom: 0, porFuncao: { cx: { util: 2, sab: 1, dom: 0 } } }),
      empresa.diasFuncionamento,
      funcoes,
    )
    const rf = regras.filter((r) => r.funcaoId === 'cx')
    expect(rf.map((r) => [r.minimo, r.diasSemana])).toEqual([
      [2, [1, 2, 3, 4, 5]],
      [1, [6]],
    ])
    expect(rf[0].rotulo).toBe('Caixa')
  })

  it('ignora função removida', () => {
    const regras = coberturaParaRegras(
      cob({ util: 3, sab: 0, dom: 0, porFuncao: { fantasma: { util: 1, sab: 0, dom: 0 } } }),
      empresa.diasFuncionamento,
      funcoes,
    )
    expect(regras.some((r) => r.funcaoId)).toBe(false)
  })

  it('o total do perfil nunca é menor que a soma dos mínimos por função', () => {
    const perfil = perfilNecessidade(
      empresa,
      turnos,
      cob({ util: 1, sab: 0, dom: 0, porFuncao: { cx: { util: 2, sab: 0, dom: 0 }, rep: { util: 1, sab: 0, dom: 0 } } }),
      ['cx', 'rep'],
    )
    expect(perfil[1][40]).toBe(3) // segunda, 10h
  })

  it('o motor acusa falta de uma função mesmo com o total atendido', () => {
    const e: EntradaGerador = {
      empresa,
      funcoes,
      turnos,
      cobertura: cob({ util: 2, sab: 0, dom: 0 }),
      feriados: [],
      inicio: '2026-12-20',
      semanas: 2,
    }
    const escala = gerarPropostas(e)[0].escala
    // todos os caixas folgam na segunda 21/12; sobram só repositores
    for (const f of escala.funcionarios) {
      if (f.funcaoId === 'cx') escala.celulas[f.id][1] = { tipo: 'folga' }
    }
    const regras = coberturaParaRegras(
      cob({ util: 2, sab: 0, dom: 0, porFuncao: { cx: { util: 1, sab: 0, dom: 0 } } }),
      empresa.diasFuncionamento,
      funcoes,
    )
    const r = validarEscala({
      escala,
      cobertura: regras,
      feriados: [],
      empresaFuncionaFeriados: true,
      periodos: turnos,
      compensacaoDiaria: false,
    })
    const furo = r.alertas.find((a) => a.regraId === 'cobertura' && a.mensagem.includes('de "Caixa"'))
    expect(furo?.data).toBe('2026-12-21')
  })

  it('o gerador considera o mínimo por função (domingo aberto, rodízio sem furo de função)', () => {
    const fn: Funcao[] = [
      { id: 'cx', nome: 'Caixa', quantidade: 2, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
      { id: 'rep', nome: 'Repositor', quantidade: 4, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
    ]
    const aberta: Empresa = { ...empresa, diasFuncionamento: [true, true, true, true, true, true, true] }
    const comFuncao = cob({
      util: 3, sab: 3, dom: 2,
      porFuncao: { cx: { util: 1, sab: 1, dom: 1 }, rep: { util: 1, sab: 1, dom: 1 } },
    })
    const regras = coberturaParaRegras(comFuncao, aberta.diasFuncionamento, fn)
    const furosDeFuncao = (cobertura: Record<string, CoberturaTurno>) =>
      gerarPropostas({ empresa: aberta, funcoes: fn, turnos, cobertura, feriados: [], inicio: '2026-12-20', semanas: 4 }).map(
        (p) =>
          validarEscala({
            escala: p.escala, cobertura: regras, feriados: [], empresaFuncionaFeriados: true,
            periodos: turnos, compensacaoDiaria: false,
          }).alertas.filter((a) => a.regraId === 'cobertura' && a.mensagem.includes(' de "')).length,
      )
    const com = furosDeFuncao(comFuncao)
    const sem = furosDeFuncao(cob({ util: 3, sab: 3, dom: 2 }))
    const soma = (x: number[]) => x.reduce((a, b) => a + b, 0)
    expect(com[1]).toBe(0) // rodízio de domingos
    // (o rodízio de domingos nos três modelos já tira os furos de função na base; o mínimo por função não piora)
    expect(soma(com)).toBeLessThanOrEqual(soma(sem))
  })

  it('quadro de contratações: função com mínimo próprio acima da equipe pede contratação nela', () => {
    const q = calcularQuadro(
      {
        empresa,
        funcoes,
        turnos: [{ ...turnos[0], fim: '17:00', intervaloMin: 60 }],
        cobertura: cob({ util: 1, sab: 0, dom: 0, porFuncao: { cx: { util: 4, sab: 0, dom: 0 } } }),
        custo: CUSTO_PADRAO,
      },
      'etapa1',
    )
    const cx = q.porFuncao.find((f) => f.funcaoId === 'cx')!
    const rep = q.porFuncao.find((f) => f.funcaoId === 'rep')!
    expect(cx.contratar).toBeGreaterThan(0)
    expect(rep.contratar).toBe(0)
  })

  it('mínimo por cargo diferente em cada dia da semana vira regras e perfil por dia', () => {
    const c = cob({
      util: 2, sab: 1, dom: 0,
      porFuncao: { cx: { util: 1, sab: 1, dom: 0, porDia: { 5: 3 } } },
    })
    const rf = coberturaParaRegras(c, empresa.diasFuncionamento, funcoes).filter((r) => r.funcaoId === 'cx')
    expect(rf.map((r) => [r.minimo, r.diasSemana])).toEqual([
      [1, [1, 2, 3, 4]],
      [3, [5]],
      [1, [6]],
    ])
    const perfil = perfilNecessidade(empresa, turnos, c, ['cx', 'rep'])
    expect(perfil[1][40]).toBe(2) // segunda: vale o total
    expect(perfil[5][40]).toBe(3) // sexta: o mínimo do cargo passa do total
  })
})
