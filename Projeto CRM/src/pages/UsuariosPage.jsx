import { useState, useEffect } from 'react'
import { Shield, Settings, UserX, UserCheck, X, Check } from 'lucide-react'
import { buscarTodosUsuariosPortal, configurarAcessoCRM, revogarAcessoCRM } from '@/services/crm.service'

const DEPTOS = [
  { value: 'PESSOAL',        label: 'Pessoal',        cor: '#1D4ED8', bg: '#EFF6FF' },
  { value: 'CONTABIL',       label: 'Contábil',       cor: '#065F46', bg: '#ECFDF5' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo', cor: '#92400E', bg: '#FFFBEB' },
  { value: 'TRIBUTARIO',     label: 'Tributário',     cor: '#5B21B6', bg: '#F5F3FF' },
]

const DEPTO_MAP = Object.fromEntries(DEPTOS.map(d => [d.value, d]))

function Badge({ depto }) {
  const d = DEPTO_MAP[depto]
  if (!d) return null
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
      background: d.bg, color: d.cor, whiteSpace: 'nowrap',
    }}>
      {d.label}
    </span>
  )
}

function ModalEdicao({ usuario, onSalvar, onFechar }) {
  const [deptos, setDeptos] = useState(
    usuario.departamentos?.length
      ? usuario.departamentos
      : usuario.departamento ? [usuario.departamento] : []
  )
  const [role, setRole] = useState(
    usuario.is_admin ? 'ADMIN' : (usuario.role ?? 'AGENTE')
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const toggleDepto = (v) =>
    setDeptos(prev => prev.includes(v) ? prev.filter(d => d !== v) : [...prev, v])

  const handleSalvar = async () => {
    if (!usuario.is_admin && !deptos.length) { setErro('Selecione ao menos um departamento.'); return }
    setSalvando(true)
    setErro('')
    try {
      const deptosEfetivos = usuario.is_admin ? DEPTOS.map(d => d.value) : deptos
      const roleEfetivo    = usuario.is_admin ? 'ADMIN' : role
      await configurarAcessoCRM(usuario.id, deptosEfetivos, roleEfetivo)
      onSalvar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        width: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              {usuario.is_admin && <Shield size={14} color="#7a1e1e" style={{ marginRight: 6, verticalAlign: 'middle' }} />}
              {usuario.nome}
            </h3>
            <p style={{ fontSize: 12, color: '#888480', margin: '3px 0 0' }}>{usuario.email}</p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        {/* Info admin */}
        {usuario.is_admin && (
          <div style={{ background: '#f0e8e8', border: '1px solid #e0c8c8', borderRadius: 6, padding: '8px 12px', marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: '#7a1e1e', margin: 0, fontWeight: 500 }}>
              🛡️ Administrador do portal — acesso Admin ao CRM em todos os departamentos automaticamente.
            </p>
          </div>
        )}

        {/* Departamentos */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
              Departamentos {!usuario.is_admin && <span style={{ color: '#b83232' }}>*</span>}
            </label>
            {!usuario.is_admin && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setDeptos(DEPTOS.map(d => d.value))}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#f7f6f4', cursor: 'pointer', color: '#888480' }}
                >
                  Todos
                </button>
                <button
                  onClick={() => setDeptos([])}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#f7f6f4', cursor: 'pointer', color: '#888480' }}
                >
                  Nenhum
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEPTOS.map(d => {
              const sel = usuario.is_admin || deptos.includes(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  disabled={usuario.is_admin}
                  onClick={() => toggleDepto(d.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                    border: `1.5px solid ${sel ? d.cor : '#e0dcd8'}`,
                    background: sel ? d.bg : '#fff',
                    cursor: usuario.is_admin ? 'default' : 'pointer',
                    opacity: usuario.is_admin ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 3,
                      border: `2px solid ${sel ? d.cor : '#c5c0ba'}`,
                      background: sel ? d.cor : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {sel && <Check size={10} color="#fff" strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: sel ? d.cor : '#888480' }}>
                      {d.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Role */}
        {!usuario.is_admin && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 8 }}>
              Perfil no CRM
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'AGENTE', label: 'Agente', desc: 'Atende conversas do departamento' },
                { value: 'ADMIN', label: 'Admin CRM', desc: 'Gerencia usuários e métricas' },
              ].map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                    border: `1.5px solid ${role === r.value ? '#7a1e1e' : '#e0dcd8'}`,
                    background: role === r.value ? '#f0e8e8' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: role === r.value ? '#7a1e1e' : '#1a1a1a' }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#888480', marginTop: 2 }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {erro && <p style={{ fontSize: 12, color: '#b83232', marginBottom: 12 }}>{erro}</p>}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onFechar} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #e0dcd8',
            background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={salvando} style={{
            padding: '8px 18px', borderRadius: 6, border: 'none',
            background: salvando ? '#c5c0ba' : '#7a1e1e',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: salvando ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}>
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────

export default function UsuariosPage() {
  const [usuarios, setUsuarios]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [editando, setEditando]   = useState(null)   // objeto usuario em edição
  const [busca, setBusca]         = useState('')

  const carregar = () => {
    setLoading(true)
    buscarTodosUsuariosPortal().then(u => { setUsuarios(u); setLoading(false) })
  }

  useEffect(() => { carregar() }, [])

  const handleRevogar = async (u) => {
    if (!confirm(`Remover acesso ao CRM de "${u.nome}"?`)) return
    await revogarAcessoCRM(u.id)
    carregar()
  }

  const filtrados = usuarios.filter(u => {
    if (!busca) return true
    const t = busca.toLowerCase()
    return u.nome?.toLowerCase().includes(t) || u.email?.toLowerCase().includes(t)
  })

  const semAcesso = filtrados.filter(u =>
    !u.is_admin && (!u.departamentos?.length && !u.departamento)
  )
  const comAcesso = filtrados.filter(u =>
    u.is_admin || u.departamentos?.length || u.departamento
  )

  const TH = ({ children }) => (
    <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700,
      color: '#888480', textTransform: 'uppercase', letterSpacing: '0.04em',
      borderBottom: '1px solid #e0dcd8', background: '#f7f6f4' }}>
      {children}
    </th>
  )

  const TD = ({ children, style }) => (
    <td style={{ padding: '10px 14px', borderBottom: '1px solid #e0dcd8', ...style }}>
      {children}
    </td>
  )

  return (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} color="#7a1e1e" />
          <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            Usuários — CRM Messenger
          </h2>
        </div>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          style={{ padding: '7px 12px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 12,
            outline: 'none', width: 220, fontFamily: 'DM Sans, sans-serif' }}
        />
      </div>
      <p style={{ fontSize: 12, color: '#888480', marginBottom: 24 }}>
        Configure departamentos e perfis de acesso dos usuários ao CRM.
        Administradores do portal (<Shield size={11} color="#7a1e1e" style={{ verticalAlign: 'middle' }} />) têm acesso Admin automático.
      </p>

      {/* Tabela: com acesso */}
      <Section title={`Com acesso ao CRM (${comAcesso.length})`} cor="#2d7a4f">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <TH>Usuário</TH><TH>E-mail</TH><TH>Departamentos</TH><TH>Perfil CRM</TH><TH>Status</TH><TH></TH>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><TD colSpan={6} style={{ textAlign: 'center', color: '#888480', fontSize: 13 }}>Carregando...</TD></tr>
            ) : comAcesso.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888480', fontSize: 13 }}>Nenhum usuário com acesso configurado.</td></tr>
            ) : comAcesso.map(u => {
              const deptos = u.departamentos?.length ? u.departamentos : (u.departamento ? [u.departamento] : [])
              return (
                <tr key={u.id}>
                  <TD style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
                    {u.is_admin && <Shield size={11} color="#7a1e1e" style={{ marginRight: 5, verticalAlign: 'middle' }} />}
                    {u.nome}
                  </TD>
                  <TD style={{ fontSize: 12, color: '#888480' }}>{u.email ?? '—'}</TD>
                  <TD>
                    {u.is_admin
                      ? <span style={{ fontSize: 10, color: '#888480', fontStyle: 'italic' }}>Todos os departamentos</span>
                      : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {deptos.map(d => <Badge key={d} depto={d} />)}
                        </div>
                    }
                  </TD>
                  <TD>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                      background: (u.is_admin || u.role === 'ADMIN') ? '#f0e8e8' : '#f7f6f4',
                      color: (u.is_admin || u.role === 'ADMIN') ? '#7a1e1e' : '#888480',
                    }}>
                      {u.is_admin ? 'Admin (portal)' : (u.role ?? 'AGENTE')}
                    </span>
                  </TD>
                  <TD>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
                      background: u.ativo !== false ? '#ECFDF5' : '#F3F4F6',
                      color: u.ativo !== false ? '#065F46' : '#888480',
                    }}>
                      {u.ativo !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </TD>
                  <TD style={{ whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => setEditando(u)}
                      title="Editar departamentos e perfil"
                      style={{ background: 'none', border: '1px solid #e0dcd8', borderRadius: 5,
                        cursor: 'pointer', padding: '4px 8px', marginRight: 4,
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888480' }}
                    >
                      <Settings size={12} /> Editar
                    </button>
                    {!u.is_admin && (
                      <button
                        onClick={() => handleRevogar(u)}
                        title="Revogar acesso ao CRM"
                        style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 5,
                          cursor: 'pointer', padding: '4px 8px',
                          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#b83232' }}
                      >
                        <UserX size={12} /> Revogar
                      </button>
                    )}
                  </TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      {/* Tabela: sem acesso */}
      {semAcesso.length > 0 && (
        <Section title={`Sem acesso ao CRM (${semAcesso.length})`} cor="#888480">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              <TH>Usuário</TH><TH>E-mail</TH><TH>Tipo no portal</TH><TH>Ação</TH>
            </tr></thead>
            <tbody>
              {semAcesso.map(u => (
                <tr key={u.id}>
                  <TD style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{u.nome}</TD>
                  <TD style={{ fontSize: 12, color: '#888480' }}>{u.email ?? '—'}</TD>
                  <TD>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: '#f7f6f4', color: '#888480', fontWeight: 600 }}>
                      Usuário portal
                    </span>
                  </TD>
                  <TD>
                    <button
                      onClick={() => setEditando({ ...u, departamentos: [], departamento: null, role: 'AGENTE' })}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        borderRadius: 5, border: '1px solid #2d7a4f', background: '#ECFDF5',
                        color: '#2d7a4f', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <UserCheck size={12} /> Conceder acesso
                    </button>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Modal de edição */}
      {editando && (
        <ModalEdicao
          usuario={editando}
          onSalvar={() => { setEditando(null); carregar() }}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function Section({ title, cor, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{
        fontSize: 12, fontWeight: 700, color: cor, textTransform: 'uppercase',
        letterSpacing: '0.05em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 3, height: 14, borderRadius: 2, background: cor, display: 'inline-block' }} />
        {title}
      </h3>
      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
