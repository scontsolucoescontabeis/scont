import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Escala, Funcao, Turno } from '../types'
import { validarEscala } from './conformidade'
import { coberturaParaRegras, gerarPropostas, type EntradaGerador } from './gerador'
import { cicloDomingoDoSetor } from '../config/regras'

const T8: Turno = { id: 't8', nome: '08–17', inicio: '08:00', fim: '17:00', intervaloMin: 60 }
const TN: Turno = { id: 'tn', nome: '20–05', inicio: '20:00', fim: '05:00', intervaloMin: 60 }
const T3: Turno = { id: 't3', nome: '14–23', inicio: '14:00', fim: '23:00', intervaloMin: 60 }

/** Escala de 1 funcionário; `linhas` = tipos por dia ('t8' trabalha; 'F' folga; 'D' dsr). */
function esc(inicio: string, linha: string[], turnos: Turno[] = [T8]): Escala {
  return {
    inicio,
    dias: linha.length,
    funcionarios: [{ id: 'f1', nome: 'Ana', funcaoId: 'x' }],
    turnos,
    celulas: {
      f1: linha.map((c) =>
        c === 'F' ? { tipo: 'folga' } : c === 'D' ? { tipo: 'dsr' } : { tipo: 'trabalho', turnoId: c },
      ),
    },
  }
}

const v = (e: Escala, extra = {}) =>
  validarEscala({ escala: e, cobertura: [], feriados: [], empresaFuncionaFeriados: true, compensacaoDiaria: false, ...extra })

const regra = (e: Escala, id: string, extra = {}) => v(e, extra).alertas.filter((a) => a.regraId === id)

// 2026-12-20 é domingo (etapa 1)
const DOM = '2026-12-20'
const sem = (dom: string) => [dom, 't8', 't8', 't8', 't8', 'F', 'F']

describe('domingo a cada 3 semanas (Lei 10.101 art. 6º)', () => {
  it('3 domingos seguidos trabalhados no comércio é vermelho', () => {
    const e = esc(DOM, [...sem('t8'), ...sem('t8'), ...sem('t8'), ...sem('D')])
    const a = regra(e, 'domingoRodizio')
    expect(a).toHaveLength(1)
    expect(a[0].severidade).toBe('vermelho')
    expect(a[0].data).toBe('2027-01-03')
  })

  it('2 domingos trabalhados e o 3º de folga está conforme', () => {
    const e = esc(DOM, [...sem('t8'), ...sem('t8'), ...sem('D'), ...sem('t8')])
    expect(regra(e, 'domingoRodizio')).toEqual([])
  })

  it('setor industrial usa o ciclo de 7 semanas', () => {
    expect(cicloDomingoDoSetor('Indústria metalúrgica')).toBe(7)
    expect(cicloDomingoDoSetor('Varejo')).toBe(3)
    const e = esc(DOM, [...sem('t8'), ...sem('t8'), ...sem('t8'), ...sem('D')])
    expect(regra(e, 'domingoRodizio', { cicloDomingoSemanas: 7 })).toEqual([])
  })
})

describe('no máximo 6 dias seguidos de trabalho (OJ 410 SDI-1)', () => {
  it('rep. no início de uma semana e no fim da seguinte passa de 6 dias', () => {
    // sem1: D F t t t t t ; sem2: t t t t t F D => 5 + 5 = 10 dias seguidos
    const e = esc(DOM, ['D', 'F', 't8', 't8', 't8', 't8', 't8', 't8', 't8', 't8', 't8', 't8', 'F', 'D'])
    const a = regra(e, 'diasConsecutivosMax')
    expect(a).toHaveLength(1)
    expect(a[0].severidade).toBe('vermelho')
    expect(a[0].correcao).toBeDefined()
  })

  it('6 dias seguidos é permitido', () => {
    const e = esc(DOM, ['D', 't8', 't8', 't8', 't8', 't8', 't8', 'F', 't8', 't8', 't8', 't8', 't8', 'D'])
    expect(regra(e, 'diasConsecutivosMax')).toEqual([])
  })
})

