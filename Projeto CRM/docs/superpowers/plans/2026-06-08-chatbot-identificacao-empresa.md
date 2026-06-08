# Chatbot — Identificação de Empresa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Personalizar o início do chatbot para clientes cadastrados: saudação por nome, seleção de empresa vinculada (com CNPJ), combinada com histórico recorrente em uma única pergunta — e repassar o contexto completo ao agente com destaque visual.

**Architecture:** Novo estado `AGUARD_EMPRESA` inserido na máquina de estados entre `NOVO` e `AGUARD_DEPT`. `handleNOVO` verifica `contatos_empresas` antes do fluxo existente; se houver empresas, monta lista dinâmica e transita para `AGUARD_EMPRESA`. O novo handler `handleAGUARD_EMPRESA` roteia para `AGUARD_DEPT` (empresa nova) ou direto para `AGUARD_SUB`/`AGUARD_CONF` (recorrente combinado). Empresa selecionada é salva em sessão + conversa para o agente ver.

**Tech Stack:** Deno/TypeScript (Edge Function), Supabase PostgreSQL, React + Supabase JS (frontend)

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/013_empresa_chatbot.sql` | Criar | 4 alterações de schema: cnpj em contatos_empresas, campos empresa/cnpj em chatbot_sessoes e conversas |
| `supabase/functions/whatsapp-webhook/chatbot-processor.ts` | Modificar | Tipos, handleNOVO, handleAGUARD_EMPRESA (novo), handleAGUARD_CONF, switch |
| `src/hooks/useConversas.js` | Modificar | Adiciona bot_* à query inicial para mostrar contexto sem depender de realtime |
| `src/components/PainelDireito/PainelDireito.jsx` | Modificar | Badge de empresa + CNPJ no bloco "Contexto do bot" |

---

## Task 1: Migration 013 — Schema

**Files:**
- Criar: `supabase/migrations/013_empresa_chatbot.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- ============================================================
-- Migration 013 — Empresa no contexto do chatbot
-- ============================================================

-- 1. CNPJ em contatos_empresas (nullable)
ALTER TABLE contatos_empresas ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 2. Empresa e CNPJ selecionados na sessão do bot
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS empresa_selecionada TEXT;
ALTER TABLE chatbot_sessoes ADD COLUMN IF NOT EXISTS cnpj_selecionado    TEXT;

-- 3. Empresa e CNPJ na conversa (para histórico e contexto do agente)
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_empresa TEXT;
ALTER TABLE conversas ADD COLUMN IF NOT EXISTS bot_cnpj    TEXT;
```

Salvar em `supabase/migrations/013_empresa_chatbot.sql`.

- [ ] **Step 2: Aplicar no Supabase**

No Supabase Dashboard → SQL Editor, executar o conteúdo do arquivo acima.

Verificar que as colunas aparecem:
- `contatos_empresas`: deve ter coluna `cnpj`
- `chatbot_sessoes`: deve ter `empresa_selecionada`, `cnpj_selecionado`
- `conversas`: deve ter `bot_empresa`, `bot_cnpj`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/013_empresa_chatbot.sql
git commit -m "feat: migration 013 — cnpj em contatos_empresas e bot_empresa em conversas"
```

---

## Task 2: Tipos TypeScript — BotEstado e BotSessao

**Files:**
- Modificar: `supabase/functions/whatsapp-webhook/chatbot-processor.ts:7-25`

- [ ] **Step 1: Adicionar AGUARD_EMPRESA ao BotEstado**

Localizar a linha (atual):
```typescript
export type BotEstado =
  | 'NOVO'
  | 'AGUARD_DEPT'
```

Substituir por:
```typescript
export type BotEstado =
  | 'NOVO'
  | 'AGUARD_EMPRESA'
  | 'AGUARD_DEPT'
```

- [ ] **Step 2: Adicionar campos empresa/cnpj ao BotSessao**

Localizar (atual):
```typescript
export interface BotSessao {
  id: string
  conversa_id: string
  estado: BotEstado
  dept_selecionado: string | null
  categoria_id: string | null
  subcategoria_id: string | null
  tentativas_invalidas: number
  ultimo_em: string
}
```

