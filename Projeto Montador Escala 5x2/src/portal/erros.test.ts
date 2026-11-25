import { describe, expect, it } from 'vitest'
import { traduzirErro } from './erros'

describe('traduzirErro', () => {
  it('42501 vira Sem acesso', () => {
    expect(traduzirErro({ code: '42501', message: 'x' }).message).toBe('Sem acesso a esta empresa')
  })
  it('outros erros viram mensagem genérica', () => {
    expect(traduzirErro({ code: 'XX', message: 'x' }).message).toBe('Não foi possível carregar os dados da empresa')
    expect(traduzirErro(null).message).toBe('Não foi possível carregar os dados da empresa')
  })
})
