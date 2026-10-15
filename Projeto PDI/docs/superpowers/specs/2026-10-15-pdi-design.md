# Módulo PDI — Design (Portal SCONT)

Data: 15/10/2026 · Status: aguardando revisão do usuário

Fonte de verdade de conteúdo: `Projeto PDI/PDI - Julia Costa Faria - Assistente de Depart. Pessoal (2).docx`
(texto literal do Apêndice A do pedido original). Logo: `word/media/image1.png` do .docx.

## 1. Objetivo

Ferramenta única, **somente para a equipe Scont**, para apresentar, monitorar, avaliar e dar feedback
do Plano de Desenvolvimento Individual (PDI) de todos os colaboradores, reproduzindo integralmente a
estrutura, os textos, as escalas, as fórmulas, os prazos e a metodologia do documento de referência.

Metodologia preservada: 4 pilares (Técnicas, Comportamentais, Performance, Melhorias), 12 meses em
4 ciclos trimestrais, escalas 1–4, N/A com justificativa, D = início do PDI, alinhamento semanal,
revisão mensal de indicadores, fechamento trimestral com a Diretoria.

## 2. Contexto técnico (verificado no repositório)

- HTML/JS vanilla por pasta, sem build. Padrão: `Projeto PDI/index.html` + `js/*.js` + `tests/*.test.js`
  (como `Projeto Ficha 360`). **Não é React/TypeScript**; textos fixos ficam em `js/textos.js`.
- Auth: `PortalAuthGuard.init(1)` (`portal-auth-guard.js`); acesso por ferramenta via `usuario_ferramentas`;
  admin = `usuarios.is_admin`.
- Banco: Supabase do portal (`SUPABASE_URL`/`SUPABASE_KEY`), SQL idempotente em `_sql/`, executado
  manualmente no SQL Editor. Registro da ferramenta em `public.ferramentas`.
- Paleta do portal: `--primary #8B3A3A`, `--primary-dark #6B2A2A`, `--primary-light #A85252`.
  O `#7a1e1e` do pedido original NÃO é usado; vale o padrão do portal. Fontes DM Sans / DM Mono.
- PDF: `pdf-lib` (já no portal). DOCX: lib `docx` via CDN (Fase 5, a confirmar versão).
- Sem `pandoc` na máquina: extração do .docx via Python (`-I`).

## 3. Decisões tomadas com o usuário

1. **Papel por PDI** para colaborador e gestor; **sem perfil global novo** para esses dois.
2. **Sócio é papel global** (vê e avalia todos). Diretoria = sócios.
3. Identidade do colaborador: usuário do portal + **nome, cargo e setor como texto no próprio PDI**.
4. Fonte de sócios: `rh_socios` com `codigo_empresa = 48` (Scont), mas o poder de sócio só vale após
   **vínculo explícito pelo admin** em `pdi_socios` (a RLS de `rh_socios` é `USING (TRUE)`, não confiável).
5. **Gestor e sócios avaliam e dão feedback.** Admin acessa qualquer tela.
6. Modelagem **híbrida (B)**: normalizado no que é consultado/auditado/protegido por RLS; conteúdo
   estático do modelo em JSONB.
7. E-mail de alertas fora da primeira versão.

## 4. Papéis e permissões

Funções SQL `SECURITY DEFINER` com `search_path` fixo: `pdi_eh_admin()`, `pdi_eh_socio()`,
`pdi_eh_gestor(pdi_id)`, `pdi_eh_colab(pdi_id)`, `pdi_pode_avaliar(pdi_id)` (= admin OU sócio OU gestor).

| Tabela / grupo | Colaborador | Gestor do PDI | Sócio | Admin |
|---|---|---|---|---|
| `pdis`, `pdi_ciclos`, definição de indicadores | lê o seu | lê/edita | lê/edita todos | tudo |
| Níveis técnicos, notas comportamentais, validação de melhoria, `pdi_avaliacoes_trimestrais`/`_pilares`, apurações | só lê | lê/escreve | lê/escreve | tudo |
| Alinhamento semanal, sinalizações, melhorias (registro), evidências, "considerações da colaboradora" | lê/escreve as suas | lê/escreve | lê/escreve | tudo |
| `pdi_feedbacks` | lê os seus; não escreve | escreve (liderados) | escreve (todos) | tudo |
| `pdi_socios` | nega | nega | lê a si | escreve |
| `pdi_auditoria` | nega | nega | lê | lê |

Perfil comportamental (DISC/MBTI) é dado pessoal: visível a colaborador, gestor, sócios e admin;
relatório PDF em bucket Storage privado com a mesma regra.

## 5. Modelo de dados

Prefixo `pdi_`; todas com `id uuid`, `created_at`, `updated_at`, `created_by`.

