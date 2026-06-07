import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { processarMensagemBot } from './chatbot-processor.ts'

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

async function processarMensagem(
  msg: Record<string, unknown>,
  contato: Record<string, unknown>,
  conversa: Record<string, unknown>,
  nomeContato: string
) {
  const tipo = (msg.type as string) || 'text'
  let conteudo: string | null = null
  let mediaUrl: string | null = null

  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')!
  const ACCESS_TOKEN    = Deno.env.get('WHATSAPP_ACCESS_TOKEN')!

  const botTratou = await processarMensagemBot({
    msg,
    telefone: contato.telefone as string,
    nomeContato,
    conversa: {
      id: (conversa as { id: string }).id,
      protocolo: (conversa as { protocolo: string }).protocolo,
      contato_id: (conversa as { contato_id: string }).contato_id,
    },
    supabase,
    phoneNumberId: PHONE_NUMBER_ID,
    accessToken: ACCESS_TOKEN,
  })

  if (botTratou) return  // bot processou; não salva como mensagem normal

  if (tipo === 'text') {
    conteudo = (msg.text as { body: string })?.body || ''
  } else if (['image', 'audio', 'document', 'video'].includes(tipo)) {
    const mediaObj = msg[tipo] as { id: string; caption?: string }
    conteudo = mediaObj?.caption || null
    // Download e upload para Supabase Storage
    if (mediaObj?.id) {
      mediaUrl = await baixarEGuardarMidia(mediaObj.id, tipo, (conversa as { id: string }).id)
    }
  } else if (tipo === 'interactive') {
    // resposta de lista interativa — o bot já tratou acima se botTratou=true
    // se chegou aqui, salvar como mensagem de texto com o título da opção selecionada
    const interactive = msg.interactive as Record<string, unknown>
    if (interactive?.type === 'list_reply') {
      const reply = interactive.list_reply as { id: string; title: string }
      conteudo = reply?.title || reply?.id || '[seleção]'
    } else if (interactive?.type === 'button_reply') {
      const reply = interactive.button_reply as { id: string; title: string }
      conteudo = reply?.title || reply?.id || '[botão]'
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

    // Dev simulator bypass — pula HMAC quando token de dev válido
    const DEV_BYPASS_TOKEN = Deno.env.get('DEV_BYPASS_TOKEN')
    const devBypass = !!DEV_BYPASS_TOKEN &&
      req.headers.get('X-Dev-Bypass-Token') === DEV_BYPASS_TOKEN

    if (!devBypass) {
      const signature = req.headers.get('x-hub-signature-256')
      if (!await validarAssinatura(rawBody, signature)) {
        return new Response('Invalid signature', { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)
    let conversa_id: string | null = null
    let contato_id: string | null = null
    let protocolo: string | null = null

    try {
      const entry = payload?.entry?.[0]
      const change = entry?.changes?.[0]
      const value = change?.value

      const mensagens: Record<string, unknown>[] = value?.messages || []
      for (const msg of mensagens) {
        const telefone = (msg.from as string)
        const contato = await obterOuCriarContato(telefone, (value?.contacts?.[0]?.profile?.name as string) || undefined)
        const { conversa } = await obterOuCriarConversa(contato.id, telefone)

        contato_id = contato.id as string
        conversa_id = (conversa as { id: string }).id
        protocolo = (conversa as { protocolo: string }).protocolo

        const nomeContato = (value?.contacts?.[0]?.profile?.name as string) || contato.nome as string || contato.telefone as string
        await processarMensagem(msg, contato, conversa, nomeContato)
      }
    } catch (err) {
      console.error('Erro ao processar webhook:', err)
    }

    if (devBypass && conversa_id && contato_id) {
      return new Response(
        JSON.stringify({ ok: true, conversa_id, contato_id, protocolo }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response('OK', { status: 200 })
  }

  return new Response('Method not allowed', { status: 405 })
})
