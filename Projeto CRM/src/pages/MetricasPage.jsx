import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { buscarMetricas } from '@/services/crm.service'

const DEPTO_CORES = {
  PESSOAL:        '#3B82F6',
  CONTABIL:       '#10B981',
  ADMINISTRATIVO: '#F59E0B',
  TRIBUTARIO:     '#8B5CF6',
}

export default function MetricasPage() {
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    buscarMetricas().then(m => { setMetricas(m); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ padding: 40, color: '#888480', fontSize: 14 }}>Carregando métricas...</div>
  )
  if (!metricas) return null

  const kpis = [
    { label: 'Conversas abertas',    value: metricas.abertas,       color: '#888480' },
    { label: 'Em atendimento',        value: metricas.emAtendimento, color: '#2d7a4f' },
    { label: 'Encerradas hoje',       value: metricas.encerradasHoje, color: '#7a1e1e' },
  ]

  const pieData = Object.entries(metricas.porDepto)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)

  return (
    <div style={{ padding: 28, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontFamily: 'Merriweather, serif', fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 24, marginTop: 0 }}>
        Dashboard de Métricas
      </h2>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            background: '#fff', border: '1px solid #e0dcd8',
            borderRadius: 10, padding: '18px 20px',
            borderLeft: `4px solid ${k.color}`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, fontFamily: 'DM Mono, monospace' }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: '#888480', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Gráfico rosca por departamento */}
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 16, marginTop: 0 }}>
            Conversas por Departamento
          </h3>
          {pieData.length === 0 ? (
            <p style={{ color: '#888480', fontSize: 13 }}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={DEPTO_CORES[entry.name] ?? '#888480'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ranking de agentes */}
        <div style={{ background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10, padding: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 16, marginTop: 0 }}>
            Ranking Agentes (conversas encerradas)
          </h3>
          {metricas.rankingAgentes.length === 0 ? (
            <p style={{ color: '#888480', fontSize: 13 }}>Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={metricas.rankingAgentes} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="total" fill="#7a1e1e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
