import { useState, useEffect, useRef } from 'react'
import {
  buscarChatbotConfig, salvarChatbotConfig,
  buscarChatbotDeptConfig, salvarChatbotDeptConfig,
  buscarTodosMenus, criarMenu, atualizarMenu, excluirMenu, reordenarMenus,
  buscarMediaCsat, buscarAvaliacoesCsat,
  buscarFeriados, criarFeriado, atualizarFeriado, excluirFeriado,
} from '@/services/crm.service'

// ─── Constantes ────────────────────────────────────────────────
const ABAS = [
  { id: 'geral',      label: '⚙️ Geral' },
  { id: 'menus',      label: '🌿 Menus' },
  { id: 'horarios',   label: '🕐 Horários' },
  { id: 'avaliacoes', label: '⭐ Avaliações' },
  { id: 'calendario', label: '📅 Calendário' },
]

// ─── Componentes auxiliares genéricos ──────────────────────────
function Campo({ label, value, onChange, type = 'text', min, max }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#555', fontFamily: 'DM Sans, sans-serif' }}>
        {label}
      </label>
      <input
        type={type}
        value={value ?? ''}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '7px 10px',
          border: '1px solid #e0dcd8',
          borderRadius: 6,
          fontSize: 13,
          fontFamily: 'DM Sans, sans-serif',
          outline: 'none',
          background: '#fff',
        }}
      />
    </div>
  )
}

function CampoTexto({ label, value, onChange, rows = 3, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555',
        marginBottom: 4, fontFamily: 'DM Sans, sans-serif' }}>
        {label}
      </label>
      <textarea
        value={value ?? ''}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid #e0dcd8',
          borderRadius: 6,
          fontSize: 13,
          fontFamily: 'DM Sans, sans-serif',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {hint && (
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{hint}</div>
      )}
    </div>
  )
}

// ─── Componentes auxiliares para AbaMenus ──────────────────────
function InputEdicao({ valor, onSalvar, onCancelar }) {
  const [texto, setTexto] = useState(valor)
  const ref = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  return (
    <input
      ref={ref}
      value={texto}
      onChange={e => setTexto(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onSalvar(texto)
        if (e.key === 'Escape') onCancelar()
      }}
      onBlur={() => onCancelar()}
      style={{
        flex: 1,
        padding: '2px 6px',
        border: '1px solid #7a1e1e',
        borderRadius: 4,
        fontSize: 13,
        fontFamily: 'DM Sans, sans-serif',
        outline: 'none',
      }}
    />
  )
}

function InputAdicao({ onAdicionar, onCancelar, placeholder, style }) {
  const [texto, setTexto] = useState('')
  const ref = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 4, ...style }}>
      <input
        ref={ref}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onAdicionar(texto)
          if (e.key === 'Escape') onCancelar()
        }}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '5px 8px',
          border: '1px solid #7a1e1e',
          borderRadius: 4,
          fontSize: 12,
          fontFamily: 'DM Sans, sans-serif',
          outline: 'none',
        }}
      />
      <button
        onClick={() => onAdicionar(texto)}
        style={{
          padding: '5px 10px',
          background: '#7a1e1e',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Adicionar
      </button>
      <button
        onClick={onCancelar}
        style={{
          padding: '5px 10px',
          background: 'none',
          color: '#888',
          border: '1px solid #e0dcd8',
          borderRadius: 4,
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
        }}
      >
        Cancelar
      </button>
    </div>
  )
}

function BotoesAcao({ onEdit, onDelete, onToggle, ativo, onUp, onDown }) {
  const btnStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 5px',
    borderRadius: 3,
    lineHeight: 1,
    color: '#888',
  }
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
      <button onClick={onUp} style={btnStyle} title="Mover para cima">↑</button>
      <button onClick={onDown} style={btnStyle} title="Mover para baixo">↓</button>
      <button onClick={onEdit} style={{ ...btnStyle, color: '#5a8a5a' }} title="Editar">✏️</button>
      <button
        onClick={onToggle}
        style={{ ...btnStyle, color: ativo ? '#27ae60' : '#aaa' }}
        title={ativo ? 'Desativar' : 'Ativar'}
      >
        {ativo ? '✔' : '○'}
      </button>
      <button onClick={onDelete} style={{ ...btnStyle, color: '#E74C3C' }} title="Excluir">🗑</button>
    </div>
  )
}

