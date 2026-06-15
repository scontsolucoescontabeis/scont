# Design: Configuração de Rubricas por Empresa (Controle de Frequência)

**Data:** 2026-06-15  
**Status:** Aprovado

---

## Contexto

O controle de frequência já possui modais para geração de TXT de folha de pagamento. Atualmente, os códigos de rubricas são salvos em `localStorage` como um único objeto global (`rh_txt_rubricas`) — sem diferenciação por empresa. O usuário precisa reconfigurar os códigos manualmente a cada empresa.

Este design adiciona uma tela de configurações que permite salvar os códigos de rubricas por empresa no Supabase, com pré-preenchimento automático ao abrir os modais de geração de TXT.

---

## Banco de Dados

### Nova tabela: `rh_config_rubricas_txt`

```sql
CREATE TABLE public.rh_config_rubricas_txt (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa TEXT NOT NULL,
    evento         TEXT NOT NULL,
    codigo_rubrica TEXT NOT NULL DEFAULT '',
    tipo_valor     TEXT NOT NULL DEFAULT 'horas',
    CONSTRAINT rh_config_rub_txt_uniq UNIQUE (codigo_empresa, evento)
);

ALTER TABLE public.rh_config_rubricas_txt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_config_rub_txt: leitura autenticado"
    ON public.rh_config_rubricas_txt FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_config_rub_txt: escrita autenticado"
    ON public.rh_config_rubricas_txt FOR ALL TO authenticated
    USING (TRUE) WITH CHECK (TRUE);
```

**Eventos fixos** (`evento` TEXT):

| evento       | Label na UI           | tipo_valor padrão |
|--------------|-----------------------|-------------------|
| `horasTrab`  | Horas Trabalhadas     | `horas`           |
| `he50`       | Horas Extras 50%      | `horas`           |
| `he100`      | Horas Extras 100%     | `horas`           |
| `noturno`    | Adicional Noturno     | `horas`           |
| `atraso`     | Atraso                | `horas`           |
| `falta`      | Falta (dias)          | `dias`            |

Upsert por `(codigo_empresa, evento)`. Salvar uma empresa upserta todos os 6 eventos de uma vez, incluindo os que têm `codigo_rubrica` vazio (`''`). Isso significa: uma vez que a empresa tem qualquer config salva, o pré-preenchimento usa os valores do Supabase (podendo ser vazio para eventos não configurados), e não o fallback do localStorage. O fallback do localStorage só ocorre quando a empresa não tem nenhum registro em `rh_config_rubricas_txt`.

---

## Tela de Configurações (modal)

### Acesso

Botão **"⚙️ Configurar Rubricas"** na tela inicial (`selectionScreen`), abaixo dos botões "Baixar Modelo Excel" e "Exportar TXT". Mesmo estilo `btn btn-secondary`.

### Comportamento do modal

1. Ao abrir: campos de rubrica aparecem vazios (aguardando seleção de empresa).
2. Ao selecionar empresa no campo de busca (autocomplete igual ao já existente na tela principal): busca config no Supabase e preenche os 6 campos (código + tipo) se houver registro; caso contrário, campos ficam vazios.
3. **Salvar**: faz upsert dos 6 eventos para a empresa selecionada. Mostra feedback "✅ Configuração salva!". Invalida cache da empresa no `_cacheConfigRubricas`.
4. **Limpar Empresa**: deleta todos os registros da empresa em `rh_config_rubricas_txt` e limpa os campos. Pede confirmação antes.
5. **Cancelar / [×]**: fecha sem salvar.

### Layout

```
┌──────────────────────────────────────────────────┐
│  ⚙️ Configurar Rubricas por Empresa         [×]  │
├──────────────────────────────────────────────────┤
│  Empresa: [campo de busca / autocomplete ▼]      │
│                                                  │
│  EVENTO              CÓDIGO DA RUBRICA   TIPO    │
│  Horas Trabalhadas   [_______]           [▼]     │
│  Horas Extras 50%    [_______]           [▼]     │
│  Horas Extras 100%   [_______]           [▼]     │
│  Adicional Noturno   [_______]           [▼]     │
│  Atraso              [_______]           [▼]     │
│  Falta (dias)        [_______]           [▼]     │
│                                                  │
│  ℹ️ Campos vazios = sem pré-preenchimento         │
├──────────────────────────────────────────────────┤
│  [Limpar Empresa]    [Cancelar]  [💾 Salvar]     │
└──────────────────────────────────────────────────┘
```

IDs dos campos: `cfgRub_empresa` (busca), `cfgRub_horasTrab` + `cfgTipo_horasTrab`, `cfgRub_he50` + `cfgTipo_he50`, etc. (prefixo `cfgRub_` / `cfgTipo_` para não conflitar com `exp*` e `res*` existentes).

---

## Pré-preenchimento nos modais de TXT

### Cache por sessão

Variável `window._cacheConfigRubricas = {}` (objeto keyed por `codigo_empresa`). Carregada sob demanda. Invalidada (delete da key) ao salvar novas configs no modal de configurações.

### Função auxiliar

```js
async function _buscarConfigRubricas(codigoEmpresa) {
    // Retorna objeto { horasTrab: {cod, tipo}, he50: {...}, ... }
    // ou null se não houver config
}
```

### Modal "Exportar TXT" (`exportTxtModal`) — função `abrirModalExportacaoTXT()`

- Após abrir o modal e carregar o localStorage atual (comportamento mantido), se `state.codigoEmpresa` tiver valor: chama `_buscarConfigRubricas(state.codigoEmpresa)` e sobrescreve os campos `exp*` com os valores retornados.
- Se não há empresa na sessão ou não há config: campos ficam com o valor do localStorage (comportamento atual).

### Modal "Gerar TXT" (`txtRubricasModal`) — função `abrirModalTxtResultados()`

- Após abrir e carregar localStorage, chama `_buscarConfigRubricas(state.codigoEmpresa)` e preenche campos `res*`.
- Sempre há empresa na sessão neste ponto (o usuário já passou pela tela de seleção).

### Prioridade de preenchimento

1. Config do Supabase para a empresa (sobrescreve)
2. localStorage global (fallback se não há config no Supabase)
3. Vazio (se não há nem localStorage)

O usuário pode editar qualquer campo após o pré-preenchimento — o fluxo de geração de TXT não muda.

---

## Schema SQL para o arquivo `schema_rh.sql`

Adicionar a tabela `rh_config_rubricas_txt` ao final do schema, antes da seção de RESUMO, seguindo o mesmo padrão das outras tabelas. Também atualizar o bloco de comentário "RESUMO DAS TABELAS".

---

## Arquivos afetados

| Arquivo        | Mudança                                                          |
|----------------|------------------------------------------------------------------|
| `schema_rh.sql`| Adicionar definição de `rh_config_rubricas_txt` e RLS           |
| `index.html`   | Botão na tela inicial + modal de configurações de rubricas       |
| `script.js`    | Cache, função `_buscarConfigRubricas`, pré-fill nos 2 modais, funções do novo modal |
