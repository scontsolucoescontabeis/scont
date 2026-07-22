# Importação de Empresas — novo layout (relatório do ERP)

## Contexto

A aba Administração → Importar Dados → Empresas lia um arquivo em formato
simples (cabeçalho na linha 1, 12 colunas). O arquivo real que alimenta a
importação passa a ser o relatório "Relação de Empresas" exportado
diretamente do ERP (`Relação de Empresas_PLATAFORMA HERBERT.xls`), que tem
um layout diferente: 7 linhas de título/paginação antes dos dados, colunas
de dados intercaladas com colunas em branco (resquício de células mescladas
do relatório), e duas colunas novas em relação ao modelo anterior:
Razão Social e Email.

O layout foi validado programaticamente contra as 550 linhas do arquivo de
exemplo (0 códigos/nomes/CNPJs vazios, 550 códigos únicos, e-mail presente
em 395 linhas).

## Mapeamento de colunas (posicional, 0-indexed, dados a partir da linha 7)

| índice | campo salvo |
|---|---|
| 0 | codigo_empresa |
| 2 | nome_empresa — vem da coluna **Razão Social** (índice 27), não de "Empresa" (índice 2), pois "Empresa" vem truncada em ~28% das linhas |
| 4 | cnpj |
| 5 | regime_enquadramento |
| 6 | inscricao_estadual |
| 7 | inscricao_municipal |
| 8 | municipio |
| 9 | status_situacao |
| 11 | data_cadastro |
| 15 | endereco |
| 17 | cep |
| 19 | cidade |
| 21 | (Data de Encerramento — ignorado, não importado) |
| 23, 25 | (códigos internos do ERP — ignorados, não importados) |
| 27 | razao_social → usado como `nome_empresa` |
| 30 | email (novo campo) |

Demais índices são colunas em branco (placeholders, não mapeados).

## Mudanças

1. **Schema**: nova migração `schema_rh_empresas_email.sql` adicionando
   `email TEXT` a `rh_empresas`.
2. **`lerPlanilha`/`importarEmpresas` (admin.js)**: troca do array de
   colunas e do `range` (de `1` para `7`) para refletir o novo layout;
   `nome_empresa` passa a vir de Razão Social; novo campo `email` mapeado
   e salvo (trim, null se vazio).
   A busca de UF por CEP (`_buscarUFsEmLotes` / `buscarUFPorCep`) e o
   comportamento de "acrescentar" (não sobrescrever UF já salva quando a
   busca falha) são mantidos exatamente como estão hoje — nenhuma
   alteração nessa parte do fluxo.
3. **`baixarModeloEmpresas()`**: removida (função e botão "⬇️ Modelo" no
   card de Empresas em admin.html), já que o fluxo real passa a ser
   exportar o relatório do ERP e importar diretamente — não faz mais
   sentido baixar um modelo manual incompatível com o layout esperado.
4. **UI**: lista de campos do card de Empresas em admin.html atualizada
   para incluir Email; contador "12 campos" → "13 campos".

## Fora de escopo

- Não adiciona coluna de Email na tabela de listagem de empresas da tela
  (`renderizarTabelaEmpresas`) — só no cadastro/importação.
- Não importa Data de Encerramento nem os códigos internos do ERP
  (decisão do usuário: ignorar).