**Conteúdo do modelo (JSONB):**
- `pdi_modelos` (cargo_setor, `conteudo` JSONB, versão, ativo). `conteudo` guarda: objetivo, texto de
  acompanhamento, apoio Scont, perfil esperado (competência/evidência/direcionamento/status), trilha
  técnica, competências comportamentais, ações D+n, indicadores e calendário de ciclos.
- Na criação do PDI o conteúdo é **copiado** (snapshot) para `pdis.conteudo`; editar o PDI não altera o modelo.

**Normalizado:**
- `pdis` (colaborador_user_id nullable, colaborador_nome, cargo_setor, admissao, gestor_user_id, gestor_nome,
  data_inicio [D], meses_acompanhamento=12, periodicidade_avaliacao, modelo_id, conteudo JSONB,
  status rascunho/ativo/encerrado)
- `pdi_socios` (usuario_id, rh_socio_id, nome)
- `pdi_competencias_tecnicas` (pdi_id, competencia, pratica, meta_ciclo1, priorizada, ordem)
- `pdi_niveis_tecnicos` (competencia_tecnica_id, data, nivel 1–4, evidencia, registrado_por,
  validado_por, validado_em)
- `pdi_competencias_comportamentais`, `pdi_avaliacoes_comportamentais` (nota 1–4)
- `pdi_acoes` (foco_acao, responsaveis, prazo_dias, recorrencia, evidencia_esperada,
  status a_iniciar/em_andamento/concluido, ciclo, origem modelo/ficha_trimestral)
- `pdi_evidencias` (polimórfica: acao/nivel/melhoria/indicador; texto, link, arquivo Storage)
- `pdi_indicadores` (nome, formula, tipo_meta numerica/relativa_linha_base/a_pactuar, operador,
  valor_meta, evidencia, calculo_automatico) e `pdi_indicador_apuracoes` (competencia_mes, numerador,
  denominador, linha_base, observacao)
- `pdi_melhorias` (data, rotina, situacao_anterior, melhoria_evidencia, validacao_gestor,
  comentario_gestor, validado_em)
- `pdi_alinhamentos_semanais` (semana_ref, concluidos, pendencias, apoio_necessario, dificuldades,
  feedback_gestor, realizado)
- `pdi_sinalizacoes` (descricao, data_sinalizacao, prazo_entrega)
- `pdi_ciclos` (numero 1–4, inicio, fim, foco_resultado_esperado, data_avaliacao_agendada,
  mudancas_escopo_apoio)
- `pdi_avaliacoes_trimestrais` (ciclo_id, data_reuniao, gestor_id, avancos, pontos_desenvolvimento,
  prioridades_proximo_ciclo, consideracoes_colaborador, resultado, direcionamentos[], status
  rascunho/em_reuniao/aguardando_ciencia/concluida)
- `pdi_avaliacao_pilares` (pilar tecnicas/comportamentais/performance/melhorias, nota_inicial,
  nota_ciclo, na, justificativa_na, evidencias)
- `pdi_feedbacks` (pdi_id, ciclo_id nullable, autor_id, autor_papel, texto, created_at); imutável
- `pdi_ciencias` (referencia pdi/avaliacao, papel, usuario_id, nome, assinado_em, ip se disponível)
- `pdi_auditoria` (tabela, registro_id, acao, antes, depois, usuario, data), via trigger

**Integridade no banco:** `CHECK` 1–4 em níveis e notas; `CHECK (NOT na OR justificativa_na <> '')`;
enums por `CHECK`; trigger bloqueia UPDATE em avaliação `concluida`; reabertura só admin com
justificativa registrada em `pdi_auditoria`; trigger de conclusão exige 4 notas/N-A justificados,
resultado, ≥1 direcionamento e 3 ciências.

## 6. Telas

Única ferramenta `Projeto PDI/index.html`; menu determinado pelo papel (admin > sócio > gestor > colaborador).
Quem é gestor e colaborador vê as duas visões sem trocar de login.

1. **Colaborador — "Meu PDI e Resultados"** (mobile-first): resumo (próximas ações, nível atual,
   indicadores do mês, pendências); **resultados e feedbacks** (linha do tempo com todas as avaliações
   trimestrais e todos os feedbacks, com autor e data, somente leitura); registro de resumo semanal,
   dificuldades, sinalizações, melhorias, evidências, considerações; ciência.
2. **Sócio — "Painel dos Sócios"**: lista de todos com ciclo atual, % de ações concluídas, atrasos, níveis
   iniciais pendentes, indicadores abaixo da meta, melhorias a validar, avaliações a agendar; filtros por
   setor/cargo/gestor; histórico completo de qualquer colaborador; avaliar e escrever feedback;
   distribuição de "Resultado do ciclo" e evolução por pilar.
