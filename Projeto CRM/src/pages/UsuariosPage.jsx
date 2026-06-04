import { useState, useEffect } from 'react'
import { Plus, UserCheck, UserX } from 'lucide-react'
import { buscarTodosAgentes } from '@/services/crm.service'
import { supabase } from '@/lib/supabaseClient'

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
const DEPTO_COLORS = {
  PESSOAL: '#1D4ED8', CONTABIL: '#065F46',
  ADMINISTRATIVO: '#92400E', TRIBUTARIO: '#5B21B6',
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', departamento: 'PESSOAL', role: 'AGENTE' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = () => {
    setLoading(true)
    buscarTodosAgentes().then(u => { setUsuarios(u); setLoading(false) })
  }

  useEffect(() => { carregar() }, [])

  const handleSalvar = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.senha,
        options: { data: { nome: form.nome } },
      })
      if (authError) throw authError

      const { error: profileError } = await supabase.from('usuarios').insert({
        id: authData.user.id,
        nome: form.nome,
        email: form.email,
        departamento: form.departamento,
        role: form.role,
      })
      if (profileError) throw profileError

      setMostrarForm(false)
      setForm({ nome: '', email: '', senha: '', departamento: 'PESSOAL', role: 'AGENTE' })
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const toggleAtivo = async (id, ativo) => {
    await supabase.from('usuarios').update({ ativo: !ativo }).eq('id', id)
    carregar()
  }

  const labelStyle = { fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 4 }
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13,
    outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }

  return (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Usuários do CRM
        </h2>
        <button
          onClick={() => setMostrarForm(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: '#7a1e1e', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <Plus size={14} />
          Novo Usuário
        </button>
      </div>

      {/* Formulário de novo usuário */}
      {mostrarForm && (
        <div style={{
          background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10,
          padding: 20, marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 16, marginTop: 0 }}>
            Novo Usuário
          </h3>
          <form onSubmit={handleSalvar}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Nome</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  required style={inputStyle} placeholder="Nome completo" />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required style={inputStyle} placeholder="email@scont.com.br" />
              </div>
              <div>
                <label style={labelStyle}>Senha inicial</label>
                <input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  required minLength={8} style={inputStyle} placeholder="Mínimo 8 caracteres" />
              </div>
              <div>
                <label style={labelStyle}>Departamento</label>
                <select value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} style={inputStyle}>
                  {DEPTOS.map(d => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Perfil</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
                  <option value="AGENTE">Agente</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            {erro && <p style={{ fontSize: 12, color: '#b83232', marginBottom: 8 }}>{erro}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setMostrarForm(false)}
                style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e0dcd8', background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={salvando}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: salvando ? '#c5c0ba' : '#7a1e1e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer' }}>
                {salvando ? 'Salvando...' : 'Criar Usuário'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de usuários */}
      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f7f6f4', borderBottom: '1px solid #e0dcd8' }}>
              {['Nome', 'E-mail', 'Departamento', 'Perfil', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888480', fontSize: 13 }}>Carregando...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#888480', fontSize: 13 }}>Nenhum usuário cadastrado</td></tr>
            ) : usuarios.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #e0dcd8' }}>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{u.nome}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#888480' }}>{u.email}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
                    background: `${DEPTO_COLORS[u.departamento]}18`, color: DEPTO_COLORS[u.departamento] ?? '#374151',
                  }}>
                    {u.departamento}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#888480' }}>{u.role}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 3,
                    background: u.ativo ? '#ECFDF5' : '#F3F4F6',
                    color: u.ativo ? '#065F46' : '#888480',
                  }}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    onClick={() => toggleAtivo(u.id, u.ativo)}
                    title={u.ativo ? 'Desativar' : 'Ativar'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    {u.ativo
                      ? <UserX size={14} color="#b83232" />
                      : <UserCheck size={14} color="#2d7a4f" />
                    }
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
