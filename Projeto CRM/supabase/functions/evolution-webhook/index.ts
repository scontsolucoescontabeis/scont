import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { obterOuCriarContato, obterOuCriarConversa, salvarMensagemRecebida } from '../_shared/mensagens.ts'

const SB_URL         = Deno.env.get('SUPABASE_URL')!
const SB_KEY          = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WEBHOOK_TOKEN   = Deno.env.get('EVOLUTION_WEBHOOK_TOKEN')!

const supabase = createClient(SB_URL, SB_KEY)

function normalizarEvento(nome: string): string {
  return (nome || '').toUpperCase().replace(/\./g, '_')
}

function extrairDigits(remoteJid: string): string {
  return (remoteJid || '').replace('@s.whatsapp.net', '').replace(/\D/g, '')
}

function extrairTexto(msg: Record<string, unknown>): string | null {
  const message = msg?.message as Record<string, unknown> | undefined
  if (!message) return null
  if (typeof message.conversation === 'string') return message.conversation
  const extended = message.extendedTextMessage as { text?: string } | undefined
  if (extended?.text) return extended.text
  return null
}

async function processarMensagensRecebidas(data: Record<string, unknown>) {
  const rawMessages = Array.isArray((data as { messages?: unknown[] }).messages)
    ? (data as { messages: Record<string, unknown>[] }).messages
    : [data]

  for (const msg of rawMessages) {
    const key = msg?.key as { remoteJid?: string; fromMe?: boolean; id?: string } | undefined
    if (!key?.remoteJid || key.fromMe) continue // ignora eco de mensagens enviadas por nós mesmos

    const texto = extrairTexto(msg)
    if (texto === null) continue // mídia/tipos não suportados nesta primeira versão

    const digits = extrairDigits(key.remoteJid)
    const nomeContato = (msg.pushName as string) || digits

    const contato = await obterOuCriarContato(supabase, digits, nomeContato)
    const { conversa } = await obterOuCriarConversa(supabase, contato.id)

    await salvarMensagemRecebida(supabase, {
      conversaId: (conversa as { id: string }).id,
      conteudo: texto,
      tipo: 'text',
      whatsappMsgId: key.id ?? null,
    })
  }
}

async function processarAtualizacaoConexao(data: Record<string, unknown>) {
  const estado = (data?.state as string) || ''
  const mapa: Record<string, string> = { open: 'CONECTADO', connecting: 'CONECTANDO', close: 'DESCONECTADO' }
  const status = mapa[estado]
  if (!status) return

  const update: Record<string, unknown> = { status_conexao: status, atualizado_em: new Date().toISOString() }
  if (status === 'CONECTADO') update.qrcode_base64 = null

  await supabase.from('whatsapp_config').update(update).eq('id', 1)
}

async function processarQrCodeAtualizado(data: Record<string, unknown>) {
  const qrcode = data?.qrcode as { base64?: string } | undefined
  if (!qrcode?.base64) return

  await supabase
    .from('whatsapp_config')
    .update({ qrcode_base64: qrcode.base64, status_conexao: 'CONECTANDO', atualizado_em: new Date().toISOString() })
    .eq('id', 1)
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(req.url)
  if (url.searchParams.get('token') !== WEBHOOK_TOKEN) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const payload = await req.json()
    const evento = normalizarEvento(payload?.event as string)
    const data = (payload?.data as Record<string, unknown>) || {}

    if (evento === 'MESSAGES_UPSERT') {
      await processarMensagensRecebidas(data)
    } else if (evento === 'CONNECTION_UPDATE') {
      await processarAtualizacaoConexao(data)
    } else if (evento === 'QRCODE_UPDATED') {
      await processarQrCodeAtualizado(data)
    }
  } catch (err) {
    console.error('Erro ao processar evolution-webhook:', err)
  }

  return new Response('OK', { status: 200 })
})
