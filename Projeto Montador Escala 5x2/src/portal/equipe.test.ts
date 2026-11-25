import { describe, expect, it } from 'vitest'
import type { Funcao, PessoaEscala } from '../types'
import {
  OPCOES_JORNADA_ESTAGIO,
  ROTULO_REGRA_MULHERES,
  atualizarPessoa,
  etiquetasPessoa,
  jornadaMaisComum,
  normalizarHoras,
  normalizarIntervalo,
  resumoFerias,
  rotuloSexo,
} from './equipe'
import { REGRAS_PESSOAIS_PADRAO } from '../config/regras'

describe('regras por pessoa (passo 2)', () => {
  const ligado = { ...REGRAS_PESSOAIS_PADRAO, mulheresDomingoQuinzenal: true }
  const desligado = { ...REGRAS_PESSOAIS_PADRAO, mulheresDomingoQuinzenal: false }
  const p = (extra: Partial<PessoaEscala> = {}): PessoaEscala => ({
    id: 'x',
    nome: 'X',
    escalar: true,
    jornadaPadrao: false,
    menor: false,
    estagiario: false,
    ferias: [],
    ...extra,
  })

  it('rotuloSexo', () => {
    expect(rotuloSexo('F')).toBe('Feminino')
    expect(rotuloSexo('M')).toBe('Masculino')
    expect(rotuloSexo(undefined)).toBe('—')
  })

  it('etiquetas: estagiário, menor e domingo quinzenal só para mulheres com a regra ligada', () => {
    expect(etiquetasPessoa(p(), ligado)).toEqual([])
    expect(etiquetasPessoa(p({ estagiario: true, menor: true }), ligado)).toEqual(['estagiário', 'menor de 18'])
    expect(etiquetasPessoa(p({ sexo: 'F' }), ligado)).toEqual(['domingo quinzenal (art. 386)'])
    expect(etiquetasPessoa(p({ sexo: 'F' }), desligado)).toEqual([])
    expect(etiquetasPessoa(p({ sexo: 'M' }), ligado)).toEqual([])
    expect(etiquetasPessoa(p({ sexo: 'F', estagiario: true }), ligado)).toEqual(['estagiário', 'domingo quinzenal (art. 386)'])
  })

  it('opções da jornada do estagiário: 20, 30 (padrão) e 40 h', () => {
    expect(OPCOES_JORNADA_ESTAGIO.map((o) => o.valor)).toEqual([20, 30, 40])
    expect(OPCOES_JORNADA_ESTAGIO[0].rotulo).toBe('20 h (ensino fundamental ou especial — 4 h/dia)')
    expect(OPCOES_JORNADA_ESTAGIO[1].rotulo).toBe('30 h (padrão — 6 h/dia)')
    expect(OPCOES_JORNADA_ESTAGIO[2].rotulo).toBe('40 h (cursos que alternam teoria e prática — 8 h/dia)')
    expect(OPCOES_JORNADA_ESTAGIO.some((o) => o.valor === REGRAS_PESSOAIS_PADRAO.estagioHorasSemanais)).toBe(true)
    expect(ROTULO_REGRA_MULHERES).toBe('Aplicar CLT art. 386 às mulheres (domingo de folga ao menos a cada 2 semanas)')
  })
})

const pessoa = (id: string, extra: Partial<PessoaEscala> = {}): PessoaEscala => ({
  id,
  nome: `Pessoa ${id}`,
  escalar: true,
  jornadaPadrao: false,
  menor: false,
  estagiario: false,
  ferias: [],
  ...extra,
})

const funcao = (id: string, pessoas: PessoaEscala[]): Funcao => ({
  id,
  nome: `Cargo ${id}`,
  quantidade: pessoas.filter((p) => p.escalar).length,
  jornadaContratual: '44h semanais',
  horasSemanaisAtuais: 44,
  pessoas,
})

