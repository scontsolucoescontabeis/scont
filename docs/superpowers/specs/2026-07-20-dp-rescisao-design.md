# Ferramenta Departamento Pessoal — Fluxos de Rescisão

**Data:** 2026-07-20
**Status:** Aprovado

## Contexto

Nova ferramenta do Portal Scont para documentar os fluxos operacionais do
Departamento Pessoal. Primeira entrega: os 6 fluxos de rescisão contratual
já mapeados em `Fluxo Rescisão/*.docx` (fonte de conteúdo, não editada por
esta ferramenta). Cada fluxo textual deve vir acompanhado de um fluxograma
visual (Mermaid.js) para facilitar a leitura do processo pelo time de DP.

Categorias futuras do DP (admissão, férias, etc.) devem caber na mesma
navegação sem redesenho.

## Decisões

- **Dados:** hardcoded em `data/rescisao.js` (array de objetos, um por
  tipo de rescisão). Sem tabela no Supabase — conteúdo muda pouco e é
  editado via código quando necessário.
- **Fluxo visual:** Mermaid.js (`flowchart TD`) via CDN, um diagrama por
  fluxo, nó por Etapa. O fluxo "Pedido de demissão com desconto ou
  dispensa do aviso" tem um losango de decisão (3 situações: desconto
  total / dispensa / novo emprego) que reconverge antes da Etapa 3 — é o
  único dos 6 com ramificação real na fonte.
- **Navegação:** sidebar em árvore (categoria "Rescisão" expansível → 6
  tipos). SPA de página única, sem reload, pronta para novos ramos
  (categorias) no futuro.
- **Visual/paleta:** replica `--primary #8B3A3A`, `--secondary #2C3E50`,
  `--bg #F0F2F5`, `--border #E0E6ED` e o gradiente de sidebar já usados em
  `Projeto Licenças` e `Projeto Mala Direta`.
- **Auth:** `../portal-auth-guard.js` + `../supabase-config.js`, mesmo
  padrão das demais ferramentas.
- **Integração no portal:** `_sql/add_ferramenta_dp.sql`, INSERT
  idempotente (`ON CONFLICT DO NOTHING`) em `public.ferramentas`, seguindo
  o padrão de `_sql/add_ferramentas_novas.sql`. Execução manual no SQL
  Editor do Supabase pelo usuário — este projeto não escreve no banco
  diretamente.

## Estrutura de arquivos

```
Projeto Departamento Pessoal/
  index.html          shell: sidebar + área de conteúdo
  styles.css           paleta e layout
  app.js                renderização da árvore, conteúdo e diagrama mermaid
  data/rescisao.js      6 fluxos de rescisão
_sql/add_ferramenta_dp.sql
```

## Modelo de dados de cada fluxo

```js
{
  id: 'sem-justa-causa-com-aviso',
  nome: 'Dispensa sem justa causa — aviso prévio trabalhado',
  resumo: {
    prazo: '...',
    observacaoAvisoPrevio: '...',
    referenciasLegais: '...',
  },
  etapas: [
    { titulo: 'Etapa 1: ...', tarefas: [ { titulo: '...', detalhes: ['...'] } ] },
  ],
  documentos: ['TRCT assinado', '...'],
  mermaid: `flowchart TD\n  A[Etapa 1] --> B[Etapa 2] ...`,
}
```

Conteúdo de cada campo extraído diretamente dos 6 `.docx` da pasta
`Fluxo Rescisão` (etapas, tarefas, passo a passo no sistema Domínio,
checklist de documentos e a tabela resumo de prazo/observação/referência
legal presente em cada arquivo).

## Fora de escopo (v1)

- Outras categorias do DP (admissão, férias) — apenas a navegação deve
  estar preparada para recebê-las.
- Edição de fluxos pela UI (conteúdo é somente leitura).
- Registro automático no Supabase — feito via SQL manual.
