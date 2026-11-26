import { create } from 'zustand'
import { FERIADOS_PADRAO, type Feriado } from '../config/feriados'
import { REGRAS_PESSOAIS_PADRAO } from '../config/regras'
import { corrigirTudo } from '../engine/autocorrecao'
import { elevarCarga } from '../engine/contratacoes'
import { aplicarCorrecao } from '../engine/conformidade'
import { gerarPropostas, type HorarioFixo, type Travas } from '../engine/gerador'
import { CONTRATOS_PARCIAIS, gerarPropostasComVagas } from '../engine/vagas'
import { CUSTO_PADRAO } from '../engine/impacto'
import type {
  AlteracaoCelula,
  CoberturaTurno,
  DiaEscala,
  Empresa,
  Escala,
  Funcao,
  ParametrosCusto,
  Alerta,
  Proposta,
  RegrasPessoais,
  Turno,
} from '../types'
import { aplicarSobreposicoes, calcularSobreposicoes, empresaDoPortal, type Sobreposicoes } from '../portal/modo'
import { mapearDadosPortal, type DadosPortal } from '../portal/mapear'
import { carregarDadosPortal } from '../portal/supabase'
import { carregar, limpar, salvar } from '../services/storage'
import { analisar } from '../utils/analise'
import { criarMedidorDeFuros, ordemDeVagasDosDados } from '../utils/vagas'
import { ajustarFeriadosNaEscala } from '../utils/feriados'
import * as hist from '../utils/historico'

export interface Dados {
  passo: number
  empresa: Empresa
  funcoes: Funcao[]
  turnos: Turno[]
  cobertura: Record<string, CoberturaTurno>
  feriados: Feriado[]
  custo: ParametrosCusto
  inicioEscala: string
  semanas: number
  escala: Escala | null
  propostas: Proposta[]
  comparar: string[]
  etapaImpacto: 'etapa1' | 'etapa2'
  /** Proposta (modelo) em uso no calendário; mantida ao regenerar. */
  propostaAtivaId: string | null
  /** Regras por pessoa (mulheres, estagiários); não são dados pessoais, então são persistidas. */
  regrasPessoais: RegrasPessoais
  /** A proposta já traz, escaladas, as contratações que a cobertura mínima exige ("Vaga 1 — função"). */
  incluirContratacoes: boolean
  /** As vagas podem ser em tempo parcial (até 30 h/semana, CLT art. 58-A) quando for mais barato e ainda cobrir. */
  permitirParcial: boolean
  /** Horários de trabalho alterados à mão no passo 4 (id do funcionário na escala → horário). */
  horariosPasso4: Record<string, HorarioFixo>
}

export const EMPRESA_PADRAO: Empresa = {
  nome: '',
  setor: '',
  diasFuncionamento: [false, true, true, true, true, true, true],
  horaAbertura: '08:00',
  horaFechamento: '18:00',
  funcionaFeriados: false,
  acordoColetivo: 'nao_sei',
  compensacaoDiaria: false,
}

const TURNO_PADRAO: Turno = {
  id: 'turno-1',
  nome: 'Comercial',
  inicio: '08:00',
  fim: '17:24',
  intervaloMin: 60,
}

export const DADOS_PADRAO: Dados = {
  passo: 0,
  empresa: EMPRESA_PADRAO,
  funcoes: [
    {
      id: 'fn-1',
      nome: 'Atendente',
      quantidade: 4,
      jornadaContratual: '42h semanais',
      horasSemanaisAtuais: 42,
    },
  ],
  turnos: [TURNO_PADRAO],
  cobertura: { [TURNO_PADRAO.id]: { util: 2, sab: 2, dom: 0 } },
  feriados: FERIADOS_PADRAO,
  custo: CUSTO_PADRAO,
  inicioEscala: '2026-12-20',
  semanas: 5,
  escala: null,
  propostas: [],
  comparar: [],
  etapaImpacto: 'etapa1',
  propostaAtivaId: null,
  regrasPessoais: REGRAS_PESSOAIS_PADRAO,
  incluirContratacoes: true,
  permitirParcial: true,
  horariosPasso4: {},
}

/** Estado do modo portal (não persistido); null no modo avulso. */
export interface EstadoPortal {
  codigo: string
  carregando: boolean
  erro: string | null
  nenhumEmpregado: boolean
}

