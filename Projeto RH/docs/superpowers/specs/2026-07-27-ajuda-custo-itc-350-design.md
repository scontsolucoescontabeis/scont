# Ajuda de Custo (rubrica 201) — empresa 350 ITC, na tela "Gerar Benefícios"

Data: 2026-07-27
Arquivos afetados: `index.html`, `script.js`, nova migração `schema_rh_ajuda_custo_lancamentos.sql`

## Contexto

A empresa 350 - ITC BRASIL TECNOLOGIAS LTDA paga "Ajuda de Custo" (rubrica 201, ver `docs/rubricas-por-empresa.md`) para completar o benefício do empregado até R$ 1.000,00: `ajudaCusto = max(0, 1000 - (VTmensal + VAmensal))`, usando o valor bruto de VT/VA pago pela empresa (mesmos campos já calculados na prévia de benefícios: `diasPagar * vtDiario` / `diasPagar * vaDiario`). Só é gerado lançamento quando a soma for menor que 1000; empregados com soma ≥ 1000 têm ajuda de custo zero e não entram no TXT.

Ao clicar em "Gerar Recibos" (`gerarRecibosBeneficios`, script.js:3903) para a empresa 350, antes de gerar os PDFs, o sistema deve avisar sobre essa regra e oferecer gerar o TXT de lançamento (rubrica 201) no mesmo layout usado no Controle de Frequência.

## Fluxo

1. `gerarRecibosBeneficios()` monta `linhas` (empregados selecionados) como hoje. Se houver linhas com `codigo_empresa === '350'`, chama `_verificarAjudaCustoITC350(linhas, comp)` **antes** de prosseguir para os PDFs.
2. `_verificarAjudaCustoITC350` consulta `rh_ajuda_custo_lancamentos` (`codigo_empresa='350' AND competencia=comp`). Se já existe registro, não mostra nada — segue direto para `_gerarPdfsRecibosBeneficios(linhas, comp)`.
3. Se não existe registro, calcula por empregado (`nome_empregado`, `codigo_empregado`, `vtMensal`, `vaMensal`, `soma`, `ajudaCusto`) e abre o modal `#ajudaCustoITCModal`:
   - Texto fixo explicando a regra (1000 − (VT+VA), rubrica 201).
   - Tabela: Empregado | VT mensal | VA mensal | Soma | Ajuda de Custo — todos os selecionados da 350, valor "R$ 0,00" para quem já está ≥ 1000.
   - Se houver ao menos 1 empregado com `ajudaCusto > 0`: pergunta "Deseja gerar o TXT de lançamento (rubrica 201)?" com botões "Sim, gerar TXT" / "Agora não".
     - "Agora não" → fecha modal, **não** grava registro de controle (pode perguntar de novo na próxima tentativa), segue para os PDFs.
     - "Sim, gerar TXT" → mostra pré-visualização (mesmo padrão de `_mostrarPrevia`: 20 primeiras linhas + contagem) e um botão "Baixar TXT". Ao baixar: grava registro em `rh_ajuda_custo_lancamentos`, dispara o download, fecha o modal e segue para os PDFs.
   - Se ninguém tiver `ajudaCusto > 0` (todos ≥ 1000): mostra só a tabela informativa + botão "Fechar". Ao fechar, grava o registro de controle mesmo assim (nada a gerar neste mês) e segue para os PDFs.
4. Em todos os casos o fluxo de recibos em PDF (`_gerarPdfsRecibosBeneficios`, corpo já existente de `gerarRecibosBeneficios`) roda normalmente depois — a checagem de ajuda de custo nunca impede a geração dos recibos.

## Layout do TXT (rubrica 201)

Mesmo layout de `_linhasTxt` (script.js:3001), reaproveitando o helper de montagem de linha (extraído para uso compartilhado): 

```
"10" + codigo_empregado (10 díg., zero-pad) + competencia AAAAMM (6 díg.)
     + "201" (rubrica, 9 díg., zero-pad) + "11" (tipo processo, Folha Mensal, 2 díg.)
     + valor em centavos (9 díg., zero-pad) + codigo_empresa (10 díg., zero-pad) + "\n"
```

Uma linha por empregado com `ajudaCusto > 0`. **Competência usada dentro do TXT e no nome do arquivo é a competência do recibo menos 1 mês** (confirmado pelo usuário — `_competenciaTxtAjudaCustoITC`), diferente da competência usada para o controle de "já gerado" (`rh_ajuda_custo_lancamentos.competencia`), que continua sendo a competência do recibo (mês trabalhado) tal como digitada na tela. Nome do arquivo: `Lancamentos_AjudaCusto_350_MM-AAAA.txt` (MM/AAAA já ajustados -1 mês). Mesmo `Blob(text/plain;charset=utf-8)` e download via link temporário já usados em `_efetivarDownloadTXTResultados`.

## Persistência — `rh_ajuda_custo_lancamentos`

Nova tabela (migração pendente de execução manual no Supabase, mesmo padrão das demais `schema_rh_*.sql`):

```sql
CREATE TABLE IF NOT EXISTS public.rh_ajuda_custo_lancamentos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa      TEXT NOT NULL,
    competencia         TEXT NOT NULL,
    gerado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rh_ajuda_custo_lancamentos_empresa_competencia_unique UNIQUE (codigo_empresa, competencia)
);
```

RLS habilitado, políticas de leitura/escrita para `authenticated` (mesmo padrão de `schema_rh_valores_va_vt.sql`).

## Fora de escopo

- Regra hardcoded só para `codigo_empresa === '350'` — sem tela de configuração por empresa.
- Nenhuma mudança na elegibilidade/geração dos recibos em PDF já existente.
- Nenhuma mudança em `exportarBeneficiosExcel`.
