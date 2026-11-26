/**
 * Caso real: fábrica de gelato com loja. 7 empregadas (todas mulheres: domingo de folga ao menos a cada 2 semanas),
 * público de segunda a sábado 09:30–22:40 e domingo 13:30–21:00; produção (2 pessoas) 07:10–09:30 de sábado a segunda
 * (e, na variante, também no domingo); venda ao público com no mínimo 2.
 */
import { describe, expect, it } from 'vitest'
import { REGRAS, REGRAS_PESSOAIS_PADRAO } from '../config/regras'
import type { CoberturaTurno, Empresa, Escala, Funcao, ModeloEscala, PessoaEscala, Turno } from '../types'
import { analisar } from '../utils/analise'
import { resumoEstimativa } from '../utils/passo3'
import { criarMedidorDeFuros, ordemDeVagasDosDados } from '../utils/vagas'
import { corrigirTudo } from './autocorrecao'
import { calcularQuadro, elevarCarga } from './contratacoes'
import { diaDaSemana, minutosDe, somarDias } from './datas'
import { gerarEscala, perfilNecessidade, type EntradaGerador } from './gerador'
import { CONTRATOS_PARCIAIS, gerarPropostasComVagas, totalDeVagas } from './vagas'

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
    const props = gerarPropostasComVagas(c.entrada, ordemDeVagasDosDados(d), criarMedidorDeFuros(d), CONTRATOS_PARCIAIS)
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
    for (const p of gerarPropostasComVagas(c.entrada, ordemDeVagasDosDados(d), medidor, CONTRATOS_PARCIAIS)) {
      expect(totalDeVagas(p.contratacoes)).toBe(1)
      expect(p.contratacoes![0].parciais?.length).toBe(1)
      expect(medidor(p.escala)).toBe(0)
    }
  })
})

/**
 * Tela real do Passo 3 (SMMF Alimentos): horário de segunda e sábado 07:10–22:40, terça a sexta 09:30–22:40, domingo
 * 07:10–21:00; períodos FÁBRICA GELATO 07:10–09:30 (seg 2, sáb 2, dom 2), ATENDIMENTO SEG-SAB 09:30–22:40 (2) e
 * ATENDIMENTO DOM 13:30–21:00 (2). A equipe (7) estava com carga abaixo de 42 h: "≈ 6,1 em tempo integral".
 */
