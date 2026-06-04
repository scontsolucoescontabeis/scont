import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BadgeDepartamento } from '../shared/BadgeDepartamento'
import { BadgeStatus } from '../shared/BadgeStatus'
import { Protocolo } from '../shared/Protocolo'

function Avatar({ nome }) {
  const inicial = (nome || '?')[0].toUpperCase()
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: '#f0e8e8',
        color: '#7a1e1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: 16,
        flexShrink: 0,
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {inicial}
    </div>
  )
}

export function ConversaCard({ conversa, ativa, onClick }) {
  const nomeContato = conversa.contatos?.nome || conversa.contatos?.telefone || 'Desconhecido'
  const preview = conversa._ultimaMensagem?.conteudo || ''
  const timestamp = conversa.atualizado_em || conversa.criado_em

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '12px 16px',
        background: ativa ? '#f0e8e8' : '#ffffff',
        borderLeft: ativa ? '3px solid #7a1e1e' : '3px solid transparent',
        borderBottom: '1px solid #e0dcd8',
        cursor: 'pointer',
        transition: 'background 0.15s',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
      onMouseEnter={e => { if (!ativa) e.currentTarget.style.background = '#faf9f7' }}
      onMouseLeave={e => { if (!ativa) e.currentTarget.style.background = '#ffffff' }}
    >
      {/* Avatar */}
      <Avatar nome={nomeContato} />

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
          <span style={{
            fontWeight: 600,
            fontSize: 14,
            color: '#1a1a1a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {nomeContato}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {conversa.nao_lidas > 0 && (
              <span style={{
                background: '#7a1e1e',
                color: '#fff',
                borderRadius: '9999px',
                fontSize: 11,
                fontWeight: 700,
                minWidth: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                fontFamily: 'DM Mono, monospace',
              }}>
                {conversa.nao_lidas}
              </span>
            )}
            <span style={{ fontSize: 11, color: '#888480', whiteSpace: 'nowrap', fontFamily: 'DM Mono, monospace' }}>
              {timestamp ? formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: ptBR }) : ''}
            </span>
          </div>
        </div>

        {/* Prévia da última mensagem */}
        <p style={{
          fontSize: 13,
          color: '#888480',
          margin: '2px 0 6px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {preview || 'Sem mensagens'}
        </p>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <BadgeDepartamento departamento={conversa.departamento} size="xs" />
          <BadgeStatus status={conversa.status} size="xs" />
          <Protocolo protocolo={conversa.protocolo} size="xs" />
        </div>
      </div>
    </button>
  )
}
