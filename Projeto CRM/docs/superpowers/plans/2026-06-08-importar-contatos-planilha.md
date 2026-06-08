# Importar Contatos via Planilha Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar à tela de Contatos a capacidade de importar contatos a partir de uma planilha `.xlsx`/`.xls`, com prévia de validação e detecção de duplicatas por telefone+empresa.

**Architecture:** Novo componente `ModalImportarPlanilha.jsx` auto-contido que faz parsing client-side (xlsx já instalado), detecta conflitos via Supabase, e executa bulk insert + updates individuais. `ContatosPage.jsx` recebe um split-button com dropdown para acessar o modal.

**Tech Stack:** React 18, Vite, `xlsx ^0.18.5`, `@supabase/supabase-js ^2.47`, Vitest + Testing Library (jsdom), lucide-react.

---

## File Map

| Ação | Caminho |
|------|---------|
| **Criar** | `src/components/ContatosImport/ModalImportarPlanilha.jsx` |
| **Criar** | `src/components/ContatosImport/ModalImportarPlanilha.test.jsx` |
| **Modificar** | `src/pages/ContatosPage.jsx` |

---

## Task 1: Funções auxiliares + testes unitários

**Files:**
- Create: `src/components/ContatosImport/ModalImportarPlanilha.jsx` (só helpers por ora)
- Create: `src/components/ContatosImport/ModalImportarPlanilha.test.jsx`

### Passo 1 — Criar o arquivo com as funções auxiliares exportadas

Crie `src/components/ContatosImport/ModalImportarPlanilha.jsx` com o conteúdo abaixo. Exporte as funções auxiliares para que os testes possam importá-las diretamente (o componente padrão será adicionado na Task 4).

```jsx
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
      status:      telefone ? 'novo' : 'erro',
      conflictId:  null,
      acao:        null,
    }
  })
}

export async function parsearEProcessar(file) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  const linhas = normalizarLinhas(rawRows)

  const telValidos = [...new Set(linhas.filter(l => l.status !== 'erro').map(l => l.telefone))]
  if (telValidos.length > 0) {
    const { data: existentes } = await supabase
      .from('contatos')
      .select('id, telefone, empresa')
      .in('telefone', telValidos)

    ;(existentes ?? []).forEach(e => {
      linhas.forEach(l => {
        if (l.status === 'erro') return
        if (l.telefone === e.telefone && (l.empresa ?? '') === (e.empresa ?? '')) {
          l.status = 'conflito'
          l.conflictId = e.id
          l.acao = 'atualizar'
        }
      })
    })
  }

  return linhas
}

export async function confirmarImportacao(linhas) {
  const { data: { user } } = await supabase.auth.getUser()
  const agora = new Date().toISOString()

  const toInsert = linhas
    .filter(l => l.status === 'novo')
    .map(({ nome, telefone, empresa, cargo, email, cpf_cnpj, observacoes }) => ({
      nome: nome || telefone,
      telefone,
      empresa:        empresa     || null,
      cargo:          cargo       || null,
      email:          email       || null,
      cpf_cnpj:       cpf_cnpj    || null,
      observacoes:    observacoes || null,
      atualizado_por: user.id,
      atualizado_em:  agora,
    }))

  const toUpdate = linhas.filter(l => l.status === 'conflito' && l.acao === 'atualizar')

  const erros = []

  if (toInsert.length > 0) {
    const { error } = await supabase.from('contatos').insert(toInsert)
    if (error) erros.push(error.message)
  }

  for (const l of toUpdate) {
    const { error } = await supabase
      .from('contatos')
      .update({
        nome:           l.nome || l.telefone,
        empresa:        l.empresa     || null,
        cargo:          l.cargo       || null,
        email:          l.email       || null,
        cpf_cnpj:       l.cpf_cnpj    || null,
        observacoes:    l.observacoes || null,
        atualizado_por: user.id,
        atualizado_em:  agora,
      })
      .eq('id', l.conflictId)
    if (error) erros.push(error.message)
  }

  return erros
}
```

### Passo 2 — Criar o arquivo de testes

