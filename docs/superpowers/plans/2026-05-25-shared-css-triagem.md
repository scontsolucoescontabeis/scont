# Shared CSS + Integração Triagem — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralizar variáveis CSS em um arquivo compartilhado e integrar o Projeto Triagem ao portal (card + registro no Supabase).

**Architecture:** Criar `shared.css` na raiz do portal com todas as variáveis CSS e classes utilitárias comuns, depois substituir o bloco `:root { ... }` duplicado em cada HTML por um `<link>`. Em paralelo, adicionar o SQL de registro da ferramenta Triagem na tabela `ferramentas` e instruir como executá-lo.

**Tech Stack:** HTML/CSS puro, Supabase (SQL Editor), sem build system.

---

## Mapa de Arquivos

| Arquivo | Ação |
|---------|------|
| `shared.css` | **Criar** — variáveis CSS e reset base |
| `portal.html` | **Modificar** — adicionar `<link>` para shared.css, remover bloco `:root` inline |
| `Projeto Triagem/index.html` | **Modificar** — adicionar `<link>` para shared.css, remover `:root` inline |
| `Projeto Triagem/triagem_dashboard.html` | **Modificar** — idem |
| `Projeto Triagem/upload.html` | **Modificar** — idem |
| `Projeto Fechamento Folha/index.html` | **Modificar** — idem (usa `styles.css` próprio; adicionar import lá) |
| `Projeto Gerenciador Formularios/index.html` | **Modificar** — idem |
| `_sql/021_add_triagem_ferramenta.sql` | **Criar** — INSERT da ferramenta Triagem na tabela `ferramentas` |

---

## Task 1: Criar shared.css com variáveis e reset

**Files:**
- Create: `shared.css`

- [ ] **Step 1: Criar o arquivo shared.css na raiz do portal**

Conteúdo exato a criar em `shared.css`:

```css
/* ============================================================
   SCONT Portal — Estilos compartilhados
   Importe este arquivo em todos os HTMLs do portal ANTES de
   qualquer <style> inline, para que variáveis fiquem disponíveis.
   ============================================================ */

:root {
  --primary:       #8B3A3A;
  --primary-hover: #6B2A2A;
  --primary-dark:  #6B2A2A;
  --primary-light: #A85252;
  --secondary:     #2C3E50;
  --secondary-light: #34495E;
  --success:       #27AE60;
  --danger:        #E74C3C;
  --warning:       #E67E22;
  --info:          #2980B9;
  --bg:            #F0F2F5;
  --bg-light:      #F8F9FA;
  --card:          #FFFFFF;
  --text:          #2C3E50;
  --text-light:    #5A6C7D;
  --muted:         #8B95A5;
  --border:        #E0E6ED;
  --border-light:  #EBF0F7;
  --shadow-sm:     0 2px 8px rgba(0,0,0,.06);
  --shadow-md:     0 4px 16px rgba(0,0,0,.10);
  --shadow-lg:     0 8px 24px rgba(0,0,0,.12);
  --radius:        10px;
  --radius-sm:     8px;
  --transition:    all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
               'Helvetica Neue', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}
```

- [ ] **Step 2: Verificar o arquivo criado**

Abrir `shared.css` no editor e confirmar que tem exatamente as variáveis listadas acima.

- [ ] **Step 3: Commit**

```bash
git add shared.css
git commit -m "feat: criar shared.css com variáveis CSS centralizadas do portal"
```

---

## Task 2: Aplicar shared.css em portal.html

**Files:**
- Modify: `portal.html`

- [ ] **Step 1: Adicionar o link para shared.css no `<head>` do portal.html**

Logo após a linha `<meta name="twitter:image" ...>` e antes do `<script src="supabase-config.js">`, inserir:

```html
<link rel="stylesheet" href="shared.css">
```

- [ ] **Step 2: Remover o bloco `:root { ... }` e o reset inline**

No `<style>` de `portal.html`, apagar estas linhas (já estão em shared.css):

```css
:root {
    --primary: #8B3A3A;
    --primary-hover: #6B2A2A;
    --primary-light: #A85252;
    --secondary: #2C3E50;
    --secondary-light: #34495E;
    --success: #27AE60;
    --danger: #E74C3C;
    --info: #3498DB;
    --bg: #F0F2F5;
    --bg-light: #F8F9FA;
    --card: #FFFFFF;
    --text: #2C3E50;
    --text-light: #5A6C7D;
    --muted: #8B95A5;
    --border: #E0E6ED;
    --border-light: #EBF0F7;
    --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
    --radius: 10px;
    --radius-sm: 8px;
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
}
```

Manter todo o restante do `<style>` (sidebar, cards, etc.).

- [ ] **Step 3: Abrir portal.html no navegador e verificar visual**

