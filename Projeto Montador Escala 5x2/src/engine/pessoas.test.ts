import { describe, expect, it } from 'vitest'
import type { Empresa, Escala, Funcao, PessoaEscala, Turno } from '../types'
import { validarEscala } from './conformidade'
import { coberturaParaRegras, criarFuncionarios, gerarEscala, gerarPropostas, type EntradaGerador } from './gerador'
import { minutosDe } from './datas'

const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '20:00', intervaloMin: 60 }]

function pessoa(id: string, nome: string, extra: Partial<PessoaEscala> = {}): PessoaEscala {
  return { id, nome, escalar: true, jornadaPadrao: true, ferias: [], ...extra }
}

function fn(extra: Partial<Funcao> = {}): Funcao {
  return { id: 'atd', nome: 'Atendente', quantidade: 3, jornadaContratual: '44h', horasSemanaisAtuais: 44, ...extra }
}

function entrada(funcoes: Funcao[]): EntradaGerador {
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
  }
}

function turnoDe(e: Escala, funcId: string) {
  const c = e.celulas[funcId].find((x) => x.tipo === 'trabalho')!
  return e.turnos.find((t) => t.id === c.turnoId)!
}
const bruto = (t: { inicio: string; fim: string }) => (minutosDe(t.fim) - minutosDe(t.inicio) + 1440) % 1440

describe('motor com pessoas nominais', () => {
  it('sem pessoas, mesmo resultado de hoje', () => {
    const lista = criarFuncionarios([fn({ quantidade: 3 }), fn({ id: 'cx', nome: 'Caixa', quantidade: 1 })])
    expect(lista.map((f) => f.id)).toEqual(['atd-1', 'atd-2', 'atd-3', 'cx-1'])
    expect(lista.map((f) => f.nome)).toEqual(['Atendente 1', 'Atendente 2', 'Atendente 3', 'Caixa'])
    expect(lista.every((f) => f.funcaoId === 'atd' || f.funcaoId === 'cx')).toBe(true)
  })

  it('um funcionário por pessoa escalável, com nome real, ignorando quantidade', () => {
    const f = fn({
      quantidade: 99,
      pessoas: [pessoa('p1', 'Ana'), pessoa('p2', 'Bia', { escalar: false }), pessoa('p3', 'Caio')],
    })
    const lista = criarFuncionarios([f])
    expect(lista).toEqual([
      { id: 'atd-p1', nome: 'Ana', funcaoId: 'atd' },
      { id: 'atd-p3', nome: 'Caio', funcaoId: 'atd' },
    ])
  })

  it('pessoa com escalar=false não aparece nem na escala nem nas células', () => {
    const f = fn({ pessoas: [pessoa('p1', 'Ana'), pessoa('p2', 'Bia', { escalar: false }), pessoa('p3', 'Caio')] })
    const esc = gerarEscala(entrada([f]), 'fixo')
    expect(esc.funcionarios.map((x) => x.nome)).toEqual(['Ana', 'Caio'])
    expect(Object.keys(esc.celulas).sort()).toEqual(['atd-p1', 'atd-p3'])
  })

  it('duas pessoas da mesma função com 44 h e 30 h recebem horários brutos diferentes', () => {
    const f = fn({ pessoas: [pessoa('p1', 'Ana', { horasSemanais: 44 }), pessoa('p2', 'Bia', { horasSemanais: 30 })] })
    const esc = gerarEscala(entrada([f]), 'fixo')
    const b1 = bruto(turnoDe(esc, 'atd-p1'))
    const b2 = bruto(turnoDe(esc, 'atd-p2'))
    expect(b1).toBeGreaterThan(b2)
  })

  it('pessoa com entrada e saída fixas respeita o horário', () => {
    const f = fn({
      pessoas: [pessoa('p1', 'Ana', { jornadaPadrao: false, entrada: '10:00', saida: '18:00' }), pessoa('p2', 'Bia')],
    })
    const esc = gerarEscala(entrada([f]), 'fixo')
    const t = turnoDe(esc, 'atd-p1')
    expect(t.inicio).toBe('10:00')
    expect(t.fim).toBe('18:00')
  })

  it('intervaloMin da pessoa prevalece sobre o da função', () => {
    const f = fn({
      intervaloMin: 60,
      pessoas: [pessoa('p1', 'Ana', { intervaloMin: 90 }), pessoa('p2', 'Bia')],
    })
    const esc = gerarEscala(entrada([f]), 'fixo')
    expect(turnoDe(esc, 'atd-p1').intervaloMin).toBe(90)
    expect(turnoDe(esc, 'atd-p2').intervaloMin).toBe(60)
  })

  it('propostas geradas com pessoas passam sem alerta vermelho de jornada (cobertura à parte)', () => {
    const f = fn({
      pessoas: [
        pessoa('p1', 'Ana', { horasSemanais: 44 }),
        pessoa('p2', 'Bia', { horasSemanais: 30 }),
        pessoa('p3', 'Caio'),
        pessoa('p4', 'Dani', { escalar: false }),
      ],
    })
    const e = entrada([f])
    for (const p of gerarPropostas(e)) {
      const r = validarEscala({
        escala: p.escala,
        cobertura: coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento),
        feriados: [],
        empresaFuncionaFeriados: false,
        periodos: e.turnos,
        compensacaoDiaria: false,
      })
      expect(r.alertas.filter((a) => a.severidade === 'vermelho' && a.regraId !== 'cobertura'), p.nome).toEqual([])
    }
  })
})
