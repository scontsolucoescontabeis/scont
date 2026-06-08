import { useState, useEffect } from 'react'

export function calcSLAStatus(conversa, slaConfig, classificacaoConfig = []) {
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

  const tierKey = conversa.classificacao_empresa ?? 'SEM_CLASSIFICACAO'
  const mult    = classificacaoConfig.find(r => r.classificacao === tierKey)?.multiplicador ?? 1.0

  const maxMs     = cfg.tempo_maximo_min      * mult * 60_000
  const avisoMs   = cfg.threshold_aviso_min         * 60_000
  const criticoMs = cfg.threshold_critico_min       * 60_000
  const elapsed   = Date.now() - new Date(conversa.aberto_em).getTime()
  const restante  = maxMs - elapsed

  if (restante <= 0)         return { sla_status: 'VENCIDO', sla_tempo_restante_ms: 0 }
  if (restante <= criticoMs) return { sla_status: 'CRITICO', sla_tempo_restante_ms: restante }
  if (restante <= avisoMs)   return { sla_status: 'AVISO',   sla_tempo_restante_ms: restante }
  return { sla_status: 'OK', sla_tempo_restante_ms: restante }
}

export function useSLA(conversas, slaConfig, classificacaoConfig = []) {
  const [conversasComSLA, setConversasComSLA] = useState(() =>
    conversas.map(c => ({ ...c, ...calcSLAStatus(c, slaConfig, classificacaoConfig) }))
  )

  useEffect(() => {
    const calc = () =>
      setConversasComSLA(conversas.map(c => ({ ...c, ...calcSLAStatus(c, slaConfig, classificacaoConfig) })))

    calc()
    const id = setInterval(calc, 1_000)
    return () => clearInterval(id)
  }, [conversas, slaConfig, classificacaoConfig])

  return conversasComSLA
}