3. **Gestor — "Minha equipe"**: mesmo componente do painel dos sócios, filtrado por `gestor_user_id`.
4. **Administração**: modelos, criação de PDI (modelo, colaborador, gestor, D), `pdi_socios` (dropdown de
   `rh_socios` código 48 + usuário; fallback de digitar o nome), reabertura de ciclo com justificativa.
5. **PDI individual** (abas na ordem do documento): Cabeçalho · 1 Objetivo · 2 Perfil · 3 Pilares 1 e 2 ·
   4 Plano do ciclo · 5 Pilares 3 e 4 · 6 Ficha trimestral · 7 Evolução · 8 Ciência.
   Numeração sequencial coerente; títulos e conteúdo idênticos ao documento. Correções ortográficas:
   "Sistema Domínio", "Visão Sistêmica", "a fim de".
6. **Modo Apresentar** (Fase 5): tela cheia, uma seção por tela, teclado, sem edição, coleta de ciências.

## 7. Regras de cálculo (`js/pdi-calculo.js`, puro e testado)

- **Prazos D + n:** dias corridos. D = 07/10/2026 ⇒ +15 = 22/10/2026; +30 = 06/11/2026;
  +60 = 06/12/2026; +90 = 05/01/2027.
- **Ciclos:** ciclo *k* = meses `3(k−1)+1`..`3k` somando meses a D (clamp no último dia do mês);
  fim do PDI = D + 12 meses = 07/10/2027.
- **Percentual:** `numerador ÷ denominador × 100`, 1 casa; denominador 0 ⇒ "sem medição".
- **Atingimento:** numérica compara operador/meta; relativa à linha de base só após definir meta;
  a pactuar ⇒ sem medição no ciclo 1. Saídas: atingida / parcial / não atingida / sem medição.
- **Autonomia automática:** priorizadas com nível atual ≥ 3 ÷ priorizadas × 100; nível atual = último
  validado; gestor pode sobrescrever com justificativa.
- **Meta técnica:** "x de N priorizadas no nível ≥ 2" no ciclo 1, "≥ 3" depois.
- **Controles:** alinhamentos realizados ÷ semanas previstas. **Pendências:** sinalizadas até o prazo ÷
  identificadas.
- **Apoio à decisão da ficha:** médias e resumos exibidos; não preenchem a nota.

## 8. Alertas

Calculados sob demanda ao abrir painéis (badges): nível inicial pendente após D+15; ação a vencer em
3 dias/vencida; resumo semanal ausente; apuração mensal pendente; avaliação a agendar (15 dias antes do
fim do ciclo); ciência pendente; melhoria aguardando validação. E-mail fora da v1.

## 9. Exportação

PDF e DOCX do PDI completo e de cada ficha trimestral reproduzindo a ordem do documento (logo, tabelas,
escalas, textos literais, ciências eletrônicas); indicadores em Excel (`xlsx` já no projeto). Fase 5.

## 10. Seed

Modelo "Assistente de Departamento Pessoal" e PDI da Julia Costa Faria com conteúdo literal do Apêndice A.
`colaborador_user_id` nulo até o admin vincular. Visível a admin e sócios.

## 11. Fases

1. **Base:** `schema_pdi_fase1.sql`, `add_ferramenta_pdi.sql`, RLS, seed, modelos, PDIs, `pdi_socios`,
   cabeçalho, seções 1 e 2, `textos.js`.
2. **Pilares 1 e 2 + plano de ação:** escalas, histórico de níveis, evidências, status, D + n.
3. **Pilares 3 e 4 + acompanhamento:** indicadores/apuração, melhorias com validação, alinhamento
   semanal, sinalizações, feedbacks.
4. **Avaliação:** ficha trimestral, evolução entre ciclos, ciência eletrônica, telas de resultados.
5. **Apresentação, painéis, alertas, exportação PDF/DOCX/Excel.**

Cada fase: SQL idempotente, testes `node` verdes e checklist de fidelidade ao .docx; validação do
usuário antes da seguinte.

## 12. Critérios de aceite

1. PDI seed da Julia mostra todo o conteúdo do .docx (checklist item → tela).
2. Com D = 07/10/2026 os prazos e ciclos batem com a seção 7.
3. PDF exportado segue ordem e aparência do documento.
4. Colaborador não vê PDI alheio nem altera notas; gestor só vê liderados; sócio e admin veem tudo.
5. Ficha trimestral não conclui sem notas (ou N/A justificado), resultado, direcionamento e ciências.

## 13. Riscos

1. Código novo antes do SQL rodar já causou outage no portal: a Fase 1 detecta tabela ausente e
   mostra aviso em vez de tela quebrada.
2. Julia sem usuário no portal até o admin vincular.
3. `rh_socios` código 48 pode estar vazio; fallback de digitar nome.
4. `rh_socios` tem RLS aberta; por isso o poder de sócio depende só de `pdi_socios`.
5. Versão da lib `docx` e compatibilidade do CDN a validar na Fase 5.
