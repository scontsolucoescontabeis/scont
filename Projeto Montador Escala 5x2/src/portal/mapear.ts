/**
 * Mapeamento puro dos dados do banco (RPC montador_dados_empresa) para a equipe
 * nominal do Montador: `Funcao[]` com `pessoas`.
 */
import { intervaloParaBruto } from '../engine/jornada'
import { minutosDe } from '../engine/datas'
import type { Funcao, PessoaEscala } from '../types'

export interface DadosPortal {
  empresa: { codigo_empresa: string; nome_empresa: string; uf?: string | null; municipio?: string | null } | null
  empregados: {
    codigo_empregado: string
    nome_empregado: string
    cargo: string | null
    tipo_empregado?: string | null
  }[]
  jornadas: {
    codigo_empregado: string
    dia_semana: string | null
    entrada: string | null
    intervalo_inicio: string | null
    intervalo_fim: string | null
    saida: string | null
  }[]
  ferias: { codigo_empregado: string; ferias_inicio: string | null; ferias_fim: string | null }[]
}

const SEM_CARGO = 'Sem cargo'
const BRUTO_MAX_MIN = 16 * 60
const PADRAO_HORAS = 44
const HORAS_MAX = 60

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function slug(chave: string): string {
  return chave.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Chave do grupo = slug do cargo normalizado; vazio (ou só pontuação) vira 'sem-cargo'. */
function chaveCargo(cargo: string | null | undefined): string {
  const k = slug(semAcento((cargo ?? '').trim().toLowerCase()))
  return k === '' ? 'sem-cargo' : k
}

const DIAS = new Set(['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'])

function diaValido(d: string | null | undefined): string | null {
  const k = semAcento((d ?? '').trim().toLowerCase())
  return DIAS.has(k) ? k : null
}

/** Normaliza "HH:mm" ou "HH:mm:ss" para "HH:mm"; null se inválido. */
function hhmm(v: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((v ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

function arred1(n: number): number {
  return Math.round(n * 10) / 10
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : arred1((s[m - 1] + s[m]) / 2)
}

interface DiaValido {
  entrada: string
  saida: string
  liquidoMin: number
  intervaloInformado?: number
}

function calcularDia(r: DadosPortal['jornadas'][number]): DiaValido | null {
  const entrada = hhmm(r.entrada)
  const saida = hhmm(r.saida)
  if (!entrada || !saida) return null
  const e = minutosDe(entrada)
  const s = minutosDe(saida)
  const bruto = Math.min(s <= e ? s + 1440 - e : s - e, BRUTO_MAX_MIN)
  const ii = hhmm(r.intervalo_inicio)
  const fi = hhmm(r.intervalo_fim)
  let informado: number | undefined
  if (ii && fi) {
    const d = (minutosDe(fi) - minutosDe(ii) + 1440) % 1440
    if (d > 0) informado = d
  }
  const intervalo = informado ?? intervaloParaBruto(bruto)
  return { entrada, saida, liquidoMin: Math.max(0, bruto - intervalo), intervaloInformado: informado }
}

function maisComum(xs: number[]): number | undefined {
  const cont = new Map<number, number>()
  let melhor: number | undefined
  for (const x of xs) {
    const c = (cont.get(x) ?? 0) + 1
    cont.set(x, c)
    if (melhor === undefined || c > (cont.get(melhor) ?? 0)) melhor = x
  }
  return melhor
}

function montarPessoa(
  e: DadosPortal['empregados'][number],
  linhas: DadosPortal['jornadas'],
  feriasDe: DadosPortal['ferias'],
): PessoaEscala {
  const porDia = new Map<string, DadosPortal['jornadas'][number]>()
  for (const r of linhas) {
    const d = diaValido(r.dia_semana)
    if (d) porDia.set(d, r)
  }
  const dias = [...porDia.values()].map(calcularDia).filter((d): d is DiaValido => d !== null)

  const ferias = feriasDe
    .filter((f) => f.ferias_inicio && f.ferias_fim && DATA_RE.test(f.ferias_inicio) && DATA_RE.test(f.ferias_fim) && f.ferias_inicio <= f.ferias_fim)
    .map((f) => ({ inicio: f.ferias_inicio as string, fim: f.ferias_fim as string }))
    .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0))

  const base = { id: String(e.codigo_empregado), nome: e.nome_empregado, escalar: true, ferias }
  if (dias.length === 0) return { ...base, jornadaPadrao: true, horasSemanais: PADRAO_HORAS }

  const pessoa: PessoaEscala = {
    ...base,
    jornadaPadrao: false,
    horasSemanais: Math.min(HORAS_MAX, arred1(dias.reduce((a, d) => a + d.liquidoMin, 0) / 60)),
  }
  if (dias.every((d) => d.entrada === dias[0].entrada && d.saida === dias[0].saida)) {
    pessoa.entrada = dias[0].entrada
    pessoa.saida = dias[0].saida
  }
  const intervalo = maisComum(dias.flatMap((d) => (d.intervaloInformado !== undefined ? [d.intervaloInformado] : [])))
  if (intervalo !== undefined) pessoa.intervaloMin = intervalo
  return pessoa
}

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const i of itens) {
    const k = chave(i)
    const l = m.get(k)
    if (l) l.push(i)
    else m.set(k, [i])
  }
  return m
}

export function mapearDadosPortal(d: DadosPortal): { nomeEmpresa: string; funcoes: Funcao[] } {
  const jornadasPor = agrupar(d.jornadas, (r) => String(r.codigo_empregado))
  const feriasPor = agrupar(d.ferias, (r) => String(r.codigo_empregado))
  const grupos = new Map<string, { nome: string; pessoas: PessoaEscala[] }>()

  for (const e of d.empregados) {
    const k = chaveCargo(e.cargo)
    const cod = String(e.codigo_empregado)
    const pessoa = montarPessoa(e, jornadasPor.get(cod) ?? [], feriasPor.get(cod) ?? [])
    const g = grupos.get(k)
    if (g) g.pessoas.push(pessoa)
    else grupos.set(k, { nome: k === 'sem-cargo' ? SEM_CARGO : (e.cargo ?? '').trim(), pessoas: [pessoa] })
  }

  const funcoes: Funcao[] = [...grupos.entries()].map(([k, g]) => {
    const pessoas = [...g.pessoas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    const horas = mediana(pessoas.map((p) => p.horasSemanais ?? PADRAO_HORAS))
    return {
      id: `cargo-${k}`,
      nome: g.nome,
      quantidade: pessoas.filter((p) => p.escalar).length,
      jornadaContratual: `${Math.round(horas)}h semanais`,
      horasSemanaisAtuais: horas,
      pessoas,
    }
  })
  funcoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return { nomeEmpresa: d.empresa?.nome_empresa ?? '', funcoes }
}
