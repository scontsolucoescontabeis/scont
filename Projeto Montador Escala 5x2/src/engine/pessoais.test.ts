import { describe, expect, it } from 'vitest'
import { REGRAS_PESSOAIS_PADRAO } from '../config/regras'
import type { CoberturaTurno, DiaEscala, Empresa, Escala, Funcao, Funcionario, PessoaEscala, RegrasPessoais, Turno } from '../types'
import { horasLiquidasMin, validarEscala, duracaoBrutaMin } from './conformidade'
import { coberturaParaRegras, criarFuncionarios, gerarEscala, MODELOS, type EntradaGerador } from './gerador'
import { diaDaSemana, minutosDe, somarDias } from './datas'
import { jornadaDaPessoa } from './jornada'

const LIGADO: RegrasPessoais = { ...REGRAS_PESSOAIS_PADRAO, mulheresDomingoQuinzenal: true }
const DESLIGADO: RegrasPessoais = { ...REGRAS_PESSOAIS_PADRAO, mulheresDomingoQuinzenal: false }

function pessoa(id: string, nome: string, extra: Partial<PessoaEscala> = {}): PessoaEscala {
  return { id, nome, escalar: true, jornadaPadrao: true, menor: false, estagiario: false, ferias: [], ...extra }
}

function fn(id: string, pessoas: PessoaEscala[], extra: Partial<Funcao> = {}): Funcao {
  return { id, nome: id, quantidade: 1, jornadaContratual: '44h', horasSemanaisAtuais: 44, pessoas, ...extra }
}

function empresa(abre = '08:00', fecha = '17:00'): Empresa {
  return {
    nome: 'Loja',
    setor: 'Varejo',
    diasFuncionamento: [true, true, true, true, true, true, true],
    horaAbertura: abre,
    horaFechamento: fecha,
    funcionaFeriados: true,
    acordoColetivo: 'nao',
    compensacaoDiaria: false,
  }
}

function entrada(
  funcoes: Funcao[],
  cob: CoberturaTurno,
  regrasPessoais: RegrasPessoais,
  semanas = 12,
  periodo: Turno = { id: 't1', nome: 'Loja', inicio: '08:00', fim: '17:00', intervaloMin: 0 },
): EntradaGerador {
  return {
    empresa: empresa(periodo.inicio, periodo.fim),
    funcoes,
    turnos: [periodo],
    cobertura: { [periodo.id]: cob },
    feriados: [],
    inicio: '2026-12-20',
    semanas,
    regrasPessoais,
  }
}

function validar(e: EntradaGerador, esc: Escala) {
  return validarEscala({
    escala: esc,
    cobertura: coberturaParaRegras(e.cobertura, e.empresa.diasFuncionamento, e.funcoes),
    feriados: [],
    empresaFuncionaFeriados: true,
    periodos: e.turnos,
    compensacaoDiaria: false,
    regrasPessoais: e.regrasPessoais,
  })
}

/** Maior sequência de domingos trabalhados de um funcionário. */
function maxDomingosSeguidos(esc: Escala, fid: string): number {
  let max = 0
  let run = 0
  esc.celulas[fid].forEach((c, i) => {
    if (diaDaSemana(somarDias(esc.inicio, i)) !== 0) return
    run = c.tipo === 'trabalho' ? run + 1 : 0
    max = Math.max(max, run)
  })
  return max
}

const turnoDaCel = (esc: Escala, c: DiaEscala) => esc.turnos.find((t) => t.id === c.turnoId)!

function horasPorDia(esc: Escala, fid: string): number[] {
  return esc.celulas[fid].map((c) => (c.tipo === 'trabalho' ? horasLiquidasMin(turnoDaCel(esc, c)) : 0))
}

function horasPorSemana(esc: Escala, fid: string): number[] {
  const d = horasPorDia(esc, fid)
  return Array.from({ length: esc.dias / 7 }, (_, s) => d.slice(s * 7, s * 7 + 7).reduce((a, b) => a + b, 0))
}

/** Minutos de um turno dentro de 22h–5h. */
function minutosNoturnos(t: Turno): number {
  const ini = minutosDe(t.inicio)
  const fim = ini + duracaoBrutaMin(t)
  let n = 0
  for (const base of [-1440, 0, 1440]) {
    const a = Math.max(ini, base + 22 * 60)
    const b = Math.min(fim, base + 1440 + 5 * 60)
    if (b > a) n += b - a
  }
  return n
}

