import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { buscarMensagensProntas } from '@/services/crm.service'

const DEPTS = [
  { value: 'PESSOAL',        label: 'Pessoal',   bg: '#eff6ff', color: '#1d4ed8' },
  { value: 'CONTABIL',       label: 'Contábil',  bg: '#f0fdf4', color: '#15803d' },
  { value: 'TRIBUTARIO',     label: 'Tributário', bg: '#fefce8', color: '#92400e' },
  { value: 'ADMINISTRATIVO', label: 'Admin.',    bg: '#faf5ff', color: '#6b21a8' },
]

export function PickerMensagensProntas({ onSelecionar, onFechar }) {
  const [mensagens, setMensagens] = useState([])
  const [busca, setBusca]         = useState('')
  const [deptFiltro, setDeptFiltro] = useState('TODOS')
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
    const matchBusca = !q || m.titulo.toLowerCase().includes(q) || m.conteudo.toLowerCase().includes(q) || (m.categoria || '').toLowerCase().includes(q)
    const matchDept  = deptFiltro === 'TODOS' || m.departamento === deptFiltro || (!m.departamento && deptFiltro === 'TODOS')
    return matchBusca && matchDept
  })

  const proprias       = filtradas.filter(m => !m.compartilhada)
  const compartilhadas = filtradas.filter(m => m.compartilhada)

  return (
    <div style={{
      borderTop: '1px solid #e0dcd8',
      borderLeft: '1px solid #e0dcd8',
      borderRight: '1px solid #e0dcd8',
      borderRadius: '8px 8px 0 0',
      background: '#fff',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      maxHeight: 360,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Linha de busca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid #e0dcd8', flexShrink: 0 }}>
        <Search size={12} color="#888480" />
        <input
          ref={searchRef}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar mensagem..."
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
          <X size={13} />
        </button>
      </div>

      {/* Filtro de departamento */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e0dcd8', flexShrink: 0, overflowX: 'auto' }}>
        {[{ value: 'TODOS', label: 'Todos' }, ...DEPTS].map(tab => (
          <button
            key={tab.value}
            onClick={() => setDeptFiltro(tab.value)}
            style={{
              padding: '4px 10px', border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: deptFiltro === tab.value ? 700 : 400,
              background: 'none', whiteSpace: 'nowrap',
              color: deptFiltro === tab.value ? '#7a1e1e' : '#888480',
              borderBottom: deptFiltro === tab.value ? '2px solid #7a1e1e' : '2px solid transparent',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && (
          <div style={{ padding: '14px 12px', fontSize: 12, color: '#888480', textAlign: 'center' }}>Carregando...</div>
        )}

        {!loading && filtradas.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 12, color: '#888480', textAlign: 'center' }}>
            {busca ? 'Nenhuma mensagem encontrada.' : 'Nenhuma mensagem cadastrada.'}
          </div>
        )}

        {!loading && compartilhadas.length > 0 && (
          <Grupo titulo="Compartilhadas" itens={compartilhadas} onSelecionar={onSelecionar} />
        )}

        {!loading && proprias.length > 0 && (
          <Grupo titulo="Minhas" itens={proprias} onSelecionar={onSelecionar} />
        )}
      </div>
    </div>
  )
}

function Grupo({ titulo, itens, onSelecionar }) {
  return (
    <div>
      <div style={{
        padding: '4px 10px 2px', fontSize: 9, fontWeight: 700,
        color: '#b5b0aa', textTransform: 'uppercase', letterSpacing: '0.06em',
        background: '#fafaf9', borderBottom: '1px solid #f0ede9',
      }}>
        {titulo}
      </div>
      {itens.map(m => {
        const deptInfo = m.departamento ? DEPTS.find(d => d.value === m.departamento) : null
        return (
          <button
            key={m.id}
            onClick={() => onSelecionar(m.conteudo)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 10px', border: 'none', borderBottom: '1px solid #f0ede9',
              background: 'none', cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f7f4f1'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{m.titulo}</span>
              {deptInfo && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                  background: deptInfo.bg, color: deptInfo.color,
                }}>
                  {deptInfo.label}
                </span>
              )}
              {m.categoria && (
                <span style={{
                  fontSize: 9, fontWeight: 600, padding: '1px 5px',
                  borderRadius: 3, background: '#f0e8e8', color: '#7a1e1e',
                }}>
                  {m.categoria}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#888480', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.conteudo}
            </div>
          </button>
        )
      })}
    </div>
  )
}
