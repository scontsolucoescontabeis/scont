/**
 * REGRAS LEGAIS PARAMETRIZADAS — EC 141/2026 (fim da escala 6x1).
 *
 * Este é o ÚNICO lugar onde limites e datas legais vivem. O motor de
 * conformidade e a interface leem tudo daqui; cada alerta cita o `id` do
 * parâmetro (ex.: "etapa1.jornadaSemanalMax"). Para refletir decreto ou
 * decisão do STF, edite este arquivo e atualize `versao` e `atualizadoEm`.
 */

export type ModoTransicao = 'padrao' | 'flexivel_stf'

export interface LimitesEtapa {
  /** Primeiro dia de vigência (YYYY-MM-DD). */
  inicio: string
  /** Jornada semanal máxima, em horas. */
  jornadaSemanalMax: number
  /** Nº de repousos semanais remunerados exigidos. */
  repousosSemanais: number
  /** Se true, ao menos 1 dos repousos deve ser, preferencialmente, no domingo. */
  repousoPreferencialDomingo: boolean
}

export interface RegrasLegais {
  versao: string
  atualizadoEm: string
  /** Regime anterior (CF art. 7º, XIII e XV): 44h semanais e 1 repouso. */
  legado: Omit<LimitesEtapa, 'inicio'>
  etapa1: LimitesEtapa
  etapa2: LimitesEtapa
  jornadaDiariaMax: number
  interjornadaMinHoras: number
  intrajornada: {
    /** Jornada acima deste nº de horas exige o intervalo longo. */
    acimaDeHoras: number
    minLongoMinutos: number
    /** Jornada acima deste nº de horas (e até `acimaDeHoras`) exige o intervalo curto. */
    acimaDeHorasCurto: number
    minCurtoMinutos: number
  }
  /**
   * "padrao": aplica a etapa 1 como escrita acima.
   * "flexivel_stf": preparado para a flexibilização da 1ª etapa para empresas
   * sem acordo coletivo (decisão do ministro Flávio Dino). Detalhes NÃO
   * confirmados: neste modo o motor apenas rebaixa de vermelho para amarelo
   * as infrações próprias da etapa 1, pedindo validação do DP.
   */
  modoTransicao: ModoTransicao
  avisoLegal: string
  /** Base legal citada no rodapé dos relatórios. */
  baseLegal: string[]
}

export const REGRAS: RegrasLegais = {
  versao: '2026.11-rascunho-1',
  atualizadoEm: '2026-11-18',

  legado: {
    jornadaSemanalMax: 44,
    repousosSemanais: 1,
    repousoPreferencialDomingo: true,
  },

  etapa1: {
    // TODO: confirmar 15 ou 16/12/2026 no texto oficial da EC 141/2026.
    inicio: '2026-12-16',
    jornadaSemanalMax: 42,
    repousosSemanais: 2,
    repousoPreferencialDomingo: true,
  },

  etapa2: {
    inicio: '2027-12-16',
    jornadaSemanalMax: 40,
    repousosSemanais: 2,
    repousoPreferencialDomingo: true,
  },

  // 8h24 líquidas = 42h ÷ 5 dias (distribuição da 1ª etapa em cinco jornadas, sem horas extras).
  jornadaDiariaMax: 8.4,
  interjornadaMinHoras: 11,

  intrajornada: {
    acimaDeHoras: 6,
    minLongoMinutos: 60,
    acimaDeHorasCurto: 4,
    minCurtoMinutos: 15,
  },

  modoTransicao: 'padrao',

  avisoLegal:
    'Esta ferramenta é um apoio ao planejamento e NÃO substitui a análise do Departamento Pessoal ' +
    'nem de assessoria jurídica. Os parâmetros seguem a EC 141/2026 conforme interpretação vigente na ' +
    'data de atualização indicada e podem mudar por regulamentação, decisão do STF ou convenção coletiva. ' +
    'Valores de custo são ESTIMATIVAS.',

  // Texto informado pelo responsável da ferramenta; conferir na fonte oficial ao atualizar `versao`.
  baseLegal: [
    'Vigência da 1ª etapa da EC 141/2026: 16/12/2026 (há fonte que indica 15/12/2026; trate 15/12 como prazo interno).',
    'Liminar do STF de 12/11/2026 (ADIs 8.041 e 8.042): permite, sem convenção ou acordo coletivo até 15/12/2026, distribuir as 42 horas em cinco jornadas de até 8h24, sem horas extras, até 15/12/2027.',
    'A decisão ainda depende de referendo do Plenário; em 17/11/2026 o rito foi convertido em julgamento de mérito.',
  ],
}

/** Identificadores de regra citados nas mensagens de conformidade. */
export type RegraId =
  | 'etapa1.repousosSemanais'
  | 'etapa1.repousoPreferencialDomingo'
  | 'etapa1.jornadaSemanalMax'
  | 'etapa2.jornadaSemanalMax'
  | 'etapa2.repousosSemanais'
  | 'etapa2.repousoPreferencialDomingo'
  | 'legado.repousoPreferencialDomingo'
  | 'legado.jornadaSemanalMax'
  | 'legado.repousosSemanais'
  | 'jornadaDiariaMax'
  | 'interjornadaMinHoras'
  | 'intrajornada'
  | 'cobertura'
  | 'domingoFeriadoTrabalhado'

export type EtapaId = 'legado' | 'etapa1' | 'etapa2'

/** Etapa em vigor em determinada data (YYYY-MM-DD). */
export function etapaVigente(data: string, regras: RegrasLegais = REGRAS): EtapaId {
  if (data >= regras.etapa2.inicio) return 'etapa2'
  if (data >= regras.etapa1.inicio) return 'etapa1'
  return 'legado'
}

export function limitesDaEtapa(
  etapa: EtapaId,
  regras: RegrasLegais = REGRAS,
): Omit<LimitesEtapa, 'inicio'> {
  return etapa === 'legado' ? regras.legado : regras[etapa]
}

export const NOME_ETAPA: Record<EtapaId, string> = {
  legado: 'regra atual (antes da EC 141/2026)',
  etapa1: '1ª etapa da EC 141/2026',
  etapa2: '2ª etapa da EC 141/2026',
}