Crie `src/components/ContatosImport/ModalImportarPlanilha.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { normalizarLinhas } from './ModalImportarPlanilha'

describe('normalizarLinhas', () => {
  it('marca linha sem telefone como erro', () => {
    const resultado = normalizarLinhas([{ nome: 'João', telefone: '' }])
    expect(resultado[0].status).toBe('erro')
    expect(resultado[0].telefone).toBe('')
  })

  it('remove caracteres não-numéricos do telefone', () => {
    const resultado = normalizarLinhas([{ nome: 'Maria', telefone: '(61) 9 9999-1111' }])
    expect(resultado[0].telefone).toBe('61999991111')
    expect(resultado[0].status).toBe('novo')
  })

  it('converte campos opcionais vazios para null', () => {
    const resultado = normalizarLinhas([{ nome: 'Ana', telefone: '5561888881111', empresa: '' }])
    expect(resultado[0].empresa).toBeNull()
  })

  it('preserva empresa quando preenchida', () => {
    const resultado = normalizarLinhas([{ nome: 'Bob', telefone: '5521988882222', empresa: 'ACME' }])
    expect(resultado[0].empresa).toBe('ACME')
  })

  it('atribui idx sequencial', () => {
    const resultado = normalizarLinhas([
      { nome: 'A', telefone: '5561111111111' },
      { nome: 'B', telefone: '5562222222222' },
    ])
    expect(resultado[0].idx).toBe(0)
    expect(resultado[1].idx).toBe(1)
  })

  it('inicializa conflictId e acao como null', () => {
    const resultado = normalizarLinhas([{ nome: 'X', telefone: '5561999991111' }])
    expect(resultado[0].conflictId).toBeNull()
    expect(resultado[0].acao).toBeNull()
  })
})
```

### Passo 3 — Rodar os testes e confirmar que passam

```bash
cd "Projeto CRM"
npm test -- --run src/components/ContatosImport/ModalImportarPlanilha.test.jsx
```

Saída esperada: **6 tests passed**.

### Passo 4 — Commit

```bash
git add "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.jsx" \
        "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.test.jsx"
git commit -m "feat: helpers de importação de contatos via planilha (normalizarLinhas, parsearEProcessar, confirmarImportacao)"
```

---

## Task 2: Sub-componente StepUpload

**Files:**
- Modify: `src/components/ContatosImport/ModalImportarPlanilha.jsx` (adicionar StepUpload após os helpers)

### Passo 1 — Adicionar StepUpload ao arquivo

Adicione imediatamente após os helpers (antes do `export default`, que ainda não existe):

```jsx
import { useState, useRef, useCallback } from 'react'
import { X, FileSpreadsheet, Download } from 'lucide-react'
```

Coloque esses imports no **topo do arquivo**, substituindo o `import * as XLSX` já existente pelo bloco completo:

```jsx
import { useState, useRef, useCallback } from 'react'
import { X, FileSpreadsheet, Download } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'
```

Em seguida, após `confirmarImportacao`, adicione:

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
        <FileSpreadsheet
          size={32}
          color={dragging ? '#7a1e1e' : '#c5c0ba'}
          style={{ marginBottom: 12 }}
        />
        <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '0 0 4px' }}>
          Arraste sua planilha aqui
        </p>
        <p style={{ fontSize: 12, color: '#888480', margin: 0 }}>
          ou clique para selecionar · .xlsx ou .xls
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          onClick={e => { e.stopPropagation(); baixarModelo() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#7a1e1e', fontSize: 12,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <Download size={12} /> Baixar modelo .xlsx
        </button>
      </div>
    </div>
  )
}
```

### Passo 2 — Commit

```bash
git add "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.jsx"
git commit -m "feat: StepUpload — área de drag & drop e download de modelo"
```

---

## Task 3: Sub-componente StepPrevia

**Files:**
- Modify: `src/components/ContatosImport/ModalImportarPlanilha.jsx` (adicionar StepPrevia após StepUpload)

### Passo 1 — Adicionar StepPrevia após StepUpload

```jsx
// ── Step 2: Prévia ────────────────────────────────────────────

