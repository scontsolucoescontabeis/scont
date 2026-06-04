import { MessageSquare, LogOut } from 'lucide-react'

export default function SemAcessoPage({ email, onSair }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f2f0' }}>
      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 12, padding: '40px 36px', width: 400, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: '#f0e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <MessageSquare size={24} color="#7a1e1e" />
        </div>
        <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
          SCONT Messenger
        </h2>
        <p style={{ fontSize: 13, color: '#888480', marginBottom: 20, lineHeight: 1.6 }}>
          Sua conta <strong style={{ color: '#1a1a1a' }}>{email}</strong> ainda não tem acesso configurado ao CRM.
        </p>
        <div style={{ background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 8, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
            Para obter acesso:
          </p>
          <ol style={{ fontSize: 12, color: '#888480', margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
            <li>Solicite ao administrador do portal SCONT</li>
            <li>O administrador irá configurar seu departamento no painel</li>
            <li>Após a configuração, atualize esta página</li>
          </ol>
        </div>
        <button
          onClick={onSair}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888480', background: 'none', border: '1px solid #e0dcd8', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          <LogOut size={13} /> Sair
        </button>
      </div>
    </div>
  )
}
