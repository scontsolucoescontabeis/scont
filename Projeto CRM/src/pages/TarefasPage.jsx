import { useState } from 'react'
import { ClipboardList, Clock, CheckCircle2, XCircle, AlertCircle, User, CalendarDays, Plus } from 'lucide-react'
import { format, isPast, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useTarefas, atualizarStatusTarefa, criarTarefa } from '@/hooks/useTarefas'
import { ModalTarefa } from '@/components/ChatPanel/ModalTarefa'

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
const DEPTO_COLORS = {
  PESSOAL: '#1D4ED8', CONTABIL: '#065F46',
  ADMINISTRATIVO: '#92400E', TRIBUTARIO: '#5B21B6',
}
const PRIORIDADE_COLORS = {
  BAIXA: '#888480', NORMAL: '#1D4ED8', ALTA: '#b87a00', URGENTE: '#b83232',
}
const COLUNAS = [
  { status: 'ABERTA',       label: 'Abertas',       icon: <ClipboardList size={14} />, cor: '#888480' },
  { status: 'EM_EXECUCAO',  label: 'Em Execução',   icon: <Clock size={14} />,         cor: '#1D4ED8' },
  { status: 'CONCLUIDA',    label: 'Concluídas',    icon: <CheckCircle2 size={14} />,  cor: '#2d7a4f' },
  { status: 'CANCELADA',    label: 'Canceladas',    icon: <XCircle size={14} />,       cor: '#888480' },
]

function PrazoTag({ prazo }) {
  if (!prazo) return null
  const d = new Date(prazo)
  const atrasado = isPast(d)
  const hoje = isToday(d)
  const cor = atrasado ? '#b83232' : hoje ? '#b87a00' : '#888480'
  const bg  = atrasado ? '#FEF2F2' : hoje ? '#FFFBEB' : '#f7f6f4'
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 3, background: bg, color: cor, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <CalendarDays size={9} />
      {atrasado ? 'Atrasado · ' : ''}{format(d, "dd/MM HH:mm", { locale: ptBR })}
    </span>
  )
}

