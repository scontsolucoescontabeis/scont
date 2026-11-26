import { describe, expect, it } from 'vitest'
import { calcularQuadro, type QuadroContratacoes } from '../engine/contratacoes'
import { CUSTO_PADRAO } from '../engine/impacto'
import type { CoberturaTurno, Empresa, Turno } from '../types'
import {
  ajustarTurnoAoHorario,
  aplicarAcaoAviso,
  avisosCobertura,
  descreverMinimosPorDia,
  modeloPeriodos,
  resumoEstimativa,
} from './passo3'

const empresa = (dias: boolean[], abre = '08:00', fecha = '18:00', extra: Partial<Empresa> = {}): Empresa => ({
  nome: 'Padaria Pão Quente',
  setor: 'Comércio',
  diasFuncionamento: dias,
  horaAbertura: abre,
  horaFechamento: fecha,
  funcionaFeriados: false,
  acordoColetivo: 'nao_sei',
  compensacaoDiaria: false,
  ...extra,
})
const cincoDias = [false, true, true, true, true, true, false]
const seisDias = [false, true, true, true, true, true, true]
const seteDias = [true, true, true, true, true, true, true]
const periodo = (id: string, nome: string, inicio: string, fim: string): Turno => ({ id, nome, inicio, fim, intervaloMin: 0 })
const cob = (util: number, sab: number, dom: number): CoberturaTurno => ({ util, sab, dom })

describe('modeloPeriodos', () => {
  it('um período o dia todo, do mais cedo ao mais tarde; mínimo só nos grupos abertos', () => {
    const e = empresa(seisDias, '08:00', '18:00', { horarios: { 6: { abre: '07:00', fecha: '13:00' } } })
    const r = modeloPeriodos(e, 'dia', { util: 3, sab: 2, dom: 1 })
    expect(r.turnos).toHaveLength(1)
    expect(r.turnos[0]).toMatchObject({ inicio: '07:00', fim: '18:00', intervaloMin: 0 })
    expect(r.cobertura[r.turnos[0].id]).toEqual({ util: 3, sab: 2, dom: 0 })
  })

  it('mínimo padrão {2, 2, 1}', () => {
    const r = modeloPeriodos(empresa(seteDias), 'dia')
    expect(r.cobertura[r.turnos[0].id]).toEqual({ util: 2, sab: 2, dom: 1 })
  })

  it('manhã e tarde: divide no meio, a tarde começa onde a manhã termina', () => {
    const r = modeloPeriodos(empresa(cincoDias, '08:00', '18:00'), 'manha_tarde')
    expect(r.turnos.map((t) => [t.nome, t.inicio, t.fim, t.intervaloMin])).toEqual([
      ['Manhã', '08:00', '13:00', 0],
      ['Tarde', '13:00', '18:00', 0],
    ])
    expect(r.cobertura[r.turnos[0].id]).toEqual({ util: 2, sab: 0, dom: 0 })
    expect(r.cobertura[r.turnos[1].id]).toEqual({ util: 2, sab: 0, dom: 0 })
    expect(new Set(r.turnos.map((t) => t.id)).size).toBe(2)
  })

  it('meio arredondado para 30 min', () => {
    // 08:00–17:40 → meio 12:50 → 13:00
    const r = modeloPeriodos(empresa(seisDias, '08:00', '17:40'), 'manha_tarde')
    expect(r.turnos[0].fim).toBe('13:00')
    expect(r.turnos[1].inicio).toBe('13:00')
    // 07:00–18:10 → meio 12:35 → 12:30
    const r2 = modeloPeriodos(empresa(seisDias, '07:00', '18:10'), 'manha_tarde')
    expect(r2.turnos[0].fim).toBe('12:30')
  })

  it('domingo fechado: domingo sem mínimo', () => {
    const r = modeloPeriodos(empresa(seisDias), 'dia', { util: 2, sab: 2, dom: 1 })
    expect(r.cobertura[r.turnos[0].id].dom).toBe(0)
  })

  it('janela que passa da meia-noite', () => {
    const r = modeloPeriodos(empresa(seteDias, '18:00', '02:00'), 'manha_tarde')
    expect(r.turnos.map((t) => [t.inicio, t.fim])).toEqual([
      ['18:00', '22:00'],
      ['22:00', '02:00'],
    ])
    const um = modeloPeriodos(empresa(seteDias, '18:00', '02:00'), 'dia')
    expect([um.turnos[0].inicio, um.turnos[0].fim]).toEqual(['18:00', '02:00'])
  })
})

