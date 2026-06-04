import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Lock } from 'lucide-react'

export function AnotacaoInterna({ anotacao }) {
  const hora = anotacao.timestamp
    ? format(new Date(anotacao.timestamp), 'HH:mm', { locale: ptBR })
    : ''

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
      <div style={{
        maxWidth: '72%',
        background: '#FEFCE8',
        border: '1px solid #FEF08A',
        borderRadius: 8,
        padding: '8px 12px',
        width: '100%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Lock size={12} style={{ color: '#854d0e' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#854d0e' }}>Nota interna</span>
          {anotacao.agente?.nome && (
            <span style={{ fontSize: 11, color: '#a16207' }}>· {anotacao.agente.nome}</span>
          )}
        </div>
        <p style={{
          margin: 0,
          fontSize: 13,
          color: '#713f12',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.5,
        }}>
          {anotacao.conteudo}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: '#a16207', fontFamily: 'DM Mono, monospace' }}>{hora}</span>
        </div>
      </div>
    </div>
  )
}
