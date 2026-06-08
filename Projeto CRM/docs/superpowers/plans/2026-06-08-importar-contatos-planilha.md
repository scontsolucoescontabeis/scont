# Importar Contatos via Planilha Excel (+ multi-empresa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a múltiplas empresas por número de telefone no CRM e implementar importação de contatos via planilha Excel com prévia, detecção de conflitos e vinculação de empresas.

**Architecture:** Nova tabela `contatos_empresas` (junction) substitui `contatos.empresa`/`contatos.cargo`. Telefone continua UNIQUE em `contatos` (uma pessoa = um registro). ModalImportarPlanilha usa `xlsx` (já instalado) para parsing client-side e detecta 4 estados por linha: novo contato, nova empresa, conflito, erro. ContatosPage e PainelDireito são atualizados para exibir múltiplas empresas.

**Tech Stack:** React 18, Vite, `xlsx ^0.18.5`, `@supabase/supabase-js ^2.47`, Vitest + Testing Library (jsdom), lucide-react, PostgreSQL (Supabase).

---

## File Map

| Ação | Caminho |
|------|---------|
| **Criar** | `supabase/migrations/012_contatos_multiempresa.sql` |
| **Criar** | `src/components/ContatosImport/ModalImportarPlanilha.jsx` |
| **Criar** | `src/components/ContatosImport/ModalImportarPlanilha.test.jsx` |
| **Modificar** | `src/pages/ContatosPage.jsx` |
| **Modificar** | `src/components/PainelDireito/PainelDireito.jsx` |

---

## Task 1: Migration SQL — tabela contatos_empresas

**Files:**
- Create: `supabase/migrations/012_contatos_multiempresa.sql`

- [ ] **Passo 1: Criar o arquivo de migration**

Crie `supabase/migrations/012_contatos_multiempresa.sql`:

```sql
-- ============================================================
-- Migration 012 — Suporte a múltiplas empresas por contato
-- ============================================================

-- 1. Nova tabela de vínculo contato ↔ empresa
CREATE TABLE IF NOT EXISTS contatos_empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id  UUID NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  empresa     TEXT NOT NULL,
  cargo       TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contato_id, empresa)
);

-- 2. Migrar dados existentes de contatos.empresa + contatos.cargo
INSERT INTO contatos_empresas (contato_id, empresa, cargo)
SELECT id, empresa, cargo
FROM contatos
WHERE empresa IS NOT NULL AND empresa <> ''
ON CONFLICT (contato_id, empresa) DO NOTHING;

-- 3. Remover colunas obsoletas de contatos
ALTER TABLE contatos DROP COLUMN IF EXISTS empresa;
ALTER TABLE contatos DROP COLUMN IF EXISTS cargo;

-- 4. Índice
CREATE INDEX IF NOT EXISTS idx_contatos_empresas_contato ON contatos_empresas(contato_id);

-- 5. RLS
ALTER TABLE contatos_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contatos_empresas_select" ON contatos_empresas;
DROP POLICY IF EXISTS "contatos_empresas_insert" ON contatos_empresas;
DROP POLICY IF EXISTS "contatos_empresas_update" ON contatos_empresas;
DROP POLICY IF EXISTS "contatos_empresas_delete" ON contatos_empresas;

CREATE POLICY "contatos_empresas_select" ON contatos_empresas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "contatos_empresas_insert" ON contatos_empresas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contatos_empresas_update" ON contatos_empresas
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "contatos_empresas_delete" ON contatos_empresas
  FOR DELETE TO authenticated USING (true);

-- 6. Realtime (opcional, não crítico)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE contatos_empresas;
EXCEPTION WHEN others THEN NULL; END $$;
```

- [ ] **Passo 2: Executar no Supabase**

Copiar o conteúdo do arquivo e executar no **SQL Editor** do projeto Supabase (Portal).  
Verificar no Table Editor que a tabela `contatos_empresas` foi criada e que `contatos` não tem mais as colunas `empresa` e `cargo`.

- [ ] **Passo 3: Commit**

```bash
git add "Projeto CRM/supabase/migrations/012_contatos_multiempresa.sql"
git commit -m "feat(db): migration 012 — tabela contatos_empresas, remove empresa/cargo de contatos"
```

---

## Task 2: Atualizar ContatosPage — ModalContato multi-empresa

**Files:**
- Modify: `src/pages/ContatosPage.jsx:1-151`

O `ModalContato` atual tem `empresa` e `cargo` como campos simples. Precisa ser substituído por uma lista dinâmica de vínculos (empresa + cargo) que salva em `contatos_empresas`.

- [ ] **Passo 1: Substituir as constantes CAMPOS_FORM e VAZIO no topo de ContatosPage.jsx**

Localize e substitua (linhas 7-16):

```jsx
// DE:
const CAMPOS_FORM = [
  { key: 'nome',      label: 'Nome',              placeholder: 'Nome completo',           required: true,  col: 2 },
  { key: 'telefone',  label: 'Telefone (WhatsApp)', placeholder: '5561999999999',         required: true,  col: 1, mono: true },
  { key: 'empresa',   label: 'Empresa',            placeholder: 'Razão social ou nome',   required: false, col: 1 },
  { key: 'cargo',     label: 'Cargo / Função',     placeholder: 'Ex: Sócio, Responsável', required: false, col: 1 },
  { key: 'email',     label: 'E-mail',             placeholder: 'contato@empresa.com',    required: false, col: 1 },
  { key: 'cpf_cnpj',  label: 'CPF / CNPJ',         placeholder: '000.000.000-00',         required: false, col: 1 },
]

const VAZIO = { nome: '', telefone: '', empresa: '', cargo: '', email: '', cpf_cnpj: '', observacoes: '' }
```