describe('SMMF: equipe de 7 com carga de 7h20 por dia (36,7 h por semana)', () => {
  function tela(horasSemanais: number) {
    const base = cenario(2)
    const pessoas = base.dados.funcoes[0].pessoas!.map((p) => ({ ...p, jornadaPadrao: false, horasSemanais }))
    const funcoes: Funcao[] = [{ ...base.dados.funcoes[0], pessoas }]
    const empresa: Empresa = {
      ...base.dados.empresa,
      horaAbertura: '07:10',
      horarios: {
        0: { abre: '07:10', fecha: '21:00' },
        2: { abre: '09:30', fecha: '22:40' },
        3: { abre: '09:30', fecha: '22:40' },
        4: { abre: '09:30', fecha: '22:40' },
        5: { abre: '09:30', fecha: '22:40' },
      },
    }
    const turnos: Turno[] = [
      { id: 'p1', nome: 'FÁBRICA GELATO', inicio: '07:10', fim: '09:30', intervaloMin: 0 },
      { id: 'p2', nome: 'ATENDIMENTO SEG-SAB', inicio: '09:30', fim: '22:40', intervaloMin: 0 },
      { id: 'p3', nome: 'ATENDIMENTO DOM', inicio: '13:30', fim: '21:00', intervaloMin: 0 },
    ]
    const cobertura: Record<string, CoberturaTurno> = {
      p1: { util: 0, porDia: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0 }, sab: 2, dom: 2 },
      p2: { util: 2, sab: 2, dom: 0 },
      p3: { util: 0, sab: 0, dom: 2 },
    }
    const dados = { empresa, funcoes, turnos, cobertura, feriados: [] }
    const entrada: EntradaGerador = { empresa, funcoes, turnos, cobertura, feriados: [], inicio: '2026-12-20', semanas: 5 }
    const paraVagas = { ...dados, custo: { encargosPct: 0, horaExtraPct: 0 }, etapaImpacto: 'etapa1' as const, regrasPessoais: REGRAS_PESSOAIS_PADRAO }
    return { dados, entrada, paraVagas }
  }

  it('o quadro mostra ≈ 6,1 em tempo integral e a opção de 42 h reduz a contratação', () => {
    const t = tela(36.67)
    const q = calcularQuadro(t.paraVagas, 'etapa1', REGRAS, REGRAS_PESSOAIS_PADRAO)
    expect(q.equipeAtual).toBe(7)
    expect(q.equipeEquivalente).toBeCloseTo(6.1, 1)
    expect(q.contratar).toBeGreaterThanOrEqual(2)

    const { funcoes: elevadas, ajustadas } = elevarCarga(t.dados.funcoes, 42)
    expect(ajustadas).toBe(7)
    const qa = calcularQuadro({ ...t.paraVagas, funcoes: elevadas }, 'etapa1', REGRAS, REGRAS_PESSOAIS_PADRAO)
    expect(qa.equipeEquivalente).toBeCloseTo(7, 1)
    expect(qa.contratar).toBeLessThan(q.contratar)

    const r = resumoEstimativa(q, { limiteH: 42, ajustadas, contratar: qa.contratar, equivalente: qa.equipeEquivalente })
    expect(r.detalhe).toContain('7 pessoas têm menos de 42 h')
  })

  it('com a equipe a 42 h basta 1 vaga em tempo parcial (reforço de fim de semana) nos 3 modelos', () => {
    const t = tela(42)
    const medidor = criarMedidorDeFuros(t.paraVagas)
    for (const p of gerarPropostasComVagas(t.entrada, ordemDeVagasDosDados(t.paraVagas), medidor, CONTRATOS_PARCIAIS)) {
      expect(totalDeVagas(p.contratacoes)).toBe(1)
      const c = p.contratacoes![0].parciais![0]
      expect(c.horas).toBeLessThanOrEqual(30)
      expect(medidor(p.escala)).toBe(0)
      // a vaga em tempo parcial trabalha só os dias do contrato em cada semana completa
      const v = p.escala.funcionarios.find((f) => f.vaga)!
      for (let s = 0; s < 5; s++) {
        const dias = p.escala.celulas[v.id].slice(s * 7, s * 7 + 7).filter((x) => x.tipo === 'trabalho').length
        expect(dias).toBeLessThanOrEqual(c.dias)
      }
    }
  })
})