// ─── Aba Geral ─────────────────────────────────────────────────
function AbaGeral() {
  const [config, setConfig] = useState(null)
  const [erro, setErro] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    buscarChatbotConfig().then(data => {
      if (data) setConfig(data)
      else setErro(true)
    }).catch(() => setErro(true))
  }, [])

  const salvar = async () => {
    setSalvando(true)
    try { await salvarChatbotConfig(config) }
    finally { setSalvando(false) }
  }

  if (erro) return (
    <div style={{ padding: 20, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, color: '#856404' }}>
      <strong>Tabela não encontrada.</strong> Execute a migration <code>008_chatbot.sql</code> no SQL Editor do Supabase antes de usar esta página.
    </div>
  )
  if (!config) return <div style={{ color: '#888' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Toggle bot ativo */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', background: '#fff8f8', border: '1.5px solid #e8d0d0',
        borderRadius: 8, marginBottom: 20,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>🤖 Chatbot ativo</div>
          <div style={{ fontSize: 12, color: '#888480', marginTop: 2 }}>
            Quando desligado, mensagens vão direto para atendimento humano
          </div>
        </div>
        {/* Toggle switch */}
        <div
          onClick={() => setConfig(c => ({ ...c, bot_ativo: !c.bot_ativo }))}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
            background: config.bot_ativo ? '#27ae60' : '#ccc', position: 'relative',
            transition: 'background 0.2s', flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', width: 18, height: 18, background: '#fff',
            borderRadius: '50%', top: 3,
            left: config.bot_ativo ? 23 : 3, transition: 'left 0.2s',
          }} />
        </div>
      </div>

      {/* Campos numéricos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Campo
          label="⏱️ Timeout de inatividade (minutos)"
          value={config.timeout_minutos}
          onChange={v => setConfig(c => ({ ...c, timeout_minutos: Number(v) }))}
          type="number" min={1} max={120}
        />
        <Campo
          label="🚫 Máx. tentativas inválidas"
          value={config.max_tentativas}
          onChange={v => setConfig(c => ({ ...c, max_tentativas: Number(v) }))}
          type="number" min={1} max={10}
        />
      </div>

      {/* Mensagens */}
      <CampoTexto
        label="💬 Mensagem de boas-vindas"
        value={config.msg_boas_vindas}
        onChange={v => setConfig(c => ({ ...c, msg_boas_vindas: v }))}
        rows={2}
      />
      <CampoTexto
        label="🌙 Mensagem fora do horário"
        value={config.msg_fora_horario}
        onChange={v => setConfig(c => ({ ...c, msg_fora_horario: v }))}
        rows={2}
      />
      <CampoTexto
        label="📣 Mensagem de fila de espera"
        value={config.msg_fila}
        onChange={v => setConfig(c => ({ ...c, msg_fila: v }))}
        rows={2}
        hint="Use {departamento}, {assunto}, {protocolo}"
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={salvar}
          disabled={salvando}
          style={{
            padding: '10px 24px', background: salvando ? '#9b6b6b' : '#7a1e1e',
            color: '#fff', border: 'none', borderRadius: 6, fontSize: 14,
            fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {salvando ? 'Salvando...' : '💾 Salvar alterações'}
        </button>
      </div>
    </div>
  )
}

// ─── Aba Menus ─────────────────────────────────────────────────
const DEPTOS = ['PESSOAL', 'CONTABIL', 'TRIBUTARIO', 'ADMINISTRATIVO']
const DEPTO_LABELS = {
  PESSOAL: '👥 Depto. Pessoal',
  CONTABIL: '📊 Contabilidade',
  TRIBUTARIO: '🧾 Tributário / Fiscal',
  ADMINISTRATIVO: '🏢 Administrativo',
}

