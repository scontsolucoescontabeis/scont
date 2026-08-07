# Envio de Documentos por E-mail — Controle de Frequência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de gerar os PDFs em "Gerar Benefícios" ou "Gerar Folhas de Ponto" (Controle de Frequência), permitir enviá-los por e-mail (como anexo) ao responsável cadastrado da empresa, ou — quando o lote foi gerado via um Grupo de Empresas marcado no seletor — a um único e-mail responsável pelo grupo inteiro.

**Architecture:** Dois campos novos (`email_responsavel`) em `rh_empresas` e `rh_grupos_empresas`. Um módulo JS puro e testável (`envio-email-frequencia.js`) resolve, para um lote de empresas geradas, quem recebe o quê (grupo vs. individual, múltiplos e-mails, empresas sem cadastro). As duas telas passam a guardar os blobs de PDF já gerados em `state`, sem reprocessar nada. Um botão novo abre um modal de confirmação e dispara a Edge Function `enviar-email` (já existente, agora com suporte a anexos) uma vez por destinatário resolvido.

**Tech Stack:** JavaScript vanilla (sem bundler/framework), Supabase (Postgres + Edge Functions Deno/TypeScript), jsPDF/JSZip já carregados via CDN, Node.js só para os testes do módulo puro (sem framework de teste — mesmo padrão `assert` + runner manual já usado em `test-*.js` do repo).

## Global Constraints

- Mensagens de UI, comentários e identificadores de domínio em português, seguindo o vocabulário já usado no arquivo (`empresa`, `grupo`, `competência`, `responsável`).
- Nenhuma tabela nova — só `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` em tabelas existentes, em SQL separado que **não é executado automaticamente** (mesma convenção do repo: anon key não roda DDL, arquivo fica pendente de execução manual no SQL Editor do Supabase).
- Módulos JS puros e testáveis usam o padrão isomórfico já estabelecido no repo: funções são globals quando carregadas via `<script>` no browser, e exportadas via `if (typeof module !== 'undefined' && module.exports) { module.exports = {...} }` para rodar em Node sem alterações.
- Modais novos seguem o padrão CSS/JS já existente: `<div id="..." class="modal">...</div>` (oculto por padrão), aberto com `document.getElementById(id).classList.add('active')` e fechado com `.classList.remove('active')` — nunca `style.display`.
- Downloads de blob usam a função já existente `_baixarBlob(blob, nomeArquivo)` — não reimplementar o `createObjectURL`/`click()`.
- Mudanças em `script.js`/`admin.js` são validadas com `node -c <arquivo>` (checagem de sintaxe) — não há harness de teste em browser neste repo; QA visual fica para o usuário validar manualmente depois (mesma convenção já usada em todas as specs anteriores deste módulo).
- A Edge Function `supabase/functions/enviar-email/index.ts` não pode quebrar nenhum uso existente: o campo novo (`anexos`) é sempre opcional, comportamento sem ele fica idêntico ao atual.

---

### Task 1: Migração SQL — `email_responsavel`

**Files:**
- Create: `Projeto RH/schema_rh_email_responsavel.sql`

**Interfaces:**
- Produces: colunas `rh_empresas.email_responsavel` (TEXT, nullable) e `rh_grupos_empresas.email_responsavel` (TEXT, nullable) — usadas por todas as tasks seguintes. **Não roda sozinha** — fica pendente de execução manual no Supabase, mesmo com o resto do código já commitado (documentar isso no fim da task).

- [ ] **Step 1: Criar o arquivo de migração**

```sql
-- Migração: e-mail do(s) responsável(is) pelo envio de documentos (Benefícios / Folha de Ponto)
-- Execute no SQL Editor do Supabase

ALTER TABLE public.rh_empresas ADD COLUMN IF NOT EXISTS email_responsavel TEXT;
ALTER TABLE public.rh_grupos_empresas ADD COLUMN IF NOT EXISTS email_responsavel TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/schema_rh_email_responsavel.sql"
git commit -m "feat(rh): adiciona coluna email_responsavel em rh_empresas e rh_grupos_empresas"
```

---

### Task 2: Módulo puro `envio-email-frequencia.js` (resolução de destinatários)

**Files:**
- Create: `Projeto RH/envio-email-frequencia.js`
- Test: `Projeto RH/test-envio-email-frequencia.js`

**Interfaces:**
- Produces:
  - `_dividirEmails(texto: string|null|undefined): string[]` — separa por vírgula, remove espaços e vazios, sem duplicar.
  - `_resolverDestinatariosEnvio({ itensPorEmpresa, gruposMarcadosIds, gruposInfo, itensGruposCache, emailPorEmpresa }): { destinatarios, semEmail }`
    - `itensPorEmpresa`: `Array<{ codigoEmpresa: string, nomeEmpresa: string, arquivos: Array<{ nome: string, blob: any }> }>`
    - `gruposMarcadosIds`: `string[]` (IDs de grupo marcados no seletor da tela no momento da geração)
    - `gruposInfo`: `Array<{ id: string, nome_grupo: string, email_responsavel: string|null }>`
    - `itensGruposCache`: `{ [grupoId: string]: Set<string> }` (codigo_empresa por grupo)
    - `emailPorEmpresa`: `{ [codigoEmpresa: string]: string|null }`
    - retorna `destinatarios: Array<{ email: string, origem: 'grupo'|'empresa', nomeOrigem: string, empresas: string[], arquivos: Array<{nome,blob}> }>` e `semEmail: string[]` (nomes de empresa sem e-mail resolvido)
  - Consumido pela Task 9 (`script.js`), que monta os parâmetros a partir do `state` e das caches de grupo já existentes.

- [ ] **Step 1: Escrever os testes (falhando)**

