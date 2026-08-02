# Processamento em Lote (Grupo) — Validação por Conteúdo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a validação por nome de arquivo em `processarLoteGrupo` (Controle de Frequência → Grupos de Empresas → Processar em Lote) por identificação de empresa e verificação de compatibilidade baseadas no conteúdo real da planilha.

**Architecture:** Nova função `_identificarEmpresaPorConteudo(wb, empregadosPorEmpresa, codigosGrupo)` calcula, para cada arquivo, a cobertura de correspondência de empregados por empresa do grupo (código da aba + prefixo do nome) e retorna a empresa candidata única ou um motivo de erro (não identificado / ambíguo). Nova função `_validarCompatibilidadeModelo(wb, comTerceiroTurno, diasEsperados)` confere cabeçalho de colunas e datas fora do período. `processarLoteGrupo` passa a: pré-carregar empregados de todas as empresas do grupo de uma vez, rodar identificação + compatibilidade por arquivo, detectar duplicidade (2+ arquivos → mesma empresa) e só então montar a fila de revisão, exatamente como hoje.

**Tech Stack:** HTML/JS vanilla, SheetJS (`xlsx`, já presente), Supabase JS client. Sem suite de testes automatizada neste projeto.

## Global Constraints

- Não alterar o fluxo single-empresa (`selecionarEmpresa`, `processarFolhaComSalvamento`) nem `baixarModelosGrupo`/`abrirExportacaoTxtGrupo` — mudança isolada a `processarLoteGrupo` e suas novas funções auxiliares.
- Manter a fila de revisão (`_filaLoteGrupo`, `_carregarProximaEmpresaFila`, `_avancarFilaLoteGrupo`, `_finalizarFilaLoteGrupo`, `_mostrarResumoLote`) e o snapshot/restore de `state` sem alteração de assinatura.
- `_parseExcelParaFolhas` continua igual — é chamada só depois que a empresa já foi identificada e validada.
- Cobertura mínima para identificar/validar empresa: **80%** dos empregados ativos dela (`_excluirContribuinte`) aparecem no arquivo.
- Validação via `node --check "Projeto RH/script.js"` após cada edição; verificação manual documentada (sem suite automatizada).
- Nome do arquivo original (`file.name`) só aparece em mensagens de erro para o operador localizar o arquivo — nunca usado para decisão de negócio.

---

## Task 1: Função de identificação de empresa por conteúdo

**Files:**
- Modify: `Projeto RH/script.js` (inserir logo antes de `let _filaLoteGrupo = null;`, atualmente linha 2570)

**Interfaces:**
- Produces: `_identificarEmpresaPorConteudo(wb, empregadosPorEmpresa)` → `{ codigo: string|null, motivo: 'ok'|'nao-identificado'|'ambiguo', candidatas: string[] }`. `empregadosPorEmpresa` é `{ [codigo_empresa]: Array<{codigo_empregado, nome_empregado}> }` (já filtrado por `_excluirContribuinte`). Consumida pela Task 3.

- [ ] **Step 1: Escrever a função**

```js
function _identificarEmpresaPorConteudo(wb, empregadosPorEmpresa) {
    const abas = wb.SheetNames.map(sheetName => {
        const cod = sheetName.split(' ')[0].trim();
        const resto = sheetName.slice(cod.length).trim().toLowerCase();
        return { cod, resto };
    });

    const cobertura = {};
    Object.keys(empregadosPorEmpresa).forEach(codigoEmpresa => {
        const empregados = empregadosPorEmpresa[codigoEmpresa] || [];
        if (empregados.length === 0) { cobertura[codigoEmpresa] = 0; return; }
        let correspondencias = 0;
        empregados.forEach(emp => {
            const nomeEmp = (emp.nome_empregado || '').trim().toLowerCase();
            const achou = abas.some(aba => {
                if (aba.cod !== emp.codigo_empregado) return false;
                if (!aba.resto) return true;
                return nomeEmp.startsWith(aba.resto) || aba.resto.startsWith(nomeEmp);
            });
            if (achou) correspondencias++;
        });
        cobertura[codigoEmpresa] = correspondencias / empregados.length;
    });

    const candidatas = Object.keys(cobertura).filter(codigo => cobertura[codigo] >= 0.8);

    if (candidatas.length === 0) return { codigo: null, motivo: 'nao-identificado', candidatas: [] };
    if (candidatas.length > 1) return { codigo: null, motivo: 'ambiguo', candidatas };
    return { codigo: candidatas[0], motivo: 'ok', candidatas };
}
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída (sucesso).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat(rh): identifica empresa do arquivo de lote pelo conteudo das abas"
```

