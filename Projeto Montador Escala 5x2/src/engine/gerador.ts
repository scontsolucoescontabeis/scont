/**
 * Gerador de propostas de escala 5x2. Função pura: dado equipe, turnos e
 * cobertura, devolve 3 propostas (fixo, rodízio de domingos, folga móvel).
 * Cada empregado recebe 1 turno e 2 dias de repouso por semana; feriados em que
 * a empresa não funciona viram "feriado". A conformidade é verificada depois,
 * pelo motor (conformidade.ts) — o gerador só tenta cobrir a demanda.
 */
import type {
  CoberturaTurno,
  DiaEscala,
  Empresa,
  Escala,
  Funcao,
  Funcionario,
  ModeloEscala,
  Proposta,
  RegraCobertura,
  Turno,
} from '../types'
import { diaDaSemana, segundaDaSemana, somarDias } from './datas'

export interface EntradaGerador {
  empresa: Empresa
  funcoes: Funcao[]
  turnos: Turno[]
  cobertura: Record<string, CoberturaTurno>
  feriados: string[]
  /** Qualquer data; a escala começa na segunda-feira da semana dela. */
  inicio: string
  semanas: number
}

export function criarFuncionarios(funcoes: Funcao[]): Funcionario[] {
  const lista: Funcionario[] = []
  for (const fn of funcoes) {
    for (let i = 1; i <= fn.quantidade; i++) {
      lista.push({
        id: `${fn.id}-${i}`,
        nome: fn.quantidade > 1 ? `${fn.nome} ${i}` : fn.nome,
        funcaoId: fn.id,
      })
    }
  }
  return lista
}

/** Regras de cobertura do motor, derivadas da configuração simples da interface. */
export function coberturaParaRegras(
  cobertura: Record<string, CoberturaTurno>,
  diasFuncionamento: boolean[],
): RegraCobertura[] {
  const grupos: [keyof CoberturaTurno, number[]][] = [
    ['util', [1, 2, 3, 4, 5]],
    ['sab', [6]],
    ['dom', [0]],
  ]
  const regras: RegraCobertura[] = []
  for (const [turnoId, c] of Object.entries(cobertura)) {
    for (const [chave, dias] of grupos) {
      const abertos = dias.filter((d) => diasFuncionamento[d])
      if (c[chave] > 0 && abertos.length > 0) {
        regras.push({ id: `${turnoId}-${chave}`, turnoId, minimo: c[chave], diasSemana: abertos })
      }
    }
  }
  return regras
}

function necessidade(c: CoberturaTurno | undefined, dow: number, aberto: boolean): number {
  if (!c || !aberto) return 0
  return dow === 0 ? c.dom : dow === 6 ? c.sab : c.util
}

/** Escolhe 2 dias de repouso (índices 0=seg..6=dom) maximizando a folga de cobertura. */
function escolherRepousos(
  presentes: number[],
  need: number[],
  permitido: boolean[],
  forcados: number[],
  preferirDomingo: boolean,
  desempate: number,
): number[] {
  const escolhidos: number[] = []
  const tomar = (d: number) => {
    escolhidos.push(d)
    presentes[d] -= 1
  }
  // Dias forçados (empresa/turno fechado) sempre viram repouso, mesmo que passem de 2.
  forcados.forEach(tomar)
  while (escolhidos.length < 2) {
    let melhor = -1
    let melhorPont = -Infinity
    for (let k = 0; k < 7; k++) {
      const d = (k + desempate) % 7
      if (!permitido[d] || escolhidos.includes(d)) continue
      let pont = presentes[d] - need[d]
      if (preferirDomingo && d === 6 && escolhidos.length === 0) pont += 0.5
      if (pont > melhorPont) {
        melhorPont = pont
        melhor = d
      }
    }
    if (melhor < 0) break
    tomar(melhor)
  }
  return escolhidos
}