Substituir por:
```typescript
export interface BotSessao {
  id: string
  conversa_id: string
  estado: BotEstado
  dept_selecionado: string | null
  categoria_id: string | null
  subcategoria_id: string | null
  empresa_selecionada: string | null
  cnpj_selecionado: string | null
  tentativas_invalidas: number
  ultimo_em: string
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/whatsapp-webhook/chatbot-processor.ts
git commit -m "feat: adiciona AGUARD_EMPRESA ao BotEstado e campos empresa/cnpj ao BotSessao"
```

---

## Task 3: handleNOVO — Companies Check + Lista Dinâmica

**Files:**
- Modificar: `supabase/functions/whatsapp-webhook/chatbot-processor.ts:625-710`

- [ ] **Step 1: Adicionar nomeContato ao destructuring de params**

Localizar dentro de `handleNOVO` (linha ~632):
```typescript
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params
```

Substituir por:
```typescript
  const { supabase, telefone, nomeContato, conversa, phoneNumberId, accessToken } = params
```

- [ ] **Step 2: Inserir verificação de empresas após o check de horário**

Após o bloco `if (!dentroDoHorario(config, null)) { ... }` (que termina com `return`) e antes da linha `// Verifica cliente recorrente`, inserir:

```typescript
  // Verifica empresas vinculadas ao contato
  const { data: empData } = await supabase
    .from('contatos_empresas')
    .select('id, empresa, cnpj')
    .eq('contato_id', conversa.contato_id)
    .order('criado_em', { ascending: true })

  const empresas = (empData ?? []) as Array<{ id: string; empresa: string; cnpj: string | null }>

  if (empresas.length > 0) {
    // Busca histórico recorrente para combinar com a lista de empresas
    const { data: rec } = await supabase
      .from('conversas')
      .select('bot_departamento, bot_categoria, bot_categoria_id')
      .eq('contato_id', conversa.contato_id)
      .eq('status', 'ENCERRADA')
      .not('bot_departamento', 'is', null)
      .gt('encerrado_em', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('encerrado_em', { ascending: false })
      .limit(1)
      .single()

    const opcoes: Array<{ id: string; title: string; description?: string }> = []

    // Opção combinada recorrente no topo — se houver histórico recente
    if (rec?.bot_departamento) {
      const primeiraEmp = empresas[0]
      const catAnterior = rec.bot_categoria ?? 'assunto anterior'
      const catIdAnterior = (rec.bot_categoria_id as string | null) ?? ''
      opcoes.push({
        id: `EMPRESA_REC:${primeiraEmp.id}:${catIdAnterior}`,
        title: `🔄 ${primeiraEmp.empresa} — mesmo assunto`,
        description: catAnterior,
      })
    }

    // Uma opção por empresa
    for (const emp of empresas) {
      opcoes.push({
        id: `EMPRESA:${emp.id}`,
        title: `🏢 ${emp.empresa}`,
        description: emp.cnpj ? `CNPJ: ${emp.cnpj}` : undefined,
      })
    }

    // Sempre ao final
    opcoes.push({ id: 'OUTRO_ASSUNTO', title: '💬 Falar de outro assunto' })

    await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_EMPRESA' })

    const saudacao = `Olá, ${nomeContato}! 👋 Sobre qual empresa você gostaria de falar?`
    await enviarMenu(telefone, saudacao, 'Ver opções', 'Empresas', opcoes, phoneNumberId, accessToken)
    const opcoesTexto = opcoes
      .map((o, i) => `${i + 1}. ${o.title}${o.description ? ` — ${o.description}` : ''}`)
      .join('\n')
    await inserirMensagemBot(supabase, conversa.id, `${saudacao}\n\n${opcoesTexto}`)
    return
  }
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/whatsapp-webhook/chatbot-processor.ts
git commit -m "feat: handleNOVO — saudação personalizada e lista de empresas em AGUARD_EMPRESA"
```

---

## Task 4: handleAGUARD_EMPRESA — Novo Handler

**Files:**
- Modificar: `supabase/functions/whatsapp-webhook/chatbot-processor.ts` (inserir após handleNOVO, antes de handleAGUARD_DEPT)

- [ ] **Step 1: Inserir função handleAGUARD_EMPRESA**

Após o fechamento da função `handleNOVO` (linha ~710) e antes da declaração de `handleAGUARD_DEPT`, inserir a função completa:

