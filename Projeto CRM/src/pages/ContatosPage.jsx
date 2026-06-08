import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Plus, Search, X, Edit2, Phone, Building2, Mail, FileText, ChevronDown, ChevronUp, MessageSquare, FileSpreadsheet } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import ModalImportarPlanilha from '@/components/ContatosImport/ModalImportarPlanilha'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const CAMPOS_FORM = [
  { key: 'nome',     label: 'Nome',               placeholder: 'Nome completo',  required: true,  col: 2 },
  { key: 'telefone', label: 'Telefone (WhatsApp)', placeholder: '5561999999999', required: true,  col: 1, mono: true },
  { key: 'email',    label: 'E-mail',              placeholder: 'contato@empresa.com', required: false, col: 1 },
  { key: 'cpf_cnpj', label: 'CPF / CNPJ',          placeholder: '000.000.000-00',      required: false, col: 1 },
]

const VAZIO = { nome: '', telefone: '', email: '', cpf_cnpj: '', observacoes: '' }
const EMPRESA_VAZIA = { empresa: '', cargo: '' }

// ─── Modal de criar/editar contato ─────────────────────────
function ModalContato({ contato, empresasIniciais = [], onSalvar, onFechar }) {
  const editando = !!contato?.id
  const [form, setForm] = useState(contato ? {
    nome:        contato.nome       ?? '',
    telefone:    contato.telefone   ?? '',
    email:       contato.email      ?? '',
    cpf_cnpj:    contato.cpf_cnpj   ?? '',
    observacoes: contato.observacoes ?? '',
  } : { ...VAZIO })
  const [empresas, setEmpresas] = useState(
    empresasIniciais.length > 0
      ? empresasIniciais.map(e => ({ empresa: e.empresa, cargo: e.cargo ?? '', _key: crypto.randomUUID() }))
      : [{ ...EMPRESA_VAZIA, _key: crypto.randomUUID() }]
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const setEmpresa = (i, k) => (e) =>
    setEmpresas(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: e.target.value } : item))

  const addEmpresa = () => setEmpresas(prev => [...prev, { ...EMPRESA_VAZIA, _key: crypto.randomUUID() }])

  const removeEmpresa = (i) => setEmpresas(prev => prev.filter((_, idx) => idx !== i))

  const handleSalvar = async (e) => {
    e.preventDefault()
    if (!form.nome.trim())     { setErro('Informe o nome do contato.'); return }
    if (!form.telefone.trim()) { setErro('Informe o telefone/WhatsApp.'); return }
    setSalvando(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSalvando(false); setErro('Sessão expirada. Faça login novamente.'); return }
    const agora = new Date().toISOString()

    const payload = {
      nome:        form.nome.trim(),
      telefone:    form.telefone.trim().replace(/\D/g, ''),
      email:       form.email.trim()    || null,
      cpf_cnpj:    form.cpf_cnpj.trim() || null,
      observacoes: form.observacoes.trim() || null,
      atualizado_por: user.id,
      atualizado_em:  agora,
    }

    let contatoId = contato?.id
    let error

    if (editando) {
      ;({ error } = await supabase.from('contatos').update(payload).eq('id', contatoId))
    } else {
      const { data, error: errIns } = await supabase
        .from('contatos').insert(payload).select('id').single()
      error = errIns
      contatoId = data?.id
    }

    if (error) { setSalvando(false); setErro(error.message); return }

    // Sincronizar contatos_empresas
    const empresasValidas = empresas.filter(e => e.empresa.trim())
    if (contatoId) {
      if (editando) {
        const { error: errDel } = await supabase
          .from('contatos_empresas')
          .delete()
          .eq('contato_id', contatoId)
        if (errDel) { setSalvando(false); setErro(errDel.message); return }
      }
      for (const item of empresasValidas) {
        const { error: errUp } = await supabase.from('contatos_empresas').insert({
          contato_id: contatoId,
          empresa:    item.empresa.trim(),
          cargo:      item.cargo.trim() || null,
        })
        if (errUp) { setSalvando(false); setErro(errUp.message); return }
      }
    }

    setSalvando(false)
    onSalvar()
    onFechar()
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13,
    outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 4 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        width: 540, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#7a1e1e" />
            </div>
            <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              {editando ? 'Editar Contato' : 'Novo Contato'}
            </h3>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        <form onSubmit={handleSalvar}>
          {/* Campos principais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {CAMPOS_FORM.map(c => (
              <div key={c.key} style={{ gridColumn: c.col === 2 ? 'span 2' : 'span 1' }}>
                <label style={labelStyle}>
                  {c.label} {c.required && <span style={{ color: '#b83232' }}>*</span>}
                </label>
                <input
                  value={form[c.key]}
                  onChange={set(c.key)}
                  placeholder={c.placeholder}
                  required={c.required}
                  style={{ ...inputStyle, fontFamily: c.mono ? 'DM Mono, monospace' : 'DM Sans, sans-serif' }}
                />
              </div>
            ))}
          </div>

          {/* Empresas vinculadas */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Empresas vinculadas</label>
              <button type="button" onClick={addEmpresa} style={{
                background: 'none', border: '1px solid #e0dcd8', borderRadius: 5,
                padding: '3px 10px', fontSize: 11, color: '#7a1e1e', cursor: 'pointer',
              }}>
                + Adicionar
              </button>
            </div>
            {empresas.map((item, i) => (
              <div key={item._key ?? i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                <input
                  value={item.empresa}
                  onChange={setEmpresa(i, 'empresa')}
                  placeholder="Razão social ou nome"
                  style={{ ...inputStyle, flex: 2 }}
                />
                <input
                  value={item.cargo}
                  onChange={setEmpresa(i, 'cargo')}
                  placeholder="Cargo / Função"
                  style={{ ...inputStyle, flex: 1 }}
                />
                {empresas.length > 1 && (
                  <button type="button" onClick={() => removeEmpresa(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 4px', color: '#888480', flexShrink: 0,
                  }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Observações */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={set('observacoes')}
              placeholder="Informações relevantes sobre o contato..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {erro && <p style={{ fontSize: 12, color: '#b83232', marginBottom: 10 }}>{erro}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onFechar} style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e0dcd8',
              background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: salvando ? '#c5c0ba' : '#7a1e1e',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer',
            }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar Contato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Card expandível de contato ────────────────────────────
function ContatoCard({ contato, onEditar, onAtualizar }) {
  const [expandido, setExpandido]         = useState(false)
  const [historico, setHistorico]         = useState([])
  const [empresas, setEmpresas]           = useState([])
  const [carregandoHist, setCarregandoHist] = useState(false)

  useEffect(() => {
    setHistorico([])
    setEmpresas([])
  }, [contato.atualizado_em])

  const carregarDetalhes = async () => {
    if (historico.length && empresas.length) return
    setCarregandoHist(true)

    const [{ data: hist }, { data: emps }] = await Promise.all([
      supabase
        .from('conversas')
        .select('id, protocolo, status, departamento, aberto_em, encerrado_em')
        .eq('contato_id', contato.id)
        .order('aberto_em', { ascending: false })
        .limit(10),
      supabase
        .from('contatos_empresas')
        .select('empresa, cargo')
        .eq('contato_id', contato.id)
        .order('criado_em', { ascending: true }),
    ])

    setHistorico(hist ?? [])
    setEmpresas(emps ?? [])
    setCarregandoHist(false)
  }

  const handleExpand = () => {
    setExpandido(v => !v)
    if (!expandido) carregarDetalhes()
  }

  const STATUS_COR = { ABERTA: '#888480', EM_ATENDIMENTO: '#2d7a4f', AGUARDANDO: '#b87a00', ENCERRADA: '#c5c0ba' }

  const empresaLabel = contato.contatos_empresas?.[0]?.empresa ?? null

  return (
    <div style={{
      background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10,
      overflow: 'hidden', marginBottom: 8,
      boxShadow: expandido ? '0 2px 12px rgba(0,0,0,0.07)' : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: '#f0e8e8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#7a1e1e', flexShrink: 0,
        }}>
          {(contato.nome ?? contato.telefone)[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
              {contato.nome ?? '—'}
            </span>
            {empresaLabel && (
              <span style={{ fontSize: 11, color: '#888480', background: '#f7f6f4', padding: '1px 7px', borderRadius: 3 }}>
                {empresaLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Phone size={10} /> {contato.telefone}
            </span>
            {contato.email && (
              <span style={{ fontSize: 11, color: '#888480', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={10} /> {contato.email}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEditar(contato) }}
            title="Editar contato"
            style={{ background: 'none', border: '1px solid #e0dcd8', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888480' }}
          >
            <Edit2 size={12} /> Editar
          </button>
          <button onClick={handleExpand}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#888480' }}>
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expandido && (
        <div style={{ borderTop: '1px solid #e0dcd8', padding: '14px 16px', background: '#fafaf9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: contato.observacoes ? 14 : 0 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 0 }}>
                Dados cadastrais
              </p>
              {[
                { label: 'CPF/CNPJ', value: contato.cpf_cnpj },
                { label: 'E-mail',   value: contato.email },
                { label: 'Cadastrado em', value: contato.criado_em ? format(new Date(contato.criado_em), "dd/MM/yyyy", { locale: ptBR }) : null },
              ].filter(f => f.value).map(f => (
                <div key={f.label} style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: '#888480' }}>{f.label}: </span>
                  <span style={{ fontSize: 12, color: '#1a1a1a' }}>{f.value}</span>
                </div>
              ))}

              <p style={{ fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, marginTop: 10 }}>
                Empresas ({carregandoHist ? '…' : empresas.length})
              </p>
              {carregandoHist ? null : empresas.length === 0 ? (
                <span style={{ fontSize: 11, color: '#c5c0ba' }}>Nenhuma empresa</span>
              ) : empresas.map((e, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{e.empresa}</span>
                  {e.cargo && <span style={{ fontSize: 11, color: '#888480' }}> · {e.cargo}</span>}
                </div>
              ))}
            </div>

            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 0 }}>
                Histórico ({historico.length})
              </p>
              {carregandoHist ? (
                <span style={{ fontSize: 11, color: '#888480' }}>Carregando...</span>
              ) : historico.length === 0 ? (
                <span style={{ fontSize: 11, color: '#c5c0ba' }}>Sem conversas</span>
              ) : historico.map(c => (
                <div key={c.id} style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={10} color={STATUS_COR[c.status] ?? '#888480'} />
                  <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#7a1e1e' }}>{c.protocolo}</span>
                  <span style={{ fontSize: 10, color: '#888480' }}>{c.departamento}</span>
                  <span style={{ fontSize: 10, color: STATUS_COR[c.status] ?? '#888480', fontWeight: 600 }}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>

          {contato.observacoes && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: 6, padding: '10px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                Observações
              </p>
              <p style={{ fontSize: 13, color: '#1a1a1a', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {contato.observacoes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────
export default function ContatosPage() {
  const [contatos, setContatos]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [busca, setBusca]         = useState('')
  const [modal, setModal]         = useState(null)  // null | {} (novo) | {contato}
  const [empresasModal, setEmpresasModal] = useState([])
  const [pagina, setPagina]       = useState(0)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const [modalImportar, setModalImportar]   = useState(false)
  const POR_PAGINA = 20
  const editandoRef = useRef(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('contatos')
      .select('*, contatos_empresas(empresa, cargo)')
      .order('nome', { ascending: true })

    if (busca.trim()) {
      const t = busca.trim()
      q = q.or(`nome.ilike.%${t}%,telefone.ilike.%${t}%,email.ilike.%${t}%`)
    }

    const { data } = await q
    let resultado = data ?? []
    if (busca.trim()) {
      const t = busca.trim().toLowerCase()
      const matchesEmpresa = (c) =>
        c.contatos_empresas?.some(e => e.empresa?.toLowerCase().includes(t))
      resultado = resultado.filter(c =>
        c.nome?.toLowerCase().includes(t) ||
        c.telefone?.toLowerCase().includes(t) ||
        c.email?.toLowerCase().includes(t) ||
        matchesEmpresa(c)
      )
    }
    setContatos(resultado)
    setLoading(false)
  }, [busca])

  useEffect(() => { carregar() }, [carregar])

  const handleEditar = async (contato) => {
    if (editandoRef.current) return
    editandoRef.current = true
    try {
      const { data } = await supabase
        .from('contatos_empresas')
        .select('empresa, cargo')
        .eq('contato_id', contato.id)
        .order('criado_em')
      setEmpresasModal(data ?? [])
      setModal(contato)
    } finally {
      editandoRef.current = false
    }
  }

  const paginados = contatos.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const totalPaginas = Math.ceil(contatos.length / POR_PAGINA)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e0dcd8', background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} color="#7a1e1e" />
            <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 17, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              Contatos
            </h2>
            <span style={{ fontSize: 11, color: '#888480', background: '#f7f6f4', padding: '2px 8px', borderRadius: 10 }}>
              {contatos.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#888480' }} />
              <input
                value={busca}
                onChange={e => { setBusca(e.target.value); setPagina(0) }}
                placeholder="Nome, telefone, empresa..."
                style={{
                  paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                  border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 12,
                  outline: 'none', width: 220, fontFamily: 'DM Sans, sans-serif',
                }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex' }}>
                <button
                  onClick={() => setModal({})}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: '6px 0 0 6px', border: 'none',
                    background: '#7a1e1e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Novo Contato
                </button>
                <button
                  onClick={() => setDropdownAberto(v => !v)}
                  title="Importar via planilha"
                  style={{
                    padding: '7px 8px', borderRadius: '0 6px 6px 0', border: 'none',
                    borderLeft: '1px solid #5a1616', background: '#7a1e1e', color: '#fff',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              {dropdownAberto && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                    onClick={() => setDropdownAberto(false)}
                  />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                    background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 100,
                    minWidth: 190, overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => { setDropdownAberto(false); setModal({}) }}
                      style={{
                        width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                        textAlign: 'left', fontSize: 12, color: '#1a1a1a', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f7f6f4'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <Plus size={13} color="#888480" /> Cadastrar manualmente
                    </button>
                    <button
                      onClick={() => { setDropdownAberto(false); setModalImportar(true) }}
                      style={{
                        width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                        textAlign: 'left', fontSize: 12, color: '#1a1a1a', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f7f6f4'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <FileSpreadsheet size={13} color="#888480" /> Importar via planilha
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <p style={{ color: '#888480', fontSize: 13 }}>Carregando contatos...</p>
        ) : contatos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Users size={36} color="#e0dcd8" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: '#888480' }}>
              {busca ? 'Nenhum contato encontrado.' : 'Nenhum contato cadastrado ainda.'}
            </p>
            {!busca && (
              <button onClick={() => setModal({})} style={{
                marginTop: 12, padding: '8px 18px', borderRadius: 6, border: 'none',
                background: '#7a1e1e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                + Cadastrar primeiro contato
              </button>
            )}
          </div>
        ) : (
          <>
            {paginados.map(c => (
              <ContatoCard key={c.id} contato={c} onEditar={handleEditar} onAtualizar={carregar} />
            ))}

            {/* Paginação */}
            {totalPaginas > 1 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', paddingTop: 16 }}>
                <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
                  style={{ padding: '5px 12px', borderRadius: 5, border: '1px solid #e0dcd8', background: '#fff', cursor: pagina === 0 ? 'not-allowed' : 'pointer', fontSize: 12, color: pagina === 0 ? '#c5c0ba' : '#1a1a1a' }}>
                  ← Anterior
                </button>
                <span style={{ fontSize: 12, color: '#888480', padding: '5px 10px' }}>
                  {pagina + 1} / {totalPaginas}
                </span>
                <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}
                  style={{ padding: '5px 12px', borderRadius: 5, border: '1px solid #e0dcd8', background: '#fff', cursor: pagina >= totalPaginas - 1 ? 'not-allowed' : 'pointer', fontSize: 12, color: pagina >= totalPaginas - 1 ? '#c5c0ba' : '#1a1a1a' }}>
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Importar Planilha */}
      {modalImportar && (
        <ModalImportarPlanilha
          onFechar={() => setModalImportar(false)}
          onImportado={carregar}
        />
      )}

      {/* Modal */}
      {modal !== null && (
        <ModalContato
          contato={modal?.id ? modal : null}
          empresasIniciais={modal?.id ? empresasModal : []}
          onSalvar={carregar}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  )
}
