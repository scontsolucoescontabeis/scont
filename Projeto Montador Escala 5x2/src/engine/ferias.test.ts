import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Escala, Funcao, ModeloEscala, PessoaEscala, Turno } from '../types'
import { validarEscala } from './conformidade'
import { diasDeFerias } from './ferias'
import { coberturaParaRegras, gerarEscala, type EntradaGerador } from './gerador'

const MODELOS: ModeloEscala[] = ['fixo', 'rodizio_domingo', 'folga_movel']
const turnos: Turno[] = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 }]

function pessoa(id: string, nome: string, ferias: PessoaEscala['ferias'] = []): PessoaEscala {
  return { id, nome, escalar: true, jornadaPadrao: true, menor: false, estagiario: false, ferias }
}

function fnc(pessoas?: PessoaEscala[], quantidade = 3): Funcao {
  return { id: 'atd', nome: 'Atendente', quantidade, jornadaContratual: '44h', horasSemanaisAtuais: 44, pessoas }
}

function entrada(funcoes: Funcao[], abreDomingo = false, cob: CoberturaTurno = { util: 1, sab: 1, dom: 0 }): EntradaGerador {
  const empresa: Empresa = {
    nome: 'Loja',
    setor: 'Varejo',
    diasFuncionamento: [abreDomingo, true, true, true, true, true, true],
    horaAbertura: '08:00',
    horaFechamento: '17:00',
    funcionaFeriados: false,
    acordoColetivo: 'nao',
    compensacaoDiaria: false,
  }
  return { empresa, funcoes, turnos, cobertura: { t1: cob }, feriados: [], inicio: '2026-12-20', semanas: 5 }
}

function validar(e: EntradaGerador, escala: Escala) {
  return validarEscala({
    escala,
    cobertura: coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento),
    feriados: e.feriados,
    empresaFuncionaFeriados: e.empresa.funcionaFeriados,
    periodos: e.turnos,
    compensacaoDiaria: false,
  })
}

const indicesAusencia = (esc: Escala, fid: string) =>
  esc.celulas[fid].flatMap((c, i) => (c.tipo === 'ausencia' ? [i] : []))
const intervalo = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k)

describe('diasDeFerias', () => {
  it('vazio quando não há férias', () => {
    expect([...diasDeFerias('2026-12-20', 35, [])]).toEqual([])
  })
  it('limites inclusivos', () => {
    expect([...diasDeFerias('2026-12-20', 35, [{ inicio: '2026-12-28', fim: '2027-01-06' }])].sort((a, b) => a - b)).toEqual(
      intervalo(8, 17),
    )
    expect([...diasDeFerias('2026-12-20', 35, [{ inicio: '2026-12-22', fim: '2026-12-22' }])]).toEqual([2])
  })
  it('recorta férias que começam antes ou terminam depois da janela', () => {
    expect([...diasDeFerias('2026-12-20', 35, [{ inicio: '2026-11-01', fim: '2026-12-22' }])].sort((a, b) => a - b)).toEqual([0, 1, 2])
    expect([...diasDeFerias('2026-12-20', 35, [{ inicio: '2027-01-20', fim: '2027-03-01' }])].sort((a, b) => a - b)).toEqual(
      intervalo(31, 34),
    )
  })
  it('fora da janela não marca nada', () => {
    expect(diasDeFerias('2026-12-20', 35, [{ inicio: '2026-01-01', fim: '2026-12-19' }]).size).toBe(0)
    expect(diasDeFerias('2026-12-20', 35, [{ inicio: '2027-01-24', fim: '2027-02-01' }]).size).toBe(0)
  })
  it('ignora períodos inválidos', () => {
    expect(diasDeFerias('2026-12-20', 35, [{ inicio: '2026-12-30', fim: '2026-12-25' }]).size).toBe(0)
    expect(diasDeFerias('2026-12-20', 35, [{ inicio: 'abc', fim: '2026-12-25' }]).size).toBe(0)
    expect(diasDeFerias('2026-12-20', 35, [{ inicio: '2026-12-21', fim: '' }]).size).toBe(0)
  })
  it('vários períodos se somam', () => {
    const s = diasDeFerias('2026-12-20', 35, [
      { inicio: '2026-12-21', fim: '2026-12-22' },
      { inicio: '2026-12-22', fim: '2026-12-23' },
      { inicio: '2027-01-01', fim: '2027-01-01' },
    ])
    expect([...s].sort((a, b) => a - b)).toEqual([1, 2, 3, 12])
  })
})

