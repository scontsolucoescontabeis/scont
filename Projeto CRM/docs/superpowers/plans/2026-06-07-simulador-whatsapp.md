# Simulador WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um simulador standalone em HTML que permite ao desenvolvedor simular múltiplos clientes WhatsApp interagindo com o CRM Messenger em tempo real, incluindo o chatbot.

**Architecture:** O simulador HTML usa `@supabase/supabase-js` via CDN para enviar mensagens via nova edge function `dev-message`, que repassa o payload ao `whatsapp-webhook` existente com um bypass token (pula HMAC). O chatbot roda normalmente. Respostas chegam via Supabase Realtime (anon key + nova policy SELECT permissiva em `mensagens`). Múltiplos telefones são gerenciados em `localStorage`.

**Tech Stack:** HTML + Vanilla JS (type="module"), Supabase JS v2 via esm.sh CDN, Deno (edge functions), PostgreSQL (migrations)

---

## File Map

| Ação | Arquivo | Responsabilidade |
|------|---------|-----------------|
| Criar | `supabase/migrations/011_dev_simulator.sql` | Policies SELECT anon para Realtime funcionar |
| Modificar | `supabase/functions/whatsapp-webhook/index.ts` | Bypass HMAC quando `X-Dev-Bypass-Token` válido + retornar `conversa_id` |
| Criar | `supabase/functions/dev-message/index.ts` | Edge function dev-only que encaminha para o webhook |
| Criar | `docs/simulador-whatsapp.html` | Simulador completo (WhatsApp Web UI + multi-cliente) |

---

## Task 1: Migração — policy SELECT para anon

**Files:**
- Create: `supabase/migrations/011_dev_simulator.sql`

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- supabase/migrations/011_dev_simulator.sql
-- Permite ao simulador (anon key) ler mensagens e conversas via Realtime.
-- ATENÇÃO: policies permissivas intencionais — usar apenas em ambiente de dev.

DROP POLICY IF EXISTS "dev_sim_mensagens_read" ON mensagens;
CREATE POLICY "dev_sim_mensagens_read" ON mensagens
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "dev_sim_conversas_read" ON conversas;
CREATE POLICY "dev_sim_conversas_read" ON conversas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "dev_sim_usuarios_read" ON usuarios;
CREATE POLICY "dev_sim_usuarios_read" ON usuarios
  FOR SELECT USING (true);
```

- [ ] **Step 2: Rodar no Supabase SQL Editor**

Abrir Supabase → SQL Editor → colar o conteúdo → Run.

Verificação: `SELECT policyname FROM pg_policies WHERE tablename IN ('mensagens','conversas','usuarios');`
Deve listar as 3 novas policies `dev_sim_*`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/011_dev_simulator.sql
git commit -m "feat: migration 011 — policies SELECT anon para simulador de dev"
```

---

## Task 2: Modificar whatsapp-webhook — bypass de HMAC

**Files:**
- Modify: `supabase/functions/whatsapp-webhook/index.ts` (linhas 180–214)

O arquivo atual tem esta estrutura no handler POST (linhas 180–214):
```typescript
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
      const contato = await obterOuCriarContato(telefone, (value?.contacts?.[0]?.profile?.name as string) || undefined)
      const { conversa } = await obterOuCriarConversa(contato.id, telefone)
      const nomeContato = (value?.contacts?.[0]?.profile?.name as string) || contato.nome as string || contato.telefone as string
      await processarMensagem(msg, contato, conversa, nomeContato)
    }
  } catch (err) {
    console.error('Erro ao processar webhook:', err)
  }

  return new Response('OK', { status: 200 })
}
```

- [ ] **Step 1: Substituir o bloco POST completo**

Localizar o bloco `if (req.method === 'POST')` (linha 180) e substituir por:

```typescript
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

    if (devBypass && conversa_id) {
      return new Response(
        JSON.stringify({ ok: true, conversa_id, contato_id, protocolo }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response('OK', { status: 200 })
  }
```

