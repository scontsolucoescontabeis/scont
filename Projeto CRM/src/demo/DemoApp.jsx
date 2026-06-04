/**
 * DemoApp — versão sem Supabase para validação do frontend.
 * Usa dados mockados e substitui todos os hooks/services por versões estáticas.
 */
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { useState, useCallback, createContext, useContext } from 'react'
import { MessageSquare, BarChart2, Users, LogOut } from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  mockPerfil, mockConversas, mockMensagens, mockAnotacoes,
  mockTransferencias, mockTags, mockTagsDaConversa,
  mockMetricas, mockAgentes,
} from './mockData'

// ============================================================
// Context demo (substitui CRMContext)
// ============================================================
const DemoCRMContext = createContext(null)

function DemoCRMProvider({ children }) {
  const [conversaAtiva, setConversaAtiva] = useState(null)
  const [filtros, setFiltros] = useState({ status: null, departamento: null })

  return (
    <DemoCRMContext.Provider value={{
      perfil: mockPerfil,
      loadingPerfil: false,
      conversaAtiva,
      selecionarConversa: setConversaAtiva,
      filtros,
      setFiltros,
      notificacoes: [],
      limparNotificacoes: () => {},
      isAdmin: true,
    }}>
      {children}
    </DemoCRMContext.Provider>
  )
}
export function useCRM() { return useContext(DemoCRMContext) }

// ============================================================
// Componentes copiados do app real mas com dados mock inline
// ============================================================

// -- Shared
function BadgeDepartamento({ departamento, size = 'sm' }) {
  const CONFIG = {
    PESSOAL:        { label: 'Pessoal',        bg: '#EFF6FF', color: '#3B82F6', border: '#BFDBFE' },
    CONTABIL:       { label: 'Contábil',       bg: '#ECFDF5', color: '#10B981', border: '#A7F3D0' },
    ADMINISTRATIVO: { label: 'Administrativo', bg: '#FFFBEB', color: '#F59E0B', border: '#FDE68A' },
    TRIBUTARIO:     { label: 'Tributário',     bg: '#F5F3FF', color: '#8B5CF6', border: '#DDD6FE' },
  }
  const cfg = CONFIG[departamento] || { label: departamento, bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' }
  const fs = size === 'xs' ? '10px' : '11px'
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: size === 'xs' ? '1px 6px' : '3px 10px', borderRadius: 9999, fontSize: fs, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {cfg.label}
    </span>
  )
}

function BadgeStatus({ status, size = 'sm' }) {
  const CONFIG = {
    ABERTA:         { label: 'Aberta',         bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
    EM_ATENDIMENTO: { label: 'Em atendimento', bg: '#ECFDF5', color: '#2d7a4f', border: '#A7F3D0' },
    AGUARDANDO:     { label: 'Aguardando',     bg: '#FFFBEB', color: '#b87a00', border: '#FDE68A' },
    ENCERRADA:      { label: 'Encerrada',      bg: '#F9FAFB', color: '#9CA3AF', border: '#E5E7EB' },
  }
  const cfg = CONFIG[status] || CONFIG.ABERTA
  const fs = size === 'xs' ? '10px' : '11px'
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: size === 'xs' ? '1px 6px' : '3px 10px', borderRadius: 9999, fontSize: fs, fontWeight: 500, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {cfg.label}
    </span>
  )
}

function Protocolo({ protocolo, size = 'sm' }) {
  if (!protocolo) return null
  return (
    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: size === 'xs' ? '10px' : '11px', color: '#888480', background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 4, padding: '1px 6px' }}>
      {protocolo}
    </span>
  )
}

