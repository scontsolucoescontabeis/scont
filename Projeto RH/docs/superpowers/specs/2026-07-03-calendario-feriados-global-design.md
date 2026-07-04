# Design: Calendário de Feriados Global

**Data:** 2026-07-03
**Arquivos principais:** `index.html`, `script.js`, migração SQL

---

## Problema

Hoje os feriados vivem apenas em `state.feriados`, inicializado com uma lista fixa hardcoded (`carregarFeriadosPadrao()`) e, ao processar/salvar uma folha, gravado como `feriados_json` dentro de cada linha de `rh_saves` (por empresa + trabalhador + competência). Um feriado cadastrado manualmente durante o lançamento só existe dentro daquele lote específico — não é compartilhado entre empresas nem entre competências diferentes da mesma empresa. Ao começar uma nova folha em branco, o feriado customizado desaparece (volta só para a lista fixa), dando a impressão de que "não foi salvo".

---

## Solução

### 1. Nova tabela `rh_feriados` (calendário global)

```sql
CREATE TABLE IF NOT EXISTS public.rh_feriados (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data        TEXT NOT NULL,       -- "DD/MM" (recorrente todo ano) ou "DD/MM/AAAA" (específico)
    descricao   TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Migração inclui os 8 feriados fixos hoje hardcoded (`carregarFeriadosPadrao`) como registros iniciais (`DD/MM`, recorrentes), para que nada se perca na transição. RLS seguindo o mesmo padrão das demais tabelas do projeto (leitura/escrita para usuários autenticados).

### 2. Cadastro/edição passam a ser globais e imediatos

- Ao carregar a ferramenta (`DOMContentLoaded`), `state.feriados` é populado com um `SELECT * FROM rh_feriados` — não mais com a lista fixa no código. Vale para qualquer empresa/competência a partir daí.
- `adicionarFeriado()` passa a ser assíncrona: grava direto via `INSERT` em `rh_feriados` (`.select()` para obter o `id` gerado), e só então atualiza `state.feriados` e re-renderiza a tabela. Erro de rede/validação mostra mensagem e não altera o estado local.
- `removerFeriado(id)` passa a ser assíncrona: pede confirmação (`mostrarConfirmacao`, mesmo padrão já usado em "Remover Folha") antes de `DELETE` em `rh_feriados`; só remove de `state.feriados` após sucesso.
- `state.feriados` passa a guardar também o `id` de cada feriado (`{ id, data, descricao }`), necessário para o `DELETE` e para a chave do botão de remover na tabela.

### 3. Folhas já processadas mantêm o retrato da época

Nenhuma mudança na gravação por lote: `processarFolhaComSalvamento` continua gravando `feriados_json: JSON.stringify(state.feriados)` em cada linha de `rh_saves`, exatamente como hoje. Ao retomar uma folha já salva (`carregarSaveEspecifico`, nas duas ocorrências existentes no código), `state.feriados` continua sendo carregado do `feriados_json` daquele registro — não do calendário global — preservando o histórico mesmo que o calendário mude depois.

Só o caminho de **folha nova em branco** (`iniciarNovaFolhaEmBranco` / carregamento inicial da página) passa a refletir o calendário global atual em vez da lista fixa.

---

## O que NÃO muda

- Estrutura e conteúdo de `feriados_json` dentro de `rh_saves` (continua sendo um snapshot por lote).
- Lógica de verificação de feriado por dia (`isFeriado = state.feriados.some(...)`), que já suporta os dois formatos de data (`DD/MM` e `DD/MM/AAAA`).
- Fluxo de retomada de folhas já salvas.

---

## Arquivos Impactados

- Criar: migração SQL para `rh_feriados` (com seed dos 8 feriados fixos).
- Modify: `Projeto RH/schema_rh.sql` (documentar a nova tabela).
- Modify: `Projeto RH/script.js`:
  - Inicialização (`DOMContentLoaded`) — trocar `carregarFeriadosPadrao()` por uma busca assíncrona em `rh_feriados`.
  - `adicionarFeriado()` — passa a gravar no banco antes de atualizar o estado local.
  - `removerFeriado()` — passa a confirmar e apagar no banco antes de atualizar o estado local; assinatura muda de `(data)` para `(id)`.
  - `renderizarTabelaFeriados()` — botão de remover passa a usar `id` em vez de `data`.
  - `state.feriados` — cada item passa a ter `id`.
