export function Protocolo({ protocolo, size = 'sm' }) {
  if (!protocolo) return null
  return (
    <span
      style={{
        fontFamily: 'DM Mono, monospace',
        fontSize: size === 'xs' ? '10px' : '11px',
        color: '#888480',
        background: '#f7f6f4',
        border: '1px solid #e0dcd8',
        borderRadius: '4px',
        padding: '1px 6px',
        letterSpacing: '0.02em',
      }}
    >
      {protocolo}
    </span>
  )
}
