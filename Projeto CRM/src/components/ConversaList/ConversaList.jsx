import { useState } from 'react'
import { Search } from 'lucide-react'
import { useConversas } from '@/hooks/useConversas'
import { useRealtime } from '@/hooks/useRealtime'
import { ConversaCard } from './ConversaCard'

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
const STATUS = ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO', 'ENCERRADA']

export function ConversaList({ conversaAtiva, onSelecionarConversa, perfilRole }) {
  const [busca, setBusca] = useState('')
  const [filtroDepto, setFiltroDepto] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const { conversas, loading, refresh } = useConversas({
    departamento: filtroDepto || null,
    status: filtroStatus || null,
    busca,
  })

  useRealtime({
    onNovaMensagem: refresh,
    onConversaAtualizada: refresh,
  })

  const selectStyle = {
    fontSize: 11, border: '1px solid #e0dcd8', borderRadius: 4,
    padding: '4px 8px', background: '#fff', color: '#1a1a1a',
    outline: 'none', cursor: 'pointer', flex: 1,
  }

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      borderRight: '1px solid #e0dcd8',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header da lista */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e0dcd8' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#888480' }} />
          <input
            type="text"
            placeholder="Buscar conversa..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: 30, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
              fontSize: 12, border: '1px solid #e0dcd8', borderRadius: 6,
              background: '#f7f6f4', outline: 'none', fontFamily: 'DM Sans, sans-serif',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)} style={selectStyle}>
            <option value="">Todos deptos</option>
            {DEPTOS.map(d => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={selectStyle}>
            <option value="">Todos status</option>
            {STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Contagem */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid #e0dcd8', background: '#f7f6f4' }}>
        <span style={{ fontSize: 11, color: '#888480' }}>
          {loading ? 'Carregando...' : `${conversas.length} conversa${conversas.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!loading && conversas.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#888480', fontSize: 13 }}>
            Nenhuma conversa encontrada
          </div>
        )}
        {conversas.map(c => (
          <ConversaCard
            key={c.id}
            conversa={c}
            ativo={conversaAtiva?.id === c.id}
            onClick={() => onSelecionarConversa(c)}
          />
        ))}
      </div>
    </div>
  )
}