interface Acoes {
  portal: EstadoPortal | null
  /** Desfazer/Refazer das edições manuais da escala (não persistido). */
  historico: hist.Historico<Escala>
  desfazer: () => void
  refazer: () => void
  /** Aplica tudo o que o motor sabe corrigir (desfazível); devolve os alertas antes e depois. */
  corrigirAutomaticamente: () => { antes: Alerta[]; depois: Alerta[] }
  /** Carrega empresa/equipe do banco (sessão do portal) e mescla com o estado salvo. */
  carregarDoPortal: (codigo: string) => Promise<void>
  set: (parcial: Partial<Dados>) => void
  setEmpresa: (p: Partial<Empresa>) => void
  /** Leva a carga semanal de quem trabalha menos que `limiteH` (exceto estagiário e menor) até esse limite. */
  elevarCargaDaEquipe: (limiteH: number) => void
  /** Troca a lista de feriados e acompanha a escala e as propostas já geradas (sem apagar os ajustes manuais). */
  atualizarFeriados: (lista: Feriado[]) => void
  /** Atualiza as regras por pessoa; no portal, re-mapeia a equipe do banco com as novas regras. */
  setRegrasPessoais: (p: Partial<RegrasPessoais>) => void
  setCelula: (funcionarioId: string, dia: number, valor: DiaEscala) => void
  /** Fixa (ou, com null, libera) o horário de trabalho de um funcionário e refaz a escala. */
  definirHorario: (funcionarioId: string, h: HorarioFixo | null) => void
  trocarCelulas: (a: { f: string; d: number }, b: { f: string; d: number }) => void
  corrigir: (correcao: AlteracaoCelula[]) => void
  usarProposta: (id: string) => void
  /** Regenera as propostas a partir dos passos 1–3 (já com correções automáticas); descarta os ajustes manuais. */
  sugerirEscala: () => void
  /** Correção automática da escala recém-gerada (sem histórico, respeitando os dias travados); devolve quantas aplicou. */
  autoCorrigirInicial: () => number
  /** Navega para um passo; ao abrir a Escala, atualiza a sugestão com os dados atuais. */
  irParaPasso: (i: number) => void
  reiniciar: () => void
}

export type Store = Dados & Acoes

const codigoPortal = typeof window === 'undefined' ? null : empresaDoPortal(window.location.search)

type Salvo = Partial<Dados> & { sobreposicoes?: Sobreposicoes }
const salvoInicial = carregar<Salvo>() ?? {}
// No portal a equipe vem sempre do banco; só as sobreposições do usuário são persistidas.
if (codigoPortal) {
  delete salvoInicial.funcoes
  // saves antigos podem ter guardado dados pessoais; escala/propostas só existem na sessão
  delete salvoInicial.escala
  delete salvoInicial.propostas
}
const inicial: Dados = { ...DADOS_PADRAO, ...salvoInicial }

/** Equipe como veio do banco na última carga (não persistida). */
let baseBanco: Funcao[] | null = null
/** Dados crus do banco na última carga, para re-mapear quando as regras por pessoa mudam. */
let dadosBanco: DadosPortal | null = null
/** Assinatura dos dados dos passos 1-3 usados na última geração; permite voltar ao Passo 4 sem perder ajustes manuais. */
let assinaturaGeracao: string | null = null
function assinaturaDosDados(d: Dados): string {
  return JSON.stringify([d.empresa, d.funcoes, d.turnos, d.cobertura, d.feriados, d.inicioEscala, d.semanas, d.regrasPessoais, d.incluirContratacoes, d.incluirContratacoes ? d.etapaImpacto : null, d.incluirContratacoes && d.permitirParcial, d.horariosPasso4])
}
/** Escala como saiu do gerador (e da correção automática): o que difere dela são ajustes manuais. */
let escalaBase: Escala | null = null
/** Dias travados usados na última geração (ajustes manuais mantidos ao refazer a escala). */
let travasAtivas: Travas = {}
const travado = (fid: string, dia: number) => travasAtivas[fid]?.[dia] !== undefined