describe('férias na escala', () => {
  const equipe = (ferias: PessoaEscala['ferias']) => [
    fnc([pessoa('p1', 'Ana', ferias), pessoa('p2', 'Bia'), pessoa('p3', 'Caio')]),
  ]

  it('marca ausência nas datas de férias', () => {
    for (const m of MODELOS) {
      const esc = gerarEscala(entrada(equipe([{ inicio: '2026-12-28', fim: '2027-01-06' }])), m)
      expect(indicesAusencia(esc, 'atd-p1'), m).toEqual(intervalo(8, 17))
      expect(indicesAusencia(esc, 'atd-p2'), m).toEqual([])
    }
  })

  it('férias começam antes da janela', () => {
    const esc = gerarEscala(entrada(equipe([{ inicio: '2026-12-01', fim: '2026-12-23' }])), 'fixo')
    expect(indicesAusencia(esc, 'atd-p1')).toEqual(intervalo(0, 3))
  })

  it('férias terminam depois da janela', () => {
    const esc = gerarEscala(entrada(equipe([{ inicio: '2027-01-20', fim: '2027-02-20' }])), 'fixo')
    expect(indicesAusencia(esc, 'atd-p1')).toEqual(intervalo(31, 34))
  })

  it('férias fora da janela não mudam nada', () => {
    for (const m of MODELOS) {
      const sem = gerarEscala(entrada(equipe([])), m)
      const fora = gerarEscala(entrada(equipe([{ inicio: '2027-03-01', fim: '2027-03-30' }])), m)
      expect(fora, m).toEqual(sem)
    }
  })

  it('semana inteira de férias não gera dsr nem folga', () => {
    for (const m of MODELOS) {
      const esc = gerarEscala(entrada(equipe([{ inicio: '2026-12-27', fim: '2027-01-02' }]), true, { util: 1, sab: 1, dom: 1 }), m)
      const semana = esc.celulas['atd-p1'].slice(7, 14)
      expect(semana.every((c) => c.tipo === 'ausencia'), m).toBe(true)
      // As outras semanas seguem com 2 repousos.
      for (const s of [0, 2, 3, 4]) {
        const rep = esc.celulas['atd-p1'].slice(s * 7, s * 7 + 7).filter((c) => c.tipo === 'dsr' || c.tipo === 'folga')
        expect(rep.length, `${m} semana ${s}`).toBe(2)
      }
    }
  })

  it('férias parciais: a pessoa ainda recebe 2 repousos nos dias restantes (ou o possível)', () => {
    for (const m of MODELOS) {
      // Ausente seg–qua (índices 8–10): restam dom, qui, sex, sáb → 2 repousos.
      const esc = gerarEscala(entrada(equipe([{ inicio: '2026-12-28', fim: '2026-12-30' }]), true, { util: 1, sab: 1, dom: 1 }), m)
      const semana = esc.celulas['atd-p1'].slice(7, 14)
      expect(semana.filter((c) => c.tipo === 'ausencia').length, m).toBe(3)
      expect(semana.filter((c) => c.tipo === 'dsr' || c.tipo === 'folga').length, m).toBe(2)
      expect(semana.filter((c) => c.tipo === 'dsr').length, m).toBe(1)
      // Ausente seg–sex (índices 8–12): restam dom e sáb → no máximo 1 repouso, nunca 2.
      const esc2 = gerarEscala(entrada(equipe([{ inicio: '2026-12-28', fim: '2027-01-01' }]), true, { util: 1, sab: 1, dom: 1 }), m)
      const sem2 = esc2.celulas['atd-p1'].slice(7, 14)
      const rep2 = sem2.filter((c) => c.tipo === 'dsr' || c.tipo === 'folga').length
      expect(rep2, m).toBe(1)
      expect(sem2.filter((c) => c.tipo === 'trabalho').length, m).toBe(1)
    }
  })

  it('ausência na semana não quebra a trava de 6 dias seguidos nem a de domingo', () => {
    const cob = { util: 2, sab: 2, dom: 2 }
    const casos: PessoaEscala['ferias'][] = [
      [{ inicio: '2026-12-28', fim: '2026-12-30' }],
      [{ inicio: '2026-12-24', fim: '2026-12-26' }],
      [{ inicio: '2027-01-01', fim: '2027-01-04' }],
      [{ inicio: '2026-12-21', fim: '2027-01-08' }],
    ]
    for (const ferias of casos) {
      for (const m of MODELOS) {
        const e = entrada(equipe(ferias), true, cob)
        const esc = gerarEscala(e, m)
        const r = validar(e, esc)
        const ids = r.alertas.map((a) => a.regraId)
        expect(ids.filter((id) => id === 'diasConsecutivosMax' || id === 'domingoRodizio'), `${m} ${ferias[0].inicio}`).toEqual([])
        // Nenhuma sequência de trabalho passa de 6 dias, para ninguém.
        for (const f of esc.funcionarios) {
          let run = 0
          for (const c of esc.celulas[f.id]) {
            run = c.tipo === 'trabalho' ? run + 1 : 0
            expect(run).toBeLessThanOrEqual(6)
          }
        }
      }
    }
  })

  it('pessoa de férias no domingo do rodízio não é escalada e outro empregado cobre', () => {
    // Domingo 2026-12-27 = índice 7. Ana de férias só nesse dia.
    for (const ferias of [[{ inicio: '2026-12-27', fim: '2026-12-27' }], [{ inicio: '2026-12-26', fim: '2027-01-03' }]]) {
      const e = entrada(equipe(ferias), true, { util: 1, sab: 1, dom: 1 })
      const esc = gerarEscala(e, 'rodizio_domingo')
      expect(esc.celulas['atd-p1'][7].tipo).toBe('ausencia')
      const trabalhando = esc.funcionarios.filter((f) => esc.celulas[f.id][7].tipo === 'trabalho')
      expect(trabalhando.length).toBeGreaterThanOrEqual(1)
      expect(trabalhando.map((f) => f.id)).not.toContain('atd-p1')
      expect(validar(e, esc).alertas.filter((a) => a.regraId === 'cobertura' && a.data === '2026-12-27')).toEqual([])
    }
  })

  it('cobertura insuficiente por férias gera alerta de cobertura mencionando a ausência (regraId inalterado "cobertura")', () => {
    const e = entrada([fnc([pessoa('p1', 'Ana', [{ inicio: '2026-12-28', fim: '2027-01-01' }]), pessoa('p2', 'Bia')])], false, {
      util: 2,
      sab: 0,
      dom: 0,
    })
    const esc = gerarEscala(e, 'fixo')
    const r = validar(e, esc)
    const doDia = r.alertas.filter((a) => a.data === '2026-12-29')
    expect(doDia.length).toBeGreaterThan(0)
    for (const a of doDia) {
      expect(a.regraId).toBe('cobertura')
      expect(a.mensagem).toMatch(/fica abaixo do mínimo/)
      expect(a.mensagem).toMatch(/ausência \(férias\/atestado\) de: Ana/)
      expect(a.mensagem).not.toMatch(/Bia/)
      expect(a.mensagem).toMatch(/\(regra: cobertura\)$/)
    }
    // Dias sem férias não citam ausência.
    expect(r.alertas.filter((a) => a.regraId === 'cobertura' && /férias/.test(a.mensagem) && a.data! < '2026-12-28')).toEqual([])
  })

  it('sem férias, resultado idêntico ao de antes', () => {
    for (const abre of [false, true]) {
      for (const m of MODELOS) {
        const cob = { util: 2, sab: 2, dom: abre ? 1 : 0 }
        // Equipe nominal: com ferias vazio vs sem o campo.
        const semCampo = [fnc([pessoa('p1', 'Ana'), pessoa('p2', 'Bia'), pessoa('p3', 'Caio'), pessoa('p4', 'Duda')])]
        semCampo[0].pessoas!.forEach((p) => delete (p as Partial<PessoaEscala>).ferias)
        const comVazio = [fnc([pessoa('p1', 'Ana'), pessoa('p2', 'Bia'), pessoa('p3', 'Caio'), pessoa('p4', 'Duda')])]
        const a = gerarEscala(entrada(comVazio, abre, cob), m)
        const b = gerarEscala(entrada(semCampo, abre, cob), m)
        expect(a.celulas).toEqual(b.celulas)
        expect(a.turnos).toEqual(b.turnos)
        expect(a.funcionarios).toEqual(b.funcionarios)
        // Modo avulso (sem pessoas): instantâneo gravado com o motor antes das férias.
        const avulso = gerarEscala(entrada([fnc(undefined, 5)], abre, cob), m)
        expect(avulso).toMatchSnapshot(`avulso abre=${abre} ${m}`)
        expect(a).toMatchSnapshot(`nominal abre=${abre} ${m}`)
      }
    }
  })
})
