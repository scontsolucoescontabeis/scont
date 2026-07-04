# Calendário de Feriados Global Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a lista de feriados fixa hardcoded por uma tabela global no Supabase (`rh_feriados`), compartilhada entre todas as empresas, com cadastro e remoção imediatos — sem depender de "Processar e Salvar" uma folha.

**Architecture:** Nova tabela `rh_feriados` (EAV simples: id, data, descrição). Na inicialização da ferramenta, `state.feriados` passa a ser populado com um `SELECT` nessa tabela em vez da lista fixa no código. `adicionarFeriado`/`removerFeriado` passam a gravar/apagar direto no banco antes de atualizar a tela. Nada muda na gravação de `feriados_json` por lote em `rh_saves` — folhas já processadas continuam com o retrato da época.

**Tech Stack:** JavaScript vanilla, HTML inline, Supabase (Postgres) via `supabaseClient`. Sem build step, sem framework de testes.

## Global Constraints

- Nova tabela: `rh_feriados` (`id` UUID PK, `data` TEXT, `descricao` TEXT, `criado_em` TIMESTAMPTZ DEFAULT NOW()).
- Migração inclui os 8 feriados fixos atuais como seed inicial (mesmos valores hoje hardcoded em `carregarFeriadosPadrao`).
- Adicionar feriado grava imediatamente no banco (não depende de "Processar e Salvar" a folha).
- Remover feriado pede confirmação antes de apagar do banco (mesmo padrão de `mostrarConfirmacao` já usado em "Remover Folha").
- **Nada muda** na gravação de `feriados_json` por lote em `rh_saves` (`processarFolhaComSalvamento`) nem no carregamento de folhas já salvas (`carregarSaveEspecifico`, nas duas ocorrências) — essas continuam usando o snapshot da época, não o calendário global.
- **IMPORTANTE:** os números de linha citados abaixo refletem o estado do arquivo no momento em que este plano foi escrito. Use sempre o bloco de código exato (`old_string`) para localizar o trecho a editar.

---

## Arquivos Impactados

- Criar: `Projeto RH/schema_rh_feriados_globais.sql` (migração manual no Supabase)
- Modify: `Projeto RH/schema_rh.sql` (documentar a nova tabela)
- Modify: `Projeto RH/script.js`:
  - Inicialização (`DOMContentLoaded`, ~linha 31-57): trocar `carregarFeriadosPadrao()` por `await carregarFeriadosGlobais()`.
  - `carregarFeriadosPadrao()` (~linha 930-943): renomear/reescrever como `carregarFeriadosGlobais()` assíncrona, buscando de `rh_feriados`.
  - `adicionarFeriado()` (~linha 945-968): passa a ser assíncrona, grava no banco antes de atualizar `state.feriados`.
  - `removerFeriado` (~linha 970-974): passa a ser assíncrona, com confirmação e `DELETE` por `id`.
  - `renderizarTabelaFeriados()` (~linha 976-994): botão de remover passa a usar `f.id`.

---

## Task 1: Migração de banco de dados

**Files:**
- Create: `Projeto RH/schema_rh_feriados_globais.sql`
- Modify: `Projeto RH/schema_rh.sql`

### Passos

- [ ] **Step 1: Criar o arquivo de migração**

Criar `Projeto RH/schema_rh_feriados_globais.sql`:

```sql
-- Migração: calendário de feriados global (rh_feriados)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS public.rh_feriados (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data        TEXT NOT NULL,       -- "DD/MM" (recorrente todo ano) ou "DD/MM/AAAA" (específico)
    descricao   TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rh_feriados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_feriados: leitura autenticado" ON public.rh_feriados;
DROP POLICY IF EXISTS "rh_feriados: escrita autenticado" ON public.rh_feriados;

CREATE POLICY "rh_feriados: leitura autenticado"
    ON public.rh_feriados FOR SELECT
    TO authenticated USING (TRUE);

CREATE POLICY "rh_feriados: escrita autenticado"
    ON public.rh_feriados FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Seed: feriados fixos já usados hoje pela ferramenta (evita perda ao migrar)
INSERT INTO public.rh_feriados (data, descricao)
SELECT v.data, v.descricao FROM (VALUES
    ('01/01', 'Confraternização Universal'),
    ('21/04', 'Tiradentes'),
    ('01/05', 'Dia do Trabalho'),
    ('07/09', 'Independência do Brasil'),
    ('12/10', 'Nossa Senhora Aparecida'),
    ('02/11', 'Finados'),
    ('20/11', 'Consciência Negra'),
    ('25/12', 'Natal')
) AS v(data, descricao)
WHERE NOT EXISTS (
    SELECT 1 FROM public.rh_feriados existente WHERE existente.data = v.data
);
```