/** Dias em que a escala atual difere da gerada, como travas (trabalho leva o horário do dia). */
export function travasDaDiferenca(base: Escala, atual: Escala): Travas {
  const out: Travas = {}
  const turno = (e: Escala, id?: string) => e.turnos.find((t) => t.id === id)
  for (const f of atual.funcionarios) {
    const b = base.celulas[f.id]
    const a = atual.celulas[f.id]
    if (!b || !a) continue
    a.forEach((c, i) => {
      const o = b[i]
      const tb = turno(base, o?.turnoId)
      const ta = turno(atual, c.turnoId)
      const igual =
        o?.tipo === c.tipo &&
        (c.tipo !== 'trabalho' || (tb?.inicio === ta?.inicio && tb?.fim === ta?.fim && tb?.intervaloMin === ta?.intervaloMin))
      if (igual) return
      ;(out[f.id] ??= {})[i] =
        c.tipo === 'trabalho' && ta
          ? { tipo: 'trabalho', horario: { entrada: ta.inicio, saida: ta.fim, intervaloMin: ta.intervaloMin } }
          : { tipo: c.tipo }
    })
  }
  return out
}

/** Junta travas (as de `b` valem sobre as de `a`), copiando para não alterar as originais. */
function mesclarTravas(a: Travas, b: Travas): Travas {
  const out: Travas = {}
  for (const src of [a, b]) {
    for (const [fid, dias] of Object.entries(src)) {
      for (const [dia, t] of Object.entries(dias)) {
        ;(out[fid] ??= {})[Number(dia)] = { ...t, ...(t.horario ? { horario: { ...t.horario } } : {}) }
      }
    }
  }
  return out
}

/** Quantos dias ajustados à mão foram mantidos na última geração. */
export function diasTravados(): number {
  return Object.values(travasAtivas).reduce((n, dias) => n + Object.keys(dias).length, 0)
}

const portalInicial: EstadoPortal | null = codigoPortal
  ? { codigo: codigoPortal, carregando: true, erro: null, nenhumEmpregado: false }
  : null