function StepPrevia({ linhas, onChange }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e0dcd8', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#f7f6f4' }}>
            {['Nome', 'Telefone', 'Empresa', 'E-mail', 'Status'].map(col => (
              <th
                key={col}
                style={{
                  padding: '8px 10px', textAlign: 'left', color: '#888480',
                  fontWeight: 600, borderBottom: '1px solid #e0dcd8', whiteSpace: 'nowrap',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr
              key={l.idx}
              style={{
                background: l.status === 'conflito' ? '#fff8ed' : l.status === 'erro' ? '#fff8f8' : '#fff',
                borderBottom: '1px solid #f0ede9',
              }}
            >
              <td style={{ padding: '7px 10px', color: '#1a1a1a' }}>{l.nome || '—'}</td>
              <td style={{ padding: '7px 10px', fontFamily: 'DM Mono, monospace', color: l.status === 'erro' ? '#b83232' : '#1a1a1a' }}>
                {l.telefone || '—'}
              </td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.empresa || '—'}</td>
              <td style={{ padding: '7px 10px', color: '#888480' }}>{l.email || '—'}</td>
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
                ) : l.status === 'novo' ? (
                  <span style={{ color: '#2d7a4f', fontWeight: 600 }}>✓ Novo</span>
                ) : (
                  <span style={{ color: '#b83232', fontWeight: 600 }}>✗ Sem telefone</span>
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

### Passo 2 — Commit

```bash
git add "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.jsx"
git commit -m "feat: StepPrevia — tabela de validação com toggle Atualizar/Ignorar"
```

---

## Task 4: Componente principal ModalImportarPlanilha

**Files:**
- Modify: `src/components/ContatosImport/ModalImportarPlanilha.jsx` (adicionar export default no final)

### Passo 1 — Adicionar o componente principal ao final do arquivo

```jsx
// ── Modal principal ───────────────────────────────────────────

export default function ModalImportarPlanilha({ onFechar, onImportado }) {
  const [step, setStep]             = useState(1)
  const [processando, setProcessando] = useState(false)
  const [linhas, setLinhas]         = useState([])
  const [confirmando, setConfirmando] = useState(false)
  const [erroMsg, setErroMsg]       = useState('')

  const handleArquivo = async (file) => {
    setProcessando(true)
    setErroMsg('')
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
    setConfirmando(true)
    setErroMsg('')
    const erros = await confirmarImportacao(linhas)
    setConfirmando(false)
    if (erros.length > 0) {
      setErroMsg(erros[0])
    } else {
      onImportado()
      onFechar()
    }
  }

  const novos     = linhas.filter(l => l.status === 'novo').length
  const conflitos = linhas.filter(l => l.status === 'conflito').length
  const erros     = linhas.filter(l => l.status === 'erro').length
  const aImportar = novos + linhas.filter(l => l.status === 'conflito' && l.acao === 'atualizar').length

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 700,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 14px', borderBottom: '1px solid #e0dcd8', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: '#f0e8e8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileSpreadsheet size={16} color="#7a1e1e" />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                Importar Planilha
              </h3>
              {step === 2 && (
                <p style={{ fontSize: 11, color: '#888480', margin: 0 }}>
                  {novos} novo{novos !== 1 ? 's' : ''} · {conflitos} conflito{conflitos !== 1 ? 's' : ''} · {erros} erro{erros !== 1 ? 's' : ''}
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
          {erroMsg && (
            <p style={{ fontSize: 12, color: '#b83232', marginTop: 10 }}>{erroMsg}</p>
          )}
        </div>

        {/* Footer (passo 2 apenas) */}
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
              {confirmando ? 'Importando...' : `Confirmar ${aImportar} contato${aImportar !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

### Passo 2 — Rodar os testes para garantir que nada quebrou

```bash
npm test -- --run src/components/ContatosImport/ModalImportarPlanilha.test.jsx
```

Saída esperada: **6 tests passed**.

### Passo 3 — Commit

```bash
git add "Projeto CRM/src/components/ContatosImport/ModalImportarPlanilha.jsx"
git commit -m "feat: ModalImportarPlanilha completo — upload, prévia, detecção de conflitos e importação"
```

---

## Task 5: Modificar ContatosPage.jsx — split-button + modal

**Files:**
- Modify: `src/pages/ContatosPage.jsx:299-427`

### Passo 1 — Adicionar imports no topo de ContatosPage.jsx

Substitua a linha de import do lucide-react existente:

```jsx
// DE:
import { Users, Plus, Search, X, Edit2, Phone, Building2, Mail, FileText, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'

// PARA:
import { Users, Plus, Search, X, Edit2, Phone, Building2, Mail, FileText, ChevronDown, ChevronUp, MessageSquare, FileSpreadsheet } from 'lucide-react'
```

Adicione o import do modal logo abaixo dos imports existentes (após `import { format }...`):

```jsx
import ModalImportarPlanilha from '@/components/ContatosImport/ModalImportarPlanilha'
```

### Passo 2 — Adicionar estado para dropdown e modal de importação

Na função `ContatosPage`, após a declaração `const [pagina, setPagina] = useState(0)`, adicione:

```jsx
const [dropdownAberto, setDropdownAberto] = useState(false)
const [modalImportar, setModalImportar]   = useState(false)
```

### Passo 3 — Substituir o botão "Novo Contato" pelo split-button

Localize este trecho (linha ~358-368):

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
  <div style={{ display: 'flex', borderRadius: 6, overflow: 'visible' }}>
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
      {/* overlay para fechar ao clicar fora */}
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

### Passo 4 — Adicionar renderização do ModalImportarPlanilha

Logo antes do `{modal !== null && (` existente (linha ~417), adicione:

```jsx
{modalImportar && (
  <ModalImportarPlanilha
    onFechar={() => setModalImportar(false)}
    onImportado={carregar}
  />
)}
```

### Passo 5 — Rodar o build para verificar sem erros de compilação

```bash
cd "Projeto CRM"
npm run build
```

Saída esperada: build concluído sem erros de TypeScript/JSX. Avisos de `use client` ou de tamanho de bundle são aceitáveis.

### Passo 6 — Commit

```bash
git add "Projeto CRM/src/pages/ContatosPage.jsx"
git commit -m "feat: split-button com dropdown para importar planilha em ContatosPage"
```

---

## Task 6: Verificação manual + .gitignore

**Files:**
- Modify: `.gitignore` (adicionar entrada para `.superpowers/`)

### Passo 1 — Verificar se `.superpowers/` já está no .gitignore

```bash
grep -n "superpowers" "Projeto CRM/.gitignore" 2>/dev/null || echo "não encontrado"
```

Se não encontrado, adicione ao final do `.gitignore` do projeto:

```
.superpowers/
```

### Passo 2 — Subir o servidor de dev e testar manualmente

```bash
cd "Projeto CRM"
npm run dev
```

Abra `http://localhost:5173/scont/crm/` (ou a porta que o Vite indicar) e siga o roteiro:

1. Navegue até **Contatos**
2. Clique no `▾` ao lado de "Novo Contato" — dropdown deve aparecer com "Cadastrar manualmente" e "Importar via planilha"
3. Clique em "Importar via planilha" — modal deve abrir no Passo 1
4. Clique em "Baixar modelo .xlsx" — arquivo `modelo-contatos.xlsx` deve ser baixado com as 7 colunas
5. Preencha o modelo com 2-3 contatos (inclua um já existente para testar conflito) e salve
6. Arraste ou selecione o arquivo no modal — deve avançar para Passo 2 com a tabela de prévia
7. Linha nova: badge `✓ Novo`; linha conflitante: toggle `Atualizar / Ignorar`; linha sem telefone: `✗ Sem telefone`
8. Clique "Confirmar" — modal fecha, lista recarrega com os novos contatos

### Passo 3 — Commit final

```bash
git add "Projeto CRM/.gitignore"
git commit -m "chore: ignorar pasta .superpowers/ gerada pelo visual companion"
```
