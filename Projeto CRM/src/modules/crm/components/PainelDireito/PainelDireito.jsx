import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'
import { DadosContato } from './DadosContato'
import { TimelineConversa } from './TimelineConversa'
import { BadgeStatus } from '../shared/BadgeStatus'
import { useCRM } from '../../contexts/CRMContext'
import { buscarConversa, listarConversasAnteriores } from '../../services/crm.service'

export function PainelDireito() {
  const { conversaAtiva, selecionarConversa } = useCRM()
  const [detalhe, setDetalhe]                 = useState(null)
  const [historico, setHistorico]             = useState([])

  useEffect(() => {
    if (!conversaAtiva?.id) {
      setDetalhe(null)
      setHistorico([])
      return
    }

    buscarConversa(conversaAtiva.id).then(setDetalhe).catch(() => {})
  }, [conversaAtiva?.id])

  useEffect(() => {
    if (!detalhe?.contatos?.id) return
    listarConversasAnteriores(detalhe.contatos.id, detalhe.id)
      .then(setHistorico)
      .catch(() => {})
  }, [detalhe?.contatos?.id, detalhe?.id])

  if (!conversaAtiva) {
    return (
      <div style={{
        width: 280,
        borderLeft: '1px solid #e0dcd8',
        background: '#f7f6f4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#c5c0ba',
        fontSize: 13,
      }}>
        Selecione uma conversa
      </div>
    )
  }

  return (
    <div style={{
      width: 280,
      minWidth: 240,
      borderLeft: '1px solid #e0dcd8',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
    }}>
      {/* Dados do contato */}
      <DadosContato conversa={detalhe || conversaAtiva} />

      {/* Histórico de conversas anteriores */}
      {historico.length > 0 && (
        <div style={{ padding: '16px', borderTop: '1px solid #e0dcd8' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Atendimentos anteriores
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {historico.map(h => (
              <button
                key={h.id}
                onClick={() => selecionarConversa(h)}
                style={{
                  textAlign: 'left',
                  background: '#f7f6f4',
                  border: '1px solid #e0dcd8',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontFamily: 'DM Mono, monospace', color: '#888480' }}>
                    {h.protocolo}
                  </div>
                  <div style={{ fontSize: 11, color: '#888480', marginTop: 2 }}>
                    {h.criado_em ? format(new Date(h.criado_em), "dd/MM/yy", { locale: ptBR }) : ''}
                    {h.encerrado_em ? ` → ${format(new Date(h.encerrado_em), "dd/MM/yy", { locale: ptBR })}` : ''}
                  </div>
                </div>
                <BadgeStatus status={h.status} size="xs" />
                <ChevronRight size={12} style={{ color: '#c5c0ba', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline de transferências */}
      <TimelineConversa conversaId={conversaAtiva?.id} />
    </div>
  )
}
