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
import type { JornadaPessoa } from './jornada'
import type {
  CoberturaTurno,
  DiaEscala,
  Empresa,
  Escala,
  Funcao,
  Funcionario,
  MinimosDia,
  ModeloEscala,
  PessoaEscala,
  Proposta,
  RegraCobertura,
  RegrasPessoais,
  Turno,
} from '../types'
import { diaDaSemana, hhmmDe, minutosDe, domingoDaSemana, somarDias } from './datas'
import { cicloDomingoDe, jornadaDaPessoa, tetoSemanalNaData, tocaNoturnoMenor } from './jornada'
import { diasDeFerias } from './ferias'
import { REGRAS, REGRAS_PESSOAIS_PADRAO, cicloDomingoDoSetor } from '../config/regras'
import { gruposDiasUteis, minimoDoDia } from './minimos'

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
  /** Regras por pessoa (mulheres, estagiários); padrão: `REGRAS_PESSOAIS_PADRAO`. */
  regrasPessoais?: RegrasPessoais
}

export const SLOT = 15
export const NSLOTS = 1440 / SLOT

export function criarFuncionarios(funcoes: Funcao[]): Funcionario[] {
  const lista: Funcionario[] = []
  for (const fn of funcoes) {
    if (fn.pessoas) {
      // Equipe nominal: um funcionário por pessoa escalável; `quantidade` é ignorada.
      for (const p of fn.pessoas) {
        if (!p.escalar) continue
        // Atributos só entram quando presentes: sem eles, o funcionário fica igual ao de antes.
        lista.push({
          id: `${fn.id}-${p.id}`,
          nome: p.nome,
          funcaoId: fn.id,
          ...(p.sexo ? { sexo: p.sexo } : {}),
          ...(p.menor ? { menor: true } : {}),
          ...(p.estagiario ? { estagiario: true } : {}),
        })
      }
      continue
    }
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

/**
 * Regras de cobertura do motor, derivadas da configuração simples da interface.
 * Dias úteis com o mesmo mínimo formam uma regra; se todos os dias úteis abertos
 * têm o mesmo mínimo, o id é `${turnoId}-util` (como antes do mínimo por dia),
 * senão `${turnoId}-util-${primeiro dia do grupo}`.
 */
export function coberturaParaRegras(
  cobertura: Record<string, CoberturaTurno>,
  diasFuncionamento: boolean[],
  funcoes?: { id: string; nome: string }[],
): RegraCobertura[] {
  const grupos: [keyof Omit<MinimosDia, 'porDia'>, number[]][] = [
    ['util', [1, 2, 3, 4, 5]],
    ['sab', [6]],
    ['dom', [0]],
  ]
  /** Grupos de dias (abertos) com o mesmo mínimo e o sufixo do id de cada um. */
  const partes = (m: MinimosDia, chave: string, dias: number[]) => {
    const abertos = dias.filter((d) => diasFuncionamento[d])
    if (abertos.length === 0) return []
    const gs = gruposDiasUteis(m, abertos)
    return gs
      .filter((g) => g.minimo > 0)
      .map((g) => ({ ...g, sufixo: gs.length === 1 ? chave : `${chave}-${g.dias[0]}` }))
  }
  const regras: RegraCobertura[] = []
  for (const [turnoId, c] of Object.entries(cobertura)) {
    for (const [chave, dias] of grupos) {
      for (const g of partes(c, chave, dias)) {
        regras.push({ id: `${turnoId}-${g.sufixo}`, turnoId, minimo: g.minimo, diasSemana: g.dias })
      }
      // Mínimo por função (além do total do período).
      for (const [funcaoId, m] of Object.entries(c.porFuncao ?? {})) {
        const fn = funcoes?.find((x) => x.id === funcaoId)
        if (funcoes && !fn) continue // função removida
        for (const g of partes(m, chave, dias)) {
          regras.push({
            id: `${turnoId}-${funcaoId}-${g.sufixo}`,
            turnoId,
            funcaoId,
            rotulo: fn?.nome,
            minimo: g.minimo,
            diasSemana: g.dias,
          })
        }
      }
    }
  }
  return regras
}

function necessidade(c: MinimosDia | undefined, dow: number, aberto: boolean): number {
  if (!c || !aberto) return 0
  return minimoDoDia(c, dow)
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
  funcaoIds?: string[],
): number[][] {
  const perfil = Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))
  for (const t of periodos) {
    const c = cobertura[t.id]
    if (!c) continue
    const ini = minutosDe(t.inicio)
    const fim = minutosDe(t.fim) <= ini ? 1440 : minutosDe(t.fim)
    for (let dow = 0; dow < 7; dow++) {
      const aberto = empresa.diasFuncionamento[dow]
      // O total nunca é menor que a soma dos mínimos por função.
      const somaFuncoes = Object.entries(c.porFuncao ?? {})
        .filter(([id]) => !funcaoIds || funcaoIds.includes(id))
        .reduce((acc, [, m]) => acc + necessidade(m, dow, aberto), 0)
      const n = Math.max(necessidade(c, dow, aberto), somaFuncoes)
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

/** Necessidade de pessoas de cada função (mínimo por função), por dia da semana e faixa de 15 min. */
export function perfilPorFuncao(
  empresa: Empresa,
  periodos: Turno[],
  cobertura: Record<string, CoberturaTurno>,
  funcaoIds: string[],
): Record<string, number[][]> {
  const out: Record<string, number[][]> = {}
  for (const t of periodos) {
    const c = cobertura[t.id]
    if (!c?.porFuncao) continue
    const ini = minutosDe(t.inicio)
    const fim = minutosDe(t.fim) <= ini ? 1440 : minutosDe(t.fim)
    for (const [fid, m] of Object.entries(c.porFuncao)) {
      if (!funcaoIds.includes(fid)) continue
      for (let dow = 0; dow < 7; dow++) {
        const n = necessidade(m, dow, empresa.diasFuncionamento[dow])
        if (n <= 0) continue
        out[fid] ??= Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))
        for (let s = Math.floor(ini / SLOT); s < Math.ceil(fim / SLOT); s++) {
          out[fid][dow][s] = Math.max(out[fid][dow][s], n)
        }
      }
    }
  }
  return out
}

/**
 * Janela (em faixas de 15 min, [janIni, janFim)) onde as jornadas podem caber: da primeira à última faixa com
 * demanda em qualquer dia, estendida ao horário de funcionamento. Sem nada, 08:00–18:00.
 */
export function janelaDeJornada(empresa: Empresa, perfil: number[][]): { janIni: number; janFim: number } {
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
  return { janIni, janFim }
}

/** Faixas de 15 min cobertas por um horário que começa em `inicio` e dura `bruto` minutos. */
export function faixas(inicio: number, bruto: number): number[] {
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
  quantos = 2,
): number[] {
  // Dias forçados (empresa fechada / sem demanda para o horário) sempre viram repouso, mesmo que passem de 2.
  const escolhidos: number[] = [...forcados]
  while (escolhidos.length < quantos) {
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
  const regrasPessoais = entrada.regrasPessoais ?? REGRAS_PESSOAIS_PADRAO
  const inicio = domingoDaSemana(entrada.inicio)
  const dias = semanas * 7
  const funcionarios = criarFuncionarios(funcoes)
  const feriadoSet = new Set(feriados)
  const funcaoIds = funcoes.map((f) => f.id)
  const perfil = perfilNecessidade(empresa, turnos, cobertura, funcaoIds)
  const perfilFn = perfilPorFuncao(empresa, turnos, cobertura, funcaoIds)
  const novaGrade = () => Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))

  // 1) Horário de trabalho de cada empregado: jornada legal da função, com a
  //    entrada escolhida para cobrir as faixas do estabelecimento com menos gente.
  const { janIni, janFim } = janelaDeJornada(empresa, perfil)
  const contagem = Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))
  const contagemFn: Record<string, number[][]> = Object.fromEntries(
    Object.keys(perfilFn).map((id) => [id, novaGrade()]),
  )
  const teto = tetoSemanalNaData(inicio)
  // Jornada de cada funcionário: a da função com as sobreposições da pessoa (quando nominal).
  const jornadas = new Map<string, JornadaPessoa>()
  // Dias (índice na escala) em que o funcionário está de férias: célula "ausencia".
  const ausentes = new Map<string, Set<number>>()
  for (const f of funcionarios) {
    const fnc = funcoes.find((x) => x.id === f.funcaoId)!
    const pessoa: PessoaEscala | undefined = fnc.pessoas?.find((p) => `${fnc.id}-${p.id}` === f.id)
    jornadas.set(f.id, jornadaDaPessoa(fnc, pessoa, teto, regrasPessoais))
    ausentes.set(f.id, diasDeFerias(inicio, dias, pessoa?.ferias ?? []))
  }
  const horarioDe = new Map<string, { inicio: number; bruto: number; intervaloMin: number }>()
  for (const f of funcionarios) {
    const j = jornadas.get(f.id)!
    let ini = j.inicioFixo
    if (ini === undefined) {
      ini = janIni * SLOT
      const ultimo = Math.max(janIni * SLOT, janFim * SLOT - j.bruto)
      // Menor de 18 (CLT art. 404): só horários inteiramente entre 5h e 22h. Horário fixo é mantido
      // (a conformidade aponta); sem nenhum candidato diurno na janela, entra às 5h.
      const diurno = (c: number) => !f.menor || !tocaNoturnoMenor(c, j.bruto)
      if (f.menor && !diurno(ini)) ini = minutosDe(REGRAS.pessoas.menorNoturno.fim)
      let melhorPont = -Infinity
      for (let c = janIni * SLOT; c <= ultimo; c += SLOT) {
        if (!diurno(c)) continue
        let pont = 0
        for (let dow = 0; dow < 7; dow++) {
          for (const s of faixas(c, j.bruto)) {
            // Mínimo da própria função: pesa tanto quanto o total.
            const nf = perfilFn[f.funcaoId]?.[dow][s] ?? 0
            if (nf > 0) {
              const cf = contagemFn[f.funcaoId][dow][s]
              pont += Math.max(0, nf * 7 - cf * 5) * 1000 - cf
            }
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
    for (let dow = 0; dow < 7; dow++) {
      for (const s of faixas(ini, j.bruto)) {
        contagem[dow][s] += 1
        if (contagemFn[f.funcaoId]) contagemFn[f.funcaoId][dow][s] += 1
      }
    }
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
  // Ciclo de cada funcionário (mulheres com o art. 386: 2 semanas).
  const cicloDe = new Map<string, number>(funcionarios.map((f) => [f.id, cicloDomingoDe(f, ciclo, regrasPessoais)]))
  // Denominador comum dos ciclos, para somar 1/ciclo sem erro de ponto flutuante.
  const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b))
  const mmcCiclos = [...cicloDe.values()].reduce((a, b) => (a * b) / mdc(a, b), 1)
  const domSeguidos = new Map<string, number>(funcionarios.map((f) => [f.id, 0]))
  const diasSeguidos = new Map<string, number>(funcionarios.map((f) => [f.id, 0]))
  const maxSeguidos = REGRAS.diasConsecutivosMax
  const repousoFixo = new Map<string, number[]>()

  for (let s = 0; s < semanas; s++) {
    /** O funcionário está de férias no dia `d` (0 = dom .. 6 = sáb) desta semana. */
    const ausente = (id: string, d: number) => ausentes.get(id)!.has(s * 7 + d)
    // presentes[d][faixa], d = 0 (dom) .. 6 (sáb) = dia da semana
    const presentes = Array.from({ length: 7 }, () => new Array<number>(NSLOTS).fill(0))
    const presentesFn: Record<string, number[][]> = Object.fromEntries(
      Object.keys(perfilFn).map((id) => [id, novaGrade()]),
    )
    for (const f of funcionarios) {
      const h = horarioDe.get(f.id)!
      for (let d = 0; d < 7; d++) {
        if (ausente(f.id, d)) continue
        for (const sl of faixas(h.inicio, h.bruto)) {
          presentes[d][sl] += 1
          if (presentesFn[f.funcaoId]) presentesFn[f.funcaoId][d][sl] += 1
        }
      }
    }

    // Rodízio: a cada domingo trabalham só quantos a cobertura exige, escolhidos entre
    // quem menos trabalhou domingos até aqui; todos os demais folgam (DSR).
    let trabalhaDomingo: Set<string> | null = null
    if (modelo === 'rodizio_domingo') {
      trabalhaDomingo = new Set()
      const cobertos = new Array<number>(NSLOTS).fill(0)
      const cobertosFn: Record<string, number[]> = Object.fromEntries(
        Object.keys(perfilFn).map((id) => [id, new Array<number>(NSLOTS).fill(0)]),
      )
      // Quem já trabalhou ciclo-1 domingos seguidos precisa folgar neste.
      // Cada empregado tem uma "fase" no ciclo (posição na equipe): na semana da fase dele o
      // domingo é de folga, salvo se a cobertura exigir. Assim as folgas de domingo ficam
      // escalonadas, inclusive dentro da mesma função.
      const folgaDaVez = new Set(
        funcionarios.filter((f, i) => (s + i) % cicloDe.get(f.id)! === 0).map((f) => f.id),
      )
      // Quem está de férias neste domingo não entra no rodízio (já está fora).
      const disponiveis = funcionarios.filter((f) => !ausente(f.id, 0))
      const ordem = disponiveis
        .filter((f) => domSeguidos.get(f.id)! < cicloDe.get(f.id)! - 1)
        .sort(
          (a, b) =>
            Number(folgaDaVez.has(a.id)) - Number(folgaDaVez.has(b.id)) ||
            domTrabalhados.get(a.id)! - domTrabalhados.get(b.id)!,
        )
      for (const f of ordem) {
        const h = horarioDe.get(f.id)!
        const pf = perfilFn[f.funcaoId]
        const util = faixas(h.inicio, h.bruto).filter(
          (sl) => perfil[0][sl] > cobertos[sl] || (pf && pf[0][sl] > cobertosFn[f.funcaoId][sl]),
        )
        if (util.length === 0) continue
        trabalhaDomingo.add(f.id)
        faixas(h.inicio, h.bruto).forEach((sl) => {
          cobertos[sl] += 1
          if (pf) cobertosFn[f.funcaoId][sl] += 1
        })
      }
      // Rodízio de verdade: além da cobertura, só podem folgar juntos no domingo
      // ceil(Σ 1/ciclo_i) empregados (cada um folga 1 domingo a cada `ciclo_i`; com ciclo único,
      // ceil(N / ciclo)). Os demais trabalham o domingo e levam o DSR/folga em outro dia da
      // semana. Quem está de férias no domingo não conta como possível trabalhador.
      if (empresa.diasFuncionamento[0]) {
        const somaFolgas = disponiveis.reduce((acc, f) => acc + mmcCiclos / cicloDe.get(f.id)!, 0)
        const maxFolgas = Math.ceil(somaFolgas / mmcCiclos)
        const alvoTrabalho = disponiveis.length - maxFolgas
        for (const f of ordem) {
          if (trabalhaDomingo.size >= alvoTrabalho) break
          if (trabalhaDomingo.has(f.id) || folgaDaVez.has(f.id)) continue
          const h = horarioDe.get(f.id)!
          if (!faixas(h.inicio, h.bruto).some((sl) => perfil[0][sl] > 0)) continue
          trabalhaDomingo.add(f.id)
        }
      }
      trabalhaDomingo.forEach((id) => domTrabalhados.set(id, domTrabalhados.get(id)! + 1))
    }

    for (const f of funcionarios) {
      const h = horarioDe.get(f.id)!
      const span = faixas(h.inicio, h.bruto)
      const k = posNoTurno.get(f.id)!
      // Dias de férias nesta semana: não trabalham nem consomem os 2 repousos.
      const aus = Array.from({ length: 7 }, (_, d) => d).filter((d) => ausente(f.id, d))
      // Repousos possíveis: 2, ou menos quando restam poucos dias fora das férias (7 → 2, 2 → 1, 1 → 0).
      const quantos = Math.min(2, Math.max(0, 7 - aus.length - 1))
      let rep: number[]
      if (aus.length === 7) {
        rep = []
      } else if (modelo === 'fixo' && repousoFixo.has(f.id) && !repousoFixo.get(f.id)!.some((d) => aus.includes(d))) {
        rep = repousoFixo.get(f.id)!
      } else {
        const folga: number[] = []
        const forcados: number[] = []
        for (let d = 0; d < 7; d++) {
          const dow = d
          const exigidas = span.filter((sl) => perfil[dow][sl] > 0)
          if (aus.includes(d)) {
            folga.push(-Infinity)
          } else if (exigidas.length === 0) {
            forcados.push(d)
            folga.push(-Infinity)
          } else {
            let f0 = Math.min(...exigidas.map((sl) => presentes[d][sl] - perfil[dow][sl]))
            const pf = perfilFn[f.funcaoId]
            const exFn = pf ? span.filter((sl) => pf[dow][sl] > 0) : []
            if (pf && exFn.length > 0) {
              f0 = Math.min(f0, ...exFn.map((sl) => presentesFn[f.funcaoId][d][sl] - pf[dow][sl]))
            }
            folga.push(f0)
          }
        }
        const permitido = Array.from({ length: 7 }, (_, d) => !aus.includes(d))
        if (trabalhaDomingo && !forcados.includes(0) && !aus.includes(0)) {
          if (trabalhaDomingo.has(f.id)) permitido[0] = false
          else forcados.push(0)
        }
        rep = escolherRepousos(
          folga,
          permitido,
          forcados,
          modelo !== 'rodizio_domingo',
          modelo === 'folga_movel' ? (s + k) % 7 : k % 7,
          quantos,
        )
        // O padrão fixo só é aprendido numa semana sem férias.
        if (modelo === 'fixo' && aus.length === 0) repousoFixo.set(f.id, rep)
      }
      // Travas legais: domingo de folga a cada `ciclo` semanas e no máx. 6 dias seguidos.
      // Férias contam como dia sem trabalho (domingo de férias = domingo de folga).
      const fechados = Array.from({ length: 7 }, (_, d) => d).filter((d) =>
        span.every((sl) => perfil[d][sl] <= 0),
      )
      const domObrigatorio = domSeguidos.get(f.id)! >= cicloDe.get(f.id)! - 1 &&!fechados.includes(0) && !aus.includes(0)
      const protegidos = new Set<number>(fechados)
      if (domObrigatorio) protegidos.add(0)
      const garantir = (d: number) => {
        if (rep.includes(d)) return
        const sai = [...rep].reverse().find((x) => !protegidos.has(x))
        rep = sai === undefined ? [...rep, d] : rep.map((x) => (x === sai ? d : x))
      }
      if (aus.length < 7) {
        if (domObrigatorio) garantir(0)
        // O 1º dia sem trabalho da semana (repouso ou férias) precisa vir antes de estourar 6 dias seguidos.
        const limite = Math.max(0, maxSeguidos - diasSeguidos.get(f.id)!)
        if (Math.min(...rep, ...aus) > limite) {
          garantir(limite)
          protegidos.add(limite)
        }
      }
      rep.forEach((d) =>
        span.forEach((sl) => {
          presentes[d][sl] -= 1
          if (presentesFn[f.funcaoId]) presentesFn[f.funcaoId][d][sl] -= 1
        }),
      )
      // Cada semana tem 1 DSR (o domingo, quando é repouso; senão o 1º repouso) e as demais folgas.
      const dsrDia = rep.includes(0) ? 0 : rep[0]
      for (let d = 0; d < 7; d++) {
        const data = somarDias(inicio, s * 7 + d)
        let cel: DiaEscala
        if (aus.includes(d)) {
          cel = { tipo: 'ausencia' }
        } else if (feriadoSet.has(data) && !empresa.funcionaFeriados && !rep.includes(d)) {
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
