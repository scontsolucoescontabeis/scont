import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, BookOpen, Globe, User, X, Check } from 'lucide-react'
import {
  buscarMensagensProntas,
  criarMensagemPronta,
  atualizarMensagemPronta,
  excluirMensagemPronta,
} from '@/services/crm.service'

const VAZIO = { titulo: '', conteudo: '', categoria: '', compartilhada: false }

export default function MensagensProntasPage({ perfil }) {
  const [mensagens, setMensagens] = useState([])
  const [loading, setLoading]     = useState(true)
  const [erro, setErro]           = useState('')
  const [form, setForm]           = useState(null)   // null = fechado | objeto = editando/criando
  const [salvando, setSalvando]   = useState(false)
  const [excluindo, setExcluindo] = useState(null)   // id sendo excluído

  const isAdmin = perfil?.role === 'ADMIN'

  const carregar = () => {
    setLoading(true)
    buscarMensagensProntas()
      .then(setMensagens)
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregar() }, [])

  const abrirNova = () => setForm({ ...VAZIO, _novo: true })
  const abrirEditar = (m) => setForm({ ...m, _novo: false })
  const fecharForm = () => { setForm(null); setErro('') }

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

  const compartilhadas = mensagens.filter(m => m.compartilhada)
  const proprias       = mensagens.filter(m => !m.compartilhada)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860, margin: '0 auto', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} color="#7a1e1e" />
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0, fontFamily: 'Merriweather, serif' }}>
              Mensagens Prontas
            </h1>
          </div>
          <p style={{ fontSize: 12, color: '#888480', margin: '4px 0 0' }}>
            Respostas pré-definidas para agilizar o atendimento
          </p>
        </div>
        <button
          onClick={abrirNova}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: '#7a1e1e', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          <Plus size={14} /> Nova mensagem
        </button>
      </div>

      {loading && <div style={{ color: '#888480', fontSize: 13 }}>Carregando...</div>}

      {!loading && mensagens.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 24px',
          border: '1px dashed #e0dcd8', borderRadius: 8,
        }}>
          <BookOpen size={32} color="#e0dcd8" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: '#888480', margin: 0 }}>
            Nenhuma mensagem pronta cadastrada.<br />
            Clique em <strong>Nova mensagem</strong> para começar.
          </p>
        </div>
      )}

      {/* Compartilhadas */}
      {compartilhadas.length > 0 && (
        <Secao
          titulo="Compartilhadas"
          icone={<Globe size={13} color="#7a1e1e" />}
          itens={compartilhadas}
          onEditar={abrirEditar}
          onExcluir={excluir}
          excluindo={excluindo}
          podeEditar={isAdmin}
        />
      )}

      {/* Minhas */}
      {proprias.length > 0 && (
        <Secao
          titulo="Minhas mensagens"
          icone={<User size={13} color="#7a1e1e" />}
          itens={proprias}
          onEditar={abrirEditar}
          onExcluir={excluir}
          excluindo={excluindo}
          podeEditar={true}
        />
      )}

      {/* Modal de formulário */}
      {form && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && fecharForm()}
        >
          <div style={{ background: '#fff', borderRadius: 10, width: 520, padding: 28, boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, fontFamily: 'Merriweather, serif' }}>
                {form._novo ? 'Nova mensagem pronta' : 'Editar mensagem'}
              </h2>
              <button onClick={fecharForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888480' }}>
                <X size={16} />
              </button>
            </div>

            <Campo label="Título *">
              <input
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Documentos para admissão"
                style={inputStyle}
              />
            </Campo>

            <Campo label="Categoria (opcional)">
              <input
                value={form.categoria || ''}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                placeholder="Ex: Depto. Pessoal, Fiscal, Geral..."
                style={inputStyle}
              />
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', fontSize: 13, color: '#1a1a1a' }}>
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
                <Check size={13} /> {salvando ? 'Salvando...' : 'Salvar'}
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
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {icone}
        <span style={{ fontSize: 11, fontWeight: 700, color: '#7a1e1e', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {titulo}
        </span>
        <span style={{ fontSize: 11, color: '#c5c0ba' }}>({itens.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {itens.map(m => (
          <div
            key={m.id}
            style={{
              border: '1px solid #e0dcd8', borderRadius: 8,
              padding: '12px 14px', background: '#fff',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{m.titulo}</span>
                {m.categoria && (
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '1px 7px',
                    borderRadius: 4, background: '#f0e8e8', color: '#7a1e1e',
                  }}>
                    {m.categoria}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: '#6b6760', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {m.conteudo}
              </p>
            </div>
            {podeEditar && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => onEditar(m)}
                  style={{ padding: 6, border: '1px solid #e0dcd8', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#888480', display: 'flex' }}
                  title="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onExcluir(m.id)}
                  disabled={excluindo === m.id}
                  style={{ padding: 6, border: '1px solid #e0dcd8', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#b83232', display: 'flex' }}
                  title="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
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
  padding: '8px 16px', background: '#7a1e1e', color: '#fff',
  border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
}

const btnSecundario = {
  padding: '8px 14px', background: '#fff', color: '#888480',
  border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 12,
  cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
}
