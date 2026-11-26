import { AlertTriangle, Redo2, Undo2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react'
import { diaDaSemana } from '../engine/datas'
import { useStore } from '../store/useStore'
import type { Alerta, DiaEscala, Escala, TipoDia } from '../types'
import { DIAS_CURTOS, NOME_TIPO, SIGLA_TIPO, datasDaEscala, formatarData, rotuloTurno } from '../utils/analise'
import { alertasDaCelula, explicacao, marcasDasCelulas, opcoesDaCelula } from '../utils/passo4'
import { COR_TIPO as COR } from './cores'
import { ExplicacoesAlertas, MenuCelula } from './MenuCelula'
import { LARGURA_POPOVER, posicaoJunto } from './posicao'

type Pincel = { tipo: TipoDia; turnoId?: string } | null
type Alvo = { fid: string; dia: number; el: HTMLElement }

const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Ignora atalhos enquanto a pessoa digita num campo. */
function digitando(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
}

function BarraDesfazer() {
  const historico = useStore((s) => s.historico)
  const desfazer = useStore((s) => s.desfazer)
  const refazer = useStore((s) => s.refazer)

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || digitando(e.target)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        desfazer()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        refazer()
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [desfazer, refazer])

  const nP = historico.passado.length
  const nF = historico.futuro.length
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-sec !py-1.5"
        disabled={nP === 0}
        onClick={desfazer}
        aria-keyshortcuts="Control+Z"
        title="Desfazer a última mudança (Ctrl+Z)"
      >
        <Undo2 size={16} aria-hidden /> Desfazer{nP > 0 ? ` (${nP})` : ''}
      </button>
      <button
        type="button"
        className="btn-sec !py-1.5"
        disabled={nF === 0}
        onClick={refazer}
        aria-keyshortcuts="Control+Y Control+Shift+Z"
        title="Refazer (Ctrl+Y)"
      >
        <Redo2 size={16} aria-hidden /> Refazer{nF > 0 ? ` (${nF})` : ''}
      </button>
      <span className="text-xs text-soft">Errou? Desfaça com o botão ou Ctrl+Z.</span>
    </div>
  )
}

