const CONFIG = {
  ABERTA:         { label: 'Aberta',          bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
  EM_ATENDIMENTO: { label: 'Em atendimento',  bg: '#ECFDF5', color: '#2d7a4f', border: '#A7F3D0' },
  AGUARDANDO:     { label: 'Aguardando',      bg: '#FFFBEB', color: '#b87a00', border: '#FDE68A' },
  ENCERRADA:      { label: 'Encerrada',       bg: '#F9FAFB', color: '#9CA3AF', border: '#E5E7EB' },
}

export function BadgeStatus({ status, size = 'sm' }) {
  const cfg = CONFIG[status] || CONFIG.ABERTA
  const px = size === 'xs' ? '6px' : '10px'
  const py = size === 'xs' ? '1px' : '3px'
  const fs = size === 'xs' ? '10px' : '11px'

  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        padding: `${py} ${px}`,
        borderRadius: '9999px',
        fontSize: fs,
        fontWeight: 500,
        fontFamily: 'DM Sans, sans-serif',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {cfg.label}
    </span>
  )
}
