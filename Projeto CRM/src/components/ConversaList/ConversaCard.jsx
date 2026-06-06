import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DEPTO_COLORS = {
  PESSOAL:        { bg: '#EFF6FF', text: '#1D4ED8' },
  CONTABIL:       { bg: '#ECFDF5', text: '#065F46' },
  ADMINISTRATIVO: { bg: '#FFFBEB', text: '#92400E' },
  TRIBUTARIO:     { bg: '#F5F3FF', text: '#5B21B6' },
}

const STATUS_LABELS = {
  ABERTA:          { label: 'Aberta',      bg: '#F3F4F6', text: '#374151' },
  EM_ATENDIMENTO:  { label: 'Atendendo',   bg: '#ECFDF5', text: '#065F46' },
  AGUARDANDO:      { label: 'Aguardando',  bg: '#FFFBEB', text: '#92400E' },
  ENCERRADA:       { label: 'Encerrada',   bg: '#FEF2F2', text: '#991B1B' },
}

export function ConversaCard({ conversa, ativo, onClick }) {
  const lastMsg = conversa.mensagens?.slice().sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))[0]
  const naoLidas = conversa.mensagens?.filter(m => !m.lida && m.origem === 'CLIENTE').length ?? 0
  const nome = conversa.contatos?.nome || conversa.contatos?.telefone || 'Desconhecido'
  const depto = DEPTO_COLORS[conversa.departamento] ?? { bg: '#F3F4F6', text: '#374151' }
  const st = STATUS_LABELS[conversa.status] ?? STATUS_LABELS.ABERTA

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: '1px solid #e0dcd8',
        background: ativo ? '#f0e8e8' : '#fff',
        cursor: 'pointer',
        transition: 'background 0.1s',
        display: 'block',
      }}
      onMouseEnter={e => { if (!ativo) e.currentTarget.style.background = '#f7f6f4' }}
      onMouseLeave={e => { if (!ativo) e.currentTarget.style.background = '#fff' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#f0e8e8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#7a1e1e',
          flexShrink: 0,
        }}>
          {nome[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Nome + hora */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nome}
            </span>
            <span style={{ fontSize: 10, color: '#888480', flexShrink: 0, marginLeft: 6, fontFamily: 'DM Mono, monospace' }}>
              {lastMsg ? formatDistanceToNow(new Date(lastMsg.criado_em), { locale: ptBR, addSuffix: false }) : ''}
            </span>
          </div>

          {/* Última mensagem + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#888480', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {lastMsg?.conteudo ?? 'Sem mensagens'}
            </span>
            {naoLidas > 0 && (
              <span style={{
                minWidth: 18, height: 18, borderRadius: 9,
                background: '#7a1e1e', color: '#fff',
                fontSize: 10, fontWeight: 700, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {naoLidas}
              </span>
            )}
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '2px 6px',
              borderRadius: 3, background: depto.bg, color: depto.text,
            }}>
              {conversa.departamento}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 500, padding: '2px 6px',
              borderRadius: 3, background: st.bg, color: st.text,
            }}>
              {st.label}
            </span>
            {/* Badge bot-roteado */}
            {conversa.bot_departamento && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '2px 6px',
                borderRadius: 3, background: '#e8f4fd', color: '#004085',
              }}>
                🤖 bot
              </span>
            )}
            {/* Badge de categoria */}
            {conversa.bot_categoria && (
              <span style={{
                fontSize: 9, fontWeight: 500, padding: '2px 6px',
                borderRadius: 3, background: '#fff3cd', color: '#856404',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80,
              }}>
                {conversa.bot_categoria}
              </span>
            )}
            <span style={{ fontSize: 9, color: '#c5c0ba', fontFamily: 'DM Mono, monospace', marginLeft: 'auto' }}>
              {conversa.protocolo}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
