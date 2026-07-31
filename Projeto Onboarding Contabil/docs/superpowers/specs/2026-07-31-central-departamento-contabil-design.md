# Central do Departamento Contábil — Design

## Contexto

O `Projeto Onboarding Contabil` hoje é uma ferramenta única (onboarding de empresas
novas). Ele passa a ser a **Central do Departamento Contábil**, com duas
sub-ferramentas internas:

1. **Onboarding** — ferramenta já existente (checklist de documentos/itens por empresa),
   apenas realocada.
2. **Mapeamento Estratégico** — ferramenta nova: um perfil por empresa com dados
   operacionais, fiscais e de risco, usado pela gestão para enxergar a carteira de
   clientes do departamento.

## 1. Estrutura de navegação

- Portal principal: o card único passa a se chamar **"Departamento Contábil"**
  (ícone 🧾) e aponta para `Projeto Onboarding Contabil/index.html`, que passa a ser
  o **hub**.
- Hub (`index.html` novo): dois cards — "Onboarding" e "Mapeamento Estratégico" — sem
  autenticação própria de tela (a checagem de sessão continua acontecendo, só não há
  lista/sidebar nesta tela).
- Onboarding: arquivos atuais `index.html`/`app.js` renomeados para `onboarding.html`/
  `onboarding.js` (lógica inalterada). Botão "Voltar ao Portal" da sidebar passa a
  apontar para `index.html` (o hub), não mais para `../portal.html`.
- Mapeamento Estratégico: novos `mapeamento.html` + `mapeamento.js`.
- `styles.css` continua compartilhado; recebe as classes novas do hub e do
  Mapeamento Estratégico.
- `data/catalogo.js` (catálogo de itens do onboarding) não muda de lugar nem de
  conteúdo.

## 2. Modelo de dados (Supabase)

Nova migration `_sql/schema_contabil_mapeamento.sql`, seguindo a convenção de
`_sql/schema_contabil_onboarding.sql` (RLS restrita a `authenticated`, trigger de
`updated_at`, índices em `codigo_empresa`).

### `contabil_mapeamento` (1 registro por empresa)

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid PK | |
| `codigo_empresa` | text UNIQUE | referência lógica a `rh_empresas.codigo_empresa` |
| `periodicidade` | text | `mensal` \| `trimestral` \| `anual` |
| `regime_tributario` | text | `simples_nacional` \| `lucro_presumido` \| `lucro_real` \| `mei` |
| `responsavel_execucao` | text | |
| `ultimo_mes_fechado` | date | dia 1 do mês fechado |
| `situacao_2025_status` | text | `regularizado` \| `em_regularizacao` \| `pendente` \| `critico` |
| `situacao_2025_obs` | text | |
| `situacao_2026_status` | text | mesmo enum acima |
| `situacao_2026_obs` | text | |
| `financeiro_interno_bpo` | text | `interno` \| `bpo_scont` \| `bpo_terceiro` \| `nao_possui` |
| `forma_envio_documentos` | text[] | tags livres |
| `acesso_bancario_leitura` | boolean | |
| `bancos_utilizados` | text[] | tags (lista sugerida + livre) |
| `sistemas_utilizados` | text[] | tags (lista sugerida + livre) |
| `contato_nome` | text | |
| `contato_telefone` | text | |
| `contato_email` | text | |
| `entregaveis_esperados` | text[] | tags |
| `entregaveis_obs` | text | |
| `particularidades_contabeis` | text | |
| `particularidades_fiscais` | text | |
| `particularidades_societarias` | text | |
| `obrigacoes_acessorias` | text[] | tags (SPED Fiscal, ECD, ECF, DCTF, EFD-Reinf, DAS, DEFIS...) |
| `nivel_atencao` | text | `baixo` \| `medio` \| `alto` \| `critico` — editável |
| `nivel_atencao_travado` | boolean default false | true quando usuário sobrescreveu a sugestão |
| `created_at`, `updated_at` | timestamptz | |

