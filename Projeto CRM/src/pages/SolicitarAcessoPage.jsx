import { useState, useEffect } from 'react'
import { MessageSquare, Clock, CheckCircle, XCircle, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'

const DEPTOS = [
  { value: 'PESSOAL',        label: 'Pessoal',        desc: 'Folha de pagamento, férias, admissões' },
  { value: 'CONTABIL',       label: 'Contábil',       desc: 'Balanços, lançamentos, obrigações contábeis' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo', desc: 'Gestão geral e atendimento administrativo' },
  { value: 'TRIBUTARIO',     label: 'Tributário',     desc: 'Impostos, declarações, planejamento tributário' },
]

export default function SolicitarAcessoPage({ user, onSair }) {
  const [solicitacao, setSolicitacao] = useState(undefined) // undefined = carregando
  const [form, setForm] = useState({ nome: user?.email?.split('@')[0] ?? '', departamento: '', justificativa: '' })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Carrega solicitação existente do usuário
  useEffect(() => {
    supabase
      .from('solicitacoes_acesso')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setSolicitacao(data ?? null))
  }, [user.id])

  const handleEnviar = async (e) => {
    e.preventDefault()
    if (!form.departamento) { setErro('Selecione um departamento.'); return }
    setErro('')
    setEnviando(true)

    const { data, error } = await supabase
      .from('solicitacoes_acesso')
      .insert({
        auth_user_id:  user.id,
        email:         user.email,
        nome:          form.nome,
        departamento:  form.departamento,
        justificativa: form.justificativa || null,
      })
      .select()
      .single()

    setEnviando(false)
    if (error) { setErro(error.message); return }
    setSolicitacao(data)
  }

  // ─── Loading ───────────────────────────────────────────────
  if (solicitacao === undefined) {
    return <TelaBase onSair={onSair}><p style={{ color: '#888480', fontSize: 13 }}>Verificando...</p></TelaBase>
  }

  // ─── Já tem solicitação — mostrar status ───────────────────
  if (solicitacao) {
    return (
      <TelaBase onSair={onSair}>
        {solicitacao.status === 'PENDENTE' && (
          <>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Clock size={24} color="#b87a00" />
            </div>
            <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Solicitação enviada
            </h2>
            <p style={{ fontSize: 13, color: '#888480', marginBottom: 16, lineHeight: 1.6 }}>
              Seu pedido de acesso ao CRM está sendo analisado pelo administrador.<br />
              Você receberá acesso assim que for aprovado.
            </p>
            <div style={{ background: '#FFFBEB', border: '1px solid #fde047', borderRadius: 8, padding: '12px 16px', textAlign: 'left', fontSize: 12 }}>
              <div style={{ color: '#92400e', fontWeight: 600, marginBottom: 4 }}>Detalhes do pedido</div>
              <div style={{ color: '#1a1a1a' }}>Departamento: <strong>{solicitacao.departamento}</strong></div>
              <div style={{ color: '#888480', marginTop: 2, fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                {new Date(solicitacao.criado_em).toLocaleString('pt-BR')}
              </div>
            </div>
          </>
        )}

        {solicitacao.status === 'REJEITADA' && (
          <>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <XCircle size={24} color="#b83232" />
            </div>
            <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>
              Acesso não concedido
            </h2>
            {solicitacao.motivo_recusa && (
              <p style={{ fontSize: 13, color: '#888480', lineHeight: 1.6 }}>
                Motivo: {solicitacao.motivo_recusa}
              </p>
            )}
            <p style={{ fontSize: 12, color: '#888480' }}>
              Entre em contato com o administrador para mais informações.
            </p>
          </>
        )}
      </TelaBase>
    )
  }

  // ─── Sem solicitação — formulário de pedido ────────────────
  return (
    <TelaBase onSair={onSair}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: '#7a1e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <MessageSquare size={24} color="#fff" />
      </div>
      <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
        SCONT Messenger
      </h2>
      <p style={{ fontSize: 13, color: '#888480', marginBottom: 24, lineHeight: 1.5 }}>
        Você ainda não tem acesso ao CRM.<br />
        Preencha o formulário abaixo para solicitar.
      </p>

      <form onSubmit={handleEnviar} style={{ textAlign: 'left', width: '100%' }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 4 }}>
            Seu nome
          </label>
          <input
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            required
            placeholder="Nome completo"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 6 }}>
            Departamento *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEPTOS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, departamento: d.value }))}
                style={{
                  padding: '10px 12px', borderRadius: 8, border: '1px solid',
                  borderColor: form.departamento === d.value ? '#7a1e1e' : '#e0dcd8',
                  background: form.departamento === d.value ? '#f0e8e8' : '#fff',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: form.departamento === d.value ? '#7a1e1e' : '#1a1a1a' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 10, color: '#888480', marginTop: 2 }}>{d.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', display: 'block', marginBottom: 4 }}>
            Justificativa (opcional)
          </label>
          <textarea
            value={form.justificativa}
            onChange={e => setForm(f => ({ ...f, justificativa: e.target.value }))}
            placeholder="Ex: Serei responsável pelo atendimento via WhatsApp do departamento Pessoal..."
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', resize: 'none', lineHeight: 1.5 }}
          />
        </div>

        {erro && <p style={{ fontSize: 12, color: '#b83232', marginBottom: 8 }}>{erro}</p>}

        <button
          type="submit"
          disabled={enviando || !form.departamento}
          style={{
            width: '100%', padding: '10px', borderRadius: 6, border: 'none',
            background: enviando || !form.departamento ? '#c5c0ba' : '#7a1e1e',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: enviando || !form.departamento ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {enviando ? 'Enviando...' : 'Solicitar Acesso'}
        </button>
      </form>
    </TelaBase>
  )
}

function TelaBase({ children, onSair }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f2f0' }}>
      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 12, padding: '40px 36px', width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
        {children}
        <button
          onClick={onSair}
          style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888480', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          <LogOut size={13} /> Sair
        </button>
      </div>
    </div>
  )
}
