import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Lock, FileText, Volume2, Video } from 'lucide-react'

export function MessageBubble({ item }) {
  const hora = format(new Date(item.criado_em), 'HH:mm', { locale: ptBR })
  const isAnotacao = item._tipo === 'anotacao'

  // Anotação interna — fundo amarelo suave com cadeado
  if (isAnotacao) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px' }}>
        <div style={{
          maxWidth: '70%',
          background: '#fef9c3',
          border: '1px solid #fde047',
          borderRadius: 8,
          padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <Lock size={11} color="#92400e" />
            <span style={{ fontSize: 10, fontWeight: 600, color: '#92400e' }}>
              Nota interna — {item.usuarios?.nome}
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#1a1a1a', margin: 0, whiteSpace: 'pre-wrap' }}>{item.conteudo}</p>
          <p style={{ fontSize: 10, color: '#888480', margin: '4px 0 0', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{hora}</p>
        </div>
      </div>
    )
  }

  const { origem, tipo, conteudo, media_url, usuarios: agente } = item

  // Mensagem de sistema / bot — texto centralizado itálico
  if (origem === 'SISTEMA' || origem === 'BOT') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 16px' }}>
        <span style={{
          fontSize: 11, fontStyle: 'italic', color: '#888480',
          background: '#f7f6f4', padding: '3px 12px', borderRadius: 20,
        }}>
          {conteudo}
        </span>
      </div>
    )
  }

  const isAgente = origem === 'AGENTE'

  return (
    <div style={{ display: 'flex', justifyContent: isAgente ? 'flex-end' : 'flex-start', padding: '3px 16px' }}>
      <div style={{
        maxWidth: '68%',
        background: isAgente ? '#f0e8e8' : '#fff',
        border: isAgente ? 'none' : '1px solid #e0dcd8',
        borderRadius: isAgente ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '8px 12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        {!isAgente && agente?.nome && (
          <p style={{ fontSize: 10, fontWeight: 600, color: '#7a1e1e', margin: '0 0 3px' }}>
            {agente.nome}
          </p>
        )}

        {tipo === 'image' && media_url && (
          <img src={media_url} alt="imagem" style={{ maxWidth: '100%', borderRadius: 6, marginBottom: 4, display: 'block' }} />
        )}

        {tipo === 'audio' && media_url && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Volume2 size={14} color="#888480" />
            <audio controls src={media_url} style={{ height: 28 }} />
          </div>
        )}

        {tipo === 'document' && (
          <a
            href={media_url ?? '#'}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7a1e1e', textDecoration: 'none', fontSize: 13, marginBottom: 4 }}
          >
            <FileText size={14} />
            {conteudo || 'Documento'}
          </a>
        )}

        {tipo === 'video' && media_url && (
          <video controls src={media_url} style={{ maxWidth: '100%', borderRadius: 6, marginBottom: 4 }} />
        )}

        {(tipo === 'text' || !media_url) && (
          <p style={{ fontSize: 13, color: '#1a1a1a', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {conteudo}
          </p>
        )}

        <p style={{
          fontSize: 10, color: '#888480', margin: '4px 0 0',
          textAlign: 'right', fontFamily: 'DM Mono, monospace',
        }}>
          {hora}
        </p>
      </div>
    </div>
  )
}