---

## Task 2: Função de compatibilidade de modelo (colunas + datas)

**Files:**
- Modify: `Projeto RH/script.js` (logo após `_identificarEmpresaPorConteudo`, Task 1)

**Interfaces:**
- Consumes: nenhuma nova dependência além de `XLSX` (global, já usado no arquivo).
- Produces: `_validarCompatibilidadeModelo(wb, comTerceiroTurno, diasEsperados)` → `string|null` (mensagem de erro, ou `null` se compatível). `diasEsperados` é o array retornado por `gerarDiasDoMes(...)` (cada item tem `.data` no formato `dd/mm/aaaa`). Consumida pela Task 3.

- [ ] **Step 1: Escrever a função**

```js
function _validarCompatibilidadeModelo(wb, comTerceiroTurno, diasEsperados) {
    const headerEsperado = comTerceiroTurno
        ? ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2', 'Entrada 3', 'Saída 3']
        : ['Data', 'Dia da Semana', 'Entrada 1', 'Saída 1', 'Entrada 2', 'Saída 2'];
    const datasValidas = new Set(diasEsperados.map(d => d.data));

    for (const sheetName of wb.SheetNames) {
        const linhas = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        if (linhas.length === 0) continue;
        const header = (linhas[0] || []).map(v => String(v).trim());
        const headerBate = headerEsperado.every((col, i) => header[i] === col) && header.length <= headerEsperado.length + 1;
        if (!headerBate) {
            return `colunas não correspondem ao modelo esperado (3º turno ${comTerceiroTurno ? 'ativo' : 'inativo'}).`;
        }
        for (let r = 1; r < linhas.length; r++) {
            const dataStr = String(linhas[r][0] || '').trim();
            if (!dataStr) continue;
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) continue;
            if (!datasValidas.has(dataStr)) {
                return `contém datas fora do período de apuração da competência informada (ex: ${dataStr}).`;
            }
        }
    }
    return null;
}
```

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída (sucesso).

