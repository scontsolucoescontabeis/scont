import { describe, expect, it } from 'vitest'
import { mapearDadosPortal, type DadosPortal } from './mapear'

type J = DadosPortal['jornadas'][number]

function dados(p: Partial<DadosPortal> = {}): DadosPortal {
  return { empresa: { codigo_empresa: '1', nome_empresa: 'Loja X' }, empregados: [], jornadas: [], ferias: [], ...p }
}
const emp = (cod: string, nome: string, cargo: string | null = 'Vendedor') => ({
  codigo_empregado: cod,
  nome_empregado: nome,
  cargo,
  tipo_empregado: 'Empregado',
})
const j = (cod: string, dia: string, entrada: string | null, saida: string | null, ii: string | null = null, fi: string | null = null): J => ({
  codigo_empregado: cod,
  dia_semana: dia,
  entrada,
  saida,
  intervalo_inicio: ii,
  intervalo_fim: fi,
})
const semana = (cod: string, e: string, s: string, ii: string | null = null, fi: string | null = null) =>
  ['segunda', 'terca', 'quarta', 'quinta', 'sexta'].map((d) => j(cod, d, e, s, ii, fi))

describe('mapearDadosPortal', () => {
  it('empresa null e empregados vazios', () => {
    const r = mapearDadosPortal(dados({ empresa: null }))
    expect(r.nomeEmpresa).toBe('')
    expect(r.funcoes).toEqual([])
  })

  it('nomeEmpresa vem da empresa', () => {
    expect(mapearDadosPortal(dados()).nomeEmpresa).toBe('Loja X')
  })

  it('agrupa por cargo ignorando caixa, acento e espaços; vazio vira Sem cargo', () => {
    const r = mapearDadosPortal(
      dados({
        empregados: [emp('1', 'Ana', 'Vendedor'), emp('2', 'Bia', ' VENDEDOR '), emp('3', 'Caio', null), emp('4', 'Dan', '  '), emp('5', 'Eva', 'Gerência'), emp('6', 'Fo', 'gerencia')],
      }),
    )
    expect(r.funcoes.map((f) => f.nome)).toEqual(['Gerência', 'Sem cargo', 'Vendedor'])
    const v = r.funcoes.find((f) => f.nome === 'Vendedor')!
    expect(v.id).toBe('cargo-vendedor')
    expect(v.pessoas!.map((p) => p.nome)).toEqual(['Ana', 'Bia'])
    const s = r.funcoes.find((f) => f.nome === 'Sem cargo')!
    expect(s.id).toBe('cargo-sem-cargo')
    expect(s.quantidade).toBe(2)
    expect(r.funcoes.find((f) => f.nome === 'Gerência')!.id).toBe('cargo-gerencia')
  })

  it('quantidade = pessoas com escalar; id da pessoa = codigo', () => {
    const r = mapearDadosPortal(dados({ empregados: [emp('10', 'Ana'), emp('11', 'Bia')] }))
    const f = r.funcoes[0]
    expect(f.pessoas![0].id).toBe('10')
    expect(f.pessoas!.every((p) => p.escalar)).toBe(true)
    expect(f.quantidade).toBe(f.pessoas!.filter((p) => p.escalar).length)
    expect(f.quantidade).toBe(2)
  })

  it('pessoas ordenadas por nome (pt-BR)', () => {
    const r = mapearDadosPortal(dados({ empregados: [emp('1', 'Zélia'), emp('2', 'Ágata'), emp('3', 'Bruno')] }))
    expect(r.funcoes[0].pessoas!.map((p) => p.nome)).toEqual(['Ágata', 'Bruno', 'Zélia'])
  })

  it('jornada com linhas seg-sex 08-17 sem intervalo = 40h', () => {
    const r = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: semana('1', '08:00', '17:00') }))
    const p = r.funcoes[0].pessoas![0]
    expect(p.horasSemanais).toBe(40)
    expect(p.entrada).toBe('08:00')
    expect(p.saida).toBe('17:00')
    expect(p.jornadaPadrao).toBe(false)
    expect(p.intervaloMin).toBeUndefined()
  })

  it('aceita horários com segundos', () => {
    const r = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: semana('1', '08:00:00', '17:00:00') }))
    const p = r.funcoes[0].pessoas![0]
    expect(p.entrada).toBe('08:00')
    expect(p.saida).toBe('17:00')
  })

  it('intervalo informado desconta e vira intervaloMin', () => {
    const r = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: semana('1', '08:00', '17:30', '12:00', '13:30') }))
    const p = r.funcoes[0].pessoas![0]
    expect(p.intervaloMin).toBe(90)
    expect(p.horasSemanais).toBe(40) // (570-90)=480 x5
  })

  it('intervalos diferentes: o mais comum', () => {
    const js = [
      j('1', 'segunda', '08:00', '17:00', '12:00', '13:00'),
      j('1', 'terca', '08:00', '17:00', '12:00', '13:30'),
      j('1', 'quarta', '08:00', '17:00', '12:00', '13:30'),
    ]
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: js })).funcoes[0].pessoas![0]
    expect(p.intervaloMin).toBe(90)
  })

  it('entrada/saída variando: horário livre, horas somadas', () => {
    const js = [j('1', 'segunda', '08:00', '17:00'), j('1', 'terca', '09:00', '18:00')]
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: js })).funcoes[0].pessoas![0]
    expect(p.entrada).toBeUndefined()
    expect(p.saida).toBeUndefined()
    expect(p.horasSemanais).toBe(16)
    expect(p.jornadaPadrao).toBe(false)
  })

  it('sem linhas: 44h e jornadaPadrao', () => {
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')] })).funcoes[0].pessoas![0]
    expect(p.horasSemanais).toBe(44)
    expect(p.jornadaPadrao).toBe(true)
    expect(p.entrada).toBeUndefined()
    expect(p.saida).toBeUndefined()
    expect(p.intervaloMin).toBeUndefined()
  })

  it('dias sem acento reconhecidos; desconhecido ignorado', () => {
    const js = [j('1', 'Terça', '08:00', '12:00'), j('1', 'sabado', '08:00', '12:00'), j('1', 'feriado', '08:00', '12:00'), j('1', 'DOMINGO', '08:00', '12:00')]
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: js })).funcoes[0].pessoas![0]
    expect(p.horasSemanais).toBe(12)
  })

  it('só dia desconhecido: continua jornada padrão', () => {
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: [j('1', 'xyz', '08:00', '12:00')] })).funcoes[0].pessoas![0]
    expect(p.jornadaPadrao).toBe(true)
  })

  it('entrada ou saída vazia: dia ignorado', () => {
    const js = [j('1', 'segunda', '08:00', null), j('1', 'terca', '', '17:00'), j('1', 'quarta', '08:00', '12:00')]
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: js })).funcoes[0].pessoas![0]
    expect(p.horasSemanais).toBe(4)
    expect(p.entrada).toBe('08:00')
  })

  it('virada de dia (+24h) limitada a 16h bruto', () => {
    // 22:00 -> 06:00 = 8h bruto, liquido 7h (intervalo auto 60)
    const a = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: [j('1', 'segunda', '22:00', '06:00')] })).funcoes[0].pessoas![0]
    expect(a.horasSemanais).toBe(7)
    // 08:00 -> 08:00 = 24h, capado em 16h; intervalo 60 => 15h
    const b = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: [j('1', 'segunda', '08:00', '08:00')] })).funcoes[0].pessoas![0]
    expect(b.horasSemanais).toBe(15)
  })

  it('duplicadas na mesma pessoa+dia: a última vale', () => {
    const js = [j('1', 'segunda', '08:00', '12:00'), j('1', 'segunda', '08:00', '17:00')]
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: js })).funcoes[0].pessoas![0]
    expect(p.horasSemanais).toBe(8)
  })

  it('férias válidas ordenadas; inválidas descartadas', () => {
    const fs = [
      { codigo_empregado: '1', ferias_inicio: '2026-12-01', ferias_fim: '2026-12-10' },
      { codigo_empregado: '1', ferias_inicio: '2026-03-01', ferias_fim: '2026-03-30' },
      { codigo_empregado: '1', ferias_inicio: '2026-05-10', ferias_fim: '2026-05-01' },
      { codigo_empregado: '1', ferias_inicio: null, ferias_fim: '2026-06-01' },
      { codigo_empregado: '1', ferias_inicio: 'abc', ferias_fim: '2026-06-01' },
      { codigo_empregado: '2', ferias_inicio: '2026-01-01', ferias_fim: '2026-01-05' },
    ]
    const r = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana'), emp('2', 'Bia')], ferias: fs as DadosPortal['ferias'] }))
    const ana = r.funcoes[0].pessoas!.find((p) => p.id === '1')!
    expect(ana.ferias).toEqual([
      { inicio: '2026-03-01', fim: '2026-03-30' },
      { inicio: '2026-12-01', fim: '2026-12-10' },
    ])
    expect(r.funcoes[0].pessoas!.find((p) => p.id === '2')!.ferias).toHaveLength(1)
  })

  it('horasSemanaisAtuais: mediana (ímpar e par) e jornadaContratual', () => {
    const odd = mapearDadosPortal(
      dados({
        empregados: [emp('1', 'A'), emp('2', 'B'), emp('3', 'C')],
        jornadas: [...semana('1', '08:00', '17:00'), ...semana('2', '08:00', '16:00')], // 40, 35; C padrao 44
      }),
    ).funcoes[0]
    expect(odd.horasSemanaisAtuais).toBe(40)
    expect(odd.jornadaContratual).toBe('40h semanais')
    const even = mapearDadosPortal(
      dados({
        empregados: [emp('1', 'A'), emp('2', 'B')],
        jornadas: [...semana('1', '08:00', '17:00'), ...semana('2', '08:00', '16:00')], // 40, 35
      }),
    ).funcoes[0]
    expect(even.horasSemanaisAtuais).toBe(37.5)
    expect(even.jornadaContratual).toBe('38h semanais')
  })

  it('todos padrão: 44h', () => {
    const f = mapearDadosPortal(dados({ empregados: [emp('1', 'A'), emp('2', 'B')] })).funcoes[0]
    expect(f.horasSemanaisAtuais).toBe(44)
    expect(f.jornadaContratual).toBe('44h semanais')
  })
})
