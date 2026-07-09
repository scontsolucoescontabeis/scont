# Design: Importação de Férias Calculadas e Exibição na Folha de Ponto

**Data:** 2026-07-08
**Status:** Aprovado
**Arquivos principais:** `Projeto RH/index.html`, `Projeto RH/script.js`, `Projeto RH/schema_rh.sql`

---

## Contexto

O sistema fonte (folha de pagamento) emite periodicamente um relatório em PDF, "Relação de Férias Calculadas", listando — para **todas as empresas** de uma vez — os empregados com período de férias já calculado, incluindo as datas de início e fim de gozo. Hoje essa informação não existe no Controle de Frequência: quando o operador revisa a folha de ponto de um empregado que estava de férias durante a competência, os dias aparecem apenas como "SEM REGISTRO", sem nenhum indício de que o empregado estava, na verdade, de férias.

Este design cria (1) uma tela de importação desse PDF, que faz o parsing client-side e grava os períodos de férias em uma tabela nova no Supabase, e (2) a exibição automática de um badge "FÉRIAS" nos dias correspondentes, tanto na tela de edição quanto na tela de resultados/revisão da Folha de Ponto — para qualquer empresa/competência processada depois da importação.

---

## Escopo confirmado com o usuário

- **Upload global, não por empresa:** o PDF real contém dezenas de empresas em um único arquivo (uma faixa "Empresa: `<código>` - `<nome>`" por página/bloco, com N empregados cada). Uma única importação atualiza a base para todas as empresas presentes no arquivo. Não há tela de seleção de empresa antes do upload.
- **Reenvio do PDF:** *upsert* por `(codigo_empresa, codigo_empregado, ferias_inicio)`. Nunca apaga histórico; nunca duplica o mesmo período.
- **Exibição na Folha de Ponto:** badge automático **"FÉRIAS"**, não editável pelo operador — cruza os dias da competência com a base salva no momento em que `calcularFolha` roda (mesmo timing dos demais flags). Não vira opção no dropdown manual de Folga/Falta.
- **Campo relevante do PDF:** apenas a coluna **Férias Início/Fim** (o período efetivamente gozado). A coluna **Abono** (venda de 1/3 das férias) é ignorada — o empregado trabalha normalmente nesses dias, não é um período de afastamento.
- **Impacto em totais:** dia de férias sem registro de horas e sem flag manual → **sem impacto em `totalFaltante`/`totalFaltas`** (mesmo tratamento que Folga já tem hoje). Se houver flag manual já setado pelo operador (ex.: Falta) ou horas registradas nesse dia, o cálculo desses dois não muda — o badge "FÉRIAS" aparece do mesmo jeito, apenas como alerta informativo adicional para o operador revisar.
- **Fora de escopo (por decisão do usuário):** férias **não** entram na contagem de desconto de VA/VT do modal de aviso (spec `2026-07-07-aviso-descontos-va-vt-design.md`) — fica restrito a Falta/Atestado como já é hoje.
- **Fora de escopo (v1):** tela de consulta/exclusão manual dos registros de férias importados. A tela de upload mostra um resumo pós-importação (quantos registros novos/atualizados por empresa) e isso é suficiente por enquanto.

---

## Banco de Dados

Nova tabela, sem FK para `rh_empregados` (o PDF pode referenciar empregados que ainda não estão cadastrados no módulo; o cruzamento com a Folha de Ponto é feito em tempo de leitura, por código):