export const useStore = create<Store>((set, get) => {
  /** Troca a escala por uma edição manual, guardando a anterior no histórico. */
  const editar = (nova: Escala) => {
    const atual = get().escala
    if (!atual) return
    set({ escala: nova, historico: hist.registrar(get().historico, atual) })
  }
  return {
    ...inicial,
    portal: portalInicial,
    historico: hist.limpar(),
    desfazer: () => {
      const atual = get().escala
      const r = atual && hist.desfazer(get().historico, atual)
      if (r) set({ escala: r.valor, historico: r.h })
    },
    refazer: () => {
      const atual = get().escala
      const r = atual && hist.refazer(get().historico, atual)
      if (r) set({ escala: r.valor, historico: r.h })
    },
    corrigirAutomaticamente: () => {
      const d = get()
      if (!d.escala) return { antes: [], depois: [] }
      const antes = analisar(d, d.escala).alertas
      const r = corrigirTudo(d.escala, (e) => analisar(d, e), undefined, undefined, travado)
      if (r.aplicadas === 0) return { antes, depois: antes }
      editar(r.escala)
      return { antes, depois: analisar(d, r.escala).alertas }
    },
    carregarDoPortal: async (codigo) => {
      set({ portal: { codigo, carregando: true, erro: null, nenhumEmpregado: false } })
      baseBanco = null
      dadosBanco = null
      const sobreposicoes = carregar<Salvo>()?.sobreposicoes
      try {
        const dados = await carregarDadosPortal(codigo)
        const { nomeEmpresa, funcoes: doBanco } = mapearDadosPortal(dados, get().regrasPessoais)
        const funcoes = aplicarSobreposicoes(doBanco, sobreposicoes)
        baseBanco = doBanco
        dadosBanco = dados
        const nenhumEmpregado = !funcoes.some((f) => (f.pessoas?.length ?? 0) > 0)
        set({
          empresa: { ...get().empresa, nome: nomeEmpresa },
          funcoes,
          escala: null,
          propostas: [],
          comparar: [],
          propostaAtivaId: null,
          historico: hist.limpar(),
          portal: { codigo, carregando: false, erro: null, nenhumEmpregado },
        })
      } catch (e) {
        const erro = e instanceof Error ? e.message : 'Não foi possível carregar os dados da empresa'
        set({ portal: { codigo, carregando: false, erro, nenhumEmpregado: false } })
      }
    },
    set: (parcial) => set(parcial),
    setEmpresa: (p) => set({ empresa: { ...get().empresa, ...p } }),
    elevarCargaDaEquipe: (limiteH) =>
      set({
        funcoes: elevarCarga(get().funcoes, limiteH).funcoes,
        escala: null,
        propostas: [],
        comparar: [],
        propostaAtivaId: null,
        historico: hist.limpar(),
      }),
    atualizarFeriados: (lista) => {
      const d = get()
      const sincronizada = assinaturaGeracao !== null && assinaturaGeracao === assinaturaDosDados(d)
      const antes = d.feriados.map((f) => f.data)
      const depois = lista.map((f) => f.data)
      // Empresa que funciona em feriado não marca "feriado" nas células.
      const ajustar = (e: Escala) => (d.empresa.funcionaFeriados ? e : ajustarFeriadosNaEscala(e, antes, depois))
      const propostas = d.propostas.map((p) => ({ ...p, escala: ajustar(p.escala) }))
      const proposta = d.propostas.find((p) => p.id === d.propostaAtivaId)
      let escala = d.escala
      let historico = d.historico
      if (escala) {
        // Escala igual à da proposta: acompanha a proposta; com ajustes manuais, ajusta a própria escala.
        const nova = proposta && escala === proposta.escala ? propostas.find((p) => p.id === proposta.id)!.escala : ajustar(escala)
        if (nova !== escala) {
          historico = hist.registrar(historico, escala)
          escala = nova
        }
      }
      set({ feriados: lista, propostas, escala, historico })
      // A escala já reflete a nova lista: voltar ao Passo 4 não precisa regerar (nem apagar os ajustes).
      if (sincronizada) assinaturaGeracao = assinaturaDosDados(get())
    },
    setRegrasPessoais: (parcial) => {
      const regras = { ...get().regrasPessoais, ...parcial }
      if (!baseBanco || !dadosBanco) {
        set({ regrasPessoais: regras })
        return
      }
      // Portal: preserva as edições do usuário e reaplica sobre a equipe re-mapeada com as novas regras.
      const sob = calcularSobreposicoes(baseBanco, get().funcoes)
      const { funcoes: doBanco } = mapearDadosPortal(dadosBanco, regras)
      baseBanco = doBanco
      set({
        regrasPessoais: regras,
        funcoes: aplicarSobreposicoes(doBanco, sob),
        escala: null,
        propostas: [],
        comparar: [],
        propostaAtivaId: null,
        historico: hist.limpar(),
      })
    },
    setCelula: (fid, dia, valor) => {
      const escala = get().escala
      if (!escala) return
      // Trocar o horário de um dia trabalhado por outro = alterar o horário de trabalho da pessoa:
      // o motor refaz a escala com esse horário fixo (e as regras do passo 3).
      const atual = escala.celulas[fid]?.[dia]
      if (atual?.tipo === 'trabalho' && valor.tipo === 'trabalho' && atual.turnoId !== valor.turnoId) {
        const t = escala.turnos.find((x) => x.id === valor.turnoId)
        if (t) {
          get().definirHorario(fid, { entrada: t.inicio, saida: t.fim, intervaloMin: t.intervaloMin })
          return
        }
      }
      editar(aplicarCorrecao(escala, [{ funcionarioId: fid, dia, novo: valor }]))
    },
    definirHorario: (fid, h) => {
      const atuais = { ...get().horariosPasso4 }
      if (h) atuais[fid] = h
      else delete atuais[fid]
      // Ajustes manuais (o que difere da escala gerada) viram dias travados: o motor refaz só o resto.
      const escala = get().escala
      const travas = mesclarTravas(travasAtivas, escala && escalaBase ? travasDaDiferenca(escalaBase, escala) : {})
      // Nos dias de trabalho travados da própria pessoa, vale o horário novo.
      for (const t of Object.values(travas[fid] ?? {})) if (t.tipo === 'trabalho') delete t.horario
      set({ horariosPasso4: atuais })
      gerar(travas)
    },
    trocarCelulas: (a, b) => {
      const escala = get().escala
      if (!escala) return
      const ca = escala.celulas[a.f][a.d]
      const cb = escala.celulas[b.f][b.d]
      editar(
        aplicarCorrecao(escala, [
          { funcionarioId: a.f, dia: a.d, novo: cb },
          { funcionarioId: b.f, dia: b.d, novo: ca },
        ]),
      )
    },
    corrigir: (correcao) => {
      const escala = get().escala
      if (escala) editar(aplicarCorrecao(escala, correcao))
    },
    usarProposta: (id) => {
      const p = get().propostas.find((x) => x.id === id)
      if (!p) return
      escalaBase = p.escala
      set({ escala: p.escala, propostaAtivaId: id, historico: hist.limpar() })
    },
    sugerirEscala: () => gerar({}),
    autoCorrigirInicial: () => {
      const d = get()
      if (!d.escala) return 0
      const r = corrigirTudo(d.escala, (e) => analisar(d, e), undefined, undefined, travado)
      // Correção automática não é ajuste manual: a base acompanha.
      if (r.aplicadas > 0) {
        escalaBase = r.escala
        set({ escala: r.escala })
      }
      return r.aplicadas
    },
    irParaPasso: (i) => {
      const d = get()
      // Ao abrir a Escala, só regera se os passos 1-3 mudaram desde a última geração:
      // assim voltar ao Passo 4 (ou clicar nele de novo) não apaga os ajustes manuais.
      const manter = i === 3 && d.escala !== null && assinaturaGeracao === assinaturaDosDados(d)
      if (manter) {
        set({ passo: i, historico: hist.limpar() })
        return
      }
      set({ passo: i, historico: hist.limpar() })
      if (i === 3) get().sugerirEscala()
    },
    reiniciar: () => {
      clearTimeout(timer)
      limpar()
      assinaturaGeracao = null
      escalaBase = null
      travasAtivas = {}
      set({ ...DADOS_PADRAO, historico: hist.limpar() })
      const portal = get().portal
      if (portal) void get().carregarDoPortal(portal.codigo)
    },
  }

  /**
   * Gera as propostas a partir dos passos 1–3 e dos horários fixados no passo 4, mantendo os dias travados
   * (ajustes manuais); com `{}`, é a sugestão do zero.
   */
  function gerar(travas: Travas) {
      const d = get()
      travasAtivas = travas
      const entrada = {
        empresa: d.empresa,
        funcoes: d.funcoes,
        turnos: d.turnos,
        cobertura: d.cobertura,
        feriados: d.feriados.map((f) => f.data),
        inicio: d.inicioEscala,
        semanas: d.semanas,
        regrasPessoais: d.regrasPessoais,
        horariosFixos: d.horariosPasso4,
        travas,
      }
      // Com as contratações incluídas, cada modelo acrescenta as vagas de que precisa (e só elas).
      const novas = d.incluirContratacoes
        ? gerarPropostasComVagas(
            entrada,
            ordemDeVagasDosDados(d),
            criarMedidorDeFuros(d),
            d.permitirParcial ? CONTRATOS_PARCIAIS : [],
          )
        : gerarPropostas(entrada)
      const corrigidas = novas.map((p) => ({
        ...p,
        escala: corrigirTudo(p.escala, (e) => analisar(d, e), undefined, undefined, travado).escala,
      }))
      const ativa = corrigidas.find((p) => p.id === d.propostaAtivaId) ?? corrigidas[0]
      assinaturaGeracao = assinaturaDosDados(d)
      escalaBase = ativa.escala
      set({
        propostas: corrigidas,
        comparar: corrigidas.map((p) => p.id),
        escala: ativa.escala,
        propostaAtivaId: ativa.id,
        historico: hist.limpar(),
      })
  }
})

