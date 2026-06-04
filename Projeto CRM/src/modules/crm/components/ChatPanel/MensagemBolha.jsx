import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { FileText, Headphones, Image, Video } from 'lucide-react'

function IconMidia({ tipo }) {
  if (tipo === 'image')    return <Image size={14} />
  if (tipo === 'audio')    return <Headphones size={14} />
  if (tipo === 'document') return <FileText size={14} />
  if (tipo === 'video')    return <Video size={14} />
  return null
}

export function MensagemBolha({ mensagem }) {
  const isCliente = mensagem.origem === 'CLIENTE'
  const isSistema = mensagem.origem === 'SISTEMA' || mensagem.origem === 'BOT'

  const hora = mensagem.timestamp
    ? format(new Date(mensagem.timestamp), 'HH:mm', { locale: ptBR })
    : ''

  // Mensagem de sistema — centralizada
  if (isSistema) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
        <span style={{
          fontSize: 12,
          color: '#888480',
          fontStyle: 'italic',
          background: '#f7f6f4',
          border: '1px solid #e0dcd8',
          borderRadius: 12,
          padding: '3px 12px',
        }}>
          {mensagem.conteudo}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: isCliente ? 'flex-start' : 'flex-end',
      margin: '4px 0',
    }}>
      <div style={{
        maxWidth: '68%',
        background: isCliente ? '#f3f3f1' : '#f0e8e8',
        borderRadius: isCliente ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
        padding: '8px 12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}>
        {/* Mídia */}
        {mensagem.tipo !== 'text' && mensagem.media_url && (
          <div style={{ marginBottom: 6 }}>
            {mensagem.tipo === 'image' && (
              <img
                src={mensagem.media_url}
                alt="imagem"
                style={{ maxWidth: '100%', borderRadius: 6, display: 'block' }}
              />
            )}
            {mensagem.tipo === 'audio' && (
              <audio controls src={mensagem.media_url} style={{ width: '100%' }} />
            )}
            {(mensagem.tipo === 'document' || mensagem.tipo === 'video') && (
              <a
                href={mensagem.media_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#7a1e1e',
                  fontSize: 13,
                  textDecoration: 'none',
                }}
              >
                <IconMidia tipo={mensagem.tipo} />
                Abrir {mensagem.tipo === 'document' ? 'documento' : 'vídeo'}
              </a>
            )}
          </div>
        )}

        {/* Texto */}
        {mensagem.conteudo && (
          <p style={{
            margin: 0,
            fontSize: 14,
            color: '#1a1a1a',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5,
          }}>
            {mensagem.conteudo}
          </p>
        )}

        {/* Hora + nome do agente */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 6,
          marginTop: 4,
          alignItems: 'center',
        }}>
          {!isCliente && mensagem.agente?.nome && (
            <span style={{ fontSize: 11, color: '#9b2c2c' }}>{mensagem.agente.nome}</span>
          )}
          <span style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace' }}>{hora}</span>
        </div>
      </div>
    </div>
  )
}