const quadro = (p: Partial<QuadroContratacoes>): QuadroContratacoes => ({
  etapa: 'etapa1',
  linhasTurno: [],
  turnosSemana: 12,
  necessarioTotal: 3,
  equipeAtual: 4,
  equipeEquivalente: 4,
  contratar: 0,
  extraDomingo: 0,
  porFuncao: [],
  custoMensal: null,
  observacoes: [],
  rotulo: 'ESTIMATIVA',
  ...p,
})

describe('resumoEstimativa', () => {
  it('equipe suficiente → ok', () => {
    const r = resumoEstimativa(quadro({}))
    expect(r.nivel).toBe('ok')
    expect(r.detalhe).toBe('Com essa cobertura você precisa de cerca de 3 pessoas em tempo integral. Sua equipe tem 4.')
  })

  it('faltam pessoas → atenção com K', () => {
    const r = resumoEstimativa(quadro({ necessarioTotal: 6, equipeAtual: 5, equipeEquivalente: 4.5, contratar: 2 }))
    expect(r.nivel).toBe('atencao')
    expect(r.titulo).toBe('Faltam cerca de 2 pessoas')
    expect(r.detalhe).toBe(
      'Com essa cobertura você precisa de cerca de 6 pessoas em tempo integral. Sua equipe tem 5 (≈ 4,5 em tempo integral).',
    )
  })

  it('singular', () => {
    const r = resumoEstimativa(quadro({ necessarioTotal: 1, equipeAtual: 0, equipeEquivalente: 0, contratar: 1 }))
    expect(r.titulo).toBe('Falta cerca de 1 pessoa')
    expect(r.detalhe).toContain('cerca de 1 pessoa em tempo integral')
  })

  it('sem cobertura definida → dica neutra', () => {
    const r = resumoEstimativa(quadro({ turnosSemana: 0, necessarioTotal: 0 }))
    expect(r.nivel).toBe('neutro')
    expect(r.detalhe).toMatch(/mínimo de pessoas/)
  })
})

describe('ajustarTurnoAoHorario', () => {
  it('usa a abertura mais tarde e o fechamento mais cedo dos dias exigidos', () => {
    const e = empresa(seisDias, '08:00', '18:00', { horarios: { 6: { abre: '09:00', fecha: '13:00' } } })
    expect(ajustarTurnoAoHorario(e, periodo('t', 'X', '07:00', '20:00'), cob(1, 1, 0))).toEqual({
      inicio: '09:00',
      fim: '13:00',
    })
    // sábado sem exigência: ignora o horário do sábado
    expect(ajustarTurnoAoHorario(e, periodo('t', 'X', '07:00', '20:00'), cob(1, 0, 0))).toEqual({
      inicio: '08:00',
      fim: '18:00',
    })
  })

  it('nenhum dia exigido → null', () => {
    expect(ajustarTurnoAoHorario(empresa(cincoDias), periodo('t', 'X', '07:00', '20:00'), cob(0, 1, 1))).toBeNull()
  })
})

