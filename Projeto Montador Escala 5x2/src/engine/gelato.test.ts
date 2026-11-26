/**
 * Caso real: fábrica de gelato com loja. 7 empregadas (todas mulheres: domingo de folga ao menos a cada 2 semanas),
 * público de segunda a sábado 09:30–22:40 e domingo 13:30–21:00; produção (2 pessoas) 07:10–09:30 de sábado a segunda
 * (e, na variante, também no domingo); venda ao público com no mínimo 2.
 */
import { describe, expect, it } from 'vitest'
import { REGRAS_PESSOAIS_PADRAO } from '../config/regras'
import type { CoberturaTurno, Empresa, Escala, Funcao, ModeloEscala, PessoaEscala, Turno } from '../types'
import { analisar } from '../utils/analise'
import { criarMedidorDeFuros, ordemDeVagasDosDados } from '../utils/vagas'
import { corrigirTudo } from './autocorrecao'
import { diaDaSemana, minutosDe, somarDias } from './datas'
import { gerarEscala, perfilNecessidade, type EntradaGerador } from './gerador'
import { HORAS_PARCIAIS, gerarPropostasComVagas, totalDeVagas } from './vagas'

const MODELOS: ModeloEscala[] = ['fixo', 'rodizio_domingo', 'folga_movel']

function cenario(producaoNoDomingo: number) {
  const pessoas: PessoaEscala[] = Array.from({ length: 7 }, (_, i) => ({
    id: String(i + 1),
    nome: `Funcionária ${i + 1}`,
    escalar: true,
    jornadaPadrao: true,
    menor: false,
    estagiario: false,
    ferias: [],
    sexo: 'F',
  }))
  const funcoes: Funcao[] = [
    { id: 'f', nome: 'Produção e venda', quantidade: 7, jornadaContratual: '44h', horasSemanaisAtuais: 44, pessoas },
  ]
  const empresa: Empresa = {
    nome: 'Gelato',
    setor: 'Varejo',
    diasFuncionamento: [true, true, true, true, true, true, true],
    horaAbertura: '09:30',
    horaFechamento: '22:40',
    horarios: { 0: { abre: '13:30', fecha: '21:00' } },
    funcionaFeriados: false,
    acordoColetivo: 'nao',
    compensacaoDiaria: false,
  }
  const turnos: Turno[] = [
    { id: 'prod', nome: 'Produção', inicio: '07:10', fim: '09:30', intervaloMin: 0 },
    { id: 'venda', nome: 'Venda', inicio: '09:30', fim: '22:40', intervaloMin: 0 },
  ]
  const cobertura: Record<string, CoberturaTurno> = {
    prod: { util: 0, porDia: { 1: 2 }, sab: 2, dom: producaoNoDomingo },
    venda: { util: 2, sab: 2, dom: 2 },
  }
  const dados = { empresa, funcoes, turnos, cobertura, feriados: [] }
  const entrada: EntradaGerador = { empresa, funcoes, turnos, cobertura, feriados: [], inicio: '2026-12-20', semanas: 5 }
  const custo = { encargosPct: 0, horaExtraPct: 0 }
  const paraVagas = { ...dados, custo, etapaImpacto: 'etapa1' as const, regrasPessoais: REGRAS_PESSOAIS_PADRAO }
  return { dados, entrada, paraVagas }
}

const corrigida = (c: ReturnType<typeof cenario>, m: ModeloEscala) =>
  corrigirTudo(gerarEscala(c.entrada, m), (x) => analisar(c.dados, x)).escala

describe('gelato: 7 empregadas, produção sábado a segunda', () => {
  const c = cenario(0)

  for (const m of MODELOS) {
    it(`${m}: a equipe atual basta (sem contratar) e sem faltas de cobertura`, () => {
      const faltas = analisar(c.dados, corrigida(c, m)).alertas.filter((a) => a.regraId === 'cobertura')
      expect(faltas.map((a) => a.mensagem)).toEqual([])
    })

    it(`${m}: ninguém entra antes de 07:10 (produção) nem antes da abertura nos dias sem produção`, () => {
      const esc = corrigida(c, m)
      const turnos = new Map(esc.turnos.map((t) => [t.id, t]))
      for (const f of esc.funcionarios) {
        esc.celulas[f.id].forEach((cel, i) => {
          if (cel.tipo !== 'trabalho') return
          const dow = diaDaSemana(somarDias(esc.inicio, i))
          const ini = minutosDe(turnos.get(cel.turnoId!)!.inicio)
          expect(ini).toBeGreaterThanOrEqual(minutosDe('07:10'))
          if (dow >= 2 && dow <= 5) expect(ini).toBeGreaterThanOrEqual(minutosDe('09:30')) // terça a sexta
          if (dow === 0) expect(ini).toBeGreaterThanOrEqual(minutosDe('13:30')) // domingo
        })
      }
    })

    it(`${m}: cada empregada folga ao menos um domingo a cada 2 semanas e todo domingo tem 2 pessoas`, () => {
      const esc: Escala = corrigida(c, m)
      const domingos = Array.from({ length: esc.dias }, (_, i) => i).filter((i) => diaDaSemana(somarDias(esc.inicio, i)) === 0)
      for (const f of esc.funcionarios) {
        for (let k = 0; k + 1 < domingos.length; k++) {
          const trab = [domingos[k], domingos[k + 1]].map((i) => esc.celulas[f.id][i].tipo === 'trabalho')
          expect(trab.every(Boolean), `${f.nome} trabalha 2 domingos seguidos (${k})`).toBe(false)
        }
      }
      for (const i of domingos) {
        const n = esc.funcionarios.filter((f) => esc.celulas[f.id][i].tipo === 'trabalho').length
        expect(n, `domingo ${i}`).toBeGreaterThanOrEqual(2)
      }
    })
  }

  it('o motor não propõe contratação (nem integral nem parcial)', () => {
    const d = c.paraVagas
    const props = gerarPropostasComVagas(c.entrada, ordemDeVagasDosDados(d), criarMedidorDeFuros(d), HORAS_PARCIAIS)
    expect(props.map((p) => totalDeVagas(p.contratacoes))).toEqual([0, 0, 0])
  })
})

describe('gelato com produção também no domingo de manhã', () => {
  const c = cenario(2)

  it('a produção fora do horário de abertura do domingo não é descartada', () => {
    const perfil = perfilNecessidade(c.entrada.empresa, c.entrada.turnos, c.entrada.cobertura)
    const faixaDas = (hhmm: string) => Math.floor(minutosDe(hhmm) / 15)
    expect(perfil[0][faixaDas('07:10')]).toBe(2) // domingo, antes de abrir ao público
    expect(perfil[0][faixaDas('12:00')]).toBe(0) // domingo, entre a produção e a abertura
    expect(perfil[0][faixaDas('14:00')]).toBe(2) // venda no domingo
    expect(perfil[0][faixaDas('22:00')]).toBe(0) // depois de fechar no domingo
  })

  it('basta uma contratação, em tempo parcial, para o reforço de domingo — e a escala cobre tudo', () => {
    const d = c.paraVagas
    const medidor = criarMedidorDeFuros(d)
    for (const p of gerarPropostasComVagas(c.entrada, ordemDeVagasDosDados(d), medidor, HORAS_PARCIAIS)) {
      expect(totalDeVagas(p.contratacoes)).toBe(1)
      expect(p.contratacoes![0].parciais?.length).toBe(1)
      expect(medidor(p.escala)).toBe(0)
    }
  })
})
