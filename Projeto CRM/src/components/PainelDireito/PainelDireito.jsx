import { useState, useEffect } from 'react'
import { Phone, Building2, User, ArrowRightLeft, Clock, ChevronDown, ChevronUp } from 'lucide-react'
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

  useEffect(() => {
    if (!conversa?.contatos?.id) { setHistorico([]); setTransferencias([]); return }

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
  }, [conversa?.id, conversa?.contatos?.id])

  if (!conversa) return (
    <div style={{ width: 260, borderLeft: '1px solid #e0dcd8', background: '#f7f6f4' }} />
  )

  const contato = conversa.contatos
  const agente = conversa.usuarios
  const nome = contato?.nome || contato?.telefone || 'Desconhecido'

  return (
    <div style={{
      width: 260,
      borderLeft: '1px solid #e0dcd8',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flexShrink: 0,
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
        {contato?.empresa && (
          <div style={{ fontSize: 11, color: '#888480', marginTop: 3 }}>{contato.empresa}</div>
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

      {/* Dados do contato */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0dcd8' }}>
        <SectionTitle>Contato</SectionTitle>
        <InfoRow icon={<Phone size={12} />} label="Telefone" value={contato?.telefone} />
        {contato?.empresa && <InfoRow icon={<Building2 size={12} />} label="Empresa" value={contato.empresa} />}
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