- [ ] **Step 2: Adicionar variável de ambiente no Supabase**

No Supabase Dashboard → Edge Functions → whatsapp-webhook → Settings → Secrets:
Adicionar `DEV_BYPASS_TOKEN` com qualquer valor secreto (ex: `dev-sim-2026`).

- [ ] **Step 3: Fazer deploy da função modificada**

```bash
npx supabase functions deploy whatsapp-webhook
```

Ou via Supabase Dashboard → Edge Functions → Deploy.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/whatsapp-webhook/index.ts
git commit -m "feat: whatsapp-webhook — bypass HMAC para simulador de dev (DEV_BYPASS_TOKEN)"
```

---

## Task 3: Criar edge function dev-message

**Files:**
- Create: `supabase/functions/dev-message/index.ts`

- [ ] **Step 1: Criar o diretório e o arquivo**

```bash
mkdir -p supabase/functions/dev-message
```

- [ ] **Step 2: Criar `supabase/functions/dev-message/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const DEV_BYPASS_TOKEN = Deno.env.get('DEV_BYPASS_TOKEN')
  if (!DEV_BYPASS_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'DEV_BYPASS_TOKEN não configurado no Supabase' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  let body: { phone?: string; name?: string; message?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body JSON inválido' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  const { phone, name, message } = body
  if (!phone || !message) {
    return new Response(
      JSON.stringify({ error: 'Campos obrigatórios: phone, message' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // Normaliza: remove +, espaços, traços → formato Meta (ex: 5511990010001)
  const telefone = phone.replace(/\D/g, '')

  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: `sim-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            from: telefone,
            type: 'text',
            text: { body: message },
            timestamp: String(Math.floor(Date.now() / 1000)),
          }],
          contacts: [{ profile: { name: name || telefone } }],
          metadata: { phone_number_id: 'SIMULATOR', display_phone_number: 'SIMULATOR' },
        }
      }]
    }]
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Bypass-Token': DEV_BYPASS_TOKEN,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({ ok: res.ok }))

  return new Response(
    JSON.stringify(data),
    {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    }
  )
})
```

- [ ] **Step 3: Adicionar DEV_BYPASS_TOKEN como secret desta função também**

No Supabase Dashboard → Edge Functions → dev-message → Settings → Secrets:
Adicionar o mesmo `DEV_BYPASS_TOKEN` usado em whatsapp-webhook.

- [ ] **Step 4: Fazer deploy**

```bash
npx supabase functions deploy dev-message
```

- [ ] **Step 5: Verificar no terminal (substitua pelos valores reais)**

```bash
curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/dev-message \
  -H "Authorization: Bearer SEU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999990001","name":"Teste Dev","message":"Olá teste"}'
```

Esperado: `{"ok":true,"conversa_id":"...","contato_id":"...","protocolo":"SCT-..."}`

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/dev-message/index.ts
git commit -m "feat: edge function dev-message — injeta mensagem de cliente simulado"
```

---

## Task 4: Criar o simulador HTML

**Files:**
- Create: `docs/simulador-whatsapp.html`

- [ ] **Step 1: Criar `docs/simulador-whatsapp.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulador WhatsApp — SCONT CRM Dev</title>
  <script type="module">
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

    // ── Estado global ──────────────────────────────────────────
    let supabase = null
    let clientes = []       // { id, phone, name, conversa_id, contato_id, protocolo, unread }
    let clienteAtivo = null // id local do cliente selecionado
    let realtimeSub = null  // channel ativo

    // ── localStorage ───────────────────────────────────────────
    const carregarConfig  = () => { try { return JSON.parse(localStorage.getItem('wpp_sim_config')  || '{}') } catch { return {} } }
    const carregarClientes = () => { try { return JSON.parse(localStorage.getItem('wpp_sim_clientes') || '[]') } catch { return [] } }
    const salvarConfigLocal = cfg => localStorage.setItem('wpp_sim_config', JSON.stringify(cfg))
    const salvarClientes    = ()  => localStorage.setItem('wpp_sim_clientes', JSON.stringify(clientes))

    // ── Inicialização ──────────────────────────────────────────
    function inicializar() {
      const cfg = carregarConfig()
      if (cfg.supabase_url)  document.getElementById('cfg-url').value   = cfg.supabase_url
      if (cfg.anon_key)      document.getElementById('cfg-key').value   = cfg.anon_key
      if (cfg.bypass_token)  document.getElementById('cfg-token').value = cfg.bypass_token
      clientes = carregarClientes()
      renderizarSidebar()
      if (cfg.supabase_url && cfg.anon_key) {
        supabase = createClient(cfg.supabase_url, cfg.anon_key)
      }
    }

    // ── Configuração ───────────────────────────────────────────
    async function salvarConfig() {
      const cfg = {
        supabase_url:  document.getElementById('cfg-url').value.trim(),
        anon_key:      document.getElementById('cfg-key').value.trim(),
        bypass_token:  document.getElementById('cfg-token').value.trim(),
      }
      salvarConfigLocal(cfg)
      supabase = createClient(cfg.supabase_url, cfg.anon_key)
      const statusEl = document.getElementById('cfg-status')
      statusEl.textContent = 'Testando...'
      statusEl.className = 'cfg-status testing'
      try {
        const { error } = await supabase.from('mensagens').select('id').limit(1)
        if (error) throw error
        statusEl.textContent = '✓ Conectado'
        statusEl.className = 'cfg-status ok'
      } catch (e) {
        statusEl.textContent = '✗ ' + e.message
        statusEl.className = 'cfg-status erro'
      }
    }

    function toggleConfig() {
      const p = document.getElementById('cfg-panel')
      p.style.display = p.style.display === 'none' ? 'block' : 'none'
    }

    // ── Telefones / Clientes ────────────────────────────────────
    function gerarTelefone() {
      const ddds = ['11','21','31','41','47','51','61','71','81','85']
      const ddd = ddds[Math.floor(Math.random() * ddds.length)]
      const n = Math.floor(Math.random() * 90000000 + 10000000)
      return `+55 ${ddd} 9${String(n).slice(0,4)}-${String(n).slice(4)}`
    }

    function abrirModalNovoCliente() {
      document.getElementById('modal-phone').value = gerarTelefone()
      document.getElementById('modal-name').value  = ''
      document.getElementById('modal').style.display = 'flex'
      document.getElementById('modal-name').focus()
    }

    function fecharModal() {
      document.getElementById('modal').style.display = 'none'
    }

    function gerarAleatorio() {
      document.getElementById('modal-phone').value = gerarTelefone()
    }

    function criarCliente() {
      const phone = document.getElementById('modal-phone').value.trim()
      const name  = document.getElementById('modal-name').value.trim()
      if (phone.replace(/\D/g,'').length < 10) { alert('Telefone inválido — mínimo 10 dígitos.'); return }
      const id = 'c' + Date.now()
      clientes.unshift({ id, phone, name: name || phone, conversa_id: null, contato_id: null, protocolo: null, unread: 0 })
      salvarClientes()
      fecharModal()
      renderizarSidebar()
      selecionarCliente(id)
    }

    function removerCliente(id) {
      if (!confirm('Remover este telefone simulado?\nA conversa no Supabase não é apagada.')) return
      clientes = clientes.filter(c => c.id !== id)
      salvarClientes()
      if (clienteAtivo === id) {
        clienteAtivo = null
        if (realtimeSub && supabase) { supabase.removeChannel(realtimeSub); realtimeSub = null }
        document.getElementById('chat-area').innerHTML   = '<div class="chat-vazio">Selecione um telefone</div>'
        document.getElementById('chat-header').innerHTML = '<div class="chat-header-vazio">⚡ Simulador WhatsApp — SCONT CRM Dev</div>'
      }
      renderizarSidebar()
    }

    // ── Seleção de cliente ──────────────────────────────────────
    async function selecionarCliente(id) {
      clienteAtivo = id
      const c = clientes.find(x => x.id === id)
      if (!c) return
      c.unread = 0
      salvarClientes()
      renderizarSidebar()
      renderizarHeader(c)

      if (realtimeSub && supabase) { supabase.removeChannel(realtimeSub); realtimeSub = null }

      const chatEl = document.getElementById('chat-area')
      chatEl.innerHTML = '<div class="msg-sistema">Carregando...</div>'

      if (c.conversa_id && supabase) {
        const { data } = await supabase
          .from('mensagens')
          .select('id, origem, conteudo, criado_em, agente_id, usuarios(nome)')
          .eq('conversa_id', c.conversa_id)
          .order('criado_em', { ascending: true })
        chatEl.innerHTML = ''
        if (data) data.forEach(m => renderizarMensagem(m, false))
        chatEl.scrollTop = chatEl.scrollHeight
        subscreverRealtime(c.conversa_id)
        atualizarStatusConversa(c.conversa_id)
      } else {
        chatEl.innerHTML = '<div class="msg-sistema">Nenhuma mensagem ainda. Digite e envie para iniciar a conversa.</div>'
      }
    }

    function subscreverRealtime(conversa_id) {
      if (!supabase) return
      realtimeSub = supabase
        .channel('sim-msgs-' + conversa_id)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'mensagens',
          filter: `conversa_id=eq.${conversa_id}`,
        }, async (payload) => {
          const msg = payload.new
          if (msg.agente_id) {
            const { data } = await supabase.from('usuarios').select('nome').eq('id', msg.agente_id).single()
            msg['usuarios'] = data
          }
          renderizarMensagem(msg, true)
          // Badge para clientes não ativos
          if (msg.origem !== 'CLIENTE') {
            const c = clientes.find(x => x.conversa_id === conversa_id)
            if (c && c.id !== clienteAtivo) {
              c.unread = (c.unread || 0) + 1
              salvarClientes()
              renderizarSidebar()
            }
          }
          atualizarStatusConversa(conversa_id)
        })
        .subscribe()

      // Subscription separada para mudanças de status da conversa
      supabase
        .channel('sim-conv-' + conversa_id)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'conversas',
          filter: `id=eq.${conversa_id}`,
        }, () => atualizarStatusConversa(conversa_id))
        .subscribe()
    }

    async function atualizarStatusConversa(conversa_id) {
      if (!supabase) return
      const { data } = await supabase.from('conversas').select('status').eq('id', conversa_id).single()
      if (!data) return
      const el = document.getElementById('conv-status')
      if (el) {
        el.textContent = data.status.replace('_', ' ')
        el.className   = 'conv-status ' + data.status.toLowerCase().replace('_', '-')
      }
    }

    // ── Envio de mensagem ───────────────────────────────────────
    async function enviarMensagem() {
      if (!supabase) { alert('Configure a conexão com o Supabase primeiro.'); return }
      const c = clientes.find(x => x.id === clienteAtivo)
      if (!c) { alert('Selecione um telefone.'); return }
      const inputEl = document.getElementById('msg-input')
      const btnEl   = document.getElementById('btn-enviar')
      const texto   = inputEl.value.trim()
      if (!texto) return

      const cfg = carregarConfig()
      inputEl.disabled = true
      btnEl.disabled   = true
      const textoOriginal = texto
      inputEl.value = ''

      try {
        const res = await fetch(`${cfg.supabase_url}/functions/v1/dev-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.anon_key}`,
          },
          body: JSON.stringify({ phone: c.phone, name: c.name, message: texto }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

        if (!c.conversa_id && data.conversa_id) {
          c.conversa_id = data.conversa_id
          c.contato_id  = data.contato_id
          c.protocolo   = data.protocolo
          salvarClientes()
          renderizarHeader(c)
          subscreverRealtime(c.conversa_id)

          // Carrega mensagens geradas pelo pipeline (bot já respondeu)
          await new Promise(r => setTimeout(r, 600))
          const { data: msgs } = await supabase
            .from('mensagens')
            .select('id, origem, conteudo, criado_em, agente_id, usuarios(nome)')
            .eq('conversa_id', c.conversa_id)
            .order('criado_em', { ascending: true })
          const chatEl = document.getElementById('chat-area')
          chatEl.innerHTML = ''
          if (msgs) msgs.forEach(m => renderizarMensagem(m, false))
          chatEl.scrollTop = chatEl.scrollHeight
        }
      } catch (e) {
        alert('Erro ao enviar: ' + e.message)
        inputEl.value = textoOriginal
      } finally {
        inputEl.disabled = false
        btnEl.disabled   = false
        inputEl.focus()
      }
    }

    // ── Renderização ────────────────────────────────────────────
    function renderizarSidebar() {
      const lista = document.getElementById('lista-clientes')
      lista.innerHTML = ''
      document.getElementById('count-clientes').textContent = `(${clientes.length})`
      clientes.forEach(c => {
        const div = document.createElement('div')
        div.className = 'cliente-item' + (c.id === clienteAtivo ? ' ativo' : '')
        div.onclick = () => selecionarCliente(c.id)
        div.innerHTML = `
          <div class="cliente-info">
            <div class="cliente-nome">${esc(c.name)}</div>
            <div class="cliente-phone">${esc(c.phone)}</div>
            <div class="cliente-preview">${c.protocolo ? esc(c.protocolo) : '— nova conversa —'}</div>
          </div>
          <div class="cliente-meta">
            ${c.unread > 0 ? `<div class="badge-unread">${c.unread}</div>` : ''}
            <div class="btn-remover" onclick="event.stopPropagation();window._remover('${c.id}')">🗑</div>
          </div>`
        lista.appendChild(div)
      })
    }

    function renderizarHeader(c) {
      document.getElementById('chat-header').innerHTML = `
        <div class="header-avatar">${esc((c.name[0] || '?').toUpperCase())}</div>
        <div class="header-info">
          <div class="header-nome">${esc(c.name)}</div>
          <div class="header-phone">${esc(c.phone)}${c.protocolo ? ' · ' + esc(c.protocolo) : ''}</div>
        </div>
        ${c.conversa_id ? `<div id="conv-status" class="conv-status aberta">ABERTA</div>` : ''}`
    }

    function renderizarMensagem(msg, scroll) {
      const chatEl = document.getElementById('chat-area')
      const div    = document.createElement('div')
      const hora   = new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      if (msg.origem === 'SISTEMA') {
        div.className = 'msg-sistema'
        div.textContent = msg.conteudo
      } else if (msg.origem === 'CLIENTE') {
        div.className = 'msg-wrapper cliente'
        div.innerHTML = `<div class="msg-bubble cliente">${esc(msg.conteudo)}<span class="msg-hora">${hora} ✓✓</span></div>`
      } else {
        const prefixo = msg.origem === 'BOT'
          ? '🤖 Bot SCONT'
          : `👤 ${msg.usuarios?.nome || 'Agente'}`
        const cls = msg.origem === 'BOT' ? 'bot' : 'agente'
        div.className = 'msg-wrapper agente'
        div.innerHTML = `
          <div class="msg-origem">${prefixo}</div>
          <div class="msg-bubble ${cls}">${formatarConteudo(msg.conteudo)}<span class="msg-hora">${hora}</span></div>`
      }

      chatEl.appendChild(div)
      if (scroll) chatEl.scrollTop = chatEl.scrollHeight
    }

    function formatarConteudo(texto) {
      return esc(texto || '').replace(/\n/g, '<br/>')
    }

    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }

    // ── Bootstrap ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
      inicializar()
      document.getElementById('msg-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() }
      })
    })

    // Expõe funções para atributos onclick no HTML
    window.salvarConfig          = salvarConfig
    window.toggleConfig          = toggleConfig
    window.abrirModalNovoCliente = abrirModalNovoCliente
    window.fecharModal           = fecharModal
    window.gerarAleatorio        = gerarAleatorio
    window.criarCliente          = criarCliente
    window.enviarMensagem        = enviarMensagem
    window._remover              = removerCliente
    window.selecionarCliente     = selecionarCliente
  </script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#111b21;color:#e9edef;height:100vh;display:flex;flex-direction:column;overflow:hidden}

    /* Config */
    #cfg-section{background:#202c33;border-bottom:1px solid #2a3942;flex-shrink:0}
    #cfg-toggle{padding:8px 16px;cursor:pointer;font-size:12px;color:#8696a0;display:flex;align-items:center;justify-content:space-between;user-select:none}
    #cfg-toggle:hover{background:#2a3942}
    #cfg-panel{padding:10px 16px 14px;display:none}
    .cfg-row{display:flex;gap:8px;margin-bottom:6px;align-items:center}
    .cfg-label{font-size:10px;color:#8696a0;width:110px;flex-shrink:0}
    .cfg-input{flex:1;background:#2a3942;border:none;border-radius:4px;padding:5px 9px;color:#e9edef;font-size:11px;outline:none}
    .cfg-btn{background:#00a884;color:#fff;border:none;border-radius:4px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer}
    .cfg-status{font-size:10px;padding:3px 8px;border-radius:4px;display:inline-block;margin-left:10px}
    .cfg-status.ok{background:#1a3a2a;color:#25d366}
    .cfg-status.erro{background:#3a1a1a;color:#ef4444}
    .cfg-status.testing{background:#2a3942;color:#8696a0}

    /* Layout */
    #main{display:flex;flex:1;overflow:hidden}

    /* Sidebar */
    #sidebar{width:270px;background:#111b21;border-right:1px solid #2a3942;display:flex;flex-direction:column;flex-shrink:0}
    #sidebar-header{padding:10px 14px;background:#202c33;border-bottom:1px solid #2a3942}
    #sidebar-header h1{font-size:13px;font-weight:700}
    #sidebar-header p{font-size:10px;color:#8696a0;margin-top:2px}
    #sidebar-label{padding:6px 14px 4px;font-size:9px;font-weight:700;color:#8696a0;text-transform:uppercase;letter-spacing:.06em}
    #lista-clientes{flex:1;overflow-y:auto}
    .cliente-item{padding:10px 14px;cursor:pointer;display:flex;gap:8px;border-bottom:1px solid #1e2d36;transition:background .1s}
    .cliente-item:hover{background:#182229}
    .cliente-item.ativo{background:#2a3942;border-left:3px solid #00a884}
    .cliente-info{flex:1;min-width:0}
    .cliente-nome{font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cliente-phone{font-size:9px;color:#8696a0;margin-top:1px}
    .cliente-preview{font-size:9px;color:#8696a0;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .cliente-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0}
    .badge-unread{background:#00a884;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px}
    .btn-remover{font-size:12px;opacity:0;cursor:pointer;line-height:1}
    .cliente-item:hover .btn-remover{opacity:.55}
    .btn-remover:hover{opacity:1!important}
    #btn-novo{margin:10px;background:#00a884;color:#fff;border:none;border-radius:7px;padding:10px;font-size:12px;font-weight:700;cursor:pointer;width:calc(100% - 20px)}
    #btn-novo:hover{background:#02b798}

    /* Chat */
    #chat{flex:1;display:flex;flex-direction:column;background:#0b141a;overflow:hidden}
    #chat-header{background:#202c33;padding:10px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2a3942;min-height:54px;flex-shrink:0}
    .chat-header-vazio{color:#8696a0;font-size:13px}
    .header-avatar{width:36px;height:36px;background:#00a884;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:#fff;flex-shrink:0}
    .header-info{flex:1;min-width:0}
    .header-nome{font-size:13px;font-weight:600}
    .header-phone{font-size:10px;color:#8696a0;margin-top:1px}
    .conv-status{font-size:9px;font-weight:700;padding:2px 9px;border-radius:4px;flex-shrink:0;text-align:center}
    .conv-status.aberta{background:#1a3a2a;color:#25d366}
    .conv-status.em-atendimento{background:#1a2e4a;color:#60a5fa}
    .conv-status.encerrada{background:#2a2a2a;color:#8696a0}
    .conv-status.aguardando{background:#3a2a1a;color:#f59e0b}

    #chat-area{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:4px}
    .chat-vazio{color:#8696a0;font-size:13px;text-align:center;margin:auto}
    .msg-sistema{text-align:center;font-size:10px;color:#8696a0;background:#182229;padding:3px 12px;border-radius:8px;align-self:center;margin:4px 0}
    .msg-wrapper{display:flex;flex-direction:column;margin:3px 0}
    .msg-wrapper.cliente{align-items:flex-end}
    .msg-wrapper.agente{align-items:flex-start}
    .msg-origem{font-size:9px;color:#8696a0;margin-bottom:2px}
    .msg-bubble{max-width:68%;padding:7px 10px 18px;border-radius:8px;font-size:12px;line-height:1.5;position:relative;word-break:break-word}
    .msg-bubble.cliente{background:#005c4b;color:#e9edef;border-bottom-right-radius:2px}
    .msg-bubble.bot{background:#202c33;color:#e9edef;border-bottom-left-radius:2px}
    .msg-bubble.agente{background:#1a2e3a;color:#e9edef;border-bottom-left-radius:2px}
    .msg-hora{position:absolute;bottom:4px;right:8px;font-size:9px;color:#8696a0}

    #input-area{background:#202c33;padding:8px 14px;display:flex;align-items:center;gap:10px;border-top:1px solid #2a3942;flex-shrink:0}
    #msg-input{flex:1;background:#2a3942;border:none;border-radius:24px;padding:9px 16px;color:#e9edef;font-size:13px;outline:none;resize:none;max-height:80px;font-family:inherit}
    #msg-input::placeholder{color:#8696a0}
    #btn-enviar{width:40px;height:40px;background:#00a884;border:none;border-radius:50%;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    #btn-enviar:hover{background:#02b798}
    #btn-enviar:disabled{background:#2a3942;cursor:not-allowed}

    /* Modal */
    #modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);align-items:center;justify-content:center;z-index:100}
    .modal-box{background:#202c33;border-radius:10px;padding:24px;width:340px}
    .modal-title{font-size:15px;font-weight:700;margin-bottom:18px}
    .modal-label{font-size:10px;color:#8696a0;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
    .modal-input{width:100%;background:#2a3942;border:none;border-radius:6px;padding:9px 12px;color:#e9edef;font-size:13px;outline:none;margin-bottom:12px;font-family:inherit}
    .modal-link{color:#00a884;font-size:11px;cursor:pointer;margin-top:-8px;margin-bottom:14px;display:inline-block}
    .modal-footer{display:flex;gap:8px;margin-top:6px}
    .modal-btn{flex:1;padding:10px;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
    .modal-btn.cancel{background:#2a3942;color:#aebac1}
    .modal-btn.confirm{background:#00a884;color:#fff}
  </style>
</head>
<body>

<!-- Barra de configuração -->
<div id="cfg-section">
  <div id="cfg-toggle" onclick="toggleConfig()">
    <span>⚙ Configuração Supabase</span>
    <span id="cfg-status" class="cfg-status"></span>
  </div>
  <div id="cfg-panel">
    <div class="cfg-row">
      <span class="cfg-label">URL Supabase</span>
      <input id="cfg-url" class="cfg-input" placeholder="https://xxx.supabase.co" autocomplete="off"/>
    </div>
    <div class="cfg-row">
      <span class="cfg-label">Anon Key</span>
      <input id="cfg-key" class="cfg-input" placeholder="eyJ..." autocomplete="off"/>
    </div>
    <div class="cfg-row">
      <span class="cfg-label">Bypass Token</span>
      <input id="cfg-token" class="cfg-input" placeholder="dev-sim-secret" autocomplete="off"/>
    </div>
    <button class="cfg-btn" onclick="salvarConfig()">Salvar e testar conexão</button>
  </div>
</div>

<!-- Layout principal -->
<div id="main">

  <!-- Sidebar de telefones -->
  <div id="sidebar">
    <div id="sidebar-header">
      <h1>⚡ Simulador WhatsApp</h1>
      <p>SCONT CRM — Ferramenta de Dev</p>
    </div>
    <div id="sidebar-label">Telefones simulados <span id="count-clientes">(0)</span></div>
    <div id="lista-clientes"></div>
    <button id="btn-novo" onclick="abrirModalNovoCliente()">+ Novo telefone</button>
  </div>

  <!-- Área de chat -->
  <div id="chat">
    <div id="chat-header">
      <div class="chat-header-vazio">Selecione ou crie um telefone simulado</div>
    </div>
    <div id="chat-area">
      <div class="chat-vazio">Nenhum cliente selecionado</div>
    </div>
    <div id="input-area">
      <textarea id="msg-input" placeholder="Digite uma mensagem... (Enter para enviar)" rows="1"></textarea>
      <button id="btn-enviar" onclick="enviarMensagem()">➤</button>
    </div>
  </div>

</div>

<!-- Modal novo telefone -->
<div id="modal" onclick="if(event.target===this)fecharModal()">
  <div class="modal-box">
    <div class="modal-title">📱 Novo cliente simulado</div>
    <div class="modal-label">Nome (opcional)</div>
    <input id="modal-name" class="modal-input" placeholder="Ex: Maria Oliveira"/>
    <div class="modal-label">Telefone (com DDI)</div>
    <input id="modal-phone" class="modal-input" placeholder="+55 11 99001-0001"/>
    <span class="modal-link" onclick="gerarAleatorio()">↻ Gerar aleatório</span>
    <div class="modal-footer">
      <button class="modal-btn cancel" onclick="fecharModal()">Cancelar</button>
      <button class="modal-btn confirm" onclick="criarCliente()">Criar</button>
    </div>
  </div>
</div>

</body>
</html>
```

- [ ] **Step 2: Verificar no browser**

Abrir `docs/simulador-whatsapp.html` diretamente no browser (duplo clique ou `file://`).

**Nota:** como o arquivo usa `type="module"` e importa via `https://esm.sh`, ele precisa de um servidor HTTP para funcionar localmente. Se abrir via `file://` bloquear o módulo, rodar:

```bash
npx serve docs -p 4000
```
E abrir `http://localhost:4000/simulador-whatsapp.html`.

Verificações:
- Painel de config abre/fecha
- Modal de novo telefone aparece e o botão "Gerar aleatório" funciona
- Inserir URL + anon key + bypass token → "Salvar e testar" → mostra `✓ Conectado`

- [ ] **Step 3: Testar fluxo completo**

1. Abrir o CRM Messenger em outra aba (`npm run dev` → `http://localhost:5173`)
2. No simulador: criar telefone → enviar "Olá"
3. Verificar que aparece conversa na fila ABERTA do CRM em tempo real
4. O bot deve responder com o menu de departamentos
5. Responder "2" no simulador → bot avança para categorias
6. No CRM: agente assume → responde → verificar que aparece no simulador

- [ ] **Step 4: Commit**

```bash
git add docs/simulador-whatsapp.html
git commit -m "feat: simulador-whatsapp.html — simulador multi-cliente para dev/testes do CRM"
```

---

## Verificação final

- [ ] Confirmar que conversas de telefones simulados ficam claramente visíveis no CRM (nome "SIM-..." ou número fake)
- [ ] Confirmar que múltiplos telefones simultâneos funcionam com Realtime independente
- [ ] Confirmar que o status da conversa (ABERTA → EM_ATENDIMENTO → ENCERRADA) atualiza no header do simulador
- [ ] Confirmar que o badge de não-lidas funciona ao receber mensagem de bot/agente com outro cliente selecionado
