import { describe, expect, it } from 'vitest'
import type { Empresa, Escala, Funcao, HorarioDiaPessoa, PessoaEscala, Turno } from '../types'
import { gerarPropostas, type EntradaGerador } from './gerador'
import { horarioDoDiaPessoa, horasDaJornadaDias, temJornadaDias } from './jornada'
import { calcularSobreposicoes, aplicarSobreposicoes } from '../portal/modo'
import { jornadaDiasInicial } from '../portal/equipe'

const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '20:00', intervaloMin: 60 }]
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

function pessoa(id: string, nome: string, extra: Partial<PessoaEscala> = {}): PessoaEscala {
  return { id, nome, escalar: true, jornadaPadrao: false, menor: false, estagiario: false, ferias: [], ...extra }
}

function fn(pessoas: PessoaEscala[]): Funcao {
  return { id: 'atd', nome: 'Atendente', quantidade: pessoas.length, jornadaContratual: '42h', horasSemanaisAtuais: 42, pessoas }
}

function entrada(funcoes: Funcao[], domingo = false): EntradaGerador {
  const empresa: Empresa = {
    nome: 'Loja',
    setor: 'Varejo',
    diasFuncionamento: [domingo, true, true, true, true, true, true],
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
    cobertura: { t1: { util: 2, sab: 2, dom: domingo ? 2 : 0 } },
    feriados: [],
    inicio: '2026-12-20', // domingo
    semanas: 4,
  }
}

const util: HorarioDiaPessoa = { entrada: '08:00', saida: '17:00', intervaloInicio: '12:00', intervaloFim: '13:00' }
const sabado: HorarioDiaPessoa = { entrada: '08:00', saida: '12:00' }
/** Seg–sex 08–17 (12–13), sáb 08–12, dom folga. */
const jornadaAna: (HorarioDiaPessoa | null)[] = [null, util, util, util, util, util, sabado]

/** Por dia da semana (0 = dom): "folga"/"dsr"/... ou "HH:mm–HH:mm/intervalo" do turno. */
function semanaDe(e: Escala, id: string, s = 0): string[] {
  return e.celulas[id].slice(s * 7, s * 7 + 7).map((c) => {
    if (c.tipo !== 'trabalho') return c.tipo
    const t = e.turnos.find((x) => x.id === c.turnoId)!
    return `${t.inicio}–${t.fim}/${t.intervaloMin}`
  })
}

