# Design: Coluna UF na tabela de Empresas (derivada do CEP)

**Data:** 2026-07-14
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/admin.html`, `Projeto RH/admin.js`, novo `Projeto RH/schema_rh_empresas_uf.sql`

---

## Contexto

O painel de Administração do módulo de RH (aba Empresas) lista as empresas cadastradas em `rh_empresas`, incluindo Endereço, CEP e Cidade — mas não a UF. Os dados de endereço chegam hoje só via importação de planilha (`importarEmpresas` em `admin.js`); não existe tela de edição individual de empresa, apenas cadastro simples (código + nome) e reimportação em massa.

Objetivo: acrescentar uma coluna UF na tabela, preenchida automaticamente a partir do CEP — sem exigir que o usuário digite a UF na planilha.

---

## Escopo confirmado com o usuário

- Fonte da UF: API **ViaCEP** (`https://viacep.com.br/ws/{cep}/json/`, CORS liberado, sem chave), com **fallback** para uma tabela local de faixas numéricas de CEP → UF quando a API falhar ou não resolver.
- A UF é **persistida no Supabase** (nova coluna `uf` em `rh_empresas`) já no momento da **importação** da planilha de Empresas — não é um valor calculado só na exibição.
- Para as empresas já cadastradas antes desta feature (sem `uf` salva), um botão **"Preencher UF pendentes"** dispara a busca e grava direto no banco.
- Sem tela de edição manual da UF — consistente com o padrão atual (campos de endereço só entram via planilha).

---

## 1. Migração (`schema_rh_empresas_uf.sql`)

```sql
ALTER TABLE public.rh_empresas ADD COLUMN IF NOT EXISTS uf TEXT;
```

Seguindo o padrão dos demais arquivos `schema_rh_*.sql`: comentário indicando execução manual no SQL Editor do Supabase.

---

## 2. Busca CEP → UF

Nova função `buscarUFPorCep(cep)`:

1. Normaliza o CEP (remove não-dígitos); se não tiver 8 dígitos, retorna `null` sem chamar a API.
2. Tenta `fetch` no ViaCEP; se a resposta tiver `uf` (e não `erro: true`), retorna a UF.
3. Se a chamada falhar (erro de rede, timeout, `erro: true`), cai no fallback: `buscarUFPorFaixaCep(cepNumerico)`, uma tabela local de faixas dos Correios (ex.: 01000000–19999999 → SP, 20000000–28999999 → RJ, ..., 90000000–99999999 → RS).
4. Se nada resolver, retorna `null` (célula exibe "—", igual aos outros campos vazios).

---

## 3. Importação (`importarEmpresas`)

- Para cada linha com `cep` preenchido, busca a UF **antes** de inserir/upsertar, em lotes pequenos (5 por vez, com pequena pausa entre lotes) para não sobrecarregar a API em importações grandes.
- Modo **substituir**: linhas antigas apagadas e recriadas — `uf` sempre reflete a busca desta importação (inclusive `null` se não resolver).
- Modo **acrescentar** (upsert): se a busca falhar para uma linha, a chave `uf` é **omitida** do objeto daquela linha, para que o Postgres preserve o valor já persistido em vez de sobrescrever com `null`.

---

## 4. Botão "Preencher UF pendentes"

- Na aba Empresas, próximo aos controles de importação.
- Busca em `_todasEmpresas` as empresas com `cep` preenchido e `uf` vazia.
- Roda a mesma busca em lotes, e grava cada resultado com `update({ uf }).eq('codigo_empresa', codigo)`.
- Reaproveita `setStatusImport`/`setProgresso` (ENT = `'Empresas'`) para feedback visual.
- Ao final, recarrega a tabela (`carregarEmpresas()`).

---

## 5. Interface

- Nova `<th>UF</th>` após "Cidade" no cabeçalho da tabela de Empresas (`admin.html`).
- Nova `<td>` em `renderizarTabelaEmpresas` (`admin.js`) exibindo `fmt(e.uf)`.
- Ajuste dos `colspan` (linha "Carregando..." e "Nenhuma empresa encontrada") para o novo total de colunas.
- Planilha-modelo de importação (`baixarModeloEmpresas`) **não** ganha coluna de UF — ela continua sendo derivada do CEP, nunca digitada pelo usuário.
