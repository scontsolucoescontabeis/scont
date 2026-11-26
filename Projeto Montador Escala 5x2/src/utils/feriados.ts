/**
 * Acompanha a escala quando a lista de feriados muda depois dela ter sido gerada: quem trabalharia num
 * feriado que acabou de entrar na lista passa a "feriado"; quem estava de "feriado" num dia que saiu da
 * lista volta a trabalhar no horário que faz nesse dia da semana. Folgas, DSR e ausências não mudam.
 */
import { diaDaSemana, somarDias } from '../engine/datas'
import type { DiaEscala, Escala } from '../types'

export function ajustarFeriadosNaEscala(escala: Escala, antes: Iterable<string>, depois: Iterable<string>): Escala {
  const a = new Set(antes)
  const d = new Set(depois)
  const datas = Array.from({ length: escala.dias }, (_, i) => somarDias(escala.inicio, i))
  const novos = datas.map((x, i) => ({ x, i })).filter(({ x }) => d.has(x) && !a.has(x))
  const removidos = datas.map((x, i) => ({ x, i })).filter(({ x }) => a.has(x) && !d.has(x))
  if (novos.length === 0 && removidos.length === 0) return escala

  const celulas: Record<string, DiaEscala[]> = { ...escala.celulas }
  for (const f of escala.funcionarios) {
    const linha = [...(celulas[f.id] ?? [])]
    let mudou = false
    for (const { i } of novos) {
      if (linha[i]?.tipo === 'trabalho') {
        linha[i] = { tipo: 'feriado' }
        mudou = true
      }
    }
    for (const { x, i } of removidos) {
      if (linha[i]?.tipo !== 'feriado') continue
      const dow = diaDaSemana(x)
      const usual =
        linha.find((c, j) => c.tipo === 'trabalho' && diaDaSemana(datas[j]) === dow) ?? linha.find((c) => c.tipo === 'trabalho')
      if (!usual) continue
      linha[i] = { tipo: 'trabalho', turnoId: usual.turnoId }
      mudou = true
    }
    if (mudou) celulas[f.id] = linha
  }
  return { ...escala, celulas }
}
