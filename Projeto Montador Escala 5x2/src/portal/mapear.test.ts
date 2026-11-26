import { describe, expect, it } from 'vitest'
import { mapearDadosPortal, type DadosPortal } from './mapear'

type J = NonNullable<DadosPortal['jornadas']>[number]

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

  it('jornadas do RH são ignoradas: 42h, sem entrada/saída/intervalo', () => {
    const js = [...semana('1', '08:00', '17:30', '12:00', '13:30'), j('1', 'sabado', '08:00', '12:00')]
    const p = mapearDadosPortal(dados({ empregados: [emp('1', 'Ana')], jornadas: js })).funcoes[0].pessoas![0]
    expect(p.horasSemanais).toBe(42)
    expect(p.entrada).toBeUndefined()
    expect(p.saida).toBeUndefined()
    expect(p.intervaloMin).toBeUndefined()
    expect(p.jornadaPadrao).toBe(false)
  })

  it('sem jornadas (campo ausente): 42h', () => {
    const d = dados({ empregados: [emp('1', 'Ana')] })
    delete (d as Partial<DadosPortal>).jornadas
    const p = mapearDadosPortal(d).funcoes[0].pessoas![0]
    expect(p.horasSemanais).toBe(42)
    expect(p.entrada).toBeUndefined()
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

  it('função: 42h semanais mesmo com jornadas no RH', () => {
    const f = mapearDadosPortal(
      dados({ empregados: [emp('1', 'A'), emp('2', 'B')], jornadas: [...semana('1', '08:00', '17:00'), ...semana('2', '08:00', '16:00')] }),
    ).funcoes[0]
    expect(f.horasSemanaisAtuais).toBe(42)
    expect(f.jornadaContratual).toBe('42h semanais')
  })

  it('pontuação/espaços variantes do cargo viram UMA função', () => {
    const r = mapearDadosPortal(dados({ empregados: [emp('1', 'A', 'Aux. Admin'), emp('2', 'B', 'Aux Admin'), emp('3', 'C', 'AUX-ADMIN')] }))
    expect(r.funcoes).toHaveLength(1)
    expect(r.funcoes[0].id).toBe('cargo-aux-admin')
    expect(r.funcoes[0].pessoas).toHaveLength(3)
  })

  it('cargo só pontuação, vazio e null: um único Sem cargo', () => {
    const r = mapearDadosPortal(dados({ empregados: [emp('1', 'A', '---'), emp('2', 'B', ''), emp('3', 'C', null)] }))
    expect(r.funcoes).toHaveLength(1)
    expect(r.funcoes[0].nome).toBe('Sem cargo')
    expect(r.funcoes[0].id).toBe('cargo-sem-cargo')
  })

  it('ids únicos e estáveis (mesma entrada, ordem invertida)', () => {
    const lista = [emp('1', 'A', 'A/B'), emp('2', 'B', 'A-B'), emp('3', 'C', 'Vendedor'), emp('4', 'D', 'Aux. Admin'), emp('5', 'E', null), emp('6', 'F', 'Caixa')]
    const ids = (l: typeof lista) => mapearDadosPortal(dados({ empregados: l })).funcoes.map((f) => f.id)
    const a = ids(lista)
    expect(new Set(a).size).toBe(a.length)
    expect(ids(lista)).toEqual(a)
    expect(ids([...lista].reverse())).toEqual(a)
  })
})

describe('mapearDadosPortal — regras por pessoa', () => {
  const um = (e: Record<string, unknown>, jornadas: J[] = []) =>
    mapearDadosPortal(dados({ empregados: [{ ...emp('1', 'Ana'), ...e }], jornadas })).funcoes[0].pessoas![0]

  it('sexo: F e M (qualquer caixa); outros valores e null viram undefined', () => {
    expect(um({ sexo: 'F' }).sexo).toBe('F')
    expect(um({ sexo: 'm' }).sexo).toBe('M')
    expect(um({ sexo: 'Feminino' }).sexo).toBeUndefined()
    expect(um({ sexo: null }).sexo).toBeUndefined()
    expect(um({}).sexo).toBeUndefined()
  })

  it('menor: só quando menor_de_idade === true', () => {
    expect(um({ menor_de_idade: true }).menor).toBe(true)
    expect(um({ menor_de_idade: false }).menor).toBe(false)
    expect(um({ menor_de_idade: null }).menor).toBe(false)
    expect(um({}).menor).toBe(false)
  })

  it('estagiário: três grafias; Empregado e ausente não', () => {
    for (const t of ['Estágiario', 'Estagiário', 'Estagiario', ' ESTAGIÁRIO ']) expect(um({ tipo_empregado: t }).estagiario).toBe(true)
    expect(um({ tipo_empregado: 'Empregado' }).estagiario).toBe(false)
    expect(um({ tipo_empregado: null }).estagiario).toBe(false)
    expect(um({ tipo_empregado: undefined }).estagiario).toBe(false)
  })

  it('estagiário usa a carga das regras (30 padrão; 20/40 com o argumento), mesmo com jornada no banco', () => {
    const e = { tipo_empregado: 'Estagiário' }
    expect(um(e).horasSemanais).toBe(30)
    const comJornada = um(e, semana('1', '08:00', '17:00', '12:00', '13:00'))
    expect(comJornada.horasSemanais).toBe(30)
    expect(comJornada.entrada).toBeUndefined()
    expect(comJornada.intervaloMin).toBeUndefined()
    for (const h of [20, 30, 40] as const) {
      const p = mapearDadosPortal(dados({ empregados: [{ ...emp('1', 'Ana'), ...e }] }), { mulheresDomingoQuinzenal: true, estagioHorasSemanais: h }).funcoes[0].pessoas![0]
      expect(p.horasSemanais).toBe(h)
    }
  })

  it('adulto Empregado: 42h com ou sem jornada no banco', () => {
    expect(um({}).horasSemanais).toBe(42)
    expect(um({}, semana('1', '08:00', '17:00', '12:00', '13:00')).horasSemanais).toBe(42)
  })

  it('mediana do grupo continua funcionando com estagiários', () => {
    const r = mapearDadosPortal(dados({ empregados: [{ ...emp('1', 'A'), tipo_empregado: 'Estagiário' }, emp('2', 'B'), emp('3', 'C')] }))
    expect(r.funcoes[0].horasSemanaisAtuais).toBe(42)
  })
})