- [ ] **Step 2: Documentar a nova tabela no schema principal**

Em `Projeto RH/schema_rh.sql`, localizar o bloco da tabela `rh_config_rubricas_txt` (procure por este texto exato):
```sql
CREATE POLICY "rh_config_rub_txt: escrita autenticado"
    ON public.rh_config_rubricas_txt FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- RESUMO DAS TABELAS
-- ============================================================
```
Substituir por (acrescenta a documentação da nova tabela logo antes do resumo, sem alterar o bloco existente):
```sql
CREATE POLICY "rh_config_rub_txt: escrita autenticado"
    ON public.rh_config_rubricas_txt FOR ALL
    TO authenticated USING (TRUE) WITH CHECK (TRUE);


-- ============================================================
-- 9. TABELA: rh_feriados
--    Calendário de feriados global, compartilhado por todas as empresas.
--    Ver migração: schema_rh_feriados_globais.sql
-- ============================================================
-- CREATE TABLE public.rh_feriados (
--     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     data        TEXT NOT NULL,       -- "DD/MM" ou "DD/MM/AAAA"
--     descricao   TEXT NOT NULL,
--     criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );


-- ============================================================
-- RESUMO DAS TABELAS
-- ============================================================
```

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/schema_rh_feriados_globais.sql" "Projeto RH/schema_rh.sql"
git commit -m "chore: adicionar tabela rh_feriados (calendário global de feriados)"
```

- [ ] **Step 4: Avisar o usuário**

Peça ao usuário para rodar o conteúdo de `Projeto RH/schema_rh_feriados_globais.sql` no SQL Editor do Supabase (projeto correto) antes de testar o carregamento do calendário. Sem essa tabela, a Task 2 tem um fallback (ver abaixo) que evita quebrar a ferramenta, mas o cadastro de novos feriados não vai funcionar até a migração ser executada.

---

## Task 2: Carregar feriados do banco na inicialização

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Substituir `carregarFeriadosPadrao` por `carregarFeriadosGlobais` assíncrona**

Localizar (~linha 929-943):
```js
// --- GERENCIAMENTO DE FERIADOS ---
function carregarFeriadosPadrao() {
    const feriadosFixos = [
        { dia: '01/01', desc: 'Confraternização Universal' },
        { dia: '21/04', desc: 'Tiradentes' },
        { dia: '01/05', desc: 'Dia do Trabalho' },
        { dia: '07/09', desc: 'Independência do Brasil' },
        { dia: '12/10', desc: 'Nossa Senhora Aparecida' },
        { dia: '02/11', desc: 'Finados' },
        { dia: '20/11', desc: 'Consciência Negra' },
        { dia: '25/12', desc: 'Natal' }
    ];
    state.feriados = feriadosFixos.map(f => ({ data: f.dia, descricao: f.desc }));
    renderizarTabelaFeriados();
}
```
Substituir por:
```js
// --- GERENCIAMENTO DE FERIADOS ---
async function carregarFeriadosGlobais() {
    try {
        const { data, error } = await supabaseClient
            .from('rh_feriados')
            .select('id, data, descricao')
            .order('data', { ascending: true });
        if (error) throw error;
        state.feriados = (data || []).map(f => ({ id: f.id, data: f.data, descricao: f.descricao }));
    } catch (e) {
        console.warn('Erro ao carregar rh_feriados (a tabela existe? rode a migração schema_rh_feriados_globais.sql):', e);
        // Fallback: mesma lista fixa de antes, sem id (não editável até a migração rodar)
        const feriadosFixos = [
            { dia: '01/01', desc: 'Confraternização Universal' },
            { dia: '21/04', desc: 'Tiradentes' },
            { dia: '01/05', desc: 'Dia do Trabalho' },
            { dia: '07/09', desc: 'Independência do Brasil' },
            { dia: '12/10', desc: 'Nossa Senhora Aparecida' },
            { dia: '02/11', desc: 'Finados' },
            { dia: '20/11', desc: 'Consciência Negra' },
            { dia: '25/12', desc: 'Natal' }
        ];
        state.feriados = feriadosFixos.map(f => ({ data: f.dia, descricao: f.desc }));
    }
    renderizarTabelaFeriados();
}
```

- [ ] **Step 2: Chamar a nova função assíncrona na inicialização**

Localizar (~linha 55-56):
```js
    await carregarEmpresas();
    carregarFeriadosPadrao();
