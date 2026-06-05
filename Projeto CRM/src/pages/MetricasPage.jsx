import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabaseClient'
import {
  calcPeriodo,
  buscarMetricasVivo,
  buscarMetricasGeral,
  buscarMetricasEquipe,
  buscarMetricasTempo,
  buscarMetricasQualidade,
} from '@/services/crm.service'

// ─── Paleta ────────────────────────────────────────────────────
const COR = {
  primary: '#7a1e1e',
  green:   '#2d7a4f',
  amber:   '#b87a00',
  blue:    '#3B82F6',
  gray:    '#888480',
  PESSOAL:        '#3B82F6',
  CONTABIL:       '#10B981',
  ADMINISTRATIVO: '#F59E0B',
  TRIBUTARIO:     '#8B5CF6',
}

function fmtMin(mins) {
  if (!mins && mins !== 0) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h${m}m` : `${h}h`
}

function Delta({ value, unit = '%', invert = false }) {
  if (value === null || value === undefined) return null
  const bom   = invert ? value < 0 : value > 0
  const ruim  = invert ? value > 0 : value < 0
  const cor   = value === 0 ? COR.gray : bom ? COR.green : '#b83232'
  const sinal = value > 0 ? '↑' : value < 0 ? '↓' : '='
  const txt   = value === 0 ? '= estável' : `${sinal} ${Math.abs(value)}${unit} vs período ant.`
  return <div style={{ fontSize: 10, fontWeight: 600, color: cor, marginTop: 4 }}>{txt}</div>
}

function KpiCard({ value, label, delta, deltaUnit = '%', deltaInvert = false, cor = COR.primary }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
      padding: '12px 14px', borderLeft: `3px solid ${cor}`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: cor, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: COR.gray, marginTop: 3, lineHeight: 1.4 }}>{label}</div>
      <Delta value={delta} unit={deltaUnit} invert={deltaInvert} />
    </div>
  )
}

function ChartBox({ title, children, style }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: '14px 16px', ...style }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

function TabLoading() {
  return <div style={{ padding: '56px 0', textAlign: 'center', color: COR.gray, fontSize: 13 }}>Carregando...</div>
}

function SemDados() {
  return <div style={{ padding: '56px 0', textAlign: 'center', color: '#c5c0ba', fontSize: 13 }}>Sem dados para o período selecionado.</div>
}

const KPIS_GRID = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }
const CHART_GRID = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

// ─── Faixa Ao Vivo ─────────────────────────────────────────────
function LiveStrip() {
  const [dados, setDados] = useState(null)

  const carregar = useCallback(async () => {
    try { setDados(await buscarMetricasVivo()) } catch {}
  }, [])

  useEffect(() => {
    carregar()
    const ch = supabase
      .channel('metricas-vivo-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversas' }, carregar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [carregar])

  const tile = (val, label, cor) => (
    <div style={{
      background: '#f7f6f4', border: '1px solid #e0dcd8', borderRadius: 6,
      padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: cor, lineHeight: 1 }}>
        {dados ? val : '—'}
      </div>
      <div style={{ fontSize: 10, color: COR.gray, lineHeight: 1.4 }}>{label}</div>
    </div>
  )

  return (
    <div style={{
      background: '#fff', borderBottom: '1px solid #e0dcd8',
      padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    }}>
      <div style={{
        background: COR.green, color: '#fff', fontSize: 9, fontWeight: 700,
        borderRadius: 10, padding: '2px 8px', letterSpacing: '.06em',
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block',
          animation: 'pulse-dot 1.5s ease-in-out infinite',
        }} />
        AO VIVO
      </div>

      {tile(dados?.aberta,        <>Aguardando<br />atendimento</>, COR.gray)}
      {tile(dados?.emAtendimento, <>Em<br />atendimento</>,         COR.green)}
      {tile(dados?.aguardando,    <>Aguardando<br />cliente</>,     COR.amber)}

      <div style={{ width: 1, height: 28, background: '#e0dcd8', margin: '0 4px', flexShrink: 0 }} />
      {tile(dados?.agentesAtivos, <>Agentes<br />ativos</>,         COR.primary)}

      <div style={{ marginLeft: 'auto', fontSize: 10, color: '#c5c0ba', flexShrink: 0 }}>
        Tempo real · Supabase Realtime
      </div>

      <style>{`@keyframes pulse-dot{0%,100%{opacity:.9}50%{opacity:.3}}`}</style>
    </div>
  )
}

// ─── Seletor de período ────────────────────────────────────────
function PeriodoSelector({ tipo, setTipo, customInicio, setCustomInicio, customFim, setCustomFim }) {
  const opcoes = [
    { id: 'hoje', label: 'Hoje' },
    { id: '7d',   label: '7 dias' },
    { id: 'mes',  label: 'Mês' },
    { id: 'custom', label: 'Personalizado' },
  ]
  const btnStyle = (ativo) => ({
    padding: '5px 12px', borderRadius: 5, border: '1px solid',
    borderColor: ativo ? COR.primary : '#e0dcd8',
    background:  ativo ? COR.primary : '#fff',
    color:       ativo ? '#fff'       : COR.gray,
    fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {opcoes.map(o => (
        <button key={o.id} style={btnStyle(tipo === o.id)} onClick={() => setTipo(o.id)}>
          {o.label}
        </button>
      ))}
      {tipo === 'custom' && (
        <>
          <input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #e0dcd8', borderRadius: 5, fontSize: 11, fontFamily: 'DM Sans, sans-serif' }} />
          <span style={{ fontSize: 11, color: COR.gray }}>→</span>
          <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #e0dcd8', borderRadius: 5, fontSize: 11, fontFamily: 'DM Sans, sans-serif' }} />
        </>
      )}
    </div>
  )
}

// ─── Aba Geral ─────────────────────────────────────────────────
function AbaGeral({ periodo }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!periodo) return
    setLoading(true)
    buscarMetricasGeral(periodo)
      .then(d => { setDados(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periodo])

  if (loading) return <TabLoading />
  if (!dados)  return <SemDados />

  const pieData = Object.entries(dados.porDepto)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  return (
    <div>
      <div style={KPIS_GRID}>
        <KpiCard value={dados.total}        label="Total de conversas"   delta={dados.deltaTotalPct}      cor={COR.primary} />
        <KpiCard value={dados.encerradas}   label="Encerradas"           delta={dados.deltaEncerradasPct} cor={COR.green}   />
        <KpiCard value={dados.abertas}      label="Abertas / pendentes"  delta={null}                     cor={COR.amber}   />
        <KpiCard value={`${dados.taxaResolucao}%`} label="Taxa de resolução" delta={dados.deltaTaxaPp} deltaUnit="pp" cor={COR.blue} />
      </div>

      <div style={CHART_GRID}>
        <ChartBox title="Volume diário de conversas">
          {dados.volumePorDia.length === 0 ? <SemDados /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dados.volumePorDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: '1px solid #e0dcd8', borderRadius: 6 }}
                  formatter={(v) => [v, 'Conversas']}
                />
                <Bar dataKey="total" fill={COR.primary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBox>

        <ChartBox title="Conversas por departamento">
          {pieData.length === 0 ? <SemDados /> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72}
                  dataKey="value" paddingAngle={3}>
                  {pieData.map(e => <Cell key={e.name} fill={COR[e.name] ?? COR.gray} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, border: '1px solid #e0dcd8', borderRadius: 6 }} />
                <Legend formatter={v => <span style={{ fontSize: 10 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartBox>
      </div>
    </div>
  )
}

// ─── Aba Equipe ────────────────────────────────────────────────
function AbaEquipe({ periodo }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!periodo) return
    setLoading(true)
    buscarMetricasEquipe(periodo)
      .then(d => { setDados(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periodo])

  if (loading) return <TabLoading />
  if (!dados)  return <SemDados />

  const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']

  return (
    <div>
      <div style={KPIS_GRID}>
        <KpiCard value={dados.agentesAtivos}     label="Agentes com atend. no período" cor={COR.primary} />
        <KpiCard value={dados.mediaConvs}         label="Conversas encerradas/agente"  cor={COR.green}   />
        <KpiCard value={dados.maiorCarga}         label="Maior volume (1 agente)"       cor={COR.amber}   />
        <KpiCard value={`${dados.taxaTransferencia}%`} label="Taxa de transferência"   cor={COR.blue} deltaInvert />
      </div>

      <div style={CHART_GRID}>
        <ChartBox title="Ranking — conversas encerradas por agente">
          {dados.ranking.length === 0 ? <SemDados /> : (
            <div>
              {dados.ranking.map((r, i) => (
                <div key={r.nome} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 0', borderBottom: i < dados.ranking.length - 1 ? '1px solid #f0ede9' : 'none',
                }}>
                  <div style={{ width: 16, fontSize: 10, fontWeight: 700, color: COR.gray, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 12 }}>{r.nome}</div>
                  <div style={{ width: 90, background: '#f0ede9', borderRadius: 3, height: 6, flexShrink: 0 }}>
                    <div style={{ width: `${r.pct}%`, height: 6, borderRadius: 3, background: COR.primary }} />
                  </div>
                  <div style={{ width: 24, fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: COR.primary, textAlign: 'right', flexShrink: 0 }}>
                    {r.total}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartBox>

        <ChartBox title="Carga atual por departamento">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {DEPTOS.map(d => (
              <div key={d} style={{
                background: '#f7f6f4', borderRadius: 6, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: COR[d] ?? COR.gray, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: COR.gray, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: '#1a1a1a' }}>
                    {dados.cargaDepto[d] ?? 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {(() => {
            const maxDepto = Object.entries(dados.cargaDepto).sort(([,a],[,b]) => b - a)[0]
            return maxDepto && maxDepto[1] > 2 ? (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '7px 10px', fontSize: 10, color: '#92400e' }}>
                💡 <strong>{maxDepto[0].charAt(0) + maxDepto[0].slice(1).toLowerCase()}</strong> está com maior carga ({maxDepto[1]} conversas abertas).
              </div>
            ) : null
          })()}
        </ChartBox>
      </div>
    </div>
  )
}

// ─── Aba Tempo ─────────────────────────────────────────────────
function AbaTempo({ periodo }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!periodo) return
    setLoading(true)
    buscarMetricasTempo(periodo)
      .then(d => { setDados(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periodo])

  if (loading) return <TabLoading />
  if (!dados || dados.tma === 0) return <SemDados />

  const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
  const barData = DEPTOS
    .filter(d => dados.tmaPorDepto[d] != null)
    .map(d => ({ name: d.charAt(0) + d.slice(1).toLowerCase(), tma: dados.tmaPorDepto[d], fill: COR[d] }))

  return (
    <div>
      <div style={{ ...KPIS_GRID, gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <KpiCard value={fmtMin(dados.tma)}      label="TMA — Tempo médio de atendimento" cor={COR.primary} />
        <KpiCard value={fmtMin(dados.maiorTma)}  label="Maior tempo registrado no período" cor={COR.amber}   />
        <KpiCard value={`${dados.distribuicao[0]?.pct ?? 0}%`} label="Resolvidos em até 10 minutos" cor={COR.green} />
      </div>

      <div style={CHART_GRID}>
        <ChartBox title="TMA por departamento">
          {barData.length === 0 ? <SemDados /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}m`} />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: '1px solid #e0dcd8', borderRadius: 6 }}
                  formatter={(v) => [`${v} min`, 'TMA']}
                />
                <Bar dataKey="tma" radius={[3, 3, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartBox>

        <ChartBox title="Distribuição de tempos de atendimento">
          <div style={{ marginTop: 8 }}>
            {dados.distribuicao.map(d => (
              <div key={d.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid #f0ede9',
              }}>
                <div>
                  <div style={{ fontSize: 12 }}>{d.label}</div>
                  <div style={{ fontSize: 10, color: COR.gray, marginTop: 1 }}>{d.sub}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 80, background: '#f0ede9', borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${d.pct}%`, height: 6, borderRadius: 4, background: d.cor }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: d.cor, width: 34, textAlign: 'right' }}>
                    {d.pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ChartBox>
      </div>
    </div>
  )
}

// ─── Aba Qualidade ─────────────────────────────────────────────
function AbaQualidade({ periodo }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!periodo) return
    setLoading(true)
    buscarMetricasQualidade(periodo)
      .then(d => { setDados(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [periodo])

  if (loading) return <TabLoading />
  if (!dados)  return <SemDados />

  const DEPTOS = ['PESSOAL', 'CONTABIL', 'ADMINISTRATIVO', 'TRIBUTARIO']
  const corResolucao = (pct) => pct >= 80 ? COR.green : pct >= 60 ? COR.amber : '#b83232'

  return (
    <div>
      <div style={KPIS_GRID}>
        <KpiCard value={`${dados.taxaResolucao}%`}     label="Taxa de resolução geral"      cor={COR.green}   />
        <KpiCard value={`${dados.taxaTransferencia}%`} label="Taxa de transferência"         cor={COR.primary} deltaInvert />
        <KpiCard value={dados.mediaMsgs}               label="Mensagens por conversa (média)" cor={COR.blue}    />
        <KpiCard
          value={`${Math.min(...Object.values(dados.resolucaoPorDepto).filter(v => v > 0)) || 0}%`}
          label="Menor resolução (departamento)"
          cor={COR.amber}
        />
      </div>

      <div style={CHART_GRID}>
        <ChartBox title="Taxa de resolução por departamento">
          <div>
            {DEPTOS.filter(d => dados.resolucaoPorDepto[d] != null).map(d => {
              const pct = dados.resolucaoPorDepto[d] ?? 0
              return (
                <div key={d} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0', borderBottom: '1px solid #f0ede9',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COR[d] ?? COR.gray, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 12 }}>{d.charAt(0) + d.slice(1).toLowerCase()}</div>
                  <div style={{ width: 90, background: '#f0ede9', borderRadius: 3, height: 6 }}>
                    <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: corResolucao(pct) }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: corResolucao(pct), width: 36, textAlign: 'right' }}>
                    {pct}%
                  </div>
                </div>
              )
            })}
          </div>
        </ChartBox>

        <ChartBox title="Motivos de transferência">
          {dados.motivosTransferencia.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#c5c0ba', fontSize: 12 }}>
              Nenhuma transferência no período.
            </div>
          ) : (
            <div>
              {dados.motivosTransferencia.map((m, i) => {
                const max = dados.motivosTransferencia[0].count
                return (
                  <div key={m.motivo} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 0', borderBottom: i < dados.motivosTransferencia.length - 1 ? '1px solid #f0ede9' : 'none',
                  }}>
                    <div style={{ flex: 1, fontSize: 11, lineHeight: 1.3 }}>{m.motivo}</div>
                    <div style={{ width: 70, background: '#f0ede9', borderRadius: 3, height: 6, flexShrink: 0 }}>
                      <div style={{ width: `${Math.round((m.count / max) * 100)}%`, height: 6, borderRadius: 3, background: COR.primary }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: COR.primary, width: 20, textAlign: 'right', flexShrink: 0 }}>
                      {m.count}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartBox>
      </div>
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────
const ABAS = [
  { id: 'geral',      label: 'Geral'      },
  { id: 'equipe',     label: 'Equipe'     },
  { id: 'tempo',      label: 'Tempo'      },
  { id: 'qualidade',  label: 'Qualidade'  },
]

export default function MetricasPage() {
  const [tipoPeriodo,   setTipoPeriodo]   = useState('hoje')
  const [customInicio,  setCustomInicio]  = useState('')
  const [customFim,     setCustomFim]     = useState('')
  const [abaAtiva,      setAbaAtiva]      = useState('geral')

  const periodo = calcPeriodo(tipoPeriodo, customInicio, customFim)

  const tabStyle = (ativo) => ({
    padding: '10px 16px', fontSize: 12, fontWeight: ativo ? 600 : 500,
    color: ativo ? COR.primary : COR.gray, cursor: 'pointer',
    background: 'none', border: 'none',
    borderBottom: `2px solid ${ativo ? COR.primary : 'transparent'}`,
    fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f7f6f4' }}>

      {/* Header */}
      <div style={{
        padding: '12px 20px', background: COR.primary,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
          Dashboard de Métricas
        </h2>
        <PeriodoSelector
          tipo={tipoPeriodo} setTipo={setTipoPeriodo}
          customInicio={customInicio} setCustomInicio={setCustomInicio}
          customFim={customFim} setCustomFim={setCustomFim}
        />
      </div>

      {/* Live Strip */}
      <LiveStrip />

      {/* Tab Bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e0dcd8',
        display: 'flex', padding: '0 20px', flexShrink: 0,
      }}>
        {ABAS.map(a => (
          <button key={a.id} style={tabStyle(abaAtiva === a.id)} onClick={() => setAbaAtiva(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {!periodo ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: COR.gray, fontSize: 13 }}>
            Selecione as datas para visualizar as métricas.
          </div>
        ) : (
          <>
            {abaAtiva === 'geral'     && <AbaGeral     periodo={periodo} />}
            {abaAtiva === 'equipe'    && <AbaEquipe    periodo={periodo} />}
            {abaAtiva === 'tempo'     && <AbaTempo     periodo={periodo} />}
            {abaAtiva === 'qualidade' && <AbaQualidade periodo={periodo} />}
          </>
        )}
      </div>

    </div>
  )
}
