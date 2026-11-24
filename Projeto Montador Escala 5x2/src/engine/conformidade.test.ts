import { describe, expect, it } from 'vitest'
import { REGRAS, etapaVigente, type RegrasLegais } from '../config/regras'
import type { DiaEscala, Escala, Turno } from '../types'
import { aplicarCorrecao, validarEscala, type EntradaConformidade } from './conformidade'

const T8: Turno = { id: 't8', nome: 'Comercial 8h', inicio: '08:00', fim: '17:00', intervaloMin: 60 } // 8h líquidas
const T44: Turno = { id: 't44', nome: 'Comercial 8h48', inicio: '08:00', fim: '17:48', intervaloMin: 60 } // 8h48 líquidas
const T6X1: Turno = { id: 't6', nome: 'Seis por um', inicio: '08:00', fim: '16:20', intervaloMin: 60 } // 7h20 líquidas
const TTARDE: Turno = { id: 'tt', nome: 'Tarde', inicio: '14:00', fim: '23:00', intervaloMin: 60 }

/** Códigos: T<id> trabalho, F folga, D dsr, A ausência, H feriado */
/** Escreva a semana como seg..dom; a escala usa semana domingo..sábado, então o último dia vai para o início. */
function linha(...cod: string[]): DiaEscala[] {
  const rot: string[] = []
  for (let i = 0; i < cod.length; i += 7) rot.push(cod[i + 6], ...cod.slice(i, i + 6))
  return rot.map((c) => {
    if (c === 'F') return { tipo: 'folga' }
    if (c === 'D') return { tipo: 'dsr' }
    if (c === 'A') return { tipo: 'ausencia' }
    if (c === 'H') return { tipo: 'feriado' }
    return { tipo: 'trabalho', turnoId: c }
  })
}

function escala(inicio: string, linhas: DiaEscala[][], turnos: Turno[] = [T8, T44, T6X1, TTARDE]): Escala {
  return {
    inicio,
    dias: linhas[0].length,
    turnos,
    funcionarios: linhas.map((_, i) => ({ id: `f${i + 1}`, nome: `Func ${i + 1}`, funcaoId: 'fn1' })),
    celulas: Object.fromEntries(linhas.map((l, i) => [`f${i + 1}`, l])),
  }
}

function entrada(e: Escala, extra: Partial<EntradaConformidade> = {}): EntradaConformidade {
  return {
    escala: e,
    cobertura: [],
    feriados: [],
    empresaFuncionaFeriados: true,
    compensacaoDiaria: false,
    ...extra,
  }
}

const ids = (r: ReturnType<typeof validarEscala>) => r.alertas.map((a) => a.regraId)

// Domingo 2026-12-20 (1ª etapa), domingo 2026-05-31 (regra antiga); semanas de domingo a sábado
const SEG_ETAPA1 = '2026-12-20'
const SEG_LEGADO = '2026-05-31'

describe('etapas', () => {
  it('identifica a etapa vigente pelas datas parametrizadas', () => {
    expect(etapaVigente('2026-12-15')).toBe('legado')
    expect(etapaVigente('2026-12-16')).toBe('etapa1')
    expect(etapaVigente('2027-12-15')).toBe('etapa1')
    expect(etapaVigente('2027-12-16')).toBe('etapa2')
  })
})

describe('6x1', () => {
  const seisPorUm = linha('t6', 't6', 't6', 't6', 't6', 't6', 'F') // 44h, 1 repouso

  it('é reprovado após a vigência (falta repouso e passa de 42h)', () => {
    const r = validarEscala(entrada(escala(SEG_ETAPA1, [seisPorUm])))
    expect(r.semaforo).toBe('vermelho')
    expect(ids(r)).toContain('etapa1.repousosSemanais')
    expect(ids(r)).toContain('etapa1.jornadaSemanalMax')
  })

  it('é aprovado antes da vigência', () => {
    const r = validarEscala(entrada(escala(SEG_LEGADO, [seisPorUm])))
    expect(r.alertas.filter((a) => a.severidade === 'vermelho')).toEqual([])
  })

  it('a correção automática do repouso resolve o alerta', () => {
    const e = escala(SEG_ETAPA1, [seisPorUm])
    const r = validarEscala(entrada(e))
    const alerta = r.alertas.find((a) => a.regraId === 'etapa1.repousosSemanais')!
    expect(alerta.correcao).toBeDefined()
    const corrigida = aplicarCorrecao(e, alerta.correcao!)
    expect(ids(validarEscala(entrada(corrigida)))).not.toContain('etapa1.repousosSemanais')
  })
})