```
Substituir por:
```js
    await carregarEmpresas();
    await carregarFeriadosGlobais();
```

- [ ] **Step 3: Verificação manual**

Sem a migração rodada ainda: abrir a ferramenta e confirmar que a tabela de feriados mostra os 8 feriados fixos (via fallback), sem erro travando a página (só um `console.warn`). Depois de rodar a migração (Task 1, Step 4): recarregar e confirmar que os mesmos 8 feriados aparecem, agora vindos do banco (nesse ponto, cada um já tem `id`, mas a Task 3/4 é que vão exercitar isso).

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: carregar calendário de feriados de rh_feriados na inicialização"
```

---

## Task 3: Cadastro imediato de feriado

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Tornar `adicionarFeriado` assíncrona, gravando no banco antes do estado local**

Localizar (~linha 945-968):
```js
function adicionarFeriado() {
    const data = document.getElementById('novaDataFeriado').value;
    const desc = document.getElementById('novaDescricaoFeriado').value;
    if (!validarData(data)) {
        mostrarMensagem('Erro', 'Data inválida. Use DD/MM/AAAA.');
        return;
    }
    if (!desc) {
        mostrarMensagem('Erro', 'Informe uma descrição para o feriado.');
        return;
    }
    if (!state.feriados.some(f => f.data === data)) {
        state.feriados.push({ data, descricao: desc });
        state.feriados.sort((a, b) => {
            const [d1, m1, a1] = a.data.split('/');
            const [d2, m2, a2] = b.data.split('/');
            return new Date(a1, m1-1, d1) - new Date(a2, m2-1, d2);
        });
        renderizarTabelaFeriados();
        renderizarConteudoAba();
    }
    document.getElementById('novaDataFeriado').value = '';
    document.getElementById('novaDescricaoFeriado').value = '';
}
```
Substituir por:
```js
async function adicionarFeriado() {
    const data = document.getElementById('novaDataFeriado').value;
    const desc = document.getElementById('novaDescricaoFeriado').value;
    if (!validarData(data)) {
        mostrarMensagem('Erro', 'Data inválida. Use DD/MM/AAAA.');
        return;
    }
    if (!desc) {
        mostrarMensagem('Erro', 'Informe uma descrição para o feriado.');
        return;
    }
    if (state.feriados.some(f => f.data === data)) {
        document.getElementById('novaDataFeriado').value = '';
        document.getElementById('novaDescricaoFeriado').value = '';
        return;
    }
    try {
        const { data: inserido, error } = await supabaseClient
            .from('rh_feriados')
            .insert({ data, descricao: desc })
            .select('id, data, descricao')
            .single();
        if (error) throw error;
        state.feriados.push({ id: inserido.id, data: inserido.data, descricao: inserido.descricao });
        state.feriados.sort((a, b) => {
            const [d1, m1, a1] = a.data.split('/');
            const [d2, m2, a2] = b.data.split('/');
            return new Date(a1, m1-1, d1) - new Date(a2, m2-1, d2);
        });
        renderizarTabelaFeriados();
        renderizarConteudoAba();
        document.getElementById('novaDataFeriado').value = '';
        document.getElementById('novaDescricaoFeriado').value = '';
    } catch (e) {
        console.error('Erro ao adicionar feriado:', e);
        mostrarMensagem('Erro', 'Não foi possível salvar o feriado. Verifique se a migração schema_rh_feriados_globais.sql já foi executada no Supabase.');
    }
}
```

- [ ] **Step 2: Verificação manual**

