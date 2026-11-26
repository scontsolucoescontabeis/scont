/**
 * Regras de decisão do passo 4 ("Monte a escala"), puras e testadas. Os
 * componentes só desenham o que estas funções devolvem.
 */
import type { RegraId } from '../config/regras'
import { diffDias } from '../engine/datas'
import { contarDomingosTrabalhados } from '../engine/gerador'
import type { Alerta, DiaEscala, Escala, Funcao, Funcionario } from '../types'
import { datasDaEscala, rotuloTurno } from './analise'

// ---------- menu da célula ----------

export interface OpcaoCelula {
  id: string
  rotulo: string
  valor: DiaEscala
  atual: boolean
}

/** Opções do menu de uma célula: um "Trabalhar" por horário, folga, DSR, ausência e (se for o caso) feriado. */
export function opcoesDaCelula(escala: Escala, funcionarioId: string, dia: number, feriados: string[]): OpcaoCelula[] {
  const atual = escala.celulas[funcionarioId]?.[dia]
  const data = datasDaEscala(escala)[dia]
  const ehAtual = (v: DiaEscala) =>
    !!atual && atual.tipo === v.tipo && (v.tipo !== 'trabalho' || atual.turnoId === v.turnoId)
  const ops: Omit<OpcaoCelula, 'atual'>[] = [
    ...escala.turnos.map((t) => ({
      id: `trabalho:${t.id}`,
      // o gerador costuma nomear o horário pelo próprio horário: não repete
      rotulo: t.nome === rotuloTurno(t) ? `Trabalhar — ${rotuloTurno(t)}` : `Trabalhar — ${t.nome} (${rotuloTurno(t)})`,
      valor: { tipo: 'trabalho' as const, turnoId: t.id },
    })),
    { id: 'folga', rotulo: 'Folga', valor: { tipo: 'folga' } },
    { id: 'dsr', rotulo: 'Descanso semanal (DSR)', valor: { tipo: 'dsr' } },
    { id: 'ausencia', rotulo: 'Ausência (férias/atestado)', valor: { tipo: 'ausencia' } },
  ]
  if (feriados.includes(data) || atual?.tipo === 'feriado') {
    ops.push({ id: 'feriado', rotulo: 'Feriado', valor: { tipo: 'feriado' } })
  }
  return ops.map((o) => ({ ...o, atual: ehAtual(o.valor) }))
}

// ---------- alertas na célula ----------

/** Alertas que valem para a semana inteira a partir de `data` (mesma regra que o calendário sempre usou). */
function ehSemanal(a: Alerta): boolean {
  return a.id.startsWith('rep|') || a.id.startsWith('dom|') || a.id.startsWith('sem|')
}

/** Índices dos dias que o alerta marca no calendário (vazio se não for de uma pessoa/dia). */
export function diasDoAlerta(a: Alerta, datas: string[]): number[] {
  if (!a.funcionarioId || !a.data) return []
  const i = datas.indexOf(a.data)
  if (i < 0) return []
  if (!ehSemanal(a)) return [i]
  return Array.from({ length: 7 }, (_, k) => i + k).filter((x) => x < datas.length)
}

/** Alertas que apontam para esta pessoa neste dia (inclusive os semanais que cobrem o dia). */
export function alertasDaCelula(alertas: Alerta[], funcionarioId: string, dia: number, inicioEscala: string): Alerta[] {
  return alertas.filter((a) => {
    if (a.funcionarioId !== funcionarioId || !a.data) return false
    const i = diffDias(inicioEscala, a.data)
    if (i < 0) return false
    return ehSemanal(a) ? dia >= i && dia < i + 7 : dia === i
  })
}

/** Mapa "funcionarioId|dia" → cor mais grave, para pintar a marca do canto. */
export function marcasDasCelulas(alertas: Alerta[], datas: string[]): Map<string, 'amarelo' | 'vermelho'> {
  const m = new Map<string, 'amarelo' | 'vermelho'>()
  for (const a of alertas) {
    for (const i of diasDoAlerta(a, datas)) {
      const k = `${a.funcionarioId}|${i}`
      if (m.get(k) !== 'vermelho') m.set(k, a.severidade)
    }
  }
  return m
}

