/**
 * Quadro sugerido de contratações para cobrir a cobertura mínima informada.
 * Função pura — tudo é ESTIMATIVA.
 *
 * Lógica (espelha o gerador):
 * 1. Cada pessoa cumpre uma jornada INTEIRA (até 8h24 líquidas + intervalo = `bruto`), sempre no mesmo
 *    horário, dentro da janela de funcionamento. Para cada dia da semana, a necessidade de pessoas por faixa
 *    de 15 min (`perfilNecessidade`) é coberta pelo menor número de jornadas fixas, de forma gulosa: varre as
 *    faixas em ordem e, onde faltar gente, abre as jornadas que faltam começando em min(faixa, último início
 *    possível). Soma dos 7 dias = turnos/semana.
 * 2. As jornadas que começam no mesmo horário formam uma "camada"; cada pessoa fica numa camada (horário fixo)
 *    e trabalha até 5 dias/semana (5x2, limite semanal). Pessoas da camada = max(⌈turnos ÷ dias por pessoa⌉,
 *    maior nº de turnos num dia, quem é preciso para o rodízio de domingos do setor).
 * 3. A equipe atual é medida em capacidade (tempo integral equivalente): cada pessoa vale
 *    min(1, horas semanais ÷ limite da etapa); estagiário e menor também não passam da razão entre a jornada
 *    diária máxima deles e a jornada cheia.
 * 4. Mulheres com o art. 386 da CLT ligado folgam ao menos 1 domingo a cada 2 semanas: se a equipe (mais as
 *    contratações) não alcança os turnos do domingo, soma-se o reforço.
 */
import { REGRAS, REGRAS_PESSOAIS_PADRAO, cicloDomingoDoSetor, limitesDaEtapa, type EtapaId, type RegrasLegais } from '../config/regras'
import type { CoberturaTurno, Empresa, Funcao, ParametrosCusto, PessoaEscala, RegrasPessoais, Turno } from '../types'
import { SLOT, NSLOTS, faixas, janelaDeJornada, perfilNecessidade, perfilPorFuncao } from './gerador'
import { intervaloParaBruto, limitesEstagio } from './jornada'
import { minimoDoDia } from './minimos'

export interface LinhaTurnoQuadro {
  turnoId: string
  nome: string
  /** Turnos (jornadas inteiras) por semana que este período, sozinho, exige. */
  presencasSemana: number
  turnosPorPessoa: number
  necessarios: number
  /** Quantas pessoas bastariam numa escala 6x1 (6 turnos/semana) — só para comparação. */
  necessariosNa6x1: number
}

export interface LinhaFuncaoQuadro {
  funcaoId: string
  nome: string
  atual: number
  sugerido: number
  contratar: number
  custoMensal: number | null
}

export interface QuadroContratacoes {
  etapa: Exclude<EtapaId, 'legado'>
  linhasTurno: LinhaTurnoQuadro[]
  /** Turnos (jornadas inteiras) por semana do perfil combinado de todos os períodos. */
  turnosSemana: number
  /** Pessoas em tempo integral necessárias (perfil combinado; turnos compartilhados entre períodos). */
  necessarioTotal: number
  /** Quantidade de pessoas (cabeças). */
  equipeAtual: number
  /** Capacidade da equipe em pessoas de tempo integral (uma casa decimal). */
  equipeEquivalente: number
  contratar: number
  /** Parte de `contratar` que vem só do domingo quinzenal das mulheres (CLT art. 386). */
  extraDomingo: number
  porFuncao: LinhaFuncaoQuadro[]
  custoMensal: number | null
  observacoes: string[]
  rotulo: 'ESTIMATIVA'
}

const EPS = 1e-9
const DIAS = [0, 1, 2, 3, 4, 5, 6]

/** Distribui `total` unidades proporcionalmente a `pesos` (maior resto); pesos todos zero contam igual. */
function distribuir(total: number, pesosIn: number[]): number[] {
  const pesos = pesosIn.some((p) => p > 0) ? pesosIn : pesosIn.map(() => 1)
  const soma = pesos.reduce((a, b) => a + b, 0)
  if (soma === 0 || total === 0) return pesos.map(() => 0)
  const exatos = pesos.map((p) => (p / soma) * total)
  const base = exatos.map(Math.floor)
  let resto = total - base.reduce((a, b) => a + b, 0)
  const ordem = exatos.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r)
  for (const { i } of ordem) {
    if (resto <= 0) break
    base[i] += 1
    resto -= 1
  }
  return base
}

/** Camadas de jornada: início (minuto do dia) → turnos em cada dia da semana (0 = domingo). */
export type Camadas = Map<number, number[]>

/**
 * Menor conjunto de jornadas de `bruto` minutos (horário fixo dentro da janela) que cobre `perfil[dow][faixa]`,
 * pelo guloso do início mais cedo.
 */