```jsx
// PARA:
const CAMPOS_FORM = [
  { key: 'nome',     label: 'Nome',               placeholder: 'Nome completo',  required: true,  col: 2 },
  { key: 'telefone', label: 'Telefone (WhatsApp)', placeholder: '5561999999999', required: true,  col: 1, mono: true },
  { key: 'email',    label: 'E-mail',              placeholder: 'contato@empresa.com', required: false, col: 1 },
  { key: 'cpf_cnpj', label: 'CPF / CNPJ',          placeholder: '000.000.000-00',      required: false, col: 1 },
]

const VAZIO = { nome: '', telefone: '', email: '', cpf_cnpj: '', observacoes: '' }
const EMPRESA_VAZIA = { empresa: '', cargo: '' }
```

- [ ] **Passo 2: Substituir a função ModalContato inteira (linhas 19-151)**

Substitua o componente `ModalContato` completo pelo seguinte:

```jsx
function ModalContato({ contato, empresasIniciais = [], onSalvar, onFechar }) {
  const editando = !!contato?.id
  const [form, setForm] = useState(contato ? {
    nome:        contato.nome       ?? '',
    telefone:    contato.telefone   ?? '',
    email:       contato.email      ?? '',
    cpf_cnpj:    contato.cpf_cnpj   ?? '',
    observacoes: contato.observacoes ?? '',
  } : { ...VAZIO })
  const [empresas, setEmpresas] = useState(
    empresasIniciais.length > 0
      ? empresasIniciais.map(e => ({ empresa: e.empresa, cargo: e.cargo ?? '' }))
      : [{ ...EMPRESA_VAZIA }]
  )
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const setEmpresa = (i, k) => (e) =>
    setEmpresas(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: e.target.value } : item))

  const addEmpresa = () => setEmpresas(prev => [...prev, { ...EMPRESA_VAZIA }])

  const removeEmpresa = (i) => setEmpresas(prev => prev.filter((_, idx) => idx !== i))

  const handleSalvar = async (e) => {
    e.preventDefault()
    if (!form.nome.trim())     { setErro('Informe o nome do contato.'); return }
    if (!form.telefone.trim()) { setErro('Informe o telefone/WhatsApp.'); return }
    setSalvando(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    const agora = new Date().toISOString()

    const payload = {
      nome:        form.nome.trim(),
      telefone:    form.telefone.trim().replace(/\D/g, ''),
      email:       form.email.trim()    || null,
      cpf_cnpj:    form.cpf_cnpj.trim() || null,
      observacoes: form.observacoes.trim() || null,
      atualizado_por: user.id,
      atualizado_em:  agora,
    }

    let contatoId = contato?.id
    let error

    if (editando) {
      ;({ error } = await supabase.from('contatos').update(payload).eq('id', contatoId))
    } else {
      const { data, error: errIns } = await supabase
        .from('contatos').insert(payload).select('id').single()
      error = errIns
      contatoId = data?.id
    }

    if (error) { setSalvando(false); setErro(error.message); return }

    // Sincronizar contatos_empresas
    const empresasValidas = empresas.filter(e => e.empresa.trim())
    if (empresasValidas.length > 0 && contatoId) {
      if (editando) {
        // Apagar os que não estão mais na lista
        const nomesAtuais = empresasValidas.map(e => e.empresa.trim())
        await supabase
          .from('contatos_empresas')
          .delete()
          .eq('contato_id', contatoId)
          .not('empresa', 'in', `(${nomesAtuais.map(n => `"${n}"`).join(',')})`)
      }
      // Upsert os que estão
      for (const item of empresasValidas) {
        await supabase.from('contatos_empresas').upsert({
          contato_id: contatoId,
          empresa:    item.empresa.trim(),
          cargo:      item.cargo.trim() || null,
        }, { onConflict: 'contato_id,empresa' })
      }
    }

    setSalvando(false)
    onSalvar()
    onFechar()
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px',
    border: '1px solid #e0dcd8', borderRadius: 6, fontSize: 13,
    outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#1a1a1a', display: 'block', marginBottom: 4 }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        width: 540, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#7a1e1e" />
            </div>
            <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              {editando ? 'Editar Contato' : 'Novo Contato'}
            </h3>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        <form onSubmit={handleSalvar}>
          {/* Campos principais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {CAMPOS_FORM.map(c => (
              <div key={c.key} style={{ gridColumn: c.col === 2 ? 'span 2' : 'span 1' }}>
                <label style={labelStyle}>
                  {c.label} {c.required && <span style={{ color: '#b83232' }}>*</span>}
                </label>
                <input
                  value={form[c.key]}
                  onChange={set(c.key)}
                  placeholder={c.placeholder}
                  required={c.required}
                  style={{ ...inputStyle, fontFamily: c.mono ? 'DM Mono, monospace' : 'DM Sans, sans-serif' }}
                />
              </div>
            ))}
          </div>

          {/* Empresas vinculadas */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Empresas vinculadas</label>
              <button type="button" onClick={addEmpresa} style={{
                background: 'none', border: '1px solid #e0dcd8', borderRadius: 5,
                padding: '3px 10px', fontSize: 11, color: '#7a1e1e', cursor: 'pointer',
              }}>
                + Adicionar
              </button>
            </div>
            {empresas.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                <input
                  value={item.empresa}
                  onChange={setEmpresa(i, 'empresa')}
                  placeholder="Razão social ou nome"
                  style={{ ...inputStyle, flex: 2 }}
                />
                <input
                  value={item.cargo}
                  onChange={setEmpresa(i, 'cargo')}
                  placeholder="Cargo / Função"
                  style={{ ...inputStyle, flex: 1 }}
                />
                {empresas.length > 1 && (
                  <button type="button" onClick={() => removeEmpresa(i)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 4px', color: '#888480', flexShrink: 0,
                  }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Observações */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={set('observacoes')}
              placeholder="Informações relevantes sobre o contato..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>

          {erro && <p style={{ fontSize: 12, color: '#b83232', marginBottom: 10 }}>{erro}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onFechar} style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e0dcd8',
              background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: salvando ? '#c5c0ba' : '#7a1e1e',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'not-allowed' : 'pointer',
            }}>
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar Contato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Passo 3: Commit**

```bash
git add "Projeto CRM/src/pages/ContatosPage.jsx"
git commit -m "feat: ModalContato suporta múltiplas empresas vinculadas via contatos_empresas"
```

---

## Task 3: Atualizar ContatosPage — ContatoCard + busca multi-empresa

**Files:**
- Modify: `src/pages/ContatosPage.jsx:153-296` (ContatoCard)
- Modify: `src/pages/ContatosPage.jsx:299-427` (ContatosPage principal)

- [ ] **Passo 1: Substituir a função ContatoCard inteira (linhas 154-296)**

```jsx
function ContatoCard({ contato, onEditar, onAtualizar }) {
  const [expandido, setExpandido]         = useState(false)
  const [historico, setHistorico]         = useState([])
  const [empresas, setEmpresas]           = useState([])
  const [carregandoHist, setCarregandoHist] = useState(false)

  const carregarDetalhes = async () => {
    if (historico.length && empresas.length) return
    setCarregandoHist(true)

    const [{ data: hist }, { data: emps }] = await Promise.all([
      supabase
        .from('conversas')
        .select('id, protocolo, status, departamento, aberto_em, encerrado_em')
        .eq('contato_id', contato.id)
        .order('aberto_em', { ascending: false })
        .limit(10),
      supabase
        .from('contatos_empresas')
        .select('empresa, cargo')
        .eq('contato_id', contato.id)
        .order('criado_em', { ascending: true }),
    ])

    setHistorico(hist ?? [])
    setEmpresas(emps ?? [])
    setCarregandoHist(false)
  }

  const handleExpand = () => {
    setExpandido(v => !v)
    if (!expandido) carregarDetalhes()
  }

  const STATUS_COR = { ABERTA: '#888480', EM_ATENDIMENTO: '#2d7a4f', AGUARDANDO: '#b87a00', ENCERRADA: '#c5c0ba' }

  // empresa principal (primeira vinculada) para exibir no card fechado
  const empresaLabel = contato.contatos_empresas?.[0]?.empresa ?? null

  return (
    <div style={{
      background: '#fff', border: '1px solid #e0dcd8', borderRadius: 10,
      overflow: 'hidden', marginBottom: 8,
      boxShadow: expandido ? '0 2px 12px rgba(0,0,0,0.07)' : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: '#f0e8e8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 700, color: '#7a1e1e', flexShrink: 0,
        }}>
          {(contato.nome ?? contato.telefone)[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>
              {contato.nome ?? '—'}
            </span>
            {empresaLabel && (
              <span style={{ fontSize: 11, color: '#888480', background: '#f7f6f4', padding: '1px 7px', borderRadius: 3 }}>
                {empresaLabel}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 3, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#888480', fontFamily: 'DM Mono, monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Phone size={10} /> {contato.telefone}
            </span>
            {contato.email && (
              <span style={{ fontSize: 11, color: '#888480', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={10} /> {contato.email}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onEditar(contato) }}
            title="Editar contato"
            style={{ background: 'none', border: '1px solid #e0dcd8', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888480' }}
          >
            <Edit2 size={12} /> Editar
          </button>
          <button onClick={handleExpand}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#888480' }}>
            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expandido && (
        <div style={{ borderTop: '1px solid #e0dcd8', padding: '14px 16px', background: '#fafaf9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: contato.observacoes ? 14 : 0 }}>
            {/* Dados + Empresas */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 0 }}>
                Dados cadastrais
              </p>
              {[
                { label: 'CPF/CNPJ', value: contato.cpf_cnpj },
                { label: 'E-mail',   value: contato.email },
                { label: 'Cadastrado em', value: contato.criado_em ? format(new Date(contato.criado_em), "dd/MM/yyyy", { locale: ptBR }) : null },
              ].filter(f => f.value).map(f => (
                <div key={f.label} style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 10, color: '#888480' }}>{f.label}: </span>
                  <span style={{ fontSize: 12, color: '#1a1a1a' }}>{f.value}</span>
                </div>
              ))}

              {/* Empresas vinculadas */}
              <p style={{ fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, marginTop: 10 }}>
                Empresas ({carregandoHist ? '…' : empresas.length})
              </p>
              {carregandoHist ? null : empresas.length === 0 ? (
                <span style={{ fontSize: 11, color: '#c5c0ba' }}>Nenhuma empresa</span>
              ) : empresas.map((e, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{e.empresa}</span>
                  {e.cargo && <span style={{ fontSize: 11, color: '#888480' }}> · {e.cargo}</span>}
                </div>
              ))}
            </div>

            {/* Histórico de conversas */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#888480', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, marginTop: 0 }}>
                Histórico ({historico.length})
              </p>
              {carregandoHist ? (
                <span style={{ fontSize: 11, color: '#888480' }}>Carregando...</span>
              ) : historico.length === 0 ? (
                <span style={{ fontSize: 11, color: '#c5c0ba' }}>Sem conversas</span>
              ) : historico.map(c => (
                <div key={c.id} style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={10} color={STATUS_COR[c.status] ?? '#888480'} />
                  <span style={{ fontSize: 10, fontFamily: 'DM Mono, monospace', color: '#7a1e1e' }}>{c.protocolo}</span>
                  <span style={{ fontSize: 10, color: '#888480' }}>{c.departamento}</span>
                  <span style={{ fontSize: 10, color: STATUS_COR[c.status] ?? '#888480', fontWeight: 600 }}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>

          {contato.observacoes && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: 6, padding: '10px 14px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                Observações
              </p>
              <p style={{ fontSize: 13, color: '#1a1a1a', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {contato.observacoes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Atualizar a função carregar e busca em ContatosPage (função principal)**

Localize a função `carregar` (linha ~307) e substitua o bloco de query:

```jsx
// DE:
let q = supabase
  .from('contatos')
  .select('*')
  .order('nome', { ascending: true })

if (busca.trim()) {
  const t = busca.trim()
  q = q.or(`nome.ilike.%${t}%,telefone.ilike.%${t}%,empresa.ilike.%${t}%,email.ilike.%${t}%`)
}
```

```jsx
// PARA:
let q = supabase
  .from('contatos')
  .select('*, contatos_empresas(empresa, cargo)')
  .order('nome', { ascending: true })

if (busca.trim()) {
  const t = busca.trim()
  q = q.or(`nome.ilike.%${t}%,telefone.ilike.%${t}%,email.ilike.%${t}%`)
}
```

E logo após `setContatos(data ?? [])`, adicione filtro client-side por empresa:

```jsx
// PARA (bloco completo dentro de carregar):
const { data } = await q
let resultado = data ?? []
if (busca.trim()) {
  const t = busca.trim().toLowerCase()
  const matchesEmpresa = (c) =>
    c.contatos_empresas?.some(e => e.empresa?.toLowerCase().includes(t))
  resultado = resultado.filter(c =>
    c.nome?.toLowerCase().includes(t) ||
    c.telefone?.toLowerCase().includes(t) ||
    c.email?.toLowerCase().includes(t) ||
    matchesEmpresa(c)
  )
}
setContatos(resultado)
```

- [ ] **Passo 3: Atualizar a chamada ao ModalContato para passar empresas**

Localize onde `setModal` é chamado ao editar e onde o modal é renderizado (linha ~393-424).

Na chamada `onEditar={setModal}` dentro de `ContatoCard`, o `setModal` recebe o contato. Agora o `ModalContato` precisa das empresas também. Adicione um state de empresas do contato sendo editado:

No topo da função `ContatosPage`, adicione:
```jsx
const [empresasModal, setEmpresas] = useState([])
```

Substitua o handler de edição nos cards — adicione uma função `handleEditar`:
```jsx
const handleEditar = async (contato) => {
  const { data } = await supabase
    .from('contatos_empresas')
    .select('empresa, cargo')
    .eq('contato_id', contato.id)
    .order('criado_em')
  setEmpresas(data ?? [])
  setModal(contato)
}
```

Substitua `onEditar={setModal}` por `onEditar={handleEditar}` no `ContatoCard`.

No modal renderizado no final da página:
```jsx
// DE:
{modal !== null && (
  <ModalContato
    contato={modal?.id ? modal : null}
    onSalvar={carregar}
    onFechar={() => setModal(null)}
  />
)}

// PARA:
{modal !== null && (
  <ModalContato
    contato={modal?.id ? modal : null}
    empresasIniciais={modal?.id ? empresasModal : []}
    onSalvar={carregar}
    onFechar={() => setModal(null)}
  />
)}
```

- [ ] **Passo 4: Commit**

```bash
git add "Projeto CRM/src/pages/ContatosPage.jsx"
git commit -m "feat: ContatoCard e busca suportam múltiplas empresas via contatos_empresas"
```

---

## Task 4: Atualizar PainelDireito — exibição multi-empresa

**Files:**
- Modify: `src/components/PainelDireito/PainelDireito.jsx`

- [ ] **Passo 1: Adicionar carregamento de empresas no useEffect principal**

Localize o primeiro `useEffect` (linha ~23) e adicione o carregamento de empresas:

```jsx
// Adicionar state no topo da função PainelDireito:
const [empresasContato, setEmpresasContato] = useState([])
```

```jsx
// Dentro do useEffect que já existe, após as outras queries, adicione:
supabase
  .from('contatos_empresas')
  .select('empresa, cargo')
  .eq('contato_id', conversa.contatos.id)
  .order('criado_em', { ascending: true })
  .then(({ data }) => setEmpresasContato(data ?? []))
```

E no cleanup do mesmo useEffect (onde tem `setHistorico([]); setTransferencias([])`), adicione:
```jsx
setEmpresasContato([])
```

- [ ] **Passo 2: Substituir a exibição de empresa no bloco "Dados do contato"**

Localize (linha ~227):
```jsx
{contato?.empresa && <InfoRow icon={<Building2 size={12} />} label="Empresa" value={contato.empresa} />}
```

Substitua por:
```jsx
{empresasContato.length > 0 && (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 6 }}>
    <span style={{ color: '#888480', marginTop: 1 }}><Building2 size={12} /></span>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: '#888480' }}>
        {empresasContato.length === 1 ? 'Empresa' : 'Empresas'}
      </div>
      {empresasContato.map((e, i) => (
        <div key={i} style={{ fontSize: 12, color: '#1a1a1a' }}>
          {e.empresa}{e.cargo ? <span style={{ color: '#888480' }}> · {e.cargo}</span> : null}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Passo 3: Também atualizar o subtítulo do nome do contato**

Localize (linha ~103):
```jsx
{contato?.empresa && (
  <div style={{ fontSize: 11, color: '#888480', marginTop: 3 }}>{contato.empresa}</div>
)}
```

Substitua por:
```jsx
{empresasContato.length > 0 && (
  <div style={{ fontSize: 11, color: '#888480', marginTop: 3 }}>
    {empresasContato.map(e => e.empresa).join(' · ')}
  </div>
)}
```

- [ ] **Passo 4: Commit**

```bash
git add "Projeto CRM/src/components/PainelDireito/PainelDireito.jsx"
git commit -m "feat: PainelDireito exibe múltiplas empresas do contato"
```

---

## Task 5: Criar ModalImportarPlanilha — helpers + testes

**Files:**
- Create: `src/components/ContatosImport/ModalImportarPlanilha.jsx`
- Create: `src/components/ContatosImport/ModalImportarPlanilha.test.jsx`

- [ ] **Passo 1: Criar o arquivo com helpers exportados**

Crie `src/components/ContatosImport/ModalImportarPlanilha.jsx`:

```jsx
import { useState, useRef, useCallback } from 'react'
import { X, FileSpreadsheet, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'

// ── helpers (exportados para testes) ─────────────────────────

export function baixarModelo() {
  const ws = XLSX.utils.aoa_to_sheet([
    ['nome', 'telefone', 'empresa', 'cargo', 'email', 'cpf_cnpj', 'observacoes'],
    ['João Silva (exemplo)', '5561999991111', 'ACME Ltda', 'Sócio', 'joao@acme.com', '000.000.000-00', ''],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos')
  XLSX.writeFile(wb, 'modelo-contatos.xlsx')
}

export function normalizarLinhas(rawRows) {
  return rawRows.map((row, idx) => {
    const telefone = String(row.telefone ?? '').trim().replace(/\D/g, '')
    return {
      idx,
      nome:        String(row.nome        ?? '').trim(),
      telefone,
      empresa:     String(row.empresa     ?? '').trim() || null,
      cargo:       String(row.cargo       ?? '').trim() || null,
      email:       String(row.email       ?? '').trim() || null,
      cpf_cnpj:    String(row.cpf_cnpj    ?? '').trim() || null,
      observacoes: String(row.observacoes ?? '').trim() || null,
      // status: 'novo_contato' | 'nova_empresa' | 'conflito' | 'erro'
      // (resolvido em parsearEProcessar após consulta ao banco)
      status:      telefone ? 'novo_contato' : 'erro',
      conflictId:  null,   // id do registro em contatos_empresas se status === 'conflito'
      contatoId:   null,   // id do contato existente se status === 'nova_empresa' ou 'conflito'
      acao:        null,   // 'atualizar' | 'ignorar' — só preenchido quando status === 'conflito'
    }
  })
}

export async function parsearEProcessar(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  const linhas = normalizarLinhas(rawRows)
  const linhasValidas = linhas.filter(l => l.status !== 'erro')
  if (linhasValidas.length === 0) return linhas

  // Buscar contatos existentes pelo telefone
  const telefones = [...new Set(linhasValidas.map(l => l.telefone))]
  const { data: contatosExistentes } = await supabase
    .from('contatos')
    .select('id, telefone')
    .in('telefone', telefones)

  const contatoMap = {}
  ;(contatosExistentes ?? []).forEach(c => { contatoMap[c.telefone] = c.id })

  // Buscar vínculos empresa existentes para os contatos encontrados
  const contatoIds = Object.values(contatoMap)
  let empresaExistentes = []
  if (contatoIds.length > 0) {
    const { data } = await supabase
      .from('contatos_empresas')
      .select('id, contato_id, empresa')
      .in('contato_id', contatoIds)
    empresaExistentes = data ?? []
  }

  // Determinar status de cada linha
  linhasValidas.forEach(l => {
    const cId = contatoMap[l.telefone]
    if (!cId) {
      l.status = 'novo_contato'
      return
    }
    l.contatoId = cId
    const vinculo = empresaExistentes.find(
      e => e.contato_id === cId && (e.empresa ?? '') === (l.empresa ?? '')
    )
    if (vinculo) {
      l.status = 'conflito'
      l.conflictId = vinculo.id
      l.acao = 'atualizar'
    } else {
      l.status = 'nova_empresa'
    }
  })

  return linhas
}

export async function confirmarImportacao(linhas) {
  const { data: { user } } = await supabase.auth.getUser()
  const agora = new Date().toISOString()
  const erros = []

  for (const l of linhas) {
    if (l.status === 'erro') continue
    if (l.status === 'conflito' && l.acao === 'ignorar') continue

    if (l.status === 'novo_contato') {
      // Criar contato + vínculo empresa
      const { data: novoContato, error: errC } = await supabase
        .from('contatos')
        .insert({
          nome:           l.nome || l.telefone,
          telefone:       l.telefone,
          email:          l.email       || null,
          cpf_cnpj:       l.cpf_cnpj    || null,
          observacoes:    l.observacoes || null,
          atualizado_por: user.id,
          atualizado_em:  agora,
        })
        .select('id')
        .single()
      if (errC) { erros.push(errC.message); continue }

      if (l.empresa) {
        const { error: errE } = await supabase
          .from('contatos_empresas')
          .insert({ contato_id: novoContato.id, empresa: l.empresa, cargo: l.cargo || null })
        if (errE) erros.push(errE.message)
      }
      continue
    }

    if (l.status === 'nova_empresa') {
      // Apenas adicionar vínculo empresa ao contato existente
      if (l.empresa) {
        const { error } = await supabase
          .from('contatos_empresas')
          .insert({ contato_id: l.contatoId, empresa: l.empresa, cargo: l.cargo || null })
        if (error) erros.push(error.message)
      }
      continue
    }

    if (l.status === 'conflito' && l.acao === 'atualizar') {
      // Atualizar contato + cargo no vínculo
      const { error: errC } = await supabase
        .from('contatos')
        .update({
          nome:           l.nome || l.telefone,
          email:          l.email       || null,
          cpf_cnpj:       l.cpf_cnpj    || null,
          observacoes:    l.observacoes || null,
          atualizado_por: user.id,
          atualizado_em:  agora,
        })
        .eq('id', l.contatoId)
      if (errC) erros.push(errC.message)

      const { error: errE } = await supabase
        .from('contatos_empresas')
        .update({ cargo: l.cargo || null })
        .eq('id', l.conflictId)
      if (errE) erros.push(errE.message)
    }
  }

  return erros
}
```

- [ ] **Passo 2: Criar o arquivo de testes**

Crie `src/components/ContatosImport/ModalImportarPlanilha.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { normalizarLinhas } from './ModalImportarPlanilha'

describe('normalizarLinhas', () => {
  it('marca linha sem telefone como erro', () => {
    const resultado = normalizarLinhas([{ nome: 'João', telefone: '' }])
    expect(resultado[0].status).toBe('erro')
  })

  it('remove caracteres não-numéricos do telefone', () => {
    const resultado = normalizarLinhas([{ nome: 'Maria', telefone: '(61) 9 9999-1111' }])
    expect(resultado[0].telefone).toBe('61999991111')
    expect(resultado[0].status).toBe('novo_contato')
  })

  it('converte campos opcionais vazios para null', () => {
    const resultado = normalizarLinhas([{ nome: 'Ana', telefone: '5561888881111', empresa: '' }])
    expect(resultado[0].empresa).toBeNull()
    expect(resultado[0].cargo).toBeNull()
  })

  it('preserva empresa quando preenchida', () => {
    const resultado = normalizarLinhas([{ nome: 'Bob', telefone: '5521988882222', empresa: 'ACME', cargo: 'Sócio' }])
    expect(resultado[0].empresa).toBe('ACME')
    expect(resultado[0].cargo).toBe('Sócio')
  })

  it('inicializa conflictId, contatoId e acao como null', () => {
    const resultado = normalizarLinhas([{ nome: 'X', telefone: '5561999991111' }])
    expect(resultado[0].conflictId).toBeNull()
    expect(resultado[0].contatoId).toBeNull()
    expect(resultado[0].acao).toBeNull()
  })

  it('atribui idx sequencial', () => {
    const resultado = normalizarLinhas([
      { nome: 'A', telefone: '5561111111111' },
      { nome: 'B', telefone: '5562222222222' },
    ])
    expect(resultado[0].idx).toBe(0)
    expect(resultado[1].idx).toBe(1)
  })
})
```

- [ ] **Passo 3: Rodar os testes**

```bash
cd "Projeto CRM"
npm test -- --run src/components/ContatosImport/ModalImportarPlanilha.test.jsx
```

Saída esperada: **6 tests passed**.

- [ ] **Passo 4: Commit**

```bash
git add "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.jsx" \
        "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.test.jsx"
git commit -m "feat: helpers de importação multi-empresa (normalizarLinhas, parsearEProcessar, confirmarImportacao)"
```

---

## Task 6: ModalImportarPlanilha — UI completa (StepUpload + StepPrevia + modal)

**Files:**
- Modify: `src/components/ContatosImport/ModalImportarPlanilha.jsx` (adicionar componentes UI ao final)

- [ ] **Passo 1: Adicionar StepUpload após os helpers**

```jsx
// ── Step 1: Upload ────────────────────────────────────────────

function StepUpload({ onArquivo }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = useCallback((file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) return
    onArquivo(file)
  }, [onArquivo])

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current.click()}
        style={{
          border: `2px dashed ${dragging ? '#7a1e1e' : '#e0dcd8'}`,
          borderRadius: 10, padding: '40px 24px', textAlign: 'center',
          background: dragging ? '#fdf6f6' : '#fafaf9', cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <FileSpreadsheet size={32} color={dragging ? '#7a1e1e' : '#c5c0ba'} style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '0 0 4px' }}>
          Arraste sua planilha aqui
        </p>
        <p style={{ fontSize: 12, color: '#888480', margin: 0 }}>
          ou clique para selecionar · .xlsx ou .xls
        </p>
        <input
          ref={inputRef} type="file" accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); baixarModelo() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a1e1e', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Download size={12} /> Baixar modelo .xlsx
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Adicionar StepPrevia após StepUpload**

```jsx
// ── Step 2: Prévia ────────────────────────────────────────────

const STATUS_CONFIG = {
  novo_contato: { label: '✓ Novo contato', color: '#2d7a4f' },
  nova_empresa: { label: '✓ Nova empresa', color: '#1D4ED8' },
  erro:         { label: '✗ Sem telefone', color: '#b83232' },
}

function StepPrevia({ linhas, onChange }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e0dcd8', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f7f6f4' }}>
            {['Nome', 'Telefone', 'Empresa', 'Cargo', 'Status'].map(col => (
              <th key={col} style={{
                padding: '8px 10px', textAlign: 'left', color: '#888480',
                fontWeight: 600, borderBottom: '1px solid #e0dcd8', whiteSpace: 'nowrap',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.idx} style={{
              background: l.status === 'conflito' ? '#fff8ed' : l.status === 'erro' ? '#fff8f8' : '#fff',
              borderBottom: '1px solid #f0ede9',
            }}>
              <td style={{ padding: '7px 10px', color: '#1a1a1a' }}>{l.nome || '—'}</td>
              <td style={{ padding: '7px 10px', fontFamily: 'DM Mono, monospace', color: l.status === 'erro' ? '#b83232' : '#1a1a1a' }}>
                {l.telefone || '—'}
              </td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.empresa || '—'}</td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.cargo || '—'}</td>
              <td style={{ padding: '7px 10px' }}>
                {l.status === 'conflito' ? (
                  <div style={{ display: 'inline-flex', border: '1px solid #e0dcd8', borderRadius: 4, overflow: 'hidden', fontSize: 11 }}>
                    <button
                      onClick={() => onChange(l.idx, 'atualizar')}
                      style={{
                        padding: '3px 9px', border: 'none', cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
                        background: l.acao === 'atualizar' ? '#7a1e1e' : '#fff',
                        color:      l.acao === 'atualizar' ? '#fff'    : '#888480',
                      }}
                    >
                      Atualizar
                    </button>
                    <button
                      onClick={() => onChange(l.idx, 'ignorar')}
                      style={{
                        padding: '3px 9px', border: 'none', borderLeft: '1px solid #e0dcd8',
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
                        background: l.acao === 'ignorar' ? '#7a1e1e' : '#fff',
                        color:      l.acao === 'ignorar' ? '#fff'    : '#888480',
                      }}
                    >
                      Ignorar
                    </button>
                  </div>
                ) : (
                  <span style={{ color: STATUS_CONFIG[l.status]?.color, fontWeight: 600 }}>
                    {STATUS_CONFIG[l.status]?.label ?? l.status}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Passo 3: Adicionar o componente principal ModalImportarPlanilha ao final do arquivo**

```jsx
// ── Modal principal ───────────────────────────────────────────

export default function ModalImportarPlanilha({ onFechar, onImportado }) {
  const [step, setStep]               = useState(1)
  const [processando, setProcessando] = useState(false)
  const [linhas, setLinhas]           = useState([])
  const [confirmando, setConfirmando] = useState(false)
  const [erroMsg, setErroMsg]         = useState('')

  const handleArquivo = async (file) => {
    setProcessando(true); setErroMsg('')
    try {
      const resultado = await parsearEProcessar(file)
      setLinhas(resultado)
      setStep(2)
    } catch {
      setErroMsg('Erro ao ler a planilha. Verifique se o arquivo está no formato correto.')
    }
    setProcessando(false)
  }

  const handleToggle = (idx, acao) =>
    setLinhas(prev => prev.map(l => l.idx === idx ? { ...l, acao } : l))

  const handleConfirmar = async () => {
    setConfirmando(true); setErroMsg('')
    const erros = await confirmarImportacao(linhas)
    setConfirmando(false)
    if (erros.length > 0) { setErroMsg(erros[0]) }
    else { onImportado(); onFechar() }
  }

  const novosContatos  = linhas.filter(l => l.status === 'novo_contato').length
  const novasEmpresas  = linhas.filter(l => l.status === 'nova_empresa').length
  const conflitos      = linhas.filter(l => l.status === 'conflito').length
  const erros          = linhas.filter(l => l.status === 'erro').length
  const aImportar      = novosContatos + novasEmpresas +
                         linhas.filter(l => l.status === 'conflito' && l.acao === 'atualizar').length

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 740,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 14px', borderBottom: '1px solid #e0dcd8', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0e8e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={16} color="#7a1e1e" />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                Importar Planilha
              </h3>
              {step === 2 && (
                <p style={{ fontSize: 11, color: '#888480', margin: 0 }}>
                  {novosContatos} novos · {novasEmpresas} novas empresas · {conflitos} conflitos · {erros} erros
                </p>
              )}
            </div>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color="#888480" />
          </button>
        </div>

        {/* Steps bar */}
        <div style={{ padding: '10px 24px 0', display: 'flex', gap: 4, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: '#7a1e1e' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: step === 2 ? '#7a1e1e' : '#e0dcd8' }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {processando ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#888480', fontSize: 13 }}>
              Lendo planilha e verificando duplicatas...
            </div>
          ) : step === 1 ? (
            <StepUpload onArquivo={handleArquivo} />
          ) : (
            <StepPrevia linhas={linhas} onChange={handleToggle} />
          )}
          {erroMsg && <p style={{ fontSize: 12, color: '#b83232', marginTop: 10 }}>{erroMsg}</p>}
        </div>

        {/* Footer */}
        {step === 2 && !processando && (
          <div style={{
            padding: '14px 24px', borderTop: '1px solid #e0dcd8',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            <button
              onClick={() => { setStep(1); setLinhas([]) }}
              style={{
                padding: '8px 18px', borderRadius: 6, border: '1px solid #e0dcd8',
                background: '#fff', color: '#888480', fontSize: 13, cursor: 'pointer',
              }}
            >
              ← Voltar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={confirmando || aImportar === 0}
              style={{
                padding: '8px 20px', borderRadius: 6, border: 'none',
                background: confirmando || aImportar === 0 ? '#c5c0ba' : '#7a1e1e',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: confirmando || aImportar === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {confirmando ? 'Importando...' : `Confirmar ${aImportar} registro${aImportar !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Passo 4: Rodar os testes para garantir que nada quebrou**

```bash
npm test -- --run src/components/ContatosImport/ModalImportarPlanilha.test.jsx
```

Saída esperada: **6 tests passed**.

- [ ] **Passo 5: Commit**

```bash
git add "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.jsx"
git commit -m "feat: ModalImportarPlanilha completo — StepUpload, StepPrevia, modal (multi-empresa)"
```

---

## Task 7: ContatosPage — split-button + integração do modal de importação

**Files:**
- Modify: `src/pages/ContatosPage.jsx` (header e renderização do modal)

- [ ] **Passo 1: Adicionar imports**

No topo de `ContatosPage.jsx`, substitua a linha de import do lucide-react:

```jsx
// DE:
import { Users, Plus, Search, X, Edit2, Phone, Building2, Mail, FileText, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'

// PARA:
import { Users, Plus, Search, X, Edit2, Phone, Building2, Mail, FileText, ChevronDown, ChevronUp, MessageSquare, FileSpreadsheet } from 'lucide-react'
```

Adicione o import do modal após os outros imports (após `import { format }...`):

```jsx
import ModalImportarPlanilha from '@/components/ContatosImport/ModalImportarPlanilha'
```

- [ ] **Passo 2: Adicionar estados para dropdown e modal de importação na função ContatosPage**

Após `const [pagina, setPagina] = useState(0)`, adicione:

```jsx
const [dropdownAberto, setDropdownAberto] = useState(false)
const [modalImportar, setModalImportar]   = useState(false)
```

- [ ] **Passo 3: Substituir o botão "Novo Contato" pelo split-button**

Localize:
```jsx
<button
  onClick={() => setModal({})}
  style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 6, border: 'none',
    background: '#7a1e1e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }}
>
  <Plus size={14} /> Novo Contato
</button>
```

Substitua por:

```jsx
<div style={{ position: 'relative' }}>
  <div style={{ display: 'flex' }}>
    <button
      onClick={() => setModal({})}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: '6px 0 0 6px', border: 'none',
        background: '#7a1e1e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}
    >
      <Plus size={14} /> Novo Contato
    </button>
    <button
      onClick={() => setDropdownAberto(v => !v)}
      title="Importar via planilha"
      style={{
        padding: '7px 8px', borderRadius: '0 6px 6px 0', border: 'none',
        borderLeft: '1px solid #5a1616', background: '#7a1e1e', color: '#fff',
        cursor: 'pointer', display: 'flex', alignItems: 'center',
      }}
    >
      <ChevronDown size={13} />
    </button>
  </div>

  {dropdownAberto && (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
        onClick={() => setDropdownAberto(false)}
      />
      <div style={{
        position: 'absolute', top: 'calc(100% + 4px)', right: 0,
        background: '#fff', border: '1px solid #e0dcd8', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 100,
        minWidth: 190, overflow: 'hidden',
      }}>
        <button
          onClick={() => { setDropdownAberto(false); setModal({}) }}
          style={{
            width: '100%', padding: '10px 14px', border: 'none', background: 'none',
            textAlign: 'left', fontSize: 12, color: '#1a1a1a', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f7f6f4'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <Plus size={13} color="#888480" /> Cadastrar manualmente
        </button>
        <button
          onClick={() => { setDropdownAberto(false); setModalImportar(true) }}
          style={{
            width: '100%', padding: '10px 14px', border: 'none', background: 'none',
            textAlign: 'left', fontSize: 12, color: '#1a1a1a', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f7f6f4'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <FileSpreadsheet size={13} color="#888480" /> Importar via planilha
        </button>
      </div>
    </>
  )}
</div>
```

- [ ] **Passo 4: Adicionar renderização do ModalImportarPlanilha**

Logo antes do `{modal !== null && (` existente, adicione:

```jsx
{modalImportar && (
  <ModalImportarPlanilha
    onFechar={() => setModalImportar(false)}
    onImportado={carregar}
  />
)}
```

- [ ] **Passo 5: Verificar build**

```bash
cd "Projeto CRM"
npm run build
```

Saída esperada: build concluído sem erros de JSX/import.

- [ ] **Passo 6: Commit final**

```bash
git add "Projeto CRM/src/pages/ContatosPage.jsx"
git commit -m "feat: split-button e ModalImportarPlanilha integrados em ContatosPage"
```

---

## Task 8: Verificação manual + .gitignore

- [ ] **Passo 1: Adicionar .superpowers/ ao .gitignore se ainda não estiver**

```bash
grep -q "superpowers" "Projeto CRM/.gitignore" || echo ".superpowers/" >> "Projeto CRM/.gitignore"
```

- [ ] **Passo 2: Subir dev server e testar**

```bash
cd "Projeto CRM"
npm run dev
```

Roteiro de verificação em `http://localhost:5173/scont/crm/`:

1. **Contatos > Novo Contato (▾)**: dropdown aparece com "Cadastrar manualmente" e "Importar via planilha"
2. **Cadastrar manualmente**: modal abre com lista de empresas (+ Adicionar) em vez de campo único
3. **Importar via planilha**: modal abre no Passo 1
4. **Baixar modelo**: arquivo com colunas `nome, telefone, empresa, cargo, email, cpf_cnpj, observacoes`
5. **Upload de arquivo**: avança para Passo 2 com prévia
6. **Linha nova**: badge `✓ Novo contato`; linha mesma empresa: toggle; linha empresa nova: `✓ Nova empresa`; linha sem telefone: `✗ Sem telefone`
7. **Confirmar**: modal fecha, lista recarrega
8. **Expandir ContatoCard**: seção "Empresas" mostra lista das empresas vinculadas
9. **PainelDireito (CRM)**: ao abrir conversa, exibe todas as empresas do contato

- [ ] **Passo 3: Commit**

```bash
git add "Projeto CRM/.gitignore"
git commit -m "chore: ignorar .superpowers/ no gitignore"
```
