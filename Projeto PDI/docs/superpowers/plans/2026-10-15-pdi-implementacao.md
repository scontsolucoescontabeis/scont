# Módulo PDI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (execução nativa nesta sessão, autorizada pelo usuário sem confirmações).

**Goal:** Entregar a ferramenta PDI do Portal Scont (fases 1–5 da spec) com banco, RLS, seed, telas por papel, cálculo testado e exportação.

**Architecture:** HTML/JS vanilla em `Projeto PDI/` (padrão Ficha 360): módulos UMD puros (`pdi-calculo.js`, `textos.js`) testados com `node`, camada de dados `pdi-api.js` sobre Supabase, telas por papel em módulos separados. Banco em `_sql/schema_pdi.sql` (idempotente, RLS por função SECURITY DEFINER).

**Tech Stack:** HTML/CSS/JS, Supabase (Postgres+RLS+Storage), `@supabase/supabase-js@2`, `pdf-lib`, `docx` (CDN), `xlsx` (já no projeto), `node:assert` para testes.

**Spec:** `Projeto PDI/docs/superpowers/specs/2026-10-15-pdi-design.md`

## Global Constraints

- Paleta do portal: `--primary #8B3A3A`, `--primary-dark #6B2A2A`; fontes DM Sans / DM Mono.
- Interface em pt-BR formal; datas `dd/mm/aaaa`; percentuais com vírgula.
- Textos literais do documento somente em `js/textos.js`; correções: "Sistema Domínio", "Visão Sistêmica", "a fim de".
- Escalas 1–4; N/A exige justificativa (CHECK no banco).
- Sem `service_role` no frontend; RLS é a barreira real.
- Sócio só via `pdi_socios` (nunca inferido de `rh_socios`, cuja RLS é aberta).
- Não commitar arquivos alheios ao PDI (working tree tem alterações de outros módulos).

## Review Focus

- Denominador 0 em indicador ⇒ "sem medição", nunca NaN/0% (teste em `pdi-calculo`).
- D em dia 31 / 29-fev: ciclos com clamp no último dia do mês (teste).
- PDI sem `colaborador_user_id` (Julia): admin e sócio veem, ninguém quebra (RLS + tela).
- Tabelas ausentes (SQL não rodado): tela mostra aviso, não quebra.
- Ficha com N/A sem justificativa ou sem 3 ciências não conclui (banco e tela).

---

### Task 1: Cálculo puro (TDD)
**Files:** Create `js/pdi-calculo.js`, `tests/pdi-calculo.test.js`
**Produces:** `PdiCalculo.{somarDias, somarMeses, prazoRelativo, ciclos, percentual, atingimento, autonomia, progressoTecnico, nivelAtual, controles, pendencias, mediaNotas}`
- [ ] Escrever testes (D=2026-10-07 ⇒ +15=2026-10-22, +30=2026-11-06, +60=2026-12-06, +90=2027-01-05; ciclos até 2027-10-07; clamp; percentual; atingimento; autonomia).
- [ ] Ver falhar; implementar; ver passar; commit.

### Task 2: Textos literais
**Files:** Create `js/textos.js` (UMD `PdiTextos`) com todo o Apêndice A (cabeçalho, seções, escalas, avisos, ciclos, indicadores, ações, competências).
- [ ] Teste de integridade (`tests/textos.test.js`): 9 técnicas, 7 comportamentais, 7 perfil, 6 ações, 6 indicadores, 4 ciclos.

### Task 3: SQL
**Files:** Create `_sql/schema_pdi.sql`, `_sql/add_ferramenta_pdi.sql`, `_sql/seed_pdi.sql`
- [ ] Tabelas `pdi_*`, funções de papel, RLS, triggers (updated_at, auditoria, imutabilidade, conclusão), bucket `pdi-relatorios`.
- [ ] Seed do modelo e do PDI da Julia (D=2026-10-07) a partir do JSON gerado de `textos.js`.
- [ ] Executar com `supabase db query --linked`; verificar contagens.

### Task 4: Camada de dados e papéis
**Files:** Create `js/pdi-api.js`: `PdiApi.{papel, listarPdis, carregarPdi, salvar..., feedbacks, ciencias}`; detecção de tabela ausente.

### Task 5: Shell e telas por papel
**Files:** Create `index.html`, `css/pdi.css`, `js/app.js`, `js/meu-pdi.js`, `js/painel.js`, `js/admin.js`
- [ ] Meu PDI e Resultados; Painel dos Sócios/Minha equipe; Administração (modelos, PDI, `pdi_socios`).

### Task 6: PDI individual (abas 1–8)
**Files:** Create `js/pdi-view.js`, `js/pdi-pilares.js`, `js/pdi-avaliacao.js`
- [ ] Cabeçalho, objetivo, perfil, pilares 1–4, plano, ficha trimestral, evolução, ciência.

### Task 7: Apresentação, alertas, exportação
**Files:** Create `js/apresentar.js`, `js/alertas.js`, `js/exportar.js`
- [ ] Modo Apresentar; alertas calculados; PDF (pdf-lib), DOCX (docx), Excel (xlsx).

### Task 8: Verificação e entrega
- [ ] Rodar todos os testes; checklist de fidelidade; commit só de arquivos PDI; push.