export function camadasDoPerfil(perfil: number[][], janela: { janIni: number; janFim: number }, bruto: number): Camadas {
  const primeiro = janela.janIni * SLOT
  // Mesmos candidatos do gerador: de 15 em 15 min a partir da abertura, sem passar do fechamento.
  const ultimo = Math.max(primeiro, primeiro + Math.floor((janela.janFim * SLOT - bruto - primeiro) / SLOT) * SLOT)
  const camadas: Camadas = new Map()
  for (const dow of DIAS) {
    const cob = new Array<number>(NSLOTS).fill(0)
    for (let t = 0; t < NSLOTS; t++) {
      const falta = perfil[dow][t] - cob[t]
      if (falta <= 0) continue
      const ini = Math.max(primeiro, Math.min(t * SLOT, ultimo))
      for (const s of faixas(ini, bruto)) cob[s] += falta
      const linha = camadas.get(ini) ?? new Array<number>(7).fill(0)
      linha[dow] += falta
      camadas.set(ini, linha)
    }
  }
  return camadas
}

const somaTurnos = (c: Camadas) => [...c.values()].reduce((s, l) => s + l.reduce((a, b) => a + b, 0), 0)

/** Menor nº de pessoas p com p − ⌈p ÷ ciclo⌉ ≥ `domingo` (cada uma folga 1 domingo a cada `ciclo` semanas). */
function pessoasParaDomingo(domingo: number, ciclo: number): number {
  if (domingo <= 0) return 0
  let p = domingo
  while (p - Math.ceil(p / ciclo - EPS) < domingo) p++
  return p
}

/** Pessoas (horário fixo) para cobrir as camadas, com até `porPessoa` turnos/semana cada. */
function pessoasDasCamadas(c: Camadas, porPessoa: number, ciclo: number | null): number {
  let total = 0
  for (const linha of c.values()) {
    const turnos = linha.reduce((a, b) => a + b, 0)
    if (turnos === 0) continue
    const dias = linha.filter((n) => n > 0).length
    let p = Math.max(Math.ceil(turnos / Math.min(porPessoa, dias)), ...linha)
    if (ciclo !== null) p = Math.max(p, pessoasParaDomingo(linha[0], ciclo))
    total += p
  }
  return total
}

function temDemanda(c: CoberturaTurno | undefined, empresa: Empresa, funcaoIds: string[]): boolean {
  if (!c) return false
  return DIAS.some(
    (d) =>
      empresa.diasFuncionamento[d] &&
      (minimoDoDia(c, d) > 0 ||
        Object.entries(c.porFuncao ?? {}).some(([id, m]) => funcaoIds.includes(id) && minimoDoDia(m, d) > 0)),
  )
}

