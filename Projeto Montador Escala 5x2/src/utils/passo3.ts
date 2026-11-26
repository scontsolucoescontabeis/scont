/**
 * Passo 3 (Períodos e cobertura): modelos prontos de períodos, resumo da estimativa de
 * equipe e avisos em linguagem simples (com ação de resolver). Funções puras.
 */
import type { QuadroContratacoes } from '../engine/contratacoes'
import { DIAS_UTEIS, minimoDoDia, minimoMaisComum } from '../engine/minimos'
import type { CoberturaTurno, DiaUtil, Empresa, MinimosDia, Turno } from '../types'
import { horarioDoDia } from './analise'
import { duracaoDia, listarDias } from './passo1'

export type Grupo = 'util' | 'sab' | 'dom'
const ORDEM = [1, 2, 3, 4, 5, 6, 0]
const GRUPOS: Grupo[] = ['util', 'sab', 'dom']

export const grupoDoDia = (d: number): Grupo => (d === 0 ? 'dom' : d === 6 ? 'sab' : 'util')

const minDe = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const hhmm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** Duração de um período (fim <= início: termina no dia seguinte; iguais = 24h). */
const duracaoPeriodo = (t: Pick<Turno, 'inicio' | 'fim'>) => duracaoDia(t.inicio, t.fim) || 1440

// ---------------------------------------------------------------- modelos

export type ModeloPeriodosId = 'dia' | 'manha_tarde'

export const MODELOS_PERIODOS: { id: ModeloPeriodosId; rotulo: string }[] = [
  { id: 'dia', rotulo: 'Um período o dia todo' },
  { id: 'manha_tarde', rotulo: 'Manhã e tarde' },
]

export const MINIMO_PADRAO: MinimosDia = { util: 2, sab: 2, dom: 1 }

/** Janela mais larga de funcionamento: abertura mais cedo → fechamento mais tarde (minutos; fim pode passar de 1440). */
function janelaAberta(empresa: Empresa): { ini: number; fim: number } {
  const abertos = ORDEM.filter((d) => empresa.diasFuncionamento[d])
  const hs = abertos.length > 0 ? abertos.map((d) => horarioDoDia(empresa, d)) : [horarioDoDia(empresa, -1)]
  const ini = Math.min(...hs.map((h) => minDe(h.abre)))
  const fim = Math.max(...hs.map((h) => minDe(h.abre) + (duracaoDia(h.abre, h.fecha) || 1440)))
  return { ini, fim: Math.min(fim, ini + 1440) }
}

export function modeloPeriodos(
  empresa: Empresa,
  modeloId: ModeloPeriodosId,
  minimoAtual: MinimosDia = MINIMO_PADRAO,
): { turnos: Turno[]; cobertura: Record<string, CoberturaTurno> } {
  const dias = empresa.diasFuncionamento
  const aberto: Record<Grupo, boolean> = { util: [1, 2, 3, 4, 5].some((d) => dias[d]), sab: dias[6], dom: dias[0] }
  const minimos: CoberturaTurno = {
    util: aberto.util ? minimoAtual.util : 0,
    sab: aberto.sab ? minimoAtual.sab : 0,
    dom: aberto.dom ? minimoAtual.dom : 0,
  }
  const { ini, fim } = janelaAberta(empresa)
  const faixas: [string, string, number, number][] =
    modeloId === 'dia'
      ? [['periodo-dia', 'Dia todo', ini, fim]]
      : (() => {
          const meio = ini + Math.round((fim - ini) / 2 / 30) * 30
          return [
            ['periodo-manha', 'Manhã', ini, meio],
            ['periodo-tarde', 'Tarde', meio, fim],
          ]
        })()
  const turnos = faixas.map(([id, nome, a, b]) => ({ id, nome, inicio: hhmm(a), fim: hhmm(b), intervaloMin: 0 }))
  const cobertura: Record<string, CoberturaTurno> = {}
  for (const t of turnos) cobertura[t.id] = { ...minimos }
  return { turnos, cobertura }
}

