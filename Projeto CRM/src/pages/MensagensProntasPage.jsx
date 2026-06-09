import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen, Globe, User, X, Check } from 'lucide-react'
import {
  buscarMensagensProntas,
  criarMensagemPronta,
  atualizarMensagemPronta,
  excluirMensagemPronta,
} from '@/services/crm.service'

const DEPTS = [
  { value: 'PESSOAL',       label: 'Depto. Pessoal' },
  { value: 'CONTABIL',      label: 'Contabilidade' },
  { value: 'TRIBUTARIO',    label: 'Tributário / Fiscal' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
]

const DEPT_CORES = {
  PESSOAL:       { bg: '#eff6ff', color: '#1d4ed8' },
  CONTABIL:      { bg: '#f0fdf4', color: '#15803d' },
  TRIBUTARIO:    { bg: '#fefce8', color: '#92400e' },
  ADMINISTRATIVO:{ bg: '#faf5ff', color: '#6b21a8' },
}

const VAZIO = { titulo: '', conteudo: '', categoria: '', departamento: '', compartilhada: false }

export default function MensagensProntasPage({ perfil }) {
  const [mensagens, setMensagens]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [erro, setErro]             = useState('')
  const [form, setForm]             = useState(null)
  const [salvando, setSalvando]     = useState(false)
  const [excluindo, setExcluindo]   = useState(null)
  const [deptFiltro, setDeptFiltro] = useState('TODOS')

  const isAdmin = perfil?.role === 'ADMIN'

  const carregar = () => {
    setLoading(true)
    buscarMensagensProntas()
      .then(setMensagens)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregar() }, [])

  const abrirNova    = () => setForm({ ...VAZIO, _novo: true })
  const abrirEditar  = (m) => setForm({ ...m, _novo: false })
  const fecharForm   = () => { setForm(null); setErro('') }

  const salvar = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      setErro('Título e conteúdo são obrigatórios.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      if (form._novo) {
        await criarMensagemPronta(form)
      } else {
        await atualizarMensagemPronta(form.id, form)
      }
      fecharForm()
      carregar()
    } catch (e) {
      setErro(e.message)
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (id) => {
    if (!confirm('Excluir esta mensagem pronta?')) return
    setExcluindo(id)
    try {
      await excluirMensagemPronta(id)
      setMensagens(prev => prev.filter(m => m.id !== id))
    } catch (e) {
      setErro(e.message)
    } finally {
      setExcluindo(null)
    }
  }

  // Filtra pelo departamento selecionado
  const filtradas = deptFiltro === 'TODOS'
    ? mensagens
    : deptFiltro === 'GERAL'
    ? mensagens.filter(m => !m.departamento)
    : mensagens.filter(m => m.departamento === deptFiltro)

  const compartilhadas = filtradas.filter(m => m.compartilhada)
  const proprias       = filtradas.filter(m => !m.compartilhada)

  // Contagem por aba
  const contagem = (dept) => {
    if (dept === 'TODOS') return mensagens.length
    if (dept === 'GERAL') return mensagens.filter(m => !m.departamento).length
    return mensagens.filter(m => m.departamento === dept).length
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Topo fixo */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0, borderBottom: '1px solid #e0dcd8', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={17} color="#7a1e1e" />
            <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0, fontFamily: 'Merriweather, serif' }}>
              Mensagens Prontas
            </h1>
          </div>
          <button onClick={abrirNova} style={btnPrimario}>
            <Plus size={13} /> Nova mensagem
          </button>
        </div>

        {/* Abas de departamento */}
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {[
            { value: 'TODOS', label: 'Todos' },
            ...DEPTS,
            { value: 'GERAL', label: 'Geral' },
          ].map(tab => {
            const ativo = deptFiltro === tab.value
            const n = contagem(tab.value)
            return (
              <button
                key={tab.value}
                onClick={() => setDeptFiltro(tab.value)}
                style={{
                  padding: '6px 13px', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: ativo ? 600 : 400,
                  background: 'none', whiteSpace: 'nowrap',
                  color: ativo ? '#7a1e1e' : '#888480',
                  borderBottom: ativo ? '2px solid #7a1e1e' : '2px solid transparent',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'color 0.1s',
                }}
              >
                {tab.label}
                {n > 0 && (
                  <span style={{
                    marginLeft: 5, fontSize: 10, fontWeight: 600,
                    padding: '1px 5px', borderRadius: 8,
                    background: ativo ? '#f0e8e8' : '#f2f2f0',
                    color: ativo ? '#7a1e1e' : '#888480',
                  }}>
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo com scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {loading && <div style={{ color: '#888480', fontSize: 13 }}>Carregando...</div>}

        {!loading && filtradas.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            border: '1px dashed #e0dcd8', borderRadius: 8,
          }}>
            <BookOpen size={28} color="#e0dcd8" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13, color: '#888480', margin: 0 }}>
              Nenhuma mensagem nesta categoria.<br />
              Clique em <strong>Nova mensagem</strong> para criar.
            </p>
          </div>
        )}

        {!loading && compartilhadas.length > 0 && (
          <Secao
            titulo="Compartilhadas"
            icone={<Globe size={12} color="#7a1e1e" />}
            itens={compartilhadas}
            onEditar={abrirEditar}
            onExcluir={excluir}
            excluindo={excluindo}
            podeEditar={isAdmin}
          />
        )}

        {!loading && proprias.length > 0 && (
          <Secao
            titulo="Minhas mensagens"
            icone={<User size={12} color="#7a1e1e" />}
            itens={proprias}
            onEditar={abrirEditar}
            onExcluir={excluir}
            excluindo={excluindo}
            podeEditar={true}
          />
        )}
      </div>

      {/* Modal formulário */}
      {form && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && fecharForm()}
        >
          <div style={{ background: '#fff', borderRadius: 10, width: 520, padding: 26, boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, fontFamily: 'Merriweather, serif' }}>
                {form._novo ? 'Nova mensagem pronta' : 'Editar mensagem'}
              </h2>
              <button onClick={fecharForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888480' }}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Campo label="Título *">
                <input
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Docs para admissão"
                  style={inputStyle}
                />
              </Campo>
              <Campo label="Categoria (opcional)">
                <input
                  value={form.categoria || ''}
                  onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                  placeholder="Ex: Admissão, IRPF..."
                  style={inputStyle}
                />
              </Campo>
            </div>

            <Campo label="Departamento">
              <select
                value={form.departamento || ''}
                onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}
                style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}
              >
                <option value="">Geral (todos os departamentos)</option>
                {DEPTS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Conteúdo *">
              <textarea
                value={form.conteudo}
                onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
                placeholder="Digite o texto completo da mensagem..."
                rows={6}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
              />
            </Campo>

            {isAdmin && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13, color: '#1a1a1a' }}>
                <input
                  type="checkbox"
                  checked={!!form.compartilhada}
                  onChange={e => setForm(f => ({ ...f, compartilhada: e.target.checked }))}
                  style={{ width: 14, height: 14, accentColor: '#7a1e1e' }}
                />
                Compartilhar com toda a equipe
              </label>
            )}

            {erro && <p style={{ fontSize: 12, color: '#b83232', margin: '0 0 12px' }}>{erro}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={fecharForm} style={btnSecundario}>Cancelar</button>
              <button onClick={salvar} disabled={salvando} style={btnPrimario}>
                <Check size={12} /> {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Secao({ titulo, icone, itens, onEditar, onExcluir, excluindo, podeEditar }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icone}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#7a1e1e', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {titulo}
        </span>
        <span style={{ fontSize: 10, color: '#c5c0ba' }}>({itens.length})</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
        {itens.map(m => (
          <Card
            key={m.id}
            m={m}
            onEditar={onEditar}
            onExcluir={onExcluir}
            excluindo={excluindo}
            podeEditar={podeEditar}
          />
        ))}
      </div>
    </div>
  )
}

