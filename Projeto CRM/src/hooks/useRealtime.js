import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function useRealtime({ onNovaMensagem, onConversaAtualizada, onNovaAnotacao }) {
  const channelRef = useRef(null)
  const callbacksRef = useRef({ onNovaMensagem, onConversaAtualizada, onNovaAnotacao })

  useEffect(() => {
    callbacksRef.current = { onNovaMensagem, onConversaAtualizada, onNovaAnotacao }
  })

  useEffect(() => {
    const name = 'crm-global-' + Math.random().toString(36).slice(2)
    const channel = supabase
      .channel(name)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, (payload) => {
        callbacksRef.current.onNovaMensagem?.(payload.new)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversas' }, (payload) => {
        callbacksRef.current.onConversaAtualizada?.(payload.new)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversas' }, (payload) => {
        callbacksRef.current.onConversaAtualizada?.(payload.new)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'anotacoes_internas' }, (payload) => {
        callbacksRef.current.onNovaAnotacao?.(payload.new)
      })
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [])
}
