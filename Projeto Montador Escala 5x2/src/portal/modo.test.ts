import { describe, expect, it } from 'vitest'
import type { Funcao, PessoaEscala } from '../types'
import { chaveArmazenamento, empresaDoPortal, mesclarEstadoSalvo } from './modo'

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

describe('mesclarEstadoSalvo', () => {
  it('sem estado salvo devolve a base', () => {
    const base = [funcao('a', [pessoa({ id: '1' })])]
    expect(mesclarEstadoSalvo(base, undefined)).toEqual(base)
  })
  it('reaplica edições do usuário por funcao.id e pessoa.id', () => {
    const base = [funcao('a', [pessoa({ id: '1' }), pessoa({ id: '2' })])]
    const salvas = [
      funcao('a', [
        pessoa({ id: '1', escalar: false, horasSemanais: 40, entrada: '09:00', saida: '18:00', intervaloMin: 90 }),
        pessoa({ id: '2' }),
      ]),
    ]
    const r = mesclarEstadoSalvo(base, salvas)
    expect(r[0].pessoas![0]).toMatchObject({ escalar: false, horasSemanais: 40, entrada: '09:00', saida: '18:00', intervaloMin: 90 })
    expect(r[0].pessoas![1]).toEqual(base[0].pessoas![1])
  })
  it('descarta pessoas ausentes do banco e mantém novas', () => {
    const base = [funcao('a', [pessoa({ id: '2' }), pessoa({ id: '3', nome: 'Nova' })])]
    const salvas = [funcao('a', [pessoa({ id: '1' }), pessoa({ id: '2', escalar: false })])]
    const r = mesclarEstadoSalvo(base, salvas)
    expect(r[0].pessoas!.map((p) => p.id)).toEqual(['2', '3'])
    expect(r[0].pessoas![0].escalar).toBe(false)
    expect(r[0].pessoas![1]).toEqual(base[0].pessoas![1])
  })
  it('não toma nome, id, ferias nem jornadaPadrao do salvo', () => {
    const feriasBanco = [{ inicio: '2026-12-01', fim: '2026-12-10' }]
    const base = [funcao('a', [pessoa({ id: '1', nome: 'Do Banco', ferias: feriasBanco, jornadaPadrao: false })])]
    const salvas = [funcao('a', [pessoa({ id: '1', nome: 'Antigo', ferias: [], jornadaPadrao: true, escalar: false })])]
    const p = mesclarEstadoSalvo(base, salvas)[0].pessoas![0]
    expect(p.nome).toBe('Do Banco')
    expect(p.id).toBe('1')
    expect(p.ferias).toEqual(feriasBanco)
    expect(p.jornadaPadrao).toBe(false)
  })
  it('recalcula quantidade pelas pessoas a escalar', () => {
    const base = [funcao('a', [pessoa({ id: '1' }), pessoa({ id: '2' }), pessoa({ id: '3' })])]
    const salvas = [funcao('a', [pessoa({ id: '1', escalar: false }), pessoa({ id: '2' }), pessoa({ id: '3' })])]
    expect(mesclarEstadoSalvo(base, salvas)[0].quantidade).toBe(2)
  })
  it('funcao ausente nas salvas fica como na base; edição igual à base é no-op', () => {
    const base = [funcao('a', [pessoa({ id: '1' })]), funcao('b', [pessoa({ id: '9' })])]
    const salvas = [funcao('a', [pessoa({ id: '1' })])]
    expect(mesclarEstadoSalvo(base, salvas)).toEqual(base)
  })
  it('não muta a base', () => {
    const base = [funcao('a', [pessoa({ id: '1' })])]
    const copia = JSON.parse(JSON.stringify(base))
    mesclarEstadoSalvo(base, [funcao('a', [pessoa({ id: '1', escalar: false })])])
    expect(base).toEqual(copia)
  })
  it('campos opcionais ausentes no salvo mantêm o valor da base', () => {
    const base = [funcao('a', [pessoa({ id: '1', entrada: '08:00', saida: '17:00' })])]
    const salvas = [funcao('a', [pessoa({ id: '1' })])]
    const p = mesclarEstadoSalvo(base, salvas)[0].pessoas![0]
    expect(p.entrada).toBe('08:00')
    expect(p.saida).toBe('17:00')
  })
})
