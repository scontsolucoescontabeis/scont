const assert = require('node:assert');
const { _reconstruirLinhasPagina, _dataBRparaISO, _parsearLinhasFerias } = require('./ferias-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// ===== _dataBRparaISO =====

teste('_dataBRparaISO converte DD/MM/AAAA para AAAA-MM-DD', () => {
    assert.strictEqual(_dataBRparaISO('16/07/2026'), '2026-07-16');
});

// ===== _reconstruirLinhasPagina =====

teste('_reconstruirLinhasPagina agrupa itens de mesmo y exato em uma linha, ordenados por x', () => {
    const items = [
        { str: 'SILVA', transform: [1, 0, 0, 1, 29.2, 718.4] },
        { str: '9', transform: [1, 0, 0, 1, 23.6, 718.4] },
        { str: '25/04/2025', transform: [1, 0, 0, 1, 167.0, 718.4] }
    ];
    const linhas = _reconstruirLinhasPagina(items);
    assert.deepStrictEqual(linhas, ['9 SILVA 25/04/2025']);
});

teste('_reconstruirLinhasPagina mantém separadas linhas cujo y difere mais que o limiar (rótulo/valor desalinhados)', () => {
    // Caso real do PDF: "Empresa:"/valor (y=833.2) vs "Página:"/valor (y=834.7) — 1.5pt de diferença.
    const items = [
        { str: 'Empresa:', transform: [1, 0, 0, 1, 0.7, 833.2] },
        { str: '2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA', transform: [1, 0, 0, 1, 38.2, 833.2] },
        { str: 'Página:', transform: [1, 0, 0, 1, 501.7, 834.7] },
        { str: '1/1', transform: [1, 0, 0, 1, 562.6, 834.7] }
    ];
    const linhas = _reconstruirLinhasPagina(items);
    assert.deepStrictEqual(linhas, [
        'Página: 1/1',
        'Empresa: 2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA'
    ]);
});

teste('_reconstruirLinhasPagina ignora itens com str vazio', () => {
    const items = [
        { str: '', transform: [1, 0, 0, 1, 0, 100] },
        { str: 'Total da empresa:', transform: [1, 0, 0, 1, 29.2, 100] }
    ];
    assert.deepStrictEqual(_reconstruirLinhasPagina(items), ['Total da empresa:']);
});

// ===== _parsearLinhasFerias =====

teste('_parsearLinhasFerias extrai um registro simples (2 datas, sem abono) — página 1 real do PDF de exemplo', () => {
    const linhas = [
        'Empresa: 2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA',
        'CNPJ: 10.912.505/0001-86',
        'Código Nome do empregado Aquisitivo Ferias Abono Vlor.Ferias Abo.Pecun. 1/3 Fer./Abono 13o.Adiant Outros Prov. Total Prov.',
        'Início Início Início Desc.Prev. Desc. IRRF Outros Desc. Líq. Férias',
        'Fim Fim Fim',
        '9 LUIZ FELIPE LUCENA SILVA 25/04/2025 16/07/2026 784,35 0,00 261,45 0,00 0,00 1.045,80',
        '24/04/2026 30/07/2026 78,43 0,00 0,00 967,37',
        'Total da empresa: 784,35 0,00 261,45 0,00 0,00 1.045,80',
        '78,43 0,00 0,00 967,37',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.deepStrictEqual(avisos, []);
    assert.deepStrictEqual(registros, [{
        codigo_empresa: '2',
        nome_empresa: 'CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA',
        codigo_empregado: '9',
        nome_empregado: 'LUIZ FELIPE LUCENA SILVA',
        ferias_inicio: '2026-07-16',
        ferias_fim: '2026-07-30'
    }]);
});

teste('_parsearLinhasFerias extrai múltiplos empregados, com e sem Abono (3 datas) — página 8 real do PDF de exemplo', () => {
    const linhas = [
        'Empresa: 63 - AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        'CNPJ: 51.149.684/0001-29',
        'Código Nome do empregado Aquisitivo Ferias Abono Vlor.Ferias Abo.Pecun. 1/3 Fer./Abono 13o.Adiant Outros Prov. Total Prov.',
        'Início Início Início Desc.Prev. Desc. IRRF Outros Desc. Líq. Férias',
        'Fim Fim Fim',
        '8 LETICIA DA SILVA CARVALHO 23/05/2025 08/07/2026 1.402,43 0,00 467,48 0,00 0,00 1.869,91',
        '22/05/2026 27/07/2026 0,00 143,97 0,00 1.725,94',
        '22 GABRIEL WILLIAN DE SOUZA ALVES 01/04/2025 11/06/2026 01/07/2026 1.427,28 690,64 705,97 0,00 0,00 2.823,89',
        '31/03/2026 30/06/2026 10/07/2026 146,95 0,00 402,37 2.274,57',
        '24 NATALIA CONCEICAO SILVA 14/06/2025 14/07/2026 03/08/2026 1.246,28 623,15 623,15 0,00 0,00 2.492,58',
        '13/06/2026 02/08/2026 12/08/2026 125,23 0,00 448,96 1.918,39',
        'Total da empresa: 4.075,99 1.313,79 1.796,60 0,00 0,00 7.186,38',
        '416,15 0,00 851,33 5.918,90',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 3);
    assert.deepStrictEqual(registros[0], {
        codigo_empresa: '63',
        nome_empresa: 'AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        codigo_empregado: '8',
        nome_empregado: 'LETICIA DA SILVA CARVALHO',
        ferias_inicio: '2026-07-08',
        ferias_fim: '2026-07-27'
    });
    assert.deepStrictEqual(registros[1], {
        codigo_empresa: '63',
        nome_empresa: 'AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        codigo_empregado: '22',
        nome_empregado: 'GABRIEL WILLIAN DE SOUZA ALVES',
        ferias_inicio: '2026-06-11',
        ferias_fim: '2026-06-30'
    });
    assert.deepStrictEqual(registros[2], {
        codigo_empresa: '63',
        nome_empresa: 'AGUAS CLARAS COMERCIO DE SORVETES LTDA',
        codigo_empregado: '24',
        nome_empregado: 'NATALIA CONCEICAO SILVA',
        ferias_inicio: '2026-07-14',
        ferias_fim: '2026-08-02'
    });
});

teste('_parsearLinhasFerias reporta aviso quando a linha de fim não aparece antes do próximo registro', () => {
    const linhas = [
        'Empresa: 5 - EMPRESA TESTE LTDA',
        '10 FULANO DE TAL 01/01/2025 01/07/2026 100,00 0,00 33,00 0,00 0,00 133,00',
        '11 CICLANO DA SILVA 01/01/2025 01/08/2026 100,00 0,00 33,00 0,00 0,00 133,00',
        '31/12/2025 15/08/2026 10,00 0,00 0,00 123,00'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.strictEqual(registros.length, 1);
    assert.strictEqual(registros[0].codigo_empregado, '11');
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /Linha de fim não encontrada/);
});

teste('_parsearLinhasFerias reporta aviso quando não há empresa aberta para o registro', () => {
    const linhas = [
        '10 FULANO DE TAL 01/01/2025 01/07/2026 100,00 0,00 33,00 0,00 0,00 133,00',
        '31/12/2025 15/07/2026 10,00 0,00 0,00 123,00'
    ];
    const { registros, avisos } = _parsearLinhasFerias(linhas);
    assert.strictEqual(registros.length, 0);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /antes de qualquer cabeçalho de empresa/);
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