const mulheres = (n: number) => Array.from({ length: n }, (_, i) => pessoa(`m${i + 1}`, `Mulher ${i + 1}`, { sexo: 'F' }))
const homens = (n: number) => Array.from({ length: n }, (_, i) => pessoa(`h${i + 1}`, `Homem ${i + 1}`, { sexo: 'M' }))

// ---------- Escalas montadas à mão ----------
const T8: Turno = { id: 't8', nome: '08–17', inicio: '08:00', fim: '17:00', intervaloMin: 60 } // 8h
const T6: Turno = { id: 't6', nome: '08–15', inicio: '08:00', fim: '15:00', intervaloMin: 60 } // 6h
const T9: Turno = { id: 't9', nome: '08–18', inicio: '08:00', fim: '18:00', intervaloMin: 60 } // 9h
const TNOITE: Turno = { id: 'tn', nome: '14–23', inicio: '14:00', fim: '23:00', intervaloMin: 60 } // 8h, 1h noturna

/** Semana domingo..sábado: códigos turnoId, F folga, D dsr. */
function semana(...cod: string[]): DiaEscala[] {
  return cod.map((c) => (c === 'F' ? { tipo: 'folga' } : c === 'D' ? { tipo: 'dsr' } : { tipo: 'trabalho', turnoId: c }))
}

function manual(funcionarios: Funcionario[], linhas: DiaEscala[][]): Escala {
  return {
    inicio: '2026-12-20',
    dias: linhas[0].length,
    turnos: [T8, T6, T9, TNOITE],
    funcionarios,
    celulas: Object.fromEntries(linhas.map((l, i) => [funcionarios[i].id, l])),
  }
}

function validarManual(esc: Escala, regrasPessoais: RegrasPessoais = LIGADO) {
  return validarEscala({ escala: esc, cobertura: [], feriados: [], empresaFuncionaFeriados: true, compensacaoDiaria: false, regrasPessoais })
}

// Trabalha o domingo e folga 2 dias na semana.
const SEM_DOM = semana('t8', 'D', 'F', 't8', 't8', 't8', 't8')
const SEM_FOLGA_DOM = semana('D', 'F', 't8', 't8', 't8', 't8', 't8')