- [ ] **Step 3: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat(rh): valida cabecalho e datas do arquivo de lote contra o modelo esperado"
```

---

## Task 3: Reescrever `processarLoteGrupo` para usar identificação/validação por conteúdo

**Files:**
- Modify: `Projeto RH/script.js:2572-2672` (função `processarLoteGrupo`, conforme numeração atual antes desta task)

**Interfaces:**
- Consumes: `_identificarEmpresaPorConteudo` (Task 1), `_validarCompatibilidadeModelo` (Task 2), `_excluirContribuinte`, `_buscarConfigRubricas`, `_resolverPeriodoApuracao`, `gerarDiasDoMes`, `_parseExcelParaFolhas`, `carregarFeriasCalculadas` (já existentes, sem mudança de assinatura).
- Produces: mesmo comportamento externo de antes (`_filaLoteGrupo`, `_mostrarResumoLote`) — nenhuma outra função do arquivo precisa mudar.

- [ ] **Step 1: Substituir o corpo da função**

Localizar a função `processarLoteGrupo` atual (de `async function processarLoteGrupo(fileList) {` até o fechamento antes de `function _carregarProximaEmpresaFila() {`) e substituir por:

```js
async function processarLoteGrupo(fileList) {
    if (!_grupoAtual?.id) { mostrarMensagem('Aviso', 'Salve o grupo antes de processar em lote.'); return; }
    const comp = document.getElementById('grpCompetencia')?.value || '';
    if (!validarCompetencia(comp)) { mostrarMensagem('Aviso', 'Informe a competência antes de processar em lote.'); return; }
    const arquivos = Array.from(fileList || []);
    if (arquivos.length === 0) return;

    const codigosGrupo = _grupoAtual.empresas.map(e => e.codigo_empresa);
    const nomesEmpresas = {};
    _grupoAtual.empresas.forEach(e => { nomesEmpresas[e.codigo_empresa] = e.nome_empresa; });

    mostrarMensagem('Preparando', `Lendo ${arquivos.length} arquivo(s)...`);

    const { data: empregadosBrutos, error: errEmpGrupo } = await supabaseClient
        .from('rh_empregados')
        .select('codigo_empresa, codigo_empregado, nome_empregado, tipo_empregado, situacao')
        .in('codigo_empresa', codigosGrupo);
    if (errEmpGrupo) {
        fecharModalMensagem();
        mostrarMensagem('Erro', 'Falha ao buscar empregados do grupo: ' + errEmpGrupo.message);
        return;
    }
    const empregadosPorEmpresa = {};
    codigosGrupo.forEach(codigo => { empregadosPorEmpresa[codigo] = []; });
    _excluirContribuinte(empregadosBrutos || []).forEach(emp => {
        if (empregadosPorEmpresa[emp.codigo_empresa]) empregadosPorEmpresa[emp.codigo_empresa].push(emp);
    });

    const resultadosIniciais = [];
    const identificados = []; // { file, codigo }

    for (const file of arquivos) {
        try {
            const buffer = await file.arrayBuffer();
            const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
            const { codigo, motivo, candidatas } = _identificarEmpresaPorConteudo(wb, empregadosPorEmpresa);
            if (motivo === 'nao-identificado') {
                resultadosIniciais.push({ codigo: file.name, status: 'erro', detalhe: `Arquivo "${file.name}": não foi possível identificar a empresa pelo conteúdo (nenhuma empresa do grupo atingiu 80% de correspondência de empregados).` });
                continue;
            }
            if (motivo === 'ambiguo') {
                resultadosIniciais.push({ codigo: file.name, status: 'erro', detalhe: `Arquivo "${file.name}": conteúdo ambíguo — corresponde a mais de uma empresa do grupo (${candidatas.join(', ')}).` });
                continue;
            }
            identificados.push({ file, wb, codigo });
        } catch (erro) {
            console.error('Erro ao ler arquivo do lote', file.name, erro);
            resultadosIniciais.push({ codigo: file.name, status: 'erro', detalhe: `Arquivo "${file.name}": erro ao ler o arquivo (${erro.message}).` });
        }
    }

    const porEmpresa = {};
    identificados.forEach(item => {
        if (!porEmpresa[item.codigo]) porEmpresa[item.codigo] = [];
        porEmpresa[item.codigo].push(item);
    });

    const validos = [];
    Object.keys(porEmpresa).forEach(codigo => {
        const itens = porEmpresa[codigo];
        if (itens.length > 1) {
            itens.forEach(item => {
                resultadosIniciais.push({ codigo, status: 'erro', detalhe: `Arquivo "${item.file.name}": duplicidade — mais de um arquivo do lote corresponde à empresa ${codigo}. Nenhum foi processado; revise e reenvie.` });
            });
            return;
        }
        validos.push(itens[0]);
    });

    const itensFila = [];
    for (const { file, wb, codigo } of validos) {
        try {
            const cfg = await _buscarConfigRubricas(codigo);
            const comTerceiroTurno = cfg?.['terceiro_turno']?.cod === '1';
            const { diaInicio: diLote, diaFim: dfLote } = _resolverPeriodoApuracao(cfg);
            const diasEsperados = gerarDiasDoMes(comp, diLote, dfLote);

            const erroCompat = _validarCompatibilidadeModelo(wb, comTerceiroTurno, diasEsperados);
            if (erroCompat) {
                resultadosIniciais.push({ codigo, status: 'erro', detalhe: `Arquivo "${file.name}": ${erroCompat}` });
                continue;
            }

            const empregados = empregadosPorEmpresa[codigo] || [];
            const feriasCalculadas = await carregarFeriasCalculadas(codigo);
            const { folhas, avisosAbas } = _parseExcelParaFolhas(wb, empregados, comTerceiroTurno, comp, diLote, dfLote);

            if (folhas.length === 0) {
                resultadosIniciais.push({ codigo, status: 'erro', detalhe: 'Nenhum empregado correspondente encontrado no arquivo.' });
                continue;
            }

            itensFila.push({ codigo_empresa: codigo, nome_empresa: nomesEmpresas[codigo] || codigo, folhas, avisosAbas, cfg, feriasCalculadas });
        } catch (erro) {
            console.error('Erro ao preparar empresa do lote', codigo, erro);
            resultadosIniciais.push({ codigo, status: 'erro', detalhe: erro.message || 'Erro desconhecido.' });
        }
    }

    const codigosProcessados = new Set(itensFila.map(i => i.codigo_empresa));
    codigosGrupo.forEach(codigo => {
        if (!codigosProcessados.has(codigo) && !resultadosIniciais.some(r => r.codigo === codigo)) {
            resultadosIniciais.push({ codigo, status: 'sem-arquivo', detalhe: '—' });
        }
    });

    fecharModalMensagem();
    const inputArquivos = document.getElementById('grpArquivosLote');
    if (inputArquivos) inputArquivos.value = '';

    if (itensFila.length === 0) {
        _mostrarResumoLote(resultadosIniciais, codigo => nomesEmpresas[codigo] || codigo);
        return;
    }

    _filaLoteGrupo = {
        itens: itensFila,
        indice: 0,
        competencia: comp,
        resultados: [],
        resultadosIniciais,
        nomesEmpresas
    };
    _carregarProximaEmpresaFila();
}
```

Observação: esta substituição remove a extração por regex de nome (`Modelo_FolhaPonto_...`) e a checagem de competência pelo nome — a competência agora só é usada para gerar `diasEsperados` e passar para `_parseExcelParaFolhas`, igual ao resto do fluxo.

- [ ] **Step 2: Validar sintaxe**

Run: `node --check "Projeto RH/script.js"`
Expected: sem saída (sucesso).

- [ ] **Step 3: Verificação manual (documentar, sem suite automatizada)**

No navegador, na tela "Grupos de Empresas" de um grupo salvo com pelo menos 2 empresas:
1. Gerar modelos do grupo (`Baixar Modelos`), preencher horários em pelo menos 2 arquivos de empresas diferentes.
2. Renomear um dos arquivos para um nome qualquer (ex: `teste123.xlsx`) — confirmar que ainda é aceito e processado corretamente (prova que o nome não importa mais).
3. Subir um arquivo de uma empresa com menos de 80% dos empregados preenchidos (apagar a maioria das abas) — confirmar erro "não foi possível identificar".
4. Duplicar o mesmo arquivo de uma empresa (2x no lote) — confirmar erro de duplicidade nos dois.
5. Editar manualmente uma célula de data para um valor fora do mês da competência — confirmar erro de "datas fora do período".
6. Confirmar que o fluxo feliz (arquivos corretos, sem duplicidade) ainda cai na fila de revisão e processa normalmente, igual ao comportamento anterior.

- [ ] **Step 4: Commit**

```bash
git add "Projeto RH/script.js"
git commit -m "feat(rh): processamento em lote do grupo valida arquivos pelo conteudo, nao pelo nome"
```

---

## Task 4: Atualizar a spec de grupos em lote (documentação)

**Files:**
- Modify: `Projeto RH/docs/superpowers/specs/2026-07-08-grupos-empresas-lote-design.md`

**Interfaces:** nenhuma (só documentação).

- [ ] **Step 1: Atualizar a seção "Validação por arquivo (antes de processar)"**

Na seção `## Ação 3: Processar em Lote`, substituir o bloco `### Validação por arquivo (antes de processar)` (que descreve o regex de nome) por uma nota apontando para a spec nova:

```markdown
### Validação por arquivo (antes de processar)

**Superada pela spec [`2026-08-02-lote-grupo-validacao-conteudo-design.md`](2026-08-02-lote-grupo-validacao-conteudo-design.md):** a identificação da empresa e a validação de compatibilidade passaram a ser feitas pelo conteúdo da planilha (código+nome do empregado nas abas, cabeçalho de colunas, datas dentro do período), não mais pelo nome do arquivo.
```

- [ ] **Step 2: Commit**

```bash
git add "Projeto RH/docs/superpowers/specs/2026-07-08-grupos-empresas-lote-design.md"
git commit -m "docs(rh): aponta spec de lote do grupo para validacao por conteudo"
```
