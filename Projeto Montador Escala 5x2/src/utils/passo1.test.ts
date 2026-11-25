import { describe, expect, it } from 'vitest'
import type { Empresa } from '../types'
import { aplicarModeloFuncionamento, listarDias, resumoFuncionamento, validarHorarioDia } from './passo1'

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
const nenhum = [false, false, false, false, false, false, false]

describe('aplicarModeloFuncionamento', () => {
  const comHorarios = empresa(cincoDias, '09:00', '17:00', { horarios: { 6: { abre: '08:00', fecha: '12:00' } } })

  it('comércio: segunda a sábado, 8h–18h, e limpa os horários por dia', () => {
    const p = aplicarModeloFuncionamento(comHorarios, 'comercio')
    const r = { ...comHorarios, ...p }
    expect(r.diasFuncionamento).toEqual(seisDias)
    expect(r.horaAbertura).toBe('08:00')
    expect(r.horaFechamento).toBe('18:00')
    expect(r.horarios).toBeUndefined()
    expect('horarios' in p).toBe(true)
  })

  it('todos os dias, 8h–20h', () => {
    const r = { ...comHorarios, ...aplicarModeloFuncionamento(comHorarios, 'todos') }
    expect(r.diasFuncionamento).toEqual(seteDias)
    expect(r.horaAbertura).toBe('08:00')
    expect(r.horaFechamento).toBe('20:00')
    expect(r.horarios).toBeUndefined()
  })

  it('segunda a sexta, 8h–18h', () => {
    const r = { ...comHorarios, ...aplicarModeloFuncionamento(comHorarios, 'util') }
    expect(r.diasFuncionamento).toEqual(cincoDias)
    expect(r.horaAbertura).toBe('08:00')
    expect(r.horaFechamento).toBe('18:00')
    expect(r.horarios).toBeUndefined()
  })

  it('devolve só os campos que mudam', () => {
    const p = aplicarModeloFuncionamento(empresa(cincoDias, '08:00', '17:00'), 'util')
    expect(p).toEqual({ horaFechamento: '18:00' })
  })

  it('modelo desconhecido → {}', () => {
    expect(aplicarModeloFuncionamento(comHorarios, 'xyz')).toEqual({})
  })
})

describe('listarDias', () => {
  it('formas compactas', () => {
    expect(listarDias([1, 2, 3, 4, 5])).toBe('segunda a sexta')
    expect(listarDias([1, 2, 3, 4, 5, 6])).toBe('segunda a sábado')
    expect(listarDias([0, 1, 2, 3, 4, 5, 6])).toBe('todos os dias')
    expect(listarDias([1, 3, 5])).toBe('seg, qua, sex')
    expect(listarDias([6])).toBe('sábado')
    expect(listarDias([6, 0])).toBe('sábado e domingo')
    expect(listarDias([])).toBe('')
  })
})

describe('resumoFuncionamento', () => {
  it('5 dias', () => {
    expect(resumoFuncionamento(empresa(cincoDias))).toBe(
      'Funciona 5 dias por semana (segunda a sexta), 50 horas abertas por semana.',
    )
  })

  it('6 dias com sábado mais curto', () => {
    const e = empresa(seisDias, '08:00', '18:00', { horarios: { 6: { abre: '08:00', fecha: '12:00' } } })
    expect(resumoFuncionamento(e)).toBe('Funciona 6 dias por semana (segunda a sábado), 54 horas abertas por semana.')
  })

  it('6 dias, 8h–18h → 60 horas', () => {
    expect(resumoFuncionamento(empresa(seisDias))).toBe(
      'Funciona 6 dias por semana (segunda a sábado), 60 horas abertas por semana.',
    )
  })

  it('7 dias', () => {
    expect(resumoFuncionamento(empresa(seteDias, '08:00', '20:00'))).toBe(
      'Funciona 7 dias por semana (todos os dias), 84 horas abertas por semana.',
    )
  })

  it('dias salteados e meia hora', () => {
    const e = empresa([false, true, false, true, false, true, false], '08:00', '12:30')
    expect(resumoFuncionamento(e)).toBe('Funciona 3 dias por semana (seg, qua, sex), 13h30 abertas por semana.')
  })

  it('um dia só', () => {
    expect(resumoFuncionamento(empresa([false, false, false, false, false, false, true]))).toBe(
      'Funciona 1 dia por semana (sábado), 10 horas abertas por semana.',
    )
  })

  it('fecha depois da meia-noite', () => {
    expect(resumoFuncionamento(empresa(cincoDias, '18:00', '02:00'))).toBe(
      'Funciona 5 dias por semana (segunda a sexta), 40 horas abertas por semana.',
    )
  })

  it('nenhum dia aberto', () => {
    expect(resumoFuncionamento(empresa(nenhum))).toBe('Marque pelo menos um dia de funcionamento.')
  })
})

describe('validarHorarioDia', () => {
  it('horários iguais → erro', () => {
    expect(validarHorarioDia('08:00', '08:00')).toEqual({ tipo: 'erro', texto: 'Abertura e fechamento estão iguais.' })
  })
  it('fecha antes de abrir → aviso de virada da noite', () => {
    expect(validarHorarioDia('18:00', '02:00')).toEqual({
      tipo: 'aviso',
      texto: 'Fecha depois da meia-noite (no dia seguinte).',
    })
  })
  it('ok → null', () => {
    expect(validarHorarioDia('08:00', '18:00')).toBeNull()
  })
})