export function calcularQuadro(
  entrada: {
    empresa: Empresa
    funcoes: Funcao[]
    turnos: Turno[]
    cobertura: Record<string, CoberturaTurno>
    custo: ParametrosCusto
  },
  etapa: Exclude<EtapaId, 'legado'>,
  regras: RegrasLegais = REGRAS,
  regrasPessoais: RegrasPessoais = REGRAS_PESSOAIS_PADRAO,
): QuadroContratacoes {
  const { empresa, funcoes, turnos, cobertura, custo } = entrada
  const limiteHoras = limitesDaEtapa(etapa, regras).jornadaSemanalMax
  const funcaoIds = funcoes.map((f) => f.id)

  // Jornada cheia: ≤ 8h24 líquidas + intervalo; cada pessoa faz até 5 jornadas por semana.
  const liquida = Math.min(regras.jornadaDiariaMax * 60, Math.floor((limiteHoras * 60) / 5))
  const intervalo = intervaloParaBruto(liquida)
  const bruto = Math.max(1, liquida + Math.max(intervalo, intervaloParaBruto(liquida + intervalo)))
  const porPessoa = Math.max(1, Math.min(5, Math.floor((limiteHoras * 60) / Math.max(1, liquida))))
  const ciclo = Math.max(2, cicloDomingoDoSetor(empresa.setor, regras))
  const cicloRodizio = empresa.diasFuncionamento[0] ? ciclo : null

  const periodosComDemanda = turnos.filter((t) => temDemanda(cobertura[t.id], empresa, funcaoIds))
  const perfil = periodosComDemanda.length > 0 ? perfilNecessidade(empresa, periodosComDemanda, cobertura, funcaoIds) : null
  const janela = janelaDeJornada(empresa, perfil ?? DIAS.map(() => new Array<number>(NSLOTS).fill(0)))

  // Perfil combinado → turnos e pessoas (a necessidade real; turnos são compartilhados entre períodos).
  const camadas: Camadas = perfil ? camadasDoPerfil(perfil, janela, bruto) : new Map()
  const turnosSemana = somaTurnos(camadas)
  const necessarioTotal = pessoasDasCamadas(camadas, porPessoa, cicloRodizio)
  const turnosDomingo = [...camadas.values()].reduce((s, l) => s + l[0], 0)

  // Cada período sozinho (só para exibição).
  const linhasTurno: LinhaTurnoQuadro[] = turnos
    .filter((t) => cobertura[t.id])
    .map((t) => {
      const c: Camadas = periodosComDemanda.includes(t)
        ? camadasDoPerfil(perfilNecessidade(empresa, [t], cobertura, funcaoIds), janela, bruto)
        : new Map()
      return {
        turnoId: t.id,
        nome: t.nome,
        presencasSemana: somaTurnos(c),
        turnosPorPessoa: porPessoa,
        necessarios: pessoasDasCamadas(c, porPessoa, cicloRodizio),
        necessariosNa6x1: pessoasDasCamadas(c, 6, null),
      }
    })

  // Funções com mínimo próprio: pessoas da função que esse mínimo exige.
  const perfilFn = perfil ? perfilPorFuncao(empresa, periodosComDemanda, cobertura, funcaoIds) : {}
  const necessarioFn = new Map<string, number>()
  for (const [id, p] of Object.entries(perfilFn)) {
    necessarioFn.set(id, pessoasDasCamadas(camadasDoPerfil(p, janela, bruto), porPessoa, cicloRodizio))
  }

  // Capacidade da equipe (tempo integral equivalente) e folgas de domingo (Σ capacidade ÷ ciclo).
  const capacidadePessoa = (f: Funcao, p?: PessoaEscala): number => {
    const h0 = p?.horasSemanais ?? f.horasSemanaisAtuais
    let horas = h0 > 0 ? h0 : 44
    let cap = 1
    if (p?.estagiario) {
      const est = limitesEstagio(regrasPessoais)
      horas = Math.min(horas, est.semanalH)
      cap = Math.min(cap, est.diariaMin / liquida)
    }
    if (p?.menor) cap = Math.min(cap, (regras.pessoas.menorHorasDiaMax * 60) / liquida)
    return Math.max(0, Math.min(cap, horas / limiteHoras))
  }
  const cicloMulher = Math.min(ciclo, regras.pessoas.domingoMulherCicloSemanas)
  let folgasDomingo = 0
  let mulheres = 0
  const capFn = funcoes.map((f) => {
    if (!f.pessoas) {
      const cap = f.quantidade * capacidadePessoa(f)
      folgasDomingo += cap / ciclo
      return cap
    }
    let cap = 0
    for (const p of f.pessoas) {
      if (!p.escalar) continue
      const c = capacidadePessoa(f, p)
      const quinzenal = regrasPessoais.mulheresDomingoQuinzenal && p.sexo === 'F'
      if (quinzenal) mulheres++
      folgasDomingo += c / (quinzenal ? cicloMulher : ciclo)
      cap += c
    }
    return cap
  })
  const equipeReal = capFn.reduce((a, b) => a + b, 0)
  const equipeAtual = funcoes.reduce((s, f) => s + f.quantidade, 0)

  // Contratações: primeiro o mínimo de cada função, depois o que falta no total.
  const base = funcoes.map((f, i) => Math.max(0, Math.ceil((necessarioFn.get(f.id) ?? 0) - capFn[i] - EPS)))
  const somaBase = base.reduce((a, b) => a + b, 0)
  const faltaTotal = Math.max(0, Math.ceil(necessarioTotal - (equipeReal + somaBase) - EPS))
  const semDomingo = somaBase + faltaTotal
  // Domingo: quem pode trabalhar num domingo = capacidade − folgas daquele domingo; contratações entram no ciclo do setor.
  const noDomingo = (k: number) => equipeReal + k - Math.ceil(folgasDomingo + k / ciclo - EPS)
  let contratar = semDomingo
  if (cicloRodizio !== null && turnosDomingo > 0 && mulheres > 0) {
    while (noDomingo(contratar) < turnosDomingo - EPS && contratar < semDomingo + turnosDomingo * 2) contratar++
  }
  const extraDomingo = contratar - semDomingo

  const resto = distribuir(contratar - somaBase, funcoes.map((f) => f.quantidade))
  const extras = base.map((b, i) => b + resto[i])
  const fator = 1 + custo.encargosPct / 100
  const temSalario = funcoes.some((f) => f.salarioBase && f.salarioBase > 0)

  const porFuncao: LinhaFuncaoQuadro[] = funcoes.map((f, i) => ({
    funcaoId: f.id,
    nome: f.nome,
    atual: f.quantidade,
    sugerido: f.quantidade + extras[i],
    contratar: extras[i],
    custoMensal: f.salarioBase && f.salarioBase > 0 ? extras[i] * f.salarioBase * fator : null,
  }))

  const observacoes: string[] = []
  if (extraDomingo > 0) {
    observacoes.push(
      `Regra do art. 386 da CLT: ${mulheres} mulher(es) da equipe folgam ao menos 1 domingo a cada 2 semanas; para ` +
        `cobrir os ${turnosDomingo} turno(s) de domingo são necessárias mais ${extraDomingo} contratação(ões) ` +
        '(as novas contratações foram consideradas no rodízio de domingos do setor).',
    )
  }

  return {
    etapa,
    linhasTurno,
    turnosSemana,
    necessarioTotal,
    equipeAtual,
    equipeEquivalente: Math.round(equipeReal * 10) / 10,
    contratar,
    extraDomingo,
    porFuncao,
    custoMensal: temSalario ? porFuncao.reduce((s, p) => s + (p.custoMensal ?? 0), 0) : null,
    observacoes,
    rotulo: 'ESTIMATIVA',
  }
}
