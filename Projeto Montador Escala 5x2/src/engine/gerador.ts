/**
 * Gerador de propostas de escala 5x2. Função pura: dado equipe, períodos de
 * cobertura do estabelecimento (passo 3) e jornada das funções, devolve 3
 * propostas (fixo, rodízio de domingos, folga móvel). Cada empregado recebe o
 * próprio horário (jornada legal, nunca o período inteiro) e 2 dias de repouso
 * por semana; feriados em que a empresa não funciona viram "feriado". A
 * conformidade é verificada depois, pelo motor (conformidade.ts) — o gerador só
 * tenta cobrir a demanda, mas já respeita duas travas legais: o repouso cai no
 * domingo ao menos 1 vez a cada N semanas (Lei 10.101/2000 art. 6º, p. único) e
 * ninguém passa de 6 dias seguidos de trabalho (CLT art. 67; OJ 410 SDI-1/TST).
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
import { diaDaSemana, hhmmDe, minutosDe, domingoDaSemana, somarDias } from './datas'
import { jornadaDaFuncao, tetoSemanalNaData } from './jornada'
import { REGRAS, cicloDomingoDoSetor } from '../config/regras'

export interface EntradaGerador {
  empresa: Empresa
  funcoes: Funcao[]
  /** Períodos do estabelecimento (passo 3), não horários de empregados. */
  turnos: Turno[]
  cobertura: Record<string, CoberturaTurno>
  feriados: string[]
  /** Qualquer data; a escala começa no domingo da semana dela. */
  inicio: string
  semanas: number
}

export const SLOT = 15
export const NSLOTS = 1440 / SLOT

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

/**
 * Necessidade do estabelecimento: pessoas mínimas por dia da semana (0 = domingo)
 * e faixa de 15 min. Os "turnos" do passo 3 são períodos do estabelecimento, não
 * horários de empregados.
 */
export function perfilNecessidade(
  empresa: Empresa,
  periodos: Turno[],
  cobertura: Record<string, CoberturaTurno>,
): number[][] {
  const perfil = Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))
  for (const t of periodos) {
    const c = cobertura[t.id]
    if (!c) continue
    const ini = minutosDe(t.inicio)
    const fim = minutosDe(t.fim) <= ini ? 1440 : minutosDe(t.fim)
    for (let dow = 0; dow < 7; dow++) {
      const n = necessidade(c, dow, empresa.diasFuncionamento[dow])
      if (n <= 0) continue
      for (let s = Math.floor(ini / SLOT); s < Math.ceil(fim / SLOT); s++) {
        perfil[dow][s] = Math.max(perfil[dow][s], n)
      }
    }
  }
  const semDemanda = !perfil.some((l) => l.some((n) => n > 0))
  if (semDemanda) {
    // Sem cobertura informada: exige 1 pessoa durante o horário de funcionamento.
    for (let dow = 0; dow < 7; dow++) {
      if (!empresa.diasFuncionamento[dow]) continue
      const h = empresa.horarios?.[dow] ?? { abre: empresa.horaAbertura, fecha: empresa.horaFechamento }
      for (let s = Math.floor(minutosDe(h.abre) / SLOT); s < Math.ceil(minutosDe(h.fecha) / SLOT); s++) {
        perfil[dow][s] = 1
      }
    }
  }
  return perfil
}

/** Faixas de 15 min cobertas por um horário que começa em `inicio` e dura `bruto` minutos. */
function faixas(inicio: number, bruto: number): number[] {
  const out: number[] = []
  const fim = Math.min(1440, inicio + bruto)
  for (let s = Math.floor(inicio / SLOT); s * SLOT < fim; s++) out.push(s)
  return out
}

/** Escolhe 2 dias de repouso (índices 0=dom..6=sáb) maximizando a folga de cobertura. */
function escolherRepousos(
  folga: number[],
  permitido: boolean[],
  forcados: number[],
  preferirDomingo: boolean,
  desempate: number,
): number[] {
  // Dias forçados (empresa fechada / sem demanda para o horário) sempre viram repouso, mesmo que passem de 2.
  const escolhidos: number[] = [...forcados]
  while (escolhidos.length < 2) {
    let melhor = -1
    let melhorPont = -Infinity
    for (let k = 0; k < 7; k++) {
      const d = (k + desempate) % 7
      if (!permitido[d] || escolhidos.includes(d)) continue
      let pont = folga[d]
      if (preferirDomingo && d === 0 && escolhidos.length === 0) pont += 0.5
      if (pont > melhorPont) {
        melhorPont = pont
        melhor = d
      }
    }
    if (melhor < 0) break
    escolhidos.push(melhor)
  }
  return escolhidos
}