describe('jornada por dia (passo 2)', () => {
  it('horário do dia: bruto, intervalo informado ou mínimo legal; inválido = null', () => {
    expect(horarioDoDiaPessoa(util)).toEqual({ inicio: 480, bruto: 540, intervaloMin: 60 })
    expect(horarioDoDiaPessoa(sabado)).toEqual({ inicio: 480, bruto: 240, intervaloMin: 0 })
    expect(horarioDoDiaPessoa({ entrada: '08:00', saida: '17:00' })!.intervaloMin).toBe(60)
    expect(horarioDoDiaPessoa({ entrada: '22:00', saida: '06:00' })!.bruto).toBe(480)
    expect(horarioDoDiaPessoa({ entrada: '', saida: '17:00' })).toBeNull()
    expect(horarioDoDiaPessoa(null)).toBeNull()
  })

  it('horas da semana = soma das horas líquidas dos dias', () => {
    expect(horasDaJornadaDias(jornadaAna)).toBe(44) // 5 x 8h + 4h
    expect(temJornadaDias({ jornadaDias: jornadaAna })).toBe(true)
    expect(temJornadaDias({ jornadaDias: [null, null, null, null, null, null, null] })).toBe(false)
    expect(temJornadaDias({ jornadaDias: [util] })).toBe(false)
  })

  it('a proposta usa os dias e horários informados, em todos os modelos e semanas', () => {
    const e = entrada([fn([pessoa('ana', 'Ana', { jornadaDias: jornadaAna }), pessoa('bia', 'Bia'), pessoa('caio', 'Caio')])])
    for (const p of gerarPropostas(e)) {
      for (let s = 0; s < 4; s++) {
        const sem = semanaDe(p.escala, 'atd-ana', s)
        expect(sem[0], p.nome).toBe('dsr')
        for (const d of [1, 2, 3, 4, 5]) expect(sem[d], `${p.nome} ${SEMANA[d]}`).toBe('08:00–17:00/60')
        expect(sem[6], p.nome).toBe('08:00–12:00/0')
      }
    }
  })

  it('domingo aberto: quem tem jornada por dia fica fora do rodízio (trabalha ou folga conforme informado)', () => {
    const trabalhaDom: (HorarioDiaPessoa | null)[] = [util, util, util, null, util, util, null]
    const e = entrada(
      [fn([pessoa('ana', 'Ana', { jornadaDias: trabalhaDom }), pessoa('bia', 'Bia'), pessoa('caio', 'Caio'), pessoa('dani', 'Dani')])],
      true,
    )
    for (const p of gerarPropostas(e)) {
      for (let s = 0; s < 4; s++) {
        const sem = semanaDe(p.escala, 'atd-ana', s)
        expect(sem[0], p.nome).toBe('08:00–17:00/60')
        expect(sem[3], p.nome).toMatch(/dsr|folga/)
        expect(sem[6], p.nome).toMatch(/dsr|folga/)
      }
    }
  })

  it('dia com horário incompleto conta como folga', () => {
    const dias: (HorarioDiaPessoa | null)[] = [null, util, { entrada: '08:00', saida: '' }, util, util, util, null]
    const e = entrada([fn([pessoa('ana', 'Ana', { jornadaDias: dias }), pessoa('bia', 'Bia')])])
    const [p] = gerarPropostas(e)
    expect(semanaDe(p.escala, 'atd-ana')[2]).toMatch(/dsr|folga/)
  })

  it('férias continuam valendo sobre a jornada por dia', () => {
    const e = entrada([
      fn([pessoa('ana', 'Ana', { jornadaDias: jornadaAna, ferias: [{ inicio: '2026-12-21', fim: '2026-12-23' }] }), pessoa('bia', 'Bia')]),
    ])
    const [p] = gerarPropostas(e)
    const sem = semanaDe(p.escala, 'atd-ana')
    expect(sem.slice(1, 4)).toEqual(['ausencia', 'ausencia', 'ausencia'])
    expect(sem[4]).toBe('08:00–17:00/60')
  })

  it('jornada inicial: seg–sex no horário da pessoa (ou 08–17 com 12–13), sáb e dom de folga', () => {
    expect(jornadaDiasInicial(pessoa('a', 'A'))).toEqual([null, util, util, util, util, util, null])
    const j = jornadaDiasInicial(pessoa('a', 'A', { entrada: '10:00', saida: '18:00' }))
    expect(j[1]).toEqual({ entrada: '10:00', saida: '18:00' })
    expect(j[6]).toBeNull()
  })

  it('a jornada por dia é salva como edição do usuário e reaplicada', () => {
    const base = [fn([pessoa('ana', 'Ana', { horasSemanais: 42 })])]
    const atual = [fn([pessoa('ana', 'Ana', { horasSemanais: 44, jornadaDias: jornadaAna })])]
    const sob = calcularSobreposicoes(base, atual)
    expect(sob.atd.ana).toEqual({ horasSemanais: 44, jornadaDias: jornadaAna })
    const r = aplicarSobreposicoes(base, JSON.parse(JSON.stringify(sob)))
    expect(r[0].pessoas![0].jornadaDias).toEqual(jornadaAna)
    // Mesma jornada (cópia) não gera edição.
    expect(calcularSobreposicoes(atual, JSON.parse(JSON.stringify(atual)))).toEqual({})
  })
})