describe('avisosCobertura', () => {
  const base = { jornadaMin: 0 }

  it('tudo certo → lista vazia', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(cincoDias),
      turnos: [periodo('t1', 'Dia', '08:00', '18:00')],
      cobertura: { t1: cob(2, 0, 0) },
    })
    expect(a).toEqual([])
  })

  it('período fora do horário → ação de ajustar', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(cincoDias),
      turnos: [periodo('t1', 'Dia', '07:00', '18:00')],
      cobertura: { t1: cob(2, 0, 0) },
    })
    expect(a).toHaveLength(1)
    expect(a[0].texto).toBe(
      'O período "Dia" (07:00–18:00) passa do horário em que a empresa está aberta (segunda a sexta, 08:00–18:00).',
    )
    expect(a[0].acao).toEqual({ rotulo: 'Ajustar ao horário de funcionamento', id: 'ajustarAoHorario', turnoId: 't1' })
  })

  it('período dentro de janela que vira a noite não é aviso', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(seteDias, '18:00', '02:00'),
      turnos: [periodo('t1', 'Noite', '18:00', '02:00')],
      cobertura: { t1: cob(1, 1, 1) },
    })
    expect(a).toEqual([])
  })

  it('lacunas agrupadas por horário, com ação de criar período com os mínimos do vizinho', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(seisDias, '08:00', '18:00'),
      turnos: [periodo('t1', 'Dia', '09:00', '18:00')],
      cobertura: { t1: cob(3, 2, 0) },
    })
    expect(a).toHaveLength(1)
    expect(a[0].texto).toBe('Das 08:00 às 09:00 de segunda a sábado ninguém está coberto.')
    expect(a[0].acao).toEqual({
      rotulo: 'Criar período para cobrir 08:00–09:00',
      id: 'adicionarPeriodoLacuna',
      dados: { inicio: '08:00', fim: '09:00', minimos: { util: 3, sab: 2, dom: 0 } },
    })
  })

  it('lacuna só num dia', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(cincoDias, '08:00', '18:00', { horarios: { 1: { abre: '08:00', fecha: '19:00' } } }),
      turnos: [periodo('t1', 'Dia', '08:00', '18:00')],
      cobertura: { t1: cob(2, 0, 0) },
    })
    expect(a.map((x) => x.texto)).toEqual(['Das 18:00 às 19:00 de segunda ninguém está coberto.'])
  })

  it('jornada maior que o horário', () => {
    const e = empresa(seisDias, '08:00', '18:00', { horarios: { 6: { abre: '08:00', fecha: '12:00' } } })
    const a = avisosCobertura({
      jornadaMin: 9 * 60 + 24,
      empresa: e,
      turnos: [periodo('t1', 'Dia', '08:00', '18:00'), periodo('t2', 'Sáb', '08:00', '12:00')],
      cobertura: { t1: cob(2, 0, 0), t2: cob(0, 1, 0) },
    })
    expect(a.map((x) => x.texto)).toEqual([
      'A jornada de 9h24 não cabe no horário de sábado. Reduza a jornada no Passo 2 ou amplie o horário no Passo 1.',
    ])
    expect(a[0].acao).toBeUndefined()
  })

  it('dia fechado com exigência', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(seisDias),
      turnos: [periodo('t1', 'Dia', '08:00', '18:00')],
      cobertura: { t1: cob(2, 2, 1) },
    })
    expect(a.map((x) => x.texto)).toEqual([
      'A empresa fica fechada no domingo, então o mínimo pedido para esse dia não vale: ninguém será escalado.',
    ])
  })

  it('período que não pede ninguém → remover (só se houver outro)', () => {
    const entrada = {
      ...base,
      empresa: empresa(cincoDias),
      turnos: [periodo('t1', 'Dia', '08:00', '18:00'), periodo('t2', 'Extra', '10:00', '12:00')],
      cobertura: { t1: cob(2, 0, 0), t2: cob(0, 0, 0) },
    }
    const a = avisosCobertura(entrada)
    expect(a.map((x) => x.texto)).toEqual(['O período "Extra" não pede ninguém em nenhum dia.'])
    expect(a[0].acao).toEqual({ rotulo: 'Remover período', id: 'removerPeriodo', turnoId: 't2' })
  })

  it('vários problemas juntos, em ordem', () => {
    const a = avisosCobertura({
      jornadaMin: 0,
      empresa: empresa(seisDias),
      turnos: [periodo('t1', 'Dia', '07:00', '17:00')],
      cobertura: { t1: cob(2, 2, 1) },
    })
    expect(a.map((x) => x.id)).toEqual(['fora-t1', 'lacuna-17:00-18:00', 'fechado-dom'])
  })
})

