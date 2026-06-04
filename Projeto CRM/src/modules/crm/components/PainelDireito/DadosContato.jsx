import { Phone, Building2, User } from 'lucide-react'
import { Protocolo } from '../shared/Protocolo'
import { BadgeDepartamento } from '../shared/BadgeDepartamento'

function AvatarGrande({ nome }) {
  const inicial = (nome || '?')[0].toUpperCase()
  return (
    <div style={{
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: '#f0e8e8',
      color: '#7a1e1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 22,
      fontFamily: 'DM Sans, sans-serif',
      border: '2px solid #e0dcd8',
    }}>
      {inicial}
    </div>
  )
}

export function DadosContato({ conversa }) {
  if (!conversa) return null

  const contato = conversa.contatos
  const agente  = conversa.agente

  return (
    <div style={{ padding: '16px', borderBottom: '1px solid #e0dcd8' }}>
      {/* Avatar + nome */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <AvatarGrande nome={contato?.nome} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1a1a', marginBottom: 2 }}>
            {contato?.nome || 'Sem nome'}
          </div>
          {contato?.empresa && (
            <div style={{ fontSize: 12, color: '#888480', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={11} />
              {contato.empresa}
            </div>
          )}
        </div>
      </div>

      {/* Dados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {contato?.telefone && (
          <Row icon={<Phone size={12} />} label="Telefone">
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{contato.telefone}</span>
          </Row>
        )}

        <Row icon={<User size={12} />} label="Agente">
          {agente ? (
            <span style={{ fontSize: 12, color: '#1a1a1a' }}>{agente.nome}</span>
          ) : (
            <span style={{ fontSize: 12, color: '#888480' }}>Sem agente</span>
          )}
        </Row>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
          <BadgeDepartamento departamento={conversa.departamento} size="xs" />
          <Protocolo protocolo={conversa.protocolo} size="xs" />
        </div>
      </div>

      {/* Observações */}
      {contato?.observacoes && (
        <div style={{
          marginTop: 12,
          padding: '8px 10px',
          background: '#f7f6f4',
          borderRadius: 6,
          border: '1px solid #e0dcd8',
          fontSize: 12,
          color: '#888480',
          lineHeight: 1.5,
        }}>
          {contato.observacoes}
        </div>
      )}
    </div>
  )
}

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: '#888480', display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ fontSize: 11, color: '#888480', minWidth: 56 }}>{label}</span>
      {children}
    </div>
  )
}