describe('5x2', () => {
  it('aprovado: 40h, sábado de folga e domingo de DSR', () => {
    const r = validarEscala(entrada(escala(SEG_ETAPA1, [linha('t8', 't8', 't8', 't8', 't8', 'F', 'D')])))
    expect(r.semaforo).toBe('verde')
    expect(r.alertas).toHaveLength(0)
  })

  it('44h em 5 dias é reprovado na etapa 1', () => {
    const r = validarEscala(entrada(escala(SEG_ETAPA1, [linha('t44', 't44', 't44', 't44', 't44', 'F', 'D')])))
    expect(r.semaforo).toBe('vermelho')
    expect(ids(r)).toContain('etapa1.jornadaSemanalMax')
    expect(ids(r)).toContain('jornadaDiariaMax') // 8h48 por dia sem compensação
  })

  it('jornada diária acima de 8h vira amarelo quando há compensação', () => {
    const r = validarEscala(
      entrada(escala(SEG_ETAPA1, [linha('t44', 't44', 't44', 't44', 'F', 'F', 'D')]), { compensacaoDiaria: true }),
    )
    const d = r.alertas.find((a) => a.regraId === 'jornadaDiariaMax')!
    expect(d.severidade).toBe('amarelo')
  })
})

describe('interjornada', () => {
  it('menos de 11h entre turnos é vermelho e tem correção', () => {
    // segunda 14h–23h, terça 08h => 9h de descanso
    const e = escala(SEG_ETAPA1, [linha('tt', 't8', 'F', 'F', 'F', 'F', 'D')])
    const r = validarEscala(entrada(e))
    const a = r.alertas.find((x) => x.regraId === 'interjornadaMinHoras')!
    expect(a.severidade).toBe('vermelho')
    expect(a.correcao).toBeDefined()
    expect(ids(validarEscala(entrada(aplicarCorrecao(e, a.correcao!))))).not.toContain('interjornadaMinHoras')
  })
})

describe('domingo', () => {
  it('descanso fora do domingo gera amarelo (não vermelho)', () => {
    // folga seg e ter, trabalha qua–dom: 2 repousos, nenhum no domingo
    const r = validarEscala(entrada(escala(SEG_ETAPA1, [linha('F', 'F', 't8', 't8', 't8', 't8', 't8')])))
    const a = r.alertas.find((x) => x.regraId === 'etapa1.repousoPreferencialDomingo')!
    expect(a.severidade).toBe('amarelo')
    expect(r.alertas.some((x) => x.severidade === 'vermelho')).toBe(false)
    expect(r.semaforo).toBe('amarelo')
  })

  it('oferece troca de domingo trabalhado por folga na semana', () => {
    const e = escala(SEG_ETAPA1, [linha('t8', 'F', 'F', 't8', 't8', 't8', 't8')])
    const a = validarEscala(entrada(e)).alertas.find((x) => x.regraId === 'etapa1.repousoPreferencialDomingo')!
    const nova = aplicarCorrecao(e, a.correcao!)
    expect(ids(validarEscala(entrada(nova)))).not.toContain('etapa1.repousoPreferencialDomingo')
  })

  it('sem nenhum repouso é vermelho', () => {
    const r = validarEscala(entrada(escala(SEG_ETAPA1, [linha('t8', 't8', 't8', 't8', 't8', 'F', 't8')])))
    expect(ids(r)).toContain('etapa1.repousosSemanais')
  })
})

