import { useState, useEffect } from 'react'
import { buscarSLAConfig, salvarSLAConfig, buscarClassificacaoSLAConfig, salvarClassificacaoSLAConfig } from '@/services/crm.service'

const DEPTOS = [
  { key: 'PESSOAL',        label: 'Pessoal',        color: '#1D4ED8' },
  { key: 'CONTABIL',       label: 'Contábil',       color: '#065F46' },
  { key: 'ADMINISTRATIVO', label: 'Administrativo', color: '#92400E' },
  { key: 'TRIBUTARIO',     label: 'Tributário',     color: '#5B21B6' },
]

const TIERS = [
  { key: 'OURO',              label: '🥇 Ouro',           color: '#b8860b' },
  { key: 'PRATA',             label: '🥈 Prata',          color: '#708090' },
  { key: 'BRONZE',            label: '🥉 Bronze',         color: '#8b4513' },
  { key: 'SEM_CLASSIFICACAO', label: 'Sem classificação', color: '#888480' },
]

function NumInput({ value, onChange, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
      <input
        type="number"
        min={1}
        max={480}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: 52,
          padding: '5px 8px',
          border: `1px solid ${color}55`,
          borderRadius: 5,
          fontSize: 13,
          fontFamily: 'DM Mono, monospace',
          textAlign: 'center',
          color,
          fontWeight: 600,
          outline: 'none',
          background: `${color}08`,
        }}
      />
      <span style={{ fontSize: 11, color: '#888480' }}>min</span>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: value ? '#2d7a4f' : '#e0dcd8',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        margin: '0 auto',
        display: 'block',
      }}
    >
      <div style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: 3,
        left: value ? 18 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export default function SLAConfigPage() {
  const [config, setConfig]                         = useState([])
  const [multConfig, setMultConfig]                 = useState([])
  const [loading, setLoading]                       = useState(true)
  const [salvando, setSalvando]                     = useState(false)
  const [salvandoMult, setSalvandoMult]             = useState(false)
  const [erro, setErro]                             = useState('')
  const [sucesso, setSucesso]                       = useState(false)
  const [sucessoMult, setSucessoMult]               = useState(false)

  useEffect(() => {
    Promise.all([buscarSLAConfig(), buscarClassificacaoSLAConfig()])
      .then(([sla, mult]) => { setConfig(sla); setMultConfig(mult); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const set = (departamento, campo, valor) =>
    setConfig(prev => prev.map(c => c.departamento === departamento ? { ...c, [campo]: valor } : c))

  const handleSalvar = async () => {
    setErro('')
    setSucesso(false)
    for (const c of config) {
      if (!c.ativo) continue
      if (c.threshold_critico_min >= c.threshold_aviso_min) {
        setErro(`${c.departamento}: threshold crítico (${c.threshold_critico_min} min) deve ser menor que aviso (${c.threshold_aviso_min} min).`)
        return
      }
      if (c.threshold_aviso_min >= c.tempo_maximo_min) {
        setErro(`${c.departamento}: threshold aviso (${c.threshold_aviso_min} min) deve ser menor que tempo máximo (${c.tempo_maximo_min} min).`)
        return
      }
    }
    setSalvando(true)
    try {
      await salvarSLAConfig(config)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3_000)
    } catch (e) {
      setErro(e.message || 'Erro ao salvar configurações.')
    } finally {
      setSalvando(false)
    }
  }

  const handleSalvarMult = async () => {
    setSalvandoMult(true)
    setSucessoMult(false)
    setErro('')
    try {
      await salvarClassificacaoSLAConfig(multConfig)
      setSucessoMult(true)
      setTimeout(() => setSucessoMult(false), 3_000)
    } catch (e) {
      setErro(e.message || 'Erro ao salvar multiplicadores.')
    } finally {
      setSalvandoMult(false)
    }
  }

  const setMult = (key, valor) =>
    setMultConfig(prev => prev.map(r => r.classificacao === key ? { ...r, multiplicador: valor } : r))

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#888480', fontSize: 13 }}>
      Carregando...
    </div>
  )

  const thStyle = {
    fontSize: 9, fontWeight: 700, color: '#888480',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    padding: '6px 10px', textAlign: 'center',
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          ⏱ Configuração de SLA
        </h1>
        <p style={{ fontSize: 12, color: '#888480', margin: '6px 0 0', lineHeight: 1.6 }}>
          Tempo máximo de atendimento inicial por departamento. O relógio começa quando a conversa é criada
          e para quando o agente assume ou envia a primeira mensagem.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, overflow: 'hidden' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 1fr 80px', background: '#f7f6f4', borderBottom: '1px solid #e0dcd8' }}>
          <div style={{ ...thStyle, textAlign: 'left', paddingLeft: 16 }}>Departamento</div>
          <div style={thStyle}>Tempo máximo</div>
          <div style={{ ...thStyle, color: '#b87a00' }}>⚑ Aviso (restam)</div>
          <div style={{ ...thStyle, color: '#b83232' }}>⚑ Crítico (restam)</div>
          <div style={thStyle}>Ativo</div>
        </div>

        {DEPTOS.map((d, i) => {
          const row = config.find(c => c.departamento === d.key)
          if (!row) return null
          return (
            <div
              key={d.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr 1fr 1fr 80px',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < DEPTOS.length - 1 ? '1px solid #f0ede9' : 'none',
                borderLeft: `3px solid ${d.color}`,
                opacity: row.ativo ? 1 : 0.5,
              }}
            >
              <div style={{ paddingLeft: 13, fontSize: 12, fontWeight: 700, color: d.color }}>{d.label}</div>
              <NumInput value={row.tempo_maximo_min}      onChange={v => set(d.key, 'tempo_maximo_min', v)}      color="#1a1a1a" />
              <NumInput value={row.threshold_aviso_min}   onChange={v => set(d.key, 'threshold_aviso_min', v)}   color="#b87a00" />
              <NumInput value={row.threshold_critico_min} onChange={v => set(d.key, 'threshold_critico_min', v)} color="#b83232" />
              <div style={{ textAlign: 'center' }}>
                <Toggle value={row.ativo} onChange={v => set(d.key, 'ativo', v)} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Multiplicadores por classificação */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
          ⚡ Multiplicadores de SLA por classificação
        </h2>
        <p style={{ fontSize: 12, color: '#888480', margin: '0 0 14px', lineHeight: 1.6 }}>
          SLA efetivo = tempo máximo do departamento × multiplicador. Quanto menor, mais rápido o atendimento exigido.
        </p>
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', background: '#f7f6f4', borderBottom: '1px solid #e0dcd8' }}>
            <div style={{ ...thStyle, textAlign: 'left', paddingLeft: 16 }}>Classificação</div>
            <div style={thStyle}>Multiplicador</div>
            <div style={thStyle}>Exemplo (maior depto)</div>
          </div>
          {TIERS.map((t, i) => {
            const row = multConfig.find(r => r.classificacao === t.key)
            if (!row) return null
            const maiorDepto = config.reduce((max, c) => c.ativo && c.tempo_maximo_min > max ? c.tempo_maximo_min : max, 0)
            const efetivo = Math.round(maiorDepto * row.multiplicador)
            const h = Math.floor(efetivo / 60)
            const m = efetivo % 60
            return (
              <div key={t.key} style={{
                display: 'grid', gridTemplateColumns: '180px 1fr 1fr',
                alignItems: 'center', padding: '10px 0',
                borderBottom: i < TIERS.length - 1 ? '1px solid #f0ede9' : 'none',
                borderLeft: `3px solid ${t.color}`,
              }}>
                <div style={{ paddingLeft: 13, fontSize: 12, fontWeight: 700, color: t.color }}>{t.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <input
                    type="number" min={0.1} max={5} step={0.05}
                    value={row.multiplicador}
                    onChange={e => setMult(t.key, parseFloat(e.target.value) || 1)}
                    style={{
                      width: 100, padding: '7px 10px',
                      border: `1px solid ${t.color}55`, borderRadius: 5,
                      fontSize: 15, fontFamily: 'DM Mono, monospace',
                      textAlign: 'center', color: t.color, fontWeight: 600,
                      outline: 'none', background: `${t.color}08`,
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#888480' }}>×</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#888480', fontFamily: 'DM Mono, monospace' }}>
                  {maiorDepto > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : '—'}
                </div>
              </div>
            )
          })}
        </div>
        {sucessoMult && (
          <div style={{ marginTop: 10, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: 12 }}>
            Multiplicadores salvos com sucesso.
          </div>
        )}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSalvarMult}
            disabled={salvandoMult}
            style={{
              padding: '9px 24px', background: salvandoMult ? '#9b6b6b' : '#7a1e1e',
              color: '#fff', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: salvandoMult ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {salvandoMult ? 'Salvando...' : 'Salvar multiplicadores'}
          </button>
        </div>
      </div>

      {/* Legenda */}
      <div style={{ marginTop: 12, fontSize: 11, color: '#888480', lineHeight: 1.7 }}>
        <strong>Aviso:</strong> minutos restantes para exibir alerta amarelo &nbsp;|&nbsp;
        <strong>Crítico:</strong> minutos restantes para alerta vermelho piscando &nbsp;|&nbsp;
        Crítico &lt; Aviso &lt; Tempo máximo
      </div>

      {/* Feedback */}
      {erro && (
        <div style={{ marginTop: 12, padding: '8px 14px', background: '#fff5f5', border: '1px solid #fde8e8', borderRadius: 6, color: '#b83232', fontSize: 12 }}>
          {erro}
        </div>
      )}
      {sucesso && (
        <div style={{ marginTop: 12, padding: '8px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: 12 }}>
          Configurações salvas com sucesso.
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSalvar}
          disabled={salvando}
          style={{
            padding: '9px 24px',
            background: salvando ? '#9b6b6b' : '#7a1e1e',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: salvando ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}
