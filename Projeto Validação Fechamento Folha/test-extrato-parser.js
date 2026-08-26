const assert = require('node:assert');
const { _reconstruirLinhasPagina, _parseNumeroBR, _extrairRubricasDaLinha, parseExtratoMensal } = require('./extrato-parser.js');
const { ordenarCompetencias, compararCompetencias, _deltaPercentual } = require('./extrato-comparador.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// ===== _reconstruirLinhasPagina =====

teste('_reconstruirLinhasPagina agrupa itens fora de ordem (linha do cabeçalho Empr./Situação/CPF/Adm real)', () => {
    const items = [
        { str: 'Adm:', transform: [1, 0, 0, 1, 463.3, 739.3] },
        { str: '12/05/2025', transform: [1, 0, 0, 1, 526.5, 739.3] },
        { str: '550.456.468-93', transform: [1, 0, 0, 1, 366.8, 739.3] },
        { str: 'Trabalhando', transform: [1, 0, 0, 1, 236.8, 739.3] },
        { str: 'CPF:', transform: [1, 0, 0, 1, 349.7, 739.3] },
        { str: 'Situação:', transform: [1, 0, 0, 1, 205.3, 739.3] },
        { str: 'Empr.:', transform: [1, 0, 0, 1, 0, 739.3] },
        { str: '32 ANDERSON RICARDO TAVARES MAROQUE', transform: [1, 0, 0, 1, 54.7, 739.3] }
    ];
    assert.deepStrictEqual(
        _reconstruirLinhasPagina(items),
        ['Empr.: 32 ANDERSON RICARDO TAVARES MAROQUE Situação: Trabalhando CPF: 550.456.468-93 Adm: 12/05/2025']
    );
});

// ===== _parseNumeroBR =====

teste('_parseNumeroBR converte formato brasileiro com milhar', () => {
    assert.strictEqual(_parseNumeroBR('2.398,00'), 2398);
    assert.strictEqual(_parseNumeroBR('43.599,52'), 43599.52);
});

teste('_parseNumeroBR aceita negativo (Base IRRF pode ficar negativa)', () => {
    assert.strictEqual(_parseNumeroBR('-487,55'), -487.55);
});

// ===== _extrairRubricasDaLinha (linhas reais reconstruídas via pdf.js) =====

teste('_extrairRubricasDaLinha separa as duas colunas (proventos e descontos) de uma linha real', () => {
    const rubricas = _extrairRubricasDaLinha('8781 DIAS NORMAIS 31,00 2.398,00 P 998 I.N.S.S. 7,99 191,50 D');
    assert.deepStrictEqual(rubricas, [
        { codigo: '8781', descricao: 'DIAS NORMAIS', referencia: '31,00', valor: 2398, tipo: 'P' },
        { codigo: '998', descricao: 'I.N.S.S.', referencia: '7,99', valor: 191.5, tipo: 'D' }
    ]);
});

teste('_extrairRubricasDaLinha não se confunde com número de contrato de empréstimo longo dentro da descrição', () => {
    const rubricas = _extrairRubricasDaLinha('9751 DESC EMP CRED TRAB FE Nº 190300014287744 763,24 763,24 D');
    assert.strictEqual(rubricas.length, 1);
    assert.strictEqual(rubricas[0].descricao, 'DESC EMP CRED TRAB FE Nº 190300014287744');
    assert.strictEqual(rubricas[0].valor, 763.24);
});

teste('_extrairRubricasDaLinha trata referência em formato hora (hh:mm) e percentual na descrição', () => {
    const rubricas = _extrairRubricasDaLinha('147 HORAS EXTRAS 65% 14:17 385,56 P');
    assert.deepStrictEqual(rubricas, [
        { codigo: '147', descricao: 'HORAS EXTRAS 65%', referencia: '14:17', valor: 385.56, tipo: 'P' }
    ]);
});

// ===== parseExtratoMensal (linhas reais reconstruídas via pdf.js, páginas 1-2 e 8-9 da amostra) =====

const LINHAS_PAGINA_1 = [
    'Empresa: 453 - QUADRANTE ETIQUETAS INDUSTRIA E COMERCIO Página: 1/11',
    'CNPJ: 24.862.830/0001-96 Emissão: 26/08/2026',
    'Cálculo: Folha Mensal Horas: 19:50:19',
    'Competência: 07/2026',
    'EXTRATO MENSAL',
    'Empr.: 32 ANDERSON RICARDO TAVARES MAROQUE Situação: Trabalhando CPF: 550.456.468-93 Adm: 12/05/2025',
    'Vínculo: Celetista CC: 1 Depto: 1 Horas Mês: 220,00',
    'Cargo: 59 ASSISTENTE DE PRE IMPRESSAO JR C.B.O: 766205 Filial: 1 Salário: 2.398,00',
    '8781 DIAS NORMAIS 31,00 2.398,00 P 998 I.N.S.S. 7,99 191,50 D',
    '1012 VALE TRANSPORTE CREDITO 233,20 233,20 P 981 DESC.ADIANT.SALARIAL 959,20 959,20 D',
    'Informativa: Informativa Dedutora:',
    'ND: 0 Proventos: 2.631,20 Descontos: 1.150,70 191,84 0 Líquido: 1.480,50',
    'NF: 0 Base INSS: 2.398,00 Excedente INSS: 0,00 Base FGTS: 2.398,00 Valor FGTS: 191,84 Base IRRF: 1.438,80',
    'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
];

teste('parseExtratoMensal monta um empregado completo a partir de um bloco simples', () => {
    const [doc] = parseExtratoMensal(LINHAS_PAGINA_1);
    assert.strictEqual(doc.competencia, '07/2026');
    assert.strictEqual(doc.empresaCodigo, '453');
    assert.strictEqual(doc.empresaNome, 'QUADRANTE ETIQUETAS INDUSTRIA E COMERCIO');
    assert.strictEqual(doc.cnpj, '24.862.830/0001-96');
    assert.strictEqual(doc.empregados.length, 1);

    const emp = doc.empregados[0];
    assert.strictEqual(emp.tipo, 'Empr');
    assert.strictEqual(emp.matricula, '32');
    assert.strictEqual(emp.nome, 'ANDERSON RICARDO TAVARES MAROQUE');
    assert.strictEqual(emp.situacao, 'Trabalhando');
    assert.strictEqual(emp.cpf, '550.456.468-93');
    assert.strictEqual(emp.admissao, '12/05/2025');
    assert.strictEqual(emp.cargoNome, 'ASSISTENTE DE PRE IMPRESSAO JR');
    assert.strictEqual(emp.salario, 2398);
    assert.strictEqual(emp.rubricas.length, 4);
    assert.strictEqual(emp.proventos, 2631.20);
    assert.strictEqual(emp.descontos, 1150.70);
    assert.strictEqual(emp.liquido, 1480.50);
    assert.strictEqual(emp.baseInss, 2398);
    assert.strictEqual(emp.valorFgts, 191.84);
    assert.strictEqual(emp.baseIrrf, 1438.80);
    assert.strictEqual(emp.ferias, null);
    assert.strictEqual(emp.demissao, null);
});

teste('parseExtratoMensal reconhece registro tipo "Contr" (sócio/pró-labore, sem Horas Mês)', () => {
    const linhas = [
        'Empresa: 453 - QUADRANTE ETIQUETAS INDUSTRIA E COMERCIO Página: 10/11',
        'CNPJ: 24.862.830/0001-96 Emissão: 26/08/2026',
        'Cálculo: Folha Mensal Horas: 19:50:19',
        'Competência: 07/2026',
        'EXTRATO MENSAL',
        'Contr: 53 VANESSA ALVES SANTANA Situação: Trabalhando CPF: 285.542.588-35 Adm: 01/06/2016',
        'Vínculo: Diretor CC: 1 Depto: 1 Horas Mês:',
        'Cargo: 72 SOCIO C.B.O: 252105 Filial: 1 Salário: 1.621,00',
        '9380 PRO-LABORE DIAS 31,00 1.621,00 P 843 INSS EMPREGADOR 11,00 178,31 D',
        'Informativa: Informativa Dedutora:',
        'ND: 1 Proventos: 1.621,00 Descontos: 178,31 0 0 Líquido: 1.442,69',
        'NF: 0 Base INSS: 1.621,00 Excedente INSS: 0,00 Base FGTS: 0,00 Valor FGTS: 0,00 Base IRRF: 1.013,80',
        'Total Geral Proventos: 268.268,81 Total Geral Descontos: 173.748,37',
        'Líquido Geral: 94.520,44',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const [doc] = parseExtratoMensal(linhas);
    assert.strictEqual(doc.empregados.length, 1);
    assert.strictEqual(doc.empregados[0].tipo, 'Contr');
    assert.strictEqual(doc.empregados[0].matricula, '53');
    assert.strictEqual(doc.empregados[0].horasMes, null);
    assert.deepStrictEqual(doc.totalGeral, { proventos: 268268.81, descontos: 173748.37, liquido: 94520.44 });
});

teste('parseExtratoMensal captura "FERIAS DE" e associa ao empregado correspondente', () => {
    const linhas = LINHAS_PAGINA_1.slice(0, -1).concat(['FERIAS DE 20/07/2026 - 18/08/2026', 'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA']);
    const [doc] = parseExtratoMensal(linhas);
    assert.deepStrictEqual(doc.empregados[0].ferias, { inicio: '20/07/2026', fim: '18/08/2026' });
});

teste('parseExtratoMensal captura demissão e suspensão em linhas separadas (caso real ROGER FARIAS DA CRUZ)', () => {
    const linhas = [
        'Empresa: 453 - QUADRANTE ETIQUETAS INDUSTRIA E COMERCIO Página: 9/11',
        'CNPJ: 24.862.830/0001-96 Emissão: 26/08/2026',
        'Cálculo: Folha Mensal Horas: 19:50:19',
        'Competência: 07/2026',
        'EXTRATO MENSAL',
        'Empr.: 46 ROGER FARIAS DA CRUZ Situação: Demitido CPF: 429.303.858-20 Adm: 09/12/2025',
        'Vínculo: Celetista CC: 1 Depto: 1 Horas Mês: 220,00',
        'Cargo: 25 REVISOR DE IMPRESSAO JR C.B.O: 766145 Filial: 1 Salário: 2.635,88',
        '9180 SALDO DE SALARIO DIAS 20,00 1.700,57 P 49 AVISO PREVIO REAVIDO 30,00 2.635,88 D',
        'Informativa: Informativa Dedutora:',
        'ND: 2 Proventos: 5.312,66 Descontos: 5.312,66 163,08 0 Líquido: 0,00',
        'NF: 2 Base INSS: 2.038,60 Excedente INSS: 0,00 Base FGTS: 2.038,60 Valor FGTS: 163,08 Base IRRF: 331,87',
        'Suspensão: 16/07/2026 a 18/07/2026',
        'DEMITIDO EM 20/07/2026 - MOTIVO 4-Pedido de demissão SEM justa causa',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const [doc] = parseExtratoMensal(linhas);
    const emp = doc.empregados[0];
    assert.strictEqual(emp.situacao, 'Demitido');
    assert.deepStrictEqual(emp.suspensao, { inicio: '16/07/2026', fim: '18/07/2026' });
    assert.deepStrictEqual(emp.demissao, { data: '20/07/2026', motivo: '4-Pedido de demissão SEM justa causa' });
    assert.strictEqual(emp.liquido, 0);
});

teste('parseExtratoMensal separa duas competências do mesmo PDF em documentos distintos', () => {
    const linhasComp2 = [
        'Empresa: 453 - QUADRANTE ETIQUETAS INDUSTRIA E COMERCIO Página: 1/10',
        'CNPJ: 24.862.830/0001-96 Emissão: 26/08/2026',
        'Cálculo: Folha Mensal Horas: 19:50:19',
        'Competência: 08/2026',
        'EXTRATO MENSAL',
        'Empr.: 32 ANDERSON RICARDO TAVARES MAROQUE Situação: Trabalhando CPF: 550.456.468-93 Adm: 12/05/2025',
        'Vínculo: Celetista CC: 1 Depto: 1 Horas Mês: 220,00',
        'Cargo: 59 ASSISTENTE DE PRE IMPRESSAO JR C.B.O: 766205 Filial: 1 Salário: 2.398,00',
        '8781 DIAS NORMAIS 31,00 2.398,00 P 998 I.N.S.S. 7,99 191,50 D',
        '1012 VALE TRANSPORTE CREDITO 190,80 190,80 P 981 DESC.ADIANT.SALARIAL 959,20 959,20 D',
        'Informativa: Informativa Dedutora:',
        'ND: 0 Proventos: 2.588,80 Descontos: 1.150,70 191,84 0 Líquido: 1.438,10',
        'NF: 0 Base INSS: 2.398,00 Excedente INSS: 0,00 Base FGTS: 2.398,00 Valor FGTS: 191,84 Base IRRF: 1.438,80',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const docs = parseExtratoMensal(LINHAS_PAGINA_1.concat(linhasComp2));
    assert.strictEqual(docs.length, 2);
    assert.strictEqual(docs[0].competencia, '07/2026');
    assert.strictEqual(docs[1].competencia, '08/2026');
    assert.strictEqual(docs[0].empregados[0].liquido, 1480.50);
    assert.strictEqual(docs[1].empregados[0].liquido, 1438.10);
});

teste('parseExtratoMensal ignora a página de totais (INSS/FGTS/Situações) sem quebrar o parser', () => {
    const linhasTotais = [
        'Empresa: 453 - QUADRANTE ETIQUETAS INDUSTRIA E COMERCIO Página: 11/11',
        'CNPJ: 24.862.830/0001-96 Emissão: 26/08/2026',
        'Cálculo: Folha Mensal Horas: 19:50:19',
        'Competência: 07/2026',
        'EXTRATO MENSAL',
        'INSS FGTS, PIS e ISS',
        'Salário contribuição empregados: 196.223,28 Base do FGTS: 242.562,15',
        'Situações',
        'No. Empregados: 2',
        '41 Demitido:',
        'Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA'
    ];
    const docs = parseExtratoMensal(LINHAS_PAGINA_1.concat(linhasTotais));
    assert.strictEqual(docs.length, 1);
    assert.strictEqual(docs[0].empregados.length, 1);
});

// ===== extrato-comparador.js =====

function docFixture(competencia, empregados, totalGeral) {
    return { competencia, empresaCodigo: '453', empresaNome: 'QUADRANTE', cnpj: '24.862.830/0001-96', empregados, totalGeral };
}

function empFixture(overrides) {
    return Object.assign({
        tipo: 'Empr', matricula: '1', nome: 'FULANO', situacao: 'Trabalhando',
        proventos: 1000, descontos: 400, liquido: 600, ferias: null, demissao: null
    }, overrides);
}

teste('ordenarCompetencias ordena por MM/YYYY e devolve {anterior, atual}', () => {
    const docJulho = docFixture('07/2026', [], {});
    const docAgosto = docFixture('08/2026', [], {});
    const { anterior, atual } = ordenarCompetencias([docAgosto, docJulho]);
    assert.strictEqual(anterior.competencia, '07/2026');
    assert.strictEqual(atual.competencia, '08/2026');
});

teste('ordenarCompetencias devolve anterior=null quando só há uma competência', () => {
    const { anterior, atual } = ordenarCompetencias([docFixture('07/2026', [], {})]);
    assert.strictEqual(anterior, null);
    assert.strictEqual(atual.competencia, '07/2026');
});

teste('_deltaPercentual retorna null quando a base anterior é zero e o valor mudou', () => {
    assert.strictEqual(_deltaPercentual(0, 500), null);
    assert.strictEqual(_deltaPercentual(0, 0), 0);
    assert.strictEqual(_deltaPercentual(200, 300), 50);
});

teste('compararCompetencias identifica admissão, saída, entrada e volta de férias', () => {
    const anterior = docFixture('07/2026', [
        empFixture({ matricula: '1', nome: 'A' }),
        empFixture({ matricula: '2', nome: 'B (vai sair)' }),
        empFixture({ matricula: '3', nome: 'C (estava de férias)', ferias: { inicio: '01/07/2026', fim: '15/07/2026' } })
    ], { proventos: 3000, descontos: 1200, liquido: 1800 });

    const atual = docFixture('08/2026', [
        empFixture({ matricula: '1', nome: 'A' }),
        empFixture({ matricula: '3', nome: 'C (voltou)' }),
        empFixture({ matricula: '4', nome: 'D (novo)' })
    ], { proventos: 2800, descontos: 1000, liquido: 1800 });

    const resultado = compararCompetencias(anterior, atual);
    const tipos = resultado.mudancasQuadro.map(m => `${m.tipo}:${m.matricula}`).sort();
    assert.deepStrictEqual(tipos, ['admissao:4', 'saida:2', 'voltouFerias:3']);
});

teste('compararCompetencias marca acimaDoLimiar quando a variação percentual do líquido excede o limiar', () => {
    const anterior = docFixture('07/2026', [empFixture({ matricula: '1', liquido: 1000, proventos: 1500, descontos: 500 })], {});
    const atual = docFixture('08/2026', [empFixture({ matricula: '1', liquido: 1300, proventos: 1800, descontos: 500 })], {});

    const resultado = compararCompetencias(anterior, atual, { limiarPercentual: 15 });
    assert.strictEqual(resultado.variacaoTotais.length, 1);
    assert.strictEqual(resultado.variacaoTotais[0].liquido.deltaPercentual, 30);
    assert.strictEqual(resultado.variacaoTotais[0].acimaDoLimiar, true);
});

teste('compararCompetencias não marca acimaDoLimiar quando a variação fica dentro do limiar', () => {
    const anterior = docFixture('07/2026', [empFixture({ matricula: '1', liquido: 1000, proventos: 1500, descontos: 500 })], {});
    const atual = docFixture('08/2026', [empFixture({ matricula: '1', liquido: 1050, proventos: 1550, descontos: 500 })], {});

    const resultado = compararCompetencias(anterior, atual, { limiarPercentual: 15 });
    assert.strictEqual(resultado.variacaoTotais[0].acimaDoLimiar, false);
});

teste('compararCompetencias compara totais gerais da empresa', () => {
    const anterior = docFixture('07/2026', [], { proventos: 268268.81, descontos: 173748.37, liquido: 94520.44 });
    const atual = docFixture('08/2026', [], { proventos: 240533.23, descontos: 164056.52, liquido: 76476.71 });
    const resultado = compararCompetencias(anterior, atual);
    assert.strictEqual(resultado.totalGeral.liquido.deltaAbsoluto, -18043.73);
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
