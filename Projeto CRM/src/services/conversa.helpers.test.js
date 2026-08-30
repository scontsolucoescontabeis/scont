import { describe, it, expect } from 'vitest'
import { normalizarTelefone, escolherConversaAberta } from './conversa.helpers'

describe('normalizarTelefone', () => {
  it('remove tudo que não é dígito', () => {
    expect(normalizarTelefone('+55 (61) 99354-3223')).toBe('5561993543223')
  })

  it('devolve string vazia para entrada nula ou indefinida', () => {
    expect(normalizarTelefone(null)).toBe('')
    expect(normalizarTelefone(undefined)).toBe('')
  })
})

describe('escolherConversaAberta', () => {
  const abrir = (status, aberto_em) => ({ id: status + aberto_em, status, aberto_em })

  it('retorna a conversa aberta mais recente', () => {
    const conversas = [
      abrir('ABERTA', '2026-08-01T10:00:00Z'),
      abrir('EM_ATENDIMENTO', '2026-08-20T10:00:00Z'),
      abrir('AGUARDANDO', '2026-08-10T10:00:00Z'),
    ]
    expect(escolherConversaAberta(conversas).id).toBe('EM_ATENDIMENTO2026-08-20T10:00:00Z')
  })

  it('ignora conversas encerradas', () => {
    const conversas = [
      abrir('ENCERRADA', '2026-08-25T10:00:00Z'),
      abrir('ABERTA', '2026-08-05T10:00:00Z'),
    ]
    expect(escolherConversaAberta(conversas).status).toBe('ABERTA')
  })

  it('retorna null quando não há nenhuma conversa aberta', () => {
    expect(escolherConversaAberta([abrir('ENCERRADA', '2026-08-25T10:00:00Z')])).toBeNull()
    expect(escolherConversaAberta([])).toBeNull()
    expect(escolherConversaAberta(null)).toBeNull()
  })
})
