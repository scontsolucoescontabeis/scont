import { describe, expect, it } from 'vitest'
import type { Funcao, PessoaEscala } from '../types'
import { aplicarSobreposicoes, calcularSobreposicoes, chaveArmazenamento, deveMostrarConteudo, empresaDoPortal } from './modo'

const pessoa = (o: Partial<PessoaEscala> & { id: string }): PessoaEscala => ({
  nome: `Nome ${o.id}`,
  escalar: true,
  jornadaPadrao: true,
  horasSemanais: 44,
  ferias: [],
  ...o,
})
const funcao = (id: string, pessoas: PessoaEscala[]): Funcao => ({
  id,
  nome: id,
  quantidade: pessoas.filter((p) => p.escalar).length,
  jornadaContratual: '44h semanais',
  horasSemanaisAtuais: 44,
  pessoas,
})

describe('empresaDoPortal', () => {
  it('lê ?empresa=', () => {
    expect(empresaDoPortal('?empresa=123')).toBe('123')
    expect(empresaDoPortal('?x=1&empresa=77')).toBe('77')
    expect(empresaDoPortal('empresa=9')).toBe('9')
  })
  it('vazio ou ausente vira null', () => {
    expect(empresaDoPortal('')).toBeNull()
    expect(empresaDoPortal('?x=1')).toBeNull()
    expect(empresaDoPortal('?empresa=')).toBeNull()
    expect(empresaDoPortal('?empresa=%20%20')).toBeNull()
  })
  it('apara espaços', () => {
    expect(empresaDoPortal('?empresa=%20123%20')).toBe('123')
  })
})

describe('chaveArmazenamento', () => {
  it('chaves exatas', () => {
    expect(chaveArmazenamento(null)).toBe('scont.montador-escala-5x2.v1')
    expect(chaveArmazenamento('123')).toBe('scont.montador-escala-5x2.v1:123')
  })
  it('chaves de duas empresas diferem', () => {
    expect(chaveArmazenamento('1')).not.toBe(chaveArmazenamento('2'))
    expect(chaveArmazenamento('1')).not.toBe(chaveArmazenamento(null))
  })
})


describe('calcularSobreposicoes / aplicarSobreposicoes', () => {
  const base = () => [
    funcao('a', [pessoa({ id: '1', entrada: '08:00', saida: '17:00' }), pessoa({ id: '2' })]),
    funcao('b', [pessoa({ id: '9' })]),
  ]
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

  it('só registra campos que diferem; omite quem não mudou', () => {
    const atual = clone(base())
    atual[0].pessoas![0].escalar = false
    atual[0].pessoas![0].horasSemanais = 40
    expect(calcularSobreposicoes(base(), atual)).toEqual({ a: { '1': { escalar: false, horasSemanais: 40 } } })
    expect(calcularSobreposicoes(base(), clone(base()))).toEqual({})
  })
  it('campo limpo vira null e é reaplicado como ausente', () => {
    const atual = clone(base())
    delete atual[0].pessoas![0].entrada
    const sob = calcularSobreposicoes(base(), atual)
    expect(sob).toEqual({ a: { '1': { entrada: null } } })
    expect(aplicarSobreposicoes(base(), sob)[0].pessoas![0].entrada).toBeUndefined()
  })
  it('campo definido onde o banco não tinha é registrado', () => {
    const atual = clone(base())
    atual[0].pessoas![1].intervaloMin = 90
    expect(calcularSobreposicoes(base(), atual)).toEqual({ a: { '2': { intervaloMin: 90 } } })
  })
  it('ignora pessoas e funções que saíram do banco', () => {
    const r = aplicarSobreposicoes(base(), { a: { '77': { escalar: false } }, zz: { '1': { escalar: false } } })
    expect(r).toEqual(aplicarSobreposicoes(base(), undefined))
  })
  it('recalcula quantidade e preserva nome/id/ferias/jornadaPadrao do banco', () => {
    const b = base()
    b[0].pessoas![0].ferias = [{ inicio: '2026-12-01', fim: '2026-12-05' }]
    const r = aplicarSobreposicoes(b, { a: { '1': { escalar: false, horasSemanais: 30 } } })
    expect(r[0].quantidade).toBe(1)
    expect(r[0].pessoas![0]).toMatchObject({ id: '1', nome: 'Nome 1', jornadaPadrao: true, horasSemanais: 30 })
    expect(r[0].pessoas![0].ferias).toEqual(b[0].pessoas![0].ferias)
  })
  it('não muta a base', () => {
    const b = base()
    const copia = clone(b)
    aplicarSobreposicoes(b, { a: { '1': { escalar: false } } })
    expect(b).toEqual(copia)
  })
  it('idempotente', () => {
    const sob = { a: { '1': { escalar: false, entrada: null, horasSemanais: 36 }, '2': { intervaloMin: 45 } } }
    expect(calcularSobreposicoes(base(), aplicarSobreposicoes(base(), sob))).toEqual(sob)
  })
})

describe('deveMostrarConteudo', () => {
  const base = { codigo: '1', carregando: false, erro: null, nenhumEmpregado: false }
  it('avulso (null) mostra; portal oculta enquanto carrega ou em erro', () => {
    expect(deveMostrarConteudo(null)).toBe(true)
    expect(deveMostrarConteudo(base)).toBe(true)
    const vazio = { ...base, nenhumEmpregado: true }
    expect(deveMostrarConteudo(vazio)).toBe(true)
    expect(deveMostrarConteudo({ ...base, carregando: true })).toBe(false)
    expect(deveMostrarConteudo({ ...base, erro: 'falhou' })).toBe(false)
  })
})