export function Calendario({ escala, alertas }: { escala: Escala; alertas: Alerta[] }) {
  const setCelula = useStore((s) => s.setCelula)
  const trocar = useStore((s) => s.trocarCelulas)
  const feriados = useStore((s) => s.feriados)
  const [pincel, setPincel] = useState<Pincel>(null)
  const [menu, setMenu] = useState<Alvo | null>(null)
  const [dica, setDica] = useState<Alvo | null>(null)
  const idDica = useId()
  const celulas = useRef(new Map<string, HTMLButtonElement>())

  const datas = useMemo(() => datasDaEscala(escala), [escala])
  const listaFeriados = useMemo(() => feriados.map((f) => f.data), [feriados])
  const marcas = useMemo(() => marcasDasCelulas(alertas, datas), [alertas, datas])
  const visiveis = escala.funcionarios

  const nomeDe = (fid: string) => escala.funcionarios.find((f) => f.id === fid)?.nome ?? ''
  const rotuloData = (i: number) => `${DIAS_LONGOS[diaDaSemana(datas[i])]}, ${formatarData(datas[i])}`

  const menuRef = useRef<Alvo | null>(null)
  menuRef.current = menu
  const fecharMenu = useCallback((devolverFoco: boolean) => {
    const m = menuRef.current
    if (m && devolverFoco) {
      // a célula pode ter sido recriada após a mudança: procura pela chave
      const k = `${m.fid}|${m.dia}`
      setTimeout(() => (celulas.current.get(k) ?? m.el).focus(), 0)
    }
    setMenu(null)
  }, [])

  const clicar = (fid: string, i: number, el: HTMLElement) => {
    if (pincel) {
      setCelula(fid, i, pincel.tipo === 'trabalho' ? { tipo: 'trabalho', turnoId: pincel.turnoId } : { tipo: pincel.tipo })
      return
    }
    setDica(null)
    setMenu((m) => (m && m.fid === fid && m.dia === i ? null : { fid, dia: i, el }))
  }

  const iniciarArraste = (e: DragEvent, conteudo: string) => {
    setMenu(null)
    setDica(null)
    e.dataTransfer.setData('text/plain', conteudo)
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

  const mostrarDica = (fid: string, dia: number, el: HTMLElement) => {
    if (!menu && marcas.has(`${fid}|${dia}`)) setDica({ fid, dia, el })
  }
  const alertasDica = dica ? alertasDaCelula(alertas, dica.fid, dica.dia, escala.inicio) : []
  const posDica = dica ? posicaoJunto(dica.el.getBoundingClientRect(), 140) : null

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-30 -mx-4 space-y-2 border-b border-line bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <BarraDesfazer />
      </div>

      <details className="rounded-lg border border-line p-2 text-sm">
        <summary className="cursor-pointer font-medium">Pintar vários dias de uma vez (opcional)</summary>
        <p className="my-2 text-xs text-soft">
          Escolha um item abaixo e clique nos dias para aplicá-lo, um atrás do outro. Clique de novo no item para parar
          de pintar. Também dá para arrastar um item até um dia.
        </p>
        <div role="group" aria-label="Pincéis" className="flex flex-wrap gap-2">
          {itensPaleta.map((p) => {
            const ativo = pincel?.tipo === p.pincel.tipo && pincel?.turnoId === p.pincel.turnoId
            return (
              <button
                key={p.chave}
                type="button"
                draggable
                aria-pressed={ativo}
                onDragStart={(e) => iniciarArraste(e, p.arraste)}
                onClick={() => {
                  setMenu(null)
                  setPincel(ativo ? null : p.pincel)
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${p.cor} ${ativo ? 'ring-2 ring-brand' : ''}`}
              >
                {ativo ? '✓ ' : ''}
                {p.rotulo}
              </button>
            )
          })}
        </div>
      </details>

      <p className="text-sm">
        {pincel ? (
          <strong className="text-brand">
            Pintando com “{pincel.tipo === 'trabalho' ? 'Trabalho' : NOME_TIPO[pincel.tipo]}”: clique nos dias.{' '}
            <button type="button" className="underline" onClick={() => setPincel(null)}>
              Parar de pintar
            </button>
          </strong>
        ) : (
          <>
            <strong>Clique num dia</strong> para escolher o que a pessoa faz nele. Para trocar dois dias, arraste um
            sobre o outro. Passe o mouse (ou o foco do teclado) nos dias com marca para ver o que está errado.
          </>
        )}
      </p>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-white">
        <table className="border-separate border-spacing-0 text-xs">
          <caption className="sr-only">Calendário da escala: uma linha por pessoa, uma coluna por dia</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 min-w-[130px] border-b border-r border-line bg-white px-2 py-1 text-left"
              >
                Pessoa
              </th>
              {datas.map((d) => {
                const dow = diaDaSemana(d)
                const fimDeSemana = dow === 0 || dow === 6
                const fer = feriados.find((f) => f.data === d)
                return (
                  <th
                    key={d}
                    scope="col"
                    className={`sticky top-0 z-20 min-w-[48px] border-b border-line px-1 py-1 text-center font-medium ${
                      fer ? 'bg-amber-100' : fimDeSemana ? 'bg-slate-200' : 'bg-white'
                    }`}
                    title={fer?.nome}
                  >
                    <div className={fimDeSemana ? 'font-bold' : ''}>{DIAS_CURTOS[dow]}</div>
                    <div className="text-soft">
                      {d.slice(8)}/{d.slice(5, 7)}
                    </div>
                    {fer && <span className="sr-only">feriado: {fer.nome}</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((f) => (
              <tr key={f.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-r border-line bg-white px-2 py-1 text-left font-medium"
                >
                  {f.nome}
                </th>
                {datas.map((d, i) => {
                  const c = escala.celulas[f.id][i]
                  const turno = escala.turnos.find((t) => t.id === c.turnoId)
                  const chave = `${f.id}|${i}`
                  const marca = marcas.get(chave)
                  const dow = diaDaSemana(d)
                  const fimDeSemana = dow === 0 || dow === 6
                  const doDia = marca ? alertasDaCelula(alertas, f.id, i, escala.inicio) : []
                  const frases = [
                    ...new Set(
                      doDia.map((a) => {
                        const ex = explicacao(a)
                        return `${ex.titulo}. ${ex.oQueFazer}`
                      }),
                    ),
                  ]
                  const textoAlertas = frases.length ? ` Atenção: ${frases.join(' ')}` : ''
                  const descricao = `${f.nome}, ${rotuloData(i)}: ${NOME_TIPO[c.tipo]}${turno ? ' ' + rotuloTurno(turno) : ''}.${textoAlertas}`
                  const aberto = menu?.fid === f.id && menu.dia === i
                  return (
                    <td key={d} className={`p-0.5 ${fimDeSemana ? 'bg-slate-100' : ''}`}>
                      <button
                        ref={(el) => {
                          if (el) celulas.current.set(chave, el)
                          else celulas.current.delete(chave)
                        }}
                        type="button"
                        draggable
                        aria-label={`${descricao} ${pincel ? 'Clique para pintar.' : 'Clique para mudar.'}`}
                        aria-haspopup={pincel ? undefined : 'menu'}
                        aria-expanded={pincel ? undefined : aberto}
                        aria-describedby={dica?.fid === f.id && dica.dia === i ? idDica : undefined}
                        title={marca ? undefined : descricao}
                        onClick={(e) => clicar(f.id, i, e.currentTarget)}
                        onMouseEnter={(e) => mostrarDica(f.id, i, e.currentTarget)}
                        onMouseLeave={() => setDica(null)}
                        onFocus={(e) => mostrarDica(f.id, i, e.currentTarget)}
                        onBlur={() => setDica(null)}
                        onDragStart={(e) => iniciarArraste(e, `cel|${f.id}|${i}`)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => soltar(e, f.id, i)}
                        className={`relative flex h-10 w-11 flex-col items-center justify-center rounded border text-[10px] font-semibold leading-tight ${COR[c.tipo]} ${
                          marca === 'vermelho' ? 'ring-2 ring-red-600' : marca === 'amarelo' ? 'ring-2 ring-yellow-500' : ''
                        } ${aberto ? 'outline outline-2 outline-brand' : ''}`}
                      >
                        {c.tipo === 'trabalho' && turno ? (
                          <>
                            <span>{turno.inicio}</span>
                            <span>{turno.fim}</span>
                          </>
                        ) : (
                          SIGLA_TIPO[c.tipo]
                        )}
                        {marca === 'vermelho' && (
                          <XCircle size={12} className="absolute -right-1 -top-1 rounded-full bg-white text-red-700" aria-hidden />
                        )}
                        {marca === 'amarelo' && (
                          <AlertTriangle
                            size={12}
                            className="absolute -right-1 -top-1 rounded-full bg-white text-yellow-700"
                            aria-hidden
                          />
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dica && posDica && alertasDica.length > 0 && (
        <div
          id={idDica}
          role="tooltip"
          style={{ top: posDica.top, left: posDica.left, width: LARGURA_POPOVER }}
          className="pointer-events-none fixed z-50 rounded-lg border border-line bg-white p-3 text-xs shadow-lg"
        >
          <p className="mb-1 font-semibold">
            {nomeDe(dica.fid)} — {rotuloData(dica.dia)}
          </p>
          <ExplicacoesAlertas alertas={alertasDica} />
          <p className="mt-2 text-soft">Clique no dia para mudar.</p>
        </div>
      )}

      {menu && (
        <MenuCelula
          key={`${menu.fid}|${menu.dia}`}
          ancora={menu.el}
          titulo={`${nomeDe(menu.fid)} — ${rotuloData(menu.dia)}`}
          opcoes={opcoesDaCelula(escala, menu.fid, menu.dia, listaFeriados)}
          alertas={alertasDaCelula(alertas, menu.fid, menu.dia, escala.inicio)}
          onEscolher={(v) => setCelula(menu.fid, menu.dia, v)}
          onFechar={fecharMenu}
        />
      )}
    </div>
  )
}
