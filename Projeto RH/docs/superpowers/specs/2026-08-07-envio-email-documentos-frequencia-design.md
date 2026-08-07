# Envio de Documentos por E-mail — Controle de Frequência

## Problema

Depois de gerar os PDFs em "Gerar Benefícios" ou "Gerar Folhas de Ponto" (Controle
de Frequência, `Projeto RH/index.html` + `script.js`), o operador baixa os arquivos
e hoje precisa enviá-los manualmente por e-mail aos responsáveis de cada empresa.
Este design adiciona um botão "Enviar por E-mail" nas duas telas, que reaproveita os
PDFs já gerados e os manda como anexo para o(s) responsável(is) cadastrado(s).

## Escopo

- Telas "Gerar Benefícios" (`beneficiosScreen`) e "Gerar Folhas de Ponto"
  (`folhaPontoScreen`).
- Cadastro de e-mail responsável por empresa (`rh_empresas`) e por grupo de empresas
  (`rh_grupos_empresas`).
- Extensão da Edge Function `enviar-email` (já existente, compartilhada com outros
  módulos do portal) para suportar anexos.
- **Fora de escopo:** "Gerar Escala" (não gera PDF/e-mail nesta rodada); reenvio
  automático/agendado; edição avulsa de destinatário na hora do envio; tratamento
  especial de limite de tamanho de payload para lotes muito grandes.

## 1. Cadastro de e-mail responsável

Dois campos novos, texto livre, aceitando múltiplos e-mails separados por vírgula:

- `rh_empresas.email_responsavel` (TEXT, nullable) — editável em `admin.html`
  (aba Empresas), junto aos demais campos de contato da empresa.
- `rh_grupos_empresas.email_responsavel` (TEXT, nullable) — editável na tela
  "Grupos de Empresas" (`gruposScreen`, `script.js`), no mesmo formulário onde hoje
  só existe o campo "Nome do grupo".

Nenhuma tabela nova — só `ALTER TABLE ADD COLUMN IF NOT EXISTS` nas duas já
existentes. SQL fica em `schema_rh_email_responsavel.sql`, a rodar manualmente no
Supabase (mesma convenção do resto do repo — anon key não roda DDL). Até rodar, os
dois campos ficam `null` para todas as empresas/grupos e o botão "Enviar por
E-mail" sempre cai no caso "sem e-mail cadastrado".

## 2. Resolução de destinatário por empresa

Para cada empresa presente no lote gerado (após "Gerar Prévia" + geração dos PDFs):

1. **Rota de grupo:** se o operador marcou um Grupo salvo no seletor da tela
   (`_gruposBeneficiosCache`/equivalente em Folha de Ponto) e essa empresa pertence
   a ele **e** o grupo tem `email_responsavel` preenchido → a empresa entra no
   "balde" daquele grupo. Todas as empresas do mesmo grupo, no mesmo lote, têm seus
   anexos combinados num único envio para o e-mail do grupo.
2. **Rota individual:** caso contrário (empresa não veio de um grupo marcado, ou o
   grupo marcado não tem e-mail cadastrado), usa `rh_empresas.email_responsavel` da
   própria empresa — um envio por empresa.
3. **Sem e-mail:** nem grupo nem empresa têm e-mail cadastrado → a empresa entra
   numa lista informativa "sem e-mail cadastrado" no modal de confirmação; não
   bloqueia o envio das demais.
4. **Múltiplos endereços:** se o campo cadastrado (empresa ou grupo) tiver mais de
   um e-mail separado por vírgula, dispara uma chamada por endereço — mesmo padrão
   de loop já usado em `notificarFechamentoConcluido`
   (`Projeto Fechamento Folha/controle.js`), todas com os mesmos anexos.
5. **Ambiguidade de grupo:** se uma empresa pertencer a mais de um Grupo marcado
   simultaneamente no seletor, usa o primeiro grupo marcado (na ordem em que
   aparece na lista) que a contém. Caso raro, sem UI de desambiguação nesta versão.

Resolução implementada numa função pura e compartilhada entre as duas telas —
`_resolverDestinatariosEnvio(itens, gruposMarcadosIds, gruposCache, itensGruposCache)`
— que recebe a lista de empresas do lote + os grupos marcados no momento da geração
e devolve `{ porDestinatario: [{ email, tipo: 'grupo'|'empresa', nomeOrigem,
empresas: [...] }], semEmail: [...] }`. Evita duplicar a lógica de resolução entre
Benefícios e Folha de Ponto (só a coleta de arquivos é específica de cada tela).

## 3. Coleta dos PDFs já gerados (sem reprocessar)

Hoje as duas telas geram os PDFs e disparam o download na hora
(`pdf.save()`/`_baixarBlob()`), sem guardar os bytes em memória depois. Para anexar
por e-mail sem gerar tudo de novo, cada fluxo passa a também guardar o blob:

- **Folha de Ponto** (`baixarPdfsFolhaPonto`, `script.js`): o loop já constrói um
  `doc` (jsPDF) por empresa antes de `doc.save(...)`. Ajuste: também captura
  `doc.output('blob')` e guarda em
  `state._folhaPontoArquivosGerados[codigo_empresa] = [{ nome, blob }]` (um arquivo
  por empresa, ou por empregado quando `pdf_individual_por_empregado` está ativo —
  nesse caso os blobs individuais, não o zip, para poderem ser reagrupados por
  destinatário sem precisar abrir o zip de novo).
