import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { listarAgentes } from '../services/crm.service'
import { BadgeDepartamento } from '../components/shared/BadgeDepartamento'

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #e0dcd8',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
  boxSizing: 'border-box',
}

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [form, setForm]         = useState({ nome: '', email: '', departamento: 'PESSOAL', role: 'AGENTE' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')

  const carregar = () => {
    setLoading(true)
    listarAgentes()
      .then(setUsuarios)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregar() }, [])

  const handleSalvar = async () => {
    setErro('')
    if (!form.nome || !form.email) {
      setErro('Nome e e-mail são obrigatórios')
      return
    }

    setSalvando(true)
    try {
      // Cria usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin
        ? supabase.auth.admin.createUser({ email: form.email, password: Math.random().toString(36).slice(2, 10), email_confirm: true })
        : { data: null, error: { message: 'Uso supabase.auth.admin requer service_role — criar usuário pelo dashboard.' } }

      if (authError) {
        setErro(authError.message)
        return
      }

      // Insere na tabela usuarios
      await supabase.from('usuarios').insert({
        auth_id:    authData?.user?.id,
        nome:       form.nome,
        email:      form.email,
        departamento: form.departamento,
        role:       form.role,
      })

      setModalAberto(false)
      setForm({ nome: '', email: '', departamento: 'PESSOAL', role: 'AGENTE' })
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtivo = async (usuario) => {
    await supabase
      .from('usuarios')
      .update({ ativo: !usuario.ativo })
      .eq('id', usuario.id)
    carregar()
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', background: '#f2f2f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Usuários
        </h1>
        <button
          onClick={() => setModalAberto(true)}
          style={{
            padding: '8px 18px',
            background: '#7a1e1e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          + Novo usuário
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#888480', fontSize: 13 }}>Carregando...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0dcd8', background: '#f7f6f4' }}>
                {['Nome', 'E-mail', 'Departamento', 'Role', 'Status', ''].map(col => (
                  <th key={col} style={{
                    textAlign: 'left', padding: '10px 14px', fontSize: 11,
                    color: '#888480', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f0ede9', opacity: u.ativo ? 1 : 0.5 }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.nome}</td>
                  <td style={{ padding: '10px 14px', color: '#888480', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{u.email}</td>
                  <td style={{ padding: '10px 14px' }}><BadgeDepartamento departamento={u.departamento} size="xs" /></td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: u.role === 'ADMIN' ? '#7a1e1e' : '#888480',
                      background: u.role === 'ADMIN' ? '#f0e8e8' : '#f7f6f4',
                      border: `1px solid ${u.role === 'ADMIN' ? '#e0cece' : '#e0dcd8'}`,
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 11, color: u.ativo ? '#2d7a4f' : '#888480' }}>
                      {u.ativo ? '● Ativo' : '○ Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => handleToggleAtivo(u)}
                      style={{
                        fontSize: 11, padding: '3px 10px',
                        border: '1px solid #e0dcd8', borderRadius: 4,
                        background: '#fff', cursor: 'pointer', color: '#888480',
                        fontFamily: 'DM Sans, sans-serif',
                      }}
                    >
                      {u.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal novo usuário */}
      {modalAberto && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: '#fff', borderRadius: 10, width: 420, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Novo usuário</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>
                Nome *
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 500 }}>
                E-mail *
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <label style={{ fontSize: 12, fontWeight: 500 }}>
                Departamento
                <select value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }}>
                  {DEPTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 500 }}>
                Role
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ ...inputStyle, marginTop: 4 }}>
                  <option value="AGENTE">AGENTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>

              {erro && <p style={{ color: '#b83232', fontSize: 12, margin: 0 }}>{erro}</p>}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setModalAberto(false)} style={{ padding: '8px 18px', border: '1px solid #e0dcd8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 6, background: '#7a1e1e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
