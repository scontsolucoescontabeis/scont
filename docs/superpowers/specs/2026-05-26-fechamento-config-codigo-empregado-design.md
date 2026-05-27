# Spec: Configuração de Código do Empregado no Fechamento de Folha

**Data:** 2026-05-26  
**Escopo:** quadrante.js, trackfield.js  
**Abordagem:** Opção A — tabela `fechamento_empregados_config`

## Problema

Ao processar planilha ou formulário, quando o nome do empregado não encontra correspondência em `rh_empregados` (exact + fuzzy ≥ 0.75), a linha fica com `codEmpregado = null` e é excluída do TXT. Não havia como corrigir isso na ferramenta.

## Solução

Nova tabela `fechamento_empregados_config` funciona como override por empresa. O `buscarCodigoEmpregado` a consulta com prioridade máxima, antes de `rh_empregados`. Inline no relatório: botão `+ Definir código` nas linhas sem empregado. Salvar persiste na tabela e aplica a todas as linhas do mesmo nome em tempo real.

## Tabela SQL

```sql
fechamento_empregados_config (
  id               UUID PK,
  codigo_empresa   TEXT NOT NULL,
  nome_planilha    TEXT NOT NULL,
  codigo_empregado TEXT NOT NULL,
  criado_em        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (codigo_empresa, nome_planilha)
)
```

## Fluxo de busca (atualizado)

1. `empregadosConfig[normNome]` — config da ferramenta (novo)
2. `funcionariosMap[normNome]` — rh_empregados exact
3. fuzzy ≥ 0.75 em `funcionariosMap`

## Componentes modificados

- `quadrante.js`: state `empregadosConfig`, `carregarEmpregadosConfig()`, `buscarCodigoEmpregado`, `processarPlanilha` (Promise.all), `processarEnvio` (Promise.all), `renderizarRelatorio` (botão + form inline), funções `abrirCadastroEmpregado / fecharCadastroEmpregado / salvarEmpregadoInline`
- `trackfield.js`: mesmas mudanças, adaptadas para estrutura multi-empresa por loja (`LOJAS_TF`)

## Comportamento ao salvar

- Upsert em `fechamento_empregados_config` (onConflict: `codigo_empresa, nome_planilha`)
- Atualiza `empregadosConfig` em memória
- Atualiza `l.codEmpregado` em **todas** as linhas com o mesmo nome
- Re-renderiza o relatório
