/**
 * Passo 1 (Empresa): modelos prontos de funcionamento, resumo em uma linha e validação
 * do horário de cada dia. Funções puras — o componente só exibe.
 */
import type { Empresa } from '../types'
import { horarioDoDia } from './analise'

export const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** Semana começando na segunda (0 = domingo vai para o fim). */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]

export interface ModeloFuncionamento {
  id: string
  rotulo: string
  dias: boolean[]
  abre: string
  fecha: string
}

export const MODELOS_FUNCIONAMENTO: ModeloFuncionamento[] = [
  {
    id: 'comercio',
    rotulo: 'Comércio: segunda a sábado, 8h–18h',
    dias: [false, true, true, true, true, true, true],
    abre: '08:00',
    fecha: '18:00',
  },
  {
    id: 'todos',
    rotulo: 'Todos os dias, 8h–20h',
    dias: [true, true, true, true, true, true, true],
    abre: '08:00',
    fecha: '20:00',
  },
  {
    id: 'util',
    rotulo: 'Segunda a sexta, 8h–18h',
    dias: [false, true, true, true, true, true, false],
    abre: '08:00',
    fecha: '18:00',
  },
]

/** Campos que o modelo muda (dias, horário padrão e limpa os horários por dia). Id desconhecido → {}. */
export function aplicarModeloFuncionamento(empresa: Empresa, modeloId: string): Partial<Empresa> {
  const m = MODELOS_FUNCIONAMENTO.find((x) => x.id === modeloId)
  if (!m) return {}
  const p: Partial<Empresa> = {}
  if (m.dias.some((v, i) => v !== empresa.diasFuncionamento[i])) p.diasFuncionamento = [...m.dias]
  if (empresa.horaAbertura !== m.abre) p.horaAbertura = m.abre
  if (empresa.horaFechamento !== m.fecha) p.horaFechamento = m.fecha
  if (empresa.horarios !== undefined) p.horarios = undefined
  return p
}

/**
 * Lista dias (0 = domingo) de forma compacta: "todos os dias", "segunda a sexta",
 * "sábado e domingo", "sábado" ou "seg, qua, sex".
 */
export function listarDias(dias: number[]): string {
  const ord = ORDEM.filter((d) => dias.includes(d))
  if (ord.length === 0) return ''
  if (ord.length === 7) return 'todos os dias'
  if (ord.length === 1) return DIAS_LONGOS[ord[0]]
  const pos = ord.map((d) => ORDEM.indexOf(d))
  const seguidos = pos.every((p, i) => i === 0 || p === pos[i - 1] + 1)
  if (seguidos && ord.length === 2) return `${DIAS_LONGOS[ord[0]]} e ${DIAS_LONGOS[ord[1]]}`
  if (seguidos) return `${DIAS_LONGOS[ord[0]]} a ${DIAS_LONGOS[ord[ord.length - 1]]}`
  return ord.map((d) => CURTOS[d]).join(', ')
}

const min = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutos abertos no dia; se fecha antes de abrir, fecha no dia seguinte. */
export function duracaoDia(abre: string, fecha: string): number {
  const d = min(fecha) - min(abre)
  return d < 0 ? d + 1440 : d
}

function fmtTotal(m: number): string {
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} horas` : `${h}h${String(r).padStart(2, '0')}`
}

export function resumoFuncionamento(empresa: Empresa): string {
  const abertos = ORDEM.filter((d) => empresa.diasFuncionamento[d])
  if (abertos.length === 0) return 'Marque pelo menos um dia de funcionamento.'
  const total = abertos.reduce((s, d) => {
    const h = horarioDoDia(empresa, d)
    return s + duracaoDia(h.abre, h.fecha)
  }, 0)
  const n = abertos.length
  return `Funciona ${n} ${n === 1 ? 'dia' : 'dias'} por semana (${listarDias(abertos)}), ${fmtTotal(total)} abertas por semana.`
}

export function validarHorarioDia(abre: string, fecha: string): { tipo: 'erro' | 'aviso'; texto: string } | null {
  if (abre === fecha) return { tipo: 'erro', texto: 'Abertura e fechamento estão iguais.' }
  if (min(fecha) < min(abre)) return { tipo: 'aviso', texto: 'Fecha depois da meia-noite (no dia seguinte).' }
  return null
}
