# Design Spec — Ferramenta Benefícios VA / VT

**Data:** 2026-06-10  
**Status:** Aprovado  
**Pasta destino:** `Projeto Beneficios/`  
**Padrão:** Arquivo único (`index.html` + `script.js` + `styles.css`) — igual ao Controle de Frequência

---

## 1. Visão Geral

Ferramenta do Portal Scont para geração de arquivos TXT de lançamento de **Vale Transporte (VT)** e **Vale Alimentação (VA)** no mesmo formato do Controle de Frequência. Permite selecionar empresa, empregados e competência, calcular dias úteis por escala e exportar o TXT para importação na folha de pagamento.

### Integração com o Portal
- Registrada na tabela `ferramentas` via SQL de migration
- Auth via `portal-auth-guard.js` com `PortalAuthGuard.init(1)`
- Gerenciamento de acesso pelo `admin-dashboard.html`

---

## 2. Estrutura de Arquivos

```
Projeto Beneficios/
├── index.html        # App principal (3 telas via sidebar)
├── script.js         # Toda a lógica JavaScript
├── styles.css        # Estilos (paleta bordô do portal)
└── docs/
    └── superpowers/specs/   # (este arquivo)
```

---

## 3. Telas e Sidebar

### Sidebar (fixa, lado esquerdo)
- Gradiente: `linear-gradient(160deg, #8B3A3A, #2C3E50)` — igual ao portal
- Ícone: 🎫  |  Nome: "Benefícios VA / VT"
- Itens de navegação:
  - 📋 **Lançamentos** (tela padrão ao abrir)
  - 📅 **Escalas**
  - ⚙️ **Configurações**
- Troca de telas via JavaScript (show/hide de `<section>`), sem reload de página

---

## 4. Tela: Lançamentos

### 4.1 Banner de Competências

Exibido no topo, esclarece a diferença entre os dois períodos:

| Campo | Descrição | Cor |
|---|---|---|
| **Competência de Pagamento** | Mês/ano que entra no TXT e na folha (ex: 05/2026) | Bordô |
| **Mês de Referência dos Dias** | Mês futuro em que o empregado trabalhará (ex: 06/2026) | Azul |

Os dois campos são independentes e preenchidos pelo usuário. O "Mês de Referência" pode ser preenchido automaticamente pela tela Escalas.

### 4.2 Seleção

Campos:
- **Empresa** — select (busca `rh_empresas`)
- **Competência de Pagamento** — input MM/AAAA (entra no TXT)
- **Mês de Referência dos Dias** — input MM/AAAA (para calcular totais)
- **Tipo de Processo** — select: `11 – Folha Mensal`, `41 – Adiant. Salarial`, `42 – Folha Complementar`, `51 – Adiant. 13º`, `52 – 13º Salário`, `70 – PLR`
- **Empregados** — select: "Todos" ou seleção múltipla (busca `rh_empregados` filtrado por empresa)

### 4.3 Valores Padrão

Campos (pré-carregados de `rh_beneficios_config` ao selecionar empresa):
- **VT Padrão / Dia (R$)** — editável, pré-preenchido da config
- **VA Padrão / Dia (R$)** — editável, pré-preenchido da config
- **Dias a Trabalhar** — editável; preenchido automaticamente pela tela Escalas ao clicar "Aplicar nos Lançamentos"
- **Total VT Padrão** — calculado automaticamente: `VT/Dia × Dias` (somente leitura, exibido em verde)
- **Total VA Padrão** — calculado automaticamente: `VA/Dia × Dias` (somente leitura, exibido em verde)
- Botão **"🔄 Aplicar Padrão a Todos"** — aplica os valores padrão a todos os empregados da grade

### 4.4 Grade de Empregados

Tabela editável com uma linha por empregado:

| Coluna | Tipo | Observação |
|---|---|---|
| Cód. | texto | `rh_empregados.codigo_empregado` |
| Nome | texto | `rh_empregados.nome_empregado` |
| VT / Dia | input numérico | Valor individual ou padrão da empresa |
| VA / Dia | input numérico | Valor individual ou padrão da empresa |
| Dias | input inteiro | Preenchido por "Aplicar Padrão" ou individualmente |
| Total VT | calculado | `VT/Dia × Dias` — somente leitura, verde |
| Total VA | calculado | `VA/Dia × Dias` — somente leitura, verde |
| Status | badge | Padrão / Individual / Divergente |
| Ação | ✏️ | Editar linha individualmente |

**Status badges:**
- 🟢 **Padrão** — usa o valor padrão da empresa
- 🔵 **Individual** — tem valor individual pré-configurado em Configurações
- 🟡 **Divergente** — valor inserido/importado difere do configurado → exige confirmação

