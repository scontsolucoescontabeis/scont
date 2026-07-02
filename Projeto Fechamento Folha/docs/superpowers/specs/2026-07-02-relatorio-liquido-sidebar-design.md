# Relatório Líquido como tela independente no sidebar — Quadrante

**Data:** 2026-07-02
**Escopo:** `quadrante.html`, `quadrante.js` (Quadrante Etiquetas, código 453)

## Problema

Hoje o "Relatório Líquido — Etiquetas Bancárias" (antigo Step 6) só é alcançável
passando pelo wizard de Processamento: Step 1 (upload da planilha de fechamento +
Competência) → Step 2 ou Step 3 → botão "🏷️ Etiquetas Bancárias". Ele lê a
Competência do campo de texto do Step 1 (`#competencia`).

Na prática, o Relatório Líquido é funcionalmente independente do restante do
wizard (não depende de `planilhaData`, do TXT gerado, nem de nenhum estado dos
Steps 1–3) — ele só usa a Competência digitada, a empresa selecionada e a
planilha de "Líquido" enviada ali mesmo. Forçar o usuário a passar pelo Step 1
toda vez que quiser gerar esse relatório é desnecessário.

## Objetivo

Tornar o Relatório Líquido acessível a qualquer momento direto pelo sidebar,
sem depender do wizard de Processamento.

## Design

### Sidebar

Novo item de navegação na seção "Ferramenta" de `quadrante.html`, entre
"Processamento" e "Configurações":

```html
<button class="sidebar-item" id="navLiquido" onclick="navegarPara('liquido')">
    <span class="sidebar-item-icon">🏷️</span> Relatório Líquido
</button>
```

Segue o mesmo padrão de `navProcessamento` / `navConfig` (nav-item que troca a
tela inteira, não uma âncora de página).

### Nova tela `#telaLiquido`

Sibling de `#telaProcessamento` e `#telaConfig`, mesmo padrão de visibilidade
via CSS:

```css
#telaLiquido { display: none; }
#telaLiquido.active { display: block; }
```

Conteúdo: o que hoje é `#step6` (painel de upload + painel de revisão),
migrado para dentro dessa tela, com as seguintes mudanças:

- Remove o badge numérico "6" do título — vira um card com ícone 🏷️ no lugar
  do número de step (mesmo estilo visual `.step-card` / `.step-title`, sem
  `.step-number`).
- Ganha campo de **Competência** próprio, desacoplado do Step 1:
  `id="competenciaLiquido"`, mesmo formato/validação MM/AAAA, **vazio por
  padrão** (usuário digita toda vez, evita gerar relatório com competência
  errada por herança de estado antigo).
- O botão "← Voltar" do painel de upload (hoje `onclick="voltarStep(3)"`) é
  **removido** — a tela não pertence mais ao wizard, não há "voltar" para
  nenhum step.
- O painel de revisão mantém o botão "← Nova Importação"
  (`voltarParaUploadLiquido()`) como está.

### JS (`quadrante.js`)

- `navegarPara(modo)` ganha um terceiro modo `'liquido'`:
  - Esconde `telaProcessamento` e `telaConfig`, mostra `telaLiquido` (classe
    `.active`, mesmo padrão de `telaConfig`).
  - Ativa visualmente `navLiquido` (`classList.toggle('active', modo ===
    'liquido')`), desativa os outros dois.
  - Chama uma nova função `iniciarLiquido()`: carrega a lista de empresas
    (`carregarEmpresasLiquido()`) e reseta para o painel de upload
    (`mostrarPainelLiquido('upload')`), análogo ao que `iniciarConfig()` faz
    para a tela de Configurações.
- `irStep6()` é **removida** (não existe mais Step 6 dentro do wizard).
- `gerarPDFLiquido()` passa a ler a competência de `#competenciaLiquido` em
  vez de `#competencia`.
- Toda referência a `labelCompetencia6` é removida (o campo de competência
  próprio da tela já mostra isso).
- `mostrarStep(n)` volta a controlar apenas `[1, 2, 3]` (remove o `6` do
  array `[1,2,3,6]`).
- `onEmpresaLiquidoAlterada()`, `carregarEmpresasLiquido()`,
  `mostrarPainelLiquido()`, `processarLiquido()`, `gerarPDFLiquido()` e todo o
  restante da lógica de processamento do Relatório Líquido permanecem
  inalterados — só a forma de entrar na tela e a origem do valor de
  competência mudam.

### HTML (`quadrante.html`)

- Remove os botões "🏷️ Etiquetas Bancárias" do `btn-group` do Step 2
  (linha ~197) e do Step 3 (linha ~221) — ficam redundantes com o item fixo
  no sidebar.
- Remove o `<div class="step-card" id="step6">` de dentro de
  `#telaProcessamento` e recria seu conteúdo como `<div id="telaLiquido">`
  irmão de `#telaProcessamento` / `#telaConfig`.

### Fora de escopo

- `trackfield.html`/`.js` e `ananke.html`/`.js` não têm essa feature hoje —
  nenhuma mudança nesses arquivos.
- Nenhuma mudança no schema do Supabase nem nas funções de geração do PDF em
  si (`gerarPDFLiquido`), além da troca da fonte da competência.

## Testes manuais (não há suíte automatizada neste projeto)

1. Abrir `quadrante.html` → sidebar mostra os 3 itens (Processamento,
   Relatório Líquido, Configurações), "Processamento" ativo por padrão.
2. Clicar em "Relatório Líquido" sem nunca ter tocado no Step 1 → tela abre
   direto no painel de upload, campo Competência vazio, seletor de empresa
   populado.
3. Tentar gerar sem preencher Competência → mesma validação de formato
   MM/AAAA de hoje.
4. Fluxo completo (selecionar empresa → upload planilha com aba "Líquido" →
   revisão → gerar PDF) continua funcionando igual a antes.
5. Alternar entre "Processamento", "Relatório Líquido" e "Configurações"
   várias vezes — cada tela mantém seu próprio estado (ex.: planilha do Step
   1 carregada não se perde ao visitar o Relatório Líquido e voltar).
6. Confirmar que os botões "🏷️ Etiquetas Bancárias" não aparecem mais dentro
   do Step 2/3.