describe('mulheres — domingo quinzenal (CLT art. 386)', () => {
  const funcoes = [fn('atd', mulheres(6))]
  const cob: CoberturaTurno = { util: 3, sab: 3, dom: 2 }

  it('ligado: nenhuma mulher trabalha 2 domingos seguidos, em nenhum modelo, e sem alerta domingoMulher', () => {
    const e = entrada(funcoes, cob, LIGADO)
    for (const { modelo } of MODELOS) {
      const esc = gerarEscala(e, modelo)
      for (const f of esc.funcionarios) expect(maxDomingosSeguidos(esc, f.id), `${modelo} ${f.nome}`).toBeLessThanOrEqual(1)
      expect(validar(e, esc).alertas.filter((a) => a.regraId === 'domingoMulher'), modelo).toEqual([])
    }
  })

  it('desligado: segue o ciclo comum (há 2 domingos seguidos em algum modelo) e nunca emite domingoMulher', () => {
    const e = entrada(funcoes, cob, DESLIGADO)
    let algum = false
    for (const { modelo } of MODELOS) {
      const esc = gerarEscala(e, modelo)
      if (esc.funcionarios.some((f) => maxDomingosSeguidos(esc, f.id) >= 2)) algum = true
      expect(validar(e, esc).alertas.filter((a) => a.regraId === 'domingoMulher'), modelo).toEqual([])
    }
    expect(algum).toBe(true)
  })

  it('escala manual: mulher com 2 domingos seguidos → 1 alerta vermelho domingoMulher (ligado), nenhum (desligado), sem domingoRodizio duplicado', () => {
    const esc = manual(
      [{ id: 'f1', nome: 'Ana', funcaoId: 'x', sexo: 'F' }],
      [[...SEM_DOM, ...SEM_DOM, ...SEM_FOLGA_DOM]],
    )
    const on = validarManual(esc, LIGADO).alertas
    const dm = on.filter((a) => a.regraId === 'domingoMulher')
    expect(dm).toHaveLength(1)
    expect(dm[0].severidade).toBe('vermelho')
    expect(dm[0].mensagem).toMatch(/CLT art\. 386/)
    expect(dm[0].mensagem).toMatch(/validar com o DP/)
    expect(on.filter((a) => a.regraId === 'domingoRodizio')).toEqual([])
    const off = validarManual(esc, DESLIGADO).alertas
    expect(off.filter((a) => a.regraId === 'domingoMulher')).toEqual([])
    expect(off.filter((a) => a.regraId === 'domingoRodizio')).toEqual([])
  })

  it('escala manual: mulher com 3 domingos seguidos gera domingoMulher, nunca domingoRodizio (ligado)', () => {
    const esc = manual([{ id: 'f1', nome: 'Ana', funcaoId: 'x', sexo: 'F' }], [[...SEM_DOM, ...SEM_DOM, ...SEM_DOM]])
    const al = validarManual(esc, LIGADO).alertas
    expect(al.filter((a) => a.regraId === 'domingoRodizio')).toEqual([])
    expect(al.filter((a) => a.regraId === 'domingoMulher').length).toBeGreaterThanOrEqual(1)
    // Desligado: vale a regra comum (3 domingos no comércio).
    expect(validarManual(esc, DESLIGADO).alertas.filter((a) => a.regraId === 'domingoRodizio')).toHaveLength(1)
  })

  it('homem com 2 domingos seguidos não gera alerta (ciclo comum do setor)', () => {
    const esc = manual([{ id: 'f1', nome: 'Bruno', funcaoId: 'x', sexo: 'M' }], [[...SEM_DOM, ...SEM_DOM, ...SEM_FOLGA_DOM]])
    const al = validarManual(esc, LIGADO).alertas
    expect(al.filter((a) => a.regraId === 'domingoMulher' || a.regraId === 'domingoRodizio')).toEqual([])
  })

  it('equipe mista: homens seguem o ciclo comum (até 2 domingos seguidos), mulheres no máx. 1', () => {
    const e = entrada([fn('atd', [...mulheres(3), ...homens(4)])], { util: 3, sab: 3, dom: 4 }, LIGADO)
    let homemCom2 = false
    for (const { modelo } of MODELOS) {
      const esc = gerarEscala(e, modelo)
      for (const f of esc.funcionarios) {
        const max = maxDomingosSeguidos(esc, f.id)
        if (f.sexo === 'F') expect(max, `${modelo} ${f.nome}`).toBeLessThanOrEqual(1)
        else {
          expect(max, `${modelo} ${f.nome}`).toBeLessThanOrEqual(2)
          if (max === 2) homemCom2 = true
        }
      }
      const r = validar(e, esc)
      expect(r.alertas.filter((a) => a.regraId === 'domingoMulher' || a.regraId === 'domingoRodizio'), modelo).toEqual([])
    }
    expect(homemCom2).toBe(true)
  })

  it('domingo com pouca gente (precisa de 4 de 5 mulheres): alerta de cobertura, mas nenhuma mulher trabalha 2 domingos seguidos', () => {
    const e = entrada([fn('atd', mulheres(5))], { util: 2, sab: 2, dom: 4 }, LIGADO)
    for (const { modelo } of MODELOS) {
      const esc = gerarEscala(e, modelo)
      for (const f of esc.funcionarios) expect(maxDomingosSeguidos(esc, f.id), `${modelo} ${f.nome}`).toBeLessThanOrEqual(1)
      const r = validar(e, esc)
      expect(r.alertas.some((a) => a.regraId === 'cobertura' && diaDaSemana(a.data!) === 0), modelo).toBe(true)
      expect(r.alertas.filter((a) => a.regraId === 'domingoMulher'), modelo).toEqual([])
    }
  })
})

