/**
 * Camada de persistência isolada. Hoje usa localStorage; para trocar por
 * Supabase, reimplemente `carregar`/`salvar`/`limpar` mantendo a assinatura
 * (podem passar a ser assíncronas).
 */
const CHAVE = 'scont.montador-escala-5x2.v1'

export function carregar<T>(): T | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as T) : null
  } catch {
    return null
  }
}

export function salvar<T>(dados: T): boolean {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados))
    return true
  } catch {
    return false
  }
}

export function limpar(): void {
  try {
    localStorage.removeItem(CHAVE)
  } catch {
    /* sem armazenamento disponível */
  }
}