```typescript
async function handleAGUARD_EMPRESA(
  sessao: BotSessao,
  params: ProcessarBotParams,
  config: ChatbotConfig,
  input: ReturnType<typeof resolverInputCliente>,
): Promise<void> {
  const { supabase, telefone, conversa, phoneNumberId, accessToken } = params

  if (input.valor === 'HUMANO') {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return
  }

  // EMPRESA_REC:{ce_id}:{cat_id} — empresa + recorrente combinados
  if (input.valor.startsWith('EMPRESA_REC:')) {
    const partes = input.valor.split(':')
    const ceId = partes[1] ?? ''
    const catId = partes[2] && partes[2].length > 0 ? partes[2] : null

    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj')
      .eq('id', ceId)
      .single()

    const empresa = (ce?.empresa as string | undefined) ?? ''
    const cnpj = (ce?.cnpj as string | null | undefined) ?? null

    // Re-consulta recorrente para recuperar dept (label) — consistente com padrão existente
    const { data: rec } = await supabase
      .from('conversas')
      .select('bot_departamento, bot_categoria_id')
      .eq('contato_id', conversa.contato_id)
      .eq('status', 'ENCERRADA')
      .not('bot_departamento', 'is', null)
      .order('encerrado_em', { ascending: false })
      .limit(1)
      .single()

    const deptAnterior = (rec?.bot_departamento as string | undefined) ?? ''

    await atualizarSessao(supabase, sessao.id, {
      empresa_selecionada: empresa || null,
      cnpj_selecionado: cnpj,
      dept_selecionado: deptAnterior,
      categoria_id: catId,
      tentativas_invalidas: 0,
    })

    if (empresa) {
      await supabase
        .from('conversas')
        .update({ bot_empresa: empresa, bot_cnpj: cnpj })
        .eq('id', conversa.id)
    }

    if (catId) {
      const subs = await enviarSubCategorias(
        supabase, telefone, catId, phoneNumberId, accessToken, conversa.id,
      )
      if (subs.length === 0) {
        await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_CONF', subcategoria_id: null })
        await enviarConfirmacao(
          supabase,
          telefone,
          { ...sessao, empresa_selecionada: empresa || null, cnpj_selecionado: cnpj, dept_selecionado: deptAnterior, categoria_id: catId, estado: 'AGUARD_CONF', subcategoria_id: null },
          phoneNumberId,
          accessToken,
          conversa.id,
        )
      } else {
        await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_SUB' })
      }
    } else {
      // Sem categoria prévia — envia menu de departamentos
      await atualizarSessao(supabase, sessao.id, { estado: 'AGUARD_DEPT', dept_selecionado: null, categoria_id: null })
      await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    }
    return
  }

  // EMPRESA:{ce_id} — empresa selecionada, novo assunto
  if (input.valor.startsWith('EMPRESA:')) {
    const ceId = input.valor.split(':')[1] ?? ''

    const { data: ce } = await supabase
      .from('contatos_empresas')
      .select('empresa, cnpj')
      .eq('id', ceId)
      .single()

    const empresa = (ce?.empresa as string | undefined) ?? ''
    const cnpj = (ce?.cnpj as string | null | undefined) ?? null

    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_DEPT',
      empresa_selecionada: empresa || null,
      cnpj_selecionado: cnpj,
      tentativas_invalidas: 0,
    })

    if (empresa) {
      await supabase
        .from('conversas')
        .update({ bot_empresa: empresa, bot_cnpj: cnpj })
        .eq('id', conversa.id)
    }

    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    return
  }

  // OUTRO_ASSUNTO — sem contexto de empresa, fluxo normal
  if (input.valor === 'OUTRO_ASSUNTO') {
    await atualizarSessao(supabase, sessao.id, {
      estado: 'AGUARD_DEPT',
      empresa_selecionada: null,
      cnpj_selecionado: null,
      tentativas_invalidas: 0,
    })
    await enviarTexto(telefone, config.msg_boas_vindas, phoneNumberId, accessToken)
    await inserirMensagemBot(supabase, conversa.id, config.msg_boas_vindas)
    await enviarMenuDepts(telefone, phoneNumberId, accessToken, supabase, conversa.id)
    return
  }

  // Input inválido — reexibe lista simplificada (sem opção recorrente)
  const { data: empData } = await supabase
    .from('contatos_empresas')
    .select('id, empresa, cnpj')
    .eq('contato_id', conversa.contato_id)
    .order('criado_em', { ascending: true })

  const empresas = (empData ?? []) as Array<{ id: string; empresa: string; cnpj: string | null }>
  const novasTentativas = sessao.tentativas_invalidas + 1

  if (novasTentativas >= config.max_tentativas) {
    await escalarParaHumano(supabase, sessao, conversa.id, telefone, phoneNumberId, accessToken)
    return
  }

  await atualizarSessao(supabase, sessao.id, { tentativas_invalidas: novasTentativas })

  const opcoes = [
    ...empresas.map(emp => ({
      id: `EMPRESA:${emp.id}`,
      title: `🏢 ${emp.empresa}`,
      description: emp.cnpj ? `CNPJ: ${emp.cnpj}` : undefined,
    })),
    { id: 'OUTRO_ASSUNTO', title: '💬 Falar de outro assunto' },
  ]

  const msgInvalida = `Opção inválida. Escolha uma das empresas (tentativa ${novasTentativas}/${config.max_tentativas}).`
  await enviarMenu(telefone, msgInvalida, 'Ver opções', 'Empresas', opcoes, phoneNumberId, accessToken)
  await inserirMensagemBot(
    supabase,
    conversa.id,
    `${msgInvalida}\n\n${opcoes.map((o, i) => `${i + 1}. ${o.title}`).join('\n')}`,
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/whatsapp-webhook/chatbot-processor.ts
git commit -m "feat: handleAGUARD_EMPRESA — seleciona empresa e roteia para fluxo correto"
```

