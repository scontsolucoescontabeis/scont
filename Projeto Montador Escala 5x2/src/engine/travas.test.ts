import { describe, expect, it } from 'vitest'
import type { Empresa, Escala, Funcao, PessoaEscala, Turno } from '../types'
import { corrigirTudo } from './autocorrecao'
import { gerarEscala, gerarPropostas, type EntradaGerador, type Travas } from './gerador'

const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '20:00', intervaloMin: 60 }]

function pessoa(id: string, nome: string): PessoaEscala {
  return { id, nome, escalar: true, jornadaPadrao: false, menor: false, estagiario: false, ferias: [] }
}

const equipe: Funcao[] = [
  {
    id: 'atd',
    nome: 'Atendente',
    quantidade: 5,
    jornadaContratual: '42h',
    horasSemanaisAtuais: 42,
    pessoas: ['ana', 'bia', 'caio', 'dani', 'edu'].map((id) => pessoa(id, id)),
  },
]

function entrada(extra: Partial<EntradaGerador> = {}): EntradaGerador {
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
    funcoes: equipe,
    turnos,
    cobertura: { t1: { util: 2, sab: 2, dom: 0 } },
    feriados: [],
    inicio: '2026-12-20', // domingo
    semanas: 4,
    ...extra,
  }
}

const horario = (e: Escala, id: string, i: number) => {
  const c = e.celulas[id][i]
  if (c.tipo !== 'trabalho') return c.tipo
  const t = e.turnos.find((x) => x.id === c.turnoId)!
  return `${t.inicio}–${t.fim}`
}

/** Pessoas presentes por dia (índice) em algum horário. */
const presentesNoDia = (e: Escala, i: number) => e.funcionarios.filter((f) => e.celulas[f.id][i].tipo === 'trabalho').length

describe('dias travados (ajustes manuais mantidos ao refazer a escala)', () => {
  it('folga e trabalho travados ficam exatamente como estão, em todos os modelos', () => {
    // Ana: folga travada na quarta (dia 3) e trabalho travado no sábado (dia 6) às 12–20.
    const travas: Travas = {
      'atd-ana': { 3: { tipo: 'folga' }, 6: { tipo: 'trabalho', horario: { entrada: '12:00', saida: '20:00', intervaloMin: 60 } } },
    }
    for (const p of gerarPropostas(entrada({ travas }))) {
      expect(p.escala.celulas['atd-ana'][3].tipo, p.nome).toBe('folga')
      expect(horario(p.escala, 'atd-ana', 6), p.nome).toBe('12:00–20:00')
    }
  })

  it('os demais compensam a folga travada para manter a cobertura', () => {
    // Trava 3 pessoas de folga na quarta: sobram 2, o mínimo — os outros dois têm de trabalhar nesse dia.
    const travas: Travas = {
      'atd-ana': { 3: { tipo: 'folga' } },
      'atd-bia': { 3: { tipo: 'folga' } },
      'atd-caio': { 3: { tipo: 'folga' } },
    }
    const e = gerarEscala(entrada({ travas }), 'fixo')
    expect(presentesNoDia(e, 3)).toBe(2)
    expect(e.celulas['atd-dani'][3].tipo).toBe('trabalho')
    expect(e.celulas['atd-edu'][3].tipo).toBe('trabalho')
  })

  it('trabalho travado sem horário usa o horário da pessoa; férias travadas viram ausência', () => {
    const travas: Travas = { 'atd-bia': { 1: { tipo: 'trabalho' }, 2: { tipo: 'ausencia' } } }
    const e = gerarEscala(entrada({ travas }), 'fixo')
    expect(e.celulas['atd-bia'][1].tipo).toBe('trabalho')
    expect(e.celulas['atd-bia'][2].tipo).toBe('ausencia')
  })

  it('a correção automática não mexe nos dias travados', () => {
    const travas: Travas = { 'atd-ana': { 1: { tipo: 'folga' }, 2: { tipo: 'folga' }, 3: { tipo: 'folga' } } }
    const e = gerarEscala(entrada({ travas }), 'fixo')
    const r = corrigirTudo(
      e,
      () => ({
        semaforo: 'vermelho',
        contagem: { vermelho: 1, amarelo: 0 },
        alertas: [
          {
            id: 'x',
            regraId: 'cobertura',
            severidade: 'vermelho',
            titulo: 't',
            mensagem: 'm',
            sugestao: 's',
            correcao: [{ funcionarioId: 'atd-ana', dia: 2, novo: { tipo: 'trabalho', turnoId: e.turnos[0].id } }],
          },
        ],
      }),
      undefined,
      undefined,
      (fid, dia) => travas[fid]?.[dia] !== undefined,
    )
    expect(r.aplicadas).toBe(0)
    expect(r.escala.celulas['atd-ana'][2].tipo).toBe('folga')
  })
})
