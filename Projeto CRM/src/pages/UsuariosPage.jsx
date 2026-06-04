import { useState, useEffect } from 'react'
import { Shield, UserCheck, UserX, Settings } from 'lucide-react'
import { buscarTodosUsuariosPortal, configurarAcessoCRM, revogarAcessoCRM } from '@/services/crm.service'

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
const DEPTO_COLORS = {
  PESSOAL: '#1D4ED8', CONTABIL: '#065F46',
  ADMINISTRATIVO: '#92400E', TRIBUTARIO: '#5B21B6',
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)       // id do usuario em edição
  const [editDepto, setEditDepto] = useState('')
  const [editRole, setEditRole] = useState('AGENTE')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = () => {
    setLoading(true)
    buscarTodosUsuariosPortal().then(u => { setUsuarios(u); setLoading(false) })
  }

  useEffect(() => { carregar() }, [])

  const handleConfigurar = async (u) => {
    setErro('')
    setSalvando(true)
    try {
      // Portal admin sempre fica como ADMIN no CRM
      const roleEfetivo = u.is_admin ? 'ADMIN' : editRole
      await configurarAcessoCRM(u.id, editDepto, roleEfetivo)
      setEditando(null)
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const handleRevogar = async (id) => {
    if (!confirm('Remover acesso ao CRM deste usuário?')) return
    await revogarAcessoCRM(id)
    carregar()
  }

  const semAcesso = usuarios.filter(u => !u.departamento)
  const comAcesso = usuarios.filter(u => !!u.departamento)

  const selectStyle = { fontSize: 12, border: '1px solid #e0dcd8', borderRadius: 4, padding: '4px 8px', outline: 'none', background: '#fff' }

  return (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Settings size={18} color="#7a1e1e" />
        <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Configurações de Acesso — CRM
        </h2>
      </div>
      <p style={{ fontSize: 12, color: '#888480', marginBottom: 24 }}>
        Gerencie quais usuários do portal têm acesso ao CRM Messenger e seus departamentos.
        Administradores do portal (<Shield size={11} color="#7a1e1e" style={{ verticalAlign: 'middle' }} />) são automaticamente administradores do CRM.
      </p>

      {/* Usuários sem acesso ao CRM */}
      {semAcesso.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
            Sem acesso ao CRM ({semAcesso.length})
          </h3>
          <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f6f4' }}>
                  {['Usuário', 'E-mail', 'Tipo portal', 'Conceder acesso'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e0dcd8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semAcesso.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #e0dcd8' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
                      {u.is_admin && <Shield size={11} color="#7a1e1e" style={{ marginRight: 5, verticalAlign: 'middle' }} />}
                      {u.nome}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#888480' }}>{u.email ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: u.is_admin ? '#f0e8e8' : '#f7f6f4', color: u.is_admin ? '#7a1e1e' : '#888480' }}>
                        {u.is_admin ? 'Admin portal' : 'Usuário'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {editando === u.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select value={editDepto} onChange={e => setEditDepto(e.target.value)} style={selectStyle}>
                            <option value="">Departamento *</option>
                            {DEPTOS.map(d => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
                          </select>
                          {!u.is_admin && (
                            <select value={editRole} onChange={e => setEditRole(e.target.value)} style={selectStyle}>
                              <option value="AGENTE">Agente</option>
                              <option value="ADMIN">Admin CRM</option>
                            </select>
                          )}
                          <button
                            onClick={() => handleConfigurar(u)}
                            disabled={!editDepto || salvando}
                            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: !editDepto ? '#c5c0ba' : '#2d7a4f', color: '#fff', fontSize: 11, fontWeight: 600, cursor: !editDepto ? 'not-allowed' : 'pointer' }}
                          >
                            {salvando ? '...' : 'Confirmar'}
                          </button>
                          <button onClick={() => setEditando(null)}
                            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#fff', color: '#888480', fontSize: 11, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditando(u.id); setEditDepto(''); setEditRole('AGENTE'); setErro('') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4, border: '1px solid #2d7a4f', background: '#ECFDF5', color: '#2d7a4f', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          <UserCheck size={12} /> Conceder acesso
                        </button>
                      )}
                      {erro && editando === u.id && <p style={{ fontSize: 11, color: '#b83232', marginTop: 4 }}>{erro}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usuários com acesso ao CRM */}
      <div>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
          Com acesso ao CRM ({comAcesso.length})
        </h3>
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f7f6f4' }}>
                {['Usuário', 'E-mail', 'Departamento', 'Role CRM', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e0dcd8' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888480', fontSize: 13 }}>Carregando...</td></tr>
              ) : comAcesso.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888480', fontSize: 13 }}>Nenhum usuário com acesso ao CRM ainda.</td></tr>
              ) : comAcesso.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #e0dcd8' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>
                    {u.is_admin && <Shield size={11} color="#7a1e1e" style={{ marginRight: 5, verticalAlign: 'middle' }} />}
                    {u.nome}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#888480' }}>{u.email ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {editando === u.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={editDepto || u.departamento} onChange={e => setEditDepto(e.target.value)} style={selectStyle}>
                          {DEPTOS.map(d => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
                        </select>
                        {!u.is_admin && (
                          <select value={editRole || u.role || 'AGENTE'} onChange={e => setEditRole(e.target.value)} style={selectStyle}>
                            <option value="AGENTE">Agente</option>
                            <option value="ADMIN">Admin CRM</option>
                          </select>
                        )}
                        <button onClick={() => handleConfigurar(u)} disabled={salvando}
                          style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#7a1e1e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          {salvando ? '...' : 'Salvar'}
                        </button>
                        <button onClick={() => setEditando(null)}
                          style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#fff', color: '#888480', fontSize: 11, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: `${DEPTO_COLORS[u.departamento]}18`, color: DEPTO_COLORS[u.departamento] ?? '#374151' }}>
                        {u.departamento}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#888480' }}>
                    {u.is_admin ? 'Admin (portal)' : (u.role ?? 'AGENTE')}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3, background: u.ativo ? '#ECFDF5' : '#F3F4F6', color: u.ativo ? '#065F46' : '#888480' }}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', display: 'flex', gap: 4 }}>
                    <button onClick={() => { setEditando(u.id); setEditDepto(u.departamento); setEditRole(u.role ?? 'AGENTE') }}
                      title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <Settings size={14} color="#888480" />
                    </button>
                    {!u.is_admin && (
                      <button onClick={() => handleRevogar(u.id)} title="Revogar acesso CRM"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <UserX size={14} color="#b83232" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
