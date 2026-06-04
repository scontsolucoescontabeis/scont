import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN')!
const APP_SECRET   = Deno.env.get('WHATSAPP_APP_SECRET')!
const SB_URL       = Deno.env.get('SUPABASE_URL')!
const SB_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SB_URL, SB_KEY)

// Valida assinatura HMAC-SHA256 enviada pelo Meta
async function validarAssinatura(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hex = 'sha256=' + Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === signature
}

async function obterOuCriarContato(telefone: string, nome?: string) {
  const { data: existente } = await supabase
    .from('contatos')
    .select('*')
    .eq('telefone', telefone)
    .single()

  if (existente) return existente

  const { data: novo } = await supabase
    .from('contatos')
    .insert({ telefone, nome: nome || telefone })
    .select()
    .single()

  return novo
}

async function obterOuCriarConversa(contatoId: string, telefone: string) {
  // Busca conversa ABERTA ou EM_ATENDIMENTO ou AGUARDANDO para esse contato
  const { data: existente } = await supabase
    .from('conversas')
    .select('*')
    .eq('contato_id', contatoId)
    .in('status', ['ABERTA', 'EM_ATENDIMENTO', 'AGUARDANDO'])
    .order('aberto_em', { ascending: false })
    .limit(1)
    .single()

  if (existente) return { conversa: existente, isNova: false }

  const { data: nova } = await supabase
    .from('conversas')
    .insert({
      contato_id: contatoId,
      departamento: 'PESSOAL',
      status: 'ABERTA',
    })
    .select()
    .single()

  return { conversa: nova, isNova: true }
}

async function enviarBoasVindas(telefone: string) {
  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
  const ACCESS_TOKEN    = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!

  await fetch(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefone,
        type: 'text',
        text: {
          body: 'Olá! Bem-vindo à SCONT Soluções Contábeis. Em breve um de nossos especialistas irá atendê-lo.',
        },
      }),
    }
  )
}

async function processarMensagem(msg: Record<string, unknown>, contato: Record<string, unknown>, conversa: Record<string, unknown>) {
  const tipo = (msg.type as string) || 'text'
  let conteudo: string | null = null
  let mediaUrl: string | null = null

  if (tipo === 'text') {
    conteudo = (msg.text as { body: string })?.body || ''
  } else if (['image', 'audio', 'document', 'video'].includes(tipo)) {
    const mediaObj = msg[tipo] as { id: string; caption?: string }
    conteudo = mediaObj?.caption || null
    // Download e upload para Supabase Storage
    if (mediaObj?.id) {
      mediaUrl = await baixarEGuardarMidia(mediaObj.id, tipo, (conversa as { id: string }).id)
    }
  }

  await supabase.from('mensagens').insert({
    conversa_id:     (conversa as { id: string }).id,
    conteudo,
    tipo,
    media_url:       mediaUrl,
    whatsapp_msg_id: msg.id as string,
    origem:          'CLIENTE',
    lida:            false,
  })
}

async function baixarEGuardarMidia(mediaId: string, tipo: string, conversaId: string): Promise<string | null> {
  const ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!
  try {
    // Obtém URL de download
    const infoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    })
    const info = await infoRes.json()

    // Baixa o arquivo
    const fileRes = await fetch(info.url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    })
    const blob = await fileRes.blob()

    const extensao: Record<string, string> = {
      image: 'jpg', audio: 'ogg', document: 'pdf', video: 'mp4',
    }
    const nomeArquivo = `${conversaId}/${Date.now()}.${extensao[tipo] || 'bin'}`

    const { data } = await supabase.storage
      .from('crm-midia')
      .upload(nomeArquivo, blob, { upsert: false })

    // Salva apenas o path — URL assinada gerada no frontend (bucket privado)
    if (data) return nomeArquivo
  } catch {
    // Falha silenciosa no upload de mídia — não bloqueia o fluxo
  }
  return null
}

serve(async (req) => {
  // GET — verificação do webhook pelo Meta
  if (req.method === 'GET') {
    const url    = new URL(req.url)
    const mode   = url.searchParams.get('hub.mode')
    const token  = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  // POST — mensagens recebidas
  if (req.method === 'POST') {
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')

    if (!await validarAssinatura(rawBody, signature)) {
      return new Response('Invalid signature', { status: 401 })
    }

    const payload = JSON.parse(rawBody)

    try {
      const entry = payload?.entry?.[0]
      const change = entry?.changes?.[0]
      const value = change?.value

      const mensagens: Record<string, unknown>[] = value?.messages || []
      for (const msg of mensagens) {
        const telefone = (msg.from as string)
        const nomeContato = value?.contacts?.[0]?.profile?.name

        const contato = await obterOuCriarContato(telefone, nomeContato)
        const { conversa, isNova } = await obterOuCriarConversa(contato.id, telefone)

        if (isNova) {
          await enviarBoasVindas(telefone)
        }

        await processarMensagem(msg, contato, conversa)
      }
    } catch (err) {
      console.error('Erro ao processar webhook:', err)
      // Retorna 200 mesmo em erro para o Meta não reenviar
    }

    return new Response('OK', { status: 200 })
  }

  return new Response('Method not allowed', { status: 405 })
})
