# Diário Contábil — Design

## Contexto

O Mapeamento Estratégico (ferramenta existente) passa a alimentar uma nova
sub-ferramenta, **Diário Contábil**, dentro da Central do Departamento Contábil.
O Diário traz por empresa: um resumo do que já está cadastrado no Mapeamento,
uma visão visual mês a mês do andamento do fechamento, e um espaço de
lançamentos (log/diário) com registro automático de quem inseriu e quando.

Esta spec também cobre dois ajustes no Mapeamento Estratégico que servem de
base para o Diário:

1. Correção de um bug visual no checkbox "Possui acesso bancário de leitura"
   (**já aplicada** — ver §1).
2. Substituição do campo de tags "Bancos Utilizados" por uma tabela de acessos
   bancários por banco (**§2**), cujos dados (nomes dos bancos) aparecem no
   resumo do Diário.

A ferramenta Diário Contábil em si é descrita em **§3**.

## 1. Fix: checkbox "Possui acesso bancário de leitura" (já aplicado)

Causa raiz: `.mapa-secao-body input{ width:100%; padding:7px 10px; }`
(styles.css) se aplicava a todo `<input>` dentro da seção, inclusive o
checkbox, esticando-o para 100% de largura e quebrando o alinhamento com o
texto do `<label>`.

Correção aplicada em `styles.css`:

```css
.mapa-secao-body input[type="checkbox"]{ width:auto; padding:0; flex-shrink:0; }
.mapa-secao-body label:has(input[type="checkbox"]){ display:flex; align-items:center; gap:8px; }
```

E limpeza do HTML inline redundante em `mapeamento.js` (o estilo inline
`display:flex` no `div.full` e `margin:0` no `label` deixaram de ser
necessários).

## 2. Bancos Utilizados → tabela de acessos bancários

### Modelo de dados

Nova tabela `contabil_mapeamento_bancos` (1 linha por banco por empresa),
substituindo a coluna `bancos_utilizados text[]` de `contabil_mapeamento`
(a coluna antiga é removida via migration).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `mapeamento_id` | uuid FK → `contabil_mapeamento(id)` ON DELETE CASCADE | |
| `banco` | text NOT NULL | nome do banco (sugestão via datalist + livre) |
| `agencia` | text | |
| `conta_corrente` | text | |
| `operador_login` | text | |
| `senha` | text | texto puro (sem criptografia), mascarado só na UI |
| `observacoes` | text | |
| `created_at` | timestamptz | |

Índice em `mapeamento_id`. RLS igual às demais tabelas `contabil_*`
(leitura/escrita `authenticated`).

### UI (seção "Operação / Financeiro" do Mapeamento Estratégico)

- O campo de tags atual de "Bancos Utilizados" é substituído por: input com
  datalist de sugestões (mesma lista `BANCOS_SUGERIDOS` já existente) +
  "pressionar Enter" para adicionar — igual ao padrão de tags já usado nas
  outras seções.
- Ao adicionar um banco, cria-se uma linha em `contabil_mapeamento_bancos`
  (`banco` preenchido, resto vazio) e aparece imediatamente uma tabela abaixo
  do input, com uma linha por banco e colunas: Banco, Agência, Conta
  Corrente, Operador/Login, Senha, Observações.
- Cada célula (exceto "Banco", que é fixo após criado) é um input editável
  inline, salvo no `blur` (mesmo padrão de `salvarCampo`).
- Coluna "Senha": `<input type="password">` com um botão "👁" ao lado que
  alterna para `type="text"` (mostrar/ocultar). Não há criptografia — é só
  para evitar exposição visual acidental na tela.
- Botão "×" no fim da linha remove o banco (`DELETE` da linha).
- Relatório PDF: a linha "Bancos Utilizados" passa a listar
  `banco` de todas as linhas de `contabil_mapeamento_bancos` da empresa,
  separados por vírgula (mesmo formato de hoje).

## 3. Diário Contábil (nova sub-ferramenta)

### 3.1 Estrutura de navegação

- Hub (`index.html`): novo 3º card "Diário Contábil" (ícone 📔), aponta para
  `diario.html`.
- Novos arquivos `diario.html` + `diario.js`, seguindo o mesmo esqueleto
  visual (sidebar com marca, seletor de empresa, botão "Voltar ao Dashboard")
  já usado em `mapeamento.html`/`mapeamento.js`.
- `mapeamento.js` ganha suporte a um parâmetro de URL `?empresa=<codigo>`: se
  presente no load, chama `selecionarEmpresa(codigo)` automaticamente (usado
  pelo link "Editar no Mapeamento Estratégico" a partir do Diário).

### 3.2 Modelo de dados (Supabase)

Nova migration `_sql/schema_contabil_diario.sql`.

