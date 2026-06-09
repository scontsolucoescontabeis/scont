import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { buscarMensagensProntas } from '@/services/crm.service'

export function PickerMensagensProntas({ onSelecionar, onFechar }) {
  const [mensagens, setMensagens] = useState([])
  const [busca, setBusca]         = useState('')
  const [loading, setLoading]     = useState(true)
  const searchRef = useRef(null)

  useEffect(() => {
    buscarMensagensProntas()
      .then(setMensagens)
      .catch(() => setMensagens([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  const filtradas = mensagens.filter(m => {
    const q = busca.toLowerCase()
    return !q || m.titulo.toLowerCase().includes(q) || m.conteudo.toLowerCase().includes(q) || (m.categoria || '').toLowerCase().includes(q)
  })

  const proprias      = filtradas.filter(m => !m.compartilhada)
  const compartilhadas = filtradas.filter(m => m.compartilhada)

  return (
    <div style={{
      border: '1px solid #e0dcd8',
      borderBottom: 'none',
      borderRadius: '8px 8px 0 0',
      background: '#fff',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      maxHeight: 340,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e0dcd8', flexShrink: 0 }}>
        <Search size={13} color="#888480" />
        <input
          ref={searchRef}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar mensagem pronta..."
          style={{
            flex: 1, border: 'none', outline: 'none',
            fontSize: 12, background: 'transparent',
            fontFamily: 'DM Sans, sans-serif', color: '#1a1a1a',
          }}
        />
        <button
          onClick={onFechar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: '#888480' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Lista */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && (
          <div style={{ padding: '16px 12px', fontSize: 12, color: '#888480', textAlign: 'center' }}>Carregando...</div>
        )}

        {!loading && filtradas.length === 0 && (
          <div style={{ padding: '16px 12px', fontSize: 12, color: '#888480', textAlign: 'center' }}>
            {busca ? 'Nenhuma mensagem encontrada.' : 'Nenhuma mensagem cadastrada.'}
          </div>
        )}

        {!loading && compartilhadas.length > 0 && (
          <Grupo titulo="Compartilhadas" itens={compartilhadas} onSelecionar={onSelecionar} />
        )}

        {!loading && proprias.length > 0 && (
          <Grupo titulo="Minhas mensagens" itens={proprias} onSelecionar={onSelecionar} />
        )}
      </div>
    </div>
  )
}

function Grupo({ titulo, itens, onSelecionar }) {
  return (
    <div>
      <div style={{
        padding: '5px 12px 3px',
        fontSize: 10, fontWeight: 600,
        color: '#b5b0aa', textTransform: 'uppercase', letterSpacing: '0.06em',
        background: '#fafaf9',
        borderBottom: '1px solid #f0ede9',
      }}>
        {titulo}
      </div>
      {itens.map(m => (
        <button
          key={m.id}
          onClick={() => onSelecionar(m.conteudo)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 12px', border: 'none', borderBottom: '1px solid #f0ede9',
            background: 'none', cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f7f4f1'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{m.titulo}</span>
            {m.categoria && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '1px 6px',
                borderRadius: 4, background: '#f0e8e8', color: '#7a1e1e',
              }}>
                {m.categoria}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#888480', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {m.conteudo}
          </div>
        </button>
      ))}
    </div>
  )
}