```js
const assert = require('node:assert');
const { _dividirEmails, _resolverDestinatariosEnvio } = require('./envio-email-frequencia.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

teste('_dividirEmails separa por vírgula, remove espaços e vazios', () => {
    assert.deepStrictEqual(_dividirEmails('a@x.com, b@x.com ,, c@x.com'), ['a@x.com', 'b@x.com', 'c@x.com']);
});

teste('_dividirEmails lida com null/undefined/vazio', () => {
    assert.deepStrictEqual(_dividirEmails(null), []);
    assert.deepStrictEqual(_dividirEmails(undefined), []);
    assert.deepStrictEqual(_dividirEmails(''), []);
});

teste('_dividirEmails remove duplicados', () => {
    assert.deepStrictEqual(_dividirEmails('a@x.com, a@x.com'), ['a@x.com']);
});

teste('empresa sem grupo marcado usa o e-mail individual', () => {
    const { destinatarios, semEmail } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: [],
        gruposInfo: [],
        itensGruposCache: {},
        emailPorEmpresa: { '100': 'financeiro@empresaa.com' },
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'financeiro@empresaa.com');
    assert.strictEqual(destinatarios[0].origem, 'empresa');
    assert.strictEqual(destinatarios[0].nomeOrigem, 'Empresa A');
    assert.deepStrictEqual(destinatarios[0].empresas, ['Empresa A']);
    assert.deepStrictEqual(destinatarios[0].arquivos, [{ nome: 'a.pdf', blob: 'BLOB_A' }]);
    assert.deepStrictEqual(semEmail, []);
});

teste('empresa sem e-mail cadastrado entra em semEmail', () => {
    const { destinatarios, semEmail } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [] }],
        gruposMarcadosIds: [],
        gruposInfo: [],
        itensGruposCache: {},
        emailPorEmpresa: {},
    });
    assert.deepStrictEqual(destinatarios, []);
    assert.deepStrictEqual(semEmail, ['Empresa A']);
});

teste('grupo marcado com e-mail agrupa os anexos das empresas do grupo', () => {
    const { destinatarios, semEmail } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [
            { codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] },
            { codigoEmpresa: '200', nomeEmpresa: 'Empresa B', arquivos: [{ nome: 'b.pdf', blob: 'BLOB_B' }] },
        ],
        gruposMarcadosIds: ['g1'],
        gruposInfo: [{ id: 'g1', nome_grupo: 'Grupo Shopping X', email_responsavel: 'grupo@shoppingx.com' }],
        itensGruposCache: { g1: new Set(['100', '200']) },
        emailPorEmpresa: { '100': 'a@a.com', '200': 'b@b.com' },
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'grupo@shoppingx.com');
    assert.strictEqual(destinatarios[0].origem, 'grupo');
    assert.strictEqual(destinatarios[0].nomeOrigem, 'Grupo Shopping X');
    assert.deepStrictEqual(destinatarios[0].empresas, ['Empresa A', 'Empresa B']);
    assert.deepStrictEqual(destinatarios[0].arquivos, [{ nome: 'a.pdf', blob: 'BLOB_A' }, { nome: 'b.pdf', blob: 'BLOB_B' }]);
    assert.deepStrictEqual(semEmail, []);
});

teste('grupo marcado sem e-mail cadastrado cai para o e-mail individual da empresa', () => {
    const { destinatarios } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: ['g1'],
        gruposInfo: [{ id: 'g1', nome_grupo: 'Grupo Shopping X', email_responsavel: null }],
        itensGruposCache: { g1: new Set(['100']) },
        emailPorEmpresa: { '100': 'a@a.com' },
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'a@a.com');
    assert.strictEqual(destinatarios[0].origem, 'empresa');
});

teste('e-mail com múltiplos endereços gera um destinatário por endereço, mesmos anexos', () => {
    const { destinatarios } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: [],
        gruposInfo: [],
        itensGruposCache: {},
        emailPorEmpresa: { '100': 'a@a.com, b@a.com' },
    });
    assert.strictEqual(destinatarios.length, 2);
    assert.deepStrictEqual(destinatarios.map(d => d.email).sort(), ['a@a.com', 'b@a.com']);
    destinatarios.forEach(d => assert.deepStrictEqual(d.arquivos, [{ nome: 'a.pdf', blob: 'BLOB_A' }]));
});

teste('empresa em dois grupos marcados usa o primeiro grupo da lista', () => {
    const { destinatarios } = _resolverDestinatariosEnvio({
        itensPorEmpresa: [{ codigoEmpresa: '100', nomeEmpresa: 'Empresa A', arquivos: [{ nome: 'a.pdf', blob: 'BLOB_A' }] }],
        gruposMarcadosIds: ['g1', 'g2'],
        gruposInfo: [
            { id: 'g1', nome_grupo: 'Grupo 1', email_responsavel: 'g1@x.com' },
            { id: 'g2', nome_grupo: 'Grupo 2', email_responsavel: 'g2@x.com' },
        ],
        itensGruposCache: { g1: new Set(['100']), g2: new Set(['100']) },
        emailPorEmpresa: {},
    });
    assert.strictEqual(destinatarios.length, 1);
    assert.strictEqual(destinatarios[0].email, 'g1@x.com');
});

console.log(`\n${testesExecutados} teste(s) executado(s) com sucesso.`);
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node "Projeto RH/test-envio-email-frequencia.js"`
Expected: erro `Cannot find module './envio-email-frequencia.js'`

- [ ] **Step 3: Implementar o módulo**

```js
// Resolução de destinatários de e-mail (Benefícios / Folha de Ponto) — módulo puro,
// sem dependência de DOM/Supabase, para poder ser testado isoladamente (ver
// test-envio-email-frequencia.js). Consumido por script.js.

function _dividirEmails(texto) {
    if (!texto) return [];
    const vistos = new Set();
    const resultado = [];
    String(texto).split(',').forEach(parte => {
        const email = parte.trim();
        if (email && !vistos.has(email)) {
            vistos.add(email);
            resultado.push(email);
        }
    });
    return resultado;
}

// itensPorEmpresa: [{ codigoEmpresa, nomeEmpresa, arquivos: [{nome, blob}] }]
// gruposMarcadosIds: string[] (grupos marcados no seletor da tela quando os PDFs foram gerados)
// gruposInfo: [{ id, nome_grupo, email_responsavel }]
// itensGruposCache: { [grupoId]: Set(codigoEmpresa) }
// emailPorEmpresa: { [codigoEmpresa]: email_responsavel }
function _resolverDestinatariosEnvio({ itensPorEmpresa, gruposMarcadosIds, gruposInfo, itensGruposCache, emailPorEmpresa }) {
    const gruposPorId = new Map((gruposInfo || []).map(g => [g.id, g]));
    const baldes = new Map(); // email -> destinatário
    const semEmail = [];

    (itensPorEmpresa || []).forEach(item => {
        const grupoOrigemId = (gruposMarcadosIds || []).find(
            gid => (itensGruposCache[gid] || new Set()).has(item.codigoEmpresa)
        );
        const grupo = grupoOrigemId ? gruposPorId.get(grupoOrigemId) : null;
        const emailsGrupo = grupo ? _dividirEmails(grupo.email_responsavel) : [];
        const emails = emailsGrupo.length > 0 ? emailsGrupo : _dividirEmails((emailPorEmpresa || {})[item.codigoEmpresa]);

        if (emails.length === 0) {
            semEmail.push(item.nomeEmpresa);
            return;
        }

        const origem = emailsGrupo.length > 0 ? 'grupo' : 'empresa';
        const nomeOrigem = emailsGrupo.length > 0 ? grupo.nome_grupo : item.nomeEmpresa;

        emails.forEach(email => {
            if (!baldes.has(email)) baldes.set(email, { email, origem, nomeOrigem, empresas: [], arquivos: [] });
            const balde = baldes.get(email);
            if (!balde.empresas.includes(item.nomeEmpresa)) balde.empresas.push(item.nomeEmpresa);
            balde.arquivos.push(...item.arquivos);
        });
    });

    return { destinatarios: Array.from(baldes.values()), semEmail };
}

// Converte um Blob em base64 — usa Buffer quando disponível (Node), senão btoa (browser).
// Não é coberto pelos testes de node (depende de Blob real), validado manualmente na task de UI.
async function _blobParaBase64(blob) {
    const buffer = await blob.arrayBuffer();
    if (typeof Buffer !== 'undefined') return Buffer.from(buffer).toString('base64');
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { _dividirEmails, _resolverDestinatariosEnvio, _blobParaBase64 };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node "Projeto RH/test-envio-email-frequencia.js"`
Expected: todas as linhas `OK ...` e `8 teste(s) executado(s) com sucesso.` (sem erro)

- [ ] **Step 5: Checar sintaxe do módulo isoladamente**

