const CONFIG = {
  PESSOAL:        { label: 'Pessoal',        bg: '#EFF6FF', color: '#3B82F6', border: '#BFDBFE' },
  CONTABIL:       { label: 'Contábil',       bg: '#ECFDF5', color: '#10B981', border: '#A7F3D0' },
  ADMINISTRATIVO: { label: 'Administrativo', bg: '#FFFBEB', color: '#F59E0B', border: '#FDE68A' },
  TRIBUTARIO:     { label: 'Tributário',     bg: '#F5F3FF', color: '#8B5CF6', border: '#DDD6FE' },
}

export function BadgeDepartamento({ departamento, size = 'sm' }) {
  const cfg = CONFIG[departamento] || { label: departamento, bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' }
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
