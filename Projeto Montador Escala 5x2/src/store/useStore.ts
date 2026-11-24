import { create } from 'zustand'
import { FERIADOS_PADRAO, type Feriado } from '../config/feriados'
import { corrigirTudo } from '../engine/autocorrecao'
import { aplicarCorrecao } from '../engine/conformidade'
import { gerarPropostas } from '../engine/gerador'
import { CUSTO_PADRAO } from '../engine/impacto'
import type {
  AlteracaoCelula,
  CoberturaTurno,
  DiaEscala,
  Empresa,
  Escala,
  Funcao,
  ParametrosCusto,
  Proposta,
  Turno,
} from '../types'
import { carregar, limpar, salvar } from '../services/storage'
import { analisar } from '../utils/analise'

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
  fim: '17:00',
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
      jornadaContratual: '44h semanais',
      horasSemanaisAtuais: 44,
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
}

interface Acoes {
  set: (parcial: Partial<Dados>) => void
  setEmpresa: (p: Partial<Empresa>) => void
  setCelula: (funcionarioId: string, dia: number, valor: DiaEscala) => void
  trocarCelulas: (a: { f: string; d: number }, b: { f: string; d: number }) => void
  corrigir: (correcao: AlteracaoCelula[]) => void
  usarProposta: (id: string) => void
  /** Regenera as propostas a partir dos passos 1–3 (já com correções automáticas). */
  sugerirEscala: () => void
  /** Navega para um passo; ao abrir a Escala, atualiza a sugestão com os dados atuais. */
  irParaPasso: (i: number) => void
  reiniciar: () => void
}

export type Store = Dados & Acoes

const inicial: Dados = { ...DADOS_PADRAO, ...(carregar<Partial<Dados>>() ?? {}) }

export const useStore = create<Store>((set, get) => ({
  ...inicial,
  set: (parcial) => set(parcial),
  setEmpresa: (p) => set({ empresa: { ...get().empresa, ...p } }),
  setCelula: (fid, dia, valor) => {
    const escala = get().escala
    if (!escala) return
    set({ escala: aplicarCorrecao(escala, [{ funcionarioId: fid, dia, novo: valor }]) })
  },
  trocarCelulas: (a, b) => {
    const escala = get().escala
    if (!escala) return
    const ca = escala.celulas[a.f][a.d]
    const cb = escala.celulas[b.f][b.d]
    set({
      escala: aplicarCorrecao(escala, [
        { funcionarioId: a.f, dia: a.d, novo: cb },
        { funcionarioId: b.f, dia: b.d, novo: ca },
      ]),
    })
  },
  corrigir: (correcao) => {
    const escala = get().escala
    if (escala) set({ escala: aplicarCorrecao(escala, correcao) })
  },
  usarProposta: (id) => {
    const p = get().propostas.find((x) => x.id === id)
    if (p) set({ escala: p.escala, propostaAtivaId: id })
  },
  sugerirEscala: () => {
    const d = get()
    const novas = gerarPropostas({
      empresa: d.empresa,
      funcoes: d.funcoes,
      turnos: d.turnos,
      cobertura: d.cobertura,
      feriados: d.feriados.map((f) => f.data),
      inicio: d.inicioEscala,
      semanas: d.semanas,
    })
    const corrigidas = novas.map((p) => ({
      ...p,
      escala: corrigirTudo(p.escala, (e) => analisar(d, e)).escala,
    }))
    const ativa = corrigidas.find((p) => p.id === d.propostaAtivaId) ?? corrigidas[0]
    set({
      propostas: corrigidas,
      comparar: corrigidas.map((p) => p.id),
      escala: ativa.escala,
      propostaAtivaId: ativa.id,
    })
  },
  irParaPasso: (i) => {
    set({ passo: i })
    if (i === 3) get().sugerirEscala()
  },
  reiniciar: () => {
    limpar()
    set({ ...DADOS_PADRAO })
  },
}))

// Persistência (debounce simples); a camada real está em services/storage.ts
let timer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((estado) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const dados: Dados = {
      passo: estado.passo,
      empresa: estado.empresa,
      funcoes: estado.funcoes,
      turnos: estado.turnos,
      cobertura: estado.cobertura,
      feriados: estado.feriados,
      custo: estado.custo,
      inicioEscala: estado.inicioEscala,
      semanas: estado.semanas,
      escala: estado.escala,
      propostas: estado.propostas,
      comparar: estado.comparar,
      etapaImpacto: estado.etapaImpacto,
      propostaAtivaId: estado.propostaAtivaId,
    }
    salvar(dados)
  }, 300)
})
