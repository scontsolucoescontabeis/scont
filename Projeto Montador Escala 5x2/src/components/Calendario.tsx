import { AlertTriangle, XCircle } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { diaDaSemana } from '../engine/datas'
import { useStore } from '../store/useStore'
import type { Alerta, DiaEscala, Escala, TipoDia } from '../types'
import { DIAS_CURTOS, NOME_TIPO, SIGLA_TIPO, datasDaEscala, rotuloTurno } from '../utils/analise'

const CICLO: TipoDia[] = ['trabalho', 'folga', 'dsr', 'feriado', 'ausencia']

const COR: Record<TipoDia, string> = {
  trabalho: 'bg-white border-line text-ink',
  folga: 'bg-blue-100 border-blue-300 text-blue-900',
  dsr: 'bg-indigo-100 border-indigo-300 text-indigo-900',
  feriado: 'bg-amber-100 border-amber-300 text-amber-900',
  ausencia: 'bg-gray-200 border-gray-400 text-gray-800',
}

type Pincel = { tipo: TipoDia; turnoId?: string } | null

export function Calendario({ escala, alertas }: { escala: Escala; alertas: Alerta[] }) {
  const setCelula = useStore((s) => s.setCelula)
  const trocar = useStore((s) => s.trocarCelulas)
  const feriados = useStore((s) => s.feriados)
  const [pincel, setPincel] = useState<Pincel>(null)
  const datas = useMemo(() => datasDaEscala(escala), [escala])
  const feriadoSet = useMemo(() => new Set(feriados.map((f) => f.data)), [feriados])

  // marcas por célula: dia exato ou, p/ alertas semanais, a semana inteira daquele funcionário
  const marcas = useMemo(() => {
    const m = new Map<string, 'amarelo' | 'vermelho'>()
    const marcar = (k: string, s: 'amarelo' | 'vermelho') => {
      if (m.get(k) !== 'vermelho') m.set(k, s)
    }
    for (const a of alertas) {
      if (!a.funcionarioId || !a.data) continue
      const i = datas.indexOf(a.data)
      if (i < 0) continue
      const semanal = a.id.startsWith('rep|') || a.id.startsWith('dom|') || a.id.startsWith('sem|')
      if (semanal) for (let k = 0; k < 7; k++) marcar(`${a.funcionarioId}|${i + k}`, a.severidade)
      else marcar(`${a.funcionarioId}|${i}`, a.severidade)
    }
    return m
  }, [alertas, datas])

  const turnoPadraoDe = (fid: string): string | undefined =>
    escala.celulas[fid].find((c) => c.tipo === 'trabalho')?.turnoId ?? escala.turnos[0]?.id

  const clicar = (fid: string, i: number) => {
    if (pincel) {
      setCelula(fid, i, pincel.tipo === 'trabalho' ? { tipo: 'trabalho', turnoId: pincel.turnoId } : { tipo: pincel.tipo })
      return
    }
    const atual = escala.celulas[fid][i]
    const prox = CICLO[(CICLO.indexOf(atual.tipo) + 1) % CICLO.length]
    setCelula(fid, i, prox === 'trabalho' ? { tipo: 'trabalho', turnoId: turnoPadraoDe(fid) } : { tipo: prox })
  }

  const iniciarArraste = (e: DragEvent, texto: string) => {
    e.dataTransfer.setData('text/plain', texto)
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  const soltar = (e: DragEvent, fid: string, i: number) => {
    e.preventDefault()
    const [origem, a, b] = e.dataTransfer.getData('text/plain').split('|')
    if (origem === 'cel') trocar({ f: a, d: Number(b) }, { f: fid, d: i })
    else if (origem === 'pin') {
      const valor: DiaEscala = a === 'trabalho' ? { tipo: 'trabalho', turnoId: b } : { tipo: a as TipoDia }
      setCelula(fid, i, valor)
    }
  }

  const itensPaleta: { chave: string; rotulo: string; pincel: NonNullable<Pincel>; arraste: string; cor: string }[] = [
    ...escala.turnos.map((t) => ({
      chave: `t-${t.id}`,
      rotulo: `${t.nome} ${rotuloTurno(t)}`,
      pincel: { tipo: 'trabalho' as TipoDia, turnoId: t.id },
      arraste: `pin|trabalho|${t.id}`,
      cor: COR.trabalho,
    })),
    ...(['folga', 'dsr', 'feriado', 'ausencia'] as TipoDia[]).map((tp) => ({
      chave: tp,
      rotulo: NOME_TIPO[tp],
      pincel: { tipo: tp },
      arraste: `pin|${tp}`,
      cor: COR[tp],
    })),
  ]

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Pincéis: escolha um e clique nas células, ou arraste para uma célula" className="flex flex-wrap gap-2">
        {itensPaleta.map((p) => {
          const ativo = pincel?.tipo === p.pincel.tipo && pincel?.turnoId === p.pincel.turnoId
          return (
            <button
              key={p.chave}
              type="button"
              draggable
              aria-pressed={ativo}
              onDragStart={(e) => iniciarArraste(e, p.arraste)}
              onClick={() => setPincel(ativo ? null : p.pincel)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${p.cor} ${ativo ? 'ring-2 ring-brand' : ''}`}
            >
              {ativo ? '✓ ' : ''}
              {p.rotulo}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-soft">
        Clique numa célula para alternar o tipo do dia, escolha um pincel para pintar vários dias ou arraste uma célula
        sobre outra para trocar. ▲ amarelo = atenção; ✖ vermelho = fora da regra.
      </p>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[110px] bg-white px-2 py-1 text-left">Funcionário</th>
              {datas.map((d) => {
                const dow = diaDaSemana(d)
                return (
                  <th
                    key={d}
                    scope="col"
                    className={`min-w-[44px] px-1 py-1 text-center font-medium ${dow === 0 ? 'bg-indigo-50' : ''} ${feriadoSet.has(d) ? 'bg-amber-100' : ''}`}
                    title={feriados.find((f) => f.data === d)?.nome}
                  >
                    <div>{DIAS_CURTOS[dow]}</div>
                    <div className="text-soft">
                      {d.slice(8)}/{d.slice(5, 7)}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {escala.funcionarios.map((f) => (
              <tr key={f.id}>
                <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1 text-left font-medium">
                  {f.nome}
                </th>
                {datas.map((d, i) => {
                  const c = escala.celulas[f.id][i]
                  const turno = escala.turnos.find((t) => t.id === c.turnoId)
                  const marca = marcas.get(`${f.id}|${i}`)
                  const descricao = `${f.nome}, ${d}: ${NOME_TIPO[c.tipo]}${turno ? ' ' + rotuloTurno(turno) : ''}${marca ? ` — alerta ${marca}` : ''}`
                  return (
                    <td key={d} className="p-0.5">
                      <button
                        type="button"
                        draggable
                        aria-label={descricao}
                        title={descricao}
                        onClick={() => clicar(f.id, i)}
                        onDragStart={(e) => iniciarArraste(e, `cel|${f.id}|${i}`)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => soltar(e, f.id, i)}
                        className={`relative flex h-10 w-11 flex-col items-center justify-center rounded border text-[10px] font-semibold leading-tight ${COR[c.tipo]} ${
                          marca === 'vermelho' ? 'ring-2 ring-red-600' : marca === 'amarelo' ? 'ring-2 ring-yellow-500' : ''
                        }`}
                      >
                        {c.tipo === 'trabalho' && turno ? (
                          <>
                            <span>{turno.inicio}</span>
                            <span>{turno.fim}</span>
                          </>
                        ) : (
                          SIGLA_TIPO[c.tipo]
                        )}
                        {marca === 'vermelho' && <XCircle size={11} className="absolute -right-1 -top-1 rounded-full bg-white text-red-700" aria-hidden />}
                        {marca === 'amarelo' && <AlertTriangle size={11} className="absolute -right-1 -top-1 rounded-full bg-white text-yellow-700" aria-hidden />}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