**Regra de divergência:** Ao editar manualmente ou importar via Excel, se o valor de VT ou VA de um empregado diferir do valor configurado (padrão da empresa OU valor individual), exibir modal de confirmação antes de aceitar o valor.

### 4.5 Importação Excel

Colunas esperadas no arquivo `.xlsx`:

| Coluna | Campo | Obrigatório |
|---|---|---|
| A | Código da Empresa | Sim |
| B | Código do Empregado | Sim |
| C | Valor Diário VT (R$) | Sim |
| D | Valor Diário VA (R$) | Sim |
| E | Quantidade de Dias | Sim |

Comportamento:
1. Ler arquivo com SheetJS (CDN)
2. Para cada linha: localizar empregado na grade; se VT ou VA diferirem do configurado → modal de confirmação individual ("Valor de VT para [Nome] é R$ X, configurado é R$ Y. Confirmar?")
3. Empregados não encontrados na grade: ignorar com aviso no log de importação
4. Após importação: atualizar badge de status de cada linha

### 4.6 Salvar

Botão **"💾 Salvar"** — persiste o estado atual na tabela `rh_beneficios_lancamentos`.

Chave única: `(codigo_empresa, competencia_pagamento)` — reabre lançamentos anteriores automaticamente ao selecionar empresa + competência já salva.

### 4.7 Gerar TXT

Botão **"📄 Gerar TXT"** — gera e baixa o arquivo.

**Formato de cada linha:**
```
10[cod_emp_10D][AAAAMM][cod_rubrica_9D][tipo_processo_2D][valor_centavos_9D][cod_empresa_10D]\n
```

- `cod_emp` — `padStart(10, '0')`
- `AAAAMM` — derivado da **Competência de Pagamento** (ex: `05/2026` → `202605`)
- `cod_rubrica` — `padStart(9, '0')`, da config VT ou VA
- `tipo_processo` — 2 dígitos (ex: `11`)
- `valor_centavos` — `Math.round(valorDiario * dias * 100)`, `padStart(9, '0')`
- `cod_empresa` — `padStart(10, '0')`

Uma linha de VT + uma linha de VA por empregado (empregados com valor 0 são omitidos).

**Nome do arquivo:** `Beneficios_[COD_EMPRESA]_MM-AAAA.txt`  
**Encoding:** UTF-8

---

## 5. Tela: Escalas

### 5.1 Parâmetros

- **Empresa** — select
- **Mês de Referência** — input MM/AAAA (mês futuro de trabalho)
- **Considerar Feriados desta empresa?** — select Sim/Não

### 5.2 Tabela de Feriados (visível quando "Sim")

Exibe os feriados do mês de referência cadastrados na tabela `rh_feriados` para a empresa selecionada — **mesmos dados usados pelo Controle de Frequência**.

Cada feriado tem um checkbox: marcado = descontar do total de dias úteis.

Colunas: `[ ]` | Data | Descrição | Tipo (Nacional / Municipal / Empresa)

### 5.3 Modos de Cálculo (3 abas)

#### Aba A — Dias da Semana
- 7 botões toggle: Dom | Seg | Ter | Qua | Qui | Sex | Sáb
- O sistema conta quantas ocorrências dos dias selecionados existem no mês informado
- Calendário visual do mês com dias coloridos (trabalhado = verde, fim de semana = cinza, feriado marcado = vermelho)
- Indicador textual: ex. "Escala 5×2 — Seg a Sex"

#### Aba B — Revezamento
- Campo: **Dias trabalhados** (ex: 12)
- Campo: **Dias de folga** (ex: 36) — converte para horas se necessário
- Campo: **Data de início da escala** (DD/MM/AAAA)
- Sistema projeta quais dias do mês informado são trabalhados com base na rotação
- Calendário visual idêntico ao da Aba A

#### Aba C — Manual
- Calendário do mês com todos os dias clicáveis
- Click = alterna entre trabalhado / não trabalhado
- Feriados pré-marcados como não trabalhados (mas podem ser reativados)
- Contagem em tempo real

### 5.4 Resultado e Aplicação

- Box de resultado: **"21 dias úteis — Junho / 2026"** (breakdown: "22 úteis − 2 feriados")
- Botão **"➜ Aplicar nos Lançamentos"**:
  - Preenche o campo "Dias a Trabalhar" na tela Lançamentos
  - Preenche o campo "Mês de Referência" na tela Lançamentos
  - Navega automaticamente para a tela Lançamentos

---

## 6. Tela: Configurações