```sql
-- ============================================================
-- TABELA: rh_ferias_calculadas
--    Períodos de férias por empregado, importados do PDF
--    "Relação de Férias Calculadas" do sistema fonte.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rh_ferias_calculadas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_empresa    TEXT NOT NULL,
    codigo_empregado  TEXT NOT NULL,
    nome_empregado    TEXT NOT NULL,
    ferias_inicio     DATE NOT NULL,
    ferias_fim        DATE NOT NULL,
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT rh_ferias_calc_uniq UNIQUE (codigo_empresa, codigo_empregado, ferias_inicio)
);

CREATE INDEX IF NOT EXISTS idx_rh_ferias_empresa_empregado
    ON public.rh_ferias_calculadas (codigo_empresa, codigo_empregado);

ALTER TABLE public.rh_ferias_calculadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_ferias_calculadas: leitura autenticado"
    ON public.rh_ferias_calculadas FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "rh_ferias_calculadas: escrita autenticado"
    ON public.rh_ferias_calculadas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
```

`codigo_empresa`/`codigo_empregado` são os mesmos códigos numéricos (armazenados como TEXT) já usados em `rh_empresas`/`rh_empregados` — confirmado batendo os códigos do PDF de exemplo ("Empresa: 2 - CENTRO AUTOMOTIVO...", empregado "9 LUIZ FELIPE...") com o padrão já existente nessas tabelas.

---

## Nova dependência: PDF.js

Adicionar ao `index.html`, junto aos demais scripts de biblioteca (mesmo padrão do `xlsx.full.min.js` e `jszip.min.js`, já carregados via CDN). A versão 3.11.174 é a última com build UMD (`pdf.min.js`, expõe `window.pdfjsLib` via `<script>` normal); versões 4+ do pacote só distribuem ES module (`.mjs`), incompatível com o padrão de scripts sem `type="module"` já usado no restante do projeto:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"></script>
```

`pdfjsLib.GlobalWorkerOptions.workerSrc` precisa apontar para a mesma URL do `pdf.worker.min.js` antes do primeiro uso. Usado apenas para extração de texto (`getTextContent()` por página) — sem renderização visual do PDF na tela.

---

## Navegação

Novo item na sidebar, mesmo padrão dos demais (`sidebar-item`, `onclick="mostrarTela('feriasScreen')"`):

```html
<button class="sidebar-item" onclick="mostrarTela('feriasScreen')">
    <span class="sidebar-item-icon">🏖️</span> Importar Férias
