import { describe, expect, it } from 'vitest'
import type { Empresa, Escala, Funcao, HorarioDiaPessoa, PessoaEscala, Turno } from '../types'
import { gerarEscala, gerarPropostas, type EntradaGerador } from './gerador'

const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '20:00', intervaloMin: 60 }]

function pessoa(id: string, nome: string, extra: Partial<PessoaEscala> = {}): PessoaEscala {
  return { id, nome, escalar: true, jornadaPadrao: false, menor: false, estagiario: false, ferias: [], ...extra }
}

function entrada(funcoes: Funcao[], extra: Partial<EntradaGerador> = {}): EntradaGerador {
  const empresa: Empresa = {
    nome: 'Loja',
    setor: 'Varejo',
    diasFuncionamento: [false, true, true, true, true, true, true],
    horaAbertura: '08:00',
    horaFechamento: '20:00',
    funcionaFeriados: false,
    acordoColetivo: 'nao',
    compensacaoDiaria: false,
  }
  return {
    empresa,
    funcoes,
    turnos,
    cobertura: { t1: { util: 2, sab: 2, dom: 0 } },
    feriados: [],
    inicio: '2026-12-20',
    semanas: 4,
    ...extra,
  }
}

/** Horários (início–fim/intervalo) distintos dos dias trabalhados de um funcionário. */
function horarios(e: Escala, id: string): string[] {
  const s = new Set<string>()
  for (const c of e.celulas[id]) {
    if (c.tipo !== 'trabalho') continue
    const t = e.turnos.find((x) => x.id === c.turnoId)!
    s.add(`${t.inicio}–${t.fim}/${t.intervaloMin}`)
  }
  return [...s]
}

const equipe = (extra: Partial<PessoaEscala> = {}): Funcao[] => [
  {
    id: 'atd',
    nome: 'Atendente',
    quantidade: 4,
    jornadaContratual: '42h',
    horasSemanaisAtuais: 42,
    pessoas: [pessoa('ana', 'Ana', extra), pessoa('bia', 'Bia'), pessoa('caio', 'Caio'), pessoa('dani', 'Dani')],
  },
]

describe('horário alterado no passo 4', () => {
  it('a pessoa passa a ter o horário informado em todos os dias de trabalho, em todos os modelos', () => {
    const e = entrada(equipe(), { horariosFixos: { 'atd-ana': { entrada: '11:00', saida: '20:00', intervaloMin: 60 } } })
    for (const p of gerarPropostas(e)) {
      expect(horarios(p.escala, 'atd-ana'), p.nome).toEqual(['11:00–20:00/60'])
      // continua 5x2: 2 repousos por semana
      for (let s = 0; s < 4; s++) {
        const sem = p.escala.celulas['atd-ana'].slice(s * 7, s * 7 + 7)
        expect(sem.filter((c) => c.tipo === 'trabalho').length, p.nome).toBe(5)
      }
    }
  })

  it('sem intervalo informado, vale o mínimo legal', () => {
    const e = entrada(equipe(), { horariosFixos: { 'atd-ana': { entrada: '08:00', saida: '17:00' } } })
    expect(horarios(gerarEscala(e, 'fixo'), 'atd-ana')).toEqual(['08:00–17:00/60'])
  })

  it('os demais são refeitos para cobrir o que a pessoa deixou de cobrir', () => {
    const base = gerarEscala(entrada(equipe()), 'fixo')
    // Ana só à tarde: a manhã precisa ficar com os outros.
    const e = entrada(equipe(), { horariosFixos: { 'atd-ana': { entrada: '14:00', saida: '20:00', intervaloMin: 15 } } })
    const nova = gerarEscala(e, 'fixo')
    expect(horarios(nova, 'atd-ana')).toEqual(['14:00–20:00/15'])
    const outros = ['atd-bia', 'atd-caio', 'atd-dani'].flatMap((id) => horarios(nova, id))
    expect(outros.some((h) => h.startsWith('08:00'))).toBe(true)
    expect(base).not.toEqual(nova)
  })

  it('com jornada por dia (passo 2), o horário novo vale nos dias de trabalho e as folgas ficam', () => {
    const util: HorarioDiaPessoa = { entrada: '08:00', saida: '17:00', intervaloInicio: '12:00', intervaloFim: '13:00' }
    const e = entrada(equipe({ jornadaDias: [null, util, util, null, util, util, util] }), {
      horariosFixos: { 'atd-ana': { entrada: '10:00', saida: '19:00', intervaloMin: 60 } },
    })
    const esc = gerarEscala(e, 'fixo')
    const sem = esc.celulas['atd-ana'].slice(0, 7)
    expect(sem[3].tipo).toMatch(/dsr|folga/)
    expect(horarios(esc, 'atd-ana')).toEqual(['10:00–19:00/60'])
  })

  it('horário inválido é ignorado (jornada automática)', () => {
    const a = gerarEscala(entrada(equipe(), { horariosFixos: { 'atd-ana': { entrada: '', saida: '17:00' } } }), 'fixo')
    const b = gerarEscala(entrada(equipe()), 'fixo')
    expect(a).toEqual(b)
  })
})