function CardTarefa({ tarefa, onAtualizar }) {
  const [expandido, setExpandido] = useState(false)
  const prox = { ABERTA: 'EM_EXECUCAO', EM_EXECUCAO: 'CONCLUIDA' }
  const btnProx = prox[tarefa.status]

  const handleAvancar = async (e) => {
    e.stopPropagation()
    await atualizarStatusTarefa(tarefa.id, btnProx)
    onAtualizar()
  }

  const handleCancelar = async (e) => {
    e.stopPropagation()
    if (!confirm('Cancelar esta tarefa?')) return
    await atualizarStatusTarefa(tarefa.id, 'CANCELADA')
    onAtualizar()
  }

  const BTN_LABEL = { EM_EXECUCAO: '▶ Iniciar', CONCLUIDA: '✓ Concluir' }
  const dep = DEPTO_COLORS[tarefa.departamento]
  const pri = PRIORIDADE_COLORS[tarefa.prioridade]

  return (
    <div
      onClick={() => setExpandido(v => !v)}
      style={{
        background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
        padding: '12px 14px', cursor: 'pointer', marginBottom: 8,
        borderLeft: `3px solid ${pri}`,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Linha 1 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', margin: 0, lineHeight: 1.4 }}>
            {tarefa.titulo}
          </p>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: `${dep}18`, color: dep, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {tarefa.departamento}
        </span>
      </div>

      {/* Linha 2 — metadados */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: expandido ? 10 : 0 }}>
        <span style={{ fontSize: 10, color: '#888480', display: 'flex', alignItems: 'center', gap: 3 }}>
          <User size={9} /> {tarefa.criador?.nome ?? '—'}
        </span>
        {tarefa.responsavel && (
          <span style={{ fontSize: 10, color: '#1D4ED8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
            → {tarefa.responsavel.nome}
          </span>
        )}
        {tarefa.conversas && (
          <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#888480' }}>
            {tarefa.conversas.protocolo}
          </span>
        )}
        <PrazoTag prazo={tarefa.prazo} />
        <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 'auto', color: pri }}>
          {tarefa.prioridade}
        </span>
      </div>

      {/* Expandido */}
      {expandido && (
        <div onClick={e => e.stopPropagation()}>
          {tarefa.descricao && (
            <p style={{ fontSize: 12, color: '#888480', margin: '0 0 10px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {tarefa.descricao}
            </p>
          )}
          <div style={{ fontSize: 10, color: '#c5c0ba', marginBottom: 10, fontFamily: 'DM Mono, monospace' }}>
            Aberta {format(new Date(tarefa.criado_em), "dd/MM/yy HH:mm", { locale: ptBR })}
            {tarefa.concluido_em && ` · Concluída ${format(new Date(tarefa.concluido_em), "dd/MM/yy HH:mm", { locale: ptBR })}`}
          </div>
          {tarefa.status !== 'CONCLUIDA' && tarefa.status !== 'CANCELADA' && (
            <div style={{ display: 'flex', gap: 6 }}>
              {btnProx && (
                <button onClick={handleAvancar} style={{
                  padding: '5px 12px', borderRadius: 5, border: 'none',
                  background: btnProx === 'CONCLUIDA' ? '#2d7a4f' : '#1D4ED8',
                  color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}>
                  {BTN_LABEL[btnProx]}
                </button>
              )}
              <button onClick={handleCancelar} style={{
                padding: '5px 10px', borderRadius: 5, border: '1px solid #e0dcd8',
                background: '#fff', color: '#b83232', fontSize: 11, cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TarefasPage({ perfil }) {
  const [filtroDepto, setFiltroDepto] = useState('')
  const [abrirModal, setAbrirModal]   = useState(false)

  const { tarefas, loading, refresh } = useTarefas({ departamento: filtroDepto || null })

  const porStatus = (status) => tarefas.filter(t => t.status === status)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e0dcd8', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={18} color="#7a1e1e" />
            <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 17, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              Tarefas
            </h2>
            <span style={{ fontSize: 11, color: '#888480', background: '#f7f6f4', padding: '2px 8px', borderRadius: 10 }}>
              {tarefas.filter(t => t.status !== 'CONCLUIDA' && t.status !== 'CANCELADA').length} abertas
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={filtroDepto}
              onChange={e => setFiltroDepto(e.target.value)}
              style={{ fontSize: 12, border: '1px solid #e0dcd8', borderRadius: 6, padding: '6px 10px', outline: 'none', background: '#fff' }}
            >
              <option value="">Todos os departamentos</option>
              {DEPTOS.map(d => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
            </select>
            <button
              onClick={() => setAbrirModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 6, border: 'none',
                background: '#7a1e1e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Nova Tarefa
            </button>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ color: '#888480', fontSize: 13, padding: 20 }}>Carregando tarefas...</div>
        ) : (
          <div style={{ display: 'flex', gap: 16, height: '100%', minWidth: 'max-content' }}>
            {COLUNAS.map(col => {
              const itens = porStatus(col.status)
              return (
                <div key={col.status} style={{
                  width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
                  background: '#f7f6f4', borderRadius: 10, padding: 12,
                  maxHeight: '100%',
                }}>
                  {/* Header coluna */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span style={{ color: col.cor }}>{col.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: col.cor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {col.label}
                    </span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                      background: col.cor + '20', color: col.cor,
                      padding: '1px 7px', borderRadius: 10,
                    }}>
                      {itens.length}
                    </span>
                  </div>

                  {/* Cartões */}
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {itens.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: '#c5c0ba', fontSize: 12 }}>
                        Nenhuma tarefa
                      </div>
                    ) : (
                      itens.map(t => <CardTarefa key={t.id} tarefa={t} onAtualizar={refresh} />)
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal nova tarefa (sem conversa vinculada) */}
      {abrirModal && (
        <ModalTarefa
          conversa={null}
          perfil={perfil}
          onCriada={refresh}
          onFechar={() => setAbrirModal(false)}
        />
      )}
    </div>
  )
}
