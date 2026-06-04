import { useState, useEffect } from 'react'
import { Plus, UserCheck, UserX, Bell, Check, X } from 'lucide-react'
import { buscarTodosAgentes } from '@/services/crm.service'
import { supabase } from '@/lib/supabaseClient'
import { useRealtime } from '@/hooks/useRealtime'

const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
const DEPTO_COLORS = {
  PESSOAL: '#1D4ED8', CONTABIL: '#065F46',
  ADMINISTRATIVO: '#92400E', TRIBUTARIO: '#5B21B6',
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [solicitacoes, setSolicitacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ email: '', nome: '', departamento: 'PESSOAL', role: 'AGENTE' })
  const [aprovando, setAprovando] = useState(null) // id da solicitação sendo aprovada
  const [aprovacaoDepto, setAprovacaoDepto] = useState('')
  const [aprovacaoRole, setAprovacaoRole] = useState('AGENTE')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const carregar = () => {
    setLoading(true)
    Promise.all([
      buscarTodosAgentes(),
      supabase.from('solicitacoes_acesso').select('*').eq('status', 'PENDENTE').order('criado_em'),
    ]).then(([agentes, { data: sols }]) => {
      setUsuarios(agentes)
      setSolicitacoes(sols ?? [])
      setLoading(false)
    })
  }

  useEffect(() => { carregar() }, [])

  // Atualiza lista em tempo real quando chega nova solicitação
  useRealtime({ onConversaAtualizada: null, onNovaMensagem: null })

  useEffect(() => {
    const channel = supabase
      .channel('solicitacoes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitacoes_acesso' }, carregar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const handleAprovar = async (sol) => {
    if (!aprovacaoDepto) return
    setSalvando(true)
    // 1. Cria perfil CRM para o usuário
    const { error: insertError } = await supabase.from('usuarios').insert({
      id:          sol.auth_user_id,
      nome:        sol.nome,
      email:       sol.email,
      departamento: aprovacaoDepto,
      role:        aprovacaoRole,
    })
    if (insertError && !insertError.message.includes('duplicate')) {
      setErro(insertError.message); setSalvando(false); return
    }
    // 2. Atualiza solicitação como aprovada
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('solicitacoes_acesso').update({
      status: 'APROVADA',
      respondido_em: new Date().toISOString(),
      respondido_por: user.id,
      role_aprovada: aprovacaoRole,
    }).eq('id', sol.id)

    setAprovando(null)
    setSalvando(false)
    carregar()
  }

  const handleRejeitar = async (solId, motivo = '') => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('solicitacoes_acesso').update({
      status: 'REJEITADA',
      respondido_em: new Date().toISOString(),
      respondido_por: user.id,
      motivo_recusa: motivo || null,
    }).eq('id', solId)
    carregar()
  }

  const handleSalvar = async (e) => {
    e.preventDefault()
    setErro('')
    setSucesso('')
    setSalvando(true)

    try {
      // Busca o UUID do usuário pelo e-mail na tabela auth.users via RPC pública
      // Como não temos acesso direto a auth.users pelo anon key, usamos uma abordagem
      // de tentativa de insert com ON CONFLICT — o admin precisa informar o UUID
      // OU o usuário faz login uma vez e o sistema detecta automaticamente

      // Estratégia: INSERT via upsert — se o email já existe em usuarios, atualiza
      const { error } = await supabase
        .from('usuarios')
        .upsert(
          {
            // id será null aqui — o admin precisa confirmar via SQL se não fizer login
            nome: form.nome,
            email: form.email,
            departamento: form.departamento,
            role: form.role,
          },
          { onConflict: 'email', ignoreDuplicates: false }
        )

      if (error) throw error

      setSucesso(`Perfil CRM configurado para ${form.email}. O usuário deve fazer login para ativar o acesso.`)
      setMostrarForm(false)
      setForm({ email: '', nome: '', departamento: 'PESSOAL', role: 'AGENTE' })
      carregar()
    } catch (err) {
      // Instrução alternativa quando não consegue resolver o UUID automaticamente
      setErro(
        'Não foi possível vincular automaticamente. Use o SQL abaixo no Supabase:\n\n' +
        `INSERT INTO usuarios (id, nome, email, departamento, role)\n` +
        `SELECT id, '${form.nome}', '${form.email}', '${form.departamento}', '${form.role}'\n` +
        `FROM auth.users WHERE email = '${form.email}'\n` +
        `ON CONFLICT (id) DO UPDATE SET departamento='${form.departamento}', role='${form.role}';`
      )
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          Usuários do CRM
        </h2>
        <button
          onClick={() => { setMostrarForm(v => !v); setErro(''); setSucesso('') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: '#7a1e1e', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <Plus size={14} />
          Adicionar ao CRM
        </button>
      </div>

      {/* Explicação */}
      <p style={{ fontSize: 12, color: '#888480', marginBottom: 20, marginTop: 0 }}>
        Usuários do portal já cadastrados no Supabase Auth. Defina departamento e perfil de acesso ao CRM.
      </p>

      {/* Solicitações pendentes */}
      {solicitacoes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Bell size={14} color="#b87a00" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              Solicitações pendentes ({solicitacoes.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {solicitacoes.map(sol => (
              <div key={sol.id} style={{
                background: '#FFFBEB', border: '1px solid #fde047',
                borderRadius: 8, padding: '12px 16px',
              }}>
                {aprovando === sol.id ? (
                  // Mini-form de aprovação
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 10, marginTop: 0 }}>
                      Aprovar acesso para <strong>{sol.nome}</strong> ({sol.email})
                    </p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={aprovacaoDepto}
                        onChange={e => setAprovacaoDepto(e.target.value)}
                        style={{ fontSize: 12, border: '1px solid #e0dcd8', borderRadius: 4, padding: '5px 8px', outline: 'none' }}
                      >
                        <option value="">Departamento *</option>
                        {DEPTOS.map(d => (
                          <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</option>
                        ))}
                      </select>
                      <select
                        value={aprovacaoRole}
                        onChange={e => setAprovacaoRole(e.target.value)}
                        style={{ fontSize: 12, border: '1px solid #e0dcd8', borderRadius: 4, padding: '5px 8px', outline: 'none' }}
                      >
                        <option value="AGENTE">Agente</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <button
                        onClick={() => handleAprovar(sol)}
                        disabled={!aprovacaoDepto || salvando}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 4, border: 'none', background: !aprovacaoDepto ? '#c5c0ba' : '#2d7a4f', color: '#fff', fontSize: 12, fontWeight: 600, cursor: !aprovacaoDepto ? 'not-allowed' : 'pointer' }}
                      >
                        <Check size={12} /> Confirmar
                      </button>
                      <button
                        onClick={() => setAprovando(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#fff', color: '#888480', fontSize: 12, cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{sol.nome}</span>
                      <span style={{ fontSize: 12, color: '#888480', marginLeft: 8 }}>{sol.email}</span>
                      <span style={{ fontSize: 11, background: '#f0e8e8', color: '#7a1e1e', borderRadius: 3, padding: '1px 6px', marginLeft: 8, fontWeight: 600 }}>
                        Solicitou: {sol.departamento}
                      </span>
                      {sol.justificativa && (
                        <div style={{ fontSize: 11, color: '#888480', marginTop: 3 }}>"{sol.justificativa}"</div>
                      )}
                    </div>
                    <button
                      onClick={() => { setAprovando(sol.id); setAprovacaoDepto(sol.departamento); setAprovacaoRole('AGENTE') }}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 4, border: 'none', background: '#2d7a4f', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                    >
                      <Check size={11} /> Aprovar
                    </button>
                    <button
                      onClick={() => handleRejeitar(sol.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 4, border: '1px solid #e0dcd8', background: '#fff', color: '#b83232', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
                    >
                      <X size={11} /> Recusar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário de vínculo manual */}
      {mostrarForm && (
        <div style={{
          background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10,
          padding: 20, marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4, marginTop: 0 }}>
            Vincular usuário do portal ao CRM
          </h3>
          <p style={{ fontSize: 11, color: '#888480', marginBottom: 14, marginTop: 0 }}>
            O e-mail deve pertencer a um usuário já cadastrado no Supabase Auth do portal.
          </p>
          <form onSubmit={handleSalvar}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>E-mail (cadastrado no portal)</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required style={inputStyle} placeholder="email@scont.com.br" />
              </div>
              <div>
                <label style={labelStyle}>Nome de exibição</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  required style={inputStyle} placeholder="Nome completo" />
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

            {/* Instrução SQL alternativa */}
            {erro && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: '#b83232', marginBottom: 6 }}>
                  Use o SQL abaixo no Supabase SQL Editor:
                </p>
                <pre style={{
                  fontSize: 11, background: '#f7f6f4', border: '1px solid #e0dcd8',
                  borderRadius: 6, padding: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  color: '#1a1a1a', fontFamily: 'DM Mono, monospace',
                }}>
                  {`INSERT INTO usuarios (id, nome, email, departamento, role)\nSELECT id, '${form.nome}', '${form.email}', '${form.departamento}', '${form.role}'\nFROM auth.users WHERE email = '${form.email}'\nON CONFLICT (id) DO UPDATE\n  SET departamento = '${form.departamento}',\n      role = '${form.role}';`}
                </pre>
              </div>
            )}

            {sucesso && (
              <p style={{ fontSize: 12, color: '#2d7a4f', marginBottom: 8 }}>{sucesso}</p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setMostrarForm(false)}
                style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid #e0dcd8', background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={salvando}
                style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: salvando ? '#c5c0ba' : '#7a1e1e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer' }}>
                {salvando ? 'Salvando...' : 'Vincular ao CRM'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
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
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#888480', fontSize: 13 }}>
                  <div style={{ marginBottom: 8 }}>Nenhum usuário vinculado ao CRM ainda.</div>
                  <code style={{ fontSize: 11, background: '#f7f6f4', padding: '4px 8px', borderRadius: 4, fontFamily: 'DM Mono, monospace' }}>
                    INSERT INTO usuarios (id, nome, email, departamento, role) SELECT id, email, email, 'ADMINISTRATIVO', 'ADMIN' FROM auth.users WHERE email = 'herbertscont@gmail.com';
                  </code>
                </td>
              </tr>
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
                  <button onClick={() => toggleAtivo(u.id, u.ativo)}
                    title={u.ativo ? 'Desativar' : 'Ativar'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    {u.ativo ? <UserX size={14} color="#b83232" /> : <UserCheck size={14} color="#2d7a4f" />}
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