export function gerarEscala(entrada: EntradaGerador, modelo: ModeloEscala): Escala {
  const { empresa, funcoes, turnos, cobertura, feriados, semanas } = entrada
  const inicio = domingoDaSemana(entrada.inicio)
  const dias = semanas * 7
  const funcionarios = criarFuncionarios(funcoes)
  const feriadoSet = new Set(feriados)
  const perfil = perfilNecessidade(empresa, turnos, cobertura)

  // 1) Horário de trabalho de cada empregado: jornada legal da função, com a
  //    entrada escolhida para cobrir as faixas do estabelecimento com menos gente.
  let janIni = NSLOTS
  let janFim = 0
  for (const linha of perfil) {
    linha.forEach((n, s) => {
      if (n > 0) {
        janIni = Math.min(janIni, s)
        janFim = Math.max(janFim, s + 1)
      }
    })
  }
  // O horário de funcionamento também limita onde uma jornada pode caber (entrada ≥ abertura, saída ≤ fechamento).
  for (let dow = 0; dow < 7; dow++) {
    if (!empresa.diasFuncionamento[dow]) continue
    const h = empresa.horarios?.[dow] ?? { abre: empresa.horaAbertura, fecha: empresa.horaFechamento }
    janIni = Math.min(janIni, Math.floor(minutosDe(h.abre) / SLOT))
    janFim = Math.max(janFim, Math.ceil(minutosDe(h.fecha) / SLOT))
  }
  if (janFim === 0) {
    janIni = 32
    janFim = 72
  }
  const contagem = Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))
  const teto = tetoSemanalNaData(inicio)
  const jornadas = new Map(funcoes.map((f) => [f.id, jornadaDaFuncao(f, teto)]))
  const horarioDe = new Map<string, { inicio: number; bruto: number; intervaloMin: number }>()
  for (const f of funcionarios) {
    const j = jornadas.get(f.funcaoId)!
    let ini = j.inicioFixo
    if (ini === undefined) {
      ini = janIni * SLOT
      const ultimo = Math.max(janIni * SLOT, janFim * SLOT - j.bruto)
      let melhorPont = -Infinity
      for (let c = janIni * SLOT; c <= ultimo; c += SLOT) {
        let pont = 0
        for (let dow = 0; dow < 7; dow++) {
          for (const s of faixas(c, j.bruto)) {
            const n = perfil[dow][s]
            if (n <= 0) continue
            // Falta de gente pesa muito; empate prefere a faixa menos cheia.
            pont += Math.max(0, n * 7 - contagem[dow][s] * 5) * 1000 - contagem[dow][s]
          }
        }
        if (pont > melhorPont) {
          melhorPont = pont
          ini = c
        }
      }
    }
    horarioDe.set(f.id, { inicio: ini, bruto: j.bruto, intervaloMin: j.intervaloMin })
    for (let dow = 0; dow < 7; dow++) for (const s of faixas(ini, j.bruto)) contagem[dow][s] += 1
  }

  const turnosTrabalho = new Map<string, Turno>()
  const turnoDoFunc = new Map<string, string>()
  const posNoTurno = new Map<string, number>()
  const contTurno = new Map<string, number>()
  for (const f of funcionarios) {
    const h = horarioDe.get(f.id)!
    const id = `ts-${hhmmDe(h.inicio)}-${hhmmDe(h.inicio + h.bruto)}-${h.intervaloMin}`
    if (!turnosTrabalho.has(id)) {
      turnosTrabalho.set(id, {
        id,
        nome: `${hhmmDe(h.inicio)}–${hhmmDe(h.inicio + h.bruto)}`,
        inicio: hhmmDe(h.inicio),
        fim: hhmmDe(h.inicio + h.bruto),
        intervaloMin: h.intervaloMin,
      })
    }
    turnoDoFunc.set(f.id, id)
    const k = contTurno.get(id) ?? 0
    posNoTurno.set(f.id, k)
    contTurno.set(id, k + 1)
  }

  // 2) Repousos, semana a semana, olhando a presença faixa a faixa
  const celulas: Record<string, DiaEscala[]> = Object.fromEntries(
    funcionarios.map((f) => [f.id, [] as DiaEscala[]]),
  )
  const domTrabalhados = new Map<string, number>(funcionarios.map((f) => [f.id, 0]))
  // Domingos trabalhados em sequência e dias de trabalho seguidos ao fim da semana anterior.
  const ciclo = Math.max(2, cicloDomingoDoSetor(empresa.setor))
  const domSeguidos = new Map<string, number>(funcionarios.map((f) => [f.id, 0]))
  const diasSeguidos = new Map<string, number>(funcionarios.map((f) => [f.id, 0]))
  const maxSeguidos = REGRAS.diasConsecutivosMax
  const repousoFixo = new Map<string, number[]>()

  for (let s = 0; s < semanas; s++) {
    // presentes[d][faixa], d = 0 (dom) .. 6 (sáb) = dia da semana
    const presentes = Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))
    for (const f of funcionarios) {
      const h = horarioDe.get(f.id)!
      for (let d = 0; d < 7; d++) for (const sl of faixas(h.inicio, h.bruto)) presentes[d][sl] += 1
    }

    // Rodízio: a cada domingo trabalham só quantos a cobertura exige, escolhidos entre
    // quem menos trabalhou domingos até aqui; todos os demais folgam (DSR).
    let trabalhaDomingo: Set<string> | null = null
    if (modelo === 'rodizio_domingo') {
      trabalhaDomingo = new Set()
      const cobertos = new Array<number>(NSLOTS).fill(0)
      // Quem já trabalhou ciclo-1 domingos seguidos precisa folgar neste.
      const ordem = funcionarios
        .filter((f) => domSeguidos.get(f.id)! < ciclo - 1)
        .sort((a, b) => domTrabalhados.get(a.id)! - domTrabalhados.get(b.id)!)
      for (const f of ordem) {
        const h = horarioDe.get(f.id)!
        const util = faixas(h.inicio, h.bruto).filter((sl) => perfil[0][sl] > cobertos[sl])
        if (util.length === 0) continue
        trabalhaDomingo.add(f.id)
        faixas(h.inicio, h.bruto).forEach((sl) => (cobertos[sl] += 1))
      }
      trabalhaDomingo.forEach((id) => domTrabalhados.set(id, domTrabalhados.get(id)! + 1))
    }

    for (const f of funcionarios) {
      const h = horarioDe.get(f.id)!
      const span = faixas(h.inicio, h.bruto)
      const k = posNoTurno.get(f.id)!
      let rep: number[]
      if (modelo === 'fixo' && repousoFixo.has(f.id)) {
        rep = repousoFixo.get(f.id)!
      } else {
        const folga: number[] = []
        const forcados: number[] = []
        for (let d = 0; d < 7; d++) {
          const dow = d
          const exigidas = span.filter((sl) => perfil[dow][sl] > 0)
          if (exigidas.length === 0) {
            forcados.push(d)
            folga.push(-Infinity)
          } else {
            folga.push(Math.min(...exigidas.map((sl) => presentes[d][sl] - perfil[dow][sl])))
          }
        }
        const permitido = Array.from({ length: 7 }, () => true)
        if (trabalhaDomingo && !forcados.includes(0)) {
          if (trabalhaDomingo.has(f.id)) permitido[0] = false
          else forcados.push(0)
        }
        rep = escolherRepousos(
          folga,
          permitido,
          forcados,
          modelo !== 'rodizio_domingo',
          modelo === 'folga_movel' ? (s + k) % 7 : k % 7,
        )
        if (modelo === 'fixo') repousoFixo.set(f.id, rep)
      }
      // Travas legais: domingo de folga a cada `ciclo` semanas e no máx. 6 dias seguidos.
      const fechados = Array.from({ length: 7 }, (_, d) => d).filter((d) =>
        span.every((sl) => perfil[d][sl] <= 0),
      )
      const domObrigatorio = domSeguidos.get(f.id)! >= ciclo - 1 && !fechados.includes(0)
      const protegidos = new Set<number>(fechados)
      if (domObrigatorio) protegidos.add(0)
      const garantir = (d: number) => {
        if (rep.includes(d)) return
        const sai = [...rep].reverse().find((x) => !protegidos.has(x))
        rep = sai === undefined ? [...rep, d] : rep.map((x) => (x === sai ? d : x))
      }
      if (domObrigatorio) garantir(0)
      // O 1º repouso da semana precisa vir antes de estourar 6 dias seguidos.
      const limite = Math.max(0, maxSeguidos - diasSeguidos.get(f.id)!)
      if (Math.min(...rep) > limite) {
        garantir(limite)
        protegidos.add(limite)
      }
      rep.forEach((d) => span.forEach((sl) => (presentes[d][sl] -= 1)))
      // Cada semana tem 1 DSR (o domingo, quando é repouso; senão o 1º repouso) e as demais folgas.
      const dsrDia = rep.includes(0) ? 0 : rep[0]
      for (let d = 0; d < 7; d++) {
        const data = somarDias(inicio, s * 7 + d)
        let cel: DiaEscala
        if (feriadoSet.has(data) && !empresa.funcionaFeriados && !rep.includes(d)) {
          cel = { tipo: 'feriado' }
        } else if (rep.includes(d)) {
          cel = { tipo: d === dsrDia ? 'dsr' : 'folga' }
        } else {
          cel = { tipo: 'trabalho', turnoId: turnoDoFunc.get(f.id) }
        }
        celulas[f.id].push(cel)
        if (d === 0) domSeguidos.set(f.id, cel.tipo === 'trabalho' ? domSeguidos.get(f.id)! + 1 : 0)
        diasSeguidos.set(f.id, cel.tipo === 'trabalho' ? diasSeguidos.get(f.id)! + 1 : 0)
      }
    }
  }

  return { inicio, dias, funcionarios, turnos: [...turnosTrabalho.values()], celulas }
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