describe('SMMF a 42 h, sem aplicar o art. 386 às mulheres', () => {
  const regrasPessoais = { ...REGRAS_PESSOAIS_PADRAO, mulheresDomingoQuinzenal: false }
  function tela42() {
    // mesma tela do teste anterior, com 42 h por semana e a regra do art. 386 desligada
    const base = cenario(2)
    const pessoas = base.dados.funcoes[0].pessoas!.map((p) => ({ ...p, jornadaPadrao: false, horasSemanais: 42 }))
    const funcoes: Funcao[] = [{ ...base.dados.funcoes[0], pessoas }]
    const empresa: Empresa = {
      ...base.dados.empresa,
      horaAbertura: '07:10',
      horarios: {
        0: { abre: '07:10', fecha: '21:00' },
        2: { abre: '09:30', fecha: '22:40' },
        3: { abre: '09:30', fecha: '22:40' },
        4: { abre: '09:30', fecha: '22:40' },
        5: { abre: '09:30', fecha: '22:40' },
      },
    }
    const turnos: Turno[] = [
      { id: 'p1', nome: 'FÁBRICA GELATO', inicio: '07:10', fim: '09:30', intervaloMin: 0 },
      { id: 'p2', nome: 'ATENDIMENTO SEG-SAB', inicio: '09:30', fim: '22:40', intervaloMin: 0 },
      { id: 'p3', nome: 'ATENDIMENTO DOM', inicio: '13:30', fim: '21:00', intervaloMin: 0 },
    ]
    const cobertura: Record<string, CoberturaTurno> = {
      p1: { util: 0, porDia: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0 }, sab: 2, dom: 2 },
      p2: { util: 2, sab: 2, dom: 0 },
      p3: { util: 0, sab: 0, dom: 2 },
    }
    const dados = { empresa, funcoes, turnos, cobertura, feriados: [] }
    const entrada: EntradaGerador = { empresa, funcoes, turnos, cobertura, feriados: [], inicio: '2026-12-20', semanas: 5, regrasPessoais }
    const paraVagas = { ...dados, custo: { encargosPct: 0, horaExtraPct: 0 }, etapaImpacto: 'etapa1' as const, regrasPessoais }
    return { dados, entrada, paraVagas }
  }
  const t = tela42()

  it('o quadro não pede reforço de domingo (7 pessoas, 1 domingo de folga a cada 3 semanas bastam)', () => {
    const q = calcularQuadro(t.paraVagas, 'etapa1', REGRAS, regrasPessoais)
    expect(q.contratar).toBe(0)
    expect(q.extraDomingo).toBe(0)
  })

  it('nenhum modelo de escala propõe contratação e todos cobrem a cobertura mínima', () => {
    const medidor = criarMedidorDeFuros(t.paraVagas)
    for (const m of MODELOS) expect(medidor(gerarEscala(t.entrada, m)), m).toBe(0)
    const props = gerarPropostasComVagas(t.entrada, ordemDeVagasDosDados(t.paraVagas), medidor, CONTRATOS_PARCIAIS)
    expect(props.map((p) => totalDeVagas(p.contratacoes))).toEqual([0, 0, 0])
  })

  it('com o art. 386 ligado o reforço de domingo continua sendo exigido', () => {
    const q = calcularQuadro(t.paraVagas, 'etapa1', REGRAS, REGRAS_PESSOAIS_PADRAO)
    expect(q.contratar).toBe(1)
    expect(q.extraDomingo).toBe(1)
  })
})

describe('elevarCarga', () => {
  const f = (p: Partial<PessoaEscala>): Funcao => ({
    id: 'x', nome: 'X', quantidade: 3, jornadaContratual: '44h', horasSemanaisAtuais: 44,
    pessoas: [
      { id: '1', nome: 'A', escalar: true, jornadaPadrao: false, menor: false, estagiario: false, ferias: [], horasSemanais: 30, ...p },
      { id: '2', nome: 'B', escalar: true, jornadaPadrao: false, menor: false, estagiario: false, ferias: [], horasSemanais: 44 },
      { id: '3', nome: 'C', escalar: true, jornadaPadrao: false, menor: false, estagiario: true, ferias: [], horasSemanais: 30 },
    ],
  })
  it('leva ao limite quem trabalha menos, sem mexer em estagiário nem em quem já tem 42 h ou mais', () => {
    const r = elevarCarga([f({})], 42)
    expect(r.ajustadas).toBe(1)
    expect(r.funcoes[0].pessoas!.map((p) => p.horasSemanais)).toEqual([42, 44, 30])
  })
  it('equipe sem cadastro nominal usa a carga da função', () => {
    const r = elevarCarga([{ id: 'y', nome: 'Y', quantidade: 4, jornadaContratual: '36h', horasSemanaisAtuais: 36 }], 42)
    expect(r.ajustadas).toBe(4)
    expect(r.funcoes[0].horasSemanaisAtuais).toBe(42)
  })
})