describe('DSR + interjornada = 35h (Súmula 110/TST)', () => {
  it('sexta até 23h e volta na segunda às 08h (dom e sáb... ) respeita 35h', () => {
    const e = esc(DOM, ['D', 't8', 't8', 't8', 't8', 't8', 'F'], [T8])
    expect(regra(e, 'repousoSemanalInterjornada')).toEqual([])
  })

  it('sai às 23h no dia anterior ao DSR e volta às 08h do dia seguinte ao DSR: < 35h', () => {
    // sábado 14–23 (t3), domingo DSR, segunda 08–17 => 23:00 -> 08:00 + 24h = 33h
    const e = esc('2026-12-20', ['D', 't8', 't8', 't8', 't8', 'F', 't3', 'D', 't8', 't8', 't8', 't8', 'F', 'F'], [T8, T3])
    const a = regra(e, 'repousoSemanalInterjornada')
    expect(a.length).toBeGreaterThan(0)
    expect(a[0].severidade).toBe('amarelo')
  })
})

describe('intervalo e trabalho noturno', () => {
  it('intervalo de 3h exige acordo (amarelo)', () => {
    const t = { ...T8, id: 'tl', intervaloMin: 180 }
    const e = esc(DOM, ['D', 'tl', 'tl', 'tl', 'tl', 'F', 'F'], [t])
    expect(regra(e, 'intervaloMaxMinutos')[0]?.severidade).toBe('amarelo')
  })

  it('turno 20h–05h avisa hora noturna reduzida', () => {
    const e = esc(DOM, ['D', 'tn', 'tn', 'tn', 'tn', 'F', 'F'], [TN])
    const a = regra(e, 'jornadaNoturna')
    expect(a).toHaveLength(1)
    expect(a[0].mensagem).toContain('52min30s')
  })

  it('turno diurno não gera aviso noturno', () => {
    const e = esc(DOM, ['D', 't8', 't8', 't8', 't8', 'F', 'F'])
    expect(regra(e, 'jornadaNoturna')).toEqual([])
  })
})

describe('propostas geradas respeitam a legislação (domingo e dias seguidos)', () => {
  const funcoes = (n: number): Funcao[] => [
    { id: 'atd', nome: 'Atendente', quantidade: n, jornadaContratual: '44h', horasSemanaisAtuais: 44, salarioBase: 2000 },
  ]
  function base(n: number, cob: CoberturaTurno, semanas = 8): EntradaGerador {
    const empresa: Empresa = {
      nome: 'Loja',
      setor: 'Varejo',
      diasFuncionamento: [true, true, true, true, true, true, true],
      horaAbertura: '08:00',
      horaFechamento: '18:00',
      funcionaFeriados: true,
      acordoColetivo: 'nao',
      compensacaoDiaria: false,
    }
    const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '18:00', intervaloMin: 0 }]
    return { empresa, funcoes: funcoes(n), turnos, cobertura: { t1: cob }, feriados: [], inicio: '2026-12-20', semanas }
  }

  for (const [n, cob] of [
    [4, { util: 2, sab: 2, dom: 2 }],
    [6, { util: 3, sab: 3, dom: 3 }],
    [8, { util: 4, sab: 4, dom: 2 }],
    [3, { util: 2, sab: 2, dom: 1 }],
  ] as [number, CoberturaTurno][]) {
    it(`${n} empregados, domingo ${cob.dom}: sem 3 domingos seguidos nem 7 dias seguidos`, () => {
      const e = base(n, cob)
      for (const p of gerarPropostas(e)) {
        const r = validarEscala({
          escala: p.escala,
          cobertura: coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento),
          feriados: [],
          empresaFuncionaFeriados: true,
          periodos: e.turnos,
          compensacaoDiaria: false,
        })
        const graves = r.alertas.filter((a) => ['domingoRodizio', 'diasConsecutivosMax'].includes(a.regraId))
        expect(graves.map((a) => a.mensagem), p.nome).toEqual([])
      }
    })
  }
})