**`contabil_diario_lancamentos`** (N por empresa, só-inclusão):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `codigo_empresa` | text NOT NULL | referência lógica a `rh_empresas.codigo_empresa` |
| `data` | date NOT NULL | data do fato registrado (escolhida pelo usuário) |
| `texto` | text NOT NULL | |
| `criado_por_nome` | text | de `auth.userData.nome` (sessionStorage) |
| `criado_por_email` | text | de `auth.email` |
| `created_at` | timestamptz NOT NULL DEFAULT NOW() | carimbo real da inserção |

Sem `UPDATE`/`DELETE` expostos pela UI (RLS permite só para manutenção manual
via SQL, se necessário — política de escrita cobre INSERT/SELECT na prática
porque a tela só usa esses dois).

**`contabil_diario_status_mensal`** (grade mês a mês, célula = 1 linha):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `codigo_empresa` | text NOT NULL | |
| `ano` | int NOT NULL | |
| `mes` | int NOT NULL | 1–12 |
| `status` | text NOT NULL | `sem_documentacao` \| `pendencias` \| `concluido` |
| `updated_at` | timestamptz | |

`UNIQUE (codigo_empresa, ano, mes)`. Sem migração do histórico do Excel — a
grade começa vazia; meses sem linha renderizam como "sem documentação"
(estado padrão, não precisa de linha no banco).

Índices: `codigo_empresa`; `(codigo_empresa, ano)`.

RLS: mesmo padrão `authenticated` leitura/escrita das demais tabelas
`contabil_*`.

### 3.3 Dashboard (tela inicial do Diário)

Reaproveita a lógica de `empresasFiltradas()`/render de tabela do Mapeamento
(mesma fonte `contabil_mapeamento` + `rh_empresas`, mesmos filtros: nível de
atenção, regime, financeiro interno/BPO):

Colunas: Empresa, Regime, Responsável, Nível (badge), Pendências (contagem),
**Últimos 6 meses** (mini-grade de 6 quadrados coloridos, um por mês, do mês
atual para trás, na ordem cronológica).

Cores dos quadrados seguem a mesma paleta de badges de nível já usada
(reaproveitar variáveis CSS existentes, não criar paleta nova):
- `concluido` → cor de sucesso/baixo
- `pendencias` → cor de atenção/médio
- `sem_documentacao` → cor neutra (cinza)

Clique na linha abre a página da empresa.

### 3.4 Página da empresa

Sidebar igual ao Mapeamento (seletor de empresa + "Voltar ao Dashboard").
Área principal, do topo para baixo:

1. **Resumo do Mapeamento Estratégico** — card somente-leitura com: regime
   tributário, periodicidade, responsável pela execução, contato (nome/tel/
   email), financeiro interno/BPO, bancos utilizados (nomes, a partir de
   `contabil_mapeamento_bancos`), sistemas utilizados, situação do ano
   corrente + badge de nível de atenção. Botão "✏️ Editar no Mapeamento
   Estratégico" → `mapeamento.html?empresa=<codigo>`. Se a empresa ainda não
   tem registro em `contabil_mapeamento`, mostra mensagem "Nenhum mapeamento
   cadastrado ainda" com o mesmo botão (que, ao abrir o Mapeamento, cria o
   registro automaticamente — comportamento já existente em
   `selecionarEmpresa`).
2. **Situação de Fechamento — Grade Mensal** — grade JAN–DEZ do ano
   selecionado (padrão: ano corrente), com `‹`/`›` para navegar entre anos.
   Cada célula mostra o mês (abreviado) e é colorida conforme o status
   (mesma paleta do §3.3). Clique cicla
   `sem_documentacao → pendencias → concluido → sem_documentacao`, salvando
   a cada clique (upsert em `contabil_diario_status_mensal`; ciclar de volta
   para `sem_documentacao` faz `DELETE` da linha, já que esse é o estado
   padrão sem registro).
3. **Lançamentos do Diário** — formulário com campo "Data" (date, padrão
   hoje) e "Registro" (textarea) + botão "Adicionar Lançamento". Lista abaixo
   em ordem cronológica decrescente (mais recente primeiro), cada item
   mostrando data do fato, texto, e rodapé "— {criado_por_nome}
   ({created_at formatado})". Sem botões de editar/excluir — é
   somente-inclusão.

## 4. Fora de escopo

- Migração do histórico mês a mês (2021–2026) da planilha Excel.
- Edição ou exclusão de lançamentos do Diário depois de inseridos.
- Criptografia real de senha bancária (mascaramento é só visual).
- Alterar o Mapeamento Estratégico para exibir a grade mensal ou os
  lançamentos do Diário — essas visões ficam exclusivas da nova ferramenta.
