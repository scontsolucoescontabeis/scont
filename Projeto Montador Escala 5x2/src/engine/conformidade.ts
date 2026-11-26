/**
 * Motor de conformidade — função pura, sem acesso a DOM/estado/relógio.
 * Todos os limites vêm de `regras` (src/config/regras.ts).
 *
 * Premissas de modelagem (validar com o DP):
 *  - Semana = domingo a sábado; só semanas COMPLETAS dentro da escala são avaliadas.
 *  - Semana com dia de ausência (atestado/férias) não é avaliada (jornada/repouso).
 *  - Repouso = dia do tipo "folga" ou "dsr". Feriado não trabalhado não conta como repouso.
 *  - A etapa aplicada a uma semana é a vigente no ÚLTIMO dia (domingo) da semana.
 *  - Horas trabalhadas = duração do turno − intervalo.
 */
import {
  REGRAS,
  REGRAS_PESSOAIS_PADRAO,
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
  RegrasPessoais,
  ResultadoConformidade,
  Severidade,
  Turno,
} from '../types'
import { diaDaSemana, diffDias, minutosDe, domingoDaSemana, somarDias } from './datas'
import { cicloDomingoDe, limitesEstagio, recorteDoDia, tocaNoturnoMenor } from './jornada'

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
  /**
   * Horário de funcionamento (minutos) dos dias da semana com horário próprio (0 = domingo; `undefined` = sem
   * recorte). A cobertura mínima só vale dentro desse horário.
   */
  janelasDia?: ({ ini: number; fim: number } | undefined)[]
  /** Existe acordo/regime de compensação de jornada diária. */
  compensacaoDiaria: boolean
  /** Ciclo do domingo em semanas (ver `cicloDomingoDoSetor`); padrão: comércio. */
  cicloDomingoSemanas?: number
  regras?: RegrasLegais
  /** Regras por pessoa (mulheres, estagiários); padrão: `REGRAS_PESSOAIS_PADRAO`. */
  regrasPessoais?: RegrasPessoais
}

