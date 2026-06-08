import { useState, useEffect } from 'react'
import { Phone, Building2, User, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabaseClient'

const DEPTO_COLORS = {
  PESSOAL:        '#1D4ED8',
  CONTABIL:       '#065F46',
  ADMINISTRATIVO: '#92400E',
  TRIBUTARIO:     '#5B21B6',
}

export function PainelDireito({ conversa }) {
  const [historico, setHistorico] = useState([])
  const [transferencias, setTransferencias] = useState([])
  const [expandHistorico, setExpandHistorico] = useState(false)
  const [botTranscript, setBotTranscript] = useState([])
  const [primeiraMsg, setPrimeiraMsg] = useState(null)
  const [handoffEm, setHandoffEm] = useState(null)
  const [expandTranscript, setExpandTranscript] = useState(true)
  const [empresasContato, setEmpresasContato] = useState([])

  useEffect(() => {
    if (!conversa?.contatos?.id) { setHistorico([]); setTransferencias([]); setEmpresasContato([]); return }

    supabase
      .from('conversas')
      .select('id, protocolo, status, departamento, aberto_em, encerrado_em')
      .eq('contato_id', conversa.contatos.id)
      .neq('id', conversa.id)
      .order('aberto_em', { ascending: false })
      .limit(5)
      .then(({ data }) => setHistorico(data ?? []))

    supabase
      .from('transferencias')
      .select('*, usuarios!de_agente_id(nome)')
      .eq('conversa_id', conversa.id)
      .order('criado_em', { ascending: true })
      .then(({ data }) => setTransferencias(data ?? []))

    supabase
      .from('contatos_empresas')
      .select('empresa, cargo')
      .eq('contato_id', conversa.contatos.id)
      .order('criado_em', { ascending: true })
      .then(({ data }) => setEmpresasContato(data ?? []))
  }, [conversa?.id, conversa?.contatos?.id])

  useEffect(() => {
    if (!conversa?.id || !conversa?.bot_departamento) {
      setBotTranscript([])
      setPrimeiraMsg(null)
      setHandoffEm(null)
      return
    }
    supabase
      .from('mensagens')
      .select('id, conteudo, origem, criado_em')
      .eq('conversa_id', conversa.id)
      .order('criado_em', { ascending: true })
      .then(({ data }) => {
        const msgs = data ?? []
        const sistemaIdx = msgs.findIndex(m => m.origem === 'SISTEMA')
        if (sistemaIdx === -1) {
          setBotTranscript(msgs.filter(m => m.origem === 'BOT' || m.origem === 'CLIENTE'))
          setPrimeiraMsg(null)
          setHandoffEm(null)
          return
        }
        setHandoffEm(msgs[sistemaIdx].criado_em)
        setBotTranscript(
          msgs.slice(0, sistemaIdx).filter(m => m.origem === 'BOT' || m.origem === 'CLIENTE')
        )
        setPrimeiraMsg(
          msgs.slice(sistemaIdx + 1).find(m => m.origem === 'CLIENTE') ?? null
        )
      })
  }, [conversa?.id, conversa?.bot_departamento])

  if (!conversa) return (
    <div style={{ flex: 1, background: '#f7f6f4', minHeight: 0 }} />
  )

  const contato = conversa.contatos
  const agente = conversa.usuarios
  const nome = contato?.nome || contato?.telefone || 'Desconhecido'

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Avatar + nome */}
      <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid #e0dcd8', textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#f0e8e8', color: '#7a1e1e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, margin: '0 auto 10px',
        }}>
          {nome[0]?.toUpperCase()}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{nome}</div>
        {empresasContato.length > 0 && (
          <div style={{ fontSize: 11, color: '#888480', marginTop: 3 }}>
            {empresasContato.map(e => e.empresa).join(' · ')}
          </div>
        )}
        <div style={{
          display: 'inline-block', marginTop: 6,
          background: DEPTO_COLORS[conversa.departamento] ? `${DEPTO_COLORS[conversa.departamento]}15` : '#f3f4f6',
          color: DEPTO_COLORS[conversa.departamento] ?? '#374151',
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
        }}>
          {conversa.departamento}
        </div>
      </div>

      {/* Contexto do bot */}
      {conversa.bot_departamento && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0dcd8',
          background: 'linear-gradient(135deg, #e8f4fd 0%, #f0e8ff 100%)' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: '#004085' }}>
              🤖 Contexto do bot
            </div>
            {handoffEm && (
              <div style={{ fontSize: 9, color: '#7a9fc0', fontFamily: 'DM Mono, monospace' }}>
                repasse {format(new Date(handoffEm), 'HH:mm')}
              </div>
            )}
          </div>

          {/* Empresa selecionada pelo bot */}
          {conversa.bot_empresa && (
            <div style={{ marginBottom: 10 }}>
              <span style={{
                background: '#1e3a5f', color: '#fff',
                fontSize: 10, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                🏢 {conversa.bot_empresa}
              </span>
              {conversa.bot_cnpj && (
                <div style={{
                  fontSize: 9, color: '#7a9fc0',
                  fontFamily: 'DM Mono, monospace', marginTop: 3,
                }}>
                  CNPJ {conversa.bot_cnpj}
                </div>
              )}
            </div>
          )}

          {/* Trilha dept › cat › sub */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3, marginBottom: 10 }}>
            <span style={{ background: '#004085', color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '2px 7px', borderRadius: 4 }}>
              {conversa.bot_departamento}
            </span>
            {conversa.bot_categoria && (
              <>
                <span style={{ color: '#7a9fc0', fontSize: 13 }}>›</span>
                <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: 10, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 4 }}>
                  {conversa.bot_categoria}
                </span>
              </>
            )}
            {conversa.bot_subcategoria && (
              <>
                <span style={{ color: '#7a9fc0', fontSize: 13 }}>›</span>
                <span style={{ background: '#ede9fe', color: '#5b21b6', fontSize: 10, fontWeight: 600,
                  padding: '2px 7px', borderRadius: 4 }}>
                  {conversa.bot_subcategoria}
                </span>
              </>
            )}
          </div>

          {/* Primeira mensagem livre do cliente */}
          {primeiraMsg && (
            <div style={{
              marginBottom: 10, padding: '7px 9px',
              background: '#dcf8c6', borderRadius: 6, fontSize: 11, color: '#1a1a1a',
              borderLeft: '3px solid #25d366',
            }}>
              <div style={{ fontSize: 9, color: '#2d6a2d', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                Primeira mensagem
              </div>
              {primeiraMsg.conteudo}
            </div>
          )}

          {/* Transcript colapsível */}
          {botTranscript.length > 0 && (
            <div>
              <button
                onClick={() => setExpandTranscript(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'rgba(0,64,133,0.08)', border: 'none',
                  borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
                  marginBottom: expandTranscript ? 6 : 0,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: '#004085' }}>
                  Transcript ({botTranscript.length} msgs)
                </span>
                {expandTranscript
                  ? <ChevronUp size={12} color="#004085" />
                  : <ChevronDown size={12} color="#004085" />}
              </button>
              {expandTranscript && (
                <div style={{
                  maxHeight: 220, overflowY: 'auto',
                  background: 'rgba(255,255,255,0.75)', borderRadius: 6,
                  padding: '6px 8px',
                }}>
                  {botTranscript.map(m => (
                    <div key={m.id} style={{
                      marginBottom: 5,
                      display: 'flex',
                      justifyContent: m.origem === 'CLIENTE' ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        maxWidth: '88%', fontSize: 11, lineHeight: 1.35,
                        padding: '4px 8px', borderRadius: 6, wordBreak: 'break-word',
                        background: m.origem === 'CLIENTE' ? '#dcf8c6' : '#fff',
                        border: m.origem === 'BOT' ? '1px solid #e0dcd8' : 'none',
                        color: '#1a1a1a',
                      }}>
                        {m.conteudo}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dados do contato */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0dcd8' }}>
        <SectionTitle>Contato</SectionTitle>
        <InfoRow icon={<Phone size={12} />} label="Telefone" value={contato?.telefone} />
        {empresasContato.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
            <span style={{ color: '#888480', marginTop: 1 }}><Building2 size={12} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#888480' }}>
                {empresasContato.length === 1 ? 'Empresa' : 'Empresas'}
              </div>
              {empresasContato.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: '#1a1a1a' }}>
                  {e.empresa}{e.cargo ? <span style={{ color: '#888480' }}> · {e.cargo}</span> : null}
                </div>
              ))}
            </div>
          </div>
        )}
        {agente && <InfoRow icon={<User size={12} />} label="Agente" value={agente.nome} />}
        <InfoRow
          icon={<Clock size={12} />}
          label="Protocolo"
          value={<span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{conversa.protocolo}</span>}
        />
        <InfoRow
          icon={<Clock size={12} />}
          label="Aberto em"
          value={format(new Date(conversa.aberto_em), "dd/MM/yy HH:mm", { locale: ptBR })}
        />
      </div>

      {/* Transferências */}
      {transferencias.length > 0 && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0dcd8' }}>
          <SectionTitle>Timeline de transferências</SectionTitle>
          {transferencias.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7a1e1e', marginTop: 2 }} />
                {i < transferencias.length - 1 && (
                  <div style={{ width: 1, flex: 1, background: '#e0dcd8', margin: '2px 0' }} />
                )}
              </div>
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ fontSize: 11, color: '#1a1a1a', fontWeight: 500 }}>
                  {t.de_departamento} → {t.para_departamento}
                </div>
                {t.motivo && <div style={{ fontSize: 10, color: '#888480' }}>{t.motivo}</div>}
                <div style={{ fontSize: 10, color: '#c5c0ba', fontFamily: 'DM Mono, monospace' }}>
                  {format(new Date(t.criado_em), 'dd/MM HH:mm')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Histórico de conversas */}
      {historico.length > 0 && (
        <div style={{ padding: '12px 16px' }}>
          <button
            onClick={() => setExpandHistorico(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, marginBottom: expandHistorico ? 8 : 0,
            }}
          >
            <SectionTitle style={{ margin: 0 }}>Histórico ({historico.length})</SectionTitle>
            {expandHistorico ? <ChevronUp size={13} color="#888480" /> : <ChevronDown size={13} color="#888480" />}
          </button>
          {expandHistorico && historico.map(h => (
            <div key={h.id} style={{
              padding: '6px 8px', borderRadius: 6, background: '#f7f6f4',
              marginBottom: 5, fontSize: 11,
            }}>
              <div style={{ fontFamily: 'DM Mono, monospace', color: '#7a1e1e', fontSize: 10 }}>{h.protocolo}</div>
              <div style={{ color: '#888480' }}>
                {format(new Date(h.aberto_em), 'dd/MM/yy', { locale: ptBR })} · {h.departamento}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children, style }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#888480',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      marginBottom: 8, ...style,
    }}>
      {children}
    </div>
  )
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
      <span style={{ color: '#888480', marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#888480' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#1a1a1a', wordBreak: 'break-all' }}>{value ?? '—'}</div>
      </div>
    </div>
  )
}