describe('estagiários (Lei 11.788/2008 art. 10)', () => {
  const est = (horas?: number) => pessoa('e1', 'Estagiária', { estagiario: true, horasSemanais: horas })

  it('jornadaDaPessoa limita a semana e o dia (identifica pelo cadastro, não pelo cargo)', () => {
    const f = fn('adm', [], { nome: 'Auxiliar administrativo' })
    const liquida = (h: RegrasPessoais['estagioHorasSemanais']) => {
      const j = jornadaDaPessoa(f, est(44), 42, { ...REGRAS_PESSOAIS_PADRAO, estagioHorasSemanais: h })
      return j.bruto - j.intervaloMin
    }
    expect(liquida(20)).toBe(240)
    expect(liquida(30)).toBe(360)
    expect(liquida(40)).toBe(480)
    // Sem o parâmetro: padrão (30 h).
    const j = jornadaDaPessoa(f, est(44), 42)
    expect(j.bruto - j.intervaloMin).toBe(360)
    // Cargo "Estagiário" sem o cadastro de estagiário: jornada comum.
    const comum = jornadaDaPessoa(fn('est', [], { nome: 'Estagiário' }), pessoa('x', 'X', { horasSemanais: 44 }), 42)
    expect(comum.bruto - comum.intervaloMin).toBe(504)
  })

  for (const [h, dia] of [[20, 240], [30, 360], [40, 480]] as const) {
    it(`escala gerada (${h} h): nunca passa de ${h} h/semana nem de ${dia / 60} h/dia`, () => {
      const rp: RegrasPessoais = { ...REGRAS_PESSOAIS_PADRAO, estagioHorasSemanais: h }
      const e = entrada([fn('atd', [...homens(3), est()])], { util: 2, sab: 2, dom: 1 }, rp)
      for (const { modelo } of MODELOS) {
        const esc = gerarEscala(e, modelo)
        expect(Math.max(...horasPorDia(esc, 'atd-e1')), modelo).toBe(dia)
        for (const t of horasPorSemana(esc, 'atd-e1')) expect(t, modelo).toBeLessThanOrEqual(h * 60)
        expect(validar(e, esc).alertas.filter((a) => a.regraId === 'estagioJornada'), modelo).toEqual([])
      }
    })
  }

  it('escala manual acima de 30 h → estagioJornada vermelho; mesmo horário para não estagiário → nenhum', () => {
    const linha = semana('D', 'F', 't8', 't8', 't8', 't8', 't8') // 40 h, 8 h/dia
    const esc = manual(
      [
        { id: 'f1', nome: 'Estagiária', funcaoId: 'x', estagiario: true },
        { id: 'f2', nome: 'Efetiva', funcaoId: 'x' },
      ],
      [linha, linha],
    )
    const al = validarManual(esc).alertas.filter((a) => a.regraId === 'estagioJornada')
    expect(al.length).toBeGreaterThan(0)
    expect(al.every((a) => a.funcionarioId === 'f1' && a.severidade === 'vermelho')).toBe(true)
    expect(al.some((a) => /30h/.test(a.mensagem) && /11\.788/.test(a.mensagem))).toBe(true)
    // Dia de 8 h acima de 6 h.
    expect(al.some((a) => /6h/.test(a.mensagem))).toBe(true)
  })

  it('escala manual dentro do limite (6 h × 5) → sem alerta', () => {
    const esc = manual([{ id: 'f1', nome: 'Estagiária', funcaoId: 'x', estagiario: true }], [semana('D', 'F', 't6', 't6', 't6', 't6', 't6')])
    expect(validarManual(esc).alertas.filter((a) => a.regraId === 'estagioJornada')).toEqual([])
  })
})

