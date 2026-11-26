/**
 * Histórico imutável para Desfazer/Refazer. `passado` guarda os estados
 * anteriores (o último é o mais recente); `futuro` guarda o que dá para refazer
 * (o primeiro é o próximo).
 */
export interface Historico<T> {
  passado: T[]
  futuro: T[]
}

export const LIMITE_HISTORICO = 50

export function limpar<T>(): Historico<T> {
  return { passado: [], futuro: [] }
}

/** Registra o estado ANTERIOR a uma edição. Uma edição nova apaga o que dava para refazer. */
export function registrar<T>(h: Historico<T>, atual: T): Historico<T> {
  return { passado: [...h.passado, atual].slice(-LIMITE_HISTORICO), futuro: [] }
}

export function desfazer<T>(h: Historico<T>, atual: T): { h: Historico<T>; valor: T } | null {
  if (h.passado.length === 0) return null
  const valor = h.passado[h.passado.length - 1]
  return { valor, h: { passado: h.passado.slice(0, -1), futuro: [atual, ...h.futuro] } }
}

export function refazer<T>(h: Historico<T>, atual: T): { h: Historico<T>; valor: T } | null {
  if (h.futuro.length === 0) return null
  const [valor, ...resto] = h.futuro
  return { valor, h: { passado: [...h.passado, atual].slice(-LIMITE_HISTORICO), futuro: resto } }
}