// Persistência (debounce simples); a camada real está em services/storage.ts
let timer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((estado) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const portal = estado.portal
    if (portal && (portal.carregando || portal.erro || !baseBanco)) return
    // Portal: nada de dados pessoais (funcoes/escala/propostas ficam só na sessão).
    const pessoais: Partial<Salvo> = portal
      ? {}
      : { funcoes: estado.funcoes, escala: estado.escala, propostas: estado.propostas }
    const dados: Salvo = {
      passo: estado.passo,
      empresa: estado.empresa,
      ...pessoais,
      turnos: estado.turnos,
      cobertura: estado.cobertura,
      feriados: estado.feriados,
      custo: estado.custo,
      inicioEscala: estado.inicioEscala,
      semanas: estado.semanas,
      comparar: estado.comparar,
      etapaImpacto: estado.etapaImpacto,
      propostaAtivaId: estado.propostaAtivaId,
      regrasPessoais: estado.regrasPessoais,
      incluirContratacoes: estado.incluirContratacoes,
      permitirParcial: estado.permitirParcial,
      horariosPasso4: estado.horariosPasso4,
    }
    if (portal && baseBanco) dados.sobreposicoes = calcularSobreposicoes(baseBanco, estado.funcoes)
    salvar(dados)
  }, 300)
})