// ---------------------------------------------------------------- estimativa

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`

export function resumoEstimativa(q: QuadroContratacoes): {
  nivel: 'ok' | 'atencao' | 'neutro'
  titulo: string
  detalhe: string
} {
  if (q.turnosSemana === 0) {
    return {
      nivel: 'neutro',
      titulo: 'Estimativa da equipe',
      detalhe: 'Informe o mínimo de pessoas em pelo menos um período para ver de quantas pessoas você precisa.',
    }
  }
  const equivalente =
    Math.abs(q.equipeEquivalente - q.equipeAtual) > 0.05 ? ` (≈ ${fmt1(q.equipeEquivalente)} em tempo integral)` : ''
  const detalhe =
    `Com essa cobertura você precisa de cerca de ${pessoas(q.necessarioTotal)} em tempo integral. ` +
    `Sua equipe tem ${q.equipeAtual}${equivalente}.`
  if (q.contratar > 0) {
    return {
      nivel: 'atencao',
      titulo: `${q.contratar === 1 ? 'Falta' : 'Faltam'} cerca de ${pessoas(q.contratar)}`,
      detalhe,
    }
  }
  return { nivel: 'ok', titulo: 'Sua equipe dá conta dessa cobertura', detalhe }
}

// ---------------------------------------------------------------- avisos

export interface AcaoAviso {
  rotulo: string
  id: 'ajustarAoHorario' | 'adicionarPeriodoLacuna' | 'removerPeriodo'
  turnoId?: string
  dados?: unknown
}

export interface Aviso {
  id: string
  texto: string
  acao?: AcaoAviso
}

export interface DadosLacuna {
  inicio: string
  fim: string
  minimos: MinimosDia
}

export interface EntradaAvisos {
  empresa: Empresa
  turnos: Turno[]
  cobertura: Record<string, CoberturaTurno>
  /** Minutos entre entrada e saída da jornada (maior entre as funções); 0 = não verificar. */
  jornadaMin: number
}

/** O período pede alguém (total ou de alguma função) no dia da semana `d`. */
const exigidoNoDia = (c: CoberturaTurno | undefined, d: number) =>
  !!c && (minimoDoDia(c, d) > 0 || Object.values(c.porFuncao ?? {}).some((m) => minimoDoDia(m, d) > 0))

/** Mínimo próprio (> 0) informado para um dia útil, no total ou em alguma função. */
const temValorProprio = (c: CoberturaTurno | undefined, d: DiaUtil) =>
  !!c && [c, ...Object.values(c.porFuncao ?? {})].some((m) => (m.porDia?.[d] ?? 0) > 0)

const NOME_DIA_UTIL: Record<DiaUtil, string> = {
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
}

/** "Segunda 3 · Terça 2 · Quarta fechada · Quinta 2 · Sexta 4". */
export function descreverMinimosPorDia(m: MinimosDia, diasFuncionamento: boolean[]): string {
  return DIAS_UTEIS.map((d) =>
    diasFuncionamento[d] ? `${NOME_DIA_UTIL[d]} ${minimoDoDia(m, d)}` : `${NOME_DIA_UTIL[d]} fechada`,
  ).join(' · ')
}

/** Mesma regra de antes: abertura mais tarde e fechamento mais cedo entre os dias com exigência. */
export function ajustarTurnoAoHorario(
  empresa: Empresa,
  _turno: Turno,
  c: MinimosDia,
): Pick<Turno, 'inicio' | 'fim'> | null {
  const exigidos = ORDEM.filter((d) => empresa.diasFuncionamento[d] && minimoDoDia(c, d) > 0)
  if (exigidos.length === 0) return null
  const hs = exigidos.map((d) => horarioDoDia(empresa, d))
  return {
    inicio: hs.map((h) => h.abre).reduce((a, b) => (a > b ? a : b)),
    fim: hs.map((h) => h.fecha).reduce((a, b) => (a < b ? a : b)),
  }
}

/** "segunda a sexta, 08:00–18:00; sábado, 08:00–12:00" (dias com o mesmo horário juntos). */
export function descreverHorarios(empresa: Empresa, dias: number[]): string {
  const porHorario = new Map<string, number[]>()
  for (const d of dias) {
    const h = horarioDoDia(empresa, d)
    const k = `${h.abre}–${h.fecha}`
    porHorario.set(k, [...(porHorario.get(k) ?? []), d])
  }
  return [...porHorario.entries()].map(([k, ds]) => `${listarDias(ds)}, ${k}`).join('; ')
}

function cabeNoDia(t: Turno, abre: string, fecha: string): boolean {
  const a = minDe(abre)
  const fimJanela = a + duracaoDia(abre, fecha)
  const pi = minDe(t.inicio)
  const pd = duracaoPeriodo(t)
  return (pi >= a && pi + pd <= fimJanela) || (pi + 1440 >= a && pi + 1440 + pd <= fimJanela)
}

const deDias = (txt: string) => (txt === 'todos os dias' ? 'em todos os dias' : `de ${txt}`)

const NOME_FECHADO: Record<Grupo, string> = {
  util: 'de segunda a sexta',
  sab: 'no sábado',
  dom: 'no domingo',
}
const NOME_FECHADO_DIA: Record<DiaUtil, string> = {
  1: 'na segunda-feira',
  2: 'na terça-feira',
  3: 'na quarta-feira',
  4: 'na quinta-feira',
  5: 'na sexta-feira',
}

export function avisosCobertura(entrada: EntradaAvisos): Aviso[] {
  const { empresa, turnos, cobertura, jornadaMin } = entrada
  const dias = empresa.diasFuncionamento
  const abertos = ORDEM.filter((d) => dias[d])
  const aberto: Record<Grupo, boolean> = { util: [1, 2, 3, 4, 5].some((d) => dias[d]), sab: dias[6], dom: dias[0] }
  const avisos: Aviso[] = []

  // 1. Períodos que passam do horário de funcionamento.
  for (const t of turnos) {
    const c = cobertura[t.id] ?? { util: 0, sab: 0, dom: 0 }
    const fora = abertos.filter((d) => {
      if (minimoDoDia(c, d) <= 0) return false
      const h = horarioDoDia(empresa, d)
      return !cabeNoDia(t, h.abre, h.fecha)
    })
    if (fora.length === 0) continue
    avisos.push({
      id: `fora-${t.id}`,
      texto: `O período "${t.nome}" (${t.inicio}–${t.fim}) passa do horário em que a empresa está aberta (${descreverHorarios(empresa, fora)}).`,
      acao: { rotulo: 'Ajustar ao horário de funcionamento', id: 'ajustarAoHorario', turnoId: t.id },
    })
  }

  // 2. Lacunas: trechos do horário de funcionamento sem nenhum período com exigência.
  const lacunas = new Map<string, { ini: number; fim: number; dias: number[] }>()
  for (const d of abertos) {
    const comExigencia = turnos.filter((t) => {
      const c = cobertura[t.id]
      return !!c && minimoDoDia(c, d) > 0
    })
    if (comExigencia.length === 0) continue
    const h = horarioDoDia(empresa, d)
    const a = minDe(h.abre)
    const fimJanela = a + duracaoDia(h.abre, h.fecha)
    const coberto = (m: number) => {
      const tm = m % 1440
      return comExigencia.some((t) => (tm - minDe(t.inicio) + 1440) % 1440 < duracaoPeriodo(t))
    }
    let m = a
    while (m < fimJanela) {
      if (coberto(m)) {
        m++
        continue
      }
      const ini = m
      while (m < fimJanela && !coberto(m)) m++
      const k = `${hhmm(ini)}-${hhmm(m)}`
      const atual = lacunas.get(k) ?? { ini, fim: m, dias: [] }
      atual.dias.push(d)
      lacunas.set(k, atual)
    }
  }
  for (const [k, l] of lacunas) {
    const inicio = hhmm(l.ini)
    const fim = hhmm(l.fim)
    const gruposDaLacuna = new Set(l.dias.map(grupoDoDia))
    const candidatos = turnos.filter((t) => {
      const c = cobertura[t.id]
      return !!c && l.dias.some((d) => minimoDoDia(c, d) > 0)
    })
    const vizinho =
      candidatos.find((t) => t.fim === inicio) ?? candidatos.find((t) => t.inicio === fim) ?? candidatos[0]
    const cv = vizinho ? cobertura[vizinho.id] : undefined
    // Dias úteis da lacuna: o valor mais comum do vizinho vira o número de segunda a
    // sexta; dias com valor diferente ficam em `porDia`.
    const uteisDaLacuna = l.dias.filter((d) => grupoDoDia(d) === 'util')
    const util = gruposDaLacuna.has('util') ? (cv ? minimoMaisComum(cv, uteisDaLacuna) : 1) : 0
    const minimos: MinimosDia = {
      util,
      sab: gruposDaLacuna.has('sab') ? (cv?.sab ?? 1) : 0,
      dom: gruposDaLacuna.has('dom') ? (cv?.dom ?? 1) : 0,
    }
    if (cv && util > 0) {
      const porDia: Partial<Record<DiaUtil, number>> = {}
      for (const d of uteisDaLacuna as DiaUtil[]) {
        if (minimoDoDia(cv, d) !== util) porDia[d] = minimoDoDia(cv, d)
      }
      if (Object.keys(porDia).length > 0) minimos.porDia = porDia
    }
    const dados: DadosLacuna = { inicio, fim, minimos }
    avisos.push({
      id: `lacuna-${k}`,
      texto: `Das ${inicio} às ${fim} ${deDias(listarDias(l.dias))} ninguém está coberto.`,
      acao: { rotulo: `Criar período para cobrir ${inicio}–${fim}`, id: 'adicionarPeriodoLacuna', dados },
    })
  }

  // 3. Períodos que não pedem ninguém em nenhum dia aberto.
  if (turnos.length > 1) {
    for (const t of turnos) {
      if (abertos.some((d) => exigidoNoDia(cobertura[t.id], d))) continue
      avisos.push({
        id: `vazio-${t.id}`,
        texto: `O período "${t.nome}" não pede ninguém em nenhum dia.`,
        acao: { rotulo: 'Remover período', id: 'removerPeriodo', turnoId: t.id },
      })
    }
  }

  // 4. Jornada maior que o horário de funcionamento do dia.
  if (jornadaMin > 0) {
    const naoCabe = abertos.filter((d) => {
      const h = horarioDoDia(empresa, d)
      return duracaoDia(h.abre, h.fecha) < jornadaMin
    })
    if (naoCabe.length > 0) {
      const hh = Math.floor(jornadaMin / 60)
      const mm = jornadaMin % 60
      const jornada = mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`
      avisos.push({
        id: 'nao-cabe',
        texto: `A jornada de ${jornada} não cabe no horário de ${listarDias(naoCabe)}. Reduza a jornada no Passo 2 ou amplie o horário no Passo 1.`,
      })
    }
  }

  // 5. Dias fechados com exigência.
  const naoVale = (onde: string) =>
    `A empresa fica fechada ${onde}, então o mínimo pedido para esse dia não vale: ninguém será escalado.`
  const diasDoGrupo: Record<Grupo, number[]> = { util: [...DIAS_UTEIS], sab: [6], dom: [0] }
  for (const g of GRUPOS) {
    if (aberto[g]) continue
    if (!turnos.some((t) => diasDoGrupo[g].some((d) => exigidoNoDia(cobertura[t.id], d)))) continue
    avisos.push({ id: `fechado-${g}`, texto: naoVale(NOME_FECHADO[g]) })
  }
  // Com parte da semana aberta, avisa só dos dias úteis fechados com mínimo próprio.
  if (aberto.util) {
    for (const d of DIAS_UTEIS) {
      if (dias[d] || !turnos.some((t) => temValorProprio(cobertura[t.id], d))) continue
      avisos.push({ id: `fechado-${d}`, texto: naoVale(NOME_FECHADO_DIA[d]) })
    }
  }

  return avisos
}

