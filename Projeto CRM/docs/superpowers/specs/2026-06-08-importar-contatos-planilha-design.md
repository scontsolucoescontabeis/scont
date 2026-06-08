# Importação de Contatos via Planilha Excel (+ multi-empresa)

**Data:** 2026-06-08  
**Status:** Aprovado (rev 2 — inclui suporte a múltiplas empresas por número)

---

## Contexto e motivação

O schema original tem `contatos.telefone TEXT NOT NULL UNIQUE` e `contatos.empresa TEXT` — um número só pode estar em uma empresa. O usuário precisa que o mesmo número WhatsApp possa ser vinculado a múltiplas empresas (ex: contador que atende várias empresas, sócio de múltiplos CNPJs).

---

## Modelo de dados — mudança de schema

### Antes
```
contatos: id, telefone (UNIQUE), nome, empresa, cargo, email, cpf_cnpj, observacoes
```

### Depois
```
contatos:          id, telefone (UNIQUE), nome, email, cpf_cnpj, observacoes
contatos_empresas: id, contato_id (FK), empresa (NOT NULL), cargo, criado_em
                   UNIQUE (contato_id, empresa)
```

**Invariante:** telefone continua UNIQUE em `contatos` — uma pessoa física/número = um registro. As empresas associadas a essa pessoa ficam em `contatos_empresas`.

### Migration 012
1. Criar `contatos_empresas` com RLS e índice em `contato_id`
2. Migrar dados existentes: `INSERT INTO contatos_empresas (contato_id, empresa, cargo) SELECT id, empresa, cargo FROM contatos WHERE empresa IS NOT NULL`
3. `ALTER TABLE contatos DROP COLUMN empresa, DROP COLUMN cargo`

---

## Importação de contatos — fluxo revisado

### Entrada
Botão "Novo Contato" vira split-button com seta `▾`. Dropdown:
- `+ Cadastrar manualmente` → ModalContato existente (atualizado)
- `↑ Importar via planilha` → ModalImportarPlanilha

### Template
Colunas: `nome · telefone · empresa · cargo · email · cpf_cnpj · observacoes`  
Gerado client-side com `xlsx`. Disponível via link "Baixar modelo .xlsx" no modal.

### Passo 1 — Upload
Área drag & drop ou seleção de arquivo `.xlsx` / `.xls`.  
Ao selecionar → parsing imediato e avanço para Passo 2.

### Passo 2 — Prévia (4 estados possíveis por linha)

| Status | Condição | Comportamento |
|--------|----------|---------------|
| `✓ Novo contato` | telefone não existe em `contatos` | Cria contato + vincula empresa |
| `✓ Nova empresa` | telefone existe, empresa não está em `contatos_empresas` | Vincula empresa ao contato existente (automático, sem toggle) |
| Toggle `Atualizar / Ignorar` | telefone + empresa já existem em `contatos_empresas` | Pergunta ao usuário |
| `✗ Sem telefone` | campo telefone vazio | Sempre ignorado |

- Exibe todas as linhas com scroll interno
- Rodapé: `X novos contatos · Y novas empresas · Z conflitos · W erros`
- Botão "Confirmar N registros" (desabilitado se N = 0)

### Confirmação
- "Novo contato" → `INSERT contatos` + `INSERT contatos_empresas`
- "Nova empresa" → `INSERT contatos_empresas` (contato já existe, sem update)
- "Conflito Atualizar" → `UPDATE contatos` (nome/email/cpf_cnpj/obs) + `UPDATE contatos_empresas` (cargo)
- "Conflito Ignorar" / Erro → skip

---

## Mudanças no CRM Messenger

### ModalContato (ContatosPage)
- Remover campos `empresa` e `cargo` do formulário principal
- Adicionar seção "Empresas vinculadas" com lista dinâmica de pares (empresa, cargo):
  - Botão `+ Adicionar empresa`
  - Cada item pode ser removido
- Salvar: primeiro salva/atualiza `contatos`, depois sincroniza `contatos_empresas`

### ContatoCard (ContatosPage)
- Ao expandir: carregar `contatos_empresas` para esse contato
- Mostrar lista de chips por empresa (empresa + cargo)

### Busca (ContatosPage)
- Carregar `*, contatos_empresas(empresa, cargo)` via join
- Busca por nome, telefone, email: filtro no DB
- Busca por empresa: filtro client-side nos dados já carregados

### PainelDireito (CRM)
- Carregar `contatos_empresas` para o contato da conversa
- Substituir exibição de `contato.empresa` por lista de chips (empresa + cargo)

---

## Arquitetura de código

**Novo arquivo:**
- `src/components/ContatosImport/ModalImportarPlanilha.jsx`

**Arquivos modificados:**
- `supabase/migrations/012_contatos_multiempresa.sql` (novo)
- `src/pages/ContatosPage.jsx` — ModalContato, ContatoCard, busca, split-button
- `src/components/PainelDireito/PainelDireito.jsx` — exibição multi-empresa

**Dependências:** nenhuma nova. `xlsx ^0.18.5` já instalado.
