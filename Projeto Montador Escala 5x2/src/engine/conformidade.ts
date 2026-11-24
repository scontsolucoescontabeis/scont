/**
 * Motor de conformidade — função pura, sem acesso a DOM/estado/relógio.
 * Todos os limites vêm de `regras` (src/config/regras.ts).
 *
 * Premissas de modelagem (validar com o DP):
 *  - Semana = segunda a domingo; só semanas COMPLETAS dentro da escala são avaliadas.
 *  - Semana com dia de ausência (atestado/férias) não é avaliada (jornada/repouso).
 *  - Repouso = dia do tipo "folga" ou "dsr". Feriado não trabalhado não conta como repouso.
 *  - A etapa aplicada a uma semana é a vigente no ÚLTIMO dia (domingo) da semana.
 *  - Horas trabalhadas = duração do turno − intervalo.
 */
import {
  REGRAS,
  etapaVigente,
  limitesDaEtapa,
  type EtapaId,
  type RegraId,
  type RegrasLegais,
} from '../config/regras'
import type {
  Alerta,
  AlteracaoCelula,
  DiaEscala,
  Escala,
  RegraCobertura,
  ResultadoConformidade,
  Severidade,
  Turno,
} from '../types'
import { diaDaSemana, minutosDe, segundaDaSemana, somarDias } from './datas'

export interface EntradaConformidade {
  escala: Escala
  cobertura: RegraCobertura[]
  /** Feriados (YYYY-MM-DD) que caem no período. */
  feriados: string[]
  empresaFuncionaFeriados: boolean
  /**
   * Períodos do estabelecimento (passo 3) referenciados por `cobertura`. Com
   * eles, a cobertura é conferida por faixa de horário (quem está presente em
   * cada instante); sem eles, por igualdade de turno.
   */
  periodos?: Turno[]
  /** Existe acordo/regime de compensação de jornada diária. */
  compensacaoDiaria: boolean
  regras?: RegrasLegais
}

const DIAS_PT = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

export function duracaoBrutaMin(t: Turno): number {
  return (minutosDe(t.fim) - minutosDe(t.inicio) + 1440) % 1440
}

export function horasLiquidasMin(t: Turno): number {
  return Math.max(0, duracaoBrutaMin(t) - t.intervaloMin)
}