describe('aplicarAcaoAviso', () => {
  const e = empresa(cincoDias)
  const estado = {
    empresa: e,
    turnos: [periodo('t1', 'Dia', '07:00', '17:00')],
    cobertura: { t1: cob(2, 0, 0) },
  }

  it('ajustar ao horário', () => {
    const r = aplicarAcaoAviso(estado, { rotulo: '', id: 'ajustarAoHorario', turnoId: 't1' }, 'novo')
    expect(r.turnos[0]).toMatchObject({ inicio: '08:00', fim: '18:00' })
  })

  it('criar período para a lacuna', () => {
    const r = aplicarAcaoAviso(
      estado,
      {
        rotulo: '',
        id: 'adicionarPeriodoLacuna',
        dados: { inicio: '17:00', fim: '18:00', minimos: { util: 2, sab: 0, dom: 0 } },
      },
      'novo',
    )
    expect(r.turnos[1]).toEqual({ id: 'novo', nome: 'Período 17:00–18:00', inicio: '17:00', fim: '18:00', intervaloMin: 0 })
    expect(r.cobertura.novo).toEqual({ util: 2, sab: 0, dom: 0 })
  })

  it('remover período', () => {
    const r = aplicarAcaoAviso(
      { ...estado, turnos: [...estado.turnos, periodo('t2', 'X', '10:00', '11:00')], cobertura: { ...estado.cobertura, t2: cob(0, 0, 0) } },
      { rotulo: '', id: 'removerPeriodo', turnoId: 't2' },
      'novo',
    )
    expect(r.turnos.map((t) => t.id)).toEqual(['t1'])
    expect(r.cobertura).toEqual({ t1: cob(2, 0, 0) })
  })
})