Confirmar que: sidebar está com gradiente correto (#8B3A3A → #2C3E50), cards de ferramentas aparecem, cores dos botões estão corretas.

- [ ] **Step 4: Commit**

```bash
git add portal.html
git commit -m "refactor: aplicar shared.css em portal.html, remover :root duplicado"
```

---

## Task 3: Aplicar shared.css nos HTMLs do Projeto Triagem

**Files:**
- Modify: `Projeto Triagem/index.html`
- Modify: `Projeto Triagem/triagem_dashboard.html`
- Modify: `Projeto Triagem/upload.html`

Os arquivos do Projeto Triagem estão um nível abaixo da raiz, então o path é `../shared.css`.

- [ ] **Step 1: Editar Projeto Triagem/index.html**

No `<head>`, após a linha do favicon e antes do primeiro `<script>`, adicionar:
```html
<link rel="stylesheet" href="../shared.css">
```

No bloco `<style>`, apagar o bloco `:root { ... }` e o reset (`* { margin:0... }`, `html { scroll-behavior... }`, `body { font-family... }`). Manter todos os outros estilos.

- [ ] **Step 2: Editar Projeto Triagem/triagem_dashboard.html**

Mesmo procedimento: adicionar `<link rel="stylesheet" href="../shared.css">` no `<head>`, remover o bloco `:root { ... }` e o reset básico do `<style>`.

- [ ] **Step 3: Editar Projeto Triagem/upload.html**

Mesmo procedimento.

- [ ] **Step 4: Abrir cada arquivo no navegador e conferir visual**

Verificar que não houve quebra de layout em nenhuma das três páginas.

- [ ] **Step 5: Commit**

```bash
git add "Projeto Triagem/index.html" "Projeto Triagem/triagem_dashboard.html" "Projeto Triagem/upload.html"
git commit -m "refactor: aplicar shared.css no Projeto Triagem"
```

---

## Task 4: Aplicar shared.css nos demais projetos com :root duplicado

**Files:**
- Modify: `Projeto Fechamento Folha/styles.css`
- Modify: `Projeto Gerenciador Formularios/index.html`

> Nota: `Projeto Fechamento Folha` usa um `styles.css` externo próprio. O import vai lá, não no HTML.

- [ ] **Step 1: Editar Projeto Fechamento Folha/styles.css**

No início do arquivo, antes do bloco `:root`, adicionar:
```css
@import url('../shared.css');
```

Em seguida, remover o bloco `:root { ... }` e o reset básico que estiver neste arquivo (manter apenas estilos específicos do Fechamento Folha).

- [ ] **Step 2: Editar Projeto Gerenciador Formularios/index.html**

No `<head>`, após o favicon, adicionar:
```html
<link rel="stylesheet" href="../shared.css">
```

Remover o bloco `:root { ... }` e reset do `<style>` inline.

- [ ] **Step 3: Verificar visual de ambos no navegador**

- [ ] **Step 4: Commit**

```bash
git add "Projeto Fechamento Folha/styles.css" "Projeto Gerenciador Formularios/index.html"
git commit -m "refactor: aplicar shared.css no Fechamento Folha e Gerenciador Formularios"
```

---

## Task 5: Criar SQL de registro da Triagem no portal

**Files:**
- Create: `_sql/021_add_triagem_ferramenta.sql`

- [ ] **Step 1: Criar o arquivo SQL**

Conteúdo exato:

```sql
-- ============================================================
-- Registra Triagem de Atendimentos na tabela ferramentas
-- Execute no SQL Editor do Supabase (projeto principal)
-- Idempotente: ON CONFLICT DO NOTHING
-- ============================================================

INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem)
VALUES (
  'Triagem de Atendimentos',
  'Importação e visualização de planilhas de triagem de demandas e atendimentos',
  '📋',
  './Projeto Triagem/index.html',
  TRUE,
  150
)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Executar o SQL no Supabase**

1. Acessar o painel do Supabase: https://supabase.com/dashboard/project/dsdqwigopzrdmxtmhsez
2. Ir em **SQL Editor**
3. Colar e executar o conteúdo do arquivo acima
4. Confirmar que retornou `INSERT 0 1` (ou `0` se já existir)

- [ ] **Step 3: Verificar no portal**

Fazer login no portal como admin e confirmar que o card "Triagem de Atendimentos" aparece na grade de ferramentas.

- [ ] **Step 4: Commit**

```bash
git add "_sql/021_add_triagem_ferramenta.sql"
git commit -m "feat: SQL para registrar Triagem de Atendimentos no portal"
```

---

## Task 6: Garantir que Projeto Triagem usa portal-auth-guard.js

**Files:**
- Modify: `Projeto Triagem/index.html`
- Modify: `Projeto Triagem/triagem_dashboard.html`
- Modify: `Projeto Triagem/upload.html`

O auth guard verifica se o usuário tem acesso à ferramenta via tabela `usuario_ferramentas`. Sem ele, qualquer um com a URL acessa.

- [ ] **Step 1: Verificar se index.html já usa o auth guard**

Abrir `Projeto Triagem/index.html` e procurar por `portal-auth-guard.js`. Se já estiver presente, pular para o próximo arquivo.

- [ ] **Step 2: Adicionar auth guard em qualquer arquivo que não o tenha**

No `<head>`, após o `<script src="../supabase-config.js">` e o CDN do Supabase, adicionar:
```html
<script src="../portal-auth-guard.js"></script>
```

E no início do script principal da página, adicionar a chamada:
```js
window.PortalAuthGuard.init(1);
```

(O `1` indica que o arquivo está 1 nível abaixo da raiz do portal.)

- [ ] **Step 3: Testar acessando sem login**

Abrir o arquivo diretamente no browser sem estar logado. Deve redirecionar para `login.html`.

- [ ] **Step 4: Commit**

```bash
git add "Projeto Triagem/index.html" "Projeto Triagem/triagem_dashboard.html" "Projeto Triagem/upload.html"
git commit -m "feat: adicionar auth guard nas páginas do Projeto Triagem"
```

---

## Verificação Final

- [ ] Abrir `portal.html` logado como admin — card "Triagem de Atendimentos" visível
- [ ] Clicar no card — redireciona para `Projeto Triagem/index.html` corretamente
- [ ] Mudar uma variável CSS em `shared.css` (ex: `--primary: red`) e confirmar que afeta todos os projetos
- [ ] Reverter a mudança de teste
- [ ] Confirmar que não há mais bloco `:root` duplicado nos HTMLs modificados
