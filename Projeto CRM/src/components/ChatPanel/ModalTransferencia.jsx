import { useState, useEffect } from 'react'
import { X, ArrowRight } from 'lucide-react'
import { buscarAgentesDoDepto } from '@/services/crm.service'

const DEPTOS = [
  { value: 'PESSOAL',        label: 'Pessoal',        color: '#1D4ED8' },
  { value: 'CONTABIL',       label: 'Contábil',       color: '#065F46' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo', color: '#92400E' },
  { value: 'TRIBUTARIO',     label: 'Tributário',     color: '#5B21B6' },
]

export function ModalTransferencia({ conversaId, deptoAtual, onConfirmar, onFechar }) {
  const [paraDepto, setParaDepto] = useState('')
  const [paraAgente, setParaAgente] = useState('')
  const [motivo, setMotivo] = useState('')
  const [agentes, setAgentes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!paraDepto) { setAgentes([]); setParaAgente(''); return }
    buscarAgentesDoDepto(paraDepto).then(setAgentes)
  }, [paraDepto])

  const handleConfirmar = async () => {
    if (!paraDepto) return
    setLoading(true)
    await onConfirmar(paraDepto, paraAgente || null, motivo || null)
    setLoading(false)
    onFechar()
  }

  const labelStyle = { fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 5 }
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px', border: '1px solid #e0dcd8',
    borderRadius: 6, fontSize: 13, outline: 'none',
    fontFamily: 'DM Sans, sans-serif', background: '#fff',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        width: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Transferir Conversa
          </h3>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Departamento destino */}
          <div>
            <label style={labelStyle}>Departamento destino *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DEPTOS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setParaDepto(d.value)}
                  disabled={d.value === deptoAtual}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: d.value === deptoAtual ? 'not-allowed' : 'pointer',
                    border: '1px solid',
                    borderColor: paraDepto === d.value ? d.color : '#e0dcd8',
                    background: paraDepto === d.value ? `${d.color}15` : '#fff',
                    fontSize: 12, fontWeight: 500, color: d.value === deptoAtual ? '#c5c0ba' : d.color,
                    textAlign: 'left',
                  }}
                >
                  {d.label}
                  {d.value === deptoAtual && <span style={{ color: '#c5c0ba', fontWeight: 400 }}> (atual)</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Agente destino (opcional) */}
          {paraDepto && (
            <div>
              <label style={labelStyle}>Agente destino (opcional)</label>
              <select
                value={paraAgente}
                onChange={e => setParaAgente(e.target.value)}
                style={{ ...inputStyle }}
              >
                <option value="">Sem agente específico (ficará em espera)</option>
                {agentes.map(a => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label style={labelStyle}>Motivo (opcional)</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Dúvida específica de contabilidade..."
              rows={2}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </div>
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            onClick={onFechar}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e0dcd8',
              background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!paraDepto || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 6, border: 'none',
              background: !paraDepto || loading ? '#c5c0ba' : '#7a1e1e',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: !paraDepto || loading ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <ArrowRight size={14} />
            {loading ? 'Transferindo...' : 'Transferir'}
          </button>
        </div>
      </div>
    </div>
  )
}
