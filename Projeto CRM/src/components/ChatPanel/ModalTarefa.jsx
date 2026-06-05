import { useState, useEffect } from 'react'
import { X, ClipboardList } from 'lucide-react'
import { criarTarefa } from '@/hooks/useTarefas'
import { buscarAgentesDoDepto } from '@/services/crm.service'

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
const PRIORIDADES = [
  { value: 'BAIXA',   label: 'Baixa',   cor: '#888480' },
  { value: 'NORMAL',  label: 'Normal',  cor: '#1D4ED8' },
  { value: 'ALTA',    label: 'Alta',    cor: '#b87a00' },
  { value: 'URGENTE', label: 'Urgente', cor: '#b83232' },
]

export function ModalTarefa({ conversa, perfil, onCriada, onFechar }) {
  const [titulo, setTitulo]           = useState('')
  const [demandante, setDemandante]   = useState(conversa?.contatos?.nome ?? conversa?.contatos?.empresa ?? '')
  const [descricao, setDescricao]     = useState('')
  const [departamento, setDepto]      = useState(conversa?.departamento ?? perfil?.departamentos?.[0] ?? 'ADMINISTRATIVO')
  const [prioridade, setPrioridade] = useState('NORMAL')
  const [atribuidoA, setAtribuidoA] = useState('')
  const [prazo, setPrazo]           = useState('')
  const [agentes, setAgentes]       = useState([])
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')

  useEffect(() => {
    if (departamento) buscarAgentesDoDepto(departamento).then(setAgentes)
  }, [departamento])

  const handleSalvar = async (e) => {
    e.preventDefault()
    if (!titulo.trim()) { setErro('Informe um título para a tarefa.'); return }
    setSalvando(true); setErro('')
    const { data, error } = await criarTarefa({
      conversaId:  conversa?.id ?? null,
      titulo:      titulo.trim(),
      demandante:  demandante.trim() || null,
      descricao:   descricao.trim() || null,
      departamento,
      prioridade,
      atribuidoA:  atribuidoA || null,
      prazo:       prazo || null,
    })
    setSalvando(false)
    if (error) { setErro(error.message); return }
    onCriada?.(data)
    onFechar()
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13,
    outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 5 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        width: 480, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={16} color="#7a1e1e" />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                Abrir Tarefa
              </h3>
              {conversa && (
                <p style={{ fontSize: 10, color: '#888480', margin: 0, fontFamily: 'DM Mono, monospace' }}>
                  Conversa: {conversa.protocolo} · {conversa.contatos?.nome ?? conversa.contatos?.telefone}
                </p>
              )}
            </div>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Título */}
          <div>
            <label style={labelStyle}>Título da tarefa *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Processar admissão — João Silva"
              required style={inputStyle} autoFocus />
          </div>

          {/* Demandante */}
          <div>
            <label style={labelStyle}>
              Demandante
              <span style={{ fontWeight: 400, color: '#888480', marginLeft: 4 }}>— cliente ou empresa que solicitou</span>
            </label>
            <input value={demandante} onChange={e => setDemandante(e.target.value)}
              placeholder="Ex: João Silva · Empresa ABC Ltda."
              style={inputStyle} />
          </div>

          {/* Descrição */}
          <div>
            <label style={labelStyle}>Descrição / Detalhes</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva os detalhes da atividade, documentos necessários, etc."
              rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Departamento */}
            <div>
              <label style={labelStyle}>Departamento *</label>
              <select value={departamento} onChange={e => setDepto(e.target.value)} style={inputStyle}>
                {DEPTOS.map(d => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
              </select>
            </div>

            {/* Prioridade */}
            <div>
              <label style={labelStyle}>Prioridade</label>
              <div style={{ display: 'flex', gap: 5 }}>
                {PRIORIDADES.map(p => (
                  <button key={p.value} type="button" onClick={() => setPrioridade(p.value)}
                    style={{
                      flex: 1, padding: '6px 4px', borderRadius: 5, border: '1.5px solid',
                      borderColor: prioridade === p.value ? p.cor : '#e0dcd8',
                      background: prioridade === p.value ? `${p.cor}18` : '#fff',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      color: prioridade === p.value ? p.cor : '#888480',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Atribuir a */}
            <div>
              <label style={labelStyle}>Atribuir a (opcional)</label>
              <select value={atribuidoA} onChange={e => setAtribuidoA(e.target.value)} style={inputStyle}>
                <option value="">Sem responsável</option>
                {agentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            {/* Prazo */}
            <div>
              <label style={labelStyle}>Prazo (opcional)</label>
              <input type="datetime-local" value={prazo} onChange={e => setPrazo(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {erro && <p style={{ fontSize: 12, color: '#b83232', margin: 0 }}>{erro}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onFechar} style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e0dcd8',
              background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: salvando ? '#c5c0ba' : '#7a1e1e',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer',
            }}>
              {salvando ? 'Abrindo...' : '📋 Abrir Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
