import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { listarAgentes } from '../../services/crm.service'

const DEPTOS = [
  { value: 'PESSOAL',        label: 'Pessoal' },
  { value: 'CONTABIL',       label: 'Contábil' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'TRIBUTARIO',     label: 'Tributário' },
]

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e0dcd8',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
  boxSizing: 'border-box',
}

export function ModalTransferencia({ aberto, onFechar, onConfirmar, carregando }) {
  const [departamento, setDepartamento] = useState('PESSOAL')
  const [agenteId, setAgenteId]         = useState('')
  const [motivo, setMotivo]             = useState('')
  const [agentes, setAgentes]           = useState([])

  useEffect(() => {
    if (!aberto) return
    listarAgentes(departamento)
      .then(setAgentes)
      .catch(() => setAgentes([]))
  }, [departamento, aberto])

  const handleConfirmar = () => {
    onConfirmar(departamento, agenteId || null, motivo || null)
  }

  if (!aberto) return null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 10,
        width: 440,
        maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e0dcd8',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a1a' }}>Transferir conversa</span>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888480', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Departamento destino */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 5 }}>
              Departamento destino *
            </label>
            <select
              value={departamento}
              onChange={e => { setDepartamento(e.target.value); setAgenteId('') }}
              style={inputStyle}
            >
              {DEPTOS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          {/* Agente destino (opcional) */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 5 }}>
              Agente destino (opcional)
            </label>
            <select
              value={agenteId}
              onChange={e => setAgenteId(e.target.value)}
              style={inputStyle}
            >
              <option value="">— Sem agente específico —</option>
              {agentes.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </div>

          {/* Motivo */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 5 }}>
              Motivo (opcional)
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Descreva brevemente o motivo da transferência..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e0dcd8',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button
            onClick={onFechar}
            style={{
              padding: '8px 18px',
              border: '1px solid #e0dcd8',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              color: '#1a1a1a',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={carregando}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 6,
              background: carregando ? '#9b2c2c' : '#7a1e1e',
              color: '#fff',
              cursor: carregando ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {carregando ? 'Transferindo...' : 'Confirmar transferência'}
          </button>
        </div>
      </div>
    </div>
  )
}
