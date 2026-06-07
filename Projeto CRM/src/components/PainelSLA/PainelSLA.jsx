const DEPTO_META = {
  PESSOAL:        { label: 'Pessoal',        color: '#1D4ED8' },
  CONTABIL:       { label: 'Contábil',       color: '#065F46' },
  ADMINISTRATIVO: { label: 'Administrativo', color: '#92400E' },
  TRIBUTARIO:     { label: 'Tributário',     color: '#5B21B6' },
}

const SLA_ORDER = { CRITICO: 0, VENCIDO: 1, AVISO: 2 }

function formatTimer(ms) {
  if (!ms || ms <= 0) return '00:00'
  const totalSec = Math.floor(ms / 1_000)
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0')
  const s = (totalSec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function PainelSLA({ alertas }) {
  if (!alertas?.length) return null

  const porDepto = {}
  Object.keys(DEPTO_META).forEach(d => {
    const items = alertas
      .filter(c => c.departamento === d)
      .sort((a, b) => (SLA_ORDER[a.sla_status] ?? 9) - (SLA_ORDER[b.sla_status] ?? 9))
    if (items.length) porDepto[d] = items
  })

  return (
    <div style={{
      background: '#fff7f7',
      borderBottom: '2px solid #f0e8e8',
      flexShrink: 0,
      overflowY: 'auto',
      maxHeight: 280,
    }}>
      {/* Header */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#fff0f0',
        borderBottom: '1px solid #fde8e8',
        position: 'sticky',
        top: 0,
      }}>
        <span style={{ fontSize: 11 }}>⚠️</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#b83232', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          SLA — Atenção
        </span>
        <span style={{
          marginLeft: 'auto',
          background: '#b83232',
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          padding: '1px 7px',
          borderRadius: 8,
        }}>
          {alertas.length}
        </span>
      </div>

      {/* Grupos por departamento */}
      {Object.entries(porDepto).map(([depto, items]) => {
        const dc = DEPTO_META[depto]
        return (
          <div key={depto} style={{ padding: '6px 10px 2px', borderBottom: '1px solid #fde8e8' }}>
            <div style={{
              fontSize: 8,
              fontWeight: 700,
              color: dc.color,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 4,
            }}>
              {dc.label}
            </div>

            {items.map(c => {
              const isCritico = c.sla_status === 'CRITICO'
              const isVencido = c.sla_status === 'VENCIDO'
              const accent = isCritico ? '#ef4444' : isVencido ? '#6b7280' : '#f59e0b'
              const nome = c.contatos?.nome || c.contatos?.telefone || 'Desconhecido'

              return (
                <div key={c.id} style={{
                  background: '#fff',
                  borderRadius: 5,
                  padding: '5px 8px',
                  marginBottom: 5,
                  borderLeft: `3px solid ${accent}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nome}
                    </div>
                    {c.contatos?.telefone && (
                      <div style={{ fontSize: 9, color: '#888480' }}>📞 {c.contatos.telefone}</div>
                    )}
                    <div style={{ fontSize: 9, color: '#c5c0ba', fontFamily: 'DM Mono, monospace' }}>
                      {c.protocolo}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    {isVencido ? (
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#6b7280' }}>VENCIDO</div>
                    ) : (
                      <div style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: accent,
                        fontFamily: 'DM Mono, monospace',
                        fontVariantNumeric: 'tabular-nums',
                        animation: isCritico ? 'sla-pulse 1s ease-in-out infinite' : 'none',
                      }}>
                        {formatTimer(c.sla_tempo_restante_ms)}
                      </div>
                    )}
                    <div style={{ fontSize: 7, color: accent, fontWeight: 700, letterSpacing: '0.04em' }}>
                      {c.sla_status}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
