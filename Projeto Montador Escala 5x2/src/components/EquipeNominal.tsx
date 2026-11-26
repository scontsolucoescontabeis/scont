import { Fragment, useState } from 'react'
import { useStore } from '../store/useStore'
import { horarioDoDiaPessoa, horasDaJornadaDias } from '../engine/jornada'
import {
  DIAS_JORNADA,
  OPCOES_JORNADA_ESTAGIO,
  jornadaDiasInicial,
  ROTULO_REGRA_MULHERES,
  atualizarPessoa,
  etiquetasPessoa,
  normalizarHoras,
  normalizarIntervalo,
  resumoFerias,
  rotuloSexo,
  type EdicaoPessoa,
} from '../portal/equipe'
import type { HorarioDiaPessoa, PessoaEscala, RegrasPessoais } from '../types'

export function EquipeNominal() {
  const funcoes = useStore((s) => s.funcoes)
  const portal = useStore((s) => s.portal)
  const set = useStore((s) => s.set)
  const regras = useStore((s) => s.regrasPessoais)
  const setRegras = useStore((s) => s.setRegrasPessoais)
  /** Pessoa com a jornada por dia aberta ("funcaoId/pessoaId"). */
  const [aberta, setAberta] = useState<string | null>(null)

  // O App já mostra carregando, erro e "nenhum empregado"; aqui nada é editável nesses casos.
  if (!portal || portal.carregando || portal.erro || portal.nenhumEmpregado) return null

  const editar = (funcaoId: string, pessoaId: string, p: EdicaoPessoa) =>
    set({
      funcoes: atualizarPessoa(funcoes, funcaoId, pessoaId, p),
      escala: null,
      propostas: [],
    })

  const numero = (v: string) => (v === '' ? undefined : Number(v))

  /** Grava a jornada por dia e mantém as horas/semana coerentes com ela. */
  const salvarDias = (funcaoId: string, pessoaId: string, dias: (HorarioDiaPessoa | null)[]) =>
    editar(funcaoId, pessoaId, { jornadaDias: dias, horasSemanais: normalizarHoras(horasDaJornadaDias(dias)) })

  const definirDias = (funcaoId: string, p: PessoaEscala) => {
    salvarDias(funcaoId, p.id, jornadaDiasInicial(p))
    setAberta(`${funcaoId}/${p.id}`)
  }

  const alterarDia = (funcaoId: string, p: PessoaEscala, dia: number, h: HorarioDiaPessoa | null) => {
    const dias = [...(p.jornadaDias ?? jornadaDiasInicial(p))]
    dias[dia] = h
    salvarDias(funcaoId, p.id, dias)
  }

  const copiarSegunda = (funcaoId: string, p: PessoaEscala) => {
    const dias = [...(p.jornadaDias ?? jornadaDiasInicial(p))]
    const seg = dias[1]
    for (const d of [2, 3, 4, 5]) dias[d] = seg ? { ...seg } : null
    salvarDias(funcaoId, p.id, dias)
  }

  return (
    <div className="space-y-4">
      <div className="cartao space-y-3" role="group" aria-labelledby="t-regras-pessoa">
        <h3 id="t-regras-pessoa" className="text-base font-bold">
          Regras por pessoa
        </h3>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={regras.mulheresDomingoQuinzenal}
            onChange={(e) => setRegras({ mulheresDomingoQuinzenal: e.target.checked })}
          />
          <span>{ROTULO_REGRA_MULHERES}</span>
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span>Jornada máxima do estagiário</span>
          <select
            className="campo !w-auto"
            value={regras.estagioHorasSemanais}
            onChange={(e) =>
              setRegras({ estagioHorasSemanais: Number(e.target.value) as RegrasPessoais['estagioHorasSemanais'] })
            }
          >
            {OPCOES_JORNADA_ESTAGIO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-soft">Valide com o DP; convenção coletiva pode ser diferente.</p>
      </div>
      {funcoes.map((f) => {
        const pessoas = f.pessoas ?? []
        return (
          <div key={f.id} className="cartao space-y-3">
            <h3 className="text-base font-bold">
              {f.nome} — {f.quantidade} de {pessoas.length} escaláveis
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-soft">
                    <th className="py-2 pr-3 font-semibold">Nome</th>
                    <th className="px-2 py-2 font-semibold">Sexo</th>
                    <th className="px-2 py-2 font-semibold">Escalar</th>
                    <th className="px-2 py-2 font-semibold">Jornada</th>
                    <th className="px-2 py-2 font-semibold">Horas/semana</th>
                    <th className="px-2 py-2 font-semibold">Entrada</th>
                    <th className="px-2 py-2 font-semibold">Saída</th>
                    <th className="px-2 py-2 font-semibold">Intervalo (min)</th>
                    <th className="px-2 py-2 font-semibold">Férias</th>
                  </tr>
                </thead>
                <tbody>
                  {pessoas.map((p) => {
                    const ferias = resumoFerias(p.ferias)
                    const etiquetas = etiquetasPessoa(p, regras)
                    const chave = `${f.id}/${p.id}`
                    const porDia = !!p.jornadaDias
                    return (
                      <Fragment key={p.id}>
                      <tr className={`border-b border-line/60 ${p.escalar ? '' : 'opacity-50'}`}>
                        <td className="py-2 pr-3">
                          <span className="font-medium">{p.nome}</span>
                          {etiquetas.map((t) => (
                            <span
                              key={t}
                              className={`ml-2 inline-block rounded px-1.5 py-0.5 text-xs ${
                                t.startsWith('domingo') ? 'border border-line text-soft' : 'bg-brand-light'
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                        </td>
                        <td className="px-2 py-2 text-soft">{rotuloSexo(p.sexo)}</td>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Escalar ${p.nome}`}
                            checked={p.escalar}
                            onChange={(e) => editar(f.id, p.id, { escalar: e.target.checked })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {porDia ? (
                            <button
                              type="button"
                              className="btn-sec !px-2 !py-1 text-xs"
                              aria-expanded={aberta === chave}
                              onClick={() => setAberta(aberta === chave ? null : chave)}
                            >
                              Por dia {aberta === chave ? '▴' : '▾'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-sec !px-2 !py-1 text-xs"
                              title="Informar entrada, intervalo e saída de cada dia da semana"
                              onClick={() => definirDias(f.id, p)}
                            >
                              Automática · definir por dia
                            </button>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={1}
                            max={60}
                            disabled={porDia}
                            title={porDia ? 'Calculado pela jornada por dia' : undefined}
                            className="campo w-24"
                            aria-label={`Horas por semana de ${p.nome}`}
                            value={p.horasSemanais ?? ''}
                            onChange={(e) => editar(f.id, p.id, { horasSemanais: normalizarHoras(numero(e.target.value)) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            className="campo w-28"
                            aria-label={`Entrada de ${p.nome}`}
                            disabled={porDia}
                            value={p.entrada ?? ''}
                            onChange={(e) => editar(f.id, p.id, { entrada: e.target.value || undefined })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            className="campo w-28"
                            aria-label={`Saída de ${p.nome}`}
                            disabled={porDia}
                            value={p.saida ?? ''}
                            onChange={(e) => editar(f.id, p.id, { saida: e.target.value || undefined })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            max={240}
                            step={5}
                            className="campo w-28"
                            placeholder="Automático"
                            aria-label={`Intervalo em minutos de ${p.nome}`}
                            disabled={porDia}
                            value={p.intervaloMin ?? ''}
                            onChange={(e) => editar(f.id, p.id, { intervaloMin: normalizarIntervalo(numero(e.target.value)) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {ferias.length === 0 ? (
                            '—'
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {ferias.map((r, i) => (
                                <span key={i} className="rounded-full bg-brand-light px-2 py-0.5 text-xs">
                                  {r}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                      </tr>
                      {porDia && aberta === chave && (
                        <tr className="border-b border-line/60 bg-brand-light/30">
                          <td colSpan={9} className="px-3 py-3">
                            <JornadaPorDia
                              pessoa={p}
                              onDia={(dia, h) => alterarDia(f.id, p, dia, h)}
                              onCopiarSegunda={() => copiarSegunda(f.id, p)}
                              onAutomatica={() => {
                                editar(f.id, p.id, { jornadaDias: undefined })
                                setAberta(null)
                              }}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const DIA_PADRAO: HorarioDiaPessoa = { entrada: '08:00', saida: '17:00', intervaloInicio: '12:00', intervaloFim: '13:00' }

/** Entrada, intervalo e saída de cada dia da semana de uma pessoa (dia desmarcado = folga). */
function JornadaPorDia({
  pessoa,
  onDia,
  onCopiarSegunda,
  onAutomatica,
}: {
  pessoa: PessoaEscala
  onDia: (dia: number, h: HorarioDiaPessoa | null) => void
  onCopiarSegunda: () => void
  onAutomatica: () => void
}) {
  const dias = pessoa.jornadaDias ?? []
  const horas = horasDaJornadaDias(dias)
  const trabalhados = dias.filter((h) => horarioDoDiaPessoa(h) !== null).length
  const incompletos = DIAS_JORNADA.filter(({ dia }) => dias[dia] && horarioDoDiaPessoa(dias[dia]) === null)
  const campo = (dia: number, rotuloDia: string, h: HorarioDiaPessoa, k: keyof HorarioDiaPessoa, rotulo: string) => (
    <input
      type="time"
      className="campo w-28"
      aria-label={`${rotulo} de ${pessoa.nome}, ${rotuloDia}`}
      value={h[k] ?? ''}
      onChange={(e) => onDia(dia, { ...h, [k]: e.target.value || undefined } as HorarioDiaPessoa)}
    />
  )
  return (
    <div className="space-y-2">
      <p className="text-xs text-soft">
        A proposta usa exatamente estes dias e horários para {pessoa.nome}. Os dias desmarcados são as folgas: o
        gerador não as muda nem coloca a pessoa no rodízio de domingos, e a conformidade aponta o que não fechar com a
        lei. Sem intervalo informado, vale o mínimo legal.
      </p>
      <table className="text-sm">
        <thead>
          <tr className="text-xs text-soft">
            <th className="py-1 pr-3 text-left font-semibold">Dia</th>
            <th className="px-2 py-1 text-left font-semibold">Trabalha</th>
            <th className="px-2 py-1 text-left font-semibold">Entrada</th>
            <th className="px-2 py-1 text-left font-semibold">Início do intervalo</th>
            <th className="px-2 py-1 text-left font-semibold">Fim do intervalo</th>
            <th className="px-2 py-1 text-left font-semibold">Saída</th>
          </tr>
        </thead>
        <tbody>
          {DIAS_JORNADA.map(({ dia, rotulo }) => {
            const h = dias[dia] ?? null
            return (
              <tr key={dia}>
                <td className="py-1 pr-3 font-medium">{rotulo}</td>
                <td className="px-2 py-1">
                  <input
                    type="checkbox"
                    aria-label={`${pessoa.nome} trabalha ${rotulo}`}
                    checked={h !== null}
                    onChange={(e) => onDia(dia, e.target.checked ? { ...(dias.find((x) => x) ?? DIA_PADRAO) } : null)}
                  />
                </td>
                {h ? (
                  <>
                    <td className="px-2 py-1">{campo(dia, rotulo, h, 'entrada', 'Entrada')}</td>
                    <td className="px-2 py-1">{campo(dia, rotulo, h, 'intervaloInicio', 'Início do intervalo')}</td>
                    <td className="px-2 py-1">{campo(dia, rotulo, h, 'intervaloFim', 'Fim do intervalo')}</td>
                    <td className="px-2 py-1">{campo(dia, rotulo, h, 'saida', 'Saída')}</td>
                  </>
                ) : (
                  <td colSpan={4} className="px-2 py-1 text-soft">
                    folga
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-sm">
        Total: <strong>{String(horas).replace('.', ',')} h</strong> líquidas por semana em {trabalhados}{' '}
        {trabalhados === 1 ? 'dia' : 'dias'} de trabalho.
      </p>
      {incompletos.length > 0 && (
        <p className="text-sm text-amber-900">
          Sem entrada ou saída em {incompletos.map((x) => x.rotulo).join(', ')}: esses dias contam como folga até serem
          preenchidos.
        </p>
      )}
      {trabalhados === 0 && (
        <p className="text-sm text-amber-900">
          Nenhum dia de trabalho válido: a proposta usa a jornada automática para esta pessoa.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-sec !px-2 !py-1 text-xs" onClick={onCopiarSegunda}>
          Copiar segunda para terça a sexta
        </button>
        <button type="button" className="btn-sec !px-2 !py-1 text-xs" onClick={onAutomatica}>
          Voltar à jornada automática
        </button>
      </div>
    </div>
  )
}
