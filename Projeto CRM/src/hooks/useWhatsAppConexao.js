import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { buscarWhatsAppConfig, salvarCanalWhatsApp } from '@/services/crm.service'

export function useWhatsAppConexao() {
  const [config, setConfig]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [gerandoQr, setGerandoQr] = useState(false)
  const [erro, setErro]         = useState('')

  useEffect(() => {
    buscarWhatsAppConfig()
      .then(setConfig)
      .catch(() => setErro('Não foi possível carregar a configuração de conexão.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-config-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_config' }, (payload) => {
        setConfig(payload.new)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const gerarQrCode = useCallback(async () => {
    setGerandoQr(true)
    setErro('')
    try {
      const { data, error } = await supabase.functions.invoke('evolution-connect')
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    } catch (e) {
      setErro(e.message || 'Erro ao gerar QR Code.')
    } finally {
      setGerandoQr(false)
    }
  }, [])

  const trocarCanal = useCallback(async (canal) => {
    setErro('')
    try {
      await salvarCanalWhatsApp(canal)
      setConfig(prev => prev ? { ...prev, canal_ativo: canal } : prev)
    } catch (e) {
      setErro(e.message || 'Erro ao trocar canal.')
    }
  }, [])

  return { config, loading, gerandoQr, erro, gerarQrCode, trocarCanal }
}
