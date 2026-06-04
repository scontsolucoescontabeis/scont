import { useState, useEffect, useCallback } from 'react'
import { listarConversas } from '../services/crm.service'

export function useConversas(filtros = {}) {
  const [conversas, setConversas] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listarConversas(filtros)
      setConversas(data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(filtros)])

  useEffect(() => {
    carregar()
  }, [carregar])

  const atualizarConversa = useCallback((conversaAtualizada) => {
    setConversas(prev =>
      prev.map(c => c.id === conversaAtualizada.id ? { ...c, ...conversaAtualizada } : c)
    )
  }, [])

  const adicionarConversa = useCallback((novaConversa) => {
    setConversas(prev => {
      const existe = prev.find(c => c.id === novaConversa.id)
      if (existe) return prev.map(c => c.id === novaConversa.id ? { ...c, ...novaConversa } : c)
      return [novaConversa, ...prev]
    })
  }, [])

  return { conversas, loading, error, recarregar: carregar, atualizarConversa, adicionarConversa }
}
