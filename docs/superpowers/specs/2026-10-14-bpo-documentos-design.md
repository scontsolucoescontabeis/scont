# BPO Financeiro — Monitor de Documentos Publicados (design)

Data: 2026-10-14 · Local: `Projeto BPO/` · Status: aprovado em conversa, implementação autorizada.

## Objetivo
Ferramenta do portal (identidade Departamento Contábil) que recebe o relatório "Documentos Publicados" do Onvio
(`documentos-publicados.xlsx`), identifica o que cada cliente com BPO publicou no mês e dispara e-mails de alerta
conforme as regras de negócio. **Sem robô**: o relatório é subido por uma pessoa da equipe e o disparo é assistido.

## Decisões
- Escopo **B**: tipos de documento configuráveis (pasta + palavra-chave). Nasce com "Extrato bancário".
- Disparo **assistido**: fila de alertas revisável; nada sai sem clique em Enviar.
- Empresas: base `rh_empresas`; cada empresa tem marcador **possui BPO** (só essas são monitoradas) e e-mails próprios.
- Nome do relatório → empresa por nome normalizado; não reconhecidos são vinculados manualmente (vínculo salvo).

## Dados (`_sql/schema_bpo_documentos.sql`, RLS admin + equipe Scont)
`bpo_config` (linha única), `bpo_empresas`, `bpo_tipos_documento`, `bpo_relatorios`, `bpo_publicacoes`,
`bpo_vinculos`, `bpo_marcacoes` (recebido manual / dispensado), `bpo_alertas` (histórico).

## Regras
- Competência sugerida = mês anterior ao fim do período do relatório (editável).
- Empresa BPO × tipo ativo: `ENVIADO` se há ≥1 publicação não excluída na pasta do tipo (e palavra-chave, se houver);
  senão `PENDENTE`; marcação manual sobrepõe.
- Calendário (D1/D5/D10/D15/D17, ajustado para dia útil com feriados nacionais/DF/extras) vem de `bpo_config`.
  Etapa atual = última etapa com data ≤ hoje. Um e-mail por empresa lista todos os documentos pendentes.
- Fila = pendentes sem alerta OK da mesma etapa, com e-mail, não dispensados. Relatório da chefe (D17) lista pendências.
- Modo teste (padrão ligado) redireciona tudo para o e-mail de teste. Relatório com data de emissão antiga gera aviso.

## Componentes
`bpo-util.js` (parser, normalização, calendário, status — puro, testado em Node), `bpo.js` + `index.html` (UI),
`supabase/functions/bpo-alertas` (envio; destinatários e textos lidos no servidor).

## Pendências operacionais
Rodar o SQL no Supabase; `supabase functions deploy bpo-alertas`; preencher e-mails da chefe/teste em Regras e textos.