Com a migração já rodada (Task 1, Step 4): adicionar um feriado customizado pelo modal. Confirmar que ele aparece na tabela imediatamente. Recarregar a página inteira (sem processar nenhuma folha) e confirmar que o feriado customizado continua lá — esse é exatamente o comportamento que o usuário pediu (persistência imediata, sem depender de salvar a folha).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: gravar novo feriado imediatamente em rh_feriados"
```

---

## Task 4: Remoção com confirmação

**Files:**
- Modify: `Projeto RH/script.js`

### Passos

- [ ] **Step 1: Tornar `removerFeriado` assíncrona, com confirmação e `DELETE` por `id`**

Localizar (~linha 970-974):
```js
window.removerFeriado = function(data) {
    state.feriados = state.feriados.filter(f => f.data !== data);
    renderizarTabelaFeriados();
    renderizarConteudoAba();
};
```
Substituir por:
```js
window.removerFeriado = function(id, data) {
    // Feriados carregados de um snapshot antigo (feriados_json de uma folha já salva
    // antes desta funcionalidade existir) podem não ter id — nesse caso, remove só
    // localmente, sem tentar apagar nada do calendário global.
    if (!id) {
        state.feriados = state.feriados.filter(f => f.data !== data);
        renderizarTabelaFeriados();
        renderizarConteudoAba();
        return;
    }
    mostrarConfirmacao(
        'Remover Feriado',
        'Tem certeza que deseja remover este feriado? Ele será removido do calendário global, afetando todas as empresas.',
        async () => {
            try {
                const { error } = await supabaseClient
                    .from('rh_feriados')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
                state.feriados = state.feriados.filter(f => f.id !== id);
                renderizarTabelaFeriados();
                renderizarConteudoAba();
            } catch (e) {
                console.error('Erro ao remover feriado:', e);
                mostrarMensagem('Erro', 'Não foi possível remover o feriado.');
            }
        }
    );
};
```

- [ ] **Step 2: Atualizar o botão de remover para passar `id` e `data`**

Localizar (~linha 976-994):
```js
function renderizarTabelaFeriados() {
    const tbody = document.getElementById('feriadosTbody');
    tbody.innerHTML = '';
    if (state.feriados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 10px; color: var(--text-secondary);">Nenhum feriado cadastrado.</td></tr>';
        return;
    }
    state.feriados.forEach(f => {
        tbody.innerHTML += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${f.data}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${f.descricao}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: center;">
                    <button type="button" class="btn-icon" onclick="removerFeriado('${f.data}')" style="color: var(--danger-color);">🗑️</button>
                </td>
            </tr>
        `;
    });
```
Substituir por:
```js
function renderizarTabelaFeriados() {
    const tbody = document.getElementById('feriadosTbody');
    tbody.innerHTML = '';
    if (state.feriados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 10px; color: var(--text-secondary);">Nenhum feriado cadastrado.</td></tr>';
        return;
    }
    state.feriados.forEach(f => {
        tbody.innerHTML += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${f.data}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${f.descricao}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: center;">
                    <button type="button" class="btn-icon" onclick="removerFeriado('${f.id || ''}', '${f.data}')" style="color: var(--danger-color);">🗑️</button>
                </td>
            </tr>
        `;
    });
```

- [ ] **Step 3: Verificação manual**

Com a migração já rodada: clicar em remover um feriado customizado (ou um dos 8 padrão) — confirmar que aparece o diálogo de confirmação, e que só some da tabela (e do banco) depois de confirmar. Cancelar a confirmação uma vez e confirmar que nada muda. Recarregar a página e confirmar que o feriado removido não volta.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat: remover feriado do calendário global com confirmação"
```

---

## Task 5: Verificação manual final (checklist de regressão)

Sem framework de testes automatizados neste projeto, feche o trabalho com uma rodada manual:

- [ ] **Step 1:** Uma folha já processada e salva ANTES desta mudança (com `feriados_json` gravado à moda antiga, sem `id` nos itens) continua abrindo/recalculando normalmente ao ser retomada — sem erro de `undefined` em nenhum campo.
- [ ] **Step 2:** Adicionar um feriado, trocar de empresa (nova seleção) sem processar nenhuma folha, e confirmar que o feriado aparece também para a nova empresa (calendário é global).
- [ ] **Step 3:** Processar e salvar uma folha nova; depois adicionar um feriado extra; confirmar que a folha já salva (`rh_saves.feriados_json`) NÃO foi alterada retroativamente (ela mantém o retrato de antes do novo feriado) — só uma folha processada DEPOIS do novo cadastro reflete o feriado extra.
- [ ] **Step 4:** Isolamento por dia da semana (`isDiaDescanso`/extras) continua funcionando igual para os feriados vindos do banco, já que o formato de `data` (`DD/MM` ou `DD/MM/AAAA`) e a lógica de comparação (`f.data === dia.data || f.data === dia.data.substring(0,5)`) não mudaram.

Nenhum commit necessário neste task — é só verificação.