function AbaMenus() {
  const [menus, setMenus] = useState([])
  const [expandido, setExpandido] = useState({})
  const [editando, setEditando] = useState(null)
  const [adicionando, setAdicionando] = useState(null)

  useEffect(() => { buscarTodosMenus().then(setMenus) }, [])

  const recarregar = () => buscarTodosMenus().then(setMenus)

  const salvarEdicao = async (id, titulo) => {
    await atualizarMenu(id, { titulo })
    setEditando(null)
    recarregar()
  }

  const excluir = async (id) => {
    if (!confirm('Excluir este item e todos os seus sub-itens?')) return
    await excluirMenu(id)
    recarregar()
  }

  const toggleAtivo = async (id, ativo) => {
    await atualizarMenu(id, { ativo: !ativo })
    recarregar()
  }

  const adicionarItem = async (titulo) => {
    if (!titulo.trim()) return
    const { departamento, nivel, parent_id } = adicionando
    const itensExistentes = menus.filter(m =>
      m.departamento === departamento && m.nivel === nivel &&
      (nivel === 1 ? !m.parent_id : m.parent_id === parent_id)
    )
    await criarMenu({
      departamento,
      titulo: titulo.trim(),
      nivel,
      ordem: itensExistentes.length + 1,
      ativo: true,
      parent_id: parent_id || null,
    })
    setAdicionando(null)
    recarregar()
  }

  const moverItem = async (id, direcao) => {
    const item = menus.find(m => m.id === id)
    if (!item) return
    const irmaos = menus
      .filter(m =>
        m.departamento === item.departamento &&
        m.nivel === item.nivel &&
        m.parent_id === item.parent_id
      )
      .sort((a, b) => a.ordem - b.ordem)
    const idx = irmaos.findIndex(m => m.id === id)
    const vizinho = direcao === 'up' ? irmaos[idx - 1] : irmaos[idx + 1]
    if (!vizinho) return
    await reordenarMenus([
      { id: item.id, ordem: vizinho.ordem },
      { id: vizinho.id, ordem: item.ordem },
    ])
    recarregar()
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {DEPTOS.map(dept => {
        const cats = menus
          .filter(m => m.departamento === dept && m.nivel === 1)
          .sort((a, b) => a.ordem - b.ordem)

        return (
          <div key={dept} style={{ marginBottom: 24 }}>
            {/* Cabeçalho do departamento */}
            <div style={{
              background: '#7a1e1e', color: '#fff', borderRadius: 8, padding: '10px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
            }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{DEPTO_LABELS[dept]}</span>
              <button
                onClick={() => setAdicionando({ departamento: dept, nivel: 1, parent_id: null })}
                style={{
                  background: '#fff', color: '#7a1e1e', border: 'none', borderRadius: 4,
                  padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                + Categoria
              </button>
            </div>

            {/* Categorias */}
            {cats.map(cat => (
              <div key={cat.id}>
                <div style={{
                  background: '#f0e8e8', borderLeft: '3px solid #7a1e1e',
                  borderRadius: '0 6px 6px 0', padding: '7px 12px', marginBottom: 2, marginLeft: 16,
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: cat.ativo ? 1 : 0.5,
                }}>
                  <button
                    onClick={() => setExpandido(e => ({ ...e, [cat.id]: !e[cat.id] }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888' }}
                  >
                    {expandido[cat.id] ? '▾' : '▸'}
                  </button>
                  {editando?.id === cat.id
                    ? (
                      <InputEdicao
                        valor={editando.titulo}
                        onSalvar={t => salvarEdicao(cat.id, t)}
                        onCancelar={() => setEditando(null)}
                      />
                    )
                    : <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{cat.titulo}</span>
                  }
                  <BotoesAcao
                    onEdit={() => setEditando({ id: cat.id, titulo: cat.titulo })}
                    onDelete={() => excluir(cat.id)}
                    onToggle={() => toggleAtivo(cat.id, cat.ativo)}
                    ativo={cat.ativo}
                    onUp={() => moverItem(cat.id, 'up')}
                    onDown={() => moverItem(cat.id, 'down')}
                  />
                </div>

                {/* Sub-itens */}
                {expandido[cat.id] && (
                  <div>
                    {menus
                      .filter(m => m.parent_id === cat.id && m.nivel === 2)
                      .sort((a, b) => a.ordem - b.ordem)
                      .map(sub => (
                        <div key={sub.id} style={{
                          background: '#fdf8f8', borderLeft: '2px solid #c08080',
                          borderRadius: '0 4px 4px 0', padding: '5px 12px', marginBottom: 2, marginLeft: 32,
                          display: 'flex', alignItems: 'center', gap: 8,
                          opacity: sub.ativo ? 1 : 0.5,
                        }}>
                          {editando?.id === sub.id
                            ? (
                              <InputEdicao
                                valor={editando.titulo}
                                onSalvar={t => salvarEdicao(sub.id, t)}
                                onCancelar={() => setEditando(null)}
                              />
                            )
                            : <span style={{ flex: 1, fontSize: 12, color: '#555' }}>{sub.titulo}</span>
                          }
                          <BotoesAcao
                            onEdit={() => setEditando({ id: sub.id, titulo: sub.titulo })}
                            onDelete={() => excluir(sub.id)}
                            onToggle={() => toggleAtivo(sub.id, sub.ativo)}
                            ativo={sub.ativo}
                            onUp={() => moverItem(sub.id, 'up')}
                            onDown={() => moverItem(sub.id, 'down')}
                          />
                        </div>
                      ))
                    }
                    {/* Form adicionar sub-item */}
                    {adicionando?.departamento === dept && adicionando.nivel === 2 && adicionando.parent_id === cat.id
                      ? (
                        <InputAdicao
                          onAdicionar={adicionarItem}
                          onCancelar={() => setAdicionando(null)}
                          placeholder="Nome do novo sub-item..."
                          style={{ marginLeft: 32 }}
                        />
                      )
                      : (
                        <button
                          onClick={() => setAdicionando({ departamento: dept, nivel: 2, parent_id: cat.id })}
                          style={{
                            marginLeft: 32, background: 'none', border: '1px dashed #c08080',
                            borderRadius: 4, padding: '3px 10px', fontSize: 11, color: '#c08080',
                            cursor: 'pointer', marginBottom: 4,
                          }}
                        >
                          + Sub-item
                        </button>
                      )
                    }
                  </div>
                )}
              </div>
            ))}

            {/* Form de adição de categoria inline */}
            {adicionando?.departamento === dept && adicionando.nivel === 1 && (
              <InputAdicao
                onAdicionar={adicionarItem}
                onCancelar={() => setAdicionando(null)}
                placeholder="Nome da nova categoria..."
                style={{ marginLeft: 16 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Aba Horários ──────────────────────────────────────────────
const DEPTO_LABELS_SIMPLES = {
  PESSOAL: 'Depto. Pessoal',
  CONTABIL: 'Contabilidade',
  TRIBUTARIO: 'Tributário / Fiscal',
  ADMINISTRATIVO: 'Administrativo',
}
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function AbaHorarios() {
  const [config, setConfig] = useState(null)
  const [deptConfigs, setDeptConfigs] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    Promise.all([buscarChatbotConfig(), buscarChatbotDeptConfig()])
      .then(([cfg, depts]) => {
        if (cfg) { setConfig(cfg); setDeptConfigs(depts) }
        else setErro(true)
      }).catch(() => setErro(true))
  }, [])

  const salvar = async () => {
    setSalvando(true)
    try {
      await salvarChatbotConfig({
        horario_inicio: config.horario_inicio,
        horario_fim: config.horario_fim,
        dias_semana: config.dias_semana,
      })
      for (const d of deptConfigs) {
        await salvarChatbotDeptConfig(d.departamento, {
          ativo: d.ativo,
          horario_inicio: d.horario_inicio || null,
          horario_fim: d.horario_fim || null,
        })
      }
    } finally { setSalvando(false) }
  }

  if (erro) return (
    <div style={{ padding: 20, background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, color: '#856404' }}>
      <strong>Tabela não encontrada.</strong> Execute a migration <code>008_chatbot.sql</code> no SQL Editor do Supabase antes de usar esta página.
    </div>
  )
  if (!config) return <div style={{ color: '#888' }}>Carregando...</div>

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Horário global */}
      <div style={{
        background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
        padding: 20, marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🌍 Horário global de atendimento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <Campo
            label="Início"
            value={config.horario_inicio}
            onChange={v => setConfig(c => ({ ...c, horario_inicio: v }))}
            type="time"
          />
          <Campo
            label="Fim"
            value={config.horario_fim}
            onChange={v => setConfig(c => ({ ...c, horario_fim: v }))}
            type="time"
          />
        </div>
        {/* Checkboxes dias da semana */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Dias de atendimento</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIAS.map((dia, i) => {
            const iso = i === 0 ? 7 : i
            const ativo = config.dias_semana?.includes(iso)
            return (
              <button
                key={i}
                onClick={() => {
                  const dias = config.dias_semana ?? []
                  setConfig(c => ({
                    ...c,
                    dias_semana: ativo ? dias.filter(d => d !== iso) : [...dias, iso].sort(),
                  }))
                }}
                style={{
                  padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${ativo ? '#7a1e1e' : '#e0dcd8'}`,
                  background: ativo ? '#7a1e1e' : '#fff',
                  color: ativo ? '#fff' : '#888',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {dia}
              </button>
            )
          })}
        </div>
      </div>

      {/* Override por departamento */}
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🏢 Override por departamento</div>
      {deptConfigs.map(d => (
        <div key={d.departamento} style={{
          background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
          padding: '12px 16px', marginBottom: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: d.ativo ? 10 : 0 }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{DEPTO_LABELS_SIMPLES[d.departamento]}</div>
            {/* Toggle ativo */}
            <div
              onClick={() => setDeptConfigs(prev =>
                prev.map(x => x.departamento === d.departamento ? { ...x, ativo: !x.ativo } : x)
              )}
              style={{
                width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                background: d.ativo ? '#27ae60' : '#ccc', position: 'relative',
              }}
            >
              <div style={{
                position: 'absolute', width: 14, height: 14, background: '#fff', borderRadius: '50%',
                top: 3, left: d.ativo ? 19 : 3, transition: 'left 0.2s',
              }} />
            </div>
          </div>
          {d.ativo && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Campo
                label="Início (vazio = usa global)"
                value={d.horario_inicio || ''}
                type="time"
                onChange={v => setDeptConfigs(prev =>
                  prev.map(x => x.departamento === d.departamento ? { ...x, horario_inicio: v || null } : x)
                )}
              />
              <Campo
                label="Fim (vazio = usa global)"
                value={d.horario_fim || ''}
                type="time"
                onChange={v => setDeptConfigs(prev =>
                  prev.map(x => x.departamento === d.departamento ? { ...x, horario_fim: v || null } : x)
                )}
              />
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          onClick={salvar}
          disabled={salvando}
          style={{
            padding: '10px 24px', background: salvando ? '#9b6b6b' : '#7a1e1e', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
            cursor: salvando ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {salvando ? 'Salvando...' : '💾 Salvar horários'}
        </button>
      </div>
    </div>
  )
}

// ─── Aba Avaliações ────────────────────────────────────────────
function AbaAvaliacoes() {
  const [stats, setStats] = useState(null)
  const [avaliacoes, setAvaliacoes] = useState([])
  const [filtro, setFiltro] = useState({ departamento: '', inicio: '', fim: '' })

  useEffect(() => { carregar() }, [filtro])

  const carregar = async () => {
    const [s, avs] = await Promise.all([
      buscarMediaCsat(filtro),
      buscarAvaliacoesCsat({ ...filtro, limit: 30 }),
    ])
    setStats(s)
    setAvaliacoes(avs)
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={filtro.departamento}
          onChange={e => setFiltro(f => ({ ...f, departamento: e.target.value }))}
          style={{ padding: '7px 12px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13 }}
        >
          <option value="">Todos os departamentos</option>
          <option value="PESSOAL">Depto. Pessoal</option>
          <option value="CONTABIL">Contabilidade</option>
          <option value="TRIBUTARIO">Tributário / Fiscal</option>
          <option value="ADMINISTRATIVO">Administrativo</option>
        </select>
        <input
          type="date"
          value={filtro.inicio}
          onChange={e => setFiltro(f => ({ ...f, inicio: e.target.value }))}
          style={{ padding: '7px 12px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13 }}
        />
        <input
          type="date"
          value={filtro.fim}
          onChange={e => setFiltro(f => ({ ...f, fim: e.target.value }))}
          style={{ padding: '7px 12px', border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13 }}
        />
      </div>

      {stats && (
        <>
          {/* Card de média */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24, alignItems: 'flex-start' }}>
            <div style={{
              textAlign: 'center', padding: '16px 24px', background: '#f7f6f4',
              borderRadius: 10, minWidth: 120,
            }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: '#7a1e1e' }}>
                {stats.media ? Number(stats.media).toFixed(1) : '—'}
              </div>
              <div style={{ fontSize: 18, color: '#f59e0b' }}>
                {'★'.repeat(Math.round(stats.media || 0))}
                {'☆'.repeat(5 - Math.round(stats.media || 0))}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{stats.total} avaliações</div>
            </div>
            {/* Barras por estrela */}
            <div style={{ flex: 1 }}>
              {[5, 4, 3, 2, 1].map(n => {
                const count = stats.distribuicao?.[n] ?? 0
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                return (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, width: 20, textAlign: 'right' }}>{n}★</span>
                    <div style={{ flex: 1, background: '#e0dcd8', borderRadius: 4, height: 8 }}>
                      <div style={{ width: `${pct}%`, background: '#f59e0b', height: 8, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#888', width: 36 }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tabela de avaliações */}
          {avaliacoes.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f7f6f4', borderBottom: '1px solid #e0dcd8' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Nota</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Protocolo</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Departamento</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#555' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {avaliacoes.map(av => (
                    <tr key={av.id} style={{ borderBottom: '1px solid #f0ede8' }}>
                      <td style={{ padding: '8px 14px' }}>
                        {'★'.repeat(av.nota)}{'☆'.repeat(5 - av.nota)}
                      </td>
                      <td style={{ padding: '8px 14px', fontFamily: 'DM Mono, monospace', color: '#7a1e1e', fontSize: 11 }}>
                        {av.conversas?.protocolo ?? '—'}
                      </td>
                      <td style={{ padding: '8px 14px' }}>{av.conversas?.departamento ?? '—'}</td>
                      <td style={{ padding: '8px 14px', color: '#888' }}>
                        {av.criado_em ? new Date(av.criado_em).toLocaleDateString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {avaliacoes.length === 0 && stats.total === 0 && (
            <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
              Nenhuma avaliação encontrada para os filtros selecionados.
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Aba Calendário ────────────────────────────────────────────
const ANO_ATUAL = new Date().getFullYear()

const TIPO_BADGE = {
  FERIADO:   { bg: '#f8d7da', color: '#721c24', label: 'Feriado' },
  DATA_PICO: { bg: '#fff3cd', color: '#856404', label: 'Data-pico' },
}

function AbaCalendario() {
  const [ano, setAno] = useState(ANO_ATUAL)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [feriados, setFeriados] = useState([])
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ data: '', nome: '', tipo: 'FERIADO', msg_especifica: '' })
  const [adicionando, setAdicionando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregar = () =>
    buscarFeriados({ ano, tipo: filtroTipo || undefined }).then(setFeriados)

  useEffect(() => { carregar() }, [ano, filtroTipo])

  const salvarNovo = async () => {
    if (!form.data || !form.nome) return
    setSalvando(true)
    try {
      await criarFeriado({
        data: form.data,
        nome: form.nome,
        tipo: form.tipo,
        msg_especifica: form.msg_especifica || null,
      })
      setForm({ data: '', nome: '', tipo: 'FERIADO', msg_especifica: '' })
      setAdicionando(false)
      carregar()
    } finally { setSalvando(false) }
  }

  const salvarEdicao = async () => {
    if (!editando) return
    setSalvando(true)
    try {
      await atualizarFeriado(editando.id, {
        data: editando.data,
        nome: editando.nome,
        tipo: editando.tipo,
        msg_especifica: editando.msg_especifica || null,
      })
      setEditando(null)
      carregar()
    } finally { setSalvando(false) }
  }

  const toggleAtivo = async (f) => {
    await atualizarFeriado(f.id, { ativo: !f.ativo })
    carregar()
  }

  const remover = async (f) => {
    if (!confirm(`Remover "${f.nome}"?`)) return
    await excluirFeriado(f.id)
    carregar()
  }

  const badge = (tipo) => {
    const b = TIPO_BADGE[tipo] ?? { bg: '#e0dcd8', color: '#555', label: tipo }
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px',
        borderRadius: 4, background: b.bg, color: b.color }}>
        {b.label}
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 760 }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 3 }}>Ano</label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ border: '1px solid #e0dcd8', borderRadius: 6, padding: '5px 10px', fontSize: 13 }}>
            {[ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 3 }}>Tipo</label>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            style={{ border: '1px solid #e0dcd8', borderRadius: 6, padding: '5px 10px', fontSize: 13 }}>
            <option value="">Todos</option>
            <option value="FERIADO">Feriados</option>
            <option value="DATA_PICO">Datas-pico</option>
          </select>
        </div>
        <button
          onClick={() => { setAdicionando(true); setEditando(null) }}
          style={{ marginTop: 18, padding: '6px 14px', background: '#7a1e1e', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Adicionar
        </button>
      </div>

      {/* Formulário de adição */}
      {adicionando && (
        <div style={{ background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 8,
          padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#1a1a1a' }}>
            Novo evento
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 130px', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Data</div>
              <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e0dcd8',
                  borderRadius: 6, padding: '5px 8px', fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Nome</div>
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Feriado Municipal"
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e0dcd8',
                  borderRadius: 6, padding: '5px 8px', fontSize: 13 }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>Tipo</div>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e0dcd8', borderRadius: 6,
                  padding: '5px 8px', fontSize: 13 }}>
                <option value="FERIADO">Feriado</option>
                <option value="DATA_PICO">Data-pico fiscal</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 3 }}>
              Mensagem personalizada <span style={{ color: '#aaa' }}>(opcional — substitui o padrão)</span>
            </div>
            <textarea value={form.msg_especifica}
              onChange={e => setForm(f => ({ ...f, msg_especifica: e.target.value }))}
              rows={2} placeholder="Deixe em branco para usar a mensagem padrão do sistema"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e0dcd8',
                borderRadius: 6, padding: '6px 8px', fontSize: 12, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvarNovo} disabled={salvando}
              style={{ padding: '6px 16px', background: '#7a1e1e', color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button onClick={() => setAdicionando(false)}
              style={{ padding: '6px 14px', background: '#f0e8e8', color: '#7a1e1e',
                border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div style={{ border: '1px solid #e0dcd8', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f7f6f4', borderBottom: '1px solid #e0dcd8' }}>
              {['Data', 'Nome', 'Tipo', 'Mensagem personalizada', 'Ativo', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11,
                  fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {feriados.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
                Nenhum evento para {ano}
              </td></tr>
            )}
            {feriados.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid #f0ede8',
                opacity: f.ativo ? 1 : 0.45 }}>
                {editando?.id === f.id ? (
                  <>
                    <td style={{ padding: '6px 12px' }}>
                      <input type="date" value={editando.data}
                        onChange={e => setEditando(e2 => ({ ...e2, data: e.target.value }))}
                        style={{ border: '1px solid #e0dcd8', borderRadius: 4, padding: '3px 6px', fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <input value={editando.nome}
                        onChange={e => setEditando(e2 => ({ ...e2, nome: e.target.value }))}
                        style={{ width: '100%', border: '1px solid #e0dcd8', borderRadius: 4,
                          padding: '3px 6px', fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <select value={editando.tipo}
                        onChange={e => setEditando(e2 => ({ ...e2, tipo: e.target.value }))}
                        style={{ border: '1px solid #e0dcd8', borderRadius: 4, padding: '3px 6px', fontSize: 12 }}>
                        <option value="FERIADO">Feriado</option>
                        <option value="DATA_PICO">Data-pico</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <input value={editando.msg_especifica ?? ''}
                        onChange={e => setEditando(e2 => ({ ...e2, msg_especifica: e.target.value }))}
                        placeholder="Mensagem personalizada (opcional)"
                        style={{ width: '100%', border: '1px solid #e0dcd8', borderRadius: 4,
                          padding: '3px 6px', fontSize: 12 }} />
                    </td>
                    <td />
                    <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                      <button onClick={salvarEdicao} disabled={salvando}
                        style={{ marginRight: 4, padding: '3px 10px', background: '#7a1e1e',
                          color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                        {salvando ? '…' : 'OK'}
                      </button>
                      <button onClick={() => setEditando(null)}
                        style={{ padding: '3px 8px', background: '#f0e8e8', color: '#7a1e1e',
                          border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                        ✕
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: '8px 12px', fontFamily: 'DM Mono, monospace', color: '#555' }}>
                      {new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1a1a1a' }}>{f.nome}</td>
                    <td style={{ padding: '8px 12px' }}>{badge(f.tipo)}</td>
                    <td style={{ padding: '8px 12px', color: '#888480', maxWidth: 180,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.msg_especifica
                        ? <span title={f.msg_especifica}>{f.msg_especifica}</span>
                        : <span style={{ color: '#ccc', fontStyle: 'italic' }}>padrão</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div onClick={() => toggleAtivo(f)}
                        style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                          background: f.ativo ? '#27ae60' : '#ccc', position: 'relative' }}>
                        <div style={{ position: 'absolute', width: 14, height: 14, borderRadius: '50%',
                          background: '#fff', top: 3,
                          [f.ativo ? 'right' : 'left']: 3 }} />
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => { setEditando({ ...f }); setAdicionando(false) }}
                        style={{ marginRight: 4, padding: '3px 8px', background: '#cce5ff',
                          color: '#004085', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                        ✏️
                      </button>
                      <button onClick={() => remover(f)}
                        style={{ padding: '3px 8px', background: '#f8d7da', color: '#721c24',
                          border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                        🗑
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#888480' }}>
        <strong>Feriado:</strong> bot responde com mensagem de dia não útil e encerra a sessão. &nbsp;
        <strong>Data-pico:</strong> atendimento normal, mas a mensagem de fila inclui aviso de alta demanda.
      </div>
    </div>
  )
}

// ─── Componente principal ──────────────────────────────────────
export default function ChatbotPage() {
  const [aba, setAba] = useState('geral')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header da página */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #e0dcd8',
        background: '#fff', flexShrink: 0,
      }}>
        <h1 style={{
          fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700,
          color: '#1a1a1a', margin: 0,
        }}>
          🤖 Chatbot
        </h1>
        <p style={{ fontSize: 12, color: '#888480', margin: '4px 0 0' }}>
          Configure o chatbot de roteamento automático do WhatsApp
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e0dcd8', background: '#fff', flexShrink: 0 }}>
        {ABAS.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none', borderBottom: `2px solid ${aba === a.id ? '#7a1e1e' : 'transparent'}`,
              color: aba === a.id ? '#7a1e1e' : '#888480',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {aba === 'geral'      && <AbaGeral />}
        {aba === 'menus'      && <AbaMenus />}
        {aba === 'horarios'   && <AbaHorarios />}
        {aba === 'avaliacoes' && <AbaAvaliacoes />}
        {aba === 'calendario' && <AbaCalendario />}
      </div>
    </div>
  )
}