---

## Task 5: handleAGUARD_CONF + Switch — Empresa na Mensagem de Sistema

**Files:**
- Modificar: `supabase/functions/whatsapp-webhook/chatbot-processor.ts:1033` e `1192-1215`

- [ ] **Step 1: Adicionar empresa na mensagem de sistema de roteamento**

Localizar em `handleAGUARD_CONF` (linha ~1033):
```typescript
    await inserirMensagemSistema(supabase, conversa.id, `🤖 Bot roteou: ${resumo}`)
```

Substituir por:
```typescript
    const prefixoEmpresa = sessao.empresa_selecionada ? `${sessao.empresa_selecionada} — ` : ''
    await inserirMensagemSistema(supabase, conversa.id, `🤖 Bot roteou: ${prefixoEmpresa}${resumo}`)
```

- [ ] **Step 2: Adicionar case AGUARD_EMPRESA ao switch em processarMensagemBot**

Localizar o switch (linha ~1192):
```typescript
  switch (sessao.estado) {
    case 'NOVO':
      await handleNOVO(sessao, params, config, feriadoHoje)
      break

    case 'AGUARD_DEPT':
```

Substituir por:
```typescript
  switch (sessao.estado) {
    case 'NOVO':
      await handleNOVO(sessao, params, config, feriadoHoje)
      break

    case 'AGUARD_EMPRESA':
      await handleAGUARD_EMPRESA(sessao, params, config, input)
      break

    case 'AGUARD_DEPT':
```

- [ ] **Step 3: Testar o deploy da Edge Function via dev simulator**

Usar o simulador de desenvolvimento para testar o fluxo completo:

**Cenário A — contato COM empresa cadastrada:**
1. Enviar mensagem como número de telefone que tem linha em `contatos_empresas`
2. Esperar resposta: deve mostrar lista com `🏢 [Empresa]` e `💬 Falar de outro assunto`
3. Selecionar `EMPRESA:{uuid}` → deve mostrar menu de departamentos
4. Concluir o roteamento → verificar na tabela `conversas` se `bot_empresa` foi preenchido

**Cenário B — contato COM empresa E histórico recorrente:**
1. Usar número que tem empresa E conversa ENCERRADA nos últimos 30 dias com `bot_departamento` preenchido
2. Esperar resposta: lista deve ter opção `🔄 [Empresa] — mesmo assunto` no topo
3. Selecionar a opção recorrente → deve ir direto para subcategorias ou confirmação