describe('cobertura', () => {
  const cob = [{ id: 'c1', turnoId: 't8', minimo: 2, diasSemana: [1, 2, 3, 4, 5] }]
  const dois = (extra: string[]) => [
    linha('t8', 't8', 't8', 't8', 't8', 'F', 'D'),
    linha(...extra),
  ]

  it('acusa furo quando falta gente no turno', () => {
    const r = validarEscala(
      entrada(escala(SEG_ETAPA1, dois(['t8', 't8', 'F', 't8', 't8', 'F', 'D'])), { cobertura: cob }),
    )
    const furos = r.alertas.filter((a) => a.regraId === 'cobertura')
    expect(furos).toHaveLength(1)
    expect(furos[0].data).toBe('2026-12-23')
    expect(furos[0].severidade).toBe('amarelo') // 1 de 2
  })

  it('não acusa quando a cobertura está completa', () => {
    const r = validarEscala(entrada(escala(SEG_ETAPA1, dois(['t8', 't8', 't8', 't8', 't8', 'F', 'D'])), { cobertura: cob }))
    expect(ids(r)).not.toContain('cobertura')
  })

  it('ignora feriado quando a empresa não funciona', () => {
    const r = validarEscala(
      entrada(escala(SEG_ETAPA1, dois(['t8', 't8', 'H', 't8', 't8', 'F', 'D'])), {
        cobertura: cob,
        feriados: ['2026-12-23'],
        empresaFuncionaFeriados: false,
      }),
    )
    expect(ids(r)).not.toContain('cobertura')
  })
})

describe('mudança de etapa em 16/12/2027', () => {
  // 41h semanais: aprovado na etapa 1 (≤42h), reprovado na etapa 2 (≤40h)
  const T41: Turno = { id: 't41', nome: '41h', inicio: '08:00', fim: '17:12', intervaloMin: 60 } // 8h12 x 5 = 41h
  const cinco = linha('t41', 't41', 't41', 't41', 't41', 'F', 'D')

  it('semana que termina antes de 16/12/2027 usa 42h', () => {
    // 05/12 a 11/12/2027
    const r = validarEscala(entrada(escala('2027-12-05', [cinco], [T41])))
    expect(ids(r)).not.toContain('etapa1.jornadaSemanalMax')
  })

  it('semana que termina em/depois de 16/12/2027 usa 40h', () => {
    // 12/12 a 18/12/2027
    const r = validarEscala(entrada(escala('2027-12-12', [cinco], [T41])))
    expect(ids(r)).toContain('etapa2.jornadaSemanalMax')
  })
})

describe('modo flexível (STF)', () => {
  it('rebaixa infrações da etapa 1 para amarelo', () => {
    const regras: RegrasLegais = { ...REGRAS, modoTransicao: 'flexivel_stf' }
    const r = validarEscala(
      entrada(escala(SEG_ETAPA1, [linha('t6', 't6', 't6', 't6', 't6', 't6', 'F')]), { regras }),
    )
    expect(r.semaforo).toBe('amarelo')
    expect(r.contagem.vermelho).toBe(0)
  })
})

describe('intervalo e ausências', () => {
  it('turno > 6h com 30 min de intervalo é reprovado', () => {
    const curto: Turno = { id: 'c', nome: 'Curto', inicio: '08:00', fim: '16:00', intervaloMin: 30 }
    const r = validarEscala(entrada(escala(SEG_ETAPA1, [linha('c', 'c', 'c', 'c', 'c', 'F', 'D')], [curto])))
    expect(ids(r)).toContain('intrajornada')
  })

  it('semana com atestado/férias não é avaliada', () => {
    const r = validarEscala(entrada(escala(SEG_ETAPA1, [linha('t6', 't6', 'A', 'A', 'A', 'A', 'A')])))
    expect(r.alertas.filter((a) => a.regraId.startsWith('etapa1'))).toHaveLength(0)
  })
})
