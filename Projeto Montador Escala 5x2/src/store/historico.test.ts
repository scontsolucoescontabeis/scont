import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('desfazer/refazer na store', () => {
  it('duas edições e dois desfazer devolvem a escala original (mesma referência)', async () => {
    const s = await novaStore()
    s.getState().sugerirEscala()
    const original = s.getState().escala!
    const fid = original.funcionarios[0].id
    expect(s.getState().historico.passado).toHaveLength(0)

    s.getState().setCelula(fid, 0, { tipo: 'ausencia' })
    const depoisDe1 = s.getState().escala!
    s.getState().trocarCelulas({ f: fid, d: 1 }, { f: original.funcionarios[1].id, d: 1 })
    expect(s.getState().historico.passado).toHaveLength(2)

    s.getState().desfazer()
    expect(s.getState().escala).toBe(depoisDe1)
    s.getState().desfazer()
    expect(s.getState().escala).toBe(original)
    expect(s.getState().historico.futuro).toHaveLength(2)

    s.getState().refazer()
    expect(s.getState().escala).toBe(depoisDe1)
  })

  it('corrigir passa pelo histórico; sugerir/usar proposta/reiniciar limpam o histórico', async () => {
    const s = await novaStore()
    s.getState().sugerirEscala()
    const fid = s.getState().escala!.funcionarios[0].id
    s.getState().corrigir([{ funcionarioId: fid, dia: 2, novo: { tipo: 'folga' } }])
    expect(s.getState().historico.passado).toHaveLength(1)

    s.getState().sugerirEscala()
    expect(s.getState().historico).toEqual({ passado: [], futuro: [] })

    s.getState().setCelula(fid, 0, { tipo: 'folga' })
    s.getState().usarProposta(s.getState().propostas[1].id)
    expect(s.getState().historico.passado).toHaveLength(0)

    s.getState().setCelula(fid, 0, { tipo: 'folga' })
    s.getState().irParaPasso(3)
    expect(s.getState().historico.passado).toHaveLength(0)

    s.getState().setCelula(fid, 0, { tipo: 'folga' })
    s.getState().reiniciar()
    expect(s.getState().historico.passado).toHaveLength(0)
  })

  it('desfazer sem histórico não faz nada', async () => {
    const s = await novaStore()
    s.getState().sugerirEscala()
    const e = s.getState().escala
    s.getState().desfazer()
    s.getState().refazer()
    expect(s.getState().escala).toBe(e)
  })

  it('correção automática geral é desfazível e devolve os alertas de antes e depois', async () => {
    const s = await novaStore()
    s.getState().sugerirEscala()
    const original = s.getState().escala!
    const fid = original.funcionarios[0].id
    // 7 dias de trabalho seguidos: cria alertas que o motor sabe corrigir
    const turno = original.turnos[0].id
    for (let d = 0; d < 7; d++) s.getState().setCelula(fid, d, { tipo: 'trabalho', turnoId: turno })
    const editada = s.getState().escala!
    const r = s.getState().corrigirAutomaticamente()
    expect(r.antes.length).toBeGreaterThan(0)
    expect(r.depois.length).toBeLessThan(r.antes.length)
    s.getState().desfazer()
    expect(s.getState().escala).toBe(editada)
  })
})

describe('navegação entre passos preserva os ajustes manuais', () => {
  it('voltar ao Passo 4 sem mudar os dados mantém a escala editada (o histórico de desfazer zera ao trocar de passo)', async () => {
    const s = await novaStore()
    s.getState().irParaPasso(3)
    const fid = s.getState().escala!.funcionarios[0].id
    s.getState().setCelula(fid, 0, { tipo: 'ausencia' })
    const editada = s.getState().escala!
    s.getState().irParaPasso(2)
    s.getState().irParaPasso(3)
    expect(s.getState().escala).toBe(editada)
    expect(s.getState().historico.passado).toHaveLength(0)
    s.getState().irParaPasso(3)
    expect(s.getState().escala).toBe(editada)
  })

  it('mudar um dado dos passos 1-3 regera a escala (ajustes anteriores saem)', async () => {
    const s = await novaStore()
    s.getState().irParaPasso(3)
    const fid = s.getState().escala!.funcionarios[0].id
    s.getState().setCelula(fid, 0, { tipo: 'ausencia' })
    const editada = s.getState().escala!
    s.getState().setEmpresa({ funcionaFeriados: !s.getState().empresa.funcionaFeriados })
    s.getState().irParaPasso(3)
    expect(s.getState().escala).not.toBe(editada)
    expect(s.getState().historico.passado).toHaveLength(0)
  })

  it('sem escala gerada, abrir o Passo 4 gera uma', async () => {
    const s = await novaStore()
    expect(s.getState().escala).toBeNull()
    s.getState().irParaPasso(3)
    expect(s.getState().escala).not.toBeNull()
  })
})
