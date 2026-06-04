import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRightLeft, Clock } from 'lucide-react'
import { listarTransferencias } from '../../services/crm.service'

const NOMES_DEPTO = {
  PESSOAL: 'Pessoal',
  CONTABIL: 'Contábil',
  ADMINISTRATIVO: 'Administrativo',
  TRIBUTARIO: 'Tributário',
}

export function TimelineConversa({ conversaId }) {
  const [transferencias, setTransferencias] = useState([])

  useEffect(() => {
    if (!conversaId) return
    listarTransferencias(conversaId).then(setTransferencias).catch(() => {})
  }, [conversaId])

  if (transferencias.length === 0) return null

  return (
    <div style={{ padding: '16px', borderTop: '1px solid #e0dcd8' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Histórico de transferências
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {transferencias.map(t => (
          <div key={t.id} style={{
            background: '#f7f6f4',
            border: '1px solid #e0dcd8',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <ArrowRightLeft size={11} style={{ color: '#7a1e1e' }} />
              <span style={{ fontWeight: 500, color: '#1a1a1a' }}>
                {NOMES_DEPTO[t.de_departamento] || t.de_departamento}
                {' → '}
                {NOMES_DEPTO[t.para_departamento] || t.para_departamento}
              </span>
            </div>

            {t.motivo && (
              <p style={{ margin: '2px 0', color: '#888480', lineHeight: 1.4 }}>{t.motivo}</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#aaa49f', marginTop: 3 }}>
              <Clock size={10} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                {format(new Date(t.timestamp), "dd/MM HH:mm", { locale: ptBR })}
              </span>
              {t.de_agente?.nome && (
                <span style={{ fontSize: 10 }}>· por {t.de_agente.nome}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
