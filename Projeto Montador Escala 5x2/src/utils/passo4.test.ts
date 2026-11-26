import { describe, expect, it } from 'vitest'
import type { RegraId } from '../config/regras'
import type { Alerta, DiaEscala, Escala, Funcao } from '../types'
import {
  EXPLICACOES,
  alertasDaCelula,
  destaquesPropostas,
  diasDoAlerta,
  explicacao,
  filtrarFuncionarios,
  opcoesDaCelula,
  resumoCorrecao,
  resumoProposta,
} from './passo4'

const T = (turnoId = 't1'): DiaEscala => ({ tipo: 'trabalho', turnoId })
const F: DiaEscala = { tipo: 'folga' }
const D: DiaEscala = { tipo: 'dsr' }

// 2026-12-20 é domingo
function escala(celulas: Record<string, DiaEscala[]>, dias = 14): Escala {
  return {
    inicio: '2026-12-20',
    dias,
    funcionarios: [
      { id: 'a', nome: 'Ana Júlia', funcaoId: 'caixa' },
      { id: 'b', nome: 'BRUNO Sá', funcaoId: 'repositor' },
      { id: 'c', nome: 'Célia', funcaoId: 'caixa' },
    ],
    turnos: [
      { id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:24', intervaloMin: 60 },
      { id: 't2', nome: 'Tarde', inicio: '12:00', fim: '20:00', intervaloMin: 60 },
    ],
    celulas,
  }
}
const sem = (...d: DiaEscala[]) => d
const quinzena = (d: DiaEscala) => Array.from({ length: 14 }, () => d)

const alerta = (p: Partial<Alerta> & Pick<Alerta, 'id'>): Alerta => ({
  regraId: 'diasConsecutivosMax',
  severidade: 'amarelo',
  titulo: 'Título técnico',
  mensagem: 'Mensagem técnica do motor.',
  sugestao: 'Sugestão do motor.',
  ...p,
})

const TODAS: RegraId[] = [
  'etapa1.repousosSemanais',
  'etapa1.repousoPreferencialDomingo',
  'etapa1.jornadaSemanalMax',
  'etapa2.jornadaSemanalMax',
  'etapa2.repousosSemanais',
  'etapa2.repousoPreferencialDomingo',
  'legado.repousoPreferencialDomingo',
  'legado.jornadaSemanalMax',
  'legado.repousosSemanais',
  'jornadaDiariaMax',
  'interjornadaMinHoras',
  'intrajornada',
  'cobertura',
  'domingoFeriadoTrabalhado',
  'domingoRodizio',
  'diasConsecutivosMax',
  'repousoSemanalInterjornada',
  'intervaloMaxMinutos',
  'jornadaNoturna',
  'domingoMulher',
  'estagioJornada',
  'menorJornada',
  'menorNoturno',
]

describe('opcoesDaCelula', () => {
  const e = escala({ a: sem(T('t2'), F, D, { tipo: 'ausencia' }, T(), T(), T()), b: quinzena(T()), c: quinzena(T()) }, 7)

  it('lista um "Trabalhar" por horário, folga, DSR e ausência; marca a escolha atual', () => {
    const ops = opcoesDaCelula(e, 'a', 0, [])
    expect(ops.map((o) => o.rotulo)).toEqual([
      'Trabalhar — Comercial (08:00–17:24)',
      'Trabalhar — Tarde (12:00–20:00)',
      'Folga',
      'Descanso semanal (DSR)',
      'Ausência (férias/atestado)',
    ])
    expect(ops.filter((o) => o.atual).map((o) => o.id)).toEqual(['trabalho:t2'])
    expect(ops[0].valor).toEqual({ tipo: 'trabalho', turnoId: 't1' })
    expect(ops[2].valor).toEqual({ tipo: 'folga' })
    expect(new Set(ops.map((o) => o.id)).size).toBe(ops.length)
  })

  it('horário cujo nome já é o próprio horário não aparece duplicado', () => {
    const e2 = { ...e, turnos: [{ id: 't1', nome: '08:00–17:24', inicio: '08:00', fim: '17:24', intervaloMin: 60 }] }
    expect(opcoesDaCelula(e2, 'a', 0, [])[0].rotulo).toBe('Trabalhar — 08:00–17:24')
  })

  it('marca folga, DSR e ausência como atuais', () => {
    expect(opcoesDaCelula(e, 'a', 1, []).find((o) => o.atual)?.id).toBe('folga')
    expect(opcoesDaCelula(e, 'a', 2, []).find((o) => o.atual)?.id).toBe('dsr')
    expect(opcoesDaCelula(e, 'a', 3, []).find((o) => o.atual)?.id).toBe('ausencia')
  })

  it('"Feriado" só aparece quando a data é feriado', () => {
    expect(opcoesDaCelula(e, 'a', 5, []).some((o) => o.id === 'feriado')).toBe(false)
    // índice 5 = 2026-12-25 (Natal)
    const ops = opcoesDaCelula(e, 'a', 5, ['2026-12-25'])
    const fer = ops.find((o) => o.id === 'feriado')!
    expect(fer).toMatchObject({ rotulo: 'Feriado', valor: { tipo: 'feriado' }, atual: false })
  })

  it('célula já marcada como feriado mantém a opção (e marcada) mesmo fora da lista', () => {
    const e2 = escala({ a: sem({ tipo: 'feriado' }), b: sem(T()), c: sem(T()) }, 1)
    expect(opcoesDaCelula(e2, 'a', 0, []).find((o) => o.atual)?.id).toBe('feriado')
  })
})

describe('diasDoAlerta / alertasDaCelula', () => {
  const datas = Array.from({ length: 14 }, (_, i) => `2026-12-${String(20 + i).padStart(2, '0')}`.replace('2026-12-32', '2027-01-01').replace('2026-12-33', '2027-01-02'))

  it('alerta de um dia marca só aquele dia', () => {
    expect(diasDoAlerta(alerta({ id: 'seq|a|2026-12-23', funcionarioId: 'a', data: '2026-12-23' }), datas)).toEqual([3])
  })

  it('alertas semanais (rep|, dom|, sem|) marcam a semana inteira a partir da data', () => {
    for (const p of ['rep', 'dom', 'sem']) {
      const a = alerta({ id: `${p}|a|2026-12-27`, funcionarioId: 'a', data: '2026-12-27' })
      expect(diasDoAlerta(a, datas)).toEqual([7, 8, 9, 10, 11, 12, 13])
    }
  })

  it('semana cortada no fim da escala não passa do último dia', () => {
    const a = alerta({ id: 'rep|a|2026-12-30', funcionarioId: 'a', data: '2026-12-30' })
    expect(diasDoAlerta(a, datas)).toEqual([10, 11, 12, 13])
  })

  it('sem pessoa, sem data ou data fora da escala: não marca célula', () => {
    expect(diasDoAlerta(alerta({ id: 'cob|r|2026-12-21', data: '2026-12-21' }), datas)).toEqual([])
    expect(diasDoAlerta(alerta({ id: 'fer|a', funcionarioId: 'a' }), datas)).toEqual([])
    expect(diasDoAlerta(alerta({ id: 'seq|a|2027-03-01', funcionarioId: 'a', data: '2027-03-01' }), datas)).toEqual([])
  })

  it('alertasDaCelula filtra pela pessoa e pelo dia (inclui semanais)', () => {
    const alertas = [
      alerta({ id: 'seq|a|2026-12-23', funcionarioId: 'a', data: '2026-12-23' }),
      alerta({ id: 'rep|a|2026-12-20', funcionarioId: 'a', data: '2026-12-20', severidade: 'vermelho' }),
      alerta({ id: 'seq|b|2026-12-23', funcionarioId: 'b', data: '2026-12-23' }),
      alerta({ id: 'cob|r|2026-12-23', data: '2026-12-23', regraId: 'cobertura' }),
    ]
    expect(alertasDaCelula(alertas, 'a', 3, '2026-12-20').map((a) => a.id)).toEqual([
      'seq|a|2026-12-23',
      'rep|a|2026-12-20',
    ])
    expect(alertasDaCelula(alertas, 'a', 6, '2026-12-20').map((a) => a.id)).toEqual(['rep|a|2026-12-20'])
    expect(alertasDaCelula(alertas, 'a', 7, '2026-12-20')).toEqual([])
    expect(alertasDaCelula(alertas, 'c', 3, '2026-12-20')).toEqual([])
  })
})

describe('explicacao', () => {
  it('toda regra do motor tem título e o que fazer em linguagem simples', () => {
    expect(Object.keys(EXPLICACOES).sort()).toEqual([...TODAS].sort())
    for (const regraId of TODAS) {
      const ex = explicacao(alerta({ id: 'x', regraId }))
      expect(ex.titulo.length, regraId).toBeGreaterThan(5)
      expect(ex.oQueFazer, regraId).toMatch(/\.$/)
      expect(ex.titulo, regraId).not.toBe('Título técnico')
      expect(ex.oQueFazer, regraId).not.toBe('Mensagem técnica do motor.')
    }
  })

  it('exemplo: dias seguidos de trabalho', () => {
    expect(explicacao(alerta({ id: 'x', regraId: 'diasConsecutivosMax' }))).toEqual({
      titulo: 'Muitos dias seguidos de trabalho',
      oQueFazer: 'Folgue esta pessoa em outro dia ou troque o turno com alguém.',
    })
  })

  it('regra desconhecida usa a própria mensagem do alerta', () => {
    const a = alerta({ id: 'x', regraId: 'novaRegra' as RegraId })
    expect(explicacao(a)).toEqual({ titulo: 'Título técnico', oQueFazer: 'Mensagem técnica do motor.' })
  })
})

describe('resumoCorrecao', () => {
  it('conta os alertas que sumiram e os que restam', () => {
    const antes = ['a', 'b', 'c', 'd', 'e'].map((id) => alerta({ id }))
    const depois = ['d', 'e'].map((id) => alerta({ id }))
    expect(resumoCorrecao(antes, depois)).toEqual({ corrigidos: 3, restantes: 2 })
  })

  it('alerta novo criado pela correção conta nos restantes, não desconta dos corrigidos', () => {
    const antes = ['a', 'b'].map((id) => alerta({ id }))
    const depois = ['b', 'z'].map((id) => alerta({ id }))
    expect(resumoCorrecao(antes, depois)).toEqual({ corrigidos: 1, restantes: 2 })
  })

  it('nada para corrigir', () => {
    expect(resumoCorrecao([], [])).toEqual({ corrigidos: 0, restantes: 0 })
  })
})

describe('filtrarFuncionarios', () => {
  const e = escala({ a: [], b: [], c: [] })
  const funcoes: Funcao[] = [
    { id: 'caixa', nome: 'Operador de Caixa', quantidade: 2, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
    { id: 'repositor', nome: 'Repositor', quantidade: 1, jornadaContratual: '44h', horasSemanaisAtuais: 44 },
  ]
  const ids = (r: { id: string }[]) => r.map((f) => f.id)

  it('sem filtro mostra todos', () => {
    expect(ids(filtrarFuncionarios(e, funcoes, {}))).toEqual(['a', 'b', 'c'])
    expect(ids(filtrarFuncionarios(e, funcoes, { funcaoId: '', texto: '  ' }))).toEqual(['a', 'b', 'c'])
  })

  it('filtra por função', () => {
    expect(ids(filtrarFuncionarios(e, funcoes, { funcaoId: 'caixa' }))).toEqual(['a', 'c'])
  })

  it('texto ignora acentos e maiúsculas', () => {
    expect(ids(filtrarFuncionarios(e, funcoes, { texto: 'julia' }))).toEqual(['a'])
    expect(ids(filtrarFuncionarios(e, funcoes, { texto: 'CELIA' }))).toEqual(['c'])
    expect(ids(filtrarFuncionarios(e, funcoes, { texto: 'bruno sa' }))).toEqual(['b'])
  })

  it('combina função e texto', () => {
    expect(ids(filtrarFuncionarios(e, funcoes, { funcaoId: 'caixa', texto: 'bruno' }))).toEqual([])
    expect(ids(filtrarFuncionarios(e, funcoes, { funcaoId: 'caixa', texto: 'ana' }))).toEqual(['a'])
  })
})

describe('resumoProposta / destaquesPropostas', () => {
  it('conta domingos trabalhados e alertas por cor', () => {
    // dias 0 e 7 são domingos
    const e = escala({ a: quinzena(T()), b: sem(D, ...Array(6).fill(T()), T(), ...Array(6).fill(T())), c: quinzena(F) })
    const alertas = [
      alerta({ id: '1', severidade: 'vermelho' }),
      alerta({ id: '2', severidade: 'amarelo' }),
      alerta({ id: '3', severidade: 'amarelo' }),
    ]
    expect(resumoProposta(e, alertas)).toEqual({ domingosTrabalhados: 3, vermelhos: 1, amarelos: 2 })
  })

  it('selo só para quem é estritamente o melhor', () => {
    const d = destaquesPropostas({
      fixo: { domingosTrabalhados: 4, vermelhos: 0, amarelos: 1 },
      rod: { domingosTrabalhados: 2, vermelhos: 1, amarelos: 3 },
      mov: { domingosTrabalhados: 6, vermelhos: 2, amarelos: 0 },
    })
    expect(d).toEqual({
      fixo: ['Menos alertas', 'Sem alertas vermelhos'],
      rod: ['Menos domingos trabalhados'],
      mov: [],
    })
  })

  it('empate não ganha selo', () => {
    const d = destaquesPropostas({
      a: { domingosTrabalhados: 2, vermelhos: 0, amarelos: 1 },
      b: { domingosTrabalhados: 2, vermelhos: 0, amarelos: 1 },
      c: { domingosTrabalhados: 5, vermelhos: 3, amarelos: 1 },
    })
    expect(d).toEqual({ a: [], b: [], c: [] })
  })

  it('"Sem alertas vermelhos" exige zero vermelhos', () => {
    const d = destaquesPropostas({
      a: { domingosTrabalhados: 2, vermelhos: 1, amarelos: 0 },
      b: { domingosTrabalhados: 3, vermelhos: 2, amarelos: 0 },
    })
    expect(d.a).toEqual(['Menos domingos trabalhados', 'Menos alertas'])
  })

  it('uma proposta só não tem com quem comparar: sem selos', () => {
    expect(destaquesPropostas({ a: { domingosTrabalhados: 0, vermelhos: 0, amarelos: 0 } })).toEqual({ a: [] })
  })
})
