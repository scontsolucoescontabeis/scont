import { describe, it, expect } from 'vitest'
import { resolverQrCodeSrc } from './ConexaoWhatsAppPage'

describe('resolverQrCodeSrc', () => {
  it('mantém strings já no formato data URI', () => {
    const src = resolverQrCodeSrc('data:image/png;base64,ABC123')
    expect(src).toBe('data:image/png;base64,ABC123')
  })

  it('adiciona o prefixo data URI quando vier base64 puro', () => {
    const src = resolverQrCodeSrc('ABC123')
    expect(src).toBe('data:image/png;base64,ABC123')
  })

  it('retorna null quando não há QR Code', () => {
    expect(resolverQrCodeSrc(null)).toBeNull()
    expect(resolverQrCodeSrc(undefined)).toBeNull()
  })
})
