import { useState, useEffect } from 'react'

// Exportado separado para facilitar testes unitários futuros.
export function calcSLAStatus(conversa, slaConfig) {
  if (conversa.status !== 'ABERTA') {
    return { sla_status: 'OK', sla_tempo_restante_ms: null }
  }
  const temMsgAgente = conversa.mensagens?.some(m => m.origem === 'AGENTE') ?? false
  if (temMsgAgente) {
    return { sla_status: 'OK', sla_tempo_restante_ms: null }
  }

  const cfg = slaConfig.find(c => c.departamento === conversa.departamento)
  if (!cfg || !cfg.ativo) {
    return { sla_status: 'OK', sla_tempo_restante_ms: null }
  }

  const maxMs     = cfg.tempo_maximo_min      * 60_000
  const avisoMs   = cfg.threshold_aviso_min   * 60_000
  const criticoMs = cfg.threshold_critico_min * 60_000
  const elapsed   = Date.now() - new Date(conversa.aberto_em).getTime()
  const restante  = maxMs - elapsed

  if (restante <= 0)        return { sla_status: 'VENCIDO', sla_tempo_restante_ms: 0 }
  if (restante <= criticoMs) return { sla_status: 'CRITICO', sla_tempo_restante_ms: restante }
  if (restante <= avisoMs)   return { sla_status: 'AVISO',   sla_tempo_restante_ms: restante }
  return { sla_status: 'OK', sla_tempo_restante_ms: restante }
}

export function useSLA(conversas, slaConfig) {
  const [conversasComSLA, setConversasComSLA] = useState(() =>
    conversas.map(c => ({ ...c, ...calcSLAStatus(c, slaConfig) }))
  )

  useEffect(() => {
    const calc = () =>
      setConversasComSLA(conversas.map(c => ({ ...c, ...calcSLAStatus(c, slaConfig) })))

    calc()
    const id = setInterval(calc, 1_000)
    return () => clearInterval(id)
  }, [conversas, slaConfig])

  return conversasComSLA
}
