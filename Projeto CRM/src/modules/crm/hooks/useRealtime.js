import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'

const somNotificacao = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Web Audio não disponível
  }
}

export function useRealtimeMensagens(conversaId, onNovaMensagem) {
  const callbackRef = useRef(onNovaMensagem)
  callbackRef.current = onNovaMensagem

  useEffect(() => {
    if (!conversaId) return

    const channel = supabase
      .channel(`mensagens-${conversaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
          filter: `conversa_id=eq.${conversaId}`,
        },
        (payload) => {
          callbackRef.current(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversaId])
}

export function useRealtimeConversas(departamento, { onInsert, onUpdate } = {}) {
  const onInsertRef = useRef(onInsert)
  const onUpdateRef = useRef(onUpdate)
  onInsertRef.current = onInsert
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!departamento) return

    const filter = departamento === 'TODOS'
      ? undefined
      : `departamento=eq.${departamento}`

    const channel = supabase
      .channel(`conversas-${departamento}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversas',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          somNotificacao()
          onInsertRef.current?.(payload.new)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversas',
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          onUpdateRef.current?.(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [departamento])
}

export function useRealtimeMensagensDepartamento(departamento, onNovaMensagem) {
  const callbackRef = useRef(onNovaMensagem)
  callbackRef.current = onNovaMensagem

  useEffect(() => {
    if (!departamento) return

    // Escuta todas as inserções de mensagens e filtra no cliente
    // (Supabase Realtime não suporta JOINs em filtros)
    const channel = supabase
      .channel(`msgs-depto-${departamento}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensagens',
        },
        (payload) => {
          if (payload.new.origem === 'CLIENTE') {
            somNotificacao()
            callbackRef.current?.(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [departamento])
}