function Card({ m, onEditar, onExcluir, excluindo, podeEditar }) {
  const cor = m.departamento ? DEPT_CORES[m.departamento] : null
  const deptLabel = m.departamento ? DEPTS.find(d => d.value === m.departamento)?.label : null

  return (
    <div style={{
      border: '1px solid #e0dcd8', borderRadius: 8,
      padding: '12px 14px', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {/* Cabeçalho do card */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 4 }}>
            {m.titulo}
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {deptLabel && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                background: cor?.bg, color: cor?.color,
              }}>
                {deptLabel}
              </span>
            )}
            {m.categoria && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '2px 7px',
                borderRadius: 4, background: '#f0e8e8', color: '#7a1e1e',
              }}>
                {m.categoria}
              </span>
            )}
          </div>
        </div>
        {podeEditar && (
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <button
              onClick={() => onEditar(m)}
              style={{ padding: 5, border: '1px solid #e0dcd8', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#888480', display: 'flex' }}
              title="Editar"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => onExcluir(m.id)}
              disabled={excluindo === m.id}
              style={{ padding: 5, border: '1px solid #e0dcd8', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#b83232', display: 'flex' }}
              title="Excluir"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <p style={{
        fontSize: 12, color: '#6b6760', margin: 0, lineHeight: 1.55,
        whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden',
        maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
      }}>
        {m.conteudo}
      </p>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b6760', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', border: '1px solid #e0dcd8',
  borderRadius: 6, fontSize: 13, outline: 'none',
  fontFamily: 'DM Sans, sans-serif', color: '#1a1a1a',
}

const btnPrimario = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', background: '#7a1e1e', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
}

const btnSecundario = {
  padding: '7px 12px', background: '#fff', color: '#888480',
  border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 12,
  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
}
