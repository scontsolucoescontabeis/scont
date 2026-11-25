import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DadosPortal } from '../portal/mapear'

const CHAVE = 'scont.montador-escala-5x2.v1:55'
const FN = 'cargo-atendente'
const mem = new Map<string, string>()
const carregarDadosPortal = vi.fn<(codigo: string) => Promise<DadosPortal>>()
vi.mock('../portal/supabase', () => ({ carregarDadosPortal: (c: string) => carregarDadosPortal(c) }))

function dados(entrada: string, nomes: [string, string][] = [['1', 'Ana'], ['2', 'Bia']]): DadosPortal {
  return {
    empresa: { codigo_empresa: '55', nome_empresa: 'ACME' },
    empregados: nomes.map(([c, n]) => ({ codigo_empregado: c, nome_empregado: n, cargo: 'Atendente' })),
    jornadas: nomes.flatMap(([c]) =>
      ['segunda', 'terca', 'quarta', 'quinta', 'sexta'].map((d) => ({
        codigo_empregado: c,
        dia_semana: d,
        entrada,
        intervalo_inicio: '12:00',
        intervalo_fim: '13:00',
        saida: '17:00',
      })),
    ),
    ferias: [],
  }
}

async function novaStore() {
  vi.resetModules()
  const { useStore } = await import('./useStore')
  return useStore
}
type S = Awaited<ReturnType<typeof novaStore>>
const pessoas = (s: S) => s.getState().funcoes[0].pessoas!
const salvo = () => JSON.parse(mem.get(CHAVE) ?? '{}')

beforeEach(() => {
  mem.clear()
  vi.useFakeTimers()
  carregarDadosPortal.mockReset()
  vi.stubGlobal('window', { location: { search: '?empresa=55' } })
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  })
})

describe('carregarDoPortal (store)', () => {
  it('valor novo do banco aparece, edição do usuário persiste e vence, edição igual à nova base some', async () => {
    carregarDadosPortal.mockResolvedValue(dados('08:00'))
    let s = await novaStore()
    await s.getState().carregarDoPortal('55')
    expect(s.getState().empresa.nome).toBe('ACME')
    expect(pessoas(s)[0].entrada).toBe('08:00')
    const f0 = s.getState().funcoes[0]
    s.getState().set({
      funcoes: [{ ...f0, pessoas: [{ ...pessoas(s)[0], entrada: '10:00' }, { ...pessoas(s)[1], escalar: false }] }],
    })
    vi.advanceTimersByTime(400)
    expect(salvo().sobreposicoes).toEqual({ [FN]: { '1': { entrada: '10:00' }, '2': { escalar: false } } })

    carregarDadosPortal.mockResolvedValue(dados('09:00'))
    s = await novaStore()
    await s.getState().carregarDoPortal('55')
    expect(pessoas(s)[0].entrada).toBe('10:00')
    expect(pessoas(s)[1].escalar).toBe(false)
    expect(pessoas(s)[1].entrada).toBe('09:00')
    expect(s.getState().funcoes[0].quantidade).toBe(1)

    carregarDadosPortal.mockResolvedValue(dados('10:00'))
    s = await novaStore()
    await s.getState().carregarDoPortal('55')
    vi.advanceTimersByTime(400)
    expect(salvo().sobreposicoes).toEqual({ [FN]: { '2': { escalar: false } } })
  })

  it('não persiste enquanto carrega (não apaga as sobreposições salvas)', async () => {
    mem.set(CHAVE, JSON.stringify({ sobreposicoes: { [FN]: { '1': { escalar: false } } } }))
    let liberar!: (d: DadosPortal) => void
    carregarDadosPortal.mockReturnValue(new Promise((r) => (liberar = r)))
    const s = await novaStore()
    const p = s.getState().carregarDoPortal('55')
    s.getState().set({ passo: 2 })
    vi.advanceTimersByTime(400)
    expect(salvo().sobreposicoes).toEqual({ [FN]: { '1': { escalar: false } } })
    liberar(dados('08:00'))
    await p
    expect(pessoas(s)[0].escalar).toBe(false)
  })

  it('sem empregados ativos marca nenhumEmpregado', async () => {
    carregarDadosPortal.mockResolvedValue(dados('08:00', []))
    const s = await novaStore()
    await s.getState().carregarDoPortal('55')
    expect(s.getState().portal).toMatchObject({ carregando: false, erro: null, nenhumEmpregado: true })
  })

  it('erro de sessão vira mensagem em portal.erro', async () => {
    carregarDadosPortal.mockRejectedValue(new Error('Sessão expirada'))
    const s = await novaStore()
    await s.getState().carregarDoPortal('55')
    expect(s.getState().portal).toMatchObject({ carregando: false, erro: 'Sessão expirada', nenhumEmpregado: false })
  })

  it('reiniciar limpa o salvo da empresa e recarrega do banco', async () => {
    carregarDadosPortal.mockResolvedValue(dados('08:00'))
    mem.set(CHAVE, JSON.stringify({ sobreposicoes: { [FN]: { '1': { escalar: false } } } }))
    const s = await novaStore()
    await s.getState().carregarDoPortal('55')
    expect(pessoas(s)[0].escalar).toBe(false)
    s.getState().reiniciar()
    await vi.advanceTimersByTimeAsync(400)
    expect(pessoas(s)[0].escalar).toBe(true)
    expect(salvo().sobreposicoes ?? {}).toEqual({})
  })
})
