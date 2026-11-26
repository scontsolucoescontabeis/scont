export type TipoDia = 'trabalho' | 'folga' | 'dsr' | 'feriado' | 'ausencia'

/**
 * Horário de trabalho (em `Escala.turnos`) ou, no passo 3, um PERÍODO do
 * estabelecimento com mínimo de pessoas (`intervaloMin` não se aplica).
 * Se fim <= inicio, termina no dia seguinte.
 */
export interface Turno {
  id: string
  nome: string
  inicio: string // HH:mm
  fim: string // HH:mm
  intervaloMin: number
}

export interface DiaEscala {
  tipo: TipoDia
  /** Obrigatório quando tipo === 'trabalho'. */
  turnoId?: string
}

export interface Funcionario {
  id: string
  nome: string
  funcaoId: string
  /** Atributos da pessoa (equipe nominal); ausentes no modo avulso. */
  sexo?: 'F' | 'M'
  menor?: boolean
  estagiario?: boolean
  /** Vaga a contratar (não é uma pessoa da equipe atual): entra na proposta para cobrir a cobertura mínima. */
  vaga?: boolean
  /** Contrato em tempo parcial (CLT art. 58-A): horas por semana. Só nas vagas a contratar. */
  horasSemanais?: number
}

export interface Escala {
  /** Primeiro dia (YYYY-MM-DD). */
  inicio: string
  /** Quantidade de dias (28 a 42). */
  dias: number
  funcionarios: Funcionario[]
  turnos: Turno[]
  /** funcionarioId -> um DiaEscala por dia. */
  celulas: Record<string, DiaEscala[]>
}

/** Mínimo de pessoas em determinado turno (e função, se informada) nos dias da semana indicados. */
export interface RegraCobertura {
  id: string
  turnoId: string
  funcaoId?: string
  minimo: number
  /** 0 = domingo ... 6 = sábado */
  diasSemana: number[]
  /** Nome da função (só para citar nas mensagens quando `funcaoId` é informado). */
  rotulo?: string
}

export type Severidade = 'verde' | 'amarelo' | 'vermelho'

export interface AlteracaoCelula {
  funcionarioId: string
  /** Índice do dia dentro da escala. */
  dia: number
  novo: DiaEscala
}

export interface Alerta {
  id: string
  /** Id do parâmetro em regras.ts que originou o alerta. */
  regraId: import('./config/regras').RegraId
  severidade: Exclude<Severidade, 'verde'>
  titulo: string
  mensagem: string
  sugestao: string
  funcionarioId?: string
  /** YYYY-MM-DD (ou início da semana, para alertas semanais). */
  data?: string
  correcao?: AlteracaoCelula[]
}

export interface ResultadoConformidade {
  semaforo: Severidade
  alertas: Alerta[]
  contagem: { vermelho: number; amarelo: number }
}

/** Pessoa real (nominal) de uma função, vinda do banco no portal do cliente. */
export interface PessoaEscala {
  id: string
  nome: string
  escalar: boolean
  /** Sem jornada cadastrada: usa a jornada padrão (44h). */
  jornadaPadrao: boolean
  horasSemanais?: number
  entrada?: string
  saida?: string
  intervaloMin?: number
  ferias: { inicio: string; fim: string }[]
  /** Sexo cadastrado no banco; ausente quando não informado. Nunca vem de edição do usuário. */
  sexo?: 'F' | 'M'
  /** Menor de 18 anos (banco). */
  menor: boolean
  /** Estagiário (banco, pelo tipo do empregado). */
  estagiario: boolean
}

/** Regras por pessoa configuráveis pelo usuário (não são dados pessoais; são persistidas). */
export type RegrasPessoais = {
  /** Mulheres: ao menos 1 domingo de folga a cada 2 semanas (CLT art. 386). */
  mulheresDomingoQuinzenal: boolean
  /** Carga semanal do estagiário (Lei 11.788/2008 art. 10). */
  estagioHorasSemanais: 20 | 30 | 40
}

export interface Funcao {
  id: string
  nome: string
  quantidade: number
  jornadaContratual: string // "44h", "6x1", "12x36"...
  horasSemanaisAtuais: number
  salarioBase?: number
  /** Horário fixo desta função (HH:mm). Sem ele, o gerador monta a jornada. */
  entrada?: string
  saida?: string
  intervaloMin?: number
  /** Equipe nominal (portal do cliente). */
  pessoas?: PessoaEscala[]
}

export type AcordoColetivo = 'sim' | 'nao' | 'nao_sei'

export interface Empresa {
  nome: string
  setor: string
  /** Índice 0 = domingo ... 6 = sábado. */
  diasFuncionamento: boolean[]
  /** Horário padrão; vale para os dias sem horário próprio em `horarios`. */
  horaAbertura: string
  horaFechamento: string
  /** Horário específico por dia (0 = domingo ... 6 = sábado); sobrepõe o padrão. */
  horarios?: Record<number, { abre: string; fecha: string }>
  funcionaFeriados: boolean
  acordoColetivo: AcordoColetivo
  /** Existe acordo/banco de horas que permita compensar a jornada diária. */
  compensacaoDiaria: boolean
}

/** Dia útil (dia da semana do JS): 1 = segunda ... 5 = sexta. */
export type DiaUtil = 1 | 2 | 3 | 4 | 5

/**
 * Mínimo de pessoas: dias úteis, sábado e domingo. `porDia` (opcional) sobrepõe
 * `util` em um dia útil específico; sem ele, segunda a sexta valem `util`.
 */
export interface MinimosDia {
  util: number
  sab: number
  dom: number
  porDia?: Partial<Record<DiaUtil, number>>
}

/**
 * Mínimo de pessoas por período: dias úteis, sábado e domingo (total, de qualquer
 * função). `porFuncao` (opcional) exige, além do total, um mínimo de cada função.
 */
export interface CoberturaTurno extends MinimosDia {
  porFuncao?: Record<string, MinimosDia>
}

export interface ParametrosCusto {
  encargosPct: number
  horaExtraPct: number
}

export type ModeloEscala = 'fixo' | 'rodizio_domingo' | 'folga_movel'

/** Contratações que uma proposta de escala exige (vagas já escaladas no calendário dela). */
export interface ContratacaoProposta {
  funcaoId: string
  nome: string
  /** Total de vagas (tempo integral + parcial). */
  quantidade: number
  /** Horas semanais de cada vaga em tempo parcial (as demais, `quantidade - parciais.length`, são em tempo integral). */
  parciais?: number[]
}

export interface Proposta {
  id: string
  modelo: ModeloEscala
  nome: string
  descricao: string
  escala: Escala
  /** Vagas a contratar incluídas nesta proposta; ausente/vazio = a equipe atual dá conta. */
  contratacoes?: ContratacaoProposta[]
}
