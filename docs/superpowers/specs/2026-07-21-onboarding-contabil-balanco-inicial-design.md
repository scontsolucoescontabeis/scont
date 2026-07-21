# Onboarding Contábil — Balanço Inicial (Design)

## Contexto

A SCONT já formalizou o conteúdo do levantamento de onboarding contábil no
documento `Formulario_Onboarding_Contabil_Balanco_Inicial.docx` (Seções A-H +
Anexo I com a lógica condicional de exibição). Este spec cobre a implantação
desse conteúdo como ferramenta do Portal SCONT.

## Escopo

Ferramenta **interna** (equipe SCONT), sem acesso do cliente. Um colaborador
cria um onboarding para uma empresa já cadastrada em `rh_empresas`, responde
um pequeno conjunto de perguntas-gatilho, e a ferramenta gera automaticamente
o checklist de itens aplicáveis (documentos + validações), agrupado por
seção, com upload, status e progresso.

Fora do escopo desta fase: link público para o cliente preencher; geração
automática de lançamento contábil no Domínio; catálogo de itens editável via
UI (fica fixo em código — ver "Evolução futura").

## Modelo de dados

`contabil_onboardings` — um registro por empresa em onboarding:
`codigo_empresa` (FK texto → `rh_empresas.codigo_empresa`), `razao_social`,
`cnpj`, `data_corte`, `regime_tributario`, `responsavel_scont`,
`data_inicio`, as 6 respostas-gatilho (`tem_contabilidade_anterior`,
`tem_empregados`, `tem_estoque`, `contribuinte_icms`, `prestador_servicos`,
`tem_emprestimos`) como colunas boolean, `status`.

`contabil_onboarding_itens` — uma linha por item aplicável, gerada a partir
do catálogo estático (`data/catalogo.js`) no momento da criação do
onboarding, com base nas respostas-gatilho: `secao`, `item_codigo` (chave do
catálogo), `item_texto`, `exigencia`, `observacao_catalogo` (texto de ajuda,
somente leitura), `status` (pendente/enviado/aprovado/rejeitado/não
aplicável), `arquivo_url`, `arquivo_nome`, `observacao` (nota da equipe),
`atualizado_por`, `atualizado_em`.

Seção H (validações internas) usa a mesma tabela de itens — não há
diferenciação de acesso porque a ferramenta inteira já é interna.

## Lógica condicional (geração dos itens)

Reproduz o Anexo I do documento: cada item do catálogo tem um `condicao`
opcional (chave de resposta-gatilho + valor esperado). Itens sem `condicao`
são sempre gerados (o item já é obrigatório, ou é condicional mas sem um
gatilho binário claro no Anexo I — nesse caso a equipe marca manualmente
"não aplicável"). Isso é intencional: não inventamos regras de negócio além
das que o Anexo I especifica.

Regras mapeadas: regime tributário (E.1/E.2/E.3 — Lucro Real inclui E.2 +
E.3), contabilidade anterior (C.1 vs C.2, e o item de contato do contador
anterior), empregados (maior parte da Seção F, itens de eSocial/FGTS da
Seção B), estoques (itens de inventário em C.1/C.2), contribuinte de ICMS
(acesso SEFAZ, EFD-ICMS/IPI), prestador de serviços (acesso NFS-e, ISS
retido), empréstimos/financiamentos (contratos e amortização em C.1/D).

## Fluxo de UI

Ferramenta em `Projeto Onboarding Contabil/` (index.html + app.js +
styles.css, reaproveitando `shared.css`, `portal-auth-guard.js` e o padrão
sidebar+main já usado no Departamento Pessoal):

1. **Lista de onboardings** — todos em andamento, com % de conclusão,
   empresa, responsável, status. Botão "Novo Onboarding".
2. **Novo Onboarding** — seleciona empresa (`rh_empresas`), preenche dados
   (CNPJ, data de corte, regime, responsável, data de início) + as 6
   perguntas-gatilho. Ao salvar, gera as linhas de `contabil_onboarding_itens`.
3. **Checklist** — itens agrupados por seção/subseção, cada um com
   upload (bucket `documentos`, caminho
   `onboarding-contabil/{codigo_empresa}/{secao}/{item_codigo}_{arquivo}`,
   mesmo padrão do Gerenciador de Formulários), seletor de status,
   observação da equipe, texto de ajuda do catálogo. Barra de progresso por
   seção e geral.
4. **Validação Interna (Seção H)** — mesma UI de checklist, sem upload
   (só status + observação), sempre visível como aba separada.

## Armazenamento de arquivos

Reaproveita o bucket `documentos` já usado pelo Gerenciador de Formulários
(sem criar bucket novo), com `createSignedUrl` para visualização.

## Registro no portal

`ferramentas` já é a fonte de verdade do portal.html (data-driven, sem
cards hardcoded). Registro via `_sql/add_ferramenta_onboarding_contabil.sql`,
seguindo o padrão de `_sql/add_ferramenta_dp.sql` (INSERT idempotente).

## Evolução futura (fora desta fase)

- Catálogo editável via UI/tabela (`contabil_checklist_catalogo`) em vez de
  fixo em `data/catalogo.js`, se o checklist mudar com frequência.
- Lembretes automáticos de itens pendentes (reaproveitando
  `notificacoes.js`).
- Link de preenchimento direto para o cliente (fora de escopo — decisão
  explícita de manter 100% interno nesta fase).