describe('passo 3 com mínimo por dia da semana', () => {
  const base = { jornadaMin: 0 }
  const porDia = (util: number, dias: Partial<Record<1 | 2 | 3 | 4 | 5, number>>, sab = 0, dom = 0): CoberturaTurno => ({
    util,
    sab,
    dom,
    porDia: dias,
  })

  it('modeloPeriodos continua com um único número de segunda a sexta', () => {
    const r = modeloPeriodos(empresa(cincoDias), 'dia', porDia(2, { 5: 4 }))
    expect(r.cobertura[r.turnos[0].id]).toEqual({ util: 2, sab: 0, dom: 0 })
  })

  it('ajustarTurnoAoHorario considera só os dias úteis com mínimo', () => {
    const e = empresa(cincoDias, '08:00', '18:00', { horarios: { 1: { abre: '10:00', fecha: '14:00' } } })
    expect(ajustarTurnoAoHorario(e, periodo('t', 'X', '07:00', '20:00'), porDia(2, { 1: 0 }))).toEqual({
      inicio: '08:00',
      fim: '18:00',
    })
    expect(ajustarTurnoAoHorario(e, periodo('t', 'X', '07:00', '20:00'), porDia(0, { 5: 2 }))).toEqual({
      inicio: '08:00',
      fim: '18:00',
    })
    expect(ajustarTurnoAoHorario(e, periodo('t', 'X', '07:00', '20:00'), porDia(0, { 1: 2 }))).toEqual({
      inicio: '10:00',
      fim: '14:00',
    })
  })

  it('período fora do horário só nos dias com mínimo', () => {
    const e = empresa(cincoDias, '08:00', '18:00', { horarios: { 1: { abre: '10:00', fecha: '18:00' } } })
    const entrada = (c: CoberturaTurno) => ({ ...base, empresa: e, turnos: [periodo('t1', 'Dia', '08:00', '18:00')], cobertura: { t1: c } })
    expect(avisosCobertura(entrada(porDia(2, { 1: 0 }))).map((a) => a.id)).toEqual([])
    expect(avisosCobertura(entrada(porDia(2, {}))).map((a) => a.id)).toEqual(['fora-t1'])
  })

  it('lacuna por dia: período só da sexta deixa a sexta coberta e o resto não', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(cincoDias),
      turnos: [periodo('t1', 'Dia', '08:00', '18:00'), periodo('t2', 'Reforço', '10:00', '12:00')],
      cobertura: { t1: porDia(0, { 5: 3 }), t2: porDia(1, { 5: 0 }) },
    })
    expect(a.map((x) => x.texto)).toEqual([
      'Das 08:00 às 10:00 de segunda a quinta ninguém está coberto.',
      'Das 12:00 às 18:00 de segunda a quinta ninguém está coberto.',
    ])
    // O novo período copia os mínimos do vizinho nos dias da lacuna.
    expect((a[0].acao?.dados as { minimos: CoberturaTurno }).minimos).toEqual({ util: 1, sab: 0, dom: 0 })
  })

  it('lacuna com mínimos diferentes por dia no vizinho: o novo período guarda os valores de cada dia', () => {
    const a = avisosCobertura({
      ...base,
      empresa: empresa(cincoDias),
      turnos: [periodo('t1', 'Dia', '09:00', '18:00')],
      cobertura: { t1: porDia(2, { 5: 4 }) },
    })
    expect(a.map((x) => x.id)).toEqual(['lacuna-08:00-09:00'])
    expect((a[0].acao?.dados as { minimos: CoberturaTurno }).minimos).toEqual({ util: 2, sab: 0, dom: 0, porDia: { 5: 4 } })
  })

  it('período que só pede gente num dia fechado → vazio', () => {
    const quaFechada = [false, true, true, false, true, true, false]
    const a = avisosCobertura({
      ...base,
      empresa: empresa(quaFechada),
      turnos: [periodo('t1', 'Dia', '08:00', '18:00'), periodo('t2', 'Extra', '10:00', '12:00')],
      cobertura: { t1: cob(2, 0, 0), t2: porDia(0, { 3: 2 }) },
    })
    expect(a.map((x) => x.id)).toEqual(['vazio-t2', 'fechado-3'])
  })

  it('dia útil fechado com mínimo próprio → aviso do dia', () => {
    const quaFechada = [false, true, true, false, true, true, false]
    const a = avisosCobertura({
      ...base,
      empresa: empresa(quaFechada),
      turnos: [periodo('t1', 'Dia', '08:00', '18:00')],
      cobertura: { t1: porDia(2, { 3: 4 }) },
    })
    expect(a.map((x) => x.texto)).toEqual([
      'A empresa fica fechada na quarta-feira, então o mínimo pedido para esse dia não vale: ninguém será escalado.',
    ])
    // Sem porDia, dia útil fechado com o resto aberto não gera aviso (como antes).
    expect(
      avisosCobertura({ ...base, empresa: empresa(quaFechada), turnos: [periodo('t1', 'Dia', '08:00', '18:00')], cobertura: { t1: cob(2, 0, 0) } }),
    ).toEqual([])
  })

  it('descreverMinimosPorDia', () => {
    expect(descreverMinimosPorDia(porDia(2, { 1: 3, 5: 4 }), cincoDias)).toBe(
      'Segunda 3 · Terça 2 · Quarta 2 · Quinta 2 · Sexta 4',
    )
    expect(descreverMinimosPorDia(porDia(2, { 1: 3 }), [false, true, true, false, true, true, false])).toBe(
      'Segunda 3 · Terça 2 · Quarta fechada · Quinta 2 · Sexta 2',
    )
  })

  it('estimativa: só a sexta pedindo 4 faz faltar gente numa equipe que dava conta', () => {
    const e = empresa(seisDias, '08:00', '17:00')
    const turnos = [{ id: 't1', nome: 'Comercial', inicio: '08:00', fim: '17:00', intervaloMin: 60 }]
    const fns = [{ id: 'a', nome: 'Atendente', quantidade: 3, jornadaContratual: '44h' as const, horasSemanaisAtuais: 44 }]
    const q = (c: CoberturaTurno) => calcularQuadro({ empresa: e, funcoes: fns, turnos, cobertura: { t1: c }, custo: CUSTO_PADRAO }, 'etapa1')
    expect(resumoEstimativa(q(cob(2, 2, 0))).nivel).toBe('ok')
    expect(resumoEstimativa(q(porDia(2, { 5: 4 }, 2))).nivel).toBe('atencao')
  })
})
