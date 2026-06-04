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
  const [editando, setEditando] = useState(null)
  const [editDeptos, setEditDeptos] = useState([])     // array multi-select
  const [editRole, setEditRole] = useState('AGENTE')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = () => {
    setLoading(true)
    buscarTodosUsuariosPortal().then(u => { setUsuarios(u); setLoading(false) })
  }

  useEffect(() => { carregar() }, [])

  const toggleDepto = (depto) => {
    setEditDeptos(prev =>
      prev.includes(depto) ? prev.filter(d => d !== depto) : [...prev, depto]
    )
  }

  const handleConfigurar = async (u) => {
    if (!editDeptos.length && !u.is_admin) { setErro('Selecione ao menos um departamento.'); return }
    setErro('')
    setSalvando(true)
    try {
      const roleEfetivo = u.is_admin ? 'ADMIN' : editRole
      // Admin portal → todos os deptos implícitos via role; não forçar array
      const deptos = u.is_admin ? (editDeptos.length ? editDeptos : DEPTOS) : editDeptos
      await configurarAcessoCRM(u.id, deptos, roleEfetivo)
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

  const semAcesso = usuarios.filter(u => !u.is_admin && (!u.departamentos || !u.departamentos.length))
  const comAcesso = usuarios.filter(u => u.is_admin || (u.departamentos && u.departamentos.length > 0))

  const DeptosBadges = ({ deptos = [] }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {deptos.map(d => (
        <span key={d} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: `${DEPTO_COLORS[d]}18`, color: DEPTO_COLORS[d] ?? '#374151' }}>
          {d}
        </span>
      ))}
    </div>
  )

  const CheckboxDeptos = ({ selectedDeptos, isAdmin }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {isAdmin && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888480', fontStyle: 'italic' }}>
          <input type="checkbox" checked disabled style={{ width: 14, height: 14 }} />
          Todos (admin)
        </label>
      )}
      {!isAdmin && DEPTOS.map(d => (
        <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer',
          padding: '3px 8px', borderRadius: 4, border: '1px solid',
          borderColor: editDeptos.includes(d) ? DEPTO_COLORS[d] : '#e0dcd8',
          background: editDeptos.includes(d) ? `${DEPTO_COLORS[d]}15` : '#fff',
          color: editDeptos.includes(d) ? DEPTO_COLORS[d] : '#888480',
        }}>
          <input type="checkbox" checked={editDeptos.includes(d)} onChange={() => toggleDepto(d)}
            style={{ width: 13, height: 13, accentColor: DEPTO_COLORS[d], cursor: 'pointer' }} />
          {d[0] + d.slice(1).toLowerCase()}
        </label>
      ))}
    </div>
  )

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <CheckboxDeptos selectedDeptos={editDeptos} isAdmin={u.is_admin} />
                          {!u.is_admin && (
                            <select value={editRole} onChange={e => setEditRole(e.target.value)} style={selectStyle}>
                              <option value="AGENTE">Agente</option>
                              <option value="ADMIN">Admin CRM</option>
                            </select>
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleConfigurar(u)} disabled={(!editDeptos.length && !u.is_admin) || salvando}
                              style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: (!editDeptos.length && !u.is_admin) ? '#c5c0ba' : '#2d7a4f', color: '#fff', fontSize: 11, fontWeight: 600, cursor: (!editDeptos.length && !u.is_admin) ? 'not-allowed' : 'pointer' }}>
                              {salvando ? '...' : 'Confirmar'}
                            </button>
                            <button onClick={() => setEditando(null)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#fff', color: '#888480', fontSize: 11, cursor: 'pointer' }}>
                              Cancelar
                            </button>
                          </div>
                          {erro && editando === u.id && <p style={{ fontSize: 11, color: '#b83232', margin: 0 }}>{erro}</p>}
                        </div>
                      ) : (
                        <button onClick={() => { setEditando(u.id); setEditDeptos([]); setEditRole('AGENTE'); setErro('') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4, border: '1px solid #2d7a4f', background: '#ECFDF5', color: '#2d7a4f', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          <UserCheck size={12} /> Conceder acesso
                        </button>
                      )}
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <CheckboxDeptos selectedDeptos={editDeptos} isAdmin={u.is_admin} />
                        {!u.is_admin && (
                          <select value={editRole} onChange={e => setEditRole(e.target.value)} style={selectStyle}>
                            <option value="AGENTE">Agente</option>
                            <option value="ADMIN">Admin CRM</option>
                          </select>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleConfigurar(u)} disabled={salvando}
                            style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#7a1e1e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            {salvando ? '...' : 'Salvar'}
                          </button>
                          <button onClick={() => setEditando(null)}
                            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#fff', color: '#888480', fontSize: 11, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      u.is_admin
                        ? <span style={{ fontSize: 10, fontStyle: 'italic', color: '#888480' }}>Todos (admin)</span>
                        : <DeptosBadges deptos={u.departamentos ?? (u.departamento ? [u.departamento] : [])} />
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
                    <button onClick={() => { setEditando(u.id); setEditDeptos(u.departamentos ?? (u.departamento ? [u.departamento] : [])); setEditRole(u.role ?? 'AGENTE') }}
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
