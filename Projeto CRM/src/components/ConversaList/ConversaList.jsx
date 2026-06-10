import { useState, useCallback, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useConversas } from '@/hooks/useConversas'
import { useRealtime } from '@/hooks/useRealtime'
import { useSLA } from '@/hooks/useSLA'
import { ConversaCard } from './ConversaCard'

const WIDTH_KEY  = 'crm_lista_width'
const WIDTH_MIN  = 280
const WIDTH_MAX  = 580
const WIDTH_DEF  = 360

function useResizable(defaultWidth) {
  const [width, setWidth]     = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY))
    return saved >= WIDTH_MIN && saved <= WIDTH_MAX ? saved : defaultWidth
  })
  const [dragging, setDragging] = useState(false)
  const startX  = useRef(0)
  const startW  = useRef(0)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    startX.current = e.clientX
    startW.current = width
    setDragging(true)
  }, [width])

  useEffect(() => {
    if (!dragging) return
    document.body.style.cursor = 'col-resize'
    const onMove = (e) => {
      const next = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, startW.current + e.clientX - startX.current))
      setWidth(next)
    }
    const onUp = (e) => {
      const final = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, startW.current + e.clientX - startX.current))
      localStorage.setItem(WIDTH_KEY, final)
      setDragging(false)
      document.body.style.cursor = ''
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
    }
  }, [dragging])

  return { width, dragging, onMouseDown }
}

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']

const ABAS = [
  { status: '',              label: 'Todas',      cor: '#888480' },
  { status: 'ABERTA',        label: 'Abertas',    cor: '#888480' },
  { status: 'EM_ATENDIMENTO',label: 'Atendendo',  cor: '#2d7a4f' },
  { status: 'AGUARDANDO',    label: 'Aguardando', cor: '#b87a00' },
  { status: 'ENCERRADA',     label: 'Encerradas', cor: '#7a1e1e' },
]

export function ConversaList({ conversaAtiva, onSelecionarConversa, perfilRole, slaConfig = [], classificacaoSLAConfig = [] }) {
  const [busca, setBusca]             = useState('')
  const [filtroDepto, setFiltroDepto] = useState('')
  const [abaAtiva, setAbaAtiva]       = useState('')   // '' = todas
  const { width, dragging, onMouseDown } = useResizable(WIDTH_DEF)

  // Busca todas sem filtro de status — filtramos client-side para poder mostrar contadores
  const { conversas, loading, erro, refresh } = useConversas({
    departamento: filtroDepto || null,
    status: null,
    busca,
  })

  const conversasComSLA = useSLA(conversas, slaConfig, classificacaoSLAConfig)

  useRealtime({
    onNovaMensagem:     refresh,
    onConversaAtualizada: refresh,
  })

  // Contadores por status
  const contadores = ABAS.reduce((acc, aba) => {
    acc[aba.status] = aba.status === ''
      ? conversas.length
      : conversas.filter(c => c.status === aba.status).length
    return acc
  }, {})

  // Lista filtrada pela aba ativa
  const lista = abaAtiva === ''
    ? conversasComSLA
    : conversasComSLA.filter(c => c.status === abaAtiva)

  return (
    <div style={{
      width,
      flexShrink: 0,
      position: 'relative',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: dragging ? 'none' : 'auto',
    }}>
      {/* ── Handle de redimensionamento ── */}
      <div
        onMouseDown={onMouseDown}
        title="Arraste para redimensionar"
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 5, cursor: 'col-resize', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: dragging ? 3 : 1,
          height: '100%',
          background: dragging ? '#7a1e1e' : '#e0dcd8',
          transition: 'width 0.1s, background 0.1s',
        }} />
      </div>

      {/* ── Cabeçalho: busca + filtro depto ── */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #f0ede9' }}>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#888480' }} />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou protocolo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
              fontSize: 12, border: '1px solid #e0dcd8', borderRadius: 6,
              background: '#f7f6f4', outline: 'none', fontFamily: 'DM Sans, sans-serif',
            }}
          />
        </div>

        <select
          value={filtroDepto}
          onChange={e => setFiltroDepto(e.target.value)}
          style={{
            width: '100%', fontSize: 12, border: '1px solid #e0dcd8',
            borderRadius: 5, padding: '6px 8px', background: '#fff',
            color: filtroDepto ? '#1a1a1a' : '#888480',
            outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <option value="">Todos os departamentos</option>
          {DEPTOS.map(d => (
            <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>
          ))}
        </select>
      </div>

      {/* ── Abas de status ── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e0dcd8',
        background: '#fafaf9',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {ABAS.map(aba => {
          const ativo = abaAtiva === aba.status
          const count = contadores[aba.status] ?? 0
          return (
            <button
              key={aba.status}
              onClick={() => setAbaAtiva(aba.status)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 10px', whiteSpace: 'nowrap',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${ativo ? aba.cor : 'transparent'}`,
                color: ativo ? aba.cor : '#888480',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 11, fontWeight: ativo ? 700 : 500,
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
            >
              {aba.status !== '' && (
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: ativo ? aba.cor : '#c5c0ba',
                  flexShrink: 0,
                }} />
              )}
              {aba.label}
              {count > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: ativo ? aba.cor : '#e0dcd8',
                  color: ativo ? '#fff' : '#888480',
                  borderRadius: 8, padding: '1px 5px',
                  minWidth: 16, textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Lista de conversas ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {erro && (
          <div style={{
            margin: '8px 10px', padding: '8px 12px', borderRadius: 6,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 11,
          }}>
            <strong>Erro ao carregar:</strong> {erro}
            <br/><span style={{ color: '#7a1e1e' }}>Verifique se as migrations 013-016 foram executadas no Supabase.</span>
          </div>
        )}
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#888480', fontSize: 12 }}>
            Carregando...
          </div>
        ) : lista.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#c5c0ba', fontSize: 13 }}>
            {busca
              ? 'Nenhuma conversa encontrada.'
              : abaAtiva
              ? `Nenhuma conversa ${ABAS.find(a => a.status === abaAtiva)?.label.toLowerCase()}.`
              : 'Nenhuma conversa.'}
          </div>
        ) : (
          lista.map(c => (
            <ConversaCard
              key={c.id}
              conversa={c}
              ativo={conversaAtiva?.id === c.id}
              onClick={() => onSelecionarConversa(c)}
            />
          ))
        )}
      </div>

    </div>
  )
}