</button>
```

### Tela `feriasScreen`

```
┌─ IMPORTAR FÉRIAS CALCULADAS ──────────────────────────────┐
│ Envie o PDF "Relação de Férias Calculadas" (todas as       │
│ empresas). Os períodos de férias encontrados ficam         │
│ disponíveis automaticamente na Folha de Ponto.              │
│                                                              │
│ [ Selecionar arquivo PDF ]   [ 📥 Processar PDF ]           │
│                                                              │
│ ── (após processar) ─────────────────────────────────────  │
│ Resumo da importação:                                       │
│  ✅ 87 registros salvos (72 novos, 15 atualizados)           │
│  ⚠️ 3 linhas não reconhecidas (ver detalhes)                │
│                                                              │
│ Empresa                          | Empregados encontrados   │
│ 2 - CENTRO AUTOMOTIVO...         | 1                        │
│ 5 - V. DE SOUZA VIANA ME         | 1                        │
│ ...                                                          │
└──────────────────────────────────────────────────────────┘
```

- Botão "Processar PDF" fica desabilitado até um arquivo ser selecionado.
- Durante o processamento (parsing + upsert em lote no Supabase), mostrar indicador de carregamento — pode levar alguns segundos com dezenas de páginas.
- "Linhas não reconhecidas" (se houver) lista o texto bruto da linha e a página, para o operador avaliar manualmente se precisa reportar ao sistema fonte ou ignorar (ex.: variação de layout inesperada). Não bloqueia a importação do restante.

---

## Parsing do PDF

### Técnica: reconstrução de linhas por posição visual

O texto bruto retornado por `page.getTextContent()` no PDF.js vem como uma lista de *text runs* com posição (`item.transform[4]` = x, `item.transform[5]` = y), **não necessariamente na ordem de leitura visual** (relatórios gerados por motores tipo Crystal Reports frequentemente desenham rótulos e valores em blocos separados no content stream). Por isso o parser reconstrói linhas visuais antes de aplicar qualquer regex:

1. Ordenar todos os *text runs* da página por `y` decrescente (topo → base, já que o eixo Y do PDF cresce para cima).
2. Agrupar sequencialmente: um novo grupo (linha) começa sempre que o `y` do próximo item se afastar mais de `1.0` pt do `y`-âncora do grupo aberto (o `y` do primeiro item desse grupo). Validado com o PDF de exemplo real via `pdfjs-dist` (Node): itens de uma mesma linha de tabela compartilham o `y` exato (diferença `0.0`); pares rótulo/valor que só *parecem* alinhados na mesma linha visual (ex.: "Empresa:"/"CNPJ:" à esquerda vs. "Página:"/"Emissão:"/"Hora:" à direita) na verdade têm `y` ligeiramente diferente (~`1.5` pt) — por isso o limiar `1.0` os mantém em linhas separadas, exatamente como devem ficar (evita concatenar "Empresa: 2 - CENTRO AUTOMOTIVO... Página: 1/1" na mesma string). Linhas de tabela consecutivas (ex.: linha de início e linha de fim de um mesmo empregado) ficam ~`11`–`12` pt distantes, bem acima do limiar.
3. Dentro de cada grupo, filtrar itens com `str` vazio (comuns nesse gerador de PDF — text runs "fantasma" de largura zero), ordenar por `x` crescente, concatenar os `str` restantes com um espaço entre cada par e normalizar espaços múltiplos (`.replace(/\s+/g, ' ').trim()`).

Isso reproduz a disposição visual real da tabela: `Empresa: 2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA` numa única linha isolada, cada empregado em duas linhas consecutivas (linha de início + linha de fim/complementos) — confirmado byte a byte contra a extração real do PDF de exemplo do repositório.

### Reconhecimento de linhas

Sobre as linhas reconstruídas de cada página:

- **Cabeçalho de empresa:** linha que casa `/^Empresa:\s*(\d+)\s*-\s*(.+)$/` → define `codigo_empresa`/`nome_empresa` correntes para as linhas de empregado seguintes, até o próximo cabeçalho de empresa.
- **Linhas de cabeçalho de coluna** ("Código Nome do empregado Aquisitivo...", "Início Início Início...", "Fim Fim Fim", etc.) e linhas de rodapé ("Página:", "Sistema licenciado para...") são ignoradas via lista de prefixos/conteúdos conhecidos.
- **Primeira linha de um registro de empregado:** casa `/^(\d+)\s+(.+?)\s+(?:\d{2}\/\d{2}\/\d{4}\s*){2,3}[\d.,\s]+$/` — começa com o código do empregado (inteiro puro, não confundir com data). Extrai todas as datas `DD/MM/AAAA` da linha via `/\d{2}\/\d{2}\/\d{4}/g`: **o índice 1 (segunda data)** é sempre "Férias Início", independentemente de haver 2 datas (sem abono) ou 3 datas (com abono) — a ordem de colunas no relatório é sempre Aquisitivo → Férias → [Abono].
- **Segunda linha (linha "Fim") do mesmo registro:** começa diretamente com uma data (`/^\d{2}\/\d{2}\/\d{4}/`), sem código de empregado na frente. Mesma regra: índice 1 das datas encontradas = "Férias Fim".
- **Linhas "Total da empresa:"** (e sua continuação) começam com texto, não com um número puro nem com uma data — não casam em nenhum dos dois padrões acima e são ignoradas naturalmente.
- Todo registro de empregado exige a linha de início **e** a linha de fim válidas (mesma contagem de datas); se a linha seguinte não casar com o padrão de continuação, o registro entra na lista de "linhas não reconhecidas" e é pulado.

### Resultado do parsing

Lista de `{ codigo_empresa, nome_empresa, codigo_empregado, nome_empregado, ferias_inicio, ferias_fim }` (datas convertidas de `DD/MM/AAAA` para `AAAA-MM-DD` antes de gravar, compatível com a coluna `DATE`).

### Upsert em lote

`supabaseClient.from('rh_ferias_calculadas').upsert(lista, { onConflict: 'codigo_empresa,codigo_empregado,ferias_inicio' })`, em lotes (ex.: 200 registros por chamada) para evitar payload excessivo. Resumo pós-importação conta quantos registros vieram como `insert` vs `update` comparando com uma leitura prévia das chaves existentes (ou, de forma mais simples, apenas relatando o total processado por empresa — ver "Pontos de atenção" abaixo).

---

## Integração com a Folha de Ponto

### Carregamento por empresa

Novo `state.feriasCalculadas` — mapa `codigo_empregado → [{ inicio: 'AAAA-MM-DD', fim: 'AAAA-MM-DD' }, ...]`, carregado por:

```js
async function carregarFeriasCalculadas(codigoEmpresa) {
    const { data, error } = await supabaseClient
        .from('rh_ferias_calculadas')
        .select('codigo_empregado, ferias_inicio, ferias_fim')
        .eq('codigo_empresa', codigoEmpresa);
    if (error) { state.feriasCalculadas = {}; return; }
    state.feriasCalculadas = {};
    (data || []).forEach(r => {
        (state.feriasCalculadas[r.codigo_empregado] ??= []).push({ inicio: r.ferias_inicio, fim: r.ferias_fim });
    });
}
```

Chamada junto de `carregarEmpregados(codEmp)` no handler de submit da tela inicial (`script.js:243`), logo antes de `verificarPreenchimentosAnteriores`.

### Cálculo por dia (`calcularFolha`)

Nova função utilitária `_dataEmFerias(dataBR, empregadoId)`: converte `dataBR` (`DD/MM/AAAA`) para `AAAA-MM-DD` e verifica se cai em algum intervalo `[inicio, fim]` de `state.feriasCalculadas[empregadoId]`.

Dentro do `map` de dias em `calcularFolha` (`script.js:1303`), calcular `flagFerias = _dataEmFerias(dia.data, folha.empregadoId)` uma única vez por dia, incondicionalmente. Único ponto de mudança de comportamento: no ramo `else if (!isDiaDescanso)` (linha ~1384), quando não há flag manual (`flagFolgaData` vazio) — hoje cai em `flagSemRegistro = true`; passa a checar `flagFerias` **antes** disso:

```js
} else if (!isAtestado) {
    if (flagFerias) {
        // sem impacto em totais — mesmo tratamento de Folga
    } else {
        flagSemRegistro = true;
    }
}
```

Em todos os outros casos (há flag manual setado, ou há horas registradas no dia), o comportamento de cálculo **não muda** — `flagFerias` é apenas incluído no objeto de retorno do dia para exibição, sem alterar `faltante`/`totalFaltas`/`totalFaltante`.

Adicionar `flagFerias: flagFerias` ao objeto retornado por dia (`script.js:1429` em diante).

### Exibição — tela de edição (`renderizarConteudoAba`)

Mesmo padrão já usado para feriado (`infoExtra`, `script.js:813`): abaixo da data, quando `_dataEmFerias(dia.data, folha.empregadoId)` for verdadeiro, mostrar um rótulo informativo:

```html
<span style="color: #b45309; font-size: 11px; display: block;">Férias</span>
```

### Exibição — tela de resultados/revisão (badges)

Em `gerarRelatorio`/renderização de `res.dias` (`script.js:1655` em diante), novo badge, mesmo padrão visual dos existentes:

```js
if (dia.flagFerias) {
    flags += '<span style="background: #fde68a; color: #78350f; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; margin-right: 4px;">FÉRIAS</span>';
}
```

E no export Excel (`script.js:1746` em diante, string `flagsStr`): `if (dia.flagFerias) flagsStr += 'FÉRIAS ';`.

---

## Integração com Processamento em Lote de Grupo

O design de `2026-07-08-grupos-empresas-lote-design.md` já processa múltiplas empresas em sequência (`processarLoteGrupo`), buscando config por empresa a cada iteração (`_buscarConfigRubricas`). Mesmo ponto de extensão: dentro do loop por empresa, antes de montar/calcular as folhas, chamar `await carregarFeriasCalculadas(codEmp)` (a mesma função usada no fluxo single-empresa) para popular `state.feriasCalculadas` daquela empresa antes de `calcularFolha`. Como já existe snapshot/restore do `state` ao redor desse loop (para não deixar resíduo na tela manual), `feriasCalculadas` entra na lista de campos salvos/restaurados no snapshot.

---

## O que NÃO muda

- Lógica de Folga/Falta/Atestado/Compensação — continuam exclusivamente manuais via dropdown, sem nenhuma interação com o novo flag.
- Cálculo de horas extras, noturnas, DSR/feriado.
- Aviso de desconto de VA/VT (`2026-07-07-aviso-descontos-va-vt-design.md`) — continua contando apenas Falta/Atestado, sem Férias.
- Coluna "Abono" do PDF é lida apenas para não confundir a contagem de datas por linha; nunca é gravada nem usada para marcar dias.
- Fluxo de upload de Excel/processamento normal da Folha de Ponto — nenhuma mudança de UI fora dos pontos citados acima.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `index.html` | Script PDF.js via CDN; novo item de sidebar; tela `feriasScreen` (upload + resumo) |
| `script.js` | Parsing do PDF (`_parsearPdfFerias`, reconstrução de linhas, regex de registro), upsert em lote, `carregarFeriasCalculadas`, `_dataEmFerias`, integração em `calcularFolha`, badges nas telas de edição/resultados/export Excel, integração em `processarLoteGrupo` |
| `schema_rh.sql` | Nova tabela `rh_ferias_calculadas` + RLS |

---

## Pontos de atenção para a fase de plano de implementação

- **Parsing já validado contra o PDF real de exemplo** (`Projeto RH/Relação de Férias Calculadas.pdf`) durante o desenho deste spec, usando `pdfjs-dist` em Node para inspecionar as posições reais (`x`/`y`) dos *text runs* de várias páginas (incluindo casos com múltiplos empregados por empresa e com Abono/3 datas). O algoritmo de reconstrução de linhas (Seção "Parsing do PDF") e a regra "segunda data = Férias" foram confirmados byte a byte contra esses dados reais — não é mais um risco em aberto, mas o plano de implementação deve incluir testes automatizados (Node, sem framework) que fixem esse comportamento usando linhas reais extraídas do PDF de exemplo como fixture.
- **Contagem de novos vs. atualizados no resumo:** implementar lendo as chaves já existentes (`codigo_empresa, codigo_empregado, ferias_inicio`) filtradas pelas empresas presentes no PDF antes do upsert, e comparar com os registros parseados — o volume é pequeno o suficiente (uma consulta por importação) para não pesar.
- **Nomes de empresa/empregado quebrados em duas linhas:** o parser assume nome em uma única linha visual; não ocorre no PDF de exemplo (32 páginas, nenhum nome quebrado), mas linhas que não casarem os padrões esperados caem na lista de "avisos" em vez de serem descartadas silenciosamente ou travarem a importação.
- Testar manualmente o cruzamento fim-a-fim: importar o PDF de exemplo, processar a Folha de Ponto de uma das empresas/empregados nele contidos (ex.: empresa `2`, empregado `9` LUIZ FELIPE LUCENA SILVA, férias `16/07/2026` a `30/07/2026`) com competência `07/2026`, e confirmar que os dias aparecem com badge "FÉRIAS" e não contam em faltante/faltas.
