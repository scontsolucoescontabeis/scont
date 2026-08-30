import { useState, useEffect, useRef } from 'react'
import { MessageSquarePlus, X, Search, Phone, User } from 'lucide-react'
import { buscarContatosParaConversa, iniciarConversa } from '@/services/crm.service'

const DEPTOS = [
  ['PESSOAL', 'Pessoal'],
  ['CONTABIL', 'Contábil'],
  ['ADMINISTRATIVO', 'Administrativo'],
  ['TRIBUTARIO', 'Tributário'],
]

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px',
  border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13,
  outline: 'none', fontFamily: 'DM Sans, sans-serif',
}
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 4 }

export default function ModalNovaConversa({ contatoFixo = null, departamentosDoAgente = [], onCriada, onFechar }) {
  const [modo, setModo]                       = useState('contato') // 'contato' | 'avulso'
  const [busca, setBusca]                     = useState('')
  const [resultados, setResultados]           = useState([])
  const [contatoSel, setContatoSel]           = useState(contatoFixo)
  const [telefoneAvulso, setTelefoneAvulso]   = useState('')
  const [nomeAvulso, setNomeAvulso]           = useState('')
  const [departamento, setDepartamento]       = useState(departamentosDoAgente[0] ?? '')
  const [conteudo, setConteudo]               = useState('')
  const [enviando, setEnviando]               = useState(false)
  const [erro, setErro]                       = useState('')
  const buscaTimer = useRef(null)

  useEffect(() => {
    if (contatoFixo || modo !== 'contato') return
    clearTimeout(buscaTimer.current)
    buscaTimer.current = setTimeout(() => {
      buscarContatosParaConversa(busca).then(setResultados).catch(() => setResultados([]))
    }, 250)
    return () => clearTimeout(buscaTimer.current)
  }, [busca, modo, contatoFixo])

  const podeEnviar =
    !!departamento &&
    !!conteudo.trim() &&
    (contatoSel || (modo === 'avulso' && telefoneAvulso.replace(/\D/g, '').length >= 10))

  const handleEnviar = async () => {
    if (!podeEnviar || enviando) return
    setEnviando(true); setErro('')
    try {
      const conversa = await iniciarConversa({
        contatoId:  contatoSel?.id ?? null,
        telefone:   contatoSel ? '' : telefoneAvulso,
        nome:       contatoSel ? '' : nomeAvulso,
        departamento,
        conteudo,
      })
      onCriada(conversa)
    } catch (e) {
      setErro(e.message || 'Não foi possível iniciar a conversa.')
      setEnviando(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 26,
        width: 480, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquarePlus size={16} color="#7a1e1e" />
            </div>
            <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              Nova conversa
            </h3>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        {/* ── Destinatário ── */}
        {contatoFixo ? (
          <div style={{ marginBottom: 14, padding: '10px 12px', background: '#f7f6f4', borderRadius: 6, border: '1px solid #e0dcd8' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{contatoFixo.nome}</div>
            <div style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace' }}>{contatoFixo.telefone}</div>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[['contato', 'Buscar contato'], ['avulso', 'Número avulso']].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => { setModo(v); setContatoSel(null); setErro('') }}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: modo === v ? '1px solid #7a1e1e' : '1px solid #e0dcd8',
                    background: modo === v ? '#f0e8e8' : '#fff',
                    color: modo === v ? '#7a1e1e' : '#888480',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {modo === 'contato' ? (
              contatoSel ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f7f6f4', borderRadius: 6, border: '1px solid #e0dcd8' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{contatoSel.nome}</div>
                    <div style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace' }}>{contatoSel.telefone}</div>
                  </div>
                  <button onClick={() => setContatoSel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888480' }}>
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#888480' }} />
                    <input
                      autoFocus
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Nome ou telefone..."
                      style={{ ...inputStyle, paddingLeft: 28 }}
                    />
                  </div>
                  {resultados.length > 0 && (
                    <div style={{ marginTop: 6, border: '1px solid #e0dcd8', borderRadius: 6, maxHeight: 180, overflowY: 'auto' }}>
                      {resultados.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setContatoSel(c)}
                          style={{
                            width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                            borderBottom: '1px solid #f0ede9', background: 'none', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', gap: 1,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f7f6f4'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <span style={{ fontSize: 13, color: '#1a1a1a' }}>{c.nome}</span>
                          <span style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace' }}>{c.telefone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {busca.trim() && resultados.length === 0 && (
                    <p style={{ fontSize: 11, color: '#888480', marginTop: 6 }}>
                      Nenhum contato encontrado. Use "Número avulso" para um número novo.
                    </p>
                  )}
                </>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Phone size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#888480' }} />
                  <input
                    autoFocus
                    value={telefoneAvulso}
                    onChange={e => setTelefoneAvulso(e.target.value)}
                    placeholder="5561999999999"
                    style={{ ...inputStyle, paddingLeft: 28, fontFamily: 'DM Mono, monospace' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <User size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#888480' }} />
                  <input
                    value={nomeAvulso}
                    onChange={e => setNomeAvulso(e.target.value)}
                    placeholder="Nome (opcional)"
                    style={{ ...inputStyle, paddingLeft: 28 }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Departamento ── */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Departamento <span style={{ color: '#b83232' }}>*</span></label>
          <select value={departamento} onChange={e => setDepartamento(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Selecione...</option>
            {DEPTOS.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>

        {/* ── Mensagem ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Mensagem <span style={{ color: '#b83232' }}>*</span></label>
          <textarea
            value={conteudo}
            onChange={e => setConteudo(e.target.value)}
            placeholder="Escreva a primeira mensagem..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {erro && <p style={{ fontSize: 12, color: '#b83232', marginBottom: 10 }}>{erro}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onFechar} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #e0dcd8',
            background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!podeEnviar || enviando}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: (!podeEnviar || enviando) ? '#c5c0ba' : '#7a1e1e',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: (!podeEnviar || enviando) ? 'not-allowed' : 'pointer',
            }}
          >
            {enviando ? 'Enviando...' : 'Iniciar conversa'}
          </button>
        </div>
      </div>
    </div>
  )
}
