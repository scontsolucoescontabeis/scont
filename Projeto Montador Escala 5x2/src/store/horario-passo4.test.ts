import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Escala } from '../types'

vi.mock('../portal/supabase', () => ({ carregarDadosPortal: vi.fn() }))

async function novaStore() {
  vi.resetModules()
  const { useStore } = await import('./useStore')
  return useStore
}

beforeEach(() => {
  vi.useFakeTimers()
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  })
})

const horariosDe = (e: Escala, fid: string) =>
  new Set(
    e.celulas[fid].flatMap((c) => {
      if (c.tipo !== 'trabalho') return []
      const t = e.turnos.find((x) => x.id === c.turnoId)!
      return [`${t.inicio}–${t.fim}`]
    }),
  )

describe('passo 4: alterar o horário de trabalho refaz a escala', () => {
  it('definirHorario fixa o horário em todos os dias e regenera; null volta ao automático', async () => {
    const s = await novaStore()
    s.getState().set({ incluirContratacoes: false })
    s.getState().sugerirEscala()
    const antes = s.getState().escala!
    const fid = antes.funcionarios[0].id

    s.getState().definirHorario(fid, { entrada: '09:30', saida: '18:30', intervaloMin: 60 })
    const depois = s.getState().escala!
    expect(depois).not.toBe(antes)
    expect([...horariosDe(depois, fid)]).toEqual(['09:30–18:30'])
    expect(s.getState().horariosPasso4[fid]).toEqual({ entrada: '09:30', saida: '18:30', intervaloMin: 60 })

    s.getState().definirHorario(fid, null)
    expect(s.getState().horariosPasso4[fid]).toBeUndefined()
    expect(horariosDe(s.getState().escala!, fid).has('09:30–18:30')).toBe(false)
  })

  it('trocar o horário de um dia trabalhado no calendário vira horário fixo e regenera', async () => {
    const s = await novaStore()
    s.getState().set({ incluirContratacoes: false })
    s.getState().sugerirEscala()
    let e = s.getState().escala!
    // garante um segundo horário disponível: fixa outra pessoa num horário diferente
    const [a, b] = e.funcionarios
    s.getState().definirHorario(b.id, { entrada: '10:00', saida: '18:00', intervaloMin: 60 })
    e = s.getState().escala!
    const turnoB = e.turnos.find((t) => t.inicio === '10:00')!
    const dia = e.celulas[a.id].findIndex((c) => c.tipo === 'trabalho' && c.turnoId !== turnoB.id)
    expect(dia).toBeGreaterThanOrEqual(0)

    s.getState().setCelula(a.id, dia, { tipo: 'trabalho', turnoId: turnoB.id })
    const nova = s.getState().escala!
    expect([...horariosDe(nova, a.id)]).toEqual(['10:00–18:00'])
    expect(s.getState().horariosPasso4[a.id]).toMatchObject({ entrada: '10:00', saida: '18:00' })
  })

  it('folga ↔ trabalho no mesmo horário continua sendo ajuste do dia (sem regenerar)', async () => {
    const s = await novaStore()
    s.getState().set({ incluirContratacoes: false })
    s.getState().sugerirEscala()
    const e = s.getState().escala!
    const fid = e.funcionarios[0].id
    const dia = e.celulas[fid].findIndex((c) => c.tipo === 'trabalho')
    s.getState().setCelula(fid, dia, { tipo: 'folga' })
    expect(s.getState().escala!.celulas[fid][dia].tipo).toBe('folga')
    expect(s.getState().historico.passado).toHaveLength(1)
    expect(s.getState().horariosPasso4).toEqual({})
  })
})
