import { useState, useEffect, useCallback } from 'react'
import { listarMensagens, listarAnotacoes } from '../services/crm.service'

export function useMensagens(conversaId) {
  const [mensagens, setMensagens]   = useState([])
  const [anotacoes, setAnotacoes]   = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const carregar = useCallback(async () => {
    if (!conversaId) return
    try {
      setLoading(true)
      const [msgs, anots] = await Promise.all([
        listarMensagens(conversaId),
        listarAnotacoes(conversaId),
      ])
      setMensagens(msgs)
      setAnotacoes(anots)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [conversaId])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Combina mensagens + anotações em linha do tempo ordenada
  const timeline = [
    ...mensagens.map(m => ({ ...m, _tipo: 'mensagem' })),
    ...anotacoes.map(a => ({ ...a, _tipo: 'anotacao', timestamp: a.timestamp })),
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const adicionarMensagem = useCallback((nova) => {
    setMensagens(prev => [...prev, nova])
  }, [])

  const adicionarAnotacao = useCallback((nova) => {
    setAnotacoes(prev => [...prev, nova])
  }, [])

  return {
    mensagens,
    anotacoes,
    timeline,
    loading,
    error,
    recarregar: carregar,
    adicionarMensagem,
    adicionarAnotacao,
  }
}