const REPOUSOS = {
  titulo: 'Faltam dias de descanso nesta semana',
  oQueFazer: 'Marque mais uma folga ou um DSR para esta pessoa nesta semana.',
}
const DOMINGO = {
  titulo: 'O descanso semanal deveria cair no domingo',
  oQueFazer: 'Troque o DSR desta pessoa para o domingo ou faça um rodízio de domingos com a equipe.',
}
const SEMANAL = {
  titulo: 'Horas demais nesta semana',
  oQueFazer: 'Tire um dia de trabalho desta semana ou escolha um horário mais curto em algum dia.',
}

/** Explicação em linguagem simples de cada regra do motor. */
export const EXPLICACOES: Record<RegraId, { titulo: string; oQueFazer: string }> = {
  'legado.repousosSemanais': REPOUSOS,
  'etapa1.repousosSemanais': REPOUSOS,
  'etapa2.repousosSemanais': REPOUSOS,
  'legado.repousoPreferencialDomingo': DOMINGO,
  'etapa1.repousoPreferencialDomingo': DOMINGO,
  'etapa2.repousoPreferencialDomingo': DOMINGO,
  'legado.jornadaSemanalMax': SEMANAL,
  'etapa1.jornadaSemanalMax': SEMANAL,
  'etapa2.jornadaSemanalMax': SEMANAL,
  jornadaDiariaMax: {
    titulo: 'Horas demais neste dia',
    oQueFazer: 'Escolha um horário mais curto para este dia.',
  },
  interjornadaMinHoras: {
    titulo: 'Pouco descanso entre um dia e o outro',
    oQueFazer: 'Troque o horário deste dia ou do dia anterior para dar mais tempo de descanso entre eles.',
  },
  intrajornada: {
    titulo: 'Intervalo de almoço curto demais',
    oQueFazer: 'Aumente o intervalo deste horário (passo da equipe ou dos horários).',
  },
  intervaloMaxMinutos: {
    titulo: 'Intervalo de almoço longo demais',
    oQueFazer: 'Diminua o intervalo deste horário (passo da equipe ou dos horários).',
  },
  cobertura: {
    titulo: 'Falta gente neste horário',
    oQueFazer: 'Escale mais alguém neste dia ou passe a folga de alguém para outro dia.',
  },
  domingoFeriadoTrabalhado: {
    titulo: 'Trabalho em domingo ou feriado',
    oQueFazer: 'Confira com o DP a folga compensatória ou o pagamento em dobro deste dia.',
  },
  domingoRodizio: {
    titulo: 'Muitos domingos seguidos trabalhados',
    oQueFazer: 'Dê um domingo de folga (DSR) a esta pessoa e passe o domingo para quem folgou há mais tempo.',
  },
  domingoMulher: {
    titulo: 'Funcionária sem domingo de folga na quinzena',
    oQueFazer: 'Dê a esta funcionária um domingo de folga a cada duas semanas.',
  },
  diasConsecutivosMax: {
    titulo: 'Muitos dias seguidos de trabalho',
    oQueFazer: 'Folgue esta pessoa em outro dia ou troque o turno com alguém.',
  },
  repousoSemanalInterjornada: {
    titulo: 'Descanso semanal curto demais',
    oQueFazer: 'Termine mais cedo no dia antes da folga ou comece mais tarde no dia seguinte.',
  },
  jornadaNoturna: {
    titulo: 'Horário com trabalho noturno',
    oQueFazer: 'Confira com o DP o adicional noturno e a hora noturna reduzida deste horário.',
  },
  estagioJornada: {
    titulo: 'Estágio acima da carga permitida',
    oQueFazer: 'Escolha um horário mais curto ou tire um dia de estágio desta semana.',
  },
  menorJornada: {
    titulo: 'Menor de idade com jornada longa demais',
    oQueFazer: 'Escolha um horário de no máximo 8 horas, sem hora extra, para esta pessoa.',
  },
  menorNoturno: {
    titulo: 'Menor de idade em horário noturno',
    oQueFazer: 'Troque para um horário que termine antes das 22h e comece depois das 5h.',
  },
}