### 6.1 Seleção de Empresa

Select no topo — todas as seções abaixo filtram por empresa selecionada.

### 6.2 Aba: Padrão da Empresa

Dois cards lado a lado:

**Vale Transporte:**
- Código da Rubrica (texto)
- Tipo de Processo Padrão (select 11/41/42/51/52/70)
- Valor Padrão / Dia (R$, decimal)

**Vale Alimentação:**
- Código da Rubrica (texto)
- Tipo de Processo Padrão (select)
- Valor Padrão / Dia (R$, decimal)

Botão **"💾 Salvar Padrões"** → upsert em `rh_beneficios_config`.

### 6.3 Aba: Valores Individuais

Tabela com todos os empregados da empresa selecionada:

| Código | Nome | VT / Dia Individual | VA / Dia Individual | Ação |
|---|---|---|---|---|
| 001 | Ana Silva | `— padrão R$ 12,50` (readonly) | `— padrão R$ 30,00` (readonly) | ✏️ |
| 002 | Bruno Costa | `18,00` (editável, azul) | `— padrão` (readonly) | 💾 |

- Campo vazio / readonly = usa padrão da empresa
- Campo preenchido = valor individual (salvo em `rh_beneficios_individuais`)
- Botão ✏️ abre linha para edição; 💾 salva

---

## 7. Modelo de Dados (Supabase)

### Tabela: `rh_beneficios_config`
```sql
id               UUID PK DEFAULT gen_random_uuid()
codigo_empresa   TEXT NOT NULL REFERENCES rh_empresas(codigo_empresa)
tipo             TEXT NOT NULL  -- 'vt' | 'va'
codigo_rubrica   TEXT NOT NULL
tipo_processo    TEXT NOT NULL DEFAULT '11'
valor_dia        NUMERIC(10,2) NOT NULL DEFAULT 0
UNIQUE (codigo_empresa, tipo)
```

### Tabela: `rh_beneficios_individuais`
```sql
id                  UUID PK DEFAULT gen_random_uuid()
codigo_empresa      TEXT NOT NULL
codigo_empregado    TEXT NOT NULL
vt_valor_dia        NUMERIC(10,2)  -- NULL = usa padrão
va_valor_dia        NUMERIC(10,2)  -- NULL = usa padrão
UNIQUE (codigo_empresa, codigo_empregado)
```

### Tabela: `rh_beneficios_lancamentos`
```sql
id                    UUID PK DEFAULT gen_random_uuid()
codigo_empresa        TEXT NOT NULL
competencia_pagamento TEXT NOT NULL  -- MM/AAAA
mes_referencia        TEXT           -- MM/AAAA
tipo_processo         TEXT NOT NULL DEFAULT '11'
linhas_json           JSONB NOT NULL  -- [{codigo_empregado, vt_dia, va_dia, dias, total_vt, total_va}, ...]
usuario_id            UUID           -- auth.users.id
criado_em             TIMESTAMPTZ DEFAULT NOW()
atualizado_em         TIMESTAMPTZ DEFAULT NOW()
UNIQUE (codigo_empresa, competencia_pagamento)
```

### Tabelas reutilizadas (leitura)
- `rh_empresas` — lista de empresas
- `rh_empregados` — lista de empregados por empresa
- `rh_feriados` — feriados por empresa e data (criada pelo Controle de Frequência)

---

## 8. Autenticação

```html
<script src="../supabase-config.js"></script>
<script src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<script src="../portal-auth-guard.js"></script>
```

```javascript
const auth = await window.PortalAuthGuard.init(1);
if (!auth) return; // redireciona para login
```

---

## 9. Registro no Portal

SQL de migration em `_sql/add_beneficios_va_vt.sql`:

```sql
INSERT INTO public.ferramentas (nome, descricao, icone, url_base, ativa, ordem, nova_aba)
SELECT 'Benefícios VA/VT',
       'Geração de lançamentos de Vale Transporte e Vale Alimentação para a folha',
       '🎫',
       './Projeto Beneficios/index.html',
       true, 160, false
WHERE NOT EXISTS (SELECT 1 FROM public.ferramentas WHERE nome = 'Benefícios VA/VT');
```

---

## 10. Dependências Externas (CDN)

| Biblioteca | Uso |
|---|---|
| `@supabase/supabase-js@2` | Banco de dados |
| `SheetJS (xlsx)` | Importação e exportação Excel |

---

## 11. Fora do Escopo

- Envio de notificação ao empregado
- Histórico de versões de lançamento
- Cálculo automático de desconto de VT (percentual sobre salário)
- Integração direta com sistema de folha (apenas exporta TXT)
