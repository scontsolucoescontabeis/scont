import { describe, expect, it } from 'vitest'
import type { Funcao } from '../types'
import { jornadaDaFuncao } from './jornada'

const F: Funcao = { id: 'f', nome: 'Atendente', quantidade: 1, jornadaContratual: '44h semanais', horasSemanaisAtuais: 44 }

describe('intervalo intrajornada parametrizável', () => {
  it('sem parâmetro usa o mínimo legal (60 min)', () => {
    expect(jornadaDaFuncao(F, 42).intervaloMin).toBe(60)
  })
  it('com parâmetro mantém a jornada líquida e soma o intervalo informado', () => {
    const j = jornadaDaFuncao({ ...F, intervaloMin: 90 }, 42)
    expect(j.intervaloMin).toBe(90)
    expect(j.bruto).toBe(504 + 90)
  })
  it('aceita intervalo zero informado', () => {
    expect(jornadaDaFuncao({ ...F, intervaloMin: 0 }, 42).bruto).toBe(504)
  })
})
