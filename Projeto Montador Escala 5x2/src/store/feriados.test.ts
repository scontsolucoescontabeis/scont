import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Escala } from '../types'
import { ajustarFeriadosNaEscala } from '../utils/feriados'

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

const tipoEm = (e: Escala, fid: string, data: string) => {
  const i = Math.round((Date.parse(data) - Date.parse(e.inicio)) / 86400000)
  return e.celulas[fid][i].tipo
}

describe('ajustarFeriadosNaEscala', () => {
  const escala: Escala = {
    inicio: '2026-12-20',
    dias: 14,
    funcionarios: [{ id: 'f', nome: 'Ana', funcaoId: 'x' }],
    turnos: [{ id: 't', nome: 'T', inicio: '08:00', fim: '17:00', intervaloMin: 60 }],
    celulas: {
      f: [
        { tipo: 'dsr' }, { tipo: 'trabalho', turnoId: 't' }, { tipo: 'trabalho', turnoId: 't' }, { tipo: 'trabalho', turnoId: 't' },
        { tipo: 'trabalho', turnoId: 't' }, { tipo: 'feriado' }, { tipo: 'folga' },
        { tipo: 'dsr' }, { tipo: 'trabalho', turnoId: 't' }, { tipo: 'trabalho', turnoId: 't' }, { tipo: 'trabalho', turnoId: 't' },
        { tipo: 'trabalho', turnoId: 't' }, { tipo: 'trabalho', turnoId: 't' }, { tipo: 'folga' },
      ],
    },
  }
  it('feriado novo vira "feriado" para quem trabalharia; folga e DSR ficam', () => {
    const e = ajustarFeriadosNaEscala(escala, ['2026-12-25'], ['2026-12-25', '2027-01-01', '2026-12-26', '2026-12-20'])
    expect(tipoEm(e, 'f', '2027-01-01')).toBe('feriado') // sexta que era trabalho
    expect(tipoEm(e, 'f', '2026-12-26')).toBe('folga')
    expect(tipoEm(e, 'f', '2026-12-20')).toBe('dsr')
  })
  it('feriado removido volta a trabalho no horário do mesmo dia da semana', () => {
    const e = ajustarFeriadosNaEscala(escala, ['2026-12-25'], [])
    expect(e.celulas.f[5]).toEqual({ tipo: 'trabalho', turnoId: 't' })
  })
  it('sem mudança na lista devolve a mesma escala', () => {
    expect(ajustarFeriadosNaEscala(escala, ['2026-12-25'], ['2026-12-25'])).toBe(escala)
  })
})

describe('atualizarFeriados na store', () => {
  it('feriado acrescentado depois de gerar aparece na escala e nas propostas, sem regerar', async () => {
    const s = await novaStore()
    s.getState().sugerirEscala()
    const antes = s.getState().feriados
    const semNovo = antes.filter((f) => f.data !== '2027-01-02')
    // 02/01/2027 é sábado: o padrão trabalha aos sábados
    s.getState().atualizarFeriados(semNovo)
    s.getState().atualizarFeriados([...semNovo, { data: '2027-01-05', nome: 'Feriado local' }])
    const e = s.getState().escala!
    const fids = e.funcionarios.map((f) => f.id)
    // quem trabalhava na terça 05/01 agora está de feriado; ninguém continua "trabalho" nesse dia
    expect(fids.every((id) => tipoEm(e, id, '2027-01-05') !== 'trabalho')).toBe(true)
    const prop = s.getState().propostas.find((p) => p.id === s.getState().propostaAtivaId)!
    expect(prop.escala).toBe(e) // continua sendo a mesma "versão original"
  })

  it('voltar ao Passo 4 depois de mexer nos feriados não apaga os ajustes manuais', async () => {
    const s = await novaStore()
    s.getState().irParaPasso(3)
    const fid = s.getState().escala!.funcionarios[0].id
    s.getState().setCelula(fid, 1, { tipo: 'ausencia' })
    s.getState().atualizarFeriados([...s.getState().feriados, { data: '2027-01-06', nome: 'Feriado local' }])
    s.getState().irParaPasso(2)
    s.getState().irParaPasso(3)
    expect(s.getState().escala!.celulas[fid][1].tipo).toBe('ausencia')
  })
})
