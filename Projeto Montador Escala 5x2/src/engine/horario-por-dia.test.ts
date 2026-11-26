import { describe, expect, it } from 'vitest'
import type { CoberturaTurno, Empresa, Escala, Funcao, ModeloEscala, Turno } from '../types'
import { analisar } from '../utils/analise'
import { corrigirTudo } from './autocorrecao'
import { diaDaSemana, minutosDe, somarDias } from './datas'
import { gerarEscala, type EntradaGerador } from './gerador'

const MODELOS: ModeloEscala[] = ['fixo', 'rodizio_domingo', 'folga_movel']
// Uma jornada cheia (8h24 + 1h de intervalo) cabe exatamente no horário de funcionamento de dia útil.
const periodo: Turno = { id: 't1', nome: 'Dia', inicio: '08:00', fim: '17:24', intervaloMin: 0 }

const equipe = (n: number): Funcao => ({
  id: 'a',
  nome: 'Atendente',
  quantidade: n,
  jornadaContratual: '44h',
  horasSemanaisAtuais: 44,
})

function entrada(
  horarios: Empresa['horarios'],
  cob: CoberturaTurno,
  n = 5,
  dias = [true, true, true, true, true, true, true],
): EntradaGerador {
  const empresa: Empresa = {
    nome: 'Loja',
    setor: 'Varejo',
    diasFuncionamento: dias,
    horaAbertura: '08:00',
    horaFechamento: '17:24',
    horarios,
    funcionaFeriados: false,
    acordoColetivo: 'nao',
    compensacaoDiaria: false,
  }
  return { empresa, funcoes: [equipe(n)], turnos: [periodo], cobertura: { t1: cob }, feriados: [], inicio: '2026-12-20', semanas: 5 }
}

/** Horário de funcionamento do dia (0 = domingo), como o passo 1 define. */
const janela = (e: EntradaGerador, dow: number) => {
  const h = e.empresa.horarios?.[dow] ?? { abre: e.empresa.horaAbertura, fecha: e.empresa.horaFechamento }
  return { ini: minutosDe(h.abre), fim: minutosDe(h.fecha) }
}

const dadosAnalise = (e: EntradaGerador) => ({
  empresa: e.empresa,
  funcoes: e.funcoes,
  turnos: e.turnos,
  cobertura: e.cobertura,
  feriados: [],
})

/** Quem trabalha em cada dia, com o horário do turno. */
function trabalhos(_e: EntradaGerador, esc: Escala) {
  const turnos = new Map(esc.turnos.map((t) => [t.id, t]))
  const out: { fid: string; i: number; dow: number; ini: number; fim: number }[] = []
  for (const f of esc.funcionarios) {
    esc.celulas[f.id].forEach((c, i) => {
      if (c.tipo !== 'trabalho') return
      const t = turnos.get(c.turnoId!)!
      const ini = minutosDe(t.inicio)
      out.push({ fid: f.id, i, dow: diaDaSemana(somarDias(esc.inicio, i)), ini, fim: ini + ((minutosDe(t.fim) - ini + 1440) % 1440) })
    })
  }
  return out
}

describe('horário de funcionamento diferente por dia', () => {
  // Seg–sex 08:00–17:24, sábado 08–12 e domingo 09–13 (mín. 2 pessoas nos três grupos de dias)
  const horarios = { 6: { abre: '08:00', fecha: '12:00' }, 0: { abre: '09:00', fecha: '13:00' } }
  const e = entrada(horarios, { util: 2, sab: 2, dom: 2 })

  for (const m of MODELOS) {
    it(`${m}: ninguém trabalha fora do horário em que a empresa funciona`, () => {
      const esc = gerarEscala(e, m)
      const fora = trabalhos(e, esc).filter((t) => {
        const j = janela(e, t.dow)
        return t.ini < j.ini || t.fim > j.fim
      })
      expect(fora).toEqual([])
    })

    it(`${m}: o mesmo empregado tem entrada e saída diferentes conforme o dia`, () => {
      const esc = gerarEscala(e, m)
      const comVarios = esc.funcionarios.filter((f) => {
        const hs = new Set(trabalhos(e, esc).filter((t) => t.fid === f.id).map((t) => `${t.ini}-${t.fim}`))
        return hs.size > 1
      })
      expect(comVarios.length).toBeGreaterThan(0)
    })

    it(`${m}: o domingo tem sempre ao menos 2 pessoas, e parte da equipe folga em cada domingo`, () => {
      const esc = gerarEscala(e, m)
      for (let i = 0; i < esc.dias; i++) {
        if (diaDaSemana(somarDias(esc.inicio, i)) !== 0) continue
        const nTrab = esc.funcionarios.filter((f) => esc.celulas[f.id][i].tipo === 'trabalho').length
        expect(nTrab, `domingo ${i}`).toBeGreaterThanOrEqual(2)
        expect(nTrab, `domingo ${i}`).toBeLessThan(5) // não pode ser todo mundo
      }
    })

    it(`${m}: sem furos de cobertura depois das correções automáticas`, () => {
      const esc = corrigirTudo(gerarEscala(e, m), (x) => analisar(dadosAnalise(e), x)).escala
      const furos = analisar(dadosAnalise(e), esc).alertas.filter((a) => a.regraId === 'cobertura')
      expect(furos.map((a) => a.mensagem)).toEqual([])
    })
  }
})

describe('empresa que abre mais cedo só em alguns dias', () => {
  // Terça e quinta abre às 06:00; os demais dias às 09:00 (fecha sempre às 18:00)
  const horarios = {
    2: { abre: '06:00', fecha: '18:00' },
    4: { abre: '06:00', fecha: '18:00' },
    1: { abre: '09:00', fecha: '18:00' },
    3: { abre: '09:00', fecha: '18:00' },
    5: { abre: '09:00', fecha: '18:00' },
    6: { abre: '09:00', fecha: '18:00' },
  }
  const periodoCedo: Turno = { id: 't1', nome: 'Dia', inicio: '06:00', fim: '18:00', intervaloMin: 0 }
  const e = { ...entrada(horarios, { util: 2, sab: 2, dom: 0 }, 5, [false, true, true, true, true, true, true]), turnos: [periodoCedo] }

  for (const m of MODELOS) {
    it(`${m}: ninguém entra antes da abertura do dia`, () => {
      const esc = gerarEscala(e, m)
      const fora = trabalhos(e, esc).filter((t) => t.ini < janela(e, t.dow).ini || t.fim > janela(e, t.dow).fim)
      expect(fora).toEqual([])
    })
  }
})

describe('sem horário próprio por dia, a escala continua igual (um horário por empregado)', () => {
  it('cada empregado tem o mesmo turno em todos os dias que trabalha', () => {
    const e = entrada(undefined, { util: 2, sab: 2, dom: 1 })
    for (const m of MODELOS) {
      const esc = gerarEscala(e, m)
      for (const f of esc.funcionarios) {
        const ids = new Set(esc.celulas[f.id].filter((c) => c.tipo === 'trabalho').map((c) => c.turnoId))
        expect(ids.size).toBe(1)
      }
    }
  })
})