const NOTA_AUSENCIA = ' Há ausência (férias/atestado) de:'
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
  const rp = entrada.regrasPessoais ?? REGRAS_PESSOAIS_PADRAO
  const estagio = limitesEstagio(rp)
  const ciclo = Math.max(2, entrada.cicloDomingoSemanas ?? regras.domingo.cicloSemanasComercio)
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
    const seg = domingoDaSemana(d)
    if (!segundas.includes(seg)) segundas.push(seg)
  }

  for (const f of escala.funcionarios) {
    // Rodízio de domingos: o domingo trabalhado só preocupa se não houver nenhum domingo
    // de folga no ciclo (3 semanas para cada lado).
    const domingosDeFolga = segundas.filter((seg) => {
      const i = indiceDe.get(seg)
      return i !== undefined && ehRepouso(celula(f.id, i))
    })
    for (const seg of segundas) {
      const idx = Array.from({ length: 7 }, (_, k) => indiceDe.get(somarDias(seg, k)))
      if (idx.some((i) => i === undefined)) continue // semana incompleta
      const dias = idx as number[]
      const cels = dias.map((i) => celula(f.id, i))
      if (cels.some((c) => c?.tipo === 'ausencia')) continue
      const domingo = seg
      const etapa = etapaVigente(somarDias(seg, 6), regras)
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
          .sort((a, b) => (b.k === 0 ? 1 : 0) - (a.k === 0 ? 1 : 0))
        const correcao: AlteracaoCelula[] | undefined =
          trabalhados.length >= faltam
            ? trabalhados.slice(0, faltam).map(({ i, k }) => ({
                funcionarioId: f.id,
                dia: i,
                novo: { tipo: k === 0 ? 'dsr' : 'folga' },
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
      } else if (
        lim.repousoPreferencialDomingo &&
        nRep >= 1 &&
        !ehRepouso(cels[0]) &&
        !domingosDeFolga.some((x) => Math.abs(diffDias(x, seg)) <= 7 * ciclo)
      ) {
        const id = rid(etapa, 'repousoPreferencialDomingo')
        const turnoDom = cels[0]?.tipo === 'trabalho' ? cels[0] : undefined
        // O DSR da semana passa para o domingo; o dia que era DSR (ou, na falta, folga) volta a ser trabalhado.
        const outro =
          dias.find((_, k) => k > 0 && cels[k]?.tipo === 'dsr') ??
          dias.find((_, k) => k > 0 && cels[k]?.tipo === 'folga')
        const correcao: AlteracaoCelula[] | undefined =
          turnoDom && outro !== undefined
            ? [
                { funcionarioId: f.id, dia: dias[0], novo: { tipo: 'dsr' } },
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

      // Estagiário: carga semanal (Lei 11.788/2008 art. 10)
      if (f.estagiario && totalMin > estagio.semanalH * 60) {
        alertas.push({
          id: `estsem|${f.id}|${seg}`,
          regraId: 'estagioJornada',
          severidade: 'vermelho',
          titulo: 'Estágio acima da carga semanal',
          mensagem: comRegra(
            `${f.nome} (estagiário) faz ${fmtHoras(totalMin)} de estágio na semana de ${fmtDataBR(seg)}; o limite é ${estagio.semanalH}h por semana (Lei 11.788/2008, art. 10).`,
            'estagioJornada',
          ),
          sugestao: 'Encurte o horário ou retire um dia de estágio dessa semana; confira a carga do termo de compromisso.',
          funcionarioId: f.id,
          data: seg,
        })
      }
    }

    // ---------- Domingo: repouso coincide com o domingo ao menos 1 vez a cada `ciclo` semanas ----------
    // (Lei 10.101/2000 art. 6º, p. único) => no máximo ciclo-1 domingos trabalhados seguidos.
    // Mulheres com o art. 386 ligado: ciclo de 2 semanas e alerta próprio (substitui o comum, sem duplicar).
    {
      const cicloF = cicloDomingoDe(f, ciclo, rp)
      const regraMulher = rp.mulheresDomingoQuinzenal && f.sexo === 'F'
      let seguidos = 0
      let anterior: number | undefined
      for (const seg of segundas) {
        const i = indiceDe.get(seg)
        if (i === undefined) continue
        const c = celula(f.id, i)
        if (anterior !== undefined && i - anterior !== 7) seguidos = 0
        anterior = i
        if (c?.tipo !== 'trabalho') {
          seguidos = 0
          continue
        }
        seguidos++
        if (seguidos < cicloF) continue
        seguidos = 0
        const semana = Array.from({ length: 6 }, (_, k) => i + 1 + k)
        const outro =
          semana.find((x) => celula(f.id, x)?.tipo === 'dsr') ??
          semana.find((x) => celula(f.id, x)?.tipo === 'folga')
        const base = regraMulher
          ? {
              id: `dommul|${f.id}|${seg}`,
              regraId: 'domingoMulher' as const,
              titulo: `Domingo de folga quinzenal (mulher)`,
              mensagem: comRegra(
                `${f.nome} trabalha ${cicloF} domingos seguidos até ${fmtDataBR(seg)}. Para mulheres, o trabalho aos domingos exige escala de revezamento quinzenal, com ao menos 1 domingo de folga a cada ${cicloF} semanas (CLT art. 386 — revezamento quinzenal; validar com o DP a aplicação e a convenção coletiva).`,
                'domingoMulher',
              ),
            }
          : {
              id: `domrod|${f.id}|${seg}`,
              regraId: 'domingoRodizio' as const,
              titulo: `Domingo de folga ao menos a cada ${ciclo} semanas`,
              mensagem: comRegra(
                `${f.nome} trabalha ${ciclo} domingos seguidos até ${fmtDataBR(seg)}. O repouso semanal deve coincidir com o domingo pelo menos 1 vez a cada ${ciclo} semanas (Lei 10.101/2000 art. 6º, p. único; Lei 605/1949).`,
                'domingoRodizio',
              ),
            }
        alertas.push({
          ...base,
          severidade: 'vermelho',
          sugestao: 'Faça o rodízio: dê o domingo de folga (DSR) a esta pessoa e passe o domingo para quem folgou mais recentemente.',
          funcionarioId: f.id,
          data: seg,
          correcao:
            c.turnoId && outro !== undefined
              ? [
                  { funcionarioId: f.id, dia: i, novo: { tipo: 'dsr' } },
                  { funcionarioId: f.id, dia: outro, novo: { tipo: 'trabalho', turnoId: c.turnoId } },
                ]
              : undefined,
        })
      }
    }

    // ---------- Dias seguidos de trabalho (CLT art. 67; OJ 410 SDI-1/TST) ----------
    {
      let run = 0
      for (let i = 0; i < datas.length; i++) {
        if (celula(f.id, i)?.tipo !== 'trabalho') {
          run = 0
          continue
        }
        run++
        if (run <= regras.diasConsecutivosMax) continue
        run = 0
        alertas.push({
          id: `seq|${f.id}|${datas[i]}`,
          regraId: 'diasConsecutivosMax',
          severidade: 'vermelho',
          titulo: `Mais de ${regras.diasConsecutivosMax} dias seguidos de trabalho`,
          mensagem: comRegra(
            `${f.nome} chega a ${regras.diasConsecutivosMax + 1} dias seguidos de trabalho em ${fmtDataBR(datas[i])}. O descanso semanal não pode ser concedido após o 7º dia consecutivo: se for, o repouso é pago em dobro (CLT art. 67; OJ 410 da SDI-1 do TST).`,
            'diasConsecutivosMax',
          ),
          sugestao: 'Antecipe uma folga para que nenhum período de trabalho passe de 6 dias seguidos (inclusive na virada de semana).',
          funcionarioId: f.id,
          data: datas[i],
          correcao: [{ funcionarioId: f.id, dia: i, novo: { tipo: 'folga' } }],
        })
      }
    }

    // ---------- Repouso semanal + interjornada: 24h + 11h = 35h (Súmula 110/TST) ----------
    {
      const minDescanso = regras.repousoSemanalComInterjornadaHoras * 60
      const fimDe = (i: number) => {
        const t = turnoDe(celula(f.id, i))!
        return i * 1440 + minutosDe(t.inicio) + duracaoBrutaMin(t)
      }
      const naoTrab = (i: number) => celula(f.id, i)?.tipo !== 'trabalho'
      for (let i = 0; i < datas.length; i++) {
        if (celula(f.id, i)?.tipo !== 'dsr') continue
        let a = i - 1
        while (a >= 0 && naoTrab(a)) a--
        let b = i + 1
        while (b < datas.length && naoTrab(b)) b++
        if (a < 0 || b >= datas.length) continue
        const tb = turnoDe(celula(f.id, b))!
        const gap = b * 1440 + minutosDe(tb.inicio) - fimDe(a)
        if (gap >= minDescanso) continue
        alertas.push({
          id: `rsi|${f.id}|${datas[i]}`,
          regraId: 'repousoSemanalInterjornada',
          severidade: 'amarelo',
          titulo: 'Descanso do DSR com menos de 35h',
          mensagem: comRegra(
            `${f.nome} descansa só ${fmtHoras(Math.max(0, gap))} em torno do DSR de ${fmtDataBR(datas[i])}; o repouso de 24h deve ser somado às 11h de interjornada (35h). As horas suprimidas são pagas como extras (Súmula 110 do TST).`,
            'repousoSemanalInterjornada',
          ),
          sugestao: 'Atrase a entrada do primeiro dia após o DSR ou antecipe a saída do dia anterior.',
          funcionarioId: f.id,
          data: datas[i],
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
          titulo: `Jornada diária acima de ${fmtHoras(regras.jornadaDiariaMax * 60)}`,
          mensagem: comRegra(
            `${f.nome} trabalha ${fmtHoras(horasLiquidasMin(t))} em ${fmtDataBR(data)}; o limite diário é ${fmtHoras(regras.jornadaDiariaMax * 60)}.` +
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

      // Estagiário: horas por dia (Lei 11.788/2008 art. 10)
      if (f.estagiario && horasLiquidasMin(t) > estagio.diariaMin) {
        alertas.push({
          id: `estdia|${f.id}|${data}`,
          regraId: 'estagioJornada',
          severidade: 'vermelho',
          titulo: 'Estágio acima da carga diária',
          mensagem: comRegra(
            `${f.nome} (estagiário) faz ${fmtHoras(horasLiquidasMin(t))} de estágio em ${fmtDataBR(data)}; o limite é ${fmtHoras(estagio.diariaMin)} por dia para a carga de ${estagio.semanalH}h semanais (Lei 11.788/2008, art. 10).`,
            'estagioJornada',
          ),
          sugestao: 'Encurte o horário de estágio desse dia.',
          funcionarioId: f.id,
          data,
        })
      }

      // Menor de 18 anos: jornada diária (CLT arts. 411 e 413) e trabalho noturno (CLT art. 404)
      if (f.menor && horasLiquidasMin(t) > regras.pessoas.menorHorasDiaMax * 60) {
        alertas.push({
          id: `menjor|${f.id}|${data}`,
          regraId: 'menorJornada',
          severidade: 'vermelho',
          titulo: 'Menor de 18 anos acima de 8 horas no dia',
          mensagem: comRegra(
            `${f.nome} (menor de 18 anos) trabalha ${fmtHoras(horasLiquidasMin(t))} em ${fmtDataBR(data)}; o limite é ${fmtHoras(regras.pessoas.menorHorasDiaMax * 60)} por dia, sem horas extras (CLT arts. 411 e 413).`,
            'menorJornada',
          ),
          sugestao: 'Encurte o turno desse dia para no máximo 8 horas.',
          funcionarioId: f.id,
          data,
        })
      }
      if (f.menor && tocaNoturnoMenor(minutosDe(t.inicio), duracaoBrutaMin(t))) {
        alertas.push({
          id: `mennot|${f.id}|${data}`,
          regraId: 'menorNoturno',
          severidade: 'vermelho',
          titulo: 'Menor de 18 anos em horário noturno',
          mensagem: comRegra(
            `${f.nome} (menor de 18 anos) trabalha no turno ${t.inicio}–${t.fim} em ${fmtDataBR(data)}, que entra na faixa de ${regras.pessoas.menorNoturno.inicio} às ${regras.pessoas.menorNoturno.fim}. O trabalho noturno é proibido ao menor de 18 anos (CLT art. 404).`,
            'menorNoturno',
          ),
          sugestao: `Mude o horário para começar e terminar entre ${regras.pessoas.menorNoturno.fim} e ${regras.pessoas.menorNoturno.inicio}.`,
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

      if (diaDaSemana(data) === 0) {
        // Trabalhar no domingo é previsto (o rodízio e o descanso semanal são conferidos acima); só preocupa se a
        // semana daquele domingo não tem nenhum dia de descanso (nem ausência) para compensar.
        const semana = Array.from({ length: 7 }, (_, k) => i + k).filter((x) => x < datas.length)
        if (!semana.some((x) => ehRepouso(celula(f.id, x)) || celula(f.id, x)?.tipo === 'ausencia')) sundaysWorked.push(data)
      }
      if (feriadoSet.has(data)) feriadosTrab.push(data)
    }

    if (feriadosTrab.length > 0) {
      alertas.push({
        id: `fer|${f.id}`,
        regraId: 'domingoFeriadoTrabalhado',
        severidade: 'amarelo',
        titulo: 'Feriado trabalhado',
        mensagem: comRegra(
          `${f.nome} trabalha em ${feriadosTrab.map(fmtDataBR).join(', ')} (feriado). Trabalho em feriado no comércio costuma exigir autorização na convenção coletiva e, se houver, lei municipal (confirmar); sem folga compensatória o dia é pago em dobro (Lei 605/1949 art. 9º; Súmula 146 do TST).`,
          'domingoFeriadoTrabalhado',
        ),
        sugestao: 'Confirme com o DP a autorização na convenção coletiva/lei municipal e o pagamento em dobro ou a folga compensatória.',
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
          `${f.nome} trabalha no domingo ${sundaysWorked.map(fmtDataBR).join(', ')} sem nenhum dia de descanso na semana. Sem folga compensatória, o domingo é pago em dobro (Súmula 146 do TST); confira também a convenção coletiva.`,
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

  // ---------- Intervalo máximo (art. 71) e trabalho noturno (art. 73) ----------
  const nIni = minutosDe(regras.noturno.inicio)
  const nFim = minutosDe(regras.noturno.fim)
  for (const t of escala.turnos) {
    if (!usados.has(t.id)) continue
    if (t.intervaloMin > regras.intervaloMaxMinutos) {
      alertas.push({
        id: `intramax|${t.id}`,
        regraId: 'intervaloMaxMinutos',
        severidade: 'amarelo',
        titulo: 'Intervalo acima de 2 horas',
        mensagem: comRegra(
          `O turno "${t.nome}" tem ${t.intervaloMin} min de intervalo; acima de ${regras.intervaloMaxMinutos / 60}h só é válido com acordo escrito ou convenção coletiva (CLT art. 71, caput).`,
          'intervaloMaxMinutos',
        ),
        sugestao: 'Reduza o intervalo para no máximo 2 horas ou formalize o acordo.',
      })
    }
    // minutos do turno dentro da faixa noturna (22h–5h), olhando ontem, hoje e amanhã
    const ini = minutosDe(t.inicio)
    const fim = ini + duracaoBrutaMin(t)
    let noite = 0
    for (const base of [-1440, 0, 1440]) {
      const a = Math.max(ini, base + nIni)
      const b = Math.min(fim, base + 1440 + nFim)
      if (b > a) noite += b - a
    }
    if (noite <= 0) continue
    const computada = horasLiquidasMin(t) + noite * (60 / regras.noturno.minutosHoraReduzida - 1)
    alertas.push({
      id: `noturno|${t.id}`,
      regraId: 'jornadaNoturna',
      severidade: 'amarelo',
      titulo: 'Turno com trabalho noturno',
      mensagem: comRegra(
        `O turno "${t.nome}" (${t.inicio}–${t.fim}) tem ${fmtHoras(noite)} entre ${regras.noturno.inicio} e ${regras.noturno.fim}. A hora noturna é reduzida (52min30s) e tem adicional de 20% (CLT art. 73): a jornada computada fica em ${fmtHoras(computada)}` +
          (computada > regras.jornadaDiariaMax * 60 ? `, acima do limite diário de ${fmtHoras(regras.jornadaDiariaMax * 60)}.` : '.'),
        'jornadaNoturna',
      ),
      sugestao: 'Considere a hora reduzida e o adicional noturno no cálculo da jornada e da folha.',
    })
  }

  // ---------- Cobertura ----------
  const hhmm = (min: number) =>
    `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
  /** Quantas pessoas (da função, se indicada) estão trabalhando no instante `t0` (minuto do dia) do dia `j`. */
  const presentesEm = (j: number, t0: number, funcaoId?: string) =>
    escala.funcionarios.filter((f) => {
      if (funcaoId && f.funcaoId !== funcaoId) return false
      const t = turnoDe(celula(f.id, j))
      if (!t) return false
      const a = minutosDe(t.inicio)
      return a <= t0 && t0 < a + duracaoBrutaMin(t)
    }).length
  /**
   * Turno (dos que a pessoa já faz) que cobre a falta: o do mesmo dia da semana, se cobre; senão o que mais cobre.
   * `undefined` se nenhum dos turnos dela cobre.
   */
  const turnoQueCobre = (fid: string, dow: number, faltas: { de: number; ate: number }[]): Turno | undefined => {
    const celulasF = escala.celulas[fid] ?? []
    const cobre = (t: Turno) => {
      const a = minutosDe(t.inicio)
      const b = a + duracaoBrutaMin(t)
      return faltas.reduce((s, x) => s + Math.max(0, Math.min(b, x.ate) - Math.max(a, x.de)), 0)
    }
    const mesmoDia = turnoDe(celulasF.find((x, j) => x.tipo === 'trabalho' && diaDaSemana(datas[j]) === dow))
    if (mesmoDia && cobre(mesmoDia) > 0) return mesmoDia
    const distintos = new Map<string, Turno>()
    for (const x of celulasF) {
      const t = turnoDe(x)
      if (t) distintos.set(t.id, t)
    }
    let melhor: Turno | undefined
    for (const t of distintos.values()) if (cobre(t) > (melhor ? cobre(melhor) : 0)) melhor = t
    return melhor
  }
  /** `f` pode deixar de trabalhar no dia `j` sem que algum mínimo de cobertura (de período) fique descoberto. */
  const semFazerFalta = (f: { id: string; funcaoId: string }, j: number): boolean => {
    const tj = turnoDe(celula(f.id, j))
    if (!tj || !periodos) return false
    if (feriadoSet.has(datas[j]) && !empresaFuncionaFeriados) return true
    const dowJ = diaDaSemana(datas[j])
    const a = minutosDe(tj.inicio)
    const b = a + duracaoBrutaMin(tj)
    for (const r2 of cobertura) {
      if (!r2.diasSemana.includes(dowJ)) continue
      if (r2.funcaoId && r2.funcaoId !== f.funcaoId) continue
      const p2 = periodos.get(r2.turnoId)
      if (!p2) return false
      const ini2 = minutosDe(p2.inicio)
      const fim2 = minutosDe(p2.fim) <= ini2 ? 1440 : minutosDe(p2.fim)
      const jan = recorteDoDia(entrada.janelasDia?.[dowJ], ini2, fim2)
      for (let m = Math.floor(ini2 / 15) * 15; m < fim2; m += 15) {
        if (jan && (m < Math.floor(jan.ini / 15) * 15 || m >= Math.ceil(jan.fim / 15) * 15)) continue
        const t0 = Math.max(m, ini2)
        if (!(a <= t0 && t0 < b)) continue
        if (presentesEm(j, t0, r2.funcaoId) - 1 < r2.minimo) return false
      }
    }
    return true
  }
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
        const janela = recorteDoDia(entrada.janelasDia?.[diaDaSemana(data)], ini, fim)
        for (let m = Math.floor(ini / 15) * 15; m < fim; m += 15) {
          if (janela && (m < Math.floor(janela.ini / 15) * 15 || m >= Math.ceil(janela.fim / 15) * 15)) continue
          // Na primeira faixa (parcial) vale o instante em que o período realmente começa.
          const t0 = Math.max(m, ini)
          const n = trabalhando.filter((t) => {
            const a = minutosDe(t.inicio)
            return a <= t0 && t0 < a + duracaoBrutaMin(t)
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
        const seg = domingoDaSemana(data)
        const semIdx = Array.from({ length: 7 }, (_, k) => indiceDe.get(somarDias(seg, k)))
        if (semIdx.some((x) => x === undefined)) continue
        const lim = limitesDaEtapa(etapaVigente(somarDias(seg, 6), regras), regras)
        const nRep = (semIdx as number[]).filter((x) => ehRepouso(celula(f.id, x))).length
        const horasAtuais = (semIdx as number[]).reduce(
          (s, x) => s + (turnoDe(celula(f.id, x)) ? horasLiquidasMin(turnoDe(celula(f.id, x))!) : 0),
          0,
        )
        // Com períodos, a pessoa volta no horário que ela mesma faz (e que cobre a falta).
        // (com horário por dia, o do mesmo dia da semana, que cabe no funcionamento daquele dia)
        const dowAlvo = diaDaSemana(data)
        const celulasF = escala.celulas[f.id] ?? []
        const usual = periodo
          ? turnoDe(
              celulasF.find((x, j) => x.tipo === 'trabalho' && diaDaSemana(datas[j]) === dowAlvo) ??
                celulasF.find((x) => x.tipo === 'trabalho'),
            )
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

      // Sem repouso sobrando: troca o repouso por um dia da mesma semana em que a pessoa não faz falta.
      if (!correcao && periodo) {
        const dowAlvo = diaDaSemana(data)
        const seg = domingoDaSemana(data)
        const semIdx = Array.from({ length: 7 }, (_, k) => indiceDe.get(somarDias(seg, k)))
        if (!semIdx.some((x) => x === undefined)) {
          for (const f of escala.funcionarios) {
            if (r.funcaoId && f.funcaoId !== r.funcaoId) continue
            const c = celula(f.id, i)
            if (c?.tipo !== 'folga' && c?.tipo !== 'dsr') continue
            const usual = turnoQueCobre(f.id, dowAlvo, faltas)
            if (!usual) continue
            const alvo = (semIdx as number[]).find(
              (j) => j !== i && celula(f.id, j)?.tipo === 'trabalho' && semFazerFalta(f, j),
            )
            if (alvo === undefined) continue
            correcao = [
              { funcionarioId: f.id, dia: i, novo: { tipo: 'trabalho', turnoId: usual.id } },
              { funcionarioId: f.id, dia: alvo, novo: { tipo: c.tipo } },
            ]
            break
          }
        }
      }

      const quem = r.funcaoId ? ` de "${r.rotulo ?? 'função'}"` : ''
      // Quem da regra está ausente (férias/atestado) nesse dia: ajuda a entender a falta.
      const ausentes = escala.funcionarios
        .filter((f) => (!r.funcaoId || f.funcaoId === r.funcaoId) && celula(f.id, i)?.tipo === 'ausencia')
        .map((f) => f.nome)
      const listaAusentes =
        ausentes.length > 5 ? `${ausentes.slice(0, 5).join(', ')} e mais ${ausentes.length - 5}` : ausentes.join(', ')
      const notaAusencia = ausentes.length > 0 ? `${NOTA_AUSENCIA} ${listaAusentes}.` : ''
      alertas.push({
        id: `cob|${r.id}|${data}`,
        regraId: 'cobertura',
        severidade: presentesN === 0 ? 'vermelho' : 'amarelo',
        titulo: periodo ? 'Falta gente no período' : 'Falta gente no turno',
        mensagem: comRegra(
          periodo
            ? `Em ${DIAS_PT[diaDaSemana(data)]}, ${fmtDataBR(data)}, o período "${periodo.nome}" (${periodo.inicio}–${periodo.fim}) fica abaixo do mínimo de ${r.minimo} pessoa(s)${quem}: ` +
                faltas.map((x) => `${hhmm(x.de)}–${hhmm(x.ate)} com ${x.pessoas}`).join('; ') +
                '.' +
                notaAusencia
            : `Em ${DIAS_PT[diaDaSemana(data)]}, ${fmtDataBR(data)}, o turno "${turno?.nome ?? r.turnoId}" tem ${presentesN} pessoa(s)${quem}; o mínimo informado é ${r.minimo}.${notaAusencia}`,
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

/** Falta de cobertura que acontece com alguém ausente (férias/atestado) no dia: contratar não é a resposta. */
export function furoComAusencia(a: Alerta): boolean {
  return a.regraId === 'cobertura' && a.mensagem.includes(NOTA_AUSENCIA)
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
