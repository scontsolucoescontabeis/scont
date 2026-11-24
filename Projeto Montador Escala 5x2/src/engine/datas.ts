/** Utilitários de data puros, em UTC, sobre strings YYYY-MM-DD (sem fuso/DST). */

const MS_DIA = 86_400_000

export function paraUTC(data: string): number {
  const [a, m, d] = data.split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

export function deUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function somarDias(data: string, n: number): string {
  return deUTC(paraUTC(data) + n * MS_DIA)
}

export function diffDias(a: string, b: string): number {
  return Math.round((paraUTC(b) - paraUTC(a)) / MS_DIA)
}

/** 0 = domingo ... 6 = sábado */
export function diaDaSemana(data: string): number {
  return new Date(paraUTC(data)).getUTCDay()
}

/** Segunda-feira da semana (ISO) que contém a data. */
export function segundaDaSemana(data: string): string {
  const dow = diaDaSemana(data)
  return somarDias(data, -((dow + 6) % 7))
}

export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function hhmmDe(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Domingo que abre a semana (domingo a sábado) que contém a data. */
export function domingoDaSemana(data: string): string {
  return somarDias(data, -diaDaSemana(data))
}