export function fmtHoras(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function fmtDataBR(data: string): string {
  const [a, m, d] = data.split('-')
  return `${d}/${m}/${a}`
}

function rid(etapa: EtapaId, param: string): RegraId {
  return `${etapa}.${param}` as RegraId
}

/** Texto padrão: mensagem + id da regra. */
function comRegra(texto: string, id: RegraId): string {
  return `${texto} (regra: ${id})`
}

export function validarEscala(entrada: EntradaConformidade): ResultadoConformidade {
  const regras = entrada.regras ?? REGRAS
  const { escala, cobertura, feriados, empresaFuncionaFeriados, compensacaoDiaria } = entrada
  const alertas: Alerta[] = []
  const turnos = new Map(escala.turnos.map((t) => [t.id, t]))
  const periodos = entrada.periodos ? new Map(entrada.periodos.map((t) => [t.id, t])) : undefined
  const feriadoSet = new Set(feriados)
  const datas = Array.from({ length: escala.dias }, (_, i) => somarDias(escala.inicio, i))
  const indiceDe = new Map(datas.map((d, i) => [d, i]))

  const celula = (fid: string, i: number): DiaEscala | undefined => escala.celulas[fid]?.[i]
  const turnoDe = (c: DiaEscala | undefined): Turno | undefined =>
    c?.tipo === 'trabalho' && c.turnoId ? turnos.get(c.turnoId) : undefined
  const ehRepouso = (c: DiaEscala | undefined) => c?.tipo === 'folga' || c?.tipo === 'dsr'

  /** No modo flexível, infrações próprias da 1ª etapa viram amarelo (a confirmar). */
  const sev = (etapa: EtapaId): 'vermelho' | 'amarelo' =>
    regras.modoTransicao === 'flexivel_stf' && etapa === 'etapa1' ? 'amarelo' : 'vermelho'
  const notaFlex = (etapa: EtapaId) =>
    regras.modoTransicao === 'flexivel_stf' && etapa === 'etapa1'
      ? ' Modo "flexível (STF)" ativo: confirme com o DP se a flexibilização vale para esta empresa.'
      : ''

  // ---------- Semanas completas ----------
  const segundas: string[] = []
  for (const d of datas) {
    const seg = segundaDaSemana(d)
    if (!segundas.includes(seg)) segundas.push(seg)
  }

  for (const f of escala.funcionarios) {
    for (const seg of segundas) {
      const idx = Array.from({ length: 7 }, (_, k) => indiceDe.get(somarDias(seg, k)))
      if (idx.some((i) => i === undefined)) continue // semana incompleta
      const dias = idx as number[]
      const cels = dias.map((i) => celula(f.id, i))
      if (cels.some((c) => c?.tipo === 'ausencia')) continue
      const domingo = somarDias(seg, 6)
      const etapa = etapaVigente(domingo, regras)
      const lim = limitesDaEtapa(etapa, regras)

      // Repousos
      const repousosIdx = dias.filter((_, k) => ehRepouso(cels[k]))
      const nRep = repousosIdx.length
      if (nRep < lim.repousosSemanais) {
        const faltam = lim.repousosSemanais - nRep
        const id = rid(etapa, 'repousosSemanais')
        // Correção: transforma dias trabalhados (domingo primeiro) em repouso.
        const trabalhados = dias
          .map((i, k) => ({ i, k }))
          .filter(({ k }) => cels[k]?.tipo === 'trabalho')
          .sort((a, b) => (b.k === 6 ? 1 : 0) - (a.k === 6 ? 1 : 0))
        const correcao: AlteracaoCelula[] | undefined =
          trabalhados.length >= faltam
            ? trabalhados.slice(0, faltam).map(({ i, k }) => ({
                funcionarioId: f.id,
                dia: i,
                novo: { tipo: k === 6 ? 'dsr' : 'folga' },
              }))
            : undefined
        alertas.push({
          id: `rep|${f.id}|${seg}`,
          regraId: id,
          severidade: sev(etapa),
          titulo: 'Faltam dias de descanso na semana',
          mensagem: comRegra(
            `${f.nome} tem ${nRep} dia(s) de descanso na semana de ${fmtDataBR(seg)}; a regra exige ${lim.repousosSemanais}.${notaFlex(etapa)}`,
            id,
          ),
          sugestao: 'Transforme um dia trabalhado em folga (de preferência o domingo).',
          funcionarioId: f.id,
          data: seg,
          correcao,
        })
      } else if (lim.repousoPreferencialDomingo && nRep >= 1 && !ehRepouso(cels[6])) {
        const id = rid(etapa, 'repousoPreferencialDomingo')
        const turnoDom = cels[6]?.tipo === 'trabalho' ? cels[6] : undefined
        // O DSR da semana passa para o domingo; o dia que era DSR (ou, na falta, folga) volta a ser trabalhado.
        const outro =
          dias.find((_, k) => k < 6 && cels[k]?.tipo === 'dsr') ??
          dias.find((_, k) => k < 6 && cels[k]?.tipo === 'folga')
        const correcao: AlteracaoCelula[] | undefined =
          turnoDom && outro !== undefined
            ? [
                { funcionarioId: f.id, dia: dias[6], novo: { tipo: 'dsr' } },
                {
                  funcionarioId: f.id,
                  dia: outro,
                  novo: { tipo: 'trabalho', turnoId: turnoDom.turnoId },
                },
              ]
            : undefined
        alertas.push({
          id: `dom|${f.id}|${seg}`,
          regraId: id,
          severidade: 'amarelo',
          titulo: 'Nenhum descanso cai no domingo',
          mensagem: comRegra(
            `${f.nome} não folga no domingo ${fmtDataBR(domingo)}. A regra pede que ao menos 1 dos descansos seja, preferencialmente, no domingo.`,
            id,
          ),
          sugestao:
            'Se o domingo for trabalhado por rodízio, mantenha pelo menos um domingo de folga por ciclo e confira a convenção coletiva.',
          funcionarioId: f.id,
          data: seg,
          correcao,
        })
      }

      // Jornada semanal
      const totalMin = cels.reduce((s, c) => s + (turnoDe(c) ? horasLiquidasMin(turnoDe(c)!) : 0), 0)
      if (totalMin > lim.jornadaSemanalMax * 60) {
        const id = rid(etapa, 'jornadaSemanalMax')
        alertas.push({
          id: `sem|${f.id}|${seg}`,
          regraId: id,
          severidade: etapa === 'legado' ? 'vermelho' : sev(etapa),
          titulo: 'Jornada semanal acima do limite',
          mensagem: comRegra(
            `${f.nome} trabalha ${fmtHoras(totalMin)} na semana de ${fmtDataBR(seg)}; o limite é ${lim.jornadaSemanalMax}h.${notaFlex(etapa)}`,
            id,
          ),
          sugestao: 'Reduza a duração dos turnos ou retire um dia de trabalho dessa semana.',
          funcionarioId: f.id,
          data: seg,
        })
      }
    }

    // ---------- Dia a dia ----------
    const sundaysWorked: string[] = []
    const feriadosTrab: string[] = []
    for (let i = 0; i < datas.length; i++) {
      const c = celula(f.id, i)
      const t = turnoDe(c)
      if (!t) continue
      const data = datas[i]

      if (horasLiquidasMin(t) > regras.jornadaDiariaMax * 60) {
        alertas.push({
          id: `dia|${f.id}|${data}`,
          regraId: 'jornadaDiariaMax',
          severidade: compensacaoDiaria ? 'amarelo' : 'vermelho',
          titulo: 'Jornada diária acima de 8h',
          mensagem: comRegra(
            `${f.nome} trabalha ${fmtHoras(horasLiquidasMin(t))} em ${fmtDataBR(data)}; o limite diário é ${regras.jornadaDiariaMax}h.` +
              (compensacaoDiaria
                ? ' Há compensação informada: confirme o acordo.'
                : ' Sem acordo de compensação isso não é permitido.'),
            'jornadaDiariaMax',
          ),
          sugestao: 'Encurte o turno ou formalize a compensação com a convenção/acordo.',
          funcionarioId: f.id,
          data,
        })
      }

      // Interjornada (dia seguinte)
      const prox = turnoDe(celula(f.id, i + 1))
      if (prox) {
        const fimAbs = i * 1440 + minutosDe(t.inicio) + duracaoBrutaMin(t)
        const iniProx = (i + 1) * 1440 + minutosDe(prox.inicio)
        const gap = iniProx - fimAbs
        if (gap < regras.interjornadaMinHoras * 60) {
          const fixTurno = turnos.get(t.id)
          let correcao: AlteracaoCelula[] | undefined
          if (fixTurno) {
            const novoIni = (i + 1) * 1440 + minutosDe(fixTurno.inicio)
            if (novoIni - fimAbs >= regras.interjornadaMinHoras * 60) {
              correcao = [
                {
                  funcionarioId: f.id,
                  dia: i + 1,
                  novo: { tipo: 'trabalho', turnoId: fixTurno.id },
                },
              ]
            }
          }
          alertas.push({
            id: `inter|${f.id}|${data}`,
            regraId: 'interjornadaMinHoras',
            severidade: 'vermelho',
            titulo: 'Descanso entre jornadas insuficiente',
            mensagem: comRegra(
              `${f.nome} descansa só ${fmtHoras(Math.max(0, gap))} entre ${fmtDataBR(data)} e ${fmtDataBR(somarDias(data, 1))}; o mínimo é ${regras.interjornadaMinHoras}h.`,
              'interjornadaMinHoras',
            ),
            sugestao: 'Mantenha o mesmo turno em dias seguidos ou use um turno que comece mais tarde.',
            funcionarioId: f.id,
            data,
            correcao,
          })
        }
      }

      if (diaDaSemana(data) === 0) sundaysWorked.push(data)
      if (feriadoSet.has(data)) feriadosTrab.push(data)
    }

    if (feriadosTrab.length > 0) {
      alertas.push({
        id: `fer|${f.id}`,
        regraId: 'domingoFeriadoTrabalhado',
        severidade: 'amarelo',
        titulo: 'Feriado trabalhado',
        mensagem: comRegra(
          `${f.nome} trabalha em ${feriadosTrab.map(fmtDataBR).join(', ')} (feriado). Pode gerar adicional ou folga compensatória conforme a convenção.`,
          'domingoFeriadoTrabalhado',
        ),
        sugestao: 'Confirme com o DP o pagamento em dobro ou a folga compensatória.',
        funcionarioId: f.id,
        data: feriadosTrab[0],
      })
    }
    if (sundaysWorked.length > 0) {
      alertas.push({
        id: `domtrab|${f.id}`,
        regraId: 'domingoFeriadoTrabalhado',
        severidade: 'amarelo',
        titulo: 'Domingo trabalhado',
        mensagem: comRegra(
          `${f.nome} trabalha em ${sundaysWorked.length} domingo(s) do período. Verifique DSR e adicionais conforme a convenção.`,
          'domingoFeriadoTrabalhado',
        ),
        sugestao: 'Garanta a folga compensatória na semana e a regra de rodízio da convenção.',
        funcionarioId: f.id,
        data: sundaysWorked[0],
      })
    }
  }

  // ---------- Intervalo intrajornada (por turno usado) ----------
  const usados = new Set<string>()
  for (const f of escala.funcionarios) {
    for (let i = 0; i < datas.length; i++) {
      const c = celula(f.id, i)
      if (c?.tipo === 'trabalho' && c.turnoId) usados.add(c.turnoId)
    }
  }
  const ir = regras.intrajornada
  for (const t of escala.turnos) {
    if (!usados.has(t.id)) continue
    const bruta = duracaoBrutaMin(t)
    let exigido = 0
    if (bruta > ir.acimaDeHoras * 60) exigido = ir.minLongoMinutos
    else if (bruta > ir.acimaDeHorasCurto * 60) exigido = ir.minCurtoMinutos
    if (t.intervaloMin < exigido) {
      alertas.push({
        id: `intra|${t.id}`,
        regraId: 'intrajornada',
        severidade: 'vermelho',
        titulo: 'Intervalo de descanso curto demais',
        mensagem: comRegra(
          `O turno "${t.nome}" (${t.inicio}–${t.fim}) tem ${t.intervaloMin} min de intervalo; para essa duração o mínimo é ${exigido} min.`,
          'intrajornada',
        ),
        sugestao: `Aumente o intervalo do turno para pelo menos ${exigido} minutos.`,
      })
    }
  }

  // ---------- Cobertura ----------
  const hhmm = (min: number) =>
    `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
  for (const r of cobertura) {
    const turno = turnos.get(r.turnoId)
    const periodo = periodos?.get(r.turnoId)
    for (let i = 0; i < datas.length; i++) {
      const data = datas[i]
      if (!r.diasSemana.includes(diaDaSemana(data))) continue
      if (feriadoSet.has(data) && !empresaFuncionaFeriados) continue

      // Faixas de 15 min do período com gente abaixo do mínimo (modo por período).
      let faltas: { de: number; ate: number; pessoas: number }[] = []
      let presentesN = 0
      if (periodo) {
        const ini = minutosDe(periodo.inicio)
        const fim = minutosDe(periodo.fim) <= ini ? 1440 : minutosDe(periodo.fim)
        const trabalhando = escala.funcionarios
          .filter((f) => !r.funcaoId || f.funcaoId === r.funcaoId)
          .map((f) => turnoDe(celula(f.id, i)))
          .filter((t): t is Turno => !!t)
        for (let m = Math.floor(ini / 15) * 15; m < fim; m += 15) {
          const n = trabalhando.filter((t) => {
            const a = minutosDe(t.inicio)
            return a <= m && m < a + duracaoBrutaMin(t)
          }).length
          if (n >= r.minimo) continue
          const ult = faltas[faltas.length - 1]
          if (ult && ult.ate === m && ult.pessoas === n) ult.ate = m + 15
          else faltas.push({ de: m, ate: m + 15, pessoas: n })
        }
        if (faltas.length === 0) continue
        presentesN = Math.min(...faltas.map((x) => x.pessoas))
      } else {
        const presentes = escala.funcionarios.filter((f) => {
          if (r.funcaoId && f.funcaoId !== r.funcaoId) return false
          const c = celula(f.id, i)
          return c?.tipo === 'trabalho' && c.turnoId === r.turnoId
        })
        if (presentes.length >= r.minimo) continue
        presentesN = presentes.length
        faltas = []
      }

      // Correção: alguém de folga nesse dia cuja semana tem repouso sobrando.
      let correcao: AlteracaoCelula[] | undefined
      for (const f of escala.funcionarios) {
        if (r.funcaoId && f.funcaoId !== r.funcaoId) continue
        const c = celula(f.id, i)
        if (c?.tipo !== 'folga') continue
        const seg = segundaDaSemana(data)
        const semIdx = Array.from({ length: 7 }, (_, k) => indiceDe.get(somarDias(seg, k)))
        if (semIdx.some((x) => x === undefined)) continue
        const lim = limitesDaEtapa(etapaVigente(somarDias(seg, 6), regras), regras)
        const nRep = (semIdx as number[]).filter((x) => ehRepouso(celula(f.id, x))).length
        const horasAtuais = (semIdx as number[]).reduce(
          (s, x) => s + (turnoDe(celula(f.id, x)) ? horasLiquidasMin(turnoDe(celula(f.id, x))!) : 0),
          0,
        )
        // Com períodos, a pessoa volta no horário que ela mesma faz (e que cobre a falta).
        const usual = periodo
          ? turnoDe(escala.celulas[f.id]?.find((x) => x.tipo === 'trabalho'))
          : turno
        if (!usual) continue
        if (periodo) {
          const a = minutosDe(usual.inicio)
          const b = a + duracaoBrutaMin(usual)
          if (!faltas.some((x) => x.de < b && x.ate > a)) continue
        }
        const extra = horasLiquidasMin(usual)
        if (nRep > lim.repousosSemanais && horasAtuais + extra <= lim.jornadaSemanalMax * 60) {
          correcao = [{ funcionarioId: f.id, dia: i, novo: { tipo: 'trabalho', turnoId: usual.id } }]
          break
        }
      }

      alertas.push({
        id: `cob|${r.id}|${data}`,
        regraId: 'cobertura',
        severidade: presentesN === 0 ? 'vermelho' : 'amarelo',
        titulo: periodo ? 'Falta gente no período' : 'Falta gente no turno',
        mensagem: comRegra(
          periodo
            ? `Em ${DIAS_PT[diaDaSemana(data)]}, ${fmtDataBR(data)}, o período "${periodo.nome}" (${periodo.inicio}–${periodo.fim}) fica abaixo do mínimo de ${r.minimo} pessoa(s): ` +
                faltas.map((x) => `${hhmm(x.de)}–${hhmm(x.ate)} com ${x.pessoas}`).join('; ') +
                '.'
            : `Em ${DIAS_PT[diaDaSemana(data)]}, ${fmtDataBR(data)}, o turno "${turno?.nome ?? r.turnoId}" tem ${presentesN} pessoa(s); o mínimo informado é ${r.minimo}.`,
          'cobertura',
        ),
        sugestao: periodo
          ? 'Escale mais alguém nesse horário, desloque a entrada de alguém ou ajuste o mínimo do período.'
          : 'Escale mais alguém nesse turno ou ajuste o mínimo de cobertura.',
        data,
        correcao,
      })
    }
  }

  const vermelho = alertas.filter((a) => a.severidade === 'vermelho').length
  const amarelo = alertas.filter((a) => a.severidade === 'amarelo').length
  const semaforo: Severidade = vermelho > 0 ? 'vermelho' : amarelo > 0 ? 'amarelo' : 'verde'
  return { semaforo, alertas, contagem: { vermelho, amarelo } }
}

/** Aplica as alterações de uma correção, devolvendo uma nova escala (imutável). */
export function aplicarCorrecao(escala: Escala, correcao: AlteracaoCelula[]): Escala {
  const celulas = { ...escala.celulas }
  for (const a of correcao) {
    const linha = [...(celulas[a.funcionarioId] ?? [])]
    linha[a.dia] = a.novo
    celulas[a.funcionarioId] = linha
  }
  return { ...escala, celulas }
}