export function explicacao(alerta: Alerta): { titulo: string; oQueFazer: string } {
  return (
    (EXPLICACOES as Partial<Record<string, { titulo: string; oQueFazer: string }>>)[alerta.regraId] ?? {
      titulo: alerta.titulo || alerta.mensagem,
      oQueFazer: alerta.mensagem,
    }
  )
}

// ---------- correção automática ----------

export function resumoCorrecao(antes: Alerta[], depois: Alerta[]): { corrigidos: number; restantes: number } {
  const ficaram = new Set(depois.map((a) => a.id))
  return { corrigidos: antes.filter((a) => !ficaram.has(a.id)).length, restantes: depois.length }
}

/** Frase do resultado da correção automática. */
export function fraseCorrecao(r: { corrigidos: number; restantes: number }): string {
  const c =
    r.corrigidos === 0
      ? 'Nenhum alerta pôde ser corrigido automaticamente'
      : r.corrigidos === 1
        ? '1 alerta corrigido'
        : `${r.corrigidos} alertas corrigidos`
  const resto =
    r.restantes === 0
      ? 'não sobrou nenhum alerta'
      : r.restantes === 1
        ? 'resta 1 que precisa da sua decisão'
        : `restam ${r.restantes} que precisam da sua decisão`
  return `${c}; ${resto}.`
}

// ---------- filtros ----------

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Filtra por função e por texto (nome da pessoa ou da função), sem diferenciar acentos/maiúsculas. */
export function filtrarFuncionarios(
  escala: Escala,
  funcoes: Funcao[],
  filtro: { funcaoId?: string; texto?: string },
): Funcionario[] {
  const texto = normalizar(filtro.texto ?? '')
  const nomeFuncao = new Map(funcoes.map((fn) => [fn.id, normalizar(fn.nome)]))
  return escala.funcionarios.filter(
    (f) =>
      (!filtro.funcaoId || f.funcaoId === filtro.funcaoId) &&
      (!texto || normalizar(f.nome).includes(texto) || (nomeFuncao.get(f.funcaoId) ?? '').includes(texto)),
  )
}

// ---------- comparação de propostas ----------

export interface ResumoProposta {
  domingosTrabalhados: number
  vermelhos: number
  amarelos: number
}

export function resumoProposta(escala: Escala, alertas: Alerta[]): ResumoProposta {
  return {
    domingosTrabalhados: contarDomingosTrabalhados(escala),
    vermelhos: alertas.filter((a) => a.severidade === 'vermelho').length,
    amarelos: alertas.filter((a) => a.severidade === 'amarelo').length,
  }
}

/** Selos de destaque: só para a proposta estritamente melhor (empate não ganha selo). */
export function destaquesPropostas(resumos: Record<string, ResumoProposta>): Record<string, string[]> {
  const ids = Object.keys(resumos)
  const out: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, [] as string[]]))
  if (ids.length < 2) return out
  const melhor = (selo: string, valor: (r: ResumoProposta) => number, aceita: (r: ResumoProposta) => boolean = () => true) => {
    const min = Math.min(...ids.map((id) => valor(resumos[id])))
    const vencedores = ids.filter((id) => valor(resumos[id]) === min)
    if (vencedores.length === 1 && aceita(resumos[vencedores[0]])) out[vencedores[0]].push(selo)
  }
  melhor('Menos domingos trabalhados', (r) => r.domingosTrabalhados)
  melhor('Menos alertas', (r) => r.vermelhos + r.amarelos)
  melhor('Sem alertas vermelhos', (r) => r.vermelhos, (r) => r.vermelhos === 0)
  return out
}
