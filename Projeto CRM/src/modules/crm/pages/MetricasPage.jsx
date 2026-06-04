import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  buscarMetricasKPI,
  buscarDistribuicaoDepartamento,
  buscarVolumeUltimosDias,
  buscarRankingAgentes,
} from '../services/crm.service'
import { BadgeDepartamento } from '../components/shared/BadgeDepartamento'

const CORES_DEPTO = {
  PESSOAL:        '#3B82F6',
  CONTABIL:       '#10B981',
  ADMINISTRATIVO: '#F59E0B',
  TRIBUTARIO:     '#8B5CF6',
}

const NOMES_DEPTO = {
  PESSOAL: 'Pessoal', CONTABIL: 'Contábil', ADMINISTRATIVO: 'Administrativo', TRIBUTARIO: 'Tributário',
}

function KPICard({ label, valor, cor }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e0dcd8',
      borderRadius: 8,
      padding: '20px 24px',
      flex: 1,
      minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: '#888480', marginBottom: 6, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: cor || '#1a1a1a', fontFamily: 'DM Mono, monospace' }}>
        {valor ?? '–'}
      </div>
    </div>
  )
}

export function MetricasPage() {
  const [kpi, setKpi]               = useState(null)
  const [distribuicao, setDistr]    = useState([])
  const [volume, setVolume]         = useState([])
  const [ranking, setRanking]       = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      buscarMetricasKPI(),
      buscarDistribuicaoDepartamento(),
      buscarVolumeUltimosDias(7),
      buscarRankingAgentes(),
    ])
      .then(([k, d, v, r]) => {
        setKpi(k); setDistr(d); setVolume(v); setRanking(r)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888480' }}>
        Carregando métricas...
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', background: '#f2f2f0' }}>
      <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 24 }}>
        Métricas
      </h1>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <KPICard label="Conversas abertas"       valor={kpi?.abertas}        cor="#3B82F6" />
        <KPICard label="Em atendimento"          valor={kpi?.emAtendimento}  cor="#10B981" />
        <KPICard label="Encerradas hoje"         valor={kpi?.encerradasHoje} cor="#7a1e1e" />
      </div>

      {/* Gráficos lado a lado */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 28, flexWrap: 'wrap' }}>
        {/* Rosca — por departamento */}
        <div style={{
          background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
          padding: '20px', flex: '0 0 300px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 16 }}>
            Distribuição por departamento
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={distribuicao}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                label={({ name, percent }) =>
                  percent > 0 ? `${NOMES_DEPTO[name] || name} ${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
              >
                {distribuicao.map(entry => (
                  <Cell key={entry.name} fill={CORES_DEPTO[entry.name] || '#ccc'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, NOMES_DEPTO[n] || n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Barras — volume diário */}
        <div style={{
          background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
          padding: '20px', flex: 1, minWidth: 280,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 16 }}>
            Volume — últimos 7 dias
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="data"
                tick={{ fontSize: 11, fontFamily: 'DM Mono, monospace' }}
                tickFormatter={d => d.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(v) => [v, 'Conversas']}
                labelFormatter={l => `Data: ${l}`}
              />
              <Bar dataKey="total" fill="#7a1e1e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ranking de agentes */}
      <div style={{
        background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8, padding: '20px',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 16 }}>
          Ranking de agentes
        </div>

        {ranking.length === 0 ? (
          <p style={{ color: '#888480', fontSize: 13 }}>Sem dados</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e0dcd8' }}>
                {['#', 'Agente', 'Departamento', 'Atendimentos'].map(col => (
                  <th key={col} style={{
                    textAlign: 'left', padding: '6px 8px', fontSize: 11,
                    color: '#888480', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.agente?.id || i} style={{ borderBottom: '1px solid #f0ede9' }}>
                  <td style={{ padding: '8px', color: '#888480', fontFamily: 'DM Mono, monospace' }}>{i + 1}</td>
                  <td style={{ padding: '8px', fontWeight: 500 }}>{r.agente?.nome || '–'}</td>
                  <td style={{ padding: '8px' }}>
                    <BadgeDepartamento departamento={r.agente?.departamento} size="xs" />
                  </td>
                  <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: '#7a1e1e' }}>
                    {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
