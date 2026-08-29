# Controle de Alterações Contratuais

Ferramenta interna do Portal Scont. Recebe duas versões do contrato social de um
cliente (PDF ou `.docx`), compara a **CONSOLIDAÇÃO CONTRATUAL** cláusula a
cláusula e gera um documento de controle (PDF via impressão do navegador) com a
redação anterior × atual lado a lado.

Design completo: `../docs/superpowers/specs/2026-08-28-controle-alteracoes-contratuais-design.md`

## Arquitetura

100% no navegador. Sem backend, sem persistência.

| Arquivo | Papel |
|---|---|
| `index.html` / `styles.css` | UI |
| `js/extract.js` | PDF (pdf.js) / `.docx` (mammoth) → texto — único módulo com libs externas |
| `js/parser.js` | texto → `{ capa, clausulas }` (isola a consolidação, segmenta, extrai capa) |
| `js/matcher.js` | casa cláusulas por título normalizado + similaridade; classifica Alterada/Nova/Suprimida |
| `js/differ.js` | diff palavra a palavra (LCS) |
| `js/report.js` | monta o HTML do documento de controle |
| `js/app.js` | orquestração + UI (sem lógica de parsing) |

`parser/matcher/differ/report` são módulos puros (sem DOM), testáveis em Node.

## Testes

```
node tests/run.js
```

Os testes unitários rodam sempre. Os testes de **integração** (parser/matcher)
usam 3 PDFs reais da FH Tecnologia que **não são versionados** (dados de
cliente — ver `.gitignore`); rodam só quando esses arquivos estão presentes na
pasta. Dependem de `pdfjs-dist` em `node_modules`.

## Publicar no portal

1. Rodar `_sql/add_ferramenta_contratual.sql` no SQL Editor do Supabase (projeto principal).
2. Liberar acesso aos usuários no Painel Administrativo → Gerenciar Acessos.

## Limitações (v1)

- Não faz OCR — PDF só-imagem (escaneado) é rejeitado.
- Não substitui análise jurídica; não valida se a alteração está correta.
- Casamento de cláusulas assume o padrão de contrato da Junta Comercial
  (cabeçalhos "PRIMEIRA CLÁUSULA – TÍTULO"). Layout fora do padrão cai em
  fallback de texto integral, com aviso.
