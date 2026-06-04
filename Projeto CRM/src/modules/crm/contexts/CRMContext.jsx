import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { buscarMeuPerfil } from '../services/crm.service'
import { useRealtimeConversas } from '../hooks/useRealtime'

const CRMContext = createContext(null)

export function CRMProvider({ children }) {
  const [perfil, setPerfil]               = useState(null)
  const [conversaAtiva, setConversaAtiva] = useState(null)
  const [filtros, setFiltros]             = useState({ status: null, departamento: null })
  const [notificacoes, setNotificacoes]   = useState([])
  const [loadingPerfil, setLoadingPerfil] = useState(true)

  useEffect(() => {
    buscarMeuPerfil()
      .then(setPerfil)
      .catch(console.error)
      .finally(() => setLoadingPerfil(false))
  }, [])

  // Realtime de conversas do departamento do agente
  const departamentoEscuta = perfil?.role === 'ADMIN' ? 'TODOS' : perfil?.departamento

  useRealtimeConversas(departamentoEscuta, {
    onInsert: useCallback((novaConversa) => {
      setNotificacoes(prev => [...prev, {
        id: novaConversa.id,
        tipo: 'nova_conversa',
        conversa: novaConversa,
        lida: false,
        timestamp: new Date(),
      }])
    }, []),
    onUpdate: useCallback((_conversa) => {
      // Atualizações são tratadas localmente por useConversas
    }, []),
  })

  const selecionarConversa = useCallback((conversa) => {
    setConversaAtiva(conversa)
  }, [])

  const limparNotificacoes = useCallback(() => {
    setNotificacoes([])
  }, [])

  return (
    <CRMContext.Provider value={{
      perfil,
      loadingPerfil,
      conversaAtiva,
      selecionarConversa,
      filtros,
      setFiltros,
      notificacoes,
      limparNotificacoes,
      isAdmin: perfil?.role === 'ADMIN',
    }}>
      {children}
    </CRMContext.Provider>
  )
}

export function useCRM() {
  const ctx = useContext(CRMContext)
  if (!ctx) throw new Error('useCRM deve ser usado dentro de <CRMProvider>')
  return ctx
}
