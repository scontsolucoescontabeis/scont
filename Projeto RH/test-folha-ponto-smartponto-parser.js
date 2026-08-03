const assert = require('node:assert');
const {
    _linhasComItens,
    _pareceSmartPonto,
    _extrairCabecalhoColaboradorSmart,
    _extrairCompetenciaSmart,
    _acharBoundaryXSmart,
    _acharJornadaAnchorsSmart,
    _pertenceJornadaSmart,
    _parsearLinhaDiaSmart,
    _extrairDiasPontosSmart,
    _gerarDiasDoMesSmart,
    _mesclarDiasSmart,
    _normalizarNomeSmart,
    _melhorMatchEmpregadoSmart,
    _parsearPaginaColaboradorSmart
} = require('./folha-ponto-smartponto-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// Helper: converte { str, x, y } em item no formato do PDF.js (transform[4]=x, transform[5]=y)
function item(str, x, y) {
    return { str, transform: [1, 0, 0, 1, x, y] };
}

// Coordenadas abaixo foram extraídas de verdade do arquivo real
// CartaoPonto_2026-08-03_10-53.pdf (página 1, colaborador ALINE GOMES DE LIMA),
// via pdfjs-dist, para que os testes reflitam o layout real e não uma suposição.

// ===== _linhasComItens =====

teste('_linhasComItens agrupa por Y e ordena por X, mantendo item e posição', () => {
    const items = [
        item('CPF:', 407.6, 517.3),
        item('ALINE GOMES DE LIMA', 81.0, 517.3),
        item('FUNCIONÁRIO:', 23.2, 517.3),
        item('Admissão:', 0, 500) // linha diferente
    ];
    const linhas = _linhasComItens(items);
    assert.strictEqual(linhas.length, 2);
    assert.deepStrictEqual(linhas[0].map(i => i.str), ['FUNCIONÁRIO:', 'ALINE GOMES DE LIMA', 'CPF:']);
});

teste('_linhasComItens ignora itens vazios/em branco', () => {
    const items = [item('Nome:', 0, 700), item('   ', 40, 700), item('', 50, 700)];
    const linhas = _linhasComItens(items);
    assert.strictEqual(linhas.length, 1);
    assert.deepStrictEqual(linhas[0].map(i => i.str), ['Nome:']);
});

teste('_linhasComItens retorna array vazio para lista vazia', () => {
    assert.deepStrictEqual(_linhasComItens([]), []);
    assert.deepStrictEqual(_linhasComItens(null), []);
});

// ===== _pareceSmartPonto =====

teste('_pareceSmartPonto reconhece texto com os três marcadores', () => {
    const texto = 'CARTÃO DE PONTO\nJORNADAS REALIZADAS\nHORÁRIOS PREVISTOS';
    assert.strictEqual(_pareceSmartPonto(texto), true);
});

teste('_pareceSmartPonto rejeita texto sem os marcadores', () => {
    assert.strictEqual(_pareceSmartPonto('qualquer outro documento'), false);
    assert.strictEqual(_pareceSmartPonto(''), false);
    assert.strictEqual(_pareceSmartPonto(null), false);
});

// ===== _extrairCabecalhoColaboradorSmart =====

const TEXTO_CABECALHO =
    'CARTÃO DE PONTO PERÍODO: 01/07/2026 A 31/07/2026 DDSR DSR FALTA TOTAL HORAS DIURNO NOTURNO TOTAL\n' +
    'EMPRESA: SORVETES SORVELAK LTDA CNPJ/CPF: 14.201.189/0001-95 HORA TRABALHADA 169:45 000:00 169:45\n' +
    'ENDEREÇO: QUADRA QUADRA 804 CONJUNTO 03 LOTE, 08 - CIDADE: BRASILIA UF: DF\n' +
    'FUNCIONÁRIO: ALINE GOMES DE LIMA ADMISSÃO: 10/11/2025 CPF: 067.523.541-38\n' +
    'CARGO: AUXILIAR DE SERVIÇOS GERAIS SETOR: MATRICULA: 8\n' +
    'DEPART.: CENTRO CUSTO: CRACHÁ: 8';

teste('_extrairCabecalhoColaboradorSmart extrai nome, cpf, admissão e função', () => {
    const cab = _extrairCabecalhoColaboradorSmart(TEXTO_CABECALHO);
    assert.strictEqual(cab.nome, 'ALINE GOMES DE LIMA');
    assert.strictEqual(cab.cpf, '067.523.541-38');
    assert.strictEqual(cab.admissao, '10/11/2025');
    assert.strictEqual(cab.funcao, 'AUXILIAR DE SERVIÇOS GERAIS');
});

teste('_extrairCabecalhoColaboradorSmart não confunde CPF do colaborador com CNPJ/CPF da empresa', () => {
    const cab = _extrairCabecalhoColaboradorSmart(TEXTO_CABECALHO);
    assert.notStrictEqual(cab.cpf, '14.201.189/0001-95');
});

teste('_extrairCabecalhoColaboradorSmart retorna campos vazios quando a seção não existe', () => {
    const cab = _extrairCabecalhoColaboradorSmart('texto qualquer sem os rótulos esperados');
    assert.deepStrictEqual(cab, { nome: '', cpf: '', admissao: '', funcao: '', codigo: '' });
});

// ===== _extrairCompetenciaSmart =====

teste('_extrairCompetenciaSmart lê o período do cabeçalho e usa o mês/ano final', () => {
    assert.strictEqual(_extrairCompetenciaSmart(TEXTO_CABECALHO), '07/2026');
});

teste('_extrairCompetenciaSmart retorna null quando o período não aparece no texto', () => {
    assert.strictEqual(_extrairCompetenciaSmart('texto sem período'), null);
});

// ===== _acharBoundaryXSmart / _acharJornadaAnchorsSmart =====

// Linha de cabeçalho de grupo (Y=470.8) e sub-cabeçalho de colunas (Y=456.6),
// coordenadas reais do PDF.
const LINHA_GRUPO = [
    item('JORNADAS REALIZADAS', 135.7, 470.8),
    item('NORMAL', 298.9, 470.8),
    item('EXTRA', 357.7, 470.8),
    item('HORÁRIOS PREVISTOS', 674.7, 470.8)
];
const LINHA_SUBCOLUNAS = [
    item('ENT.', 77.6, 456.6), item('SAÍ.', 98.6, 456.6),
    item('ENT.', 117.3, 456.6), item('SAÍ.', 139.1, 456.6),
    item('ENT.', 157.8, 456.6), item('SAÍ.', 179.6, 456.6),
    item('ENT.', 198.3, 456.6), item('SAÍ.', 220.1, 456.6),
    item('ENT.', 238.8, 456.6), item('SAÍ.', 261.3, 456.6),
    item('DIU.', 285.4, 456.6), item('NOT.', 305.6, 456.6), item('FALT.', 325.1, 456.6),
    item('DIU.', 351.4, 456.6), item('NOT.', 371.6, 456.6),
    item('ENT.', 614.6, 456.6), item('SAÍ.', 636.3, 456.6)
];

teste('_acharBoundaryXSmart encontra o X do rótulo "NORMAL"', () => {
    const linhas = _linhasComItens([...LINHA_GRUPO]);
    assert.strictEqual(_acharBoundaryXSmart(linhas), 298.9);
});

teste('_acharBoundaryXSmart retorna null quando "NORMAL" não aparece em nenhuma linha', () => {
    assert.strictEqual(_acharBoundaryXSmart([[{ str: 'X', x: 1 }]]), null);
});

teste('_acharJornadaAnchorsSmart pega só os ENT./SAÍ. à esquerda do boundary (5 pares)', () => {
    const linhas = _linhasComItens([...LINHA_SUBCOLUNAS]);
    const anchors = _acharJornadaAnchorsSmart(linhas, 298.9);
    assert.strictEqual(anchors.length, 10);
    assert.ok(!anchors.includes(614.6), 'não deve incluir o ENT. de Horários Previstos');
});

// ===== _pertenceJornadaSmart =====

const ANCHORS = [77.6, 98.6, 117.3, 139.1, 157.8, 179.6, 198.3, 220.1, 238.8, 261.3];
const BOUNDARY = 298.9;

teste('_pertenceJornadaSmart aceita valor real de batida (perto de uma âncora de Jornada)', () => {
    assert.strictEqual(_pertenceJornadaSmart(76.5, ANCHORS, BOUNDARY), true); // 13:17 real
});

teste('_pertenceJornadaSmart rejeita valor de total NORMAL mesmo estando fisicamente perto (284.2 vs boundary 298.9)', () => {
    // Caso real: "04:37" (NORMAL DIU) renderiza em x=284.2, mais perto do boundary
    // (dist 14.7) que da última âncora de Jornada SAÍ.5=261.3 (dist 22.9) — deve
    // ser classificado como fora da zona de Jornadas Realizadas.
    assert.strictEqual(_pertenceJornadaSmart(284.2, ANCHORS, BOUNDARY), false);
});

teste('_pertenceJornadaSmart rejeita valor de Horários Previstos (bem à direita)', () => {
    assert.strictEqual(_pertenceJornadaSmart(614.3, ANCHORS, BOUNDARY), false);
});

teste('_pertenceJornadaSmart retorna false quando boundary é null (coluna não calibrada)', () => {
    assert.strictEqual(_pertenceJornadaSmart(76.5, ANCHORS, null), false);
});

// ===== _parsearLinhaDiaSmart =====
// Todas as coordenadas abaixo são reais, extraídas da página 1 do PDF de exemplo.

teste('_parsearLinhaDiaSmart extrai 1 período trabalhado, ignorando NORMAL e Horários Previstos', () => {
    // 01/07/2026 Qua 13:17 17:54 [04:37 04:11 = NORMAL DIU/FALT] [08:00 12:00 13:00 17:48 = previstos]
    const linha = _linhasComItens([
        item('01/07/2026', 20.8, 443.8), item('Qua', 57.8, 443.8),
        item('13:17', 76.5, 443.8), item('17:54', 96.6, 443.8),
        item('04:37', 284.2, 443.8), item('04:11', 326.2, 443.8),
        item('08:00', 614.3, 443.8), item('12:00', 634.4, 443.8), item('13:00', 654.6, 443.8), item('17:48', 674.8, 443.8)
    ])[0];
    const dia = _parsearLinhaDiaSmart(linha, ANCHORS, BOUNDARY);
    assert.strictEqual(dia.data, '01/07/2026');
    assert.strictEqual(dia.entrada1, '13:17');
    assert.strictEqual(dia.saida1, '17:54');
    assert.strictEqual(dia.entrada2, undefined);
    assert.strictEqual(dia.ocorrencia, '');
});

teste('_parsearLinhaDiaSmart extrai 2 períodos trabalhados + EXTRA/LIMITE ignorados', () => {
    // 08/07/2026 Qua 07:57 12:04 13:02 18:00 [08:48 EXTRA 00:17 LIMITE1 50 00:17] [previstos]
    const linha = _linhasComItens([
        item('08/07/2026', 20.8, 359.8), item('Qua', 57.8, 359.8),
        item('07:57', 76.5, 359.8), item('12:04', 96.6, 359.8),
        item('13:02', 116.8, 359.8), item('18:00', 137.1, 359.8),
        item('08:48', 284.2, 359.8),
        item('00:17', 350.9, 359.8), item('50', 396.4, 359.8), item('00:17', 410.2, 359.8),
        item('08:00', 614.3, 359.8), item('12:00', 634.4, 359.8), item('13:00', 654.6, 359.8), item('17:48', 674.8, 359.8)
    ])[0];
    const dia = _parsearLinhaDiaSmart(linha, ANCHORS, BOUNDARY);
    assert.strictEqual(dia.entrada1, '07:57');
    assert.strictEqual(dia.saida1, '12:04');
    assert.strictEqual(dia.entrada2, '13:02');
    assert.strictEqual(dia.saida2, '18:00');
    assert.strictEqual(dia.entrada3, undefined);
    assert.strictEqual(dia.ocorrencia, '');
});

teste('_parsearLinhaDiaSmart reconhece FALTA (renderizada na zona de Jornadas Realizadas) e ignora os Horários Previstos', () => {
    // 13/07/2026 Seg FALTA [08:00 12:00 13:00 17:48 = previstos]
    const linha = _linhasComItens([
        item('13/07/2026', 20.8, 299.9), item('Seg', 58.2, 299.9),
        item('FALTA', 76.5, 299.9),
        item('08:00', 614.3, 299.9), item('12:00', 634.4, 299.9), item('13:00', 654.6, 299.9), item('17:48', 674.8, 299.9)
    ])[0];
    const dia = _parsearLinhaDiaSmart(linha, ANCHORS, BOUNDARY);
    assert.strictEqual(dia.ocorrencia, 'FALTA');
    assert.strictEqual(dia.entrada1, undefined);
});

teste('_parsearLinhaDiaSmart reconhece FOLGA (renderizada na zona de Horários Previstos) como dia em branco', () => {
    // 04/07/2026 Sáb FOLGA  (token único, na posição x=614.3 — zona de Previstos)
    const linha = _linhasComItens([
        item('04/07/2026', 20.8, 407.8), item('Sáb', 58.2, 407.8),
        item('FOLGA', 614.3, 407.8)
    ])[0];
    const dia = _parsearLinhaDiaSmart(linha, ANCHORS, BOUNDARY);
    assert.strictEqual(dia.ocorrencia, '', 'FOLGA não deve virar Ocorrência');
    assert.strictEqual(dia.entrada1, undefined);
});

teste('_parsearLinhaDiaSmart mesmo assim não gera Ocorrência "FOLGA" caso ela caia na zona de Jornadas (defensivo)', () => {
    const linha = _linhasComItens([
        item('04/07/2026', 20.8, 407.8), item('Sáb', 58.2, 407.8),
        item('FOLGA', 76.5, 407.8) // hipotético: FOLGA na zona de Jornada
    ])[0];
    const dia = _parsearLinhaDiaSmart(linha, ANCHORS, BOUNDARY);
    assert.strictEqual(dia.ocorrencia, '');
});

teste('_parsearLinhaDiaSmart retorna null para linha que não começa com data', () => {
    const linha = _linhasComItens([item('Total:', 0, 0), item('166:03', 50, 0)])[0];
    assert.strictEqual(_parsearLinhaDiaSmart(linha, ANCHORS, BOUNDARY), null);
});

// ===== _extrairDiasPontosSmart =====

teste('_extrairDiasPontosSmart processa várias linhas de dia e ignora linhas que não são dias', () => {
    const items = [
        item('01/07/2026', 20.8, 443.8), item('Qua', 57.8, 443.8), item('13:17', 76.5, 443.8), item('17:54', 96.6, 443.8),
        item('04/07/2026', 20.8, 407.8), item('Sáb', 58.2, 407.8), item('FOLGA', 614.3, 407.8),
        item('BRASILIA', 100.6, 59.9)
    ];
    const linhas = _linhasComItens(items);
    const dias = _extrairDiasPontosSmart(linhas, ANCHORS, BOUNDARY);
    assert.strictEqual(dias.length, 2);
    assert.strictEqual(dias[0].entrada1, '13:17');
    assert.strictEqual(dias[1].ocorrencia, '');
});

// ===== _gerarDiasDoMesSmart =====

teste('_gerarDiasDoMesSmart gera todos os dias do mês com dia da semana abreviado', () => {
    const dias = _gerarDiasDoMesSmart('07/2026');
    assert.strictEqual(dias.length, 31);
    assert.strictEqual(dias[0].data, '01/07/2026');
    assert.strictEqual(dias[0].diaSemana, 'Qua');
    assert.strictEqual(dias[0].entrada1, '');
    assert.strictEqual(dias[0].ocorrencia, '');
});

teste('_gerarDiasDoMesSmart retorna vazio sem competência', () => {
    assert.deepStrictEqual(_gerarDiasDoMesSmart(''), []);
});

// ===== _mesclarDiasSmart =====

teste('_mesclarDiasSmart preenche os dias do esqueleto com os dados extraídos (períodos dinâmicos)', () => {
    const base = _gerarDiasDoMesSmart('07/2026');
    const extraidos = [
        { data: '01/07/2026', entrada1: '13:17', saida1: '17:54', ocorrencia: '' },
        { data: '13/07/2026', ocorrencia: 'FALTA' }
    ];
    const mesclado = _mesclarDiasSmart(base, extraidos);
    assert.strictEqual(mesclado.length, 31);
    assert.strictEqual(mesclado[0].entrada1, '13:17');
    assert.strictEqual(mesclado[0].diaSemana, 'Qua');
    assert.strictEqual(mesclado[12].ocorrencia, 'FALTA');
    assert.strictEqual(mesclado[1].entrada1, '', 'dia 02/07 sem dado extraído deve continuar em branco');
});

// ===== _normalizarNomeSmart / _melhorMatchEmpregadoSmart =====

teste('_normalizarNomeSmart remove acentos, baixa a caixa e colapsa espaços', () => {
    assert.strictEqual(_normalizarNomeSmart('  Aline  Gomes De Lima '), 'aline gomes de lima');
});

teste('_melhorMatchEmpregadoSmart encontra correspondência exata ignorando acento/caixa', () => {
    const empregados = [
        { codigo_empregado: '1', nome_empregado: 'Aline Gomes de Lima' },
        { codigo_empregado: '2', nome_empregado: 'Aluisio de Sousa Teixeira' }
    ];
    const match = _melhorMatchEmpregadoSmart('ALINE GOMES DE LIMA', empregados);
    assert.strictEqual(match.codigo_empregado, '1');
});

teste('_melhorMatchEmpregadoSmart retorna null quando não há nenhuma correspondência razoável', () => {
    const empregados = [{ codigo_empregado: '1', nome_empregado: 'Fulano de Tal' }];
    assert.strictEqual(_melhorMatchEmpregadoSmart('CICRANO OUTRO NOME', empregados), null);
});

// ===== _parsearPaginaColaboradorSmart (integração, coordenadas reais da página 1) =====

teste('_parsearPaginaColaboradorSmart monta o registro completo a partir dos itens reais da página 1', () => {
    const items = [
        item('CARTÃO DE PONTO', 23.2, 561.6), item('PERÍODO:', 354.0, 561.6),
        item('01/07/2026', 395.3, 561.6), item('A', 433.5, 561.6), item('31/07/2026', 442.5, 561.6),
        item('FUNCIONÁRIO:', 23.2, 517.3), item('ALINE GOMES DE LIMA', 81.0, 517.3),
        item('ADMISSÃO:', 241.1, 517.3), item('10/11/2025', 285.0, 517.3),
        item('CPF:', 407.6, 517.3), item('067.523.541-38', 429.0, 517.3),
        item('CARGO:', 23.2, 503.8), item('AUXILIAR DE SERVIÇOS GERAIS', 81.0, 503.8), item('SETOR:', 253.9, 503.8),
        item('JORNADAS REALIZADAS', 135.7, 470.8), item('NORMAL', 298.9, 470.8),
        ...LINHA_SUBCOLUNAS.map(({ str, transform }) => item(str, transform[4], 456.6)),
        item('01/07/2026', 20.8, 443.8), item('Qua', 57.8, 443.8),
        item('13:17', 76.5, 443.8), item('17:54', 96.6, 443.8),
        item('04:37', 284.2, 443.8), item('04:11', 326.2, 443.8),
        item('08:00', 614.3, 443.8), item('12:00', 634.4, 443.8), item('13:00', 654.6, 443.8), item('17:48', 674.8, 443.8),
        item('04/07/2026', 20.8, 407.8), item('Sáb', 58.2, 407.8), item('FOLGA', 614.3, 407.8),
        item('13/07/2026', 20.8, 299.9), item('Seg', 58.2, 299.9), item('FALTA', 76.5, 299.9),
        item('08:00', 614.3, 299.9), item('12:00', 634.4, 299.9), item('13:00', 654.6, 299.9), item('17:48', 674.8, 299.9)
    ];

    const colaborador = _parsearPaginaColaboradorSmart(items, 2026);
    assert.strictEqual(colaborador.nome, 'ALINE GOMES DE LIMA');
    assert.strictEqual(colaborador.cpf, '067.523.541-38');
    assert.strictEqual(colaborador.admissao, '10/11/2025');
    assert.strictEqual(colaborador.funcao, 'AUXILIAR DE SERVIÇOS GERAIS');
    assert.strictEqual(colaborador.competencia, '07/2026');
    assert.strictEqual(colaborador.dias.length, 31);

    const dia1 = colaborador.dias.find(d => d.data === '01/07/2026');
    assert.strictEqual(dia1.entrada1, '13:17');
    assert.strictEqual(dia1.saida1, '17:54');
    assert.strictEqual(dia1.ocorrencia, '');

    const dia4 = colaborador.dias.find(d => d.data === '04/07/2026');
    assert.strictEqual(dia4.ocorrencia, '', 'FOLGA deve ficar em branco');
    assert.strictEqual(dia4.entrada1, '');

    const dia13 = colaborador.dias.find(d => d.data === '13/07/2026');
    assert.strictEqual(dia13.ocorrencia, 'FALTA');
    assert.strictEqual(dia13.entrada1, '');
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