**Cenário C — contato SEM empresa:**
1. Usar número sem linhas em `contatos_empresas`
2. Esperar resposta: fluxo existente (mensagem de boas-vindas + menu de departamentos)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/whatsapp-webhook/chatbot-processor.ts
git commit -m "feat: empresa na msg sistema de roteamento e case AGUARD_EMPRESA no switch"
```

---

## Task 6: Frontend — useConversas + PainelDireito

**Files:**
- Modificar: `src/hooks/useConversas.js:12-18`
- Modificar: `src/components/PainelDireito/PainelDireito.jsx:143-167`

- [ ] **Step 1: Adicionar colunas bot_* ao SELECT de useConversas**

Localizar em `src/hooks/useConversas.js` (linhas 11-18):
```javascript
    let query = supabase
      .from('conversas')
      .select(`
        id, protocolo, status, departamento,
        aberto_em, atualizado_em, encerrado_em,
        contatos ( id, telefone, nome, empresa ),
        usuarios ( id, nome ),
        mensagens ( id, conteudo, origem, criado_em, lida )
      `)
```

Substituir por:
```javascript
    let query = supabase
      .from('conversas')
      .select(`
        id, protocolo, status, departamento,
        aberto_em, atualizado_em, encerrado_em,
        bot_departamento, bot_categoria, bot_subcategoria, bot_empresa, bot_cnpj,
        contatos ( id, telefone, nome ),
        usuarios ( id, nome ),
        mensagens ( id, conteudo, origem, criado_em, lida )
      `)
```

> Nota: `empresa` foi removida de `contatos` na migration 012 e estava causando query em coluna inexistente.

- [ ] **Step 2: Inserir bloco de empresa no Contexto do bot em PainelDireito**

Localizar em `src/components/PainelDireito/PainelDireito.jsx` o comentário `{/* Trilha dept › cat › sub */}` (linha ~143). Inserir o seguinte bloco IMEDIATAMENTE ANTES dele (após o fechamento da `</div>` do header do bot):

```jsx
          {/* Empresa selecionada pelo bot */}
          {conversa.bot_empresa && (
            <div style={{ marginBottom: 10 }}>
              <span style={{
                background: '#1e3a5f', color: '#fff',
                fontSize: 10, fontWeight: 700,
                padding: '3px 8px', borderRadius: 4,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                🏢 {conversa.bot_empresa}
              </span>
              {conversa.bot_cnpj && (
                <div style={{
                  fontSize: 9, color: '#7a9fc0',
                  fontFamily: 'DM Mono, monospace', marginTop: 3,
                }}>
                  CNPJ {conversa.bot_cnpj}
                </div>
              )}
            </div>
          )}
```

A estrutura ao redor ficará:

```jsx
          {/* Header */}
          <div style={{ ... }}>
            ...
          </div>

          {/* Empresa selecionada pelo bot */}   ← INSERIDO AQUI
          {conversa.bot_empresa && ( ... )}

          {/* Trilha dept › cat › sub */}
          <div style={{ display: 'flex', flexWrap: 'wrap', ...}}>
```

- [ ] **Step 3: Verificar no browser**

Iniciar o servidor de desenvolvimento e abrir o CRM. Para uma conversa com `bot_empresa` preenchido no banco, o bloco "Contexto do bot" deve mostrar:
- Badge azul escuro `🏢 [Nome da empresa]` acima da trilha dept › cat
- Linha cinza mono `CNPJ XX.XXX.XXX/XXXX-XX` logo abaixo (se `bot_cnpj` preenchido)

Para uma conversa sem `bot_empresa`, o bloco não deve aparecer.

- [ ] **Step 4: Commit final**

```bash
git add src/hooks/useConversas.js src/components/PainelDireito/PainelDireito.jsx
git commit -m "feat: bot_empresa e bot_cnpj no PainelDireito e no SELECT de conversas"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Migration 013 ✓ | `AGUARD_EMPRESA` state ✓ | `handleNOVO` companies check ✓ | `handleAGUARD_EMPRESA` handler ✓ | empresa em msg sistema ✓ | PainelDireito badge ✓
- [x] **Sem placeholders:** Todos os steps têm código completo
- [x] **Consistência de tipos:** `empresa_selecionada: string | null` em BotSessao (Task 2) é lido em `handleAGUARD_CONF` (Task 5) via `sessao.empresa_selecionada` — consistente
- [x] **IDs de opções:** `EMPRESA_REC:{ce_id}:{cat_id}` e `EMPRESA:{ce_id}` usam UUIDs sem `:` — parsing seguro com `split(':')`
- [x] **Sem alterações no fluxo existente:** contatos sem empresas em `contatos_empresas` seguem exatamente o mesmo caminho de antes