Run: `node -c "Projeto RH/envio-email-frequencia.js"`
Expected: sem output (sintaxe válida)

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/envio-email-frequencia.js" "Projeto RH/test-envio-email-frequencia.js"
git commit -m "feat(rh): modulo puro de resolucao de destinatarios de e-mail (Beneficios/Folha de Ponto)"
```

---

### Task 3: Suporte a anexos + template na Edge Function `enviar-email`

**Files:**
- Modify: `supabase/functions/enviar-email/index.ts`

**Interfaces:**
- Consumes: nenhuma (edge function isolada).
- Produces: contrato HTTP novo — body aceita `anexos?: Array<{ nome: string; conteudoBase64: string }>` opcional; `params.tipo === 'documentos_frequencia'` com `params.tipoDocumento`, `params.competencia`, `params.destino`. Consumido pela Task 9 (`script.js`, `_confirmarEnvioEmail`).

- [ ] **Step 1: Adicionar o template `documentos_frequencia` em `montarHtml()`**

O arquivo já tem uma sequência de blocos `if (tipo === '...') { ... return _cabecalho(...) + \`...\` + _rodape(...) + _fechamento(); }`, um por tipo de e-mail, terminando com `if (tipo === 'certificado_renovado_alerta_resolvido') { ... }` e, logo depois, o comentário `// ── Template padrão (apresentação) ────────────────────────`.

Inserir um novo bloco `if` entre esses dois pontos (depois do `}` que fecha `certificado_renovado_alerta_resolvido`, antes do comentário do template padrão), sem alterar nenhum bloco existente:

```ts
    // ── Documentos de Benefícios / Folha de Ponto (Controle de Frequência) ──
    if (tipo === 'documentos_frequencia') {
        const tipoDocumento = (params.tipoDocumento as string) || 'Documentos';
        const competencia   = (params.competencia as string)   || '';
        const destino       = (params.destino as string)       || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">📎 ${tipoDocumento} — ${competencia}</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            Segue${destino ? `m em anexo os documentos de <strong>${tipoDocumento}</strong> de <strong>${destino}</strong>` : ' em anexo os documentos'}
            referentes à competência <strong>${competencia}</strong>.
          </p>
        ` + _rodape(nomeRemetente) + _fechamento();
    }
