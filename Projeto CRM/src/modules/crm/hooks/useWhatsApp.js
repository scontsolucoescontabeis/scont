import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const SB_URL = import.meta.env.VITE_SUPABASE_URL

async function chamarEdgeFunction(nome, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SB_URL}/functions/v1/${nome}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `Erro na função ${nome}`)
  return json
}

export function useWhatsApp() {
  const [enviando, setEnviando] = useState(false)
  const [encerrando, setEncerrando] = useState(false)
  const [transferindo, setTransferindo] = useState(false)

  const enviarMensagem = async (conversaId, conteudo, tipo = 'text') => {
    setEnviando(true)
    try {
      return await chamarEdgeFunction('send-message', { conversa_id: conversaId, conteudo, tipo })
    } finally {
      setEnviando(false)
    }
  }

  const encerrarConversa = async (conversaId) => {
    setEncerrando(true)
    try {
      return await chamarEdgeFunction('encerrar-conversa', { conversa_id: conversaId })
    } finally {
      setEncerrando(false)
    }
  }

  const transferirConversa = async (conversaId, paraDepartamento, paraAgenteId, motivo) => {
    setTransferindo(true)
    try {
      return await chamarEdgeFunction('transferir-conversa', {
        conversa_id: conversaId,
        para_departamento: paraDepartamento,
        para_agente_id: paraAgenteId || null,
        motivo: motivo || null,
      })
    } finally {
      setTransferindo(false)
    }
  }

  return { enviarMensagem, encerrarConversa, transferirConversa, enviando, encerrando, transferindo }
}
