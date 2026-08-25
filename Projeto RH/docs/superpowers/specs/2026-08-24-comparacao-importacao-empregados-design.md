# Comparação na importação de Empregados + hand-off para Escala/VT-VA

## Contexto

A tela "Importar Dados" da Administração do RH (`admin.html`/`admin.js`) importa a
listagem de empregados (`rh_empregados`) direto de um arquivo Excel, sem mostrar o que
mudou em relação ao que já está cadastrado. Pedido: ao importar, comparar a listagem
atual com a importada e destacar divergências — principalmente empregados novos e
mudança de `situacao` — e, para os novos, abrir a configuração de escala e valores de
VT/VA (telas que vivem em outra ferramenta do portal, o Controle de Frequência,
`index.html`/`script.js`).

## Escopo da comparação

Só as empresas presentes no arquivo importado (`codigo_empresa` das linhas válidas),
não a base inteira. Três grupos:

- **Novos** — `codigo_empresa+codigo_empregado` não existe na base para aquela empresa.
- **Situação alterada** — existe, mas `situacao` (texto normalizado/trim) difere.
- **Sumiram da lista** — está na base para aquela empresa, mas não aparece no arquivo
  importado. Informativo (mostra a `situacao` atual), sem ação associada — decisão
  explícita do usuário: pode ser desligamento não formalizado ou erro no arquivo de
  origem, mas a ferramenta não presume qual.

## Fluxo em `admin.js` / `admin.html`

1. `importarEmpregadosIndividual` já parseia e filtra as linhas válidas (`rows`).
2. Novo: antes do modal de modo de importação (mesclar/substituir), roda
   `_compararListagemEmpregados(rows)` — busca em `rh_empregados` os empregados atuais
   das empresas envolvidas e monta os 3 grupos acima.
3. Se houver qualquer divergência, mostra o modal novo `modalComparacaoEmpregados`
   (3 seções expansíveis, com contagem) com botões "Cancelar" / "Continuar →". Sem
   divergência nenhuma, pula direto pro fluxo atual (não interrompe o caminho feliz).
4. Fluxo de salvamento (modo de importação, upsert em lote) não muda.
5. Depois de salvar com sucesso, se houve **novos**: grava a lista
   (`codigo_empresa`, `codigo_empregado`, `nome_empregado`, `criado_em`) no
   `localStorage['rh_pendentes_config_novos']` (mesclando com pendências já existentes,
   sem duplicar) e renderiza um resumo com botão "Configurar agora →"
   (`<a href="index.html">`) — mesma pasta, mesmo padrão dos links entre ferramentas do
   portal (ex.: Diário → Mapeamento).

Sem SQL novo — só leitura de colunas já existentes.

## Fluxo em `script.js` / `index.html` (Controle de Frequência)

1. No `DOMContentLoaded`, depois de `carregarEmpresas()`, roda
   `_carregarPendentesConfigNovos()`:
   - Lê e poda o `localStorage` (entradas com mais de 30 dias são descartadas).
   - Para o que sobrou, consulta `rh_escala_trabalho` e `rh_valores_va_vt` das empresas
     envolvidas e remove da pendência quem já tem **as duas** configuradas (por
     qualquer caminho, não só pelo banner) — evita alerta caindo no vazio.
   - Persiste a lista podada de volta no `localStorage`.
2. Se sobrou algo, mostra um banner no topo (mesmo padrão visual do banner de fila de
   lote já existente, `filaLoteGrupoBanner`) com contagem + empresas envolvidas e 3
   botões: "Configurar Escala", "Configurar Valores VT/VA", "Dispensar".
3. **Configurar Escala** → `mostrarTela('escalaScreen')`, marca as checkboxes das
   empresas pendentes, preenche a competência com o mês atual e chama `gerarEscala()`.
   As linhas que batem com a pendência vêm com `expandido:true` e um selo "🆕 novo" na
   listagem.
4. **Configurar Valores VT/VA** → abre `abrirModalValoresVaVt()` já na primeira empresa
   pendente (o modal é por empresa, isso já é assim hoje); linhas pendentes ganham o
   mesmo selo "🆕 novo". Se houver mais de uma empresa pendente, um aviso pede pra
   repetir a ação pra próxima depois de salvar essa.
5. **Dispensar** limpa a pendência inteira do `localStorage` sem configurar nada —
   saída manual pra quem já resolveu por fora ou não quer ser lembrado.

Sem tabela nova — reaproveita `rh_escala_trabalho`/`rh_valores_va_vt` já existentes só
pra leitura, e o `localStorage` só carrega a lista de pendência (mesmo padrão já usado
pra `rh_ultima_importacao_*`).

## Fora de escopo

- Empregados "sumidos" não geram nenhuma ação automática (nem no relatório, nem
  cross-page) — é só um alerta informativo dentro do modal de comparação.
- Não há tentativa de detectar/128 diferenciar "demitido de verdade" x "erro no
  arquivo" — fica a critério de quem está importando.
- Sem testes automatizados novos: a lógica de diff é simples o bastante (comparação de
  Sets/Maps) pra não justificar extrair um módulo puro testável como
  `escala-calculo.js`; a integração é toda de UI (dois arquivos HTML/JS grandes), que já
  não tem cobertura automatizada hoje.