```

- [ ] **Step 2: Repassar `anexos` para o payload da Brevo**

Em `enviarBrevo`, mudar a assinatura e o corpo da chamada:

```ts
async function enviarBrevo(cfg: Record<string, string>, payload: {
    nomeRemetente: string; emailRemetente: string; to: string; subject: string; html: string;
    anexos?: Array<{ nome: string; conteudoBase64: string }>;
}) {
    if (!cfg.brevo_api_key) throw new Error('Brevo API Key não configurada. Acesse Admin → Configurações.');

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: { 'api-key': cfg.brevo_api_key, 'Content-Type': 'application/json', 'accept': 'application/json' },
        body:    JSON.stringify({
            sender:      { name: payload.nomeRemetente, email: payload.emailRemetente },
            to:          [{ email: payload.to }],
            subject:     payload.subject,
            htmlContent: payload.html,
            ...(payload.anexos?.length ? { attachment: payload.anexos.map(a => ({ content: a.conteudoBase64, name: a.nome })) } : {}),
        }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error('Brevo: ' + (json?.message ?? JSON.stringify(json)));
    return { provider: 'brevo', id: json.messageId };
}
```

- [ ] **Step 3: Repassar `anexos` para o SMTP (nodemailer)**

Mudar `enviarSmtp`:

```ts
async function enviarSmtp(cfg: Record<string, string>, payload: {
    from: string; to: string; subject: string; html: string;
    anexos?: Array<{ nome: string; conteudoBase64: string }>;
}) {
    if (!cfg.smtp_host || !cfg.smtp_usuario || !cfg.smtp_senha) {
        throw new Error('Configurações SMTP incompletas. Acesse Admin → Configurações → SMTP.');
    }

    const porta   = parseInt(cfg.smtp_porta || '587');
    const useSSL  = cfg.smtp_seguranca === 'SSL';

    const transporter = nodemailer.createTransport({
        host:   cfg.smtp_host,
        port:   porta,
        secure: useSSL,
        auth:   { user: cfg.smtp_usuario, pass: cfg.smtp_senha },
        tls:    { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
        from:    payload.from,
        to:      payload.to,
        subject: payload.subject,
        html:    payload.html,
        ...(payload.anexos?.length ? { attachments: payload.anexos.map(a => ({ filename: a.nome, content: a.conteudoBase64, encoding: 'base64' })) } : {}),
    });

    return { provider: 'smtp', id: info.messageId };
}
```

- [ ] **Step 4: Ler `anexos` do body e repassar no handler principal**

Em `Deno.serve(async (req) => { ... })`, no bloco que faz `await req.json()`, adicionar o campo:

```ts
        const body = await req.json() as {
            destinatario?: string;
            usuarioId?: string;
            nomeDestinatario?: string;
            assunto?: string;
            params?: Record<string, unknown>;
            anexos?: Array<{ nome: string; conteudoBase64: string }>;
        };
        const { usuarioId, assunto, anexos } = body;
```

E repassar `anexos` nas duas chamadas de envio:

```ts
        const result = provedor === 'smtp'
            ? await enviarSmtp(cfg, { ...mailPayload, anexos })
            : await enviarBrevo(cfg, { nomeRemetente: nomeRem, emailRemetente: emailRem, to: destinatario, subject: mailPayload.subject, html: mailPayload.html, anexos });
```

- [ ] **Step 5: Revisão manual do arquivo completo**

Ler `supabase/functions/enviar-email/index.ts` do início ao fim depois das edições e confirmar:
- todos os `if (tipo === ...)` anteriores continuam intactos e retornando corretamente;
- não há chave `}` sobrando/faltando ao redor do novo bloco `documentos_frequencia`;
- `enviarSmtp`/`enviarBrevo` continuam funcionando quando `anexos` é `undefined` (spread condicional `...(payload.anexos?.length ? {...} : {})` não quebra o payload).

(Sem `deno`/`tsc` disponível neste ambiente para checagem automática — a validação aqui é leitura cuidadosa, mesma convenção já usada nas sessões anteriores que editaram este arquivo.)

- [ ] **Step 6: Deploy da Edge Function**

Run: `supabase functions deploy enviar-email`
Expected: deploy concluído sem erro (CLI já linkada ao projeto `dsdqwigopzrdmxtmhsez`)

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/enviar-email/index.ts
git commit -m "feat(email): suporte a anexos e template documentos_frequencia na Edge Function enviar-email"
```

---

### Task 4: Carregar `email_responsavel` em `state.empresas` e nas caches de grupo

**Files:**
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: coluna `rh_empresas.email_responsavel` / `rh_grupos_empresas.email_responsavel` (Task 1).
- Produces: `state.empresas[i].email_responsavel`; `_gruposBeneficiosCache[i].email_responsavel`; `_gruposFolhaPontoCache[i].email_responsavel` — consumidos pela Task 9.

- [ ] **Step 1: Incluir a coluna no carregamento principal de empresas**

Em `script.js`, na função `carregarEmpresas()` (linha ~90), mudar:

```js
        const { data, error } = await supabaseClient
            .from('rh_empresas')
            .select('codigo_empresa, nome_empresa, status_situacao, email_responsavel')
            .order('nome_empresa', { ascending: true });
```

- [ ] **Step 2: Incluir a coluna na cache de grupos de Benefícios**

Em `_carregarGruposParaBeneficios()` (linha ~3769), mudar a query e o mapeamento:

```js
async function _carregarGruposParaBeneficios() {
    try {
        const [{ data: grupos, error: errG }, { data: itens, error: errI }] = await Promise.all([
            supabaseClient.from('rh_grupos_empresas').select('id, nome_grupo, email_responsavel').order('nome_grupo', { ascending: true }),
            supabaseClient.from('rh_grupos_empresas_itens').select('grupo_id, codigo_empresa'),
        ]);
        if (errG) throw errG;
        if (errI) throw errI;

        _itensGruposBeneficiosCache = {};
        (itens || []).forEach(it => {
            (_itensGruposBeneficiosCache[it.grupo_id] ??= new Set()).add(it.codigo_empresa);
        });
        _gruposBeneficiosCache = (grupos || []).map(g => ({
            id: g.id,
            nome_grupo: g.nome_grupo,
            email_responsavel: g.email_responsavel,
            qtdEmpresas: _itensGruposBeneficiosCache[g.id]?.size || 0,
        }));

        document.getElementById('beneficiosBuscaGrupo').value = '';
        _renderizarListaGruposBeneficios(_gruposBeneficiosCache);
    } catch (erro) {
        console.error('Erro ao carregar grupos de empresas:', erro);
    }
}
```

(Só os dois `select`/`map` mudam — o resto da função permanece igual ao já existente.)

- [ ] **Step 3: Incluir a coluna na cache de grupos de Folha de Ponto**

Em `_carregarGruposParaFolhaPonto()` (linha ~5050), aplicar a mesma mudança:

```js
async function _carregarGruposParaFolhaPonto() {
    try {
        const [{ data: grupos, error: errG }, { data: itens, error: errI }] = await Promise.all([
            supabaseClient.from('rh_grupos_empresas').select('id, nome_grupo, email_responsavel').order('nome_grupo', { ascending: true }),
            supabaseClient.from('rh_grupos_empresas_itens').select('grupo_id, codigo_empresa'),
        ]);
        if (errG) throw errG;
        if (errI) throw errI;

        _itensGruposFolhaPontoCache = {};
        (itens || []).forEach(it => {
            (_itensGruposFolhaPontoCache[it.grupo_id] ??= new Set()).add(it.codigo_empresa);
        });
        _gruposFolhaPontoCache = (grupos || []).map(g => ({
            id: g.id,
            nome_grupo: g.nome_grupo,
            email_responsavel: g.email_responsavel,
            qtdEmpresas: _itensGruposFolhaPontoCache[g.id]?.size || 0,
        }));

        document.getElementById('folhaPontoBuscaGrupo').value = '';
        _renderizarListaGruposFolhaPonto(_gruposFolhaPontoCache);
    } catch (erro) {
        console.error('Erro ao carregar grupos de empresas:', erro);
    }
}
```

- [ ] **Step 4: Checar sintaxe**

Run: `node -c "Projeto RH/script.js"`
Expected: sem output (sintaxe válida)

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat(rh): carrega email_responsavel de empresas e grupos em memoria"
```

---

### Task 5: Cadastro de e-mail responsável por empresa em `admin.html`

**Files:**
- Modify: `Projeto RH/admin.html`
- Modify: `Projeto RH/admin.js`

**Interfaces:**
- Consumes: coluna `rh_empresas.email_responsavel` (Task 1).
- Produces: coluna editável na tabela de Empresas do painel admin — não é consumida por outra task (é o cadastro em si), mas alimenta o dado que a Task 9 lê de `rh_empresas`.

- [ ] **Step 1: Adicionar a coluna no cabeçalho da tabela**

Em `admin.html`, dentro de `<thead><tr>...</tr></thead>` da tabela de Empresas (linha ~150), adicionar depois de `<th>UF</th>`:

```html
                            <th>UF</th>
                            <th>E-mail Responsável</th>
                        </tr></thead>
                        <tbody id="empresasTableBody"><tr><td colspan="14" style="text-align: center; color: #95A5A6;">Carregando...</td></tr></tbody>
```

(`colspan` sobe de `13` para `14`.)

- [ ] **Step 2: Adicionar a célula editável em `renderizarTabelaEmpresas()`**

Em `admin.js`, dentro do `pagina.forEach(e => { tbody.innerHTML += \`<tr>...</tr>\`; })` (linha ~160), adicionar uma `<td>` antes do fechamento `</tr>`:

```js
    pagina.forEach(e => {
        tbody.innerHTML += `<tr>
            <td title="${e.codigo_empresa}"><strong>${e.codigo_empresa}</strong></td>
            <td title="${e.nome_empresa}">${e.nome_empresa}</td>
            <td title="${e.cnpj||''}" style="font-family:monospace;">${fmtCnpj(e.cnpj)}</td>
            <td title="${e.regime_enquadramento||''}">${fmt(e.regime_enquadramento)}</td>
            <td title="${e.inscricao_estadual||''}">${fmt(e.inscricao_estadual)}</td>
            <td title="${e.inscricao_municipal||''}">${fmt(e.inscricao_municipal)}</td>
            <td title="${e.municipio||''}">${fmt(e.municipio)}</td>
            <td>${statusBadge(e.status_situacao)}</td>
            <td>${fmtData(e.data_cadastro)}</td>
            <td title="${e.endereco||''}">${fmt(e.endereco)}</td>
            <td title="${e.cep||''}">${fmt(e.cep)}</td>
            <td title="${e.cidade||''}">${fmt(e.cidade)}</td>
            <td title="${e.uf||''}">${fmt(e.uf)}</td>
            <td>
                <input type="text" value="${(e.email_responsavel || '').replace(/"/g, '&quot;')}"
                    placeholder="e-mail(is) separados por vírgula" style="width:180px; font-size:12px; padding:3px 6px;"
                    onblur="salvarEmailResponsavelEmpresa('${e.codigo_empresa}', this.value)">
            </td>
        </tr>`;
    });
```

- [ ] **Step 3: Implementar `salvarEmailResponsavelEmpresa`**

Em `admin.js`, logo depois de `deletarEmpresa` (linha ~222):

```js
async function salvarEmailResponsavelEmpresa(codigo, valor) {
    const emailResponsavel = valor.trim() || null;
    try {
        const { error } = await supabaseClient.from('rh_empresas').update({ email_responsavel: emailResponsavel }).eq('codigo_empresa', codigo);
        if (error) throw error;
        const emp = _todasEmpresas.find(e => e.codigo_empresa === codigo);
        if (emp) emp.email_responsavel = emailResponsavel;
        mostrarStatus('statusEmpresas', '✅ E-mail responsável salvo.', 'success');
    } catch (erro) {
        mostrarStatus('statusEmpresas', 'Erro ao salvar e-mail responsável: ' + erro.message, 'error');
    }
}
```

- [ ] **Step 4: Checar sintaxe**

Run: `node -c "Projeto RH/admin.js"`
Expected: sem output (sintaxe válida)

- [ ] **Step 5: Commit**

```bash
git add "Projeto RH/admin.html" "Projeto RH/admin.js"
git commit -m "feat(rh): cadastro de e-mail responsavel por empresa em admin.html"
```

---

### Task 6: Cadastro de e-mail responsável por grupo em "Grupos de Empresas"

**Files:**
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: coluna `rh_grupos_empresas.email_responsavel` (Task 1).
- Produces: `_grupoAtual.email_responsavel` — cadastro em si, alimenta a leitura feita na Task 4/9 via `rh_grupos_empresas`.

- [ ] **Step 1: Incluir o campo no estado do grupo (`novoGrupo`)**

```js
function novoGrupo() {
    _grupoAtual = { id: null, nome_grupo: '', observacoes: '', email_responsavel: '', empresas: [] };
    renderizarListaGrupos();
    _renderGrupoDetalhe();
}
```

- [ ] **Step 2: Carregar o campo ao selecionar um grupo (`selecionarGrupo`)**

```js
async function selecionarGrupo(id) {
    const grupo = _grupos.find(g => g.id === id);
    if (!grupo) return;
    try {
        const { data: grupoCompleto, error: errG } = await supabaseClient
            .from('rh_grupos_empresas')
            .select('id, nome_grupo, observacoes, email_responsavel')
            .eq('id', id)
            .single();
        if (errG) throw errG;
        const { data: itens, error } = await supabaseClient
            .from('rh_grupos_empresas_itens')
            .select('codigo_empresa')
            .eq('grupo_id', id);
        if (error) throw error;
        const empresas = (itens || []).map(it => {
            const emp = state.empresas.find(e => e.codigo_empresa === it.codigo_empresa);
            return { codigo_empresa: it.codigo_empresa, nome_empresa: emp?.nome_empresa || it.codigo_empresa };
        });
        _grupoAtual = {
            id: grupoCompleto.id,
            nome_grupo: grupoCompleto.nome_grupo,
            observacoes: grupoCompleto.observacoes || '',
            email_responsavel: grupoCompleto.email_responsavel || '',
            empresas,
        };
        renderizarListaGrupos();
        _renderGrupoDetalhe();
    } catch (erro) {
        console.error('Erro ao carregar empresas do grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao carregar as empresas do grupo.');
    }
}
```

- [ ] **Step 3: Adicionar o campo no formulário (`_renderGrupoDetalhe`)**

Inserir logo depois do bloco `<div class="form-group" ...>Nome do Grupo</div>` (linha ~2665-2668) e antes do bloco "Empresas do Grupo":

```html
        <div class="form-group" style="margin-bottom:14px;">
            <label>Nome do Grupo</label>
            <input type="text" id="grpNome" value="${_grupoAtual.nome_grupo.replace(/"/g, '&quot;')}" placeholder="Ex: Grupo Shopping X" style="width:100%; box-sizing:border-box;">
        </div>
        <div class="form-group" style="margin-bottom:14px;">
            <label>E-mail(is) do Responsável pelo Grupo</label>
            <input type="text" id="grpEmailResponsavel" value="${(_grupoAtual.email_responsavel || '').replace(/"/g, '&quot;')}"
                placeholder="ex: financeiro@empresa.com, rh@empresa.com" style="width:100%; box-sizing:border-box;">
            <small style="color: var(--text-secondary); font-size:11px;">
                Quando preenchido, os PDFs de Benefícios/Folha de Ponto gerados com este grupo marcado no seletor
                são enviados juntos para este(s) e-mail(is), em vez do e-mail individual de cada empresa.
            </small>
        </div>
```

- [ ] **Step 4: Salvar o campo (`salvarGrupo`)**

```js
async function salvarGrupo() {
    const nome = (document.getElementById('grpNome')?.value || '').trim();
    if (!nome) { mostrarMensagem('Aviso', 'Informe o nome do grupo.'); return; }
    const observacoes = (document.getElementById('grpObservacoes')?.value || '').trim();
    const emailResponsavel = (document.getElementById('grpEmailResponsavel')?.value || '').trim() || null;
    try {
        let grupoId = _grupoAtual.id;
        if (grupoId) {
            const { error } = await supabaseClient.from('rh_grupos_empresas').update({ nome_grupo: nome, observacoes, email_responsavel: emailResponsavel }).eq('id', grupoId);
            if (error) throw error;
        } else {
            const { data, error } = await supabaseClient.from('rh_grupos_empresas').insert({ nome_grupo: nome, observacoes, email_responsavel: emailResponsavel }).select('id').single();
            if (error) throw error;
            grupoId = data.id;
        }
        const { error: errDel } = await supabaseClient.from('rh_grupos_empresas_itens').delete().eq('grupo_id', grupoId);
        if (errDel) throw errDel;
        if (_grupoAtual.empresas.length > 0) {
            const { error: errIns } = await supabaseClient.from('rh_grupos_empresas_itens')
                .insert(_grupoAtual.empresas.map(e => ({ grupo_id: grupoId, codigo_empresa: e.codigo_empresa })));
            if (errIns) throw errIns;
        }
        mostrarMensagem('Sucesso', '✅ Grupo salvo com sucesso!');
        await carregarGrupos();
        await selecionarGrupo(grupoId);
    } catch (erro) {
        console.error('Erro ao salvar grupo:', erro);
        mostrarMensagem('Erro', 'Falha ao salvar o grupo: ' + erro.message);
    }
}
```

- [ ] **Step 5: Checar sintaxe**

Run: `node -c "Projeto RH/script.js"`
Expected: sem output (sintaxe válida)

- [ ] **Step 6: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat(rh): cadastro de e-mail responsavel por grupo de empresas"
```

---

### Task 7: Capturar os PDFs gerados em "Gerar Folhas de Ponto"

**Files:**
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: `state._folhaPontoDados` (já existente), `_pdfIndividualAtivo`, `_construirPdfEmpresaFolhaPonto`, `_construirPdfEmpregadoFolhaPonto`, `_baixarBlob` (já existentes).
- Produces: `state._folhaPontoArquivosGerados: { [codigoEmpresa]: { nomeEmpresa: string, arquivos: Array<{nome, blob}> } }` e `_atualizarBotaoEnvioEmailFolhaPonto()` — consumidos pela Task 9.

- [ ] **Step 1: Ajustar `baixarPdfsFolhaPonto` para capturar os blobs**

Substituir a função inteira (linha ~5479):

```js
async function baixarPdfsFolhaPonto() {
    const dados = state._folhaPontoDados;
    if (!dados || dados.empresas.length === 0) return;
    const [mm, aaaa] = dados.competencia.split('/');

    const cfgsPorEmpresa = {};
    for (const empresaDados of dados.empresas) {
        cfgsPorEmpresa[empresaDados.codigo_empresa] = await _buscarConfigRubricas(empresaDados.codigo_empresa);
    }
    const algumaIndividual = dados.empresas.some(e => _pdfIndividualAtivo(cfgsPorEmpresa[e.codigo_empresa]));

    state._folhaPontoArquivosGerados = {};
    dados.empresas.forEach(empresaDados => {
        state._folhaPontoArquivosGerados[empresaDados.codigo_empresa] = { nomeEmpresa: empresaDados.nome_empresa, arquivos: [] };
    });

    if (dados.empresas.length === 1 && !algumaIndividual) {
        const empresaDados = dados.empresas[0];
        const doc = _construirPdfEmpresaFolhaPonto(empresaDados);
        const nomeArquivo = `FolhaDePonto_${empresaDados.codigo_empresa}_${mm}-${aaaa}.pdf`;
        state._folhaPontoArquivosGerados[empresaDados.codigo_empresa].arquivos.push({ nome: nomeArquivo, blob: doc.output('blob') });
        doc.save(nomeArquivo);
        _atualizarBotaoEnvioEmailFolhaPonto();
        return;
    }

    mostrarMensagem('Aguarde', 'Gerando arquivo zip com as folhas de ponto...');
    try {
        const zip = new JSZip();
        for (const empresaDados of dados.empresas) {
            if (_pdfIndividualAtivo(cfgsPorEmpresa[empresaDados.codigo_empresa])) {
                empresaDados.empregados.forEach(emp => {
                    const doc = _construirPdfEmpregadoFolhaPonto(empresaDados, emp);
                    const blob = doc.output('blob');
                    const nomeEmpregadoArquivo = emp.nome_empregado.replace(/[^\p{L}\p{N}]+/gu, '_');
                    const nomeArquivo = `FolhaDePonto_${empresaDados.codigo_empresa}_${emp.codigo_empregado}_${nomeEmpregadoArquivo}_${mm}-${aaaa}.pdf`;
                    zip.file(nomeArquivo, blob);
                    state._folhaPontoArquivosGerados[empresaDados.codigo_empresa].arquivos.push({ nome: nomeArquivo, blob });
                });
            } else {
                const doc = _construirPdfEmpresaFolhaPonto(empresaDados);
                const blob = doc.output('blob');
                const nomeArquivo = `FolhaDePonto_${empresaDados.codigo_empresa}_${mm}-${aaaa}.pdf`;
                zip.file(nomeArquivo, blob);
                state._folhaPontoArquivosGerados[empresaDados.codigo_empresa].arquivos.push({ nome: nomeArquivo, blob });
            }
        }
        const blobZip = await zip.generateAsync({ type: 'blob' });
        _baixarBlob(blobZip, `FolhasDePonto_${mm}-${aaaa}.zip`);
        fecharModalMensagem();
        _atualizarBotaoEnvioEmailFolhaPonto();
    } catch (erro) {
        console.error('Erro ao gerar zip de folhas de ponto:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar o arquivo zip: ' + erro.message);
    }
}

function _atualizarBotaoEnvioEmailFolhaPonto() {
    const btn = document.getElementById('folhaPontoBtnEnviarEmail');
    if (btn) btn.disabled = !Object.values(state._folhaPontoArquivosGerados || {}).some(e => e.arquivos.length > 0);
}
```

- [ ] **Step 2: Checar sintaxe**

Run: `node -c "Projeto RH/script.js"`
Expected: sem output (sintaxe válida)

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat(rh): captura os PDFs de Folha de Ponto ja gerados para reuso no envio por e-mail"
```

---

### Task 8: Capturar os PDFs gerados em "Gerar Benefícios"

**Files:**
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: `_gerarPdfRecibos` (já existente, com `retornarBlob`), `_reciboSheetHTML`, `_baixarBlob`, `_pdfIndividualAtivo`, `_buscarConfigRubricas` (já existentes).
- Produces: `state._beneficiosArquivosGerados: { [codigoEmpresa]: { nomeEmpresa: string, arquivos: Array<{nome, blob}> } }` e `_atualizarBotaoEnvioEmailBeneficios()` — consumidos pela Task 9.

- [ ] **Step 1: Ajustar `_gerarPdfsRecibosBeneficios`**

Substituir a função inteira (linha ~4476):

```js
async function _gerarPdfsRecibosBeneficios(linhas, comp) {
    const [mes, ano] = comp.split('/').map(Number);
    const ultimoDiaRef = new Date(ano, mes, 0).getDate();
    const mesFmt = String(mes).padStart(2, '0');
    const periodoTexto = `01/${mesFmt}/${ano} a ${String(ultimoDiaRef).padStart(2, '0')}/${mesFmt}/${ano}`;

    const porEmpresa = new Map();
    linhas.forEach(l => {
        if (!porEmpresa.has(l.codigo_empresa)) porEmpresa.set(l.codigo_empresa, { nomeEmpresa: l.nome_empresa, linhas: [] });
        porEmpresa.get(l.codigo_empresa).linhas.push(l);
    });

    const grupos = [];
    porEmpresa.forEach((grupo, codigoEmpresa) => {
        [['va', 'Vale Alimentação'], ['vt', 'Vale Transporte']].forEach(([tipo, label]) => {
            const elegiveis = grupo.linhas.filter(l => {
                const diasPagar = Math.max(0, l.diasTrabalhar - l.diasDescontar);
                const diario = tipo === 'va' ? l.vaDiario : l.vtDiario;
                return diasPagar * (diario || 0) > 0;
            });
            if (elegiveis.length > 0) grupos.push({ codigoEmpresa, nomeEmpresa: grupo.nomeEmpresa, tipo, label, elegiveis });
        });
    });

    if (grupos.length === 0) { mostrarMensagem('Aviso', 'Nenhum recibo gerado — todos os valores de VT/VA estão zerados ou em branco.'); return; }

    state._beneficiosArquivosGerados = {};
    porEmpresa.forEach((grupo, codigoEmpresa) => {
        state._beneficiosArquivosGerados[codigoEmpresa] = { nomeEmpresa: grupo.nomeEmpresa, arquivos: [] };
    });

    mostrarMensagem('Aguarde', 'Gerando os recibos e relatórios líquidos...');
    try {
        for (const grupo of grupos) {
            const nomeEmpresaArquivo = grupo.nomeEmpresa.replace(/[^\p{L}\p{N}]+/gu, '_');
            const cfgEmpresa = await _buscarConfigRubricas(grupo.codigoEmpresa);
            if (_pdfIndividualAtivo(cfgEmpresa)) {
                const zip = new JSZip();
                for (const l of grupo.elegiveis) {
                    const sheetHtml = _reciboSheetHTML(grupo.tipo, l, periodoTexto);
                    const blob = await _gerarPdfRecibos(null, sheetHtml, true);
                    const nomeEmpregadoArquivo = l.nome_empregado.replace(/[^\p{L}\p{N}]+/gu, '_');
                    zip.file(`${grupo.codigoEmpresa}_Recibo_${grupo.label.replace(/\s+/g, '_')}_${l.codigo_empregado}_${nomeEmpregadoArquivo}_${mesFmt}${ano}.pdf`, blob);
                }
                const blobZip = await zip.generateAsync({ type: 'blob' });
                const nomeZip = `Recibos_${grupo.label.replace(/\s+/g, '_')}_${nomeEmpresaArquivo}_${mesFmt}${ano}.zip`;
                _baixarBlob(blobZip, nomeZip);
                state._beneficiosArquivosGerados[grupo.codigoEmpresa].arquivos.push({ nome: nomeZip, blob: blobZip });
            } else {
                const sheetsHtml = grupo.elegiveis.map(l => _reciboSheetHTML(grupo.tipo, l, periodoTexto)).join('');
                const nomeArquivo = `${grupo.codigoEmpresa}_Recibos_${grupo.label.replace(/\s+/g, '_')}_${nomeEmpresaArquivo}_${mesFmt}${ano}.pdf`;
                const blob = await _gerarPdfRecibos(nomeArquivo, sheetsHtml, true);
                _baixarBlob(blob, nomeArquivo);
                state._beneficiosArquivosGerados[grupo.codigoEmpresa].arquivos.push({ nome: nomeArquivo, blob });
            }
        }
        porEmpresa.forEach((grupo, codigoEmpresa) => {
            _relatorioLiquidoBeneficiosPDF({ codigoEmpresa, nomeEmpresa: grupo.nomeEmpresa, linhas: grupo.linhas }, comp, periodoTexto, mesFmt, ano);
        });
        fecharModalMensagem();
        _atualizarBotaoEnvioEmailBeneficios();
    } catch (erro) {
        console.error('Erro ao gerar recibos em PDF:', erro);
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao gerar os recibos: ' + erro.message);
    }
}

function _atualizarBotaoEnvioEmailBeneficios() {
    const btn = document.getElementById('beneficiosBtnEnviarEmail');
    if (btn) btn.disabled = !Object.values(state._beneficiosArquivosGerados || {}).some(e => e.arquivos.length > 0);
}
```

(A única mudança de comportamento no branch `else` é trocar `await _gerarPdfRecibos(nomeArquivo, sheetsHtml)` — que salvava via `pdf.save()` internamente — por `await _gerarPdfRecibos(nomeArquivo, sheetsHtml, true)` + `_baixarBlob(blob, nomeArquivo)`, que dispara o mesmo download por outro caminho já usado em todo o resto do arquivo.)

- [ ] **Step 2: Capturar o blob do Relatório Líquido em `_relatorioLiquidoBeneficiosPDF`**

Trocar a última linha da função (linha ~4597), de:

```js
    doc.save(`${grupo.codigoEmpresa}_Relatorio_Liquido_Beneficios_${nomeEmpresaArquivo}_${mesFmt}${ano}.pdf`);
```

para:

```js
    const nomeArquivoFinal = `${grupo.codigoEmpresa}_Relatorio_Liquido_Beneficios_${nomeEmpresaArquivo}_${mesFmt}${ano}.pdf`;
    if (state._beneficiosArquivosGerados?.[grupo.codigoEmpresa]) {
        state._beneficiosArquivosGerados[grupo.codigoEmpresa].arquivos.push({ nome: nomeArquivoFinal, blob: doc.output('blob') });
    }
    doc.save(nomeArquivoFinal);
```

- [ ] **Step 3: Checar sintaxe**

Run: `node -c "Projeto RH/script.js"`
Expected: sem output (sintaxe válida)

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat(rh): captura os PDFs de Beneficios ja gerados para reuso no envio por e-mail"
```

---

### Task 9: Botão "Enviar por E-mail", modal de confirmação e disparo

**Files:**
- Modify: `Projeto RH/index.html`
- Modify: `Projeto RH/script.js`

**Interfaces:**
- Consumes: `_resolverDestinatariosEnvio`, `_blobParaBase64` (Task 2); `state._beneficiosArquivosGerados`/`_atualizarBotaoEnvioEmailBeneficios` (Task 8); `state._folhaPontoArquivosGerados`/`_atualizarBotaoEnvioEmailFolhaPonto` (Task 7); `state.empresas[i].email_responsavel` (Task 4); `_gruposBeneficiosCache`/`_itensGruposBeneficiosCache`, `_gruposFolhaPontoCache`/`_itensGruposFolhaPontoCache` (Task 4); `mostrarMensagem`, `SUPABASE_URL`, `SUPABASE_KEY`, `supabaseClient` (já existentes).
- Produces: fluxo completo de UI — nada consumido por outras tasks (é a ponta final).

- [ ] **Step 1: Incluir o script do módulo novo em `index.html`**

Perto do topo de `index.html`, onde os demais módulos utilitários são carregados (mesmo grupo de `<script src="escala-calculo.js"></script>` / `<script src="folha-ponto-calculo.js"></script>`), adicionar:

```html
    <script src="envio-email-frequencia.js"></script>
```

(Antes do `<script src="script.js"></script>`, já que `script.js` vai chamar essas funções.)

- [ ] **Step 2: Adicionar o botão em "Gerar Benefícios"**

Em `index.html`, dentro de `#beneficiosPreviaContainer`, no `<div style="display:flex; gap:10px;">` de botões (linha ~320-324), adicionar antes de `🧾 Gerar Recibo`:

```html
                    <div style="display:flex; gap:10px;">
                        <button type="button" class="btn btn-secondary" id="beneficiosBtnEnviarEmail" disabled onclick="abrirModalEnvioEmailBeneficios()">✉️ Enviar por E-mail</button>
                        <button type="button" class="btn btn-secondary" onclick="gerarRecibosBeneficios()">🧾 Gerar Recibo</button>
                        <button type="button" class="btn btn-secondary" onclick="abrirModalLancamentoVaVt()">📄 Gerar Lançamentos na Folha</button>
                        <button type="button" class="btn btn-primary" onclick="exportarBeneficiosExcel()">📥 Gerar Excel</button>
                    </div>
```

- [ ] **Step 3: Adicionar o botão em "Gerar Folhas de Ponto"**

Em `index.html`, na `<span id="folhaPontoResultadoInfo">.../<button id="folhaPontoBtnBaixar">` (linha ~440-441), adicionar o botão novo ao lado:

```html
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                    <span id="folhaPontoResultadoInfo" style="font-size:13px; color: var(--text-secondary);"></span>
                    <div style="display:flex; gap:10px;">
                        <button type="button" class="btn btn-secondary" id="folhaPontoBtnEnviarEmail" disabled onclick="abrirModalEnvioEmailFolhaPonto()">✉️ Enviar por E-mail</button>
                        <button type="button" class="btn btn-primary" id="folhaPontoBtnBaixar" onclick="baixarPdfsFolhaPonto()">📥 Baixar PDF(s)</button>
                    </div>
                </div>
```

(Ajustar a tag de fechamento — o `<div>` de botões precisa envolver os dois botões; conferir com o HTML real ao redor antes de colar, mantendo o restante do bloco fora do trecho acima inalterado.)

- [ ] **Step 4: Adicionar o modal de confirmação**

Em `index.html`, junto aos demais `<div id="...Modal" class="modal">` (ex.: logo depois do `loteResumoModal`, linha ~1424):

```html
    <div id="envioEmailModal" class="modal">
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3 style="margin:0;">✉️ Enviar por E-mail</h3>
                <button type="button" class="modal-close" onclick="_fecharModalEnvioEmail()">×</button>
            </div>
            <div class="modal-body" style="padding:20px;">
                <div id="envioEmailConteudo"></div>
            </div>
            <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; padding:15px 20px; border-top:1px solid #eee;">
                <button type="button" class="btn btn-secondary" onclick="_fecharModalEnvioEmail()">Cancelar</button>
                <button type="button" class="btn btn-primary" id="envioEmailBtnConfirmar" onclick="_confirmarEnvioEmail()">Enviar</button>
            </div>
        </div>
    </div>
```

- [ ] **Step 5: Implementar as funções de abertura/fechamento/confirmação em `script.js`**

Adicionar no final de `script.js`:

```js
// ===== ENVIO DE DOCUMENTOS POR E-MAIL (Benefícios / Folha de Ponto) =====

let _envioEmailContexto = null; // { tipoDocumento, competencia, destinatarios }

function _montarItensPorEmpresa(arquivosGerados) {
    return Object.entries(arquivosGerados || {})
        .filter(([, v]) => v.arquivos.length > 0)
        .map(([codigoEmpresa, v]) => ({ codigoEmpresa, nomeEmpresa: v.nomeEmpresa, arquivos: v.arquivos }));
}

function abrirModalEnvioEmailBeneficios() {
    const comp = document.getElementById('beneficiosCompetencia').value;
    const itensPorEmpresa = _montarItensPorEmpresa(state._beneficiosArquivosGerados);
    const gruposMarcadosIds = Array.from(document.querySelectorAll('.beneficios-grupo-check:checked')).map(cb => cb.value);
    _abrirModalEnvioEmail('Benefícios', comp, itensPorEmpresa, gruposMarcadosIds, _gruposBeneficiosCache, _itensGruposBeneficiosCache);
}

function abrirModalEnvioEmailFolhaPonto() {
    const comp = state._folhaPontoDados?.competencia || '';
    const itensPorEmpresa = _montarItensPorEmpresa(state._folhaPontoArquivosGerados);
    const gruposMarcadosIds = Array.from(document.querySelectorAll('.folhaPonto-grupo-check:checked')).map(cb => cb.value);
    _abrirModalEnvioEmail('Folhas de Ponto', comp, itensPorEmpresa, gruposMarcadosIds, _gruposFolhaPontoCache, _itensGruposFolhaPontoCache);
}

function _abrirModalEnvioEmail(tipoDocumento, competencia, itensPorEmpresa, gruposMarcadosIds, gruposInfo, itensGruposCache) {
    if (itensPorEmpresa.length === 0) { mostrarMensagem('Aviso', 'Gere os PDFs antes de enviar por e-mail.'); return; }

    const emailPorEmpresa = {};
    state.empresas.forEach(e => { emailPorEmpresa[e.codigo_empresa] = e.email_responsavel; });

    const { destinatarios, semEmail } = _resolverDestinatariosEnvio({
        itensPorEmpresa, gruposMarcadosIds, gruposInfo, itensGruposCache, emailPorEmpresa,
    });

    _envioEmailContexto = { tipoDocumento, competencia, destinatarios };

    const conteudo = document.getElementById('envioEmailConteudo');
    const btnConfirmar = document.getElementById('envioEmailBtnConfirmar');

    let html = '';
    if (destinatarios.length === 0) {
        html += '<p style="color:#E74C3C;">Nenhuma empresa deste lote tem e-mail de responsável cadastrado.</p>';
        btnConfirmar.disabled = true;
    } else {
        btnConfirmar.disabled = false;
        html += destinatarios.map(d => `
            <div style="padding:8px 0; border-bottom:1px solid #f0f0f0;">
                <strong>${d.email}</strong> ${d.origem === 'grupo' ? `<span style="color:var(--text-secondary);">(Grupo ${d.nomeOrigem})</span>` : ''}<br>
                <span style="font-size:12px; color:var(--text-secondary);">${d.empresas.join(', ')} — ${d.arquivos.length} arquivo(s)</span>
            </div>
        `).join('');
    }
    if (semEmail.length > 0) {
        html += `<p style="margin-top:12px; color:#E8890C; font-size:13px;">⚠️ Sem e-mail cadastrado: ${semEmail.join(', ')}</p>`;
    }
    conteudo.innerHTML = html;

    document.getElementById('envioEmailModal').classList.add('active');
}

function _fecharModalEnvioEmail() {
    document.getElementById('envioEmailModal').classList.remove('active');
    _envioEmailContexto = null;
}

async function _confirmarEnvioEmail() {
    if (!_envioEmailContexto || _envioEmailContexto.destinatarios.length === 0) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { mostrarMensagem('Erro', 'Sessão expirada. Faça login novamente.'); return; }

    const btnConfirmar = document.getElementById('envioEmailBtnConfirmar');
    btnConfirmar.disabled = true;

    const { tipoDocumento, competencia, destinatarios } = _envioEmailContexto;

    const resultados = await Promise.all(destinatarios.map(async d => {
        const anexos = await Promise.all(d.arquivos.map(async a => ({ nome: a.nome, conteudoBase64: await _blobParaBase64(a.blob) })));
        const assunto = `${tipoDocumento} — ${d.nomeOrigem} — ${competencia}`;
        return fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_KEY },
            body: JSON.stringify({
                destinatario: d.email,
                assunto,
                params: { tipo: 'documentos_frequencia', tipoDocumento, competencia, destino: d.nomeOrigem },
                anexos,
            }),
        }).then(r => r.json()).catch(e => ({ ok: false, error: e.message }));
    }));

    _fecharModalEnvioEmail();

    const todosOk = resultados.every(r => r.ok);
    mostrarMensagem(
        todosOk ? 'Sucesso' : 'Atenção',
        todosOk
            ? `✅ E-mail enviado para ${resultados.length} destinatário(s).`
            : 'Alguns e-mails falharam ao enviar. Verifique o console para detalhes.'
    );
    if (!todosOk) console.error('Falhas no envio de e-mail:', resultados.filter(r => !r.ok));
}
```

- [ ] **Step 6: Checar sintaxe**

Run: `node -c "Projeto RH/script.js"`
Expected: sem output (sintaxe válida)

- [ ] **Step 7: Commit**

```bash
git add "Projeto RH/index.html" "Projeto RH/script.js"
git commit -m "feat(rh): botao Enviar por E-mail com modal de confirmacao em Beneficios e Folha de Ponto"
```

---

### Task 10: Push da branch

**Files:** nenhum (só integração).

**Interfaces:** nenhuma.

- [ ] **Step 1: Conferir o histórico de commits desta feature**

Run: `git log --oneline -15`
Expected: os 9 commits das tasks anteriores aparecem em sequência, no topo do branch atual.

- [ ] **Step 2: Push**

Run: `git push`
Expected: push aceito sem conflito (branch `main`, conforme indicado no estado inicial do repositório).

---

## Observações finais (não são tasks)

- **SQL pendente:** até `Projeto RH/schema_rh_email_responsavel.sql` (Task 1) rodar manualmente no SQL Editor do Supabase, os dois campos de e-mail responsável não existem no banco de verdade — a UI funciona, mas toda empresa/grupo cai em "sem e-mail cadastrado".
- **Deploy da Edge Function:** feito dentro da própria Task 3 (Step 6) — sem ele, o parâmetro `anexos` é ignorado silenciosamente pela função em produção mesmo com o código já commitado.
- **QA em navegador:** nenhuma das tasks acima inclui teste automatizado de browser (o repo não tem harness para isso). Depois de todas as tasks concluídas, testar manualmente: gerar Benefícios/Folha de Ponto de uma empresa com e-mail cadastrado, de um grupo com e-mail cadastrado, e de uma empresa sem e-mail cadastrado (para ver a mensagem de aviso) — mas isso só é possível depois do SQL da Task 1 rodar.
