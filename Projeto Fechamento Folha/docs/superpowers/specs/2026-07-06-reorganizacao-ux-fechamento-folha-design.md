# Reorganização de UX — Fechamento Folha de Pagamento

**Data:** 2026-07-06
**Escopo:** `index.html`, `formulario_quadrante.html`, `formulario_trackfield.html`,
`formulario_ananke.html` (suíte completa da ferramenta Fechamento Folha, exceto
`dashboard.html` — app não relacionado, fora de escopo).

## Problema

1. As telas da ferramenta não tinham a mesma "sensação" de zoom/fonte —
   `index.html`/`quadrante.html`/`trackfield.html`/`ananke.html`/`ferias.html`/
   `fluxo.html` usam `styles.css` (corpo 14px, `line-height: 1.6`), enquanto os
   3 formulários manuais (`formulario_quadrante/trackfield/ananke.html`) são
   standalone, com sistema visual próprio e corpo em 13px.
2. `index.html` tinha uma tela de Configurações própria (gerenciador genérico
   de rubricas em `fechamento_rubricas_config`, sem `valor_cota` nem os
   recursos especiais de R$87/VT/VA), redundante e mais pobre que as
   Configurações já existentes em cada ferramenta (Quadrante/Track&Field/
   Anankê). O sidebar de `index.html` também separava "Processamento" e
   "Formulários" em duas seções paralelas, obrigando o usuário a caçar o par
   Planilha/Formulário da mesma empresa em lugares diferentes do menu.

## O que foi feito

### 1. Correção pontual de fonte nos 3 formulários

`formulario_quadrante.html`, `formulario_trackfield.html`,
`formulario_ananke.html`: `body { font-size: 13px }` → `14px`, alinhando com
a base do `styles.css` usada no resto da suíte.

### 2. `index.html` — remoção da tela de Configurações legada

Removida a tela `#telaConfig` (formulário + tabela de rubricas genéricas),
o botão "⚙️ Configurações" do sidebar, e todo o JS associado
(`navegarPara`, `iniciarConfig`, `carregarEmpresasConfig`, `carregarRubricas`,
`salvarRubrica`, `toggleAtivo`, `deletarRubrica`, `mostrarStatusConfig`,
cliente Supabase local `sb`). Os dados em `fechamento_rubricas_config` não
são afetados — só a interface duplicada foi removida. Cada ferramenta
continua com sua própria tela de Configurações (mais completa).

### 3. `index.html` — sidebar reagrupado por empresa

Trocado:
```
Processamento          Formulários
  Quadrante Etiquetas     Quadrante
  Track & Field           Track & Field
  Anankê                  Anankê
```
por:
```
Quadrante Etiquetas
  📊 Planilha · 📄 Formulário
Track & Field
  📊 Planilha · 📄 Formulário
Anankê
  📊 Planilha · 📄 Formulário
─────────────
Ferramentas
  Fluxo de Fechamento · Programação de Férias
```
Mesmo agrupamento que o grid de cards da tela inicial já usava — agora o
sidebar segue a mesma lógica.

## O que foi deliberadamente NÃO feito (e por quê)

Os 3 formulários (`formulario_*.html`) **não** ganharam a sidebar/layout
completo de `styles.css` nesta passada. Eles são uma grade densa de
lançamento (linhas fixas de ~42px, cabeçalho e toolbar `sticky`, largura
otimizada para caber muitas colunas), um paradigma de UI bem diferente do
wizard em steps das outras ferramentas. Encaixar uma sidebar fixa de 260px
ali é uma mudança estrutural de layout, não só de tokens de cor/fonte — e é
um risco real de regressão visual (quebra de densidade, overflow de linhas)
que só dá para validar olhando a tela renderizada. Como não há ferramenta de
navegador automatizada disponível neste ambiente para captura de tela, essa
unificação completa fica para uma próxima etapa, feita com revisão visual
direta (você abrindo localmente e me apontando o que ajustar).

## Teste manual

1. Abrir `index.html` → sidebar mostra Quadrante/Track&Field/Anankê como
   grupos com "Planilha"/"Formulário", sem mais "Configurações" nem
   "Processamento"/"Formulários" separados.
2. Abrir cada `formulario_*.html` → texto levemente maior (14px), mas layout
   e densidade da grade permanecem os mesmos de antes.
3. Confirmar que `quadrante.html`/`trackfield.html`/`ananke.html` continuam
   com suas próprias Configurações (Rubricas / Informações Bancárias / R$87
   / VT-VA), sem nenhuma perda de funcionalidade.
