import { describe, it, expect } from 'vitest'
import { normalizarLinhas } from './ModalImportarPlanilha'

describe('normalizarLinhas', () => {
  it('marca linha sem telefone como erro', () => {
    const resultado = normalizarLinhas([{ nome: 'João', telefone: '' }])
    expect(resultado[0].status).toBe('erro')
  })

  it('remove caracteres não-numéricos do telefone', () => {
    const resultado = normalizarLinhas([{ nome: 'Maria', telefone: '(61) 9 9999-1111' }])
    expect(resultado[0].telefone).toBe('61999991111')
    expect(resultado[0].status).toBe('novo_contato')
  })

  it('converte campos opcionais vazios para null', () => {
    const resultado = normalizarLinhas([{ nome: 'Ana', telefone: '5561888881111', empresa: '' }])
    expect(resultado[0].empresa).toBeNull()
    expect(resultado[0].cargo).toBeNull()
  })

  it('preserva empresa quando preenchida', () => {
    const resultado = normalizarLinhas([{ nome: 'Bob', telefone: '5521988882222', empresa: 'ACME', cargo: 'Sócio' }])
    expect(resultado[0].empresa).toBe('ACME')
    expect(resultado[0].cargo).toBe('Sócio')
  })

  it('inicializa conflictId, contatoId e acao como null', () => {
    const resultado = normalizarLinhas([{ nome: 'X', telefone: '5561999991111' }])
    expect(resultado[0].conflictId).toBeNull()
    expect(resultado[0].contatoId).toBeNull()
    expect(resultado[0].acao).toBeNull()
  })

  it('atribui idx sequencial', () => {
    const resultado = normalizarLinhas([
      { nome: 'A', telefone: '5561111111111' },
      { nome: 'B', telefone: '5562222222222' },
    ])
    expect(resultado[0].idx).toBe(0)
    expect(resultado[1].idx).toBe(1)
  })
})