export function gerarEscala(entrada: EntradaGerador, modelo: ModeloEscala): Escala {
  const { empresa, funcoes, turnos, cobertura, feriados, semanas } = entrada
  const inicio = segundaDaSemana(entrada.inicio)
  const dias = semanas * 7
  const funcionarios = criarFuncionarios(funcoes)
  const feriadoSet = new Set(feriados)
  const turnosAtivos = turnos.filter((t) => cobertura[t.id])
  const base = turnosAtivos.length > 0 ? turnosAtivos : turnos.slice(0, 1)

  // 1) Distribui funcionários nos turnos conforme a demanda semanal
  const demanda = base.map((t) => {
    const soma = [0, 1, 2, 3, 4, 5, 6].reduce(
      (s, d) => s + necessidade(cobertura[t.id], d, empresa.diasFuncionamento[d]),
      0,
    )
    return Math.max(soma, 1)
  })
  const alocados = base.map(() => 0)
  const turnoDoFunc = new Map<string, string>()
  for (const f of funcionarios) {
    let alvo = 0
    let menor = Infinity
    base.forEach((_, i) => {
      const razao = alocados[i] / demanda[i]
      if (razao < menor) {
        menor = razao
        alvo = i
      }
    })
    alocados[alvo] += 1
    turnoDoFunc.set(f.id, base[alvo].id)
  }

  // 2) Repousos por turno, semana a semana
  const celulas: Record<string, DiaEscala[]> = Object.fromEntries(
    funcionarios.map((f) => [f.id, [] as DiaEscala[]]),
  )
  const cicloDomingo = Math.max(2, Math.min(4, semanas))
  const repousoFixo = new Map<string, number[]>()

  for (let s = 0; s < semanas; s++) {
    for (const t of base) {
      const grupo = funcionarios.filter((f) => turnoDoFunc.get(f.id) === t.id)
      if (grupo.length === 0) continue
      const c = cobertura[t.id]
      // índices 0=seg..6=dom
      const need = Array.from({ length: 7 }, (_, d) => {
        const dow = (d + 1) % 7
        return necessidade(c, dow, empresa.diasFuncionamento[dow])
      })
      const presentes = Array.from({ length: 7 }, () => grupo.length)

      grupo.forEach((f, k) => {
        let rep: number[]
        if (modelo === 'fixo' && repousoFixo.has(f.id)) {
          rep = repousoFixo.get(f.id)!
          rep.forEach((d) => (presentes[d] -= 1))
        } else {
          // Dias em que o turno não funciona (cobertura 0) são repouso para todos.
          const forcados = need.map((n, d) => (n === 0 ? d : -1)).filter((d) => d >= 0)
          const permitido = Array.from({ length: 7 }, () => true)
          if (modelo === 'rodizio_domingo' && !forcados.includes(6)) {
            if ((s + k) % cicloDomingo === 0) forcados.push(6)
            else permitido[6] = false
          }
          rep = escolherRepousos(
            presentes,
            need,
            permitido,
            forcados,
            modelo !== 'rodizio_domingo',
            modelo === 'folga_movel' ? (s + k) % 7 : k % 7,
          )
          if (modelo === 'fixo') repousoFixo.set(f.id, rep)
        }
        for (let d = 0; d < 7; d++) {
          const data = somarDias(inicio, s * 7 + d)
          let cel: DiaEscala
          if (feriadoSet.has(data) && !empresa.funcionaFeriados && !rep.includes(d)) {
            cel = { tipo: 'feriado' }
          } else if (rep.includes(d)) {
            cel = { tipo: d === 6 ? 'dsr' : 'folga' }
          } else {
            cel = { tipo: 'trabalho', turnoId: t.id }
          }
          celulas[f.id].push(cel)
        }
      })
    }
  }

  return { inicio, dias, funcionarios, turnos, celulas }
}

export const MODELOS: { modelo: ModeloEscala; nome: string; descricao: string }[] = [
  {
    modelo: 'fixo',
    nome: '5x2 fixo',
    descricao: 'Cada pessoa folga sempre nos mesmos dias da semana. Fácil de combinar e de controlar.',
  },
  {
    modelo: 'rodizio_domingo',
    nome: '5x2 com rodízio de domingos',
    descricao: 'O domingo de folga gira entre a equipe. Bom quando a empresa abre aos domingos.',
  },
  {
    modelo: 'folga_movel',
    nome: '5x2 com folga móvel',
    descricao: 'Os dias de folga mudam de semana em semana, distribuindo a carga de forma justa.',
  },
]

export function gerarPropostas(entrada: EntradaGerador): Proposta[] {
  return MODELOS.map((m) => ({
    id: m.modelo,
    modelo: m.modelo,
    nome: m.nome,
    descricao: m.descricao,
    escala: gerarEscala(entrada, m.modelo),
  }))
}

export function contarDomingosTrabalhados(escala: Escala): number {
  let n = 0
  for (const f of escala.funcionarios) {
    escala.celulas[f.id].forEach((c, i) => {
      if (c.tipo === 'trabalho' && diaDaSemana(somarDias(escala.inicio, i)) === 0) n++
    })
  }
  return n
}
