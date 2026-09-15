# Hub "Departamento Pessoal" + Configurações centralizadas

## Contexto

Hoje o Departamento Pessoal está espalhado em 7+ cards separados no portal
principal (`ferramentas`), cada um com suas próprias configurações internas
(VA/VT, Grupos de Empresas, cadastros de Empresas/Empregados/Rubricas/
Feriados, identificação de quem tem folha contratada). Isso replica o
problema que já foi resolvido para o Departamento Contábil (Central do
Departamento Contábil, em `Projeto Onboarding Contabil/`).

Objetivo: criar um hub único "Departamento Pessoal" no portal, agrupando
todas as ferramentas de DP, com uma tela "Configurações" que concentra a
edição de todos os parâmetros hoje espalhados — sem alterar nenhuma lógica
de cálculo, processamento ou tratamento de dados.

## Fora de escopo (decisões explícitas)

- **Nenhuma lógica de cálculo/processamento muda.** Toda extração de UI
  reaproveita as mesmas funções e as mesmas tabelas Supabase já existentes,
  só troca o arquivo/tela onde o código roda.
- **A seção "⚙️ Configurações" (jornada/turno) do Controle de Frequência
  (`Projeto RH/index.html:192-243`) NÃO é movida.** Investigação confirmou
  que esse painel está acoplado ao estado da aba/empresa aberta na sessão
  de processamento (`state`, `script.js:11-33` e `254-480`), não é uma
  config global independente, e não estava na lista de exemplos do
  usuário (VA/VT, Grupos de Empresas, Folha Contratada). Mover exigiria
  redesenhar o fluxo de abertura de aba — risco desnecessário fora do
  pedido original.
- **A ferramenta de exportação em lote por grupo** (`baixarModelosGrupo`,
  `abrirExportacaoTxtGrupo`, `processarLoteGrupo`, `script.js:2774-3082`)
  não é configuração, é ferramenta de trabalho — permanece no Controle de
  Frequência, apenas passa a listar os grupos em modo leitura (via função
  de leitura já existente), já que a criação/edição de grupos se muda para
  a tela central.

## Arquitetura do hub

Pasta reaproveitada: `Projeto Departamento Pessoal/` (já existe).

- Conteúdo atual (fluxograma Mermaid de processos — rescisão, admissão,
  férias) é renomeado para **Fluxos Operacionais**:
  `index.html`→`fluxos-operacionais.html`, `app.js`→`fluxos-operacionais.js`,
  `data/rescisao.js` mantido. Nenhuma lógica tocada.
- Novo `index.html` na mesma pasta vira o **hub**, seguindo o padrão visual
  e estrutural da Central do Departamento Contábil (sidebar fixa, logo,
  botão "🏠 Voltar ao Portal", `portal-auth-guard.js`, cards `<a href>`
  reais — sem iframe), com 8 cards:

  1. Controle de Frequência - Ponto → `../Projeto RH/index.html`
  2. Lançamentos de Folha → `../Projeto RH/lancamentos.html`
  3. Simulador de Folha de Pagamento → `../Projeto Simulador Folha/index.html`
  4. Fechamento Folha de Pagamento → `../Projeto Fechamento Folha/index.html`
  5. Validação de Fechamento de Folha → `../Projeto Validação Fechamento Folha/index.html`
  6. Calendário da Folha → `../Projeto Calendario Folha/index.html`
  7. Fluxos Operacionais → `fluxos-operacionais.html`
  8. **Configurações** → `configuracoes.html` (novo, ver seção dedicada)

## Registro no portal (`public.ferramentas`)

- A linha existente `nome='Departamento Pessoal'` tem `url_base`
  repontado para `./Projeto Departamento Pessoal/index.html` (mantém
  `usuario_ferramentas` de quem já tinha acesso — acesso único ao hub,
  sem granularidade interna por sub-ferramenta, igual ao padrão do
  Contábil).
- As linhas das outras 6 ferramentas + `'Admin – Módulo RH'` recebem
  `ativa=false` (soft-deactivate, não delete — preserva histórico e
  permite reverter). Nomes exatos a confirmar em produção antes do UPDATE
  (ex. a Controle de Frequência está cadastrada como `'Folha de Ponto'`).
- Script: `_sql/reorganizar_ferramentas_dp.sql`, idempotente.
- "Calendário da Folha" não tem script `_sql/add_*` versionado (parece
  cadastro manual) — confirmar nome exato na tabela antes de gerar o
  script de desativação; ela mesma **não** é desativada (continua card
  dentro do hub, só sai da tela principal).

## Tela "Configurações" — desenho

Página única (`configuracoes.html` + JS), com navegação por abas internas
(reaproveitando o layout de abas que já existe em `admin.html`), reunindo:

| Aba | Origem (hoje) | O que migra | Tabelas |
|---|---|---|---|
| VA/VT | `Projeto RH/index.html:1459-1490` (modal) + `script.js:3267-3396` (`abrirModalValoresVaVt`, `fecharModalValoresVaVt`, `filtrarEmpresasValoresVaVt`, `selecionarEmpresaValoresVaVt`, `_carregarTabelaValoresVaVt`, `salvarValoresVaVt`) | HTML do modal + as 6 funções, adaptadas para tela cheia em vez de modal | `rh_valores_va_vt` |
| Grupos de Empresas | `script.js:2534-2774` (`carregarGrupos`, `renderizarListaGrupos`, `novoGrupo`, `selecionarGrupo`, `salvarGrupo`, `excluirGrupo`, `_renderGrupoDetalhe`) + tela `gruposScreen` (`index.html:~270`) | Todo o bloco de CRUD (lista + detalhe + salvar/excluir) | `rh_grupos_empresas`, `rh_grupos_empresas_itens` |
| Empresas / Empregados / Rubricas / Feriados | `Projeto RH/admin.html` + `admin.js` (4357 linhas, uso exclusivo confirmado — nenhum outro arquivo carrega `admin.js`) | Arquivo inteiro vira a base da tela (abas já existem: Empresas ~171, Empregados ~223, Rubricas ~473, Feriados) | `rh_empresas`, `rh_empregados`, `rh_rubricas`, `rh_feriados` (v1/v2) |
| Folha Contratada + Responsáveis | `Projeto Fechamento Folha/controle.html` + `controle.js` (1235 linhas, zero acoplamento externo confirmado — nenhum outro cálculo de fechamento lê essas tabelas fora deste arquivo) | Arquivo inteiro | `fechamento_empresas_config`, `fechamento_empresas_responsaveis` |

As telas antigas (aba "Grupos de Empresas" do Controle de Frequência,
`admin.html`, `controle.html`) deixam de existir nesses locais depois da
migração — a lógica é a mesma, só passa a rodar dentro de
`configuracoes.html`. Link da sidebar de "Controle de Fechamento" dentro
do próprio hub do Fechamento Folha é removido (a função vira
responsabilidade exclusiva da Configurações central).

### Ponto de atenção: fluxo de "pendências" de VA/VT

Hoje, ao processar uma folha, o Controle de Frequência oferece um atalho
("💰 Configurar Valores VT/VA", `_irConfigurarValoresVaVtPendentes()`,
`script.js:5513`) que abre o modal já com a empresa pendente selecionada.
Depois da migração, esse botão passa a navegar (link real) para
`configuracoes.html?tab=va-vt&empresa=<codigo>`, e a aba VA/VT lê esses
parâmetros de URL para pré-selecionar a empresa — preserva o atalho sem
duplicar a UI.

### Riscos técnicos e mitigação

- **Colisão de nomes de função/globais**: `script.js`, `admin.js` e
  `controle.js` cada um define seus próprios helpers (ex. `mostrarMensagem`,
  `state`) com implementações possivelmente diferentes. Ao juntar trechos
  de 3 arquivos numa única página, preciso conferir cada função copiada
  quanto a colisão de nome e, se houver, renomear/namespacar
  (ex. `vavt_mostrarMensagem`) sem alterar o comportamento.
- **Cliente Supabase único**: confirmado que `script.js`, `admin.js` e
  `controle.js` usam o mesmo `../supabase-config.js` (mesmo projeto
  Supabase) — a página unificada usa uma única instância de
  `supabaseClient`, sem risco de misturar projetos diferentes.
- **Dependências de globais do `state`**: os trechos de VA/VT e Grupos
  usam `state.empresas` e outros globais definidos no topo de `script.js`.
  A implementação decide se recria essas variáveis localmente na nova
  página (buscando as mesmas tabelas) ou reaproveita como estão — não
  bloqueia a spec, é decisão de implementação a ser resolvida por leitura
  direta do código no momento da extração.

## Testes

- Navegar portal → card "Departamento Pessoal" → hub carrega → cada um
  dos 8 cards abre a tela correta e ela continua funcionando como antes
  (smoke test em pelo menos: Controle de Frequência processando uma folha
  já existente, Fechamento Folha abrindo uma empresa).
- Em "Configurações": editar um valor de VA/VT, criar/editar um grupo de
  empresas, marcar/desmarcar "possui folha" para uma empresa — confirmar
  que o dado gravado é o mesmo lido pelas ferramentas que dependem dele
  (ex. Controle de Frequência exibindo o grupo criado; Fechamento Folha
  respeitando a flag de folha contratada).
- Confirmar que usuário que já tinha acesso a "Departamento Pessoal" no
  portal continua entrando sem erro de permissão, e que os antigos 6
  cards + "Admin – Módulo RH" não aparecem mais na tela principal para
  nenhum usuário.
- Rodar o SQL de reorganização de `ferramentas` contra o Supabase (requer
  aprovação e credencial do usuário).