// -- ConversaCard
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`
  return `há ${Math.floor(diff / 86400)}d`
}

function ConversaCard({ conversa, ativa, onClick }) {
  const nome = conversa.contatos?.nome || conversa.contatos?.telefone || 'Desconhecido'
  const preview = conversa._ultimaMensagem?.conteudo || 'Sem mensagens'
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', background: ativa ? '#f0e8e8' : '#ffffff', borderLeft: ativa ? '3px solid #7a1e1e' : '3px solid transparent', borderBottom: '1px solid #e0dcd8', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#f0e8e8', color: '#7a1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
        {nome[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{nome}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {conversa.nao_lidas > 0 && (
              <span style={{ background: '#7a1e1e', color: '#fff', borderRadius: 9999, fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', fontFamily: 'DM Mono, monospace' }}>{conversa.nao_lidas}</span>
            )}
            <span style={{ fontSize: 10, color: '#888480', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace' }}>{timeAgo(conversa.atualizado_em)}</span>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#888480', margin: '2px 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          <BadgeDepartamento departamento={conversa.departamento} size="xs" />
          <BadgeStatus status={conversa.status} size="xs" />
          <Protocolo protocolo={conversa.protocolo} size="xs" />
        </div>
      </div>
    </button>
  )
}

// -- ConversaList Demo
function ConversaListDemo() {
  const { filtros, setFiltros, conversaAtiva, selecionarConversa } = useCRM()
  const [busca, setBusca] = useState('')

  const filtradas = mockConversas.filter(c => {
    if (filtros.status && c.status !== filtros.status) return false
    if (filtros.departamento && c.departamento !== filtros.departamento) return false
    if (busca) {
      const t = busca.toLowerCase()
      return c.contatos?.nome?.toLowerCase().includes(t) || c.protocolo?.toLowerCase().includes(t)
    }
    return true
  })

  return (
    <div style={{ width: 320, minWidth: 280, borderRight: '1px solid #e0dcd8', display: 'flex', flexDirection: 'column', background: '#ffffff', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #e0dcd8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Conversas</span>
        <span style={{ fontSize: 11, color: '#888480', background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 4, padding: '1px 7px', fontFamily: 'DM Mono, monospace' }}>{filtradas.length}</span>
      </div>
      {/* Filtros */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid #e0dcd8', background: '#f7f6f4', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <input placeholder="Buscar por nome ou protocolo..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={filtros.departamento || ''} onChange={e => setFiltros(f => ({ ...f, departamento: e.target.value || null }))} style={{ flex: 1, padding: '5px 7px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
            <option value="">Todos os deptos</option>
            {['PESSOAL','CONTABIL','ADMINISTRATIVO','TRIBUTARIO'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filtros.status || ''} onChange={e => setFiltros(f => ({ ...f, status: e.target.value || null }))} style={{ flex: 1, padding: '5px 7px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
            <option value="">Todos status</option>
            {['ABERTA','EM_ATENDIMENTO','AGUARDANDO','ENCERRADA'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtradas.map(c => (
          <ConversaCard key={c.id} conversa={c} ativa={conversaAtiva?.id === c.id} onClick={() => selecionarConversa(c)} />
        ))}
      </div>
    </div>
  )
}

// -- ChatPanel Demo
function ChatPanelDemo() {
  const { conversaAtiva, selecionarConversa, perfil } = useCRM()
  const [texto, setTexto] = useState('')
  const [modoNota, setModoNota] = useState(false)
  const [localMsgs, setLocalMsgs] = useState({})
  const [showTags, setShowTags] = useState(false)
  const [tagsDaConversa, setTagsDaConversa] = useState({})
  const [modalEncerrar, setModalEncerrar] = useState(false)
  const [modalTransf, setModalTransf] = useState(false)

  if (!conversaAtiva) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888480', background: '#f7f6f4' }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.2 }}>💬</div>
        <p style={{ fontSize: 14, margin: 0 }}>Selecione uma conversa para começar</p>
      </div>
    )
  }

  const msgs = [...(mockMensagens[conversaAtiva.id] || []), ...(localMsgs[conversaAtiva.id] || [])]
  const anots = mockAnotacoes[conversaAtiva.id] || []
  const tagsConv = tagsDaConversa[conversaAtiva.id] || mockTagsDaConversa[conversaAtiva.id] || []
  const encerrada = conversaAtiva.status === 'ENCERRADA'

  const enviar = () => {
    if (!texto.trim()) return
    const nova = {
      id: `local-${Date.now()}`,
      conversa_id: conversaAtiva.id,
      conteudo: texto,
      tipo: 'text',
      origem: modoNota ? 'SISTEMA' : 'AGENTE',
      timestamp: new Date().toISOString(),
      agente: perfil,
      _nota: modoNota,
    }
    setLocalMsgs(prev => ({ ...prev, [conversaAtiva.id]: [...(prev[conversaAtiva.id] || []), nova] }))
    setTexto('')
  }

  const timeline = [
    ...msgs.map(m => ({ ...m, _tipo: 'mensagem' })),
    ...anots.map(a => ({ ...a, _tipo: 'anotacao' })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '11px 14px', borderBottom: '1px solid #e0dcd8', background: '#fff', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{conversaAtiva.contatos?.nome || 'Desconhecido'}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            <BadgeDepartamento departamento={conversaAtiva.departamento} size="xs" />
            <BadgeStatus status={conversaAtiva.status} size="xs" />
            <Protocolo protocolo={conversaAtiva.protocolo} size="xs" />
          </div>
        </div>
        {tagsConv.map(t => (
          <span key={t.id} style={{ background: t.cor + '22', color: t.cor, border: `1px solid ${t.cor}44`, borderRadius: 9999, padding: '2px 8px', fontSize: 11 }}>{t.nome}</span>
        ))}
        {!encerrada && (
          <>
            {!conversaAtiva.agente_id && <BotaoAcao label="Assumir" onClick={() => selecionarConversa({ ...conversaAtiva, agente_id: 'user-1', status: 'EM_ATENDIMENTO' })} />}
            <BotaoAcao label="Transferir ↗" onClick={() => setModalTransf(true)} />
            <BotaoAcao label="Encerrar ✓" danger onClick={() => setModalEncerrar(true)} />
          </>
        )}
        <BotaoAcao label="Tags" active={showTags} onClick={() => setShowTags(s => !s)} />
      </div>

      {/* Tags picker */}
      {showTags && (
        <div style={{ padding: '9px 14px', borderBottom: '1px solid #e0dcd8', background: '#fafaf9', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {mockTags.map(tag => {
            const ativa = tagsConv.find(t => t.id === tag.id)
            return (
              <button key={tag.id} onClick={() => setTagsDaConversa(prev => {
                const curr = prev[conversaAtiva.id] || mockTagsDaConversa[conversaAtiva.id] || []
                const nova = ativa ? curr.filter(t => t.id !== tag.id) : [...curr, tag]
                return { ...prev, [conversaAtiva.id]: nova }
              })} style={{ background: ativa ? tag.cor : '#fff', color: ativa ? '#fff' : tag.cor, border: `1px solid ${tag.cor}`, borderRadius: 9999, padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {tag.nome}
              </button>
            )
          })}
        </div>
      )}

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#f7f6f4', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {timeline.map(item => {
          if (item._tipo === 'anotacao' || item._nota) {
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                <div style={{ maxWidth: '72%', background: '#FEFCE8', border: '1px solid #FEF08A', borderRadius: 8, padding: '8px 12px', width: '100%' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#854d0e', marginBottom: 3 }}>🔒 Nota interna · {item.agente?.nome}</div>
                  <p style={{ margin: 0, fontSize: 13, color: '#713f12' }}>{item.conteudo}</p>
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#a16207', marginTop: 3, fontFamily: 'DM Mono, monospace' }}>{new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            )
          }
          const isSistema = item.origem === 'SISTEMA' || item.origem === 'BOT'
          const isCliente = item.origem === 'CLIENTE'
          if (isSistema) {
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                <span style={{ fontSize: 12, color: '#888480', fontStyle: 'italic', background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 12, padding: '3px 12px' }}>{item.conteudo}</span>
              </div>
            )
          }
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: isCliente ? 'flex-start' : 'flex-end', margin: '2px 0' }}>
              <div style={{ maxWidth: '68%', background: isCliente ? '#f3f3f1' : '#f0e8e8', borderRadius: isCliente ? '2px 12px 12px 12px' : '12px 2px 12px 12px', padding: '8px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: 0, fontSize: 14, color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.conteudo}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5, marginTop: 3 }}>
                  {!isCliente && item.agente?.nome && <span style={{ fontSize: 11, color: '#9b2c2c' }}>{item.agente.nome}</span>}
                  <span style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace' }}>{new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* InputBar */}
      {!encerrada ? (
        <div style={{ borderTop: '1px solid #e0dcd8', background: '#fafaf9', padding: '10px 12px' }}>
          {modoNota && <div style={{ fontSize: 11, color: '#854d0e', marginBottom: 6, fontWeight: 500 }}>🔒 Modo nota interna — não será enviada ao cliente</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
              placeholder={modoNota ? 'Escreva uma nota interna...' : 'Digite uma mensagem...'}
              rows={1}
              style={{ flex: 1, resize: 'none', border: `1px solid ${modoNota ? '#FEF08A' : '#e0dcd8'}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', background: modoNota ? '#FEFCE8' : '#fff', lineHeight: 1.5, maxHeight: 100, overflowY: 'auto' }}
            />
            <button onClick={() => setModoNota(m => !m)} title="Nota interna" style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid #e0dcd8', background: modoNota ? '#FEF08A' : '#fff', color: modoNota ? '#854d0e' : '#888480', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>🔒</button>
            <button onClick={enviar} disabled={!texto.trim()} style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: texto.trim() ? '#7a1e1e' : '#d6c5c5', color: '#fff', cursor: texto.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>➤</button>
          </div>
          <div style={{ fontSize: 11, color: '#888480', marginTop: 4 }}>Enter para enviar · Shift+Enter para nova linha</div>
        </div>
      ) : (
        <div style={{ padding: 12, textAlign: 'center', fontSize: 13, color: '#888480', borderTop: '1px solid #e0dcd8', background: '#fafaf9' }}>Conversa encerrada</div>
      )}

      {/* Modal encerrar */}
      {modalEncerrar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Encerrar conversa?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888480', lineHeight: 1.5 }}>Isso enviará uma mensagem de encerramento ao cliente.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalEncerrar(false)} style={{ padding: '8px 18px', border: '1px solid #e0dcd8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={() => { selecionarConversa({ ...conversaAtiva, status: 'ENCERRADA' }); setModalEncerrar(false) }} style={{ padding: '8px 18px', border: 'none', borderRadius: 6, background: '#b83232', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Encerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal transferência */}
      {modalTransf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: 10, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0dcd8', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Transferir conversa</span>
              <button onClick={() => setModalTransf(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Departamento destino *
                <select style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13 }}>
                  {['PESSOAL','CONTABIL','ADMINISTRATIVO','TRIBUTARIO'].map(d => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Agente destino (opcional)
                <select style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13 }}>
                  <option>— Sem agente específico —</option>
                  {mockAgentes.map(a => <option key={a.id}>{a.nome}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Motivo (opcional)
                <textarea rows={2} style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} />
              </label>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e0dcd8', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setModalTransf(false)} style={{ padding: '8px 18px', border: '1px solid #e0dcd8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={() => setModalTransf(false)} style={{ padding: '8px 18px', border: 'none', borderRadius: 6, background: '#7a1e1e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// -- PainelDireito Demo
function PainelDireitoDemo() {
  const { conversaAtiva, selecionarConversa } = useCRM()
  const transfList = conversaAtiva ? (mockTransferencias[conversaAtiva.id] || []) : []

  if (!conversaAtiva) return (
    <div style={{ width: 280, borderLeft: '1px solid #e0dcd8', background: '#f7f6f4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5c0ba', fontSize: 13 }}>
      Selecione uma conversa
    </div>
  )

  const contato = conversaAtiva.contatos
  return (
    <div style={{ width: 280, borderLeft: '1px solid #e0dcd8', background: '#fff', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* Dados contato */}
      <div style={{ padding: 16, borderBottom: '1px solid #e0dcd8' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f0e8e8', color: '#7a1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, border: '2px solid #e0dcd8' }}>
            {(contato?.nome || '?')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1a1a' }}>{contato?.nome || 'Sem nome'}</div>
            {contato?.empresa && <div style={{ fontSize: 12, color: '#888480' }}>🏢 {contato.empresa}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: '#888480' }}>📱</span>
            <span style={{ color: '#888480', minWidth: 52 }}>Telefone</span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{contato?.telefone}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: '#888480' }}>👤</span>
            <span style={{ color: '#888480', minWidth: 52 }}>Agente</span>
            <span>{conversaAtiva.agente?.nome || <span style={{ color: '#888480' }}>Sem agente</span>}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <BadgeDepartamento departamento={conversaAtiva.departamento} size="xs" />
            <Protocolo protocolo={conversaAtiva.protocolo} size="xs" />
          </div>
        </div>
      </div>

      {/* Histórico de conversas anteriores */}
      <div style={{ padding: 16, borderTop: '1px solid #e0dcd8' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Atendimentos anteriores</div>
        {mockConversas.filter(c => c.contatos?.id === contato?.id && c.id !== conversaAtiva.id).length === 0
          ? <p style={{ fontSize: 12, color: '#c5c0ba' }}>Sem histórico anterior</p>
          : mockConversas.filter(c => c.contatos?.id === contato?.id && c.id !== conversaAtiva.id).map(c => (
            <button key={c.id} onClick={() => selecionarConversa(c)} style={{ width: '100%', textAlign: 'left', background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 6, padding: '7px 10px', cursor: 'pointer', marginBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#888480' }}>{c.protocolo}</span>
              <BadgeStatus status={c.status} size="xs" />
            </button>
          ))
        }
      </div>

      {/* Timeline transferências */}
      {transfList.length > 0 && (
        <div style={{ padding: 16, borderTop: '1px solid #e0dcd8' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Transferências</div>
          {transfList.map(t => (
            <div key={t.id} style={{ background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 6, padding: '8px 10px', marginBottom: 8, fontSize: 12 }}>
              <div style={{ fontWeight: 500, color: '#1a1a1a', marginBottom: 3 }}>⇄ {t.de_departamento} → {t.para_departamento}</div>
              {t.motivo && <p style={{ margin: '2px 0', color: '#888480', fontSize: 11 }}>{t.motivo}</p>}
              <div style={{ fontSize: 10, color: '#aaa49f', fontFamily: 'DM Mono, monospace' }}>{new Date(t.timestamp).toLocaleString('pt-BR')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// -- CRMPage Demo
function CRMPageDemo() {
  return (
    <DemoCRMProvider>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <ConversaListDemo />
        <ChatPanelDemo />
        <PainelDireitoDemo />
      </div>
    </DemoCRMProvider>
  )
}

// -- Métricas Demo
function MetricasDemo() {
  const CORES = { PESSOAL: '#3B82F6', CONTABIL: '#10B981', ADMINISTRATIVO: '#F59E0B', TRIBUTARIO: '#8B5CF6' }
  const NOMES = { PESSOAL: 'Pessoal', CONTABIL: 'Contábil', ADMINISTRATIVO: 'Administrativo', TRIBUTARIO: 'Tributário' }
  const { kpi, distribuicao, volume, ranking } = mockMetricas
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', background: '#f2f2f0' }}>
      <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Métricas</h1>
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        {[['Conversas abertas', kpi.abertas, '#3B82F6'], ['Em atendimento', kpi.emAtendimento, '#10B981'], ['Encerradas hoje', kpi.encerradasHoje, '#7a1e1e']].map(([label, valor, cor]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: '20px 24px', flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 12, color: '#888480', marginBottom: 6, fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color, fontFamily: 'DM Mono, monospace' }}>{valor}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, flex: '0 0 300px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Distribuição por departamento</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={distribuicao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                label={({ name, percent }) => percent > 0 ? `${NOMES[name]} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                {distribuicao.map(e => <Cell key={e.name} fill={CORES[e.name] || '#ccc'} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, NOMES[n] || n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20, flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Volume — últimos 7 dias</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="data" tick={{ fontSize: 11, fontFamily: 'DM Mono, monospace' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="#7a1e1e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Ranking de agentes</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0dcd8' }}>
              {['#', 'Agente', 'Departamento', 'Atendimentos'].map(c => (
                <th key={c} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: '#888480', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f0ede9' }}>
                <td style={{ padding: '8px', color: '#888480', fontFamily: 'DM Mono, monospace' }}>{i + 1}</td>
                <td style={{ padding: '8px', fontWeight: 500 }}>{r.agente.nome}</td>
                <td style={{ padding: '8px' }}><BadgeDepartamento departamento={r.agente.departamento} size="xs" /></td>
                <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: '#7a1e1e' }}>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -- Usuários Demo
function UsuariosDemo() {
  const [usuarios] = useState(mockAgentes)
  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%', background: '#f2f2f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 22, fontWeight: 700, margin: 0 }}>Usuários</h1>
        <button style={{ padding: '8px 18px', background: '#7a1e1e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          + Novo usuário
        </button>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0dcd8', background: '#f7f6f4' }}>
              {['Nome', 'E-mail', 'Departamento', 'Role', 'Status', ''].map(c => (
                <th key={c} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, color: '#888480', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0ede9', opacity: u.ativo ? 1 : 0.5 }}>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.nome}</td>
                <td style={{ padding: '10px 14px', color: '#888480', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{u.email}</td>
                <td style={{ padding: '10px 14px' }}><BadgeDepartamento departamento={u.departamento} size="xs" /></td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: u.role === 'ADMIN' ? '#7a1e1e' : '#888480', background: u.role === 'ADMIN' ? '#f0e8e8' : '#f7f6f4', border: `1px solid ${u.role === 'ADMIN' ? '#e0cece' : '#e0dcd8'}`, borderRadius: 4, padding: '2px 8px' }}>{u.role}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: 11, color: u.ativo ? '#2d7a4f' : '#888480' }}>{u.ativo ? '● Ativo' : '○ Inativo'}</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #e0dcd8', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#888480', fontFamily: 'DM Sans, sans-serif' }}>
                    {u.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// -- Sidebar + Header
function BotaoAcao({ label, onClick, danger, active }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', border: `1px solid ${danger ? '#b83232' : active ? '#7a1e1e' : '#e0dcd8'}`, borderRadius: 6, background: danger ? '#b83232' : active ? '#f0e8e8' : '#fff', color: danger ? '#fff' : active ? '#7a1e1e' : '#1a1a1a', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
      {label}
    </button>
  )
}

function Sidebar() {
  const navStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px',
    borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 500,
    color: isActive ? '#7a1e1e' : '#888480',
    background: isActive ? '#f0e8e8' : 'transparent',
    margin: '1px 0',
  })
  return (
    <div style={{ width: 200, borderRight: '1px solid #e0dcd8', background: '#f7f6f4', display: 'flex', flexDirection: 'column', padding: '12px 8px', height: '100%' }}>
      <div style={{ padding: '6px 8px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#7a1e1e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>SCONT</div>
        <div style={{ fontSize: 11, color: '#888480' }}>Portal CRM · DEMO</div>
      </div>
      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#c5c0ba', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 6px' }}>Atendimento</div>
        <NavLink to="/crm" style={navStyle}><MessageSquare size={15} /> WhatsApp CRM</NavLink>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#c5c0ba', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 8px 6px' }}>Administração</div>
        <NavLink to="/crm/metricas" style={navStyle}><BarChart2 size={15} /> Métricas</NavLink>
        <NavLink to="/crm/usuarios" style={navStyle}><Users size={15} /> Usuários</NavLink>
      </nav>
      <div style={{ padding: '8px 13px', fontSize: 12, color: '#888480', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#f0e8e8', color: '#7a1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11 }}>H</div>
        Herbert · Admin
      </div>
    </div>
  )
}

// ============================================================
// DemoApp root
// ============================================================
export default function DemoApp() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Header SCONT */}
        <header style={{ height: 52, background: '#7a1e1e', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
          <MessageSquare size={18} color="#fff" />
          <span style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>SCONT</span>
          <span style={{ color: '#f0e8e8', fontSize: 13, opacity: 0.7 }}>— CRM WhatsApp</span>
          <div style={{ flex: 1 }} />
          <span style={{ background: '#9b2c2c', color: '#fce8e8', fontSize: 11, padding: '3px 10px', borderRadius: 9999, fontWeight: 500 }}>MODO DEMO</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#9b2c2c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>H</div>
            <span style={{ fontSize: 13, color: '#f0e8e8' }}>Herbert</span>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Sidebar />
          <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/crm" replace />} />
              <Route path="/crm" element={<CRMPageDemo />} />
              <Route path="/crm/metricas" element={<MetricasDemo />} />
              <Route path="/crm/usuarios" element={<UsuariosDemo />} />
              <Route path="*" element={<Navigate to="/crm" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
