# Botão "Gerar Lançamentos na Folha" (VT/VA) — tela "Gerar Benefícios"

Data: 2026-07-27
Arquivos afetados: `index.html`, `script.js`

## Contexto

A tela "Gerar Benefícios" já tinha "Gerar Recibo" e "Gerar Excel". Este design adiciona "📄 Gerar Lançamentos na Folha", que gera o TXT de lançamento (mesmo layout de `_linhasTxt`/`_montarLinhaTxt`) dos valores de VT e VA mensais já calculados na prévia (`diasPagar * vtDiario` / `diasPagar * vaDiario`), para qualquer empresa presente na prévia (não é uma regra específica de uma empresa, ao contrário da Ajuda de Custo ITC 350, [[project_rh_ajuda_custo_itc_350]]).

## Decisões confirmadas com o usuário

- **Rubricas separadas**: um campo de rubrica de VT e outro de VA — cada um vira sua própria linha no TXT por empregado.
- **Multi-empresa**: a prévia pode ter várias empresas ao mesmo tempo, e cada uma pode ter códigos de rubrica diferentes (`docs/rubricas-por-empresa.md`). O modal mostra uma tabela com 1 linha por empresa presente na prévia, cada uma com seus próprios campos de rubrica VT/VA.
- **Persistência por empresa**: as rubricas informadas são salvas em `rh_config_rubricas_txt` (eventos `beneficios_rub_vt`/`beneficios_rub_va`, mesma tabela/cache já usada por outras configurações de rubrica) e pré-preenchidas da próxima vez, mas continuam editáveis a cada geração.
- **Competência dentro do TXT**: competência do recibo menos 1 mês — mesma regra já aplicada à Ajuda de Custo ITC (`_mesAnterior`, helper generalizado a partir de `_competenciaTxtAjudaCustoITC`).

## Fluxo

1. `abrirModalLancamentoVaVt()`: valida que há prévia com empregados selecionados; agrupa por `codigo_empresa`; busca config salva de cada empresa (`_buscarConfigRubricas`); renderiza a tabela de rubricas (pré-preenchida) e abre `#lancamentoVaVtModal`.
2. "Pré-visualizar" (`gerarPreviewLancamentoVaVt`): valida que todas as empresas têm VT e VA preenchidos; monta o TXT (`_construirTxtLancamentoVaVt`) e mostra a prévia (`_mostrarPrevia`, mesmo padrão dos outros TXTs).
3. "Baixar TXT" (`baixarLancamentoVaVt`): revalida, baixa o arquivo (`Lancamentos_VT_VA_MM-AAAA.txt`, MM/AAAA já como competência -1 mês) e só então grava as rubricas em `rh_config_rubricas_txt` (`_salvarRubricasVaVtPorEmpresa`, invalidando o cache por empresa).

## Fora de escopo

- Nenhum controle de "já gerado" (diferente da Ajuda de Custo ITC) — pode ser gerado quantas vezes o usuário quiser, sem persistência de estado além das rubricas.
- Nenhuma mudança nos botões "Gerar Recibo"/"Gerar Excel" existentes.