### `contabil_mapeamento_pendencias` (N por empresa)

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `mapeamento_id` | uuid FK → `contabil_mapeamento(id)` ON DELETE CASCADE |
| `descricao` | text NOT NULL |
| `responsavel` | text |
| `prazo` | date |
| `status` | text — `aberta` \| `resolvida` |
| `created_at` | timestamptz |
| `resolvido_em` | timestamptz |

### `contabil_mapeamento_relacionadas` (N:N simétrico)

| Coluna | Tipo |
|---|---|
| `id` | uuid PK |
| `codigo_empresa` | text |
| `codigo_empresa_relacionada` | text |
| `created_at` | timestamptz |

Ao vincular A↔B, gravam-se as duas linhas (A→B e B→A) para simplificar a leitura em
ambos os sentidos. Ao desvincular, remove-se o par.

## 3. Telas do Mapeamento Estratégico

### Dashboard (tela inicial da ferramenta)

- 4 cards de contagem por `nivel_atencao` (Baixo/Médio/Alto/Crítico), clicáveis
  (aplicam filtro).
- Tabela/lista de empresas com colunas: empresa, regime, responsável, último mês
  fechado, nível de atenção (badge colorido), pendências abertas (contagem).
- Filtros: nível de atenção, regime tributário, financeiro interno/BPO,
  responsável.
- Busca por nome/código da empresa.
- Clique na linha abre o perfil da empresa.

### Perfil da empresa (form)

- Sidebar à esquerda: lista de empresas com busca (mesmo padrão visual do
  Onboarding), badge de nível de atenção ao lado do nome.
- Área principal dividida em seções (accordion, todas visíveis por padrão):
  1. **Execução** — periodicidade, regime, responsável, contato.
  2. **Situação de Fechamento** — último mês fechado, situação 2025/2026.
  3. **Operação/Financeiro** — financeiro interno/BPO, forma de envio, acesso
     bancário, bancos e sistemas (tags).
  4. **Entregáveis & Particularidades** — entregáveis esperados, obrigações
     acessórias, particularidades (3 textareas).
  5. **Nível de Atenção** — seletor manual + badge de sugestão calculada
     (ver §4).
  6. **Pendências** — lista de itens com descrição/responsável/prazo/status,
     adicionar/resolver inline.
  7. **Empresas Relacionadas** — buscar e vincular outra empresa cadastrada;
     lista das já vinculadas com link para abrir o perfil dela.
- Salvamento por seção (mesmo padrão de "salvar ao sair do campo" ou botão salvar
  por bloco — decidido na implementação, seguindo o que já existe no Onboarding).

## 4. Sugestão automática de nível de atenção

Calculada no client (`mapeamento.js`), reavaliada sempre que os dados relevantes
mudam:

- **Atraso de fechamento**: diferença entre mês atual e `ultimo_mes_fechado`,
  ajustada pela `periodicidade` (mensal: >1 mês = atenção; trimestral: >1 trimestre;
  anual: >1 ano).
- **Pendências vencidas**: qualquer item em `contabil_mapeamento_pendencias` com
  `status = aberta` e `prazo < hoje`.
- **Situação crítica**: `situacao_2025_status = critico` ou
  `situacao_2026_status = critico`.

Regra: qualquer sinal crítico → sugestão `critico`; atraso grande ou 2+ pendências
vencidas → `alto`; atraso pequeno ou 1 pendência vencida → `medio`; nenhum sinal →
`baixo`. A sugestão aparece como badge somente-leitura ao lado do seletor manual
("Sugestão: Alto"). Se o usuário alterar o seletor manual para um valor diferente da
sugestão, grava `nivel_atencao_travado = true` e o cálculo automático deixa de
sobrescrever `nivel_atencao` (mas a sugestão continua visível como referência).

## 5. Fora de escopo

- Integração com o módulo de Certificado Digital (fica só como observação em
  particularidades, sem dado espelhado).
- Histórico/auditoria de mudanças de nível de atenção.
- Controle de honorários/valores de contrato.