describe('atualizarPessoa', () => {
  const base = () => [
    funcao('f1', [pessoa('a'), pessoa('b')]),
    funcao('f2', [pessoa('a'), pessoa('c')]),
  ]

  it('altera só a pessoa certa na função certa', () => {
    const r = atualizarPessoa(base(), 'f1', 'a', { horasSemanais: 36 })
    expect(r[0].pessoas![0].horasSemanais).toBe(36)
    expect(r[0].pessoas![1].horasSemanais).toBeUndefined()
    expect(r[1].pessoas![0].horasSemanais).toBeUndefined()
  })

  it('recalcula quantidade ao desmarcar e remarcar', () => {
    const d = atualizarPessoa(base(), 'f1', 'a', { escalar: false })
    expect(d[0].quantidade).toBe(1)
    const m = atualizarPessoa(d, 'f1', 'a', { escalar: true })
    expect(m[0].quantidade).toBe(2)
  })

  it('ids desconhecidos devolvem a entrada', () => {
    const f = base()
    expect(atualizarPessoa(f, 'x', 'a', { escalar: false })).toBe(f)
    expect(atualizarPessoa(f, 'f1', 'x', { escalar: false })).toBe(f)
  })

  it('undefined limpa o campo', () => {
    const f = [funcao('f1', [pessoa('a', { entrada: '08:00', intervaloMin: 60 })])]
    const r = atualizarPessoa(f, 'f1', 'a', { entrada: undefined, intervaloMin: undefined })
    expect(r[0].pessoas![0].entrada).toBeUndefined()
    expect(r[0].pessoas![0].intervaloMin).toBeUndefined()
    expect(r[0].pessoas![0].nome).toBe('Pessoa a')
  })

  it('não muta a entrada e preserva funções não tocadas', () => {
    const f = base()
    const copia = JSON.parse(JSON.stringify(f))
    const r = atualizarPessoa(f, 'f1', 'a', { escalar: false })
    expect(f).toEqual(copia)
    expect(r).not.toBe(f)
    expect(r[1]).toBe(f[1])
    expect(r[0].pessoas![1]).toBe(f[0].pessoas![1])
  })
})

describe('resumoFerias', () => {
  it('formata dd/mm–dd/mm', () => {
    expect(resumoFerias([{ inicio: '2026-12-28', fim: '2027-01-06' }])).toEqual(['28/12–06/01'])
  })
  it('período de um dia', () => {
    expect(resumoFerias([{ inicio: '2026-12-25', fim: '2026-12-25' }])).toEqual(['25/12–25/12'])
  })
  it('vazio', () => {
    expect(resumoFerias([])).toEqual([])
  })
  it('ignora inválidos e mantém a ordem', () => {
    expect(
      resumoFerias([
        { inicio: '2026-03-01', fim: '2026-03-10' },
        { inicio: '', fim: '2026-03-10' },
        { inicio: 'abc', fim: 'def' },
        { inicio: '2026-01-05', fim: '2026-01-06' },
      ]),
    ).toEqual(['01/03–10/03', '05/01–06/01'])
  })
})

describe('jornadaMaisComum', () => {
  it('escolhe a combinação mais frequente', () => {
    const f = funcao('f', [
      pessoa('a', { horasSemanais: 40 }),
      pessoa('b', { horasSemanais: 36, entrada: '08:00', saida: '14:00', intervaloMin: 15 }),
      pessoa('c', { horasSemanais: 36, entrada: '08:00', saida: '14:00', intervaloMin: 15 }),
    ])
    expect(jornadaMaisComum(f)).toEqual({
      horasSemanais: 36,
      entrada: '08:00',
      saida: '14:00',
      intervaloMin: 15,
    })
  })
  it('empate: primeira vista', () => {
    const f = funcao('f', [pessoa('a', { horasSemanais: 40 }), pessoa('b', { horasSemanais: 36 })])
    expect(jornadaMaisComum(f)?.horasSemanais).toBe(40)
  })
  it('sem escaláveis ou sem pessoas: null', () => {
    expect(jornadaMaisComum(funcao('f', [pessoa('a', { escalar: false })]))).toBeNull()
    expect(jornadaMaisComum({ ...funcao('f', []), pessoas: undefined })).toBeNull()
  })
  it('ignora quem não é escalado e usa a carga da função quando a pessoa não tem', () => {
    const f = funcao('f', [
      pessoa('a', { escalar: false, horasSemanais: 20 }),
      pessoa('b', { escalar: false, horasSemanais: 20 }),
      pessoa('c'),
    ])
    expect(jornadaMaisComum(f)).toEqual({ horasSemanais: 44 })
  })
})

describe('normalizarIntervalo', () => {
  it('undefined/NaN viram undefined; limita a 0..240 inteiro', () => {
    expect(normalizarIntervalo(undefined)).toBeUndefined()
    expect(normalizarIntervalo(NaN)).toBeUndefined()
    expect(normalizarIntervalo(-30)).toBe(0)
    expect(normalizarIntervalo(999)).toBe(240)
    expect(normalizarIntervalo(60)).toBe(60)
    expect(normalizarIntervalo(59.6)).toBe(60)
    expect(normalizarIntervalo(0)).toBe(0)
  })
})

describe('normalizarHoras', () => {
  it('undefined/NaN viram undefined; limita a 1..60 com uma casa', () => {
    expect(normalizarHoras(undefined)).toBeUndefined()
    expect(normalizarHoras(NaN)).toBeUndefined()
    expect(normalizarHoras(0)).toBe(1)
    expect(normalizarHoras(-5)).toBe(1)
    expect(normalizarHoras(100)).toBe(60)
    expect(normalizarHoras(44)).toBe(44)
    expect(normalizarHoras(43.46)).toBe(43.5)
  })
})
