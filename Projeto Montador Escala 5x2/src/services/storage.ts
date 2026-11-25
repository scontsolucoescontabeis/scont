/**
 * Camada de persistência isolada. Hoje usa localStorage; para trocar por
 * Supabase, reimplemente `carregar`/`salvar`/`limpar` mantendo a assinatura
 * (podem passar a ser assíncronas). No modo portal (`?empresa=<codigo>`) o
 * estado é guardado por empresa.
 */
import { chaveArmazenamento, empresaDoPortal } from '../portal/modo'

function chave(): string {
  const search = typeof window === 'undefined' ? '' : window.location.search
  return chaveArmazenamento(empresaDoPortal(search))
}

export function carregar<T>(): T | null {
  try {
    const bruto = localStorage.getItem(chave())
    return bruto ? (JSON.parse(bruto) as T) : null
  } catch {
    return null
  }
}

export function salvar<T>(dados: T): boolean {
  try {
    localStorage.setItem(chave(), JSON.stringify(dados))
    return true
  } catch {
    return false
  }
}

export function limpar(): void {
  try {
    localStorage.removeItem(chave())
  } catch {
    /* sem armazenamento disponível */
  }
}
