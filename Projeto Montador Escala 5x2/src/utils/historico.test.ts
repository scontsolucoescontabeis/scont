import { describe, expect, it } from 'vitest'
import { LIMITE_HISTORICO, desfazer, limpar, refazer, registrar } from './historico'

describe('histórico de desfazer/refazer', () => {
  it('limpar() começa vazio', () => {
    expect(limpar()).toEqual({ passado: [], futuro: [] })
  })

  it('desfazer e refazer com histórico vazio retornam null', () => {
    expect(desfazer(limpar(), 'a')).toBeNull()
    expect(refazer(limpar(), 'a')).toBeNull()
  })

  it('ida e volta: registrar, desfazer e refazer', () => {
    let h = registrar(limpar(), 'a') // estava 'a', agora 'b'
    h = registrar(h, 'b') // estava 'b', agora 'c'
    const d1 = desfazer(h, 'c')!
    expect(d1.valor).toBe('b')
    const d2 = desfazer(d1.h, 'b')!
    expect(d2.valor).toBe('a')
    expect(desfazer(d2.h, 'a')).toBeNull()
    const r1 = refazer(d2.h, 'a')!
    expect(r1.valor).toBe('b')
    const r2 = refazer(r1.h, 'b')!
    expect(r2.valor).toBe('c')
    expect(refazer(r2.h, 'c')).toBeNull()
    expect(r2.h.passado).toEqual(['a', 'b'])
  })

  it('uma edição nova apaga o que dava para refazer', () => {
    let h = registrar(limpar(), 'a')
    const d = desfazer(h, 'b')!
    expect(d.h.futuro).toEqual(['b'])
    h = registrar(d.h, 'a')
    expect(h.futuro).toEqual([])
    expect(refazer(h, 'x')).toBeNull()
  })

  it('guarda no máximo 50 passos (descarta os mais antigos)', () => {
    expect(LIMITE_HISTORICO).toBe(50)
    let h = limpar<number>()
    for (let i = 0; i < 60; i++) h = registrar(h, i)
    expect(h.passado).toHaveLength(50)
    expect(h.passado[0]).toBe(10)
    expect(h.passado[49]).toBe(59)
  })

  it('não altera o histórico recebido (imutável)', () => {
    const h = registrar(limpar(), 'a')
    const copia = JSON.parse(JSON.stringify(h))
    registrar(h, 'b')
    desfazer(h, 'b')
    expect(h).toEqual(copia)
  })
})
