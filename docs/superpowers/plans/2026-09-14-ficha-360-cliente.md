# Ficha 360 do Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova ferramenta `Projeto Ficha 360/` com painel da carteira (semáforo por empresa) e ficha completa da empresa, consolidando dados dos módulos existentes + cadastro Scont, contatos e anotações.

**Architecture:** Página estática (HTML + JS clássico, sem build) no padrão do portal. Busca em paralelo via supabase-js (`fontes.js`), consolida em memória com funções puras (`vinculos.js`, `regras.js`, `carteira.js` — testadas em Node) e renderiza painel/ficha (`painel.js`, `ficha.js`, `cadastro.js`, `anotacoes.js`). 3 tabelas novas via SQL executado manualmente pelo usuário.

**Tech Stack:** HTML/CSS/JS vanilla, `@supabase/supabase-js@2` (CDN jsdelivr), Node (`node:assert`) para testes, Postgres/Supabase (RLS).

**Spec:** `docs/superpowers/specs/2026-09-14-ficha-360-cliente-design.md`

## Global Constraints

- Módulos JS no padrão UMD do repo: `(function (root, factory) { ... module.exports ... root.<Nome> = api })` — funcionam como `<script>` no navegador e com `require()` em Node.
- Globais: `Ficha360Vinculos`, `Ficha360Regras`, `Ficha360Carteira`, `Ficha360Fontes`, `F360` (app), `Ficha360Painel`, `Ficha360Ficha`, `Ficha360Cadastro`, `Ficha360Anotacoes`.
- Datas sempre como string ISO `YYYY-MM-DD`; "hoje" é passado como parâmetro às funções puras (nunca `new Date()` dentro de `regras.js`/`carteira.js`).
- Paleta: `--primary:#8B3A3A; --primary-dark:#6B2A2A; --primary-light:#A85252; --secondary:#2C3E50; --bg:#F0F2F5; --border:#E0E6ED; --success:#27AE60; --danger:#E74C3C;` gradiente sidebar `linear-gradient(135deg, #8B3A3A 0%, #2C3E50 100%)`.
- Auth: `window.PortalAuthGuard.init(1)`; bloquear `auth.userData?.empresa` = `'prestador de serviço'` (trim + lowercase) quando `!auth.isAdmin`.
- Nunca selecionar `nome_empresa` de `rh_empregados` (usar `rh_empresas`).
- Todo texto vindo do banco passa por `F360.esc()` antes de ir para `innerHTML`.
- Toda nova coluna/tabela só é usada depois do SQL rodado; código deve degradar (motivo `tabela_ausente`) se não estiver.
- Nenhum arquivo de outro módulo é modificado (apenas lidos/importados: `Projeto RH/qsa-analise.js`, `Projeto Onboarding Contabil/contabil-diario-util.js`).
- Commits em português, prefixo `feat(ficha360):` / `test(ficha360):` / `chore(ficha360):`, terminando com:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_015WS3d3DzMxLX6a2GKuVCXk
  ```
- Testes: `node "Projeto Ficha 360/tests/<arquivo>.test.js"` a partir da raiz do repo.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `_sql/schema_ficha360.sql` | 3 tabelas, índices, trigger, RLS, registro em `ferramentas` |
| `Projeto Ficha 360/js/vinculos.js` | normalização de CNPJ/nome, índices, vínculo certificado↔empresa e CRM↔empresa |
| `Projeto Ficha 360/js/regras.js` | alertas por módulo + semáforo (puro) |
| `Projeto Ficha 360/js/carteira.js` | `montarCarteira(dados, hoje)` junta tudo por empresa (puro) |
| `Projeto Ficha 360/js/fontes.js` | acesso Supabase: carteira, jornada/escala, CRM, classificação de erro |
| `Projeto Ficha 360/js/app.js` | namespace `F360`, helpers, bootstrap, roteamento `?empresa=` |
| `Projeto Ficha 360/js/painel.js` | tela Painel da Carteira |
| `Projeto Ficha 360/js/ficha.js` | tela Ficha: cabeçalho, abas Resumo/Vencimentos/DP/Contábil/CRM |
| `Projeto Ficha 360/js/cadastro.js` | aba Cadastro (Domínio read-only + Scont editável + contatos) |
| `Projeto Ficha 360/js/anotacoes.js` | aba Anotações |
| `Projeto Ficha 360/index.html` | estrutura da página e ordem dos scripts |
| `Projeto Ficha 360/css/ficha360.css` | estilos |
| `Projeto Ficha 360/tests/*.test.js` | testes Node |

---

### Task 0: Verificar schema de produção (manual, com o usuário)

**Files:** nenhum (resultado registrado na conversa)

**Interfaces:**
- Produces: confirmação (ou lista de correções) das colunas usadas em `fontes.js` (Task 5).

- [ ] **Step 1: Pedir ao usuário que rode no SQL Editor do Supabase (projeto do Portal) e cole o resultado**

```sql
select table_name, string_agg(column_name, ', ' order by ordinal_position) as colunas
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'rh_empresas','rh_empregados','rh_socios','certificados','licencas','alvaras',
    'fechamento_ciclo','fechamento_ciclo_fase','fechamento_empresas_responsaveis',
    'fechamento_empresas_config','contabil_empresas_config','contabil_empresas_responsaveis',
    'formularios','empregados','contabil_onboardings','contabil_mapeamento',
    'contabil_mapeamento_pendencias','contabil_diario_fechamentos',
    'rh_grupos_empresas','rh_grupos_empresas_itens','usuarios',
    'contatos_empresas','contatos','conversas','rh_jornada_trabalho','rh_escala_trabalho'
  )
group by table_name
order by table_name;

select situacao, tipo_empregado, count(*) from public.rh_empregados group by 1, 2 order by 3 desc;
select situacao, count(*) from public.certificados group by 1;
select nivel_atencao, count(*) from public.contabil_mapeamento group by 1;
```

- [ ] **Step 2: Conferir contra a lista de colunas de `FONTES` na Task 5**

Para cada tabela, confirmar que todas as colunas listadas na Task 5 existem. Pontos de atenção conhecidos:
- `licencas`/`alvaras`: coluna `tipo` (texto) vs `tipo_id`; `ativo`, `deletado_em`.
- `rh_socios`: `data_saida` existe?
- `certificados`: `cpf_cnpj`, `cliente`, `situacao`, `data_vencimento`, `ativo`.
- `formularios`/`empregados`: `rh_empresa_id`.
- `rh_empregados.situacao`: valores reais (a regra de "ativo" na Task 3 é `includes('ativ') && !includes('inativ')` — se os valores forem outros, ajustar `empregadoAtivo`).

Se algo divergir, **editar o plano (Tasks 3 e 5) antes de seguir** e avisar o usuário.

---

### Task 1: SQL das tabelas novas

**Files:**
- Create: `_sql/schema_ficha360.sql`

**Interfaces:**
- Produces: tabelas `ficha360_empresa`, `ficha360_contatos`, `ficha360_anotacoes`; ferramenta `./Projeto Ficha 360/index.html` em `ferramentas`.

- [ ] **Step 1: Criar o arquivo**

```sql
-- ============================================================
-- SCONT – FICHA 360 DO CLIENTE
-- Execute no SQL Editor do Supabase (projeto do Portal)
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

-- 1. Dados Scont da empresa (o que o Domínio não tem)
CREATE TABLE IF NOT EXISTS public.ficha360_empresa (
    codigo_empresa       TEXT PRIMARY KEY REFERENCES public.rh_empresas (codigo_empresa) ON DELETE CASCADE,
    status_carteira      TEXT NOT NULL DEFAULT 'ativo'
                         CHECK (status_carteira IN ('ativo', 'em_implantacao', 'em_saida', 'inativo')),
    data_inicio_cliente  DATE,
    data_saida_cliente   DATE,
    atende_fiscal        BOOLEAN NOT NULL DEFAULT FALSE,
    atende_societario    BOOLEAN NOT NULL DEFAULT FALSE,
    atende_bpo           BOOLEAN NOT NULL DEFAULT FALSE,
    porte                TEXT,
    atividade_principal  TEXT,
    observacao_geral     TEXT,
    atualizado_por       TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.ficha360_empresa_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ficha360_empresa_updated_at ON public.ficha360_empresa;
CREATE TRIGGER trg_ficha360_empresa_updated_at
    BEFORE UPDATE ON public.ficha360_empresa
    FOR EACH ROW EXECUTE FUNCTION public.ficha360_empresa_set_updated_at();

-- 2. Contatos do cliente
CREATE TABLE IF NOT EXISTS public.ficha360_contatos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL REFERENCES public.rh_empresas (codigo_empresa) ON DELETE CASCADE,
    nome            TEXT NOT NULL,
    funcao          TEXT,
    area            TEXT NOT NULL DEFAULT 'geral'
                    CHECK (area IN ('geral', 'dp', 'contabil', 'fiscal', 'financeiro')),
    telefone        TEXT,
    email           TEXT,
    whatsapp        TEXT,
    principal       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ficha360_contatos_empresa ON public.ficha360_contatos (codigo_empresa);

-- 3. Anotações internas
CREATE TABLE IF NOT EXISTS public.ficha360_anotacoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa  TEXT NOT NULL REFERENCES public.rh_empresas (codigo_empresa) ON DELETE CASCADE,
    texto           TEXT NOT NULL,
    categoria       TEXT NOT NULL DEFAULT 'geral'
                    CHECK (categoria IN ('geral', 'dp', 'contabil', 'financeiro', 'combinado')),
    fixada          BOOLEAN NOT NULL DEFAULT FALSE,
    autor_id        UUID NOT NULL DEFAULT auth.uid(),
    autor_nome      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    editado_em      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ficha360_anotacoes_empresa ON public.ficha360_anotacoes (codigo_empresa, created_at DESC);

-- 4. RLS
ALTER TABLE public.ficha360_empresa   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha360_contatos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ficha360_anotacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ficha360_empresa_all ON public.ficha360_empresa;
CREATE POLICY ficha360_empresa_all ON public.ficha360_empresa
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS ficha360_contatos_all ON public.ficha360_contatos;
CREATE POLICY ficha360_contatos_all ON public.ficha360_contatos
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS ficha360_anotacoes_select ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_select ON public.ficha360_anotacoes
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS ficha360_anotacoes_insert ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_insert ON public.ficha360_anotacoes
    FOR INSERT TO authenticated WITH CHECK (autor_id = auth.uid());

DROP POLICY IF EXISTS ficha360_anotacoes_update ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_update ON public.ficha360_anotacoes
    FOR UPDATE TO authenticated
    USING (autor_id = auth.uid() OR public.is_admin())
    WITH CHECK (autor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS ficha360_anotacoes_delete ON public.ficha360_anotacoes;
CREATE POLICY ficha360_anotacoes_delete ON public.ficha360_anotacoes
    FOR DELETE TO authenticated USING (autor_id = auth.uid() OR public.is_admin());

-- 5. Registro no portal (conceder acesso pela tela de admin, como nas demais)
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
SELECT 'Ficha 360 do Cliente',
       'Visão única de cada empresa: cadastro, vencimentos, DP, contábil, anotações e semáforo da carteira',
       '🧾', './Projeto Ficha 360/index.html', TRUE, 5
WHERE NOT EXISTS (
    SELECT 1 FROM public.ferramentas WHERE url_base = './Projeto Ficha 360/index.html'
);
```

- [ ] **Step 2: Commit**

```bash
git add "_sql/schema_ficha360.sql"
git commit -m "feat(ficha360): SQL das tabelas empresa/contatos/anotações + RLS + registro no portal"
```

- [ ] **Step 3: Avisar o usuário** que o SQL está **pendente de execução manual** no SQL Editor (a ferramenta funciona degradada sem ele — Tasks 5–10 tratam `tabela_ausente`).

---

### Task 2: `vinculos.js` — normalização e vínculos

**Files:**
- Create: `Projeto Ficha 360/js/vinculos.js`
- Test: `Projeto Ficha 360/tests/vinculos.test.js`

**Interfaces:**
- Produces (global `Ficha360Vinculos` / `require`):
  - `soDigitos(v: any) → string`
  - `normalizarNome(v: any) → string` — sem acento, maiúsculas, sem pontuação, sem sufixos societários finais (LTDA, ME, EPP, EIRELI, SA, SS, MEI)
  - `indexarPorCodigo(linhas: Array, campo = 'codigo_empresa') → Map<string, Array>`
  - `vincularCertificados(certificados, empresas, socios) → Map<codigo_empresa, cert[]>`
  - `vincularContatosCrm(contatosEmpresas, empresas) → Map<codigo_empresa, contato_id[]>`

- [ ] **Step 1: Escrever o teste**

```js
// Projeto Ficha 360/tests/vinculos.test.js
const assert = require('node:assert');
const V = require('../js/vinculos.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }

teste('soDigitos remove máscara e trata null', () => {
    assert.strictEqual(V.soDigitos('12.345.678/0001-90'), '12345678000190');
    assert.strictEqual(V.soDigitos(null), '');
});

teste('normalizarNome remove acento, pontuação e sufixos societários', () => {
    assert.strictEqual(V.normalizarNome('  Padaria  São João Ltda. '), 'PADARIA SAO JOAO');
    assert.strictEqual(V.normalizarNome('ALFA COMERCIO - ME'), 'ALFA COMERCIO');
    assert.strictEqual(V.normalizarNome('Beta Serviços EIRELI'), 'BETA SERVICOS');
    assert.strictEqual(V.normalizarNome('Gama Indústria S/A'), 'GAMA INDUSTRIA');
    assert.strictEqual(V.normalizarNome('Delta EPP LTDA'), 'DELTA');
    assert.strictEqual(V.normalizarNome('ACME'), 'ACME');
    assert.strictEqual(V.normalizarNome('LTDA'), 'LTDA');
});

teste('indexarPorCodigo agrupa linhas', () => {
    const m = V.indexarPorCodigo([{ codigo_empresa: '1', x: 1 }, { codigo_empresa: '1', x: 2 }, { codigo_empresa: '2', x: 3 }]);
    assert.strictEqual(m.get('1').length, 2);
    assert.strictEqual(m.get('2').length, 1);
    assert.strictEqual(m.get('3'), undefined);
});

teste('indexarPorCodigo aceita campo customizado', () => {
    const m = V.indexarPorCodigo([{ mapeamento_id: 'a' }], 'mapeamento_id');
    assert.strictEqual(m.get('a').length, 1);
});

const EMPRESAS = [
    { codigo_empresa: '10', nome_empresa: 'Alfa Ltda', cnpj: '12.345.678/0001-90' },
    { codigo_empresa: '20', nome_empresa: 'Beta ME', cnpj: '98765432000110' },
];
const SOCIOS = [
    { codigo_empresa: '10', cpf: '111.222.333-44' },
    { codigo_empresa: '20', cpf: '11122233344' },
];

teste('vincularCertificados casa e-CNPJ por CNPJ sem máscara', () => {
    const m = V.vincularCertificados([{ id: 'c1', cpf_cnpj: '12345678000190' }], EMPRESAS, SOCIOS);
    assert.deepStrictEqual(m.get('10').map(c => c.id), ['c1']);
    assert.strictEqual(m.get('20'), undefined);
});

teste('vincularCertificados casa e-CPF em todas as empresas do sócio', () => {
    const m = V.vincularCertificados([{ id: 'c2', cpf_cnpj: '111.222.333-44' }], EMPRESAS, SOCIOS);
    assert.deepStrictEqual(m.get('10').map(c => c.id), ['c2']);
    assert.deepStrictEqual(m.get('20').map(c => c.id), ['c2']);
});

teste('vincularCertificados ignora documento sem correspondência', () => {
    const m = V.vincularCertificados([{ id: 'c3', cpf_cnpj: '00000000000000' }, { id: 'c4', cpf_cnpj: null }], EMPRESAS, SOCIOS);
    assert.strictEqual(m.size, 0);
});

teste('vincularContatosCrm casa por nome normalizado, sem duplicar contato', () => {
    const m = V.vincularContatosCrm([
        { contato_id: 'k1', empresa: 'ALFA LTDA.' },
        { contato_id: 'k1', empresa: 'alfa' },
        { contato_id: 'k2', empresa: 'Beta' },
        { contato_id: 'k3', empresa: 'Outra' },
    ], EMPRESAS);
    assert.deepStrictEqual(m.get('10'), ['k1']);
    assert.deepStrictEqual(m.get('20'), ['k2']);
    assert.strictEqual(m.size, 2);
});

console.log(`\n${n} testes OK`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node "Projeto Ficha 360/tests/vinculos.test.js"`
Expected: FAIL — `Cannot find module '../js/vinculos.js'`

- [ ] **Step 3: Implementar**

```js
// Projeto Ficha 360/js/vinculos.js
/**
 * Ficha 360 — normalização e vínculos entre módulos.
 * Módulo puro: sem DOM, sem Supabase. Global `Ficha360Vinculos` no navegador; require() em Node.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.Ficha360Vinculos = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SUFIXOS = ['LTDA', 'ME', 'EPP', 'EIRELI', 'SA', 'SS', 'MEI'];

    function soDigitos(v) {
        return String(v == null ? '' : v).replace(/\D/g, '');
    }

    function normalizarNome(v) {
        let s = String(v == null ? '' : v)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/S\/A|S\.A\./g, ' SA ')
            .replace(/[^A-Z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const partes = s ? s.split(' ') : [];
        while (partes.length > 1 && SUFIXOS.includes(partes[partes.length - 1])) partes.pop();
        return partes.join(' ');
    }

    function indexarPorCodigo(linhas, campo) {
        const chave = campo || 'codigo_empresa';
        const mapa = new Map();
        for (const l of linhas || []) {
            const k = l[chave];
            if (k == null) continue;
            if (!mapa.has(k)) mapa.set(k, []);
            mapa.get(k).push(l);
        }
        return mapa;
    }

    function _adicionar(mapa, codigo, item) {
        if (!mapa.has(codigo)) mapa.set(codigo, []);
        mapa.get(codigo).push(item);
    }

    function vincularCertificados(certificados, empresas, socios) {
        const porCnpj = new Map();
        for (const e of empresas || []) {
            const d = soDigitos(e.cnpj);
            if (d.length === 14) porCnpj.set(d, e.codigo_empresa);
        }
        const porCpf = new Map();
        for (const s of socios || []) {
            const d = soDigitos(s.cpf);
            if (d.length !== 11) continue;
            if (!porCpf.has(d)) porCpf.set(d, new Set());
            porCpf.get(d).add(s.codigo_empresa);
        }
        const out = new Map();
        for (const c of certificados || []) {
            const d = soDigitos(c.cpf_cnpj);
            if (d.length === 14 && porCnpj.has(d)) {
                _adicionar(out, porCnpj.get(d), c);
            } else if (d.length === 11 && porCpf.has(d)) {
                for (const cod of porCpf.get(d)) _adicionar(out, cod, c);
            }
        }
        return out;
    }

    function vincularContatosCrm(contatosEmpresas, empresas) {
        const porNome = new Map();
        for (const e of empresas || []) {
            const n = normalizarNome(e.nome_empresa);
            if (!n) continue;
            if (!porNome.has(n)) porNome.set(n, []);
            porNome.get(n).push(e.codigo_empresa);
        }
        const out = new Map();
        for (const ce of contatosEmpresas || []) {
            const codigos = porNome.get(normalizarNome(ce.empresa));
            if (!codigos) continue;
            for (const cod of codigos) {
                if (!out.has(cod)) out.set(cod, []);
                if (!out.get(cod).includes(ce.contato_id)) out.get(cod).push(ce.contato_id);
            }
        }
        return out;
    }

    return { soDigitos, normalizarNome, indexarPorCodigo, vincularCertificados, vincularContatosCrm };
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node "Projeto Ficha 360/tests/vinculos.test.js"`
Expected: `8 testes OK`

- [ ] **Step 5: Commit**

```bash
git add "Projeto Ficha 360/js/vinculos.js" "Projeto Ficha 360/tests/vinculos.test.js"
git commit -m "feat(ficha360): vínculos certificado/CRM por CNPJ, CPF e nome normalizado"
```

---

### Task 3: `regras.js` — alertas e semáforo

**Files:**
- Create: `Projeto Ficha 360/js/regras.js`
- Test: `Projeto Ficha 360/tests/regras.test.js`

**Interfaces:**
- Consumes: `ContabilDiarioUtil.qtdMesesNoPeriodo(periodicidade)`, `.mesFinalDoPeriodo(mes, periodicidade)`, `.descricaoPeriodo(periodicidade, ano, mesFinal)` de `Projeto Onboarding Contabil/contabil-diario-util.js` (global no navegador, `require` em Node).
- Produces (global `Ficha360Regras`):
  - `LIMITES` (objeto de constantes)
  - `diasAte(dataISO, hojeISO) → number|null` (positivo = futuro)
  - `competenciaAnterior(hojeISO) → 'MM/AAAA'`
  - `periodoEsperado(periodicidade, hojeISO) → { ano, mes }`
  - `empregadoAtivo(situacao) → boolean`
  - Alerta: `{ modulo: string, gravidade: 'critico'|'atencao'|'info', mensagem: string }`
  - `alertasCertificados(certs, hoje)`, `alertasLicencas(itens, hoje)` (itens com `origem: 'licenca'|'alvara'`), `alertasFolha({ possuiFolha, ciclos, temResponsavel }, hoje)` (ciclo: `{ competencia, concluido_em, fechamento_ciclo_fase: [{status}] }`), `alertasQsa(ocorrencias)`, `alertasFormularios(forms, hoje)`, `alertasDiario({ possuiContabil, periodicidade, eventos, temResponsavel }, hoje)`, `alertasMapeamento({ mapeamento, pendencias }, hoje)`, `alertasOnboarding(onboarding, hoje)`, `alertasCadastro({ ficha, contatos })` — todas `→ Alerta[]`
  - `semaforo(alertas, statusCarteira) → 'vermelho'|'amarelo'|'verde'|'inativo'`
  - `ordenarAlertas(alertas) → Alerta[]` (crítico primeiro)

- [ ] **Step 1: Escrever o teste**

```js
// Projeto Ficha 360/tests/regras.test.js
const assert = require('node:assert');
const R = require('../js/regras.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }
const grav = (alertas) => alertas.map(a => a.gravidade);
const HOJE = '2026-09-14';

// ===== helpers =====
teste('diasAte conta dias corridos e trata null', () => {
    assert.strictEqual(R.diasAte('2026-09-21', HOJE), 7);
    assert.strictEqual(R.diasAte('2026-09-13', HOJE), -1);
    assert.strictEqual(R.diasAte('2026-09-14T10:00:00Z', HOJE), 0);
    assert.strictEqual(R.diasAte(null, HOJE), null);
});

teste('competenciaAnterior vira o ano em janeiro', () => {
    assert.strictEqual(R.competenciaAnterior('2026-09-14'), '08/2026');
    assert.strictEqual(R.competenciaAnterior('2027-01-05'), '12/2026');
});

teste('periodoEsperado respeita periodicidade', () => {
    assert.deepStrictEqual(R.periodoEsperado('mensal', '2026-09-14'), { ano: 2026, mes: 8 });
    assert.deepStrictEqual(R.periodoEsperado('trimestral', '2026-09-14'), { ano: 2026, mes: 6 });
    assert.deepStrictEqual(R.periodoEsperado('trimestral', '2026-10-01'), { ano: 2026, mes: 9 });
    assert.deepStrictEqual(R.periodoEsperado('semestral', '2026-09-14'), { ano: 2026, mes: 6 });
    assert.deepStrictEqual(R.periodoEsperado('anual', '2026-09-14'), { ano: 2025, mes: 12 });
    assert.deepStrictEqual(R.periodoEsperado('mensal', '2027-01-10'), { ano: 2026, mes: 12 });
    assert.deepStrictEqual(R.periodoEsperado(null, '2026-09-14'), { ano: 2026, mes: 8 });
});

teste('empregadoAtivo', () => {
    assert.strictEqual(R.empregadoAtivo('Ativo'), true);
    assert.strictEqual(R.empregadoAtivo('Inativo'), false);
    assert.strictEqual(R.empregadoAtivo(null), false);
});

// ===== certificado =====
teste('certificado: bordas 7/8 e 30/31 dias', () => {
    const c = (d) => ({ situacao: 'Ativo', ativo: true, data_vencimento: d });
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-09-21')], HOJE)), ['critico']);   // 7
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-09-22')], HOJE)), ['atencao']);   // 8
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-10-14')], HOJE)), ['atencao']);   // 30
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-10-15')], HOJE)), []);            // 31
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-09-01')], HOJE)), ['critico']);   // vencido
});

teste('certificado: inativo/renovado ignorado; lista vazia gera info', () => {
    assert.deepStrictEqual(grav(R.alertasCertificados([], HOJE)), ['info']);
    assert.deepStrictEqual(grav(R.alertasCertificados([{ ativo: false, data_vencimento: '2026-09-01' }], HOJE)), ['info']);
    assert.deepStrictEqual(grav(R.alertasCertificados([{ ativo: true, situacao: 'Renovado', data_vencimento: '2026-09-01' }], HOJE)), ['info']);
});

// ===== licença =====
teste('licença: bordas 15/16 e 60/61 dias', () => {
    const l = (d) => ({ origem: 'licenca', tipo: 'Bombeiros', data_validade: d });
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-09-29')], HOJE)), ['critico']);   // 15
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-09-30')], HOJE)), ['atencao']);   // 16
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-11-13')], HOJE)), ['atencao']);   // 60
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-11-14')], HOJE)), []);            // 61
    assert.deepStrictEqual(grav(R.alertasLicencas([{ origem: 'alvara', data_validade: null }], HOJE)), []);
});

// ===== folha =====
teste('folha: sem folha contratada não gera alerta', () => {
    assert.deepStrictEqual(R.alertasFolha({ possuiFolha: false, ciclos: [], temResponsavel: false }, HOJE), []);
});

teste('folha: dia 10 atenção, dia 11 crítico; concluído limpa', () => {
    const ciclos = [{ competencia: '08/2026', concluido_em: null, fechamento_ciclo_fase: [{ status: 'pendente' }, { status: 'concluida' }] }];
    assert.deepStrictEqual(grav(R.alertasFolha({ possuiFolha: true, ciclos, temResponsavel: true }, '2026-09-10')), ['atencao']);
    assert.deepStrictEqual(grav(R.alertasFolha({ possuiFolha: true, ciclos, temResponsavel: true }, '2026-09-11')), ['critico']);
    const ok = [{ competencia: '08/2026', concluido_em: '2026-09-05T12:00:00Z', fechamento_ciclo_fase: [] }];
    assert.deepStrictEqual(grav(R.alertasFolha({ possuiFolha: true, ciclos: ok, temResponsavel: true }, '2026-09-11')), []);
});

teste('folha: ciclo inexistente após dia 10 é crítico e sem responsável gera info', () => {
    const a = R.alertasFolha({ possuiFolha: true, ciclos: [], temResponsavel: false }, '2026-09-11');
    assert.deepStrictEqual(grav(a).sort(), ['critico', 'info']);
    assert.ok(a.find(x => x.gravidade === 'critico').mensagem.includes('não iniciado'));
});

// ===== QSA =====
teste('QSA: ocorrendo agora é crítico; histórico é atenção', () => {
    assert.deepStrictEqual(grav(R.alertasQsa([{ nome_socio: 'A', ocorrendo_agora: true }, { nome_socio: 'B', ocorrendo_agora: false }])), ['critico', 'atencao']);
    assert.deepStrictEqual(R.alertasQsa([]), []);
});

// ===== formulários =====
teste('formulários: 15 dias atenção, 16 crítico; fechados ignorados; agrega por gravidade', () => {
    const f = (d, status = 'recebido') => ({ status, created_at: `${d}T09:00:00Z` });
    assert.deepStrictEqual(grav(R.alertasFormularios([f('2026-08-30')], HOJE)), ['atencao']);  // 15
    assert.deepStrictEqual(grav(R.alertasFormularios([f('2026-08-29')], HOJE)), ['critico']);  // 16
    assert.deepStrictEqual(grav(R.alertasFormularios([f('2026-08-01', 'validado'), f('2026-08-01', 'excluido'), f('2026-08-01', 'rejeitado')], HOJE)), []);
    const a = R.alertasFormularios([f('2026-08-01'), f('2026-08-02'), f('2026-09-13')], HOJE);
    assert.deepStrictEqual(grav(a), ['critico', 'atencao']);
    assert.ok(a[0].mensagem.startsWith('2 '));
});

// ===== diário =====
teste('diário: sem contábil não gera alerta', () => {
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: false, periodicidade: 'mensal', eventos: [], temResponsavel: false }, HOJE), []);
});

teste('diário: competência esperada não enviada é atenção', () => {
    const a = R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: [], temResponsavel: true }, HOJE);
    assert.deepStrictEqual(grav(a), ['atencao']);
});

teste('diário: enviado/aprovado na esperada não gera alerta', () => {
    const ev = [{ ano: 2026, mes: 8, tipo_evento: 'enviado', created_at: '2026-09-02T10:00:00Z' }];
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: ev, temResponsavel: true }, HOJE), []);
});

teste('diário: último evento rejeitado é crítico; reenvio limpa', () => {
    const rej = [
        { ano: 2026, mes: 7, tipo_evento: 'enviado', created_at: '2026-08-02T10:00:00Z' },
        { ano: 2026, mes: 7, tipo_evento: 'rejeitado', created_at: '2026-08-03T10:00:00Z' },
        { ano: 2026, mes: 8, tipo_evento: 'aprovado', created_at: '2026-09-03T10:00:00Z' },
    ];
    assert.deepStrictEqual(grav(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: rej, temResponsavel: true }, HOJE)), ['critico']);
    const reenviado = rej.concat([{ ano: 2026, mes: 7, tipo_evento: 'enviado', created_at: '2026-08-04T10:00:00Z' }]);
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: reenviado, temResponsavel: true }, HOJE), []);
});

teste('diário: trimestral espera 06/2026 em setembro', () => {
    const ev = [{ ano: 2026, mes: 6, tipo_evento: 'aprovado', created_at: '2026-07-10T10:00:00Z' }];
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: true, periodicidade: 'trimestral', eventos: ev, temResponsavel: true }, HOJE), []);
});

teste('diário: sem responsável gera info', () => {
    const ev = [{ ano: 2026, mes: 8, tipo_evento: 'aprovado', created_at: '2026-09-03T10:00:00Z' }];
    assert.deepStrictEqual(grav(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: ev, temResponsavel: false }, HOJE)), ['info']);
});

// ===== mapeamento =====
teste('mapeamento: níveis e pendências', () => {
    assert.deepStrictEqual(R.alertasMapeamento({ mapeamento: null, pendencias: [] }, HOJE), []);
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'critico' }, pendencias: [] }, HOJE)), ['critico']);
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'alto' }, pendencias: [] }, HOJE)), ['atencao']);
    assert.deepStrictEqual(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'medio' }, pendencias: [] }, HOJE), []);
    const vencida = { status: 'aberta', prazo: '2026-09-13' };
    const futura = { status: 'aberta', prazo: '2026-09-20' };
    const resolvida = { status: 'resolvida', prazo: '2026-01-01' };
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'baixo' }, pendencias: [vencida, futura] }, HOJE)), ['atencao']);
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'baixo' }, pendencias: [futura, resolvida] }, HOJE)), ['info']);
});

// ===== onboarding =====
teste('onboarding: 60 dias ok, 61 atenção, concluído ignorado', () => {
    assert.deepStrictEqual(R.alertasOnboarding({ status: 'em_andamento', data_inicio: '2026-07-16' }, HOJE), []);           // 60
    assert.deepStrictEqual(grav(R.alertasOnboarding({ status: 'em_andamento', data_inicio: '2026-07-15' }, HOJE)), ['atencao']); // 61
    assert.deepStrictEqual(R.alertasOnboarding({ status: 'concluido', data_inicio: '2025-01-01' }, HOJE), []);
    assert.deepStrictEqual(R.alertasOnboarding(null, HOJE), []);
});

// ===== cadastro =====
teste('cadastro: sem ficha / sem contato principal geram info', () => {
    assert.deepStrictEqual(grav(R.alertasCadastro({ ficha: null, contatos: [] })), ['info']);
    assert.deepStrictEqual(grav(R.alertasCadastro({ ficha: {}, contatos: [{ principal: false }] })), ['info']);
    assert.deepStrictEqual(R.alertasCadastro({ ficha: {}, contatos: [{ principal: true }] }), []);
});

// ===== semáforo =====
teste('semáforo: pior gravidade vence; info é verde; inativo sobrepõe', () => {
    const a = (g) => ({ modulo: 'x', gravidade: g, mensagem: '' });
    assert.strictEqual(R.semaforo([a('info'), a('critico'), a('atencao')], 'ativo'), 'vermelho');
    assert.strictEqual(R.semaforo([a('info'), a('atencao')], 'ativo'), 'amarelo');
    assert.strictEqual(R.semaforo([a('info')], 'ativo'), 'verde');
    assert.strictEqual(R.semaforo([], undefined), 'verde');
    assert.strictEqual(R.semaforo([a('critico')], 'inativo'), 'inativo');
});

teste('ordenarAlertas coloca crítico primeiro sem mutar a entrada', () => {
    const entrada = [{ gravidade: 'info' }, { gravidade: 'critico' }, { gravidade: 'atencao' }];
    assert.deepStrictEqual(grav(R.ordenarAlertas(entrada)), ['critico', 'atencao', 'info']);
    assert.strictEqual(entrada[0].gravidade, 'info');
});

console.log(`\n${n} testes OK`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node "Projeto Ficha 360/tests/regras.test.js"`
Expected: FAIL — `Cannot find module '../js/regras.js'`

- [ ] **Step 3: Implementar**

```js
// Projeto Ficha 360/js/regras.js
/**
 * Ficha 360 — regras de alerta por módulo e semáforo.
 * Módulo puro: sem DOM, sem Supabase, sem new Date() (hoje é parâmetro ISO).
 * Depende de ContabilDiarioUtil (Projeto Onboarding Contabil/contabil-diario-util.js).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../../Projeto Onboarding Contabil/contabil-diario-util.js'));
    } else {
        root.Ficha360Regras = factory(root.ContabilDiarioUtil);
    }
})(typeof self !== 'undefined' ? self : this, function (DiarioUtil) {
    'use strict';

    const LIMITES = {
        certCriticoDias: 7,
        certAtencaoDias: 30,
        licCriticoDias: 15,
        licAtencaoDias: 60,
        folhaDiaLimite: 10,
        formCriticoDias: 15,
        onboardingAtencaoDias: 60,
    };

    const PESO = { critico: 3, atencao: 2, info: 1 };
    const FORM_FECHADOS = ['validado', 'rejeitado', 'excluido'];

    function alerta(modulo, gravidade, mensagem) {
        return { modulo, gravidade, mensagem };
    }

    function _utc(iso) {
        const [a, m, d] = String(iso == null ? '' : iso).slice(0, 10).split('-').map(Number);
        if (!a || !m || !d) return null;
        return Date.UTC(a, m - 1, d);
    }

    function diasAte(dataISO, hojeISO) {
        const alvo = _utc(dataISO), hoje = _utc(hojeISO);
        if (alvo === null || hoje === null) return null;
        return Math.round((alvo - hoje) / 86400000);
    }

    function _mesAnterior(hojeISO) {
        let ano = Number(hojeISO.slice(0, 4));
        let mes = Number(hojeISO.slice(5, 7)) - 1;
        if (mes < 1) { mes = 12; ano -= 1; }
        return { ano, mes };
    }

    function competenciaAnterior(hojeISO) {
        const { ano, mes } = _mesAnterior(hojeISO);
        return `${String(mes).padStart(2, '0')}/${ano}`;
    }

    function periodoEsperado(periodicidade, hojeISO) {
        const per = periodicidade || 'mensal';
        const { ano, mes } = _mesAnterior(hojeISO);
        const fim = DiarioUtil.mesFinalDoPeriodo(mes, per);
        if (fim === mes) return { ano, mes };
        let m = fim - DiarioUtil.qtdMesesNoPeriodo(per);
        let a = ano;
        if (m < 1) { m += 12; a -= 1; }
        return { ano: a, mes: m };
    }

    function empregadoAtivo(situacao) {
        const s = String(situacao == null ? '' : situacao).toLowerCase();
        return s.includes('ativ') && !s.includes('inativ');
    }

    function _porDias(modulo, rotulo, dias, limCritico, limAtencao) {
        if (dias === null) return null;
        if (dias < 0) return alerta(modulo, 'critico', `${rotulo} vencido há ${-dias}d`);
        if (dias <= limCritico) return alerta(modulo, 'critico', `${rotulo} vence em ${dias}d`);
        if (dias <= limAtencao) return alerta(modulo, 'atencao', `${rotulo} vence em ${dias}d`);
        return null;
    }

    function alertasCertificados(certs, hoje) {
        const ativos = (certs || []).filter(c => c.ativo !== false && c.situacao !== 'Renovado');
        if (!ativos.length) return [alerta('certificado', 'info', 'Nenhum certificado vinculado')];
        const out = [];
        for (const c of ativos) {
            const rotulo = c.cliente ? `Certificado (${c.cliente})` : 'Certificado';
            const a = _porDias('certificado', rotulo, diasAte(c.data_vencimento, hoje), LIMITES.certCriticoDias, LIMITES.certAtencaoDias);
            if (a) out.push(a);
        }
        return out;
    }

    function alertasLicencas(itens, hoje) {
        const out = [];
        for (const l of itens || []) {
            const base = l.origem === 'alvara' ? 'Alvará' : 'Licença';
            const rotulo = l.tipo ? `${base} ${l.tipo}` : base;
            const a = _porDias('licenca', rotulo, diasAte(l.data_validade, hoje), LIMITES.licCriticoDias, LIMITES.licAtencaoDias);
            if (a) out.push(a);
        }
        return out;
    }

    function alertasFolha({ possuiFolha, ciclos, temResponsavel }, hoje) {
        if (!possuiFolha) return [];
        const out = [];
        if (!temResponsavel) out.push(alerta('folha', 'info', 'Sem responsável DP'));
        const comp = competenciaAnterior(hoje);
        const ciclo = (ciclos || []).find(c => c.competencia === comp);
        if (ciclo && ciclo.concluido_em) return out;
        const detalhe = ciclo
            ? `${(ciclo.fechamento_ciclo_fase || []).filter(f => f.status !== 'concluida').length} fase(s) pendente(s)`
            : 'ciclo não iniciado';
        const dia = Number(hoje.slice(8, 10));
        if (dia > LIMITES.folhaDiaLimite) {
            out.push(alerta('folha', 'critico', `Folha ${comp} não concluída após dia ${LIMITES.folhaDiaLimite} (${detalhe})`));
        } else {
            out.push(alerta('folha', 'atencao', `Folha ${comp} em andamento (${detalhe})`));
        }
        return out;
    }

    function alertasQsa(ocorrencias) {
        return (ocorrencias || []).map(o => o.ocorrendo_agora
            ? alerta('qsa', 'critico', `Sócio ${o.nome_socio} também é empregado ativo`)
            : alerta('qsa', 'atencao', `Sócio ${o.nome_socio} já foi empregado no mesmo período`));
    }

    function alertasFormularios(forms, hoje) {
        let criticos = 0, atencao = 0;
        for (const f of forms || []) {
            if (FORM_FECHADOS.includes(f.status)) continue;
            const idade = -diasAte(f.created_at, hoje);
            if (idade > LIMITES.formCriticoDias) criticos++; else atencao++;
        }
        const out = [];
        if (criticos) out.push(alerta('formularios', 'critico', `${criticos} formulário(s) em aberto há mais de ${LIMITES.formCriticoDias} dias`));
        if (atencao) out.push(alerta('formularios', 'atencao', `${atencao} formulário(s) em aberto`));
        return out;
    }

    function alertasDiario({ possuiContabil, periodicidade, eventos, temResponsavel }, hoje) {
        if (!possuiContabil) return [];
        const per = periodicidade || 'mensal';
        const out = [];
        if (!temResponsavel) out.push(alerta('diario', 'info', 'Sem responsável Contábil'));

        const ultimo = new Map();
        const ordenados = (eventos || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        for (const ev of ordenados) ultimo.set(`${ev.ano}|${ev.mes}`, ev);

        for (const ev of ultimo.values()) {
            if (ev.tipo_evento === 'rejeitado') {
                out.push(alerta('diario', 'critico', `Diário ${DiarioUtil.descricaoPeriodo(per, ev.ano, ev.mes)} rejeitado sem reenvio`));
            }
        }
        const esp = periodoEsperado(per, hoje);
        if (!ultimo.has(`${esp.ano}|${esp.mes}`)) {
            out.push(alerta('diario', 'atencao', `Diário ${DiarioUtil.descricaoPeriodo(per, esp.ano, esp.mes)} não enviado`));
        }
        return out;
    }

    function alertasMapeamento({ mapeamento, pendencias }, hoje) {
        if (!mapeamento) return [];
        const out = [];
        if (mapeamento.nivel_atencao === 'critico') out.push(alerta('mapeamento', 'critico', 'Nível de atenção crítico'));
        if (mapeamento.nivel_atencao === 'alto') out.push(alerta('mapeamento', 'atencao', 'Nível de atenção alto'));
        const abertas = (pendencias || []).filter(p => p.status === 'aberta');
        const vencidas = abertas.filter(p => p.prazo && diasAte(p.prazo, hoje) < 0);
        if (vencidas.length) out.push(alerta('mapeamento', 'atencao', `${vencidas.length} pendência(s) do mapeamento vencida(s)`));
        else if (abertas.length) out.push(alerta('mapeamento', 'info', `${abertas.length} pendência(s) do mapeamento aberta(s)`));
        return out;
    }

    function alertasOnboarding(onboarding, hoje) {
        if (!onboarding || onboarding.status !== 'em_andamento' || !onboarding.data_inicio) return [];
        const idade = -diasAte(onboarding.data_inicio, hoje);
        return idade > LIMITES.onboardingAtencaoDias
            ? [alerta('onboarding', 'atencao', `Onboarding em andamento há ${idade} dias`)]
            : [];
    }

    function alertasCadastro({ ficha, contatos }) {
        if (!ficha) return [alerta('cadastro', 'info', 'Cadastro Scont não preenchido')];
        if (!(contatos || []).some(c => c.principal)) return [alerta('cadastro', 'info', 'Sem contato principal')];
        return [];
    }

    function semaforo(alertas, statusCarteira) {
        if (statusCarteira === 'inativo') return 'inativo';
        const lista = alertas || [];
        if (lista.some(a => a.gravidade === 'critico')) return 'vermelho';
        if (lista.some(a => a.gravidade === 'atencao')) return 'amarelo';
        return 'verde';
    }

    function ordenarAlertas(alertas) {
        return (alertas || []).slice().sort((a, b) => (PESO[b.gravidade] || 0) - (PESO[a.gravidade] || 0));
    }

    return {
        LIMITES, diasAte, competenciaAnterior, periodoEsperado, empregadoAtivo,
        alertasCertificados, alertasLicencas, alertasFolha, alertasQsa, alertasFormularios,
        alertasDiario, alertasMapeamento, alertasOnboarding, alertasCadastro,
        semaforo, ordenarAlertas,
    };
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node "Projeto Ficha 360/tests/regras.test.js"`
Expected: `23 testes OK`

Se `periodoEsperado('mensal', ...)` falhar, abrir `Projeto Onboarding Contabil/contabil-diario-util.js` linhas 76–92 e confirmar o retorno de `qtdMesesNoPeriodo`/`mesFinalDoPeriodo` para `'mensal'` (esperado: `1` e o próprio `mes`). Não alterar o util; ajustar `periodoEsperado`.

- [ ] **Step 5: Commit**

```bash
git add "Projeto Ficha 360/js/regras.js" "Projeto Ficha 360/tests/regras.test.js"
git commit -m "feat(ficha360): regras de alerta por módulo e semáforo"
```

---

### Task 4: `carteira.js` — consolidação por empresa

**Files:**
- Create: `Projeto Ficha 360/js/carteira.js`
- Test: `Projeto Ficha 360/tests/carteira.test.js`

**Interfaces:**
- Consumes: `Ficha360Vinculos` (Task 2), `Ficha360Regras` (Task 3), `QsaAnalise.computarOcorrencias(socios, empregados, empresas, hoje)` (`Projeto RH/qsa-analise.js`).
- Produces (global `Ficha360Carteira`):
  - `montarCarteira(dados, hoje) → ItemCarteira[]` ordenado por `nome`.
  - `dados`: objeto cujas chaves são as de `FONTES` (Task 5) + `usuariosContabil`; valor `Array` = fonte ok, `null` = fonte indisponível.
  - `ItemCarteira`:
    ```
    { codigo, empresaId, nome, cnpj, regime, uf, cidade, situacaoDominio, dominio (linha rh_empresas),
      ficha (linha ficha360_empresa|null), statusCarteira, possuiFolha, possuiContabil,
      responsaveisDp: string[], responsaveisContabil: string[], grupo: string|null,
      empregadosAtivos: number|null, certificados: [], licencas: [] (com origem), socios: [],
      ocorrenciasQsa: [], ciclos: [], formularios: [], onboarding: obj|null,
      mapeamento: obj|null, pendencias: [], diarioEventos: [], contatos: [],
      alertas: Alerta[] (ordenados), semaforo }
    ```

- [ ] **Step 1: Escrever o teste**

```js
// Projeto Ficha 360/tests/carteira.test.js
const assert = require('node:assert');
const { montarCarteira } = require('../js/carteira.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }
const HOJE = '2026-09-14';

function base() {
    return {
        empresas: [
            { id: 'u1', codigo_empresa: '10', nome_empresa: 'Beta Ltda', cnpj: '12345678000190', regime_enquadramento: 'Simples', status_situacao: 'Ativo' },
            { id: 'u2', codigo_empresa: '20', nome_empresa: 'Alfa ME', cnpj: '98765432000110', regime_enquadramento: 'Presumido', status_situacao: 'Ativo' },
        ],
        fichas: [{ codigo_empresa: '10', status_carteira: 'ativo' }],
        contatos: [{ codigo_empresa: '10', nome: 'Ana', principal: true }],
        respDp: [{ codigo_empresa: '10', usuario_id: 'd1' }],
        usuariosDp: [{ id: 'd1', nome: 'Dora DP' }],
        respContabil: [{ codigo_empresa: '10', usuario_id: 'k1' }],
        usuariosContabil: [{ id: 'k1', nome: 'Caio Contábil' }],
        cfgFolha: [{ codigo_empresa: '10', possui_folha: true }],
        cfgContabil: [{ codigo_empresa: '10', possui_contabil: true }],
        certificados: [{ id: 'c1', cpf_cnpj: '12.345.678/0001-90', situacao: 'Ativo', ativo: true, data_vencimento: '2026-12-31' }],
        licencas: [{ id: 'l1', empresa_id: 'u1', tipo: 'Bombeiros', data_validade: '2026-09-20' }],
        alvaras: [],
        empregados: [
            { codigo_empresa: '10', codigo_empregado: '1', nome_empregado: 'X', situacao: 'Ativo', tipo_empregado: 'Empregado' },
            { codigo_empresa: '10', codigo_empregado: '2', nome_empregado: 'Y', situacao: 'Inativo', tipo_empregado: 'Empregado' },
            { codigo_empresa: '10', codigo_empregado: '3', nome_empregado: 'Z', situacao: 'Ativo', tipo_empregado: 'Estagiário' },
        ],
        socios: [],
        ciclos: [{ codigo_empresa: '10', competencia: '08/2026', concluido_em: '2026-09-05T00:00:00Z', fechamento_ciclo_fase: [] }],
        formularios: [],
        empregadosForm: [],
        onboardings: [],
        mapeamentos: [{ id: 'm1', codigo_empresa: '10', periodicidade: 'mensal', nivel_atencao: 'baixo' }],
        pendencias: [],
        diarioEventos: [{ codigo_empresa: '10', ano: 2026, mes: 8, tipo_evento: 'aprovado', created_at: '2026-09-03T00:00:00Z' }],
        gruposItens: [{ grupo_id: 'g1', codigo_empresa: '10' }],
        grupos: [{ id: 'g1', nome_grupo: 'Grupo Beta' }],
    };
}

teste('monta item com responsáveis, grupo, contagem de ativos e ordena por nome', () => {
    const c = montarCarteira(base(), HOJE);
    assert.deepStrictEqual(c.map(i => i.codigo), ['20', '10']);
    const beta = c.find(i => i.codigo === '10');
    assert.deepStrictEqual(beta.responsaveisDp, ['Dora DP']);
    assert.deepStrictEqual(beta.responsaveisContabil, ['Caio Contábil']);
    assert.strictEqual(beta.grupo, 'Grupo Beta');
    assert.strictEqual(beta.empregadosAtivos, 1);
    assert.strictEqual(beta.certificados.length, 1);
    assert.strictEqual(beta.licencas[0].origem, 'licenca');
});

teste('licença vencendo em 6 dias deixa a empresa vermelha', () => {
    const beta = montarCarteira(base(), HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.semaforo, 'vermelho');
    assert.strictEqual(beta.alertas[0].modulo, 'licenca');
});

teste('empresa sem nada configurado fica verde com infos', () => {
    const alfa = montarCarteira(base(), HOJE).find(i => i.codigo === '20');
    assert.strictEqual(alfa.statusCarteira, 'ativo');
    assert.strictEqual(alfa.possuiFolha, false);
    assert.strictEqual(alfa.semaforo, 'verde');
    assert.ok(alfa.alertas.some(a => a.modulo === 'cadastro'));
    assert.ok(alfa.alertas.some(a => a.modulo === 'certificado' && a.gravidade === 'info'));
});

teste('fonte indisponível (null) não gera alertas daquele módulo', () => {
    const d = base();
    d.licencas = null;
    d.certificados = null;
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.alertas.some(a => a.modulo === 'licenca' || a.modulo === 'certificado'), false);
    assert.strictEqual(beta.semaforo, 'verde');
});

teste('empregados indisponível → empregadosAtivos null e sem QSA', () => {
    const d = base();
    d.empregados = null;
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.empregadosAtivos, null);
    assert.deepStrictEqual(beta.ocorrenciasQsa, []);
});

teste('status inativo vira semáforo inativo', () => {
    const d = base();
    d.fichas[0].status_carteira = 'inativo';
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.semaforo, 'inativo');
});

teste('formulários por rh_empresa_id e QSA ocorrendo agora', () => {
    const d = base();
    d.formularios = [{ id: 'f1', rh_empresa_id: 'u2', status: 'recebido', created_at: '2026-08-01T00:00:00Z' }];
    d.socios = [{ codigo_empresa: '20', nome_socio: 'João', cpf: '11122233344', data_entrada: '2020-01-01', data_saida: null }];
    d.empregados.push({ codigo_empresa: '20', codigo_empregado: '9', nome_empregado: 'João', cpf: '111.222.333-44', situacao: 'Ativo', tipo_empregado: 'Empregado', data_admissao: '2021-01-01', data_demissao: null });
    const alfa = montarCarteira(d, HOJE).find(i => i.codigo === '20');
    assert.strictEqual(alfa.formularios.length, 1);
    assert.strictEqual(alfa.ocorrenciasQsa.length, 1);
    assert.strictEqual(alfa.semaforo, 'vermelho');
});

teste('responsável sem nome resolvido aparece como "(sem nome)"', () => {
    const d = base();
    d.usuariosDp = null;
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.deepStrictEqual(beta.responsaveisDp, ['(sem nome)']);
});

console.log(`\n${n} testes OK`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node "Projeto Ficha 360/tests/carteira.test.js"`
Expected: FAIL — `Cannot find module '../js/carteira.js'`

- [ ] **Step 3: Implementar**

```js
// Projeto Ficha 360/js/carteira.js
/**
 * Ficha 360 — consolida as fontes por empresa e calcula alertas/semáforo.
 * Módulo puro. `dados[chave]` = Array (fonte ok) ou null (fonte indisponível).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./vinculos.js'),
            require('./regras.js'),
            require('../../Projeto RH/qsa-analise.js')
        );
    } else {
        root.Ficha360Carteira = factory(root.Ficha360Vinculos, root.Ficha360Regras, root.QsaAnalise);
    }
})(typeof self !== 'undefined' ? self : this, function (V, R, Qsa) {
    'use strict';

    function montarCarteira(dados, hoje) {
        const ok = (k) => Array.isArray(dados[k]);
        const arr = (k) => (ok(k) ? dados[k] : []);
        const idx = (k, campo) => V.indexarPorCodigo(arr(k), campo);
        const mapaPor = (k, chave, valor) => new Map(arr(k).map(l => [l[chave], valor ? l[valor] : l]));

        const empresas = arr('empresas');
        const codigoPorId = new Map(empresas.map(e => [e.id, e.codigo_empresa]));

        const fichas = mapaPor('fichas', 'codigo_empresa');
        const contatos = idx('contatos');
        const nomesDp = mapaPor('usuariosDp', 'id', 'nome');
        const nomesCont = mapaPor('usuariosContabil', 'id', 'nome');
        const respDp = idx('respDp');
        const respCont = idx('respContabil');
        const cfgFolha = mapaPor('cfgFolha', 'codigo_empresa', 'possui_folha');
        const cfgCont = mapaPor('cfgContabil', 'codigo_empresa', 'possui_contabil');
        const certs = V.vincularCertificados(arr('certificados'), empresas, arr('socios'));

        const licencas = new Map();
        const addLic = (linhas, origem) => {
            for (const l of linhas) {
                const cod = codigoPorId.get(l.empresa_id);
                if (!cod) continue;
                if (!licencas.has(cod)) licencas.set(cod, []);
                licencas.get(cod).push(Object.assign({ origem }, l));
            }
        };
        addLic(arr('licencas'), 'licenca');
        addLic(arr('alvaras'), 'alvara');

        const empregados = idx('empregados');
        const socios = idx('socios');
        const qsaDisponivel = ok('socios') && ok('empregados');
        const ocorrencias = V.indexarPorCodigo(
            qsaDisponivel ? Qsa.computarOcorrencias(arr('socios'), arr('empregados'), [], hoje) : [],
            'empresa'
        );

        const ciclos = idx('ciclos');
        const forms = new Map();
        for (const f of arr('formularios').concat(arr('empregadosForm'))) {
            const cod = codigoPorId.get(f.rh_empresa_id);
            if (!cod) continue;
            if (!forms.has(cod)) forms.set(cod, []);
            forms.get(cod).push(f);
        }

        const onboardings = idx('onboardings');
        const mapeamentos = mapaPor('mapeamentos', 'codigo_empresa');
        const pendencias = idx('pendencias', 'mapeamento_id');
        const diario = idx('diarioEventos');
        const grupoPorCodigo = mapaPor('gruposItens', 'codigo_empresa', 'grupo_id');
        const nomeGrupo = mapaPor('grupos', 'id', 'nome_grupo');

        const nomes = (lista, mapaNomes) => lista.map(r => mapaNomes.get(r.usuario_id) || '(sem nome)');

        const itens = empresas.map(e => {
            const cod = e.codigo_empresa;
            const ficha = fichas.get(cod) || null;
            const statusCarteira = (ficha && ficha.status_carteira) || 'ativo';
            const possuiFolha = cfgFolha.get(cod) === true;
            const possuiContabil = cfgCont.get(cod) === true;
            const listaRespDp = respDp.get(cod) || [];
            const listaRespCont = respCont.get(cod) || [];
            const mapeamento = mapeamentos.get(cod) || null;
            const onboarding = (onboardings.get(cod) || [])
                .slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;

            const item = {
                codigo: cod,
                empresaId: e.id,
                nome: e.nome_empresa || '',
                cnpj: e.cnpj || '',
                regime: e.regime_enquadramento || '',
                uf: e.uf || '',
                cidade: e.cidade || e.municipio || '',
                situacaoDominio: e.status_situacao || '',
                dominio: e,
                ficha,
                statusCarteira,
                possuiFolha,
                possuiContabil,
                responsaveisDp: nomes(listaRespDp, nomesDp),
                responsaveisContabil: nomes(listaRespCont, nomesCont),
                grupo: nomeGrupo.get(grupoPorCodigo.get(cod)) || null,
                empregadosAtivos: ok('empregados')
                    ? (empregados.get(cod) || []).filter(x => (x.tipo_empregado || '').trim() === 'Empregado' && R.empregadoAtivo(x.situacao)).length
                    : null,
                certificados: certs.get(cod) || [],
                licencas: licencas.get(cod) || [],
                socios: socios.get(cod) || [],
                ocorrenciasQsa: ocorrencias.get(cod) || [],
                ciclos: ciclos.get(cod) || [],
                formularios: forms.get(cod) || [],
                onboarding,
                mapeamento,
                pendencias: mapeamento ? (pendencias.get(mapeamento.id) || []) : [],
                diarioEventos: diario.get(cod) || [],
                contatos: contatos.get(cod) || [],
            };

            let alertas = [];
            if (statusCarteira !== 'inativo') {
                if (ok('certificados')) alertas = alertas.concat(R.alertasCertificados(item.certificados, hoje));
                if (ok('licencas') || ok('alvaras')) alertas = alertas.concat(R.alertasLicencas(item.licencas, hoje));
                if (ok('cfgFolha') && ok('ciclos') && ok('respDp')) {
                    alertas = alertas.concat(R.alertasFolha({ possuiFolha, ciclos: item.ciclos, temResponsavel: listaRespDp.length > 0 }, hoje));
                }
                if (qsaDisponivel) alertas = alertas.concat(R.alertasQsa(item.ocorrenciasQsa));
                if (ok('formularios')) alertas = alertas.concat(R.alertasFormularios(item.formularios, hoje));
                if (ok('cfgContabil') && ok('diarioEventos') && ok('respContabil')) {
                    alertas = alertas.concat(R.alertasDiario({
                        possuiContabil,
                        periodicidade: mapeamento && mapeamento.periodicidade,
                        eventos: item.diarioEventos,
                        temResponsavel: listaRespCont.length > 0,
                    }, hoje));
                }
                if (ok('mapeamentos') && ok('pendencias')) alertas = alertas.concat(R.alertasMapeamento({ mapeamento, pendencias: item.pendencias }, hoje));
                if (ok('onboardings')) alertas = alertas.concat(R.alertasOnboarding(onboarding, hoje));
                if (ok('fichas') && ok('contatos')) alertas = alertas.concat(R.alertasCadastro({ ficha, contatos: item.contatos }));
            }
            item.alertas = R.ordenarAlertas(alertas);
            item.semaforo = R.semaforo(item.alertas, statusCarteira);
            return item;
        });

        itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        return itens;
    }

    return { montarCarteira };
});
```

- [ ] **Step 4: Rodar e ver passar (e os anteriores)**

Run: `node "Projeto Ficha 360/tests/carteira.test.js" && node "Projeto Ficha 360/tests/regras.test.js" && node "Projeto Ficha 360/tests/vinculos.test.js"`
Expected: `8 testes OK`, `23 testes OK`, `8 testes OK`

- [ ] **Step 5: Commit**

```bash
git add "Projeto Ficha 360/js/carteira.js" "Projeto Ficha 360/tests/carteira.test.js"
git commit -m "feat(ficha360): consolidação da carteira por empresa com alertas e semáforo"
```

---

### Task 5: `fontes.js` — acesso ao Supabase

**Files:**
- Create: `Projeto Ficha 360/js/fontes.js`
- Test: `Projeto Ficha 360/tests/fontes.test.js`

**Interfaces:**
- Consumes: cliente supabase-js (`sb`), `Ficha360Vinculos.vincularContatosCrm`.
- Produces (global `Ficha360Fontes`):
  - `FONTES` — `{ chave: { tabela, colunas, ordem, filtro?(q, hoje) } }`
  - `classificarErro(error) → 'tabela_ausente'|'sem_permissao'|'erro'|null`
  - `buscarTodos(sb, def, hoje) → Promise<Array>` (lança o erro com `status`)
  - `carregarCarteira(sb, hoje) → Promise<{ dados, falhas }>` — `falhas: { chave: motivo }`
  - `contarJornadaEscala(sb, codigo) → Promise<{ jornada: number|null, escala: number|null }>`
  - `carregarCrm(sb, item) → Promise<{ ok: true, dados: conversa[] } | { ok: false, motivo }>`

- [ ] **Step 1: Escrever o teste (partes puras + paginação com cliente falso)**

```js
// Projeto Ficha 360/tests/fontes.test.js
const assert = require('node:assert');
const F = require('../js/fontes.js');

let n = 0;
async function teste(nome, fn) { await fn(); n++; console.log(`OK  ${nome}`); }

function clienteFalso(linhasPorTabela, erroPorTabela = {}) {
    const chamadas = [];
    return {
        chamadas,
        from(tabela) {
            const estado = { tabela, de: 0, ate: 0 };
            const q = {
                select() { return q; }, order() { return q; }, eq() { return q; }, is() { return q; },
                not() { return q; }, gte() { return q; }, in() { return q; }, limit() { return q; },
                range(de, ate) { estado.de = de; estado.ate = ate; return q; },
                then(resolve) {
                    chamadas.push(`${tabela}:${estado.de}`);
                    if (erroPorTabela[tabela]) return resolve({ data: null, error: erroPorTabela[tabela], status: 400 });
                    const todas = linhasPorTabela[tabela] || [];
                    return resolve({ data: todas.slice(estado.de, estado.ate + 1), error: null, status: 200 });
                },
            };
            return q;
        },
        rpc() { return Promise.resolve({ data: [{ id: 'k1', nome: 'Caio' }], error: null }); },
    };
}

(async () => {
    await teste('classificarErro', () => {
        assert.strictEqual(F.classificarErro(null), null);
        assert.strictEqual(F.classificarErro({ code: '42P01' }), 'tabela_ausente');
        assert.strictEqual(F.classificarErro({ code: 'PGRST205', message: 'Could not find the table' }), 'tabela_ausente');
        assert.strictEqual(F.classificarErro({ code: '42501' }), 'sem_permissao');
        assert.strictEqual(F.classificarErro({ status: 403 }), 'sem_permissao');
        assert.strictEqual(F.classificarErro({ message: 'boom' }), 'erro');
    });

    await teste('buscarTodos pagina de 1000 em 1000', async () => {
        const linhas = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
        const sb = clienteFalso({ t: linhas });
        const res = await F.buscarTodos(sb, { tabela: 't', colunas: 'id', ordem: 'id' }, '2026-09-14');
        assert.strictEqual(res.length, 2500);
        assert.deepStrictEqual(sb.chamadas, ['t:0', 't:1000', 't:2000']);
    });

    await teste('carregarCarteira separa dados e falhas sem derrubar o resto', async () => {
        const sb = clienteFalso(
            { rh_empresas: [{ id: 'u1', codigo_empresa: '1' }] },
            { ficha360_empresa: { code: '42P01', message: 'relation does not exist' } }
        );
        const { dados, falhas } = await F.carregarCarteira(sb, '2026-09-14');
        assert.strictEqual(dados.empresas.length, 1);
        assert.strictEqual(dados.fichas, null);
        assert.strictEqual(falhas.fichas, 'tabela_ausente');
        assert.deepStrictEqual(dados.usuariosContabil, [{ id: 'k1', nome: 'Caio' }]);
        assert.ok(Object.keys(F.FONTES).every(k => k in dados));
    });

    console.log(`\n${n} testes OK`);
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node "Projeto Ficha 360/tests/fontes.test.js"`
Expected: FAIL — `Cannot find module '../js/fontes.js'`

- [ ] **Step 3: Implementar**

```js
// Projeto Ficha 360/js/fontes.js
/**
 * Ficha 360 — acesso ao Supabase. Cada fonte falha isoladamente.
 * Colunas conferidas na Task 0 do plano; ajuste aqui se o schema divergir.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./vinculos.js'));
    } else {
        root.Ficha360Fontes = factory(root.Ficha360Vinculos);
    }
})(typeof self !== 'undefined' ? self : this, function (V) {
    'use strict';

    const TAM_PAGINA = 1000;

    const soAtivosLic = (q) => q.eq('ativo', true).is('deletado_em', null);
    const comEmpresaRh = (q) => q.not('rh_empresa_id', 'is', null);

    const FONTES = {
        empresas:       { tabela: 'rh_empresas', ordem: 'codigo_empresa', colunas: 'id, codigo_empresa, nome_empresa, cnpj, regime_enquadramento, inscricao_estadual, inscricao_municipal, endereco, cidade, municipio, uf, cep, status_situacao, email' },
        fichas:         { tabela: 'ficha360_empresa', ordem: 'codigo_empresa', colunas: '*' },
        contatos:       { tabela: 'ficha360_contatos', ordem: 'id', colunas: '*' },
        respDp:         { tabela: 'fechamento_empresas_responsaveis', ordem: 'id', colunas: 'codigo_empresa, usuario_id' },
        usuariosDp:     { tabela: 'usuarios', ordem: 'id', colunas: 'id, nome' },
        respContabil:   { tabela: 'contabil_empresas_responsaveis', ordem: 'id', colunas: 'codigo_empresa, usuario_id' },
        cfgFolha:       { tabela: 'fechamento_empresas_config', ordem: 'codigo_empresa', colunas: 'codigo_empresa, possui_folha' },
        cfgContabil:    { tabela: 'contabil_empresas_config', ordem: 'codigo_empresa', colunas: 'codigo_empresa, possui_contabil' },
        certificados:   { tabela: 'certificados', ordem: 'id', colunas: 'id, cliente, cpf_cnpj, situacao, data_vencimento, ativo' },
        licencas:       { tabela: 'licencas', ordem: 'id', colunas: 'id, empresa_id, tipo, estabelecimento, numero, data_validade', filtro: soAtivosLic },
        alvaras:        { tabela: 'alvaras', ordem: 'id', colunas: 'id, empresa_id, tipo, estabelecimento, numero, data_validade', filtro: soAtivosLic },
        empregados:     { tabela: 'rh_empregados', ordem: 'id', colunas: 'codigo_empresa, codigo_empregado, nome_empregado, cpf, situacao, tipo_empregado, data_admissao, data_demissao' },
        socios:         { tabela: 'rh_socios', ordem: 'id', colunas: 'codigo_empresa, nome_socio, cpf, data_entrada, data_saida' },
        ciclos:         { tabela: 'fechamento_ciclo', ordem: 'id', colunas: 'id, codigo_empresa, competencia, concluido_em, fechamento_ciclo_fase(nome_fase, status)',
                          filtro: (q, hoje) => q.in('competencia', _competenciasRecentes(hoje)) },
        formularios:    { tabela: 'formularios', ordem: 'id', colunas: 'id, rh_empresa_id, status, created_at', filtro: comEmpresaRh },
        empregadosForm: { tabela: 'empregados', ordem: 'id', colunas: 'id, rh_empresa_id, status, created_at', filtro: comEmpresaRh },
        onboardings:    { tabela: 'contabil_onboardings', ordem: 'id', colunas: 'id, codigo_empresa, status, data_inicio, created_at, contabil_onboarding_itens(status)' },
        mapeamentos:    { tabela: 'contabil_mapeamento', ordem: 'id', colunas: 'id, codigo_empresa, periodicidade, ultimo_mes_fechado, nivel_atencao' },
        pendencias:     { tabela: 'contabil_mapeamento_pendencias', ordem: 'id', colunas: 'id, mapeamento_id, descricao, responsavel, prazo, status' },
        diarioEventos:  { tabela: 'contabil_diario_fechamentos', ordem: 'id', colunas: 'codigo_empresa, ano, mes, tipo_evento, mensagem, created_at',
                          filtro: (q, hoje) => q.gte('ano', Number(hoje.slice(0, 4)) - 1) },
        gruposItens:    { tabela: 'rh_grupos_empresas_itens', ordem: 'id', colunas: 'grupo_id, codigo_empresa' },
        grupos:         { tabela: 'rh_grupos_empresas', ordem: 'id', colunas: 'id, nome_grupo' },
    };

    // Mês passado e mês corrente, formato 'MM/AAAA' (padrão de fechamento_ciclo.competencia)
    function _competenciasRecentes(hoje) {
        const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7));
        const fmt = (m, a) => `${String(m).padStart(2, '0')}/${a}`;
        const antMes = mes === 1 ? 12 : mes - 1;
        const antAno = mes === 1 ? ano - 1 : ano;
        return [fmt(antMes, antAno), fmt(mes, ano)];
    }

    function classificarErro(error) {
        if (!error) return null;
        const code = String(error.code || '');
        const status = Number(error.status || 0);
        const msg = String(error.message || '').toLowerCase();
        if (code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table')) return 'tabela_ausente';
        if (code === '42501' || status === 401 || status === 403 || msg.includes('permission denied')) return 'sem_permissao';
        return 'erro';
    }

    async function buscarTodos(sb, def, hoje) {
        const linhas = [];
        for (let de = 0; ; de += TAM_PAGINA) {
            let q = sb.from(def.tabela).select(def.colunas).order(def.ordem).range(de, de + TAM_PAGINA - 1);
            if (def.filtro) q = def.filtro(q, hoje);
            const res = await q;
            if (res.error) throw Object.assign(res.error, { status: res.status });
            const pagina = res.data || [];
            linhas.push(...pagina);
            if (pagina.length < TAM_PAGINA) break;
        }
        return linhas;
    }

    async function carregarCarteira(sb, hoje) {
        const chaves = Object.keys(FONTES);
        const promessas = chaves.map(k => buscarTodos(sb, FONTES[k], hoje));
        promessas.push(sb.rpc('contabil_listar_usuarios_aprovados').then(res => {
            if (res.error) throw Object.assign(res.error, { status: res.status });
            return res.data || [];
        }));
        const resultados = await Promise.allSettled(promessas);

        const dados = {};
        const falhas = {};
        chaves.concat(['usuariosContabil']).forEach((k, i) => {
            const r = resultados[i];
            if (r.status === 'fulfilled') {
                dados[k] = r.value;
            } else {
                dados[k] = null;
                falhas[k] = classificarErro(r.reason) || 'erro';
                if (typeof console !== 'undefined') console.warn(`[Ficha360] fonte ${k} indisponível`, r.reason);
            }
        });
        return { dados, falhas };
    }

    async function contarJornadaEscala(sb, codigo) {
        const contar = async (tabela) => {
            const { count, error } = await sb.from(tabela).select('id', { count: 'exact', head: true }).eq('codigo_empresa', codigo);
            return error ? null : (count || 0);
        };
        const [jornada, escala] = await Promise.all([contar('rh_jornada_trabalho'), contar('rh_escala_trabalho')]);
        return { jornada, escala };
    }

    let _cacheContatosEmpresas = null;

    async function carregarCrm(sb, item) {
        try {
            if (!_cacheContatosEmpresas) {
                _cacheContatosEmpresas = await buscarTodos(sb, { tabela: 'contatos_empresas', ordem: 'id', colunas: 'contato_id, empresa' });
            }
            const ids = V.vincularContatosCrm(_cacheContatosEmpresas, [{ codigo_empresa: item.codigo, nome_empresa: item.nome }]).get(item.codigo) || [];
            if (!ids.length) return { ok: true, dados: [] };
            const res = await sb.from('conversas')
                .select('id, protocolo, departamento, status, aberto_em, encerrado_em, contatos(nome, telefone)')
                .in('contato_id', ids.slice(0, 100))
                .order('aberto_em', { ascending: false })
                .limit(10);
            if (res.error) throw Object.assign(res.error, { status: res.status });
            return { ok: true, dados: res.data || [] };
        } catch (e) {
            _cacheContatosEmpresas = null;
            return { ok: false, motivo: classificarErro(e) || 'erro' };
        }
    }

    return { FONTES, classificarErro, buscarTodos, carregarCarteira, contarJornadaEscala, carregarCrm };
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node "Projeto Ficha 360/tests/fontes.test.js"`
Expected: `3 testes OK`

- [ ] **Step 5: Commit**

```bash
git add "Projeto Ficha 360/js/fontes.js" "Projeto Ficha 360/tests/fontes.test.js"
git commit -m "feat(ficha360): carregamento paralelo das fontes com paginação e degradação por fonte"
```

---

### Task 6: Página, estilos, bootstrap e Painel da Carteira

**Files:**
- Create: `Projeto Ficha 360/index.html`
- Create: `Projeto Ficha 360/css/ficha360.css`
- Create: `Projeto Ficha 360/js/app.js`
- Create: `Projeto Ficha 360/js/painel.js`

**Interfaces:**
- Consumes: `Ficha360Fontes.carregarCarteira`, `Ficha360Carteira.montarCarteira`, `PortalAuthGuard.init`.
- Produces:
  - `F360.sb`, `F360.auth`, `F360.userId`, `F360.hoje`, `F360.dados`, `F360.falhas`, `F360.carteira`
  - `F360.esc(v) → string`, `F360.fmtData(iso) → 'DD/MM/AAAA'|'—'`, `F360.recalcular()`, `F360.irParaEmpresa(codigo)`, `F360.irParaPainel()`, `F360.NOMES_FONTE`, `F360.ROTULO_SEMAFORO`
  - `Ficha360Painel.render()`
  - Contrato usado pela Task 7: `Ficha360Ficha.abrir(codigo)`

- [ ] **Step 1: Criar `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ficha 360 do Cliente — Scont</title>
  <link rel="icon" type="image/x-icon" href="../assets/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/favicon-32x32.png" />
  <link rel="stylesheet" href="css/ficha360.css" />
  <script src="../supabase-config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="../portal-auth-guard.js"></script>
</head>
<body>
<div id="authOverlay" style="position:fixed;inset:0;background:#F0F2F5;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;">
  <div style="font-size:40px;">🔐</div>
  <p style="font-family:sans-serif;color:#8B3A3A;font-weight:600;font-size:15px;">Verificando acesso...</p>
</div>

<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <img src="https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png" alt="SCONT">
      <h1>Ficha 360</h1>
      <p>Visão única do cliente</p>
    </div>
    <nav class="menu">
      <button class="menu-item" id="menuPainel">📊 <span>Painel da Carteira</span></button>
    </nav>
    <div class="sidebar-footer">
      <button class="btn-voltar" onclick="window.location.href='../portal.html'">🏠 <span>Voltar ao Portal</span></button>
    </div>
  </aside>

  <main class="main">
    <div id="avisoFontes" class="aviso-fontes" hidden></div>
    <div id="carregando" class="carregando" hidden>Carregando carteira…</div>
    <section id="telaPainel" hidden></section>
    <section id="telaFicha" hidden></section>
  </main>
</div>

<script src="../Projeto RH/qsa-analise.js"></script>
<script src="../Projeto Onboarding Contabil/contabil-diario-util.js"></script>
<script src="js/vinculos.js"></script>
<script src="js/regras.js"></script>
<script src="js/carteira.js"></script>
<script src="js/fontes.js"></script>
<script src="js/app.js"></script>
<script src="js/painel.js"></script>
<script src="js/cadastro.js"></script>
<script src="js/anotacoes.js"></script>
<script src="js/ficha.js"></script>
</body>
</html>
```

- [ ] **Step 2: Criar `css/ficha360.css`**

```css
:root{
  --primary:#8B3A3A; --primary-dark:#6B2A2A; --primary-light:#A85252; --primary-soft:#f5ecec;
  --secondary:#2C3E50; --bg:#F0F2F5; --surface:#fff; --border:#E0E6ED; --muted:#5A6C7D;
  --success:#27AE60; --success-soft:#e7f7ef; --danger:#E74C3C; --danger-soft:#fde7e5;
  --warning:#E67E22; --warning-soft:#fdf1e6; --info:#3498DB; --info-soft:#eaf1ff; --inativo:#95A5A6;
  --radius:14px; --shadow:0 10px 24px rgba(15,23,42,.06); --sidebar:260px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Inter,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--secondary);background:var(--bg);min-height:100vh}
button,input,select,textarea{font:inherit}
[hidden]{display:none!important}

.app{display:flex;min-height:100vh}
.sidebar{width:var(--sidebar);flex-shrink:0;background:linear-gradient(135deg,#8B3A3A 0%,#2C3E50 100%);color:#fff;display:flex;flex-direction:column;padding:24px 16px;position:sticky;top:0;height:100vh}
.brand img{width:140px;background:#fff;border-radius:10px;padding:6px 10px}
.brand h1{font-size:20px;margin:14px 0 2px}
.brand p{margin:0;opacity:.8;font-size:13px}
.menu{margin-top:28px;display:flex;flex-direction:column;gap:6px}
.menu-item,.btn-voltar{background:rgba(255,255,255,.12);border:0;color:#fff;padding:10px 12px;border-radius:10px;text-align:left;cursor:pointer}
.menu-item:hover,.btn-voltar:hover{background:rgba(255,255,255,.22)}
.sidebar-footer{margin-top:auto}
.btn-voltar{width:100%}
.main{flex:1;min-width:0;padding:24px 28px}

.aviso-fontes{background:var(--warning-soft);color:#8a4b0f;border:1px solid #f3cfa6;padding:10px 14px;border-radius:10px;margin-bottom:14px;font-size:13px}
.carregando{padding:40px;text-align:center;color:var(--muted)}

.cabecalho-tela{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.cabecalho-tela h2{margin:0;font-size:22px}
.btn{border:1px solid var(--border);background:var(--surface);color:var(--secondary);padding:8px 14px;border-radius:10px;cursor:pointer}
.btn:hover{border-color:var(--primary-light)}
.btn-primario{background:var(--primary);border-color:var(--primary);color:#fff}
.btn-primario:hover{background:var(--primary-dark)}
.btn-perigo{color:var(--danger)}
.btn-mini{padding:4px 8px;font-size:12px}

.contadores{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}
.contador{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow);cursor:pointer}
.contador strong{display:block;font-size:26px}
.contador span{font-size:13px;color:var(--muted)}
.contador.ativo{outline:2px solid var(--primary)}

.filtros{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}
.filtros input[type=search]{flex:1;min-width:220px}
.filtros input,.filtros select{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:#fff}
.filtros label{font-size:13px;display:flex;gap:6px;align-items:center}

.tabela-wrap{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:auto;box-shadow:var(--shadow)}
table.tabela{width:100%;border-collapse:collapse;font-size:13px}
.tabela th{background:#f8f9fb;text-align:left;padding:10px;border-bottom:1px solid var(--border);position:sticky;top:0}
.tabela td{padding:9px 10px;border-bottom:1px solid #edf0f5;vertical-align:top}
.tabela tbody tr.clicavel{cursor:pointer}
.tabela tbody tr.clicavel:hover{background:var(--primary-soft)}
.vazio{padding:24px;text-align:center;color:var(--muted)}

.sem{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:middle}
.sem-vermelho{background:var(--danger)} .sem-amarelo{background:var(--warning)} .sem-verde{background:var(--success)} .sem-inativo{background:var(--inativo)}
.chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;margin:1px 2px 1px 0;white-space:nowrap}
.chip-critico{background:var(--danger-soft);color:#a8281b} .chip-atencao{background:var(--warning-soft);color:#8a4b0f} .chip-info{background:var(--info-soft);color:#1f5f99}
.chip-neutro{background:#eef1f5;color:var(--muted)}

.ficha-cab{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow);position:sticky;top:0;z-index:5;margin-bottom:12px}
.ficha-cab h2{margin:0;font-size:20px;display:flex;align-items:center;gap:10px}
.ficha-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--muted);margin-top:6px}
.atalhos{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.abas{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0 14px;border-bottom:1px solid var(--border)}
.aba{background:none;border:0;padding:10px 14px;cursor:pointer;color:var(--muted);border-bottom:3px solid transparent}
.aba.ativa{color:var(--primary);border-bottom-color:var(--primary);font-weight:600}

.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.cartao{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;box-shadow:var(--shadow)}
.cartao h3{margin:0 0 8px;font-size:14px;color:var(--muted);font-weight:600}
.cartao .numero{font-size:24px;font-weight:700}
.lista-alertas{list-style:none;margin:0;padding:0}
.lista-alertas li{padding:8px 0;border-bottom:1px solid #edf0f5;display:flex;gap:8px;align-items:center;font-size:13px}
.bloqueado{color:var(--muted);font-style:italic}

.form-grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.campo{display:flex;flex-direction:column;gap:4px;font-size:13px}
.campo input,.campo select,.campo textarea{border:1px solid var(--border);border-radius:10px;padding:8px 10px;background:#fff}
.campo textarea{min-height:70px;resize:vertical}
.campo-ro{background:#f8f9fb;border:1px solid var(--border);border-radius:10px;padding:8px 10px;min-height:36px}
.checks{display:flex;gap:14px;flex-wrap:wrap;font-size:13px}
.acoes{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}

.anotacao{border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:#fff}
.anotacao.fixada{border-color:var(--primary-light);background:var(--primary-soft)}
.anotacao-meta{font-size:12px;color:var(--muted);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.anotacao-texto{white-space:pre-wrap;margin:6px 0 4px;font-size:14px}

@media (max-width: 900px){
  .app{flex-direction:column}
  .sidebar{width:100%;height:auto;position:static}
  .main{padding:16px}
}
```

- [ ] **Step 3: Criar `js/app.js`**

```js
// Projeto Ficha 360/js/app.js
window.F360 = {
    sb: null, auth: null, userId: null, hoje: null,
    dados: null, falhas: {}, carteira: [],

    NOMES_FONTE: {
        empresas: 'Empresas', fichas: 'Cadastro Scont', contatos: 'Contatos', respDp: 'Responsáveis DP',
        usuariosDp: 'Usuários DP', respContabil: 'Responsáveis Contábil', usuariosContabil: 'Usuários Contábil',
        cfgFolha: 'Config. Folha', cfgContabil: 'Config. Contábil', certificados: 'Certificados',
        licencas: 'Licenças', alvaras: 'Alvarás', empregados: 'Empregados', socios: 'Sócios',
        ciclos: 'Fechamento da Folha', formularios: 'Formulários', empregadosForm: 'Formulários de empregado',
        onboardings: 'Onboarding', mapeamentos: 'Mapeamento', pendencias: 'Pendências do Mapeamento',
        diarioEventos: 'Diário Contábil', gruposItens: 'Grupos', grupos: 'Grupos',
    },
    ROTULO_SEMAFORO: { vermelho: 'Crítico', amarelo: 'Atenção', verde: 'OK', inativo: 'Inativa' },
    ROTULO_STATUS: { ativo: 'Ativo', em_implantacao: 'Em implantação', em_saida: 'Em saída', inativo: 'Inativo' },

    esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    fmtData(iso) {
        if (!iso) return '—';
        const [a, m, d] = String(iso).slice(0, 10).split('-');
        return d && m && a ? `${d}/${m}/${a}` : '—';
    },
    semaforoHtml(s) {
        return `<span class="sem sem-${s}" title="${F360.ROTULO_SEMAFORO[s] || ''}"></span>`;
    },
    chipAlerta(a) {
        return `<span class="chip chip-${a.gravidade}">${F360.esc(a.mensagem)}</span>`;
    },

    async carregar() {
        const carregando = document.getElementById('carregando');
        carregando.hidden = false;
        const { dados, falhas } = await Ficha360Fontes.carregarCarteira(F360.sb, F360.hoje);
        carregando.hidden = true;
        F360.dados = dados;
        F360.falhas = falhas;
        if (!dados.empresas) {
            document.getElementById('telaPainel').hidden = false;
            document.getElementById('telaPainel').innerHTML =
                `<div class="cartao vazio">Não foi possível carregar as empresas (${F360.esc(falhas.empresas)}). Tente novamente mais tarde.</div>`;
            return false;
        }
        F360.recalcular();
        F360.renderAvisoFontes();
        return true;
    },

    recalcular() {
        F360.carteira = Ficha360Carteira.montarCarteira(F360.dados, F360.hoje);
    },

    renderAvisoFontes() {
        const el = document.getElementById('avisoFontes');
        const ignorar = ['fichas', 'contatos']; // tratados como "configuração pendente" nas abas
        const nomes = [...new Set(Object.keys(F360.falhas).filter(k => !ignorar.includes(k)).map(k => F360.NOMES_FONTE[k] || k))];
        const sqlPendente = F360.falhas.fichas === 'tabela_ausente' || F360.falhas.contatos === 'tabela_ausente';
        const partes = [];
        if (nomes.length) partes.push(`⚠️ Indisponível: ${F360.esc(nomes.join(', '))} — alertas incompletos.`);
        if (sqlPendente) partes.push('🛠️ Configuração pendente: o SQL da Ficha 360 ainda não foi executado (cadastro, contatos e anotações desativados).');
        el.innerHTML = partes.join('<br>');
        el.hidden = partes.length === 0;
    },

    irParaEmpresa(codigo) {
        history.pushState({}, '', `?empresa=${encodeURIComponent(codigo)}`);
        F360.rotear();
    },
    irParaPainel() {
        history.pushState({}, '', window.location.pathname);
        F360.rotear();
    },
    rotear() {
        const codigo = new URLSearchParams(window.location.search).get('empresa');
        document.getElementById('telaPainel').hidden = !!codigo;
        document.getElementById('telaFicha').hidden = !codigo;
        window.scrollTo(0, 0);
        if (codigo) Ficha360Ficha.abrir(codigo);
        else Ficha360Painel.render();
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;

    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    if (!auth.isAdmin && empresaUsuario === 'prestador de serviço') {
        window.location.replace('../portal.html');
        return;
    }

    F360.auth = auth;
    F360.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    F360.hoje = F360.hojeISO();
    const { data } = await F360.sb.auth.getUser();
    F360.userId = data?.user?.id || null;

    document.getElementById('authOverlay')?.remove();
    document.getElementById('menuPainel').addEventListener('click', () => F360.irParaPainel());
    window.addEventListener('popstate', () => F360.rotear());

    if (await F360.carregar()) F360.rotear();
});
```

- [ ] **Step 4: Criar `js/painel.js`**

```js
// Projeto Ficha 360/js/painel.js
window.Ficha360Painel = (function () {
    'use strict';

    const filtros = { busca: '', responsavel: '', regime: '', status: '', depto: '', semaforo: '', inativas: false };

    function deptoContratado(item, depto) {
        const f = item.ficha || {};
        return {
            folha: item.possuiFolha, contabil: item.possuiContabil,
            fiscal: !!f.atende_fiscal, societario: !!f.atende_societario, bpo: !!f.atende_bpo,
        }[depto];
    }

    function aplicarFiltros(itens) {
        const busca = filtros.busca.trim().toLowerCase();
        return itens.filter(i => {
            if (!filtros.inativas && i.statusCarteira === 'inativo' && filtros.status !== 'inativo') return false;
            if (busca && !(`${i.codigo} ${i.nome} ${i.cnpj}`.toLowerCase().includes(busca))) return false;
            if (filtros.responsavel && !i.responsaveisDp.concat(i.responsaveisContabil).includes(filtros.responsavel)) return false;
            if (filtros.regime && i.regime !== filtros.regime) return false;
            if (filtros.status && i.statusCarteira !== filtros.status) return false;
            if (filtros.depto && !deptoContratado(i, filtros.depto)) return false;
            if (filtros.semaforo === 'sem_responsavel') {
                const semDp = i.possuiFolha && i.responsaveisDp.length === 0;
                const semCont = i.possuiContabil && i.responsaveisContabil.length === 0;
                if (!semDp && !semCont) return false;
            } else if (filtros.semaforo && i.semaforo !== filtros.semaforo) {
                return false;
            }
            return true;
        });
    }

    function opcoes(valores, selecionado, rotulo) {
        const unicos = [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        return `<option value="">${rotulo}</option>` + unicos.map(v =>
            `<option value="${F360.esc(v)}" ${v === selecionado ? 'selected' : ''}>${F360.esc(v)}</option>`).join('');
    }

    function render() {
        const tela = document.getElementById('telaPainel');
        const todos = F360.carteira;
        const ativos = todos.filter(i => i.statusCarteira !== 'inativo');
        const conta = (fn) => ativos.filter(fn).length;
        const semResp = conta(i => (i.possuiFolha && !i.responsaveisDp.length) || (i.possuiContabil && !i.responsaveisContabil.length));

        const contador = (valor, rotulo, chave) =>
            `<div class="contador ${filtros.semaforo === chave ? 'ativo' : ''}" data-semaforo="${chave}"><strong>${valor}</strong><span>${rotulo}</span></div>`;

        const statusOpts = Object.entries(F360.ROTULO_STATUS).map(([k, v]) =>
            `<option value="${k}" ${filtros.status === k ? 'selected' : ''}>${v}</option>`).join('');
        const deptoOpts = [['folha', 'DP / Folha'], ['contabil', 'Contábil'], ['fiscal', 'Fiscal'], ['societario', 'Societário'], ['bpo', 'BPO']]
            .map(([k, v]) => `<option value="${k}" ${filtros.depto === k ? 'selected' : ''}>${v}</option>`).join('');

        tela.innerHTML = `
          <div class="cabecalho-tela">
            <h2>Painel da Carteira</h2>
            <button class="btn" id="btnAtualizar">🔄 Atualizar</button>
          </div>
          <div class="contadores">
            ${contador(ativos.length, 'Empresas ativas', '')}
            ${contador(conta(i => i.semaforo === 'vermelho'), '🔴 Críticas', 'vermelho')}
            ${contador(conta(i => i.semaforo === 'amarelo'), '🟡 Atenção', 'amarelo')}
            ${contador(semResp, 'Sem responsável definido', 'sem_responsavel')}
          </div>
          <div class="filtros">
            <input type="search" id="fBusca" placeholder="Buscar por código, nome ou CNPJ" value="${F360.esc(filtros.busca)}">
            <select id="fResp">${opcoes(todos.flatMap(i => i.responsaveisDp.concat(i.responsaveisContabil)), filtros.responsavel, 'Responsável')}</select>
            <select id="fRegime">${opcoes(todos.map(i => i.regime), filtros.regime, 'Regime')}</select>
            <select id="fStatus"><option value="">Status na carteira</option>${statusOpts}</select>
            <select id="fDepto"><option value="">Departamento</option>${deptoOpts}</select>
            <label><input type="checkbox" id="fInativas" ${filtros.inativas ? 'checked' : ''}> Mostrar inativas</label>
          </div>
          <div class="tabela-wrap" id="tabelaCarteira"></div>`;

        renderTabela();
        ligarEventos(tela);
    }

    function renderTabela() {
        const lista = aplicarFiltros(F360.carteira);
        const wrap = document.getElementById('tabelaCarteira');
        if (!lista.length) {
            wrap.innerHTML = '<div class="vazio">Nenhuma empresa encontrada com esses filtros.</div>';
            return;
        }
        const linhas = lista.map(i => {
            const visiveis = i.alertas.filter(a => a.gravidade !== 'info');
            const chips = visiveis.slice(0, 3).map(F360.chipAlerta).join('') +
                (visiveis.length > 3 ? `<span class="chip chip-neutro">+${visiveis.length - 3}</span>` : '');
            const resp = [
                i.responsaveisDp.length ? `DP: ${F360.esc(i.responsaveisDp.join(', '))}` : '',
                i.responsaveisContabil.length ? `Cont.: ${F360.esc(i.responsaveisContabil.join(', '))}` : '',
            ].filter(Boolean).join('<br>') || '<span class="bloqueado">—</span>';
            return `<tr class="clicavel" data-codigo="${F360.esc(i.codigo)}">
                <td>${F360.semaforoHtml(i.semaforo)}</td>
                <td>${F360.esc(i.codigo)}</td>
                <td><strong>${F360.esc(i.nome)}</strong>${i.grupo ? `<br><span class="chip chip-neutro">${F360.esc(i.grupo)}</span>` : ''}</td>
                <td>${F360.esc(i.regime) || '—'}</td>
                <td>${resp}</td>
                <td>${i.empregadosAtivos == null ? '—' : i.empregadosAtivos}</td>
                <td>${chips || '<span class="bloqueado">Sem alertas</span>'}</td>
            </tr>`;
        }).join('');
        wrap.innerHTML = `<table class="tabela">
            <thead><tr><th></th><th>Código</th><th>Empresa</th><th>Regime</th><th>Responsáveis</th><th>Empreg. ativos</th><th>Alertas</th></tr></thead>
            <tbody>${linhas}</tbody></table>
            <div class="vazio" style="text-align:right;padding:8px 12px">${lista.length} empresa(s)</div>`;
        wrap.querySelectorAll('tr.clicavel').forEach(tr =>
            tr.addEventListener('click', () => F360.irParaEmpresa(tr.dataset.codigo)));
    }

    function ligarEventos(tela) {
        const bind = (id, evento, chave, valor) =>
            document.getElementById(id).addEventListener(evento, (e) => { filtros[chave] = valor(e.target); renderTabela(); });
        bind('fBusca', 'input', 'busca', el => el.value);
        bind('fResp', 'change', 'responsavel', el => el.value);
        bind('fRegime', 'change', 'regime', el => el.value);
        bind('fStatus', 'change', 'status', el => el.value);
        bind('fDepto', 'change', 'depto', el => el.value);
        bind('fInativas', 'change', 'inativas', el => el.checked);
        tela.querySelectorAll('.contador').forEach(c => c.addEventListener('click', () => {
            filtros.semaforo = filtros.semaforo === c.dataset.semaforo ? '' : c.dataset.semaforo;
            render();
        }));
        document.getElementById('btnAtualizar').addEventListener('click', async () => {
            if (await F360.carregar()) render();
        });
    }

    return { render };
})();
```

- [ ] **Step 5: Criar stubs temporários para a página abrir**

Criar `js/ficha.js`, `js/cadastro.js`, `js/anotacoes.js` com o mínimo (substituídos nas Tasks 7–9):

```js
// Projeto Ficha 360/js/ficha.js (stub — Task 7 substitui)
window.Ficha360Ficha = { abrir(codigo) { document.getElementById('telaFicha').innerHTML = `<div class="cartao">Ficha ${F360.esc(codigo)} — em construção <button class="btn" onclick="F360.irParaPainel()">Voltar</button></div>`; } };
```
```js
// Projeto Ficha 360/js/cadastro.js (stub — Task 8 substitui)
window.Ficha360Cadastro = { render() {} };
```
```js
// Projeto Ficha 360/js/anotacoes.js (stub — Task 9 substitui)
window.Ficha360Anotacoes = { render() {} };
```

- [ ] **Step 6: Verificar no navegador**

Servir a raiz do repo: `npx --yes http-server "C:/Users/Herbert G L J/Desktop/Projetos HTML/Projeto Portal Scont" -p 5510 -c-1` (background) e abrir `http://localhost:5510/login.html`, logar como admin, acessar `http://localhost:5510/Projeto%20Ficha%20360/index.html`.

Verificar:
- Painel carrega com contadores e tabela; console sem erros de `ReferenceError`.
- Se o SQL da Task 1 ainda não rodou: faixa "Configuração pendente" aparece e o painel funciona.
- Filtros (busca, regime, status, depto, contadores) alteram a tabela.
- Clique numa linha muda a URL para `?empresa=<codigo>` e mostra o stub; "Voltar" e o botão Voltar do navegador retornam ao painel.

- [ ] **Step 7: Commit**

```bash
git add "Projeto Ficha 360/index.html" "Projeto Ficha 360/css/ficha360.css" "Projeto Ficha 360/js/app.js" "Projeto Ficha 360/js/painel.js" "Projeto Ficha 360/js/ficha.js" "Projeto Ficha 360/js/cadastro.js" "Projeto Ficha 360/js/anotacoes.js"
git commit -m "feat(ficha360): página, bootstrap com auth e painel da carteira"
```

---

### Task 7: Ficha da empresa — cabeçalho e abas Resumo, Vencimentos, DP, Contábil, CRM

**Files:**
- Modify (substituir stub): `Projeto Ficha 360/js/ficha.js`

**Interfaces:**
- Consumes: `F360.*` (Task 6), `Ficha360Regras.diasAte`, `Ficha360Fontes.contarJornadaEscala`, `Ficha360Fontes.carregarCrm`, `ContabilDiarioUtil.descricaoPeriodo`, `Ficha360Cadastro.render(container, item)` (Task 8), `Ficha360Anotacoes.render(container, item)` (Task 9).
- Produces: `Ficha360Ficha.abrir(codigo)`, `Ficha360Ficha.reabrir()` (re-renderiza a mesma empresa mantendo a aba — usado pela Task 8).

- [ ] **Step 1: Substituir `js/ficha.js`**

```js
// Projeto Ficha 360/js/ficha.js
window.Ficha360Ficha = (function () {
    'use strict';

    const ABAS = [
        ['resumo', 'Resumo'], ['cadastro', 'Cadastro'], ['vencimentos', 'Vencimentos'],
        ['dp', 'DP'], ['contabil', 'Contábil'], ['anotacoes', 'Anotações'], ['crm', 'CRM'],
    ];
    const NOME_MODULO = {
        certificado: 'Certificado', licenca: 'Licenças', folha: 'Folha', qsa: 'QSA', formularios: 'Formulários',
        diario: 'Diário', mapeamento: 'Mapeamento', onboarding: 'Onboarding', cadastro: 'Cadastro',
    };
    const FONTES_POR_ABA = {
        vencimentos: ['certificados', 'licencas', 'alvaras'],
        dp: ['empregados', 'socios', 'ciclos', 'formularios', 'cfgFolha', 'respDp'],
        contabil: ['cfgContabil', 'onboardings', 'mapeamentos', 'pendencias', 'diarioEventos', 'respContabil'],
    };

    let codigoAtual = null;
    let abaAtual = 'resumo';

    const esc = (v) => F360.esc(v);
    const item = () => F360.carteira.find(i => i.codigo === codigoAtual);

    function avisoFontes(aba) {
        const falhas = (FONTES_POR_ABA[aba] || []).filter(k => F360.falhas[k]);
        if (!falhas.length) return '';
        return `<div class="aviso-fontes">${falhas.map(k =>
            `${F360.falhas[k] === 'sem_permissao' ? '🔒 Sem permissão' : '⚠️ Indisponível'}: ${esc(F360.NOMES_FONTE[k] || k)}`).join(' · ')}</div>`;
    }

    function abrir(codigo) {
        if (codigo !== codigoAtual) abaAtual = 'resumo';
        codigoAtual = codigo;
        const tela = document.getElementById('telaFicha');
        const it = item();
        if (!it) {
            tela.innerHTML = `<div class="cartao vazio">Empresa <strong>${esc(codigo)}</strong> não encontrada.<br><br>
                <button class="btn btn-primario" id="btnVoltarErro">Voltar ao painel</button></div>`;
            document.getElementById('btnVoltarErro').addEventListener('click', () => F360.irParaPainel());
            return;
        }
        const cod = encodeURIComponent(it.codigo);
        const atalhos = [
            ['📔 Diário', `../Projeto Onboarding Contabil/diario.html?empresa=${cod}`],
            ['📜 Licenças', `../Projeto Licenças/index.html?empresa=${cod}`],
            ['🔑 Certificado', `../Projeto Certificado Digital/index.html?empresa=${cod}`],
            ['⏱️ Controle de Frequência', `../Projeto RH/admin.html?empresa=${cod}`],
            ['✅ Fechamento', `../Projeto Fechamento Folha/controle.html?empresa=${cod}`],
        ].map(([r, href]) => `<a class="btn btn-mini" href="${href}" target="_blank" rel="noopener">${r}</a>`).join('');

        tela.innerHTML = `
          <div class="ficha-cab">
            <button class="btn btn-mini" id="btnVoltar">← Painel</button>
            <h2 style="margin-top:8px">${F360.semaforoHtml(it.semaforo)} ${esc(it.nome)}</h2>
            <div class="ficha-meta">
              <span>Código <strong>${esc(it.codigo)}</strong></span>
              <span>CNPJ <strong>${esc(it.cnpj) || '—'}</strong></span>
              <span>Regime <strong>${esc(it.regime) || '—'}</strong></span>
              <span>Carteira <strong>${esc(F360.ROTULO_STATUS[it.statusCarteira] || it.statusCarteira)}</strong></span>
              <span>DP <strong>${esc(it.responsaveisDp.join(', ')) || '—'}</strong></span>
              <span>Contábil <strong>${esc(it.responsaveisContabil.join(', ')) || '—'}</strong></span>
              ${it.grupo ? `<span>Grupo <strong>${esc(it.grupo)}</strong></span>` : ''}
            </div>
            <div class="atalhos">${atalhos}</div>
          </div>
          <div class="abas">${ABAS.map(([k, r]) => `<button class="aba ${k === abaAtual ? 'ativa' : ''}" data-aba="${k}">${r}</button>`).join('')}</div>
          <div id="conteudoAba"></div>`;

        document.getElementById('btnVoltar').addEventListener('click', () => F360.irParaPainel());
        tela.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => {
            abaAtual = b.dataset.aba;
            tela.querySelectorAll('.aba').forEach(x => x.classList.toggle('ativa', x === b));
            renderAba();
        }));
        renderAba();
    }

    function reabrir() {
        if (codigoAtual) abrir(codigoAtual);
    }

    function renderAba() {
        const el = document.getElementById('conteudoAba');
        const it = item();
        const render = {
            resumo: renderResumo, vencimentos: renderVencimentos, dp: renderDp, contabil: renderContabil, crm: renderCrm,
            cadastro: (c, i) => Ficha360Cadastro.render(c, i),
            anotacoes: (c, i) => Ficha360Anotacoes.render(c, i),
        }[abaAtual];
        el.innerHTML = '';
        render(el, it);
    }

    function renderResumo(el, it) {
        const vencProx = it.certificados.concat(it.licencas)
            .map(x => Ficha360Regras.diasAte(x.data_vencimento || x.data_validade, F360.hoje))
            .filter(d => d !== null).sort((a, b) => a - b)[0];
        const ultimoCiclo = it.ciclos.slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)))[0];
        const pendAbertas = it.pendencias.filter(p => p.status === 'aberta').length;
        const cartao = (titulo, numero, sub) =>
            `<div class="cartao"><h3>${titulo}</h3><div class="numero">${numero}</div><div class="bloqueado">${sub || ''}</div></div>`;

        el.innerHTML = `
          <div class="grade">
            ${cartao('Empregados ativos', it.empregadosAtivos == null ? '—' : it.empregadosAtivos, `${it.socios.length} sócio(s)`)}
            ${cartao('Próximo vencimento', vencProx == null ? '—' : (vencProx < 0 ? `vencido ${-vencProx}d` : `${vencProx}d`), `${it.certificados.length} cert. · ${it.licencas.length} lic./alv.`)}
            ${cartao('Folha', it.possuiFolha ? (ultimoCiclo ? esc(ultimoCiclo.competencia) : 'sem ciclo') : 'não contratada', ultimoCiclo ? (ultimoCiclo.concluido_em ? 'concluída' : 'em andamento') : '')}
            ${cartao('Contábil', it.possuiContabil ? esc((it.mapeamento && it.mapeamento.nivel_atencao) || 'sem mapeamento') : 'não contratado', `${pendAbertas} pendência(s) aberta(s)`)}
          </div>
          <div class="cartao" style="margin-top:12px">
            <h3>Alertas (${it.alertas.length})</h3>
            ${it.alertas.length ? `<ul class="lista-alertas">${it.alertas.map(a =>
                `<li><span class="chip chip-${a.gravidade}">${esc(NOME_MODULO[a.modulo] || a.modulo)}</span>${esc(a.mensagem)}</li>`).join('')}</ul>`
                : '<div class="bloqueado">Nenhum alerta.</div>'}
          </div>`;
    }

    function linhaDias(dataISO) {
        const d = Ficha360Regras.diasAte(dataISO, F360.hoje);
        if (d === null) return '—';
        const g = d < 0 ? 'critico' : d <= 30 ? 'atencao' : 'info';
        return `<span class="chip chip-${g}">${d < 0 ? `vencido há ${-d}d` : `${d}d`}</span>`;
    }

    function renderVencimentos(el, it) {
        const certs = it.certificados.map(c => `<tr>
            <td>${esc(c.cliente) || '—'}</td><td>${esc(c.cpf_cnpj) || '—'}</td><td>${esc(c.situacao) || '—'}</td>
            <td>${F360.fmtData(c.data_vencimento)}</td><td>${linhaDias(c.data_vencimento)}</td></tr>`).join('');
        const lics = it.licencas.slice().sort((a, b) => String(a.data_validade).localeCompare(String(b.data_validade))).map(l => `<tr>
            <td>${l.origem === 'alvara' ? 'Alvará' : 'Licença'}</td><td>${esc(l.tipo) || '—'}</td><td>${esc(l.estabelecimento) || '—'}</td>
            <td>${F360.fmtData(l.data_validade)}</td><td>${linhaDias(l.data_validade)}</td></tr>`).join('');
        el.innerHTML = `${avisoFontes('vencimentos')}
          <div class="cartao"><h3>Certificados digitais</h3>
            ${certs ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Titular</th><th>CPF/CNPJ</th><th>Situação</th><th>Vencimento</th><th>Prazo</th></tr></thead><tbody>${certs}</tbody></table></div>`
                : '<div class="bloqueado">Nenhum certificado vinculado (vínculo por CNPJ da empresa ou CPF dos sócios).</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Licenças e alvarás</h3>
            ${lics ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Tipo</th><th>Descrição</th><th>Estabelecimento</th><th>Validade</th><th>Prazo</th></tr></thead><tbody>${lics}</tbody></table></div>`
                : '<div class="bloqueado">Nenhuma licença ou alvará ativo.</div>'}
          </div>`;
    }

    async function renderDp(el, it) {
        const ciclos = it.ciclos.slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
        const ciclosHtml = ciclos.map(c => {
            const fases = c.fechamento_ciclo_fase || [];
            const pend = fases.filter(f => f.status !== 'concluida');
            return `<li><strong>${esc(c.competencia)}</strong> — ${c.concluido_em ? `concluída em ${F360.fmtData(c.concluido_em)}` : `${pend.length}/${fases.length} fase(s) pendente(s)${pend.length ? ': ' + esc(pend.map(f => f.nome_fase).join(', ')) : ''}`}</li>`;
        }).join('');
        const qsa = it.ocorrenciasQsa.map(o => `<li><span class="chip chip-${o.ocorrendo_agora ? 'critico' : 'atencao'}">${o.ocorrendo_agora ? 'agora' : 'histórico'}</span>
            ${esc(o.nome_socio)} × empregado ${esc(o.codigo_empregado)} (${esc(o.tipo_match)})</li>`).join('');
        const abertos = it.formularios.filter(f => !['validado', 'rejeitado', 'excluido'].includes(f.status));

        el.innerHTML = `${avisoFontes('dp')}
          <div class="grade">
            <div class="cartao"><h3>Folha contratada</h3><div class="numero">${it.possuiFolha ? 'Sim' : 'Não'}</div></div>
            <div class="cartao"><h3>Empregados ativos</h3><div class="numero">${it.empregadosAtivos == null ? '—' : it.empregadosAtivos}</div></div>
            <div class="cartao"><h3>Formulários em aberto</h3><div class="numero">${abertos.length}</div></div>
            <div class="cartao"><h3>Jornada / Escala</h3><div class="numero" id="jornadaEscala">…</div></div>
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Fechamento da folha (mês passado e atual)</h3>
            ${ciclosHtml ? `<ul class="lista-alertas">${ciclosHtml}</ul>` : '<div class="bloqueado">Nenhum ciclo nas competências recentes.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Sócios (${it.socios.length})</h3>
            ${it.socios.length ? `<ul class="lista-alertas">${it.socios.map(s => `<li>${esc(s.nome_socio)} — entrada ${F360.fmtData(s.data_entrada)}${s.data_saida ? ` · saída ${F360.fmtData(s.data_saida)}` : ''}</li>`).join('')}</ul>` : '<div class="bloqueado">Nenhum sócio importado.</div>'}
            ${qsa ? `<h3 style="margin-top:12px">Análise do QSA</h3><ul class="lista-alertas">${qsa}</ul>` : ''}
          </div>`;

        const { jornada, escala } = await Ficha360Fontes.contarJornadaEscala(F360.sb, it.codigo);
        const alvo = document.getElementById('jornadaEscala');
        if (!alvo) return; // usuário trocou de aba
        const fmt = (n) => n == null ? '🔒' : (n > 0 ? '✅' : '—');
        alvo.innerHTML = `<span title="Jornada">${fmt(jornada)}</span> / <span title="Escala">${fmt(escala)}</span>`;
    }

    function renderContabil(el, it) {
        const per = (it.mapeamento && it.mapeamento.periodicidade) || 'mensal';
        const ultimo = new Map();
        it.diarioEventos.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
            .forEach(ev => ultimo.set(`${ev.ano}|${ev.mes}`, ev));
        const diario = [...ultimo.values()].sort((a, b) => (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes)).slice(0, 6).map(ev => {
            const g = ev.tipo_evento === 'rejeitado' ? 'critico' : ev.tipo_evento === 'aprovado' ? 'info' : 'atencao';
            return `<li><strong>${esc(ContabilDiarioUtil.descricaoPeriodo(per, ev.ano, ev.mes))}</strong>
                <span class="chip chip-${g}">${esc(ev.tipo_evento)}</span> ${F360.fmtData(ev.created_at)}${ev.mensagem ? ` — ${esc(ev.mensagem)}` : ''}</li>`;
        }).join('');
        const onb = it.onboarding;
        const itensOnb = onb ? (onb.contabil_onboarding_itens || []) : [];
        const pctOnb = itensOnb.length ? Math.round(100 * itensOnb.filter(x => ['aprovado', 'nao_aplicavel'].includes(x.status)).length / itensOnb.length) : null;
        const pend = it.pendencias.filter(p => p.status === 'aberta').map(p =>
            `<li>${esc(p.descricao)}${p.responsavel ? ` — ${esc(p.responsavel)}` : ''} ${p.prazo ? linhaDias(p.prazo) : ''}</li>`).join('');

        el.innerHTML = `${avisoFontes('contabil')}
          <div class="grade">
            <div class="cartao"><h3>Contábil contratado</h3><div class="numero">${it.possuiContabil ? 'Sim' : 'Não'}</div></div>
            <div class="cartao"><h3>Periodicidade</h3><div class="numero">${esc(per)}</div><div class="bloqueado">Último mês fechado: ${F360.fmtData(it.mapeamento && it.mapeamento.ultimo_mes_fechado)}</div></div>
            <div class="cartao"><h3>Nível de atenção</h3><div class="numero">${esc((it.mapeamento && it.mapeamento.nivel_atencao) || '—')}</div></div>
            <div class="cartao"><h3>Onboarding</h3><div class="numero">${onb ? esc(onb.status) : '—'}</div><div class="bloqueado">${pctOnb == null ? '' : `${pctOnb}% dos itens concluídos`}</div></div>
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Diário — últimas competências</h3>
            ${diario ? `<ul class="lista-alertas">${diario}</ul>` : '<div class="bloqueado">Nenhum envio registrado.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Pendências do mapeamento</h3>
            ${pend ? `<ul class="lista-alertas">${pend}</ul>` : '<div class="bloqueado">Nenhuma pendência aberta.</div>'}
          </div>`;
    }

    async function renderCrm(el, it) {
        el.innerHTML = '<div class="cartao"><div class="bloqueado">Carregando conversas…</div></div>';
        const res = await Ficha360Fontes.carregarCrm(F360.sb, it);
        if (abaAtual !== 'crm' || codigoAtual !== it.codigo) return;
        if (!res.ok) {
            el.innerHTML = `<div class="cartao bloqueado">${res.motivo === 'sem_permissao' ? '🔒 Sem permissão para ver o CRM.' : '⚠️ CRM indisponível no momento.'}</div>`;
            return;
        }
        const linhas = res.dados.map(c => `<tr>
            <td>${esc(c.protocolo) || '—'}</td><td>${esc(c.contatos && c.contatos.nome) || '—'}</td>
            <td>${esc(c.departamento)}</td><td>${esc(c.status)}</td><td>${F360.fmtData(c.aberto_em)}</td></tr>`).join('');
        el.innerHTML = `<div class="aviso-fontes">ℹ️ Vínculo por nome da empresa (aproximado).</div>
          <div class="cartao"><h3>Últimas conversas</h3>
            ${linhas ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Protocolo</th><th>Contato</th><th>Departamento</th><th>Status</th><th>Aberta em</th></tr></thead><tbody>${linhas}</tbody></table></div>`
                : '<div class="bloqueado">Nenhuma conversa vinculada a esta empresa.</div>'}
          </div>`;
    }

    return { abrir, reabrir };
})();
```

- [ ] **Step 2: Verificar no navegador** (servidor da Task 6)

- Abrir uma empresa pelo painel: cabeçalho com semáforo, meta e atalhos (abrem em nova aba).
- Resumo: 4 cartões + lista de alertas igual aos chips do painel.
- Vencimentos: certificados e licenças com prazo colorido.
- DP: cartões, ciclos, sócios/QSA, e "Jornada / Escala" troca de "…" para ✅/—.
- Contábil: diário com rótulo de período conforme periodicidade; pendências.
- CRM: carrega sem erro (vazio é aceitável).
- `?empresa=XYZ_INEXISTENTE` mostra erro + botão de voltar.
- Console sem erros.

- [ ] **Step 3: Commit**

```bash
git add "Projeto Ficha 360/js/ficha.js"
git commit -m "feat(ficha360): ficha da empresa com resumo, vencimentos, DP, contábil e CRM"
```

---

### Task 8: Aba Cadastro — dados Domínio, dados Scont e contatos

**Files:**
- Modify (substituir stub): `Projeto Ficha 360/js/cadastro.js`

**Interfaces:**
- Consumes: `F360.sb`, `F360.dados.fichas`, `F360.dados.contatos`, `F360.falhas`, `F360.recalcular()`, `F360.auth.userData.nome`, `Ficha360Ficha.reabrir()`.
- Produces: `Ficha360Cadastro.render(container: HTMLElement, item: ItemCarteira)`.

- [ ] **Step 1: Substituir `js/cadastro.js`**

```js
// Projeto Ficha 360/js/cadastro.js
window.Ficha360Cadastro = (function () {
    'use strict';

    const esc = (v) => F360.esc(v);
    const AREAS = { geral: 'Geral', dp: 'DP', contabil: 'Contábil', fiscal: 'Fiscal', financeiro: 'Financeiro' };

    function tabelaIndisponivel(chave) {
        return F360.falhas[chave] === 'tabela_ausente'
            ? '🛠️ Configuração pendente — SQL da Ficha 360 não executado.'
            : F360.falhas[chave] === 'sem_permissao' ? '🔒 Sem permissão.' : F360.falhas[chave] ? '⚠️ Indisponível no momento.' : '';
    }

    function render(el, it) {
        const d = it.dominio;
        const ro = (rotulo, valor) => `<div class="campo"><span>${rotulo}</span><div class="campo-ro">${esc(valor) || '—'}</div></div>`;

        el.innerHTML = `
          <div class="cartao"><h3>Dados do Domínio (somente leitura)</h3>
            <div class="form-grade">
              ${ro('Razão social', d.nome_empresa)}${ro('CNPJ', d.cnpj)}${ro('Regime', d.regime_enquadramento)}
              ${ro('Inscrição estadual', d.inscricao_estadual)}${ro('Inscrição municipal', d.inscricao_municipal)}
              ${ro('Situação no Domínio', d.status_situacao)}${ro('Endereço', d.endereco)}
              ${ro('Cidade / UF', [d.cidade || d.municipio, d.uf].filter(Boolean).join(' / '))}${ro('CEP', d.cep)}${ro('E-mail', d.email)}
            </div>
            <div class="checks" style="margin-top:10px">
              <span>DP/Folha: <strong>${it.possuiFolha ? 'Sim' : 'Não'}</strong></span>
              <span>Contábil: <strong>${it.possuiContabil ? 'Sim' : 'Não'}</strong></span>
              <span class="bloqueado">(configurados no Fechamento da Folha e na Central Contábil)</span>
            </div>
          </div>
          <div class="cartao" style="margin-top:12px" id="blocoScont"></div>
          <div class="cartao" style="margin-top:12px" id="blocoContatos"></div>`;

        renderScont(document.getElementById('blocoScont'), it);
        renderContatos(document.getElementById('blocoContatos'), it);
    }

    function renderScont(el, it) {
        const indisp = tabelaIndisponivel('fichas');
        if (indisp) { el.innerHTML = `<h3>Dados Scont</h3><div class="bloqueado">${indisp}</div>`; return; }
        const f = it.ficha || {};
        const opt = (valor, rotulo, atual) => `<option value="${valor}" ${valor === atual ? 'selected' : ''}>${rotulo}</option>`;
        const chk = (id, rotulo, v) => `<label><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${rotulo}</label>`;

        el.innerHTML = `<h3>Dados Scont</h3>
          <div class="form-grade">
            <label class="campo">Status na carteira
              <select id="cStatus">${Object.entries(F360.ROTULO_STATUS).map(([k, r]) => opt(k, r, f.status_carteira || 'ativo')).join('')}</select></label>
            <label class="campo">Cliente desde <input type="date" id="cInicio" value="${esc(f.data_inicio_cliente || '')}"></label>
            <label class="campo">Saída do cliente <input type="date" id="cSaida" value="${esc(f.data_saida_cliente || '')}"></label>
            <label class="campo">Porte <input type="text" id="cPorte" value="${esc(f.porte || '')}"></label>
            <label class="campo">Atividade principal <input type="text" id="cAtividade" value="${esc(f.atividade_principal || '')}"></label>
          </div>
          <div class="checks" style="margin-top:10px">
            ${chk('cFiscal', 'Atende Fiscal', f.atende_fiscal)}${chk('cSocietario', 'Atende Societário', f.atende_societario)}${chk('cBpo', 'Atende BPO', f.atende_bpo)}
          </div>
          <label class="campo" style="margin-top:10px">Observação geral <textarea id="cObs">${esc(f.observacao_geral || '')}</textarea></label>
          <div class="acoes">
            ${f.updated_at ? `<span class="bloqueado" style="margin-right:auto">Atualizado por ${esc(f.atualizado_por || '—')} em ${F360.fmtData(f.updated_at)}</span>` : ''}
            <button class="btn btn-primario" id="cSalvar">Salvar</button>
          </div>`;

        document.getElementById('cSalvar').addEventListener('click', async (e) => {
            const btn = e.target;
            const registro = {
                codigo_empresa: it.codigo,
                status_carteira: document.getElementById('cStatus').value,
                data_inicio_cliente: document.getElementById('cInicio').value || null,
                data_saida_cliente: document.getElementById('cSaida').value || null,
                porte: document.getElementById('cPorte').value.trim() || null,
                atividade_principal: document.getElementById('cAtividade').value.trim() || null,
                atende_fiscal: document.getElementById('cFiscal').checked,
                atende_societario: document.getElementById('cSocietario').checked,
                atende_bpo: document.getElementById('cBpo').checked,
                observacao_geral: document.getElementById('cObs').value.trim() || null,
                atualizado_por: F360.auth.userData?.nome || F360.auth.email || null,
            };
            btn.disabled = true;
            const { data, error } = await F360.sb.from('ficha360_empresa').upsert(registro, { onConflict: 'codigo_empresa' }).select().single();
            btn.disabled = false;
            if (error) { alert(`Não foi possível salvar: ${error.message}`); return; }
            F360.dados.fichas = (F360.dados.fichas || []).filter(x => x.codigo_empresa !== it.codigo).concat([data]);
            F360.recalcular();
            Ficha360Ficha.reabrir();
        });
    }

    function renderContatos(el, it) {
        const indisp = tabelaIndisponivel('contatos');
        if (indisp) { el.innerHTML = `<h3>Contatos do cliente</h3><div class="bloqueado">${indisp}</div>`; return; }
        const linhas = it.contatos.slice().sort((a, b) => Number(b.principal) - Number(a.principal)).map(c => `<tr>
            <td>${c.principal ? '⭐ ' : ''}${esc(c.nome)}</td><td>${esc(c.funcao) || '—'}</td><td>${esc(AREAS[c.area] || c.area)}</td>
            <td>${esc(c.telefone) || '—'}</td><td>${esc(c.whatsapp) || '—'}</td><td>${esc(c.email) || '—'}</td>
            <td><button class="btn btn-mini btn-perigo" data-excluir="${esc(c.id)}">Excluir</button></td></tr>`).join('');

        el.innerHTML = `<h3>Contatos do cliente</h3>
          ${linhas ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>Função</th><th>Área</th><th>Telefone</th><th>WhatsApp</th><th>E-mail</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
            : '<div class="bloqueado">Nenhum contato cadastrado.</div>'}
          <div class="form-grade" style="margin-top:12px">
            <label class="campo">Nome* <input type="text" id="ktNome"></label>
            <label class="campo">Função <input type="text" id="ktFuncao"></label>
            <label class="campo">Área <select id="ktArea">${Object.entries(AREAS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></label>
            <label class="campo">Telefone <input type="text" id="ktTelefone"></label>
            <label class="campo">WhatsApp <input type="text" id="ktWhats"></label>
            <label class="campo">E-mail <input type="email" id="ktEmail"></label>
          </div>
          <div class="acoes">
            <label class="checks" style="margin-right:auto"><input type="checkbox" id="ktPrincipal"> Contato principal</label>
            <button class="btn btn-primario" id="ktAdd">Adicionar contato</button>
          </div>`;

        document.getElementById('ktAdd').addEventListener('click', async (e) => {
            const nome = document.getElementById('ktNome').value.trim();
            if (!nome) { alert('Informe o nome do contato.'); return; }
            const registro = {
                codigo_empresa: it.codigo, nome,
                funcao: document.getElementById('ktFuncao').value.trim() || null,
                area: document.getElementById('ktArea').value,
                telefone: document.getElementById('ktTelefone').value.trim() || null,
                whatsapp: document.getElementById('ktWhats').value.trim() || null,
                email: document.getElementById('ktEmail').value.trim() || null,
                principal: document.getElementById('ktPrincipal').checked,
            };
            e.target.disabled = true;
            const { data, error } = await F360.sb.from('ficha360_contatos').insert(registro).select().single();
            e.target.disabled = false;
            if (error) { alert(`Não foi possível adicionar: ${error.message}`); return; }
            F360.dados.contatos = (F360.dados.contatos || []).concat([data]);
            F360.recalcular();
            Ficha360Ficha.reabrir();
        });

        el.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Excluir este contato?')) return;
            const { error } = await F360.sb.from('ficha360_contatos').delete().eq('id', b.dataset.excluir);
            if (error) { alert(`Não foi possível excluir: ${error.message}`); return; }
            F360.dados.contatos = (F360.dados.contatos || []).filter(x => x.id !== b.dataset.excluir);
            F360.recalcular();
            Ficha360Ficha.reabrir();
        }));
    }

    return { render };
})();
```

- [ ] **Step 2: Ajustar `Ficha360Ficha.reabrir` para manter a aba**

Em `js/ficha.js`, a função `abrir` só reseta `abaAtual` quando o código muda — `reabrir()` chama `abrir(codigoAtual)` com o mesmo código, então a aba Cadastro é mantida. Nenhuma alteração necessária; confirmar lendo a linha `if (codigo !== codigoAtual) abaAtual = 'resumo';`.

- [ ] **Step 3: Verificar no navegador**

**Antes do SQL:** aba Cadastro mostra dados do Domínio e "Configuração pendente" nos blocos Scont e Contatos.
**Depois do SQL (pedir ao usuário para rodar `_sql/schema_ficha360.sql`):**
- Salvar dados Scont → recarrega a ficha na aba Cadastro com "Atualizado por … em …"; alerta "Cadastro Scont não preenchido" some do Resumo.
- Mudar status para "Inativo" → semáforo fica cinza; no painel a empresa some (volta com "Mostrar inativas").
- Adicionar contato principal → alerta "Sem contato principal" some; excluir funciona.
- Recarregar a página (F5) mantém os dados salvos.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Ficha 360/js/cadastro.js"
git commit -m "feat(ficha360): aba cadastro com dados Domínio, dados Scont e contatos"
```

---

### Task 9: Aba Anotações

**Files:**
- Modify (substituir stub): `Projeto Ficha 360/js/anotacoes.js`

**Interfaces:**
- Consumes: `F360.sb`, `F360.userId`, `F360.auth.isAdmin`, `F360.auth.userData.nome`, `Ficha360Fontes.classificarErro`.
- Produces: `Ficha360Anotacoes.render(container: HTMLElement, item: ItemCarteira)`.

- [ ] **Step 1: Substituir `js/anotacoes.js`**

```js
// Projeto Ficha 360/js/anotacoes.js
window.Ficha360Anotacoes = (function () {
    'use strict';

    const esc = (v) => F360.esc(v);
    const CATEGORIAS = { geral: 'Geral', dp: 'DP', contabil: 'Contábil', financeiro: 'Financeiro', combinado: 'Combinado com cliente' };
    let filtroCategoria = '';

    async function render(el, it) {
        el.innerHTML = '<div class="cartao"><div class="bloqueado">Carregando anotações…</div></div>';
        const { data, error } = await F360.sb.from('ficha360_anotacoes')
            .select('*').eq('codigo_empresa', it.codigo)
            .order('fixada', { ascending: false }).order('created_at', { ascending: false });
        if (!el.isConnected) return;
        if (error) {
            const motivo = Ficha360Fontes.classificarErro(error);
            el.innerHTML = `<div class="cartao bloqueado">${motivo === 'tabela_ausente' ? '🛠️ Configuração pendente — SQL da Ficha 360 não executado.'
                : motivo === 'sem_permissao' ? '🔒 Sem permissão.' : '⚠️ Anotações indisponíveis no momento.'}</div>`;
            return;
        }
        desenhar(el, it, data || []);
    }

    function podeEditar(a) {
        return F360.auth.isAdmin || (F360.userId && a.autor_id === F360.userId);
    }

    function desenhar(el, it, lista) {
        const visiveis = filtroCategoria ? lista.filter(a => a.categoria === filtroCategoria) : lista;
        const cards = visiveis.map(a => `
          <div class="anotacao ${a.fixada ? 'fixada' : ''}" data-id="${esc(a.id)}">
            <div class="anotacao-meta">
              ${a.fixada ? '📌' : ''}<span class="chip chip-neutro">${esc(CATEGORIAS[a.categoria] || a.categoria)}</span>
              <strong>${esc(a.autor_nome) || '—'}</strong> · ${F360.fmtData(a.created_at)}${a.editado_em ? ' · editada' : ''}
              ${podeEditar(a) ? `<span style="margin-left:auto;display:flex;gap:4px">
                <button class="btn btn-mini" data-acao="fixar">${a.fixada ? 'Desafixar' : 'Fixar'}</button>
                <button class="btn btn-mini" data-acao="editar">Editar</button>
                <button class="btn btn-mini btn-perigo" data-acao="excluir">Excluir</button></span>` : ''}
            </div>
            <div class="anotacao-texto">${esc(a.texto)}</div>
          </div>`).join('');

        el.innerHTML = `
          <div class="cartao">
            <h3>Nova anotação</h3>
            <label class="campo"><textarea id="anTexto" placeholder="Ex.: Cliente pediu envio da folha até dia 5; combinado com o sócio João."></textarea></label>
            <div class="acoes">
              <select id="anCategoria" style="margin-right:auto">${Object.entries(CATEGORIAS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select>
              <button class="btn btn-primario" id="anSalvar">Registrar</button>
            </div>
          </div>
          <div class="cartao" style="margin-top:12px">
            <div class="cabecalho-tela" style="margin-bottom:8px">
              <h3 style="margin:0">Histórico (${lista.length})</h3>
              <select id="anFiltro"><option value="">Todas as categorias</option>${Object.entries(CATEGORIAS).map(([k, r]) =>
                  `<option value="${k}" ${filtroCategoria === k ? 'selected' : ''}>${r}</option>`).join('')}</select>
            </div>
            ${cards || '<div class="bloqueado">Nenhuma anotação.</div>'}
          </div>`;

        document.getElementById('anFiltro').addEventListener('change', (e) => { filtroCategoria = e.target.value; desenhar(el, it, lista); });

        document.getElementById('anSalvar').addEventListener('click', async (e) => {
            const texto = document.getElementById('anTexto').value.trim();
            if (!texto) { alert('Escreva a anotação.'); return; }
            e.target.disabled = true;
            const { error } = await F360.sb.from('ficha360_anotacoes').insert({
                codigo_empresa: it.codigo, texto,
                categoria: document.getElementById('anCategoria').value,
                autor_nome: F360.auth.userData?.nome || F360.auth.email || null,
            });
            e.target.disabled = false;
            if (error) { alert(`Não foi possível registrar: ${error.message}`); return; }
            render(el, it);
        });

        el.querySelectorAll('.anotacao [data-acao]').forEach(b => b.addEventListener('click', async () => {
            const id = b.closest('.anotacao').dataset.id;
            const a = lista.find(x => x.id === id);
            let resp;
            if (b.dataset.acao === 'fixar') {
                resp = await F360.sb.from('ficha360_anotacoes').update({ fixada: !a.fixada }).eq('id', id);
            } else if (b.dataset.acao === 'editar') {
                const novo = prompt('Editar anotação:', a.texto);
                if (novo == null || !novo.trim() || novo.trim() === a.texto) return;
                resp = await F360.sb.from('ficha360_anotacoes').update({ texto: novo.trim(), editado_em: new Date().toISOString() }).eq('id', id);
            } else {
                if (!confirm('Excluir esta anotação?')) return;
                resp = await F360.sb.from('ficha360_anotacoes').delete().eq('id', id);
            }
            if (resp.error) { alert(`Não foi possível concluir: ${resp.error.message}`); return; }
            render(el, it);
        }));
    }

    return { render };
})();
```

- [ ] **Step 2: Verificar no navegador (com SQL executado)**

- Registrar anotação → aparece no topo com autor e data.
- Fixar → vai para o topo com 📌; desafixar volta à ordem por data.
- Editar → mostra "editada"; excluir remove.
- Filtro por categoria funciona.
- Logar com outro usuário (não admin, não autor): botões de editar/excluir **não** aparecem. Tentar via console `F360.sb.from('ficha360_anotacoes').delete().eq('id','<id de outro autor>')` → nenhuma linha removida (RLS).

- [ ] **Step 3: Commit**

```bash
git add "Projeto Ficha 360/js/anotacoes.js"
git commit -m "feat(ficha360): aba de anotações internas com fixar, editar e excluir"
```

---

### Task 10: Verificação final, testes de permissão e documentação

**Files:**
- Create: `Projeto Ficha 360/README.md`
- Modify: memória do projeto (`project_ficha_360.md` + linha em `MEMORY.md`)

- [ ] **Step 1: Rodar todos os testes**

Run: `for f in "Projeto Ficha 360"/tests/*.test.js; do node "$f" || exit 1; done`
Expected: todos terminam com `N testes OK`, exit 0.

- [ ] **Step 2: Roteiro manual em produção (com o usuário)**

1. Registrar acesso à ferramenta para um usuário comum na tela de admin do portal; card "Ficha 360 do Cliente" aparece no `portal.html`.
2. Empresa sem alertas → verde.
3. Empresa com certificado vencendo em ≤ 7 dias → vermelho com chip "Certificado … vence em Nd".
4. Empresa com Diário rejeitado → vermelho com chip "Diário … rejeitado sem reenvio".
5. Usuário sem permissão de contato do Mapeamento → ficha abre normalmente (contato do mapeamento não é exibido pela Ficha 360 na V1; nada quebra).
6. Usuário "Prestador de Serviço" acessando a URL direto → redirecionado ao portal.
7. Conferir tempo de carregamento do painel (anotar; se > 8 s, registrar como melhoria futura: RPC para o painel).

- [ ] **Step 3: Criar `Projeto Ficha 360/README.md`**

```markdown
# Ficha 360 do Cliente

Visão única de cada empresa da carteira para a equipe interna Scont.

- **Painel** (`index.html`): todas as empresas com semáforo, filtros e motivos.
- **Ficha** (`index.html?empresa=<codigo>`): Resumo, Cadastro, Vencimentos, DP, Contábil, Anotações, CRM.

## Arquitetura
- `js/fontes.js` busca (Supabase, paralelo, paginado; cada fonte falha isolada).
- `js/vinculos.js`, `js/regras.js`, `js/carteira.js` são puros e testados em Node.
- `js/painel.js`, `js/ficha.js`, `js/cadastro.js`, `js/anotacoes.js` renderizam.
- Reusa `Projeto RH/qsa-analise.js` e `Projeto Onboarding Contabil/contabil-diario-util.js` (não copiar).

## Banco
`_sql/schema_ficha360.sql` — `ficha360_empresa`, `ficha360_contatos`, `ficha360_anotacoes` + RLS + registro em `ferramentas`.

## Regras do semáforo
Limites em `LIMITES` no topo de `js/regras.js`. Spec: `docs/superpowers/specs/2026-09-14-ficha-360-cliente-design.md`.

## Testes
`for f in "Projeto Ficha 360"/tests/*.test.js; do node "$f"; done`
```

- [ ] **Step 4: Registrar memória do projeto**

Criar `C:\Users\Herbert G L J\.claude\projects\C--Users-Herbert-G-L-J-Desktop-Projetos-HTML-Projeto-Portal-Scont\memory\project_ficha_360.md` com: ferramenta nova, abordagem client-side, vínculos (certificado por `cpf_cnpj`, CRM por nome), SQL `_sql/schema_ficha360.sql` (status: pendente/rodado conforme o usuário confirmar), itens fora da V1. Adicionar linha em `MEMORY.md`.

- [ ] **Step 5: Commit**

```bash
git add "Projeto Ficha 360/README.md"
git commit -m "docs(ficha360): README da ferramenta"
```