describe('menores de 18 anos (CLT arts. 404, 411 e 413)', () => {
  const periodo: Turno = { id: 't1', nome: 'Loja', inicio: '08:00', fim: '23:00', intervaloMin: 0 }

  it('escala gerada: menor nunca entra em 22h–5h (outros entram) e trabalha até 8 h/dia', () => {
    const e = entrada(
      [fn('atd', [...homens(4), pessoa('j1', 'Jovem', { menor: true })])],
      { util: 2, sab: 2, dom: 1 },
      LIGADO,
      4,
      periodo,
    )
    for (const { modelo } of MODELOS) {
      const esc = gerarEscala(e, modelo)
      const noturnoDe = (fid: string) =>
        esc.celulas[fid].some((c) => c.tipo === 'trabalho' && minutosNoturnos(turnoDaCel(esc, c)) > 0)
      expect(noturnoDe('atd-j1'), modelo).toBe(false)
      expect(esc.funcionarios.some((f) => f.id !== 'atd-j1' && noturnoDe(f.id)), modelo).toBe(true)
      expect(Math.max(...horasPorDia(esc, 'atd-j1')), modelo).toBeLessThanOrEqual(480)
      const r = validar(e, esc)
      expect(r.alertas.filter((a) => a.regraId === 'menorNoturno' || a.regraId === 'menorJornada'), modelo).toEqual([])
    }
  })

  it('menor com horário fixo noturno: mantém o horário e a conformidade aponta', () => {
    const e = entrada(
      [fn('atd', [...homens(2), pessoa('j1', 'Jovem', { menor: true, entrada: '14:00', saida: '23:00', intervaloMin: 60 })])],
      { util: 1, sab: 1, dom: 1 },
      LIGADO,
      2,
      periodo,
    )
    const esc = gerarEscala(e, 'fixo')
    const t = turnoDaCel(esc, esc.celulas['atd-j1'].find((c) => c.tipo === 'trabalho')!)
    expect([t.inicio, t.fim]).toEqual(['14:00', '23:00'])
    expect(validar(e, esc).alertas.some((a) => a.regraId === 'menorNoturno')).toBe(true)
  })

  it('escala manual: turno noturno → menorNoturno; dia de 9 h → menorJornada', () => {
    const esc = manual(
      [
        { id: 'f1', nome: 'Jovem', funcaoId: 'x', menor: true },
        { id: 'f2', nome: 'Jovem 2', funcaoId: 'x', menor: true },
        { id: 'f3', nome: 'Adulto', funcaoId: 'x' },
      ],
      [
        semana('D', 'F', 'tn', 't8', 't8', 't8', 't8'),
        semana('D', 'F', 't9', 't8', 't8', 't8', 't6'),
        semana('D', 'F', 'tn', 't9', 't8', 't8', 't8'),
      ],
    )
    const al = validarManual(esc).alertas
    const not = al.filter((a) => a.regraId === 'menorNoturno')
    expect(not.map((a) => a.funcionarioId)).toEqual(['f1'])
    expect(not[0].severidade).toBe('vermelho')
    expect(not[0].mensagem).toMatch(/404/)
    const jor = al.filter((a) => a.regraId === 'menorJornada')
    expect(jor.map((a) => a.funcionarioId)).toEqual(['f2'])
    expect(jor[0].severidade).toBe('vermelho')
    expect(jor[0].mensagem).toMatch(/411|413/)
  })
})

describe('empresa realista mista', () => {
  it('mulheres, homens, 1 estagiária e 1 menor: só alertas vermelhos de cobertura, nos 3 modelos', () => {
    const funcoes = [
      fn('atd', [...mulheres(4), ...homens(3)]),
      fn('cx', [pessoa('c1', 'Carla', { sexo: 'F' }), pessoa('c2', 'Caio', { sexo: 'M' }), pessoa('c3', 'Cida', { sexo: 'F' })], { nome: 'Caixa' }),
      fn('adm', [pessoa('e1', 'Estagiária', { sexo: 'F', estagiario: true }), pessoa('j1', 'Jovem aprendiz', { sexo: 'M', menor: true, estagiario: true })], { nome: 'Apoio' }),
    ]
    const e = entrada(funcoes, { util: 5, sab: 5, dom: 3 }, LIGADO, 12, { id: 't1', nome: 'Loja', inicio: '08:00', fim: '22:00', intervaloMin: 0 })
    for (const { modelo } of MODELOS) {
      const esc = gerarEscala(e, modelo)
      const vermelhos = validar(e, esc).alertas.filter((a) => a.severidade === 'vermelho' && a.regraId !== 'cobertura')
      expect(vermelhos, modelo).toEqual([])
    }
  })
})

describe('sem atributos pessoais', () => {
  it('funcionários avulsos não ganham sexo/menor/estagiario', () => {
    const lista = criarFuncionarios([{ id: 'a', nome: 'A', quantidade: 2, jornadaContratual: '44h', horasSemanaisAtuais: 44 }])
    for (const f of lista) {
      expect('sexo' in f).toBe(false)
      expect('menor' in f).toBe(false)
      expect('estagiario' in f).toBe(false)
    }
  })

  it('pessoa nominal copia sexo, menor e estagiario', () => {
    const [f] = criarFuncionarios([fn('a', [pessoa('p', 'P', { sexo: 'F', menor: true, estagiario: true })])])
    expect(f).toEqual({ id: 'a-p', nome: 'P', funcaoId: 'a', sexo: 'F', menor: true, estagiario: true })
  })
})
