/**
 * Cálculos do relatório (PDF/Excel): horas por semana, sequências e repousos por
 * empregado, resumo dos alertas e presença por dia. Funções puras.
 */
import { REGRAS, etapaVigente, limitesDaEtapa, type RegrasLegais } from '../config/regras'
import { fmtHoras, horasLiquidasMin } from '../engine/conformidade'
import { NSLOTS, perfilNecessidade } from '../engine/gerador'
import { minutosDe, somarDias } from '../engine/datas'
import type { CoberturaTurno, DiaEscala, Empresa, Escala, ResultadoConformidade, Turno } from '../types'

const ehRepouso = (c: DiaEscala | undefined) => c?.tipo === 'folga' || c?.tipo === 'dsr'

/** Minutos do horário entre 22h e 5h (CLT, trabalho noturno urbano). */
export function minutosNoturnos(t: Turno): number {
  const ini = minutosDe(t.inicio)
  const fim = ini + ((minutosDe(t.fim) - ini + 1440) % 1440 || 1440)
  let n = 0
  for (let m = ini; m < fim; m++) {
    const h = m % 1440
    if (h >= 22 * 60 || h < 5 * 60) n++
  }
  return n
}

export interface ResumoEmpregado {
  funcionarioId: string
  nome: string
  jornadaDiaria: string
  intervalo: string
  /** Horas líquidas de cada semana completa (domingo a sábado). */
  horasSemana: number[]
  /** Teto semanal da etapa vigente em cada semana. */
  tetoSemana: number[]
  maiorSequencia: number
  /** Minutos por dia trabalhados entre 22h e 5h (maior valor entre os horários usados). */
  minutosNoturnosDia: number
  semanasRepousoSeguido: number
  semanasCompletas: number
}

export function resumoPorEmpregado(escala: Escala, regras: RegrasLegais = REGRAS): ResumoEmpregado[] {
  const turnos = new Map(escala.turnos.map((t) => [t.id, t]))
  const semanas = Math.floor(escala.dias / 7)
  return escala.funcionarios.map((f) => {
    const cels = escala.celulas[f.id]
    const usados = new Map<string, Turno>()
    let seq = 0
    let maior = 0
    cels.forEach((c) => {
      if (c.tipo === 'trabalho') {
        seq += 1
        maior = Math.max(maior, seq)
        const t = c.turnoId ? turnos.get(c.turnoId) : undefined
        if (t) usados.set(t.id, t)
      } else seq = 0
    })
    const lista = [...usados.values()]
    const jornadas = [...new Set(lista.map((t) => fmtHoras(horasLiquidasMin(t))))]
    const intervalos = [...new Set(lista.map((t) => `${t.intervaloMin} min`))]
    const horasSemana: number[] = []
    const tetoSemana: number[] = []
    let seguidos = 0
    for (let w = 0; w < semanas; w++) {
      const sem = cels.slice(w * 7, w * 7 + 7)
      horasSemana.push(
        sem.reduce((s, c) => {
          const t = c.tipo === 'trabalho' && c.turnoId ? turnos.get(c.turnoId) : undefined
          return s + (t ? horasLiquidasMin(t) : 0)
        }, 0) / 60,
      )
      tetoSemana.push(limitesDaEtapa(etapaVigente(somarDias(escala.inicio, w * 7 + 6), regras), regras).jornadaSemanalMax)
      const rep = sem.map((c, k) => (ehRepouso(c) ? k : -1)).filter((k) => k >= 0)
      if (rep.length >= 2) {
        const a = rep[0]
        const b = rep[rep.length - 1]
        const anteriorSab = w > 0 && ehRepouso(cels[w * 7 - 1])
        const proximoDom = w < semanas - 1 && ehRepouso(cels[w * 7 + 7])
        if (rep.some((k, i) => i > 0 && k - rep[i - 1] === 1) || (a === 0 && anteriorSab) || (b === 6 && proximoDom)) {
          seguidos += 1
        }
      }
    }
    return {
      funcionarioId: f.id,
      nome: f.nome,
      jornadaDiaria: jornadas.join(' / ') || '—',
      intervalo: intervalos.join(' / ') || '—',
      horasSemana,
      tetoSemana,
      maiorSequencia: maior,
      minutosNoturnosDia: Math.max(0, ...lista.map(minutosNoturnos)),
      semanasRepousoSeguido: seguidos,
      semanasCompletas: semanas,
    }
  })
}

export function textoHorasSemana(r: ResumoEmpregado): { horas: string; teto: string } {
  const fmt = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)}h`
  const max = r.horasSemana.length ? Math.max(...r.horasSemana) : 0
  const tetos = [...new Set(r.tetoSemana)]
  return { horas: r.horasSemana.length ? `máx. ${fmt(max)}` : '—', teto: tetos.map((t) => `${t}h`).join(' → ') || '—' }
}

export interface LinhaAlertas {
  nivel: 'vermelho' | 'amarelo'
  titulo: string
  quantidade: number
}

export function resumoAlertas(r: ResultadoConformidade): LinhaAlertas[] {
  const mapa = new Map<string, LinhaAlertas>()
  for (const a of r.alertas) {
    const k = `${a.severidade}|${a.titulo}`
    const l = mapa.get(k) ?? { nivel: a.severidade, titulo: a.titulo, quantidade: 0 }
    l.quantidade += 1
    mapa.set(k, l)
  }
  return [...mapa.values()].sort((a, b) =>
    a.nivel === b.nivel ? b.quantidade - a.quantidade : a.nivel === 'vermelho' ? -1 : 1,
  )
}

export interface PresencaDia {
  /** Pessoas por horário de trabalho em cada dia da escala. */
  porTurno: { turno: Turno; contagem: number[] }[]
  total: number[]
  /** Pico de pessoas exigido pela cobertura do estabelecimento em cada dia. */
  exigido: number[]
}

export function presencaPorDia(
  escala: Escala,
  empresa: Empresa,
  periodos: Turno[],
  cobertura: Record<string, CoberturaTurno>,
): PresencaDia {
  const perfil = perfilNecessidade(empresa, periodos, cobertura)
  const total = Array<number>(escala.dias).fill(0)
  const exigido = Array.from({ length: escala.dias }, (_, i) => {
    const dow = (new Date(`${somarDias(escala.inicio, i)}T00:00:00Z`).getUTCDay())
    return Math.max(0, ...perfil[dow].slice(0, NSLOTS))
  })
  const porTurno = escala.turnos.map((turno) => ({ turno, contagem: Array<number>(escala.dias).fill(0) }))
  for (const f of escala.funcionarios) {
    escala.celulas[f.id].forEach((c, i) => {
      if (c.tipo !== 'trabalho') return
      total[i] += 1
      const l = porTurno.find((x) => x.turno.id === c.turnoId)
      if (l) l.contagem[i] += 1
    })
  }
  return { porTurno, total, exigido }
}

/** Datas da escala anteriores à vigência da 1ª etapa. */
export function diasPreVigencia(datas: string[], regras: RegrasLegais = REGRAS): string[] {
  return datas.filter((d) => d < regras.etapa1.inicio)
}
