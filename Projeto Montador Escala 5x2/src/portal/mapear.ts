/**
 * Mapeamento puro dos dados do banco (RPC montador_dados_empresa) para a equipe
 * nominal do Montador: `Funcao[]` com `pessoas`.
 */
import { REGRAS_PESSOAIS_PADRAO } from '../config/regras'
import type { Funcao, PessoaEscala, RegrasPessoais } from '../types'

export interface DadosPortal {
  empresa: { codigo_empresa: string; nome_empresa: string; uf?: string | null; municipio?: string | null } | null
  empregados: {
    codigo_empregado: string
    nome_empregado: string
    cargo: string | null
    tipo_empregado?: string | null
    sexo?: string | null
    menor_de_idade?: boolean | null
  }[]
  /** Ainda devolvido pela RPC, mas ignorado: o horário não vem mais do banco. */
  jornadas?: {
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
/** Horas por semana pré-preenchidas no passo 2 (ajustáveis por pessoa). */
export const PADRAO_HORAS = 42

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

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/

function arred1(n: number): number {
  return Math.round(n * 10) / 10
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : arred1((s[m - 1] + s[m]) / 2)
}

function montarPessoa(
  e: DadosPortal['empregados'][number],
  feriasDe: DadosPortal['ferias'],
  regras: RegrasPessoais,
): PessoaEscala {
  const ferias = feriasDe
    .filter((f) => f.ferias_inicio && f.ferias_fim && DATA_RE.test(f.ferias_inicio) && DATA_RE.test(f.ferias_fim) && f.ferias_inicio <= f.ferias_fim)
    .map((f) => ({ inicio: f.ferias_inicio as string, fim: f.ferias_fim as string }))
    .sort((a, b) => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0))

  const sexoNorm = (e.sexo ?? '').trim().toUpperCase()
  const estagiario = semAcento((e.tipo_empregado ?? '').trim().toLowerCase()).startsWith('estag')
  // Horas e horário não vêm mais das tabelas de jornada do RH: todos começam com
  // PADRAO_HORAS (estagiário: limite do estágio) e sem entrada/saída fixas.
  return {
    id: String(e.codigo_empregado),
    nome: e.nome_empregado,
    escalar: true,
    ferias,
    ...(sexoNorm === 'F' || sexoNorm === 'M' ? { sexo: sexoNorm as 'F' | 'M' } : {}),
    menor: e.menor_de_idade === true,
    estagiario,
    jornadaPadrao: false,
    horasSemanais: estagiario ? regras.estagioHorasSemanais : PADRAO_HORAS,
  }
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

export function mapearDadosPortal(
  d: DadosPortal,
  regras: RegrasPessoais = REGRAS_PESSOAIS_PADRAO,
): { nomeEmpresa: string; funcoes: Funcao[] } {
  const feriasPor = agrupar(d.ferias, (r) => String(r.codigo_empregado))
  const grupos = new Map<string, { nome: string; pessoas: PessoaEscala[] }>()

  for (const e of d.empregados) {
    const k = chaveCargo(e.cargo)
    const cod = String(e.codigo_empregado)
    const pessoa = montarPessoa(e, feriasPor.get(cod) ?? [], regras)
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