/** Aplica a ação de um aviso; devolve os novos períodos e cobertura. */
export function aplicarAcaoAviso(
  estado: { empresa: Empresa; turnos: Turno[]; cobertura: Record<string, CoberturaTurno> },
  acao: AcaoAviso,
  novoId: string,
): { turnos: Turno[]; cobertura: Record<string, CoberturaTurno> } {
  const { empresa, turnos, cobertura } = estado
  if (acao.id === 'ajustarAoHorario') {
    const t = turnos.find((x) => x.id === acao.turnoId)
    if (!t) return { turnos, cobertura }
    const p = ajustarTurnoAoHorario(empresa, t, cobertura[t.id] ?? { util: 0, sab: 0, dom: 0 })
    if (!p) return { turnos, cobertura }
    return { turnos: turnos.map((x) => (x.id === t.id ? { ...x, ...p } : x)), cobertura }
  }
  if (acao.id === 'adicionarPeriodoLacuna') {
    const d = acao.dados as DadosLacuna
    return {
      turnos: [...turnos, { id: novoId, nome: `Período ${d.inicio}–${d.fim}`, inicio: d.inicio, fim: d.fim, intervaloMin: 0 }],
      cobertura: { ...cobertura, [novoId]: { ...d.minimos } },
    }
  }
  const resto = { ...cobertura }
  delete resto[acao.turnoId ?? '']
  return { turnos: turnos.filter((t) => t.id !== acao.turnoId), cobertura: resto }
}
