import { useState, useMemo } from 'react'
import { MessageSquare } from 'lucide-react'
import { ConversaCard } from './ConversaCard'
import { FiltrosBar } from './FiltrosBar'
import { useConversas } from '../../hooks/useConversas'
import { useRealtimeConversas } from '../../hooks/useRealtime'
import { useCRM } from '../../contexts/CRMContext'

export function ConversaList() {
  const { filtros, conversaAtiva, selecionarConversa, perfil } = useCRM()
  const [busca, setBusca] = useState('')

  const { conversas, loading, atualizarConversa, adicionarConversa } = useConversas(filtros)

  // Realtime
  const departamentoEscuta = perfil?.role === 'ADMIN' ? 'TODOS' : perfil?.departamento
  useRealtimeConversas(departamentoEscuta, {
    onInsert: adicionarConversa,
    onUpdate: atualizarConversa,
  })

  const conversasFiltradas = useMemo(() => {
    if (!busca) return conversas
    const termo = busca.toLowerCase()
    return conversas.filter(c =>
      c.contatos?.nome?.toLowerCase().includes(termo) ||
      c.contatos?.telefone?.includes(termo) ||
      c.protocolo?.toLowerCase().includes(termo)
    )
  }, [conversas, busca])

  return (
    <div style={{
      width: 320,
      minWidth: 280,
      borderRight: '1px solid #e0dcd8',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header da lista */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid #e0dcd8',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={16} style={{ color: '#7a1e1e' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>Conversas</span>
        </div>
        <span style={{
          fontSize: 11,
          color: '#888480',
          background: '#f7f6f4',
          border: '1px solid #e0dcd8',
          borderRadius: 4,
          padding: '1px 7px',
          fontFamily: 'DM Mono, monospace',
        }}>
          {conversasFiltradas.length}
        </span>
      </div>

      <FiltrosBar busca={busca} onBuscaChange={setBusca} />

      {/* Lista scrollável */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#888480', fontSize: 13 }}>
            Carregando...
          </div>
        )}

        {!loading && conversasFiltradas.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#888480', fontSize: 13 }}>
            <MessageSquare size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            Nenhuma conversa encontrada
          </div>
        )}

        {conversasFiltradas.map(conversa => (
          <ConversaCard
            key={conversa.id}
            conversa={conversa}
            ativa={conversaAtiva?.id === conversa.id}
            onClick={() => selecionarConversa(conversa)}
          />
        ))}
      </div>
    </div>
  )
}