- **Benefícios** (`_gerarPdfsRecibosBeneficios` + `_relatorioLiquidoBeneficiosPDF`,
  `script.js`): cada empresa pode gerar 2–3 arquivos (recibos VT, recibos VA,
  Relatório Líquido — recibos em zip ou PDF único conforme
  `pdf_individual_por_empregado`). Mesmo ajuste: cada ponto que hoje chama
  `pdf.save(...)`/`_baixarBlob(...)` também empurra
  `{ nome, blob }` para `state._beneficiosArquivosGerados[codigo_empresa]`.

O botão "✉️ Enviar por E-mail" (ao lado de "📥 Baixar PDF(s)") só fica habilitado
quando o `state._..._ArquivosGerados` correspondente tem conteúdo — ou seja, depois
de já ter gerado/baixado os PDFs pelo menos uma vez naquela sessão da tela. Trocar
os filtros e gerar de novo substitui o conteúdo anterior do state (sem acumular
lotes antigos).

## 4. Edge Function `enviar-email` — suporte a anexos

`supabase/functions/enviar-email/index.ts` ganha um campo opcional no body:

```ts
anexos?: Array<{ nome: string; conteudoBase64: string }>;
```

Repassado para os dois provedores já suportados:

- **Brevo** (`enviarBrevo`): adiciona `attachment: anexos.map(a => ({ content:
  a.conteudoBase64, name: a.nome }))` ao payload JSON (campo nativo da API Brevo
  `smtp/email`).
- **SMTP/nodemailer** (`enviarSmtp`): adiciona `attachments: anexos.map(a => ({
  filename: a.nome, content: a.conteudoBase64, encoding: 'base64' }))` ao
  `sendMail(...)`.

Campo omitido/vazio → comportamento idêntico ao atual (nenhuma mudança nos usos
existentes da função em outros módulos).

Novo template em `montarHtml()`: `tipo: 'documentos_frequencia'`, params:

```ts
{ tipoDocumento: 'Benefícios' | 'Folhas de Ponto', competencia: string,
  destino: string /* nome da empresa ou do grupo */ }
```

Mensagem simples avisando que os documentos referentes à competência informada
seguem em anexo — sem call-to-action de portal (o destinatário é o responsável
externo pela empresa/grupo, não necessariamente um usuário do sistema; diferente
dos templates existentes que sempre linkam de volta pro portal).

## 5. Modal de confirmação e disparo

Ao clicar "Enviar por E-mail": chama `_resolverDestinatariosEnvio(...)` com o lote
atual e abre um modal:

- Uma linha por destinatário final: `"email@dominio.com" → Empresa A, Empresa B`
  (ou `"Grupo Shopping X"` quando for rota de grupo), com contagem de anexos.
- Seção "⚠️ Sem e-mail cadastrado": lista de empresas que ficaram de fora, só
  informativa.
- Botão "Enviar" dispara `Promise.all` — uma chamada `fetch` à Edge Function por
  destinatário resolvido (mesmo padrão de `notificarFechamentoConcluido` em
  `Projeto Fechamento Folha/controle.js`), com os anexos daquele destinatário
  convertidos para base64 (`blob` → `arrayBuffer` → base64, helper novo
  `_blobParaBase64`).
- Ao final: toast de resumo ("Enviado para N destinatário(s)." ou aviso se algum
  envio falhou), modal fecha. Falha de envio não desfaz nada (os PDFs já foram
  baixados/gerados antes) — mesmo caráter best-effort dos demais disparos de e-mail
  do portal.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `Projeto RH/schema_rh_email_responsavel.sql` | Novo — `ALTER TABLE` em `rh_empresas` e `rh_grupos_empresas` |
| `Projeto RH/admin.html` / `admin.js` | Campo "E-mail(is) do Responsável" na aba Empresas |
| `Projeto RH/index.html` | Campo de e-mail no formulário de grupo (`gruposScreen`); botão "Enviar por E-mail" nas duas telas; modal de confirmação de envio |
| `Projeto RH/script.js` | Captura de blobs em `baixarPdfsFolhaPonto` e `_gerarPdfsRecibosBeneficios`/`_relatorioLiquidoBeneficiosPDF`; `_resolverDestinatariosEnvio`, `_blobParaBase64`, disparo do modal e das chamadas à Edge Function; CRUD do campo `email_responsavel` em `salvarGrupo` |
| `supabase/functions/enviar-email/index.ts` | Suporte a `anexos` (Brevo e SMTP) + template `documentos_frequencia` |

## Riscos / observações

- **SQL pendente:** até `schema_rh_email_responsavel.sql` rodar manualmente no
  Supabase, os campos de e-mail responsável não existem no banco — o botão de
  envio fica funcional na UI mas sempre resolve "sem e-mail cadastrado" para todo
  mundo.
- **Tamanho de payload:** PDFs grandes (ex.: muitas empresas com PDF individual por
  empregado) podem gerar anexos combinados grandes o suficiente para esbarrar no
  limite de payload da Edge Function (Deno Deploy). Sem chunking/limite nesta
  versão — se acontecer na prática, é uma extensão futura.
- **Deploy da Edge Function:** alterar `enviar-email/index.ts` exige rodar
  `supabase functions deploy enviar-email` (mesma CLI já usada nas sessões
  anteriores do Diário Contábil) — só depois disso os anexos funcionam em
  produção, mesmo com o código já commitado.
