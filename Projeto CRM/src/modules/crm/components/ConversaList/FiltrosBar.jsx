import { Search, SlidersHorizontal } from 'lucide-react'
import { useCRM } from '../../contexts/CRMContext'

const DEPTOS = [
  { value: '', label: 'Todos os deptos' },
  { value: 'PESSOAL', label: 'Pessoal' },
  { value: 'CONTABIL', label: 'Contábil' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'TRIBUTARIO', label: 'Tributário' },
]

const STATUS = [
  { value: '', label: 'Todos os status' },
  { value: 'ABERTA', label: 'Aberta' },
  { value: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { value: 'AGUARDANDO', label: 'Aguardando' },
  { value: 'ENCERRADA', label: 'Encerrada' },
]

const selectStyle = {
  border: '1px solid #e0dcd8',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  color: '#1a1a1a',
  background: '#fff',
  outline: 'none',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
}

export function FiltrosBar({ busca, onBuscaChange }) {
  const { filtros, setFiltros, isAdmin } = useCRM()

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1px solid #e0dcd8',
      background: '#f7f6f4',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Campo de busca */}
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888480' }} />
        <input
          type="text"
          placeholder="Buscar por nome ou protocolo..."
          value={busca}
          onChange={e => onBuscaChange(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: 30,
            paddingRight: 10,
            paddingTop: 7,
            paddingBottom: 7,
            border: '1px solid #e0dcd8',
            borderRadius: 6,
            fontSize: 13,
            outline: 'none',
            background: '#fff',
            boxSizing: 'border-box',
            fontFamily: 'DM Sans, sans-serif',
          }}
        />
      </div>

      {/* Selects de filtro */}
      <div style={{ display: 'flex', gap: 6 }}>
        {isAdmin && (
          <select
            value={filtros.departamento || ''}
            onChange={e => setFiltros(f => ({ ...f, departamento: e.target.value || null }))}
            style={{ ...selectStyle, flex: 1 }}
          >
            {DEPTOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        )}

        <select
          value={filtros.status || ''}
          onChange={e => setFiltros(f => ({ ...f, status: e.target.value || null }))}
          style={{ ...selectStyle, flex: 1 }}
        >
          {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
    </div>
  )
}
