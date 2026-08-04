# Design: Múltiplas Jornadas de Trabalho por Empresa (Configurações)

**Data:** 2026-08-04
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/index.html`, `Projeto RH/script.js`, `Projeto RH/schema_rh_jornadas.sql`

---

## Contexto

Na tela de Configurações do Controle de Frequência (modal `configRubricasModal`, aberto pelo item "⚙️ Configurações" da sidebar), a seção "Jornada de Trabalho" hoje guarda **um único** conjunto de valores por empresa (horas diárias, exceção de sexta, exceção de sábado, "sábado sempre extra"), persistido em `rh_config_rubricas_txt` com `evento = 'jornada_diaria'` etc. Esse conjunto único é aplicado igualmente a **todos** os empregados da empresa no cálculo de horas extras/faltantes da Folha de Ponto (`calcularFolha` em `script.js`).

Isso é um conceito diferente de `rh_jornada_trabalho` (horário de entrada/saída por dia da semana, usado em Administração e na geração de Folhas de Ponto em branco) — este design não mexe nessa tabela.

## Pedido

Permitir cadastrar mais de uma jornada (nome + horas diárias + exceções sexta/sábado) por empresa, e associar cada empregado à jornada correta. O cálculo de horas extras/faltantes passa a usar a jornada do empregado, em vez de um valor único para toda a empresa.

## Decisões (confirmadas com o usuário)

- **Fallback implícito:** empregados sem associação explícita continuam usando a "Jornada Padrão" da empresa (os campos que já existem hoje). Não há obrigatoriedade de associar todo mundo — comportamento atual não muda para quem não usa a funcionalidade nova.
- **Local único de gestão:** cadastro de jornadas extras e associação empregado→jornada vivem só dentro do modal de Configurações (mesmo lugar da Jornada Padrão). Não há indicador da jornada em uso nas abas de preenchimento da Folha de Ponto.
- **Fora do escopo:** `rh_jornada_trabalho` (entrada/saída por dia, Administração/Gerar Folhas de Ponto) não é afetada.

---

## Modelo de dados

### Nova tabela `rh_jornadas`

Uma linha por jornada nomeada cadastrada por uma empresa (a "Jornada Padrão" continua vivendo em `rh_config_rubricas_txt`, sem migração).

```sql
CREATE TABLE public.rh_jornadas (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa        TEXT NOT NULL,
    nome                  TEXT NOT NULL,
    jornada_diaria        TEXT NOT NULL,           -- 'HH:MM'
    jornada_sexta_ativa   BOOLEAN NOT NULL DEFAULT FALSE,
    jornada_sexta         TEXT,                    -- 'HH:MM' ou NULL
    jornada_sabado_ativa  BOOLEAN NOT NULL DEFAULT FALSE,
    jornada_sabado        TEXT,
    sabado_sempre_extra   BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_jornadas_empresa_nome_unique UNIQUE (codigo_empresa, nome)
);
```

### Nova coluna em `rh_empregados`

```sql
ALTER TABLE public.rh_empregados
    ADD COLUMN jornada_id UUID REFERENCES public.rh_jornadas(id) ON DELETE SET NULL;
```

`jornada_id IS NULL` (padrão) = empregado usa a Jornada Padrão da empresa. Excluir uma jornada cadastrada automaticamente volta os empregados associados a ela para o padrão (via `ON DELETE SET NULL`).

---

## UI — modal Configurações (`configRubricasModal`)

O card atual "Jornada de Trabalho" é renomeado para **"Jornada Padrão"** (mesmos campos, mesmo comportamento).

### Nova seção "Outras Jornadas"

- Tabela das jornadas cadastradas da empresa selecionada: nome, horas diárias, indicação de exceções, ações (✏️ editar / 🗑️ excluir).
- Botão "+ Nova Jornada" abre um formulário inline (reaproveita os mesmos campos da Jornada Padrão: nome, horas diárias, checkbox+campo sexta, checkbox+campo sábado, sábado sempre extra) com botões "Salvar Jornada" / "Cancelar". O mesmo formulário serve para criar e editar (campo hidden com o id, vazio = nova).
- Exclusão pede confirmação (padrão `mostrarConfirmacao` já usado no projeto).

### Nova seção "Associar Empregados"

- Só é renderizada com conteúdo quando a empresa selecionada tem pelo menos uma jornada extra cadastrada; caso contrário mostra uma dica ("Cadastre uma jornada acima para poder associar empregados a ela.").
- Lista os empregados da empresa (mesma fonte/filtro de `rh_empregados` usado em "Valores de VT/VA por Empregado": exclui `tipo_empregado = 'Contribuinte'` e `situacao = 'Demitido'`), cada um com um `<select>`: opção "Padrão da empresa" (valor vazio) + uma opção por jornada cadastrada.
- Botão "💾 Salvar Associações" independente do botão principal "Salvar" do modal (grava direto em `rh_empregados.jornada_id`, tabela diferente de `rh_config_rubricas_txt`).

---

## Cálculo (`script.js`)

### `_resolverJornadaEmpregado(empregadoId)`

Nova função auxiliar: busca o empregado em `state.empregadosDisponiveis`; se tiver `jornada_id` e a jornada existir em `state.jornadasDisponiveis`, retorna os valores dela; senão retorna os valores da Jornada Padrão (`state.jornada`, `state.jornadaSexta`, etc. — mesmos campos de hoje).

### `calcularFolha(folha)`

Passa a resolver a jornada pelo `folha.empregadoId` via `_resolverJornadaEmpregado`, em vez de ler `state.jornada*`/`state.sabadoSempreExtra` diretamente. Resto do motor de cálculo não muda.

### `processarFolhaComSalvamento` → `dadosParaSalvar`

Cada linha salva em `rh_saves` passa a gravar a jornada resolvida daquele empregado (mesmas colunas que já existem: `jornada`, `jornada_sexta`, `jornada_sexta_ativa`, `jornada_sabado`, `jornada_sabado_ativa`, `sabado_sempre_extra`), em vez do valor único global. **Sem mudança de schema em `rh_saves`** — as colunas já existem e já são por linha/empregado; só muda a origem do valor.

Isso também mantém compatível, sem nenhuma alteração, a exportação de TXT (`_construirConteudoTXTExportacao`), que já lê `save.jornada*` por registro salvo.

### Carregamento

- `carregarEmpregados` passa a selecionar também `jornada_id` de `rh_empregados`.
- `selecionarEmpresa` (fluxo principal de abrir uma empresa para preencher a Folha de Ponto) passa a carregar `state.jornadasDisponiveis` (lista de `rh_jornadas` da empresa), com cache simples no mesmo padrão de `_buscarConfigRubricas`.

---

## O que NÃO muda

- `rh_jornada_trabalho`, Administração RH, Gerar Folhas de Ponto em branco.
- Schema de `rh_saves` (nenhuma coluna nova).
- Cálculo de horas extras/faltantes em si (mesmas fórmulas, só muda de onde vêm os minutos de jornada).
- Empresas que nunca cadastrarem uma jornada extra: comportamento idêntico ao atual.
