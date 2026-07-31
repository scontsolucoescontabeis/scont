const assert = require('node:assert');
const {
    _reconstruirLinhasPagina, _classificarTipoPagina,
    _extrairDadosAviso, _extrairDadosAbono,
    _normalizarNome, _normalizarCNPJ,
    _montarRegistrosEmpregados, _agruparPorEmpresa,
    _resolverCodigoEmpresa, _sanitizarNomeArquivo, _montarNomeArquivo
} = require('./aviso-ferias-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// ===== _reconstruirLinhasPagina =====

teste('_reconstruirLinhasPagina agrupa itens de mesmo y e ordena por x (linha "Cadastro:"/"CPF:" real)', () => {
    const items = [
        { str: 'CPF:', transform: [1, 0, 0, 1, 408.5, 700.9] },
        { str: '51 - ERIC DOUGLAS RODRIGUES ABELAYR', transform: [1, 0, 0, 1, 64.7, 700.9] },
        { str: '077.293.941-11', transform: [1, 0, 0, 1, 433.7, 700.9] },
        { str: 'Cadastro:', transform: [1, 0, 0, 1, 18.4, 700.9] }
    ];
    assert.deepStrictEqual(
        _reconstruirLinhasPagina(items),
        ['Cadastro: 51 - ERIC DOUGLAS RODRIGUES ABELAYR CPF: 077.293.941-11']
    );
});

teste('_reconstruirLinhasPagina separa linhas com y além do limiar (quebra "ANANKE" real, page 8)', () => {
    const items = [
        { str: 'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL', transform: [1, 0, 0, 1, 23.2, 391.6] },
        { str: 'GILVANETE LOURENCO DOS SANTOS', transform: [1, 0, 0, 1, 358.7, 391.6] },
        { str: 'LTDA', transform: [1, 0, 0, 1, 129.3, 380.7] }
    ];
    assert.deepStrictEqual(_reconstruirLinhasPagina(items), [
        'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL GILVANETE LOURENCO DOS SANTOS',
        'LTDA'
    ]);
});

// ===== _classificarTipoPagina =====

teste('_classificarTipoPagina identifica página "aviso"', () => {
    assert.strictEqual(_classificarTipoPagina(['AVISO DE FÉRIAS', 'BRASILIA, 17 de Julho de 2026']), 'aviso');
});

teste('_classificarTipoPagina identifica página "abono"', () => {
    assert.strictEqual(_classificarTipoPagina(['SOLICITAÇÃO DE ABONO DE FÉRIAS', 'Empresa: X CNPJ: Y']), 'abono');
});

teste('_classificarTipoPagina retorna null para página desconhecida', () => {
    assert.strictEqual(_classificarTipoPagina(['ALGUM OUTRO TÍTULO']), null);
});

// ===== _extrairDadosAviso (linhas reais reconstruídas, page 1 — ERIC DOUGLAS) =====

const LINHAS_AVISO_ERIC = [
    'AVISO DE FÉRIAS',
    'BRASILIA, 17 de Julho de 2026',
    'Sr.: ERIC DOUGLAS RODRIGUES ABELAYR',
    'C.T.P.S.: 0772939 Série: 411',
    'Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o',
    'demonstrativo abaixo:',
    'Período Aquisitivo...............: 17/06/2025 - 16/06/2026',
    'Período de Gozo................: 17/08/2026 - 05/09/2026',
    'Retorno ao trabalho............: 06/09/2026',
    'A remuneração correspondente às férias, e se for o caso, ao abono pecuniário e ao',
    'adiantamento da gratificação de natal encontra-se no caixa e poderá ser recebida em 14/08/2026.',
    'Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Departamento',
    'de Pessoal para as anotações necessárias.',
    'N DE QUEIROZ DROGARIA LTDA ERIC DOUGLAS RODRIGUES ABELAYR'
];

teste('_extrairDadosAviso extrai todos os campos de uma página simples (sem quebra de empresa)', () => {
    const dados = _extrairDadosAviso(LINHAS_AVISO_ERIC);
    assert.deepStrictEqual(dados, {
        nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR',
        ctps: '0772939',
        periodo_aquisitivo_inicio: '17/06/2025',
        periodo_aquisitivo_fim: '16/06/2026',
        periodo_gozo_inicio: '17/08/2026',
        periodo_gozo_fim: '05/09/2026',
        retorno_trabalho: '06/09/2026',
        nome_empresa: 'N DE QUEIROZ DROGARIA LTDA'
    });
});

teste('_extrairDadosAviso reconstrói nome de empresa quebrado em 2 linhas (continuação depois do nome do empregado — page 7, GILVANETE)', () => {
    const linhas = [
        'AVISO DE FÉRIAS',
        'BRASILIA, 24 de Julho de 2026',
        'Sra.: GILVANETE LOURENCO DOS SANTOS',
        'C.T.P.S.: 00098433 Série: 00014',
        'Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o',
        'demonstrativo abaixo:',
        'Período Aquisitivo...............: 19/01/2025 - 18/01/2026',
        'Período de Gozo................: 10/08/2026 - 24/08/2026',
        'Retorno ao trabalho............: 25/08/2026',
        'A remuneração correspondente às férias, e se for o caso, ao abono pecuniário e ao',
        'adiantamento da gratificação de natal encontra-se no caixa e poderá ser recebida em 07/08/2026.',
        'Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Departamento',
        'de Pessoal para as anotações necessárias.',
        'ANANKE-CENTRO DE ATENCAO A SAUDE GILVANETE LOURENCO DOS SANTOS',
        'MENTAL LTDA'
    ];
    const dados = _extrairDadosAviso(linhas);
    assert.strictEqual(dados.nome_empregado, 'GILVANETE LOURENCO DOS SANTOS');
    assert.strictEqual(dados.nome_empresa, 'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL LTDA');
});

teste('_extrairDadosAviso tolera ausência de C.T.P.S. (page 33, RAQUEL)', () => {
    const linhas = [
        'AVISO DE FÉRIAS',
        'BRASILIA, 17 de Julho de 2026',
        'Sr.: RAQUEL VIEIRA DA COSTA',
        'Nos termos das disposições legais vigentes, suas férias serão concedidas conforme o',
        'demonstrativo abaixo:',
        'Período Aquisitivo...............: 04/04/2025 - 03/04/2026',
        'Período de Gozo................: 18/08/2026 - 16/09/2026',
        'Retorno ao trabalho............: 17/09/2026',
        'A remuneração correspondente às férias, e se for o caso, ao abono pecuniário e ao',
        'adiantamento da gratificação de natal encontra-se no caixa e poderá ser recebida em 14/08/2026.',
        'Favor apresentar a sua Carteira de Trabalho e Previdência Social ao Departamento',
        'de Pessoal para as anotações necessárias.',
        'SOUL SERVICOS LTDA RAQUEL VIEIRA DA COSTA'
    ];
    const dados = _extrairDadosAviso(linhas);
    assert.strictEqual(dados.ctps, null);
    assert.strictEqual(dados.nome_empresa, 'SOUL SERVICOS LTDA');
});

// ===== _extrairDadosAbono (linhas reais reconstruídas, page 2 — ERIC DOUGLAS) =====

teste('_extrairDadosAbono extrai empresa, CNPJ, cadastro, nome e CPF', () => {
    const linhas = [
        'SOLICITAÇÃO DE ABONO DE FÉRIAS',
        'Empresa: N DE QUEIROZ DROGARIA LTDA CNPJ: 08.836.871/0001-51',
        'Cadastro: 51 - ERIC DOUGLAS RODRIGUES ABELAYR CPF: 077.293.941-11',
        'Em cumprimento ao disposto no parágrafo 1º do Artigo 143 do Decreto-Lei Nº 1.535 de 13 de Abril de 1977, venho pela',
        'presente requerer a ABONO PECUNIÁRIO de 1/3 das férias, referente ao período aquisitivo de 17/06/2025 a 16/06/2026.',
        'BRASILIA, 17 DE JULHO DE 2026',
        'N DE QUEIROZ DROGARIA LTDA ERIC DOUGLAS RODRIGUES ABELAYR'
    ];
    assert.deepStrictEqual(_extrairDadosAbono(linhas), {
        nome_empresa: 'N DE QUEIROZ DROGARIA LTDA',
        cnpj: '08.836.871/0001-51',
        cadastro_codigo: '51',
        nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR',
        cpf: '077.293.941-11'
    });
});

teste('_extrairDadosAbono extrai corretamente mesmo com empresa longa que não quebrou (page 8, ANANKE)', () => {
    const linhas = [
        'SOLICITAÇÃO DE ABONO DE FÉRIAS',
        'Empresa: ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL LTDA CNPJ: 36.756.427/0001-61',
        'Cadastro: 175 - GILVANETE LOURENCO DOS SANTOS CPF: 903.631.081-49'
    ];
    const dados = _extrairDadosAbono(linhas);
    assert.strictEqual(dados.nome_empresa, 'ANANKE-CENTRO DE ATENCAO A SAUDE MENTAL LTDA');
    assert.strictEqual(dados.cnpj, '36.756.427/0001-61');
});

// ===== _normalizarNome / _normalizarCNPJ =====

teste('_normalizarNome remove acentos, uppercase e colapsa espaços', () => {
    assert.strictEqual(_normalizarNome('  José  da Silva  '), 'JOSE DA SILVA');
});

teste('_normalizarCNPJ mantém só dígitos', () => {
    assert.strictEqual(_normalizarCNPJ('08.836.871/0001-51'), '08836871000151');
});

// ===== _montarRegistrosEmpregados =====

teste('_montarRegistrosEmpregados pareia aviso+abono consecutivos do mesmo empregado', () => {
    const paginas = [
        { numero: 1, tipo: 'aviso', dados: { nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA' } },
        { numero: 2, tipo: 'abono', dados: { nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA', cnpj: '08.836.871/0001-51' } }
    ];
    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 1);
    assert.deepStrictEqual(registros[0], {
        nome_empregado: 'ERIC DOUGLAS RODRIGUES ABELAYR',
        nome_empresa: 'N DE QUEIROZ DROGARIA LTDA',
        cnpj: '08836871000151',
        paginas: [1, 2]
    });
});

teste('_montarRegistrosEmpregados tolera empregado sem página de abono', () => {
    const paginas = [
        { numero: 1, tipo: 'aviso', dados: { nome_empregado: 'FULANO', nome_empresa: 'EMPRESA X' } },
        { numero: 2, tipo: 'aviso', dados: { nome_empregado: 'CICLANO', nome_empresa: 'EMPRESA Y' } }
    ];
    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 2);
    assert.deepStrictEqual(registros[0].paginas, [1]);
    assert.strictEqual(registros[0].cnpj, null);
});

teste('_montarRegistrosEmpregados não pareia abono de empregado diferente do aviso anterior', () => {
    const paginas = [
        { numero: 1, tipo: 'aviso', dados: { nome_empregado: 'FULANO', nome_empresa: 'EMPRESA X' } },
        { numero: 2, tipo: 'abono', dados: { nome_empregado: 'OUTRA PESSOA', nome_empresa: 'EMPRESA X', cnpj: '00.000.000/0001-00' } }
    ];
    const { registros, avisos } = _montarRegistrosEmpregados(paginas);
    assert.strictEqual(registros.length, 1);
    assert.deepStrictEqual(registros[0].paginas, [1]);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /não é do tipo "aviso"/);
});

// ===== _agruparPorEmpresa =====

teste('_agruparPorEmpresa agrupa por CNPJ e acumula empregados/páginas', () => {
    const registros = [
        { nome_empregado: 'A', nome_empresa: 'EMPRESA X', cnpj: '111', paginas: [1, 2] },
        { nome_empregado: 'B', nome_empresa: 'EMPRESA X', cnpj: '111', paginas: [3, 4] }
    ];
    const grupos = _agruparPorEmpresa(registros);
    assert.strictEqual(grupos.length, 1);
    assert.deepStrictEqual(grupos[0].empregados, ['A', 'B']);
    assert.deepStrictEqual(grupos[0].paginas, [1, 2, 3, 4]);
});

teste('_agruparPorEmpresa usa nome normalizado como chave quando não há CNPJ', () => {
    const registros = [
        { nome_empregado: 'A', nome_empresa: 'Empresa Sem CNPJ', cnpj: null, paginas: [1] }
    ];
    const grupos = _agruparPorEmpresa(registros);
    assert.strictEqual(grupos.length, 1);
    assert.strictEqual(grupos[0].chave, 'NOME:EMPRESA SEM CNPJ');
});

// ===== _resolverCodigoEmpresa =====

teste('_resolverCodigoEmpresa encontra pelo CNPJ normalizado', () => {
    const mapa = { '08836871000151': { codigo_empresa: '99', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA' } };
    assert.deepStrictEqual(_resolverCodigoEmpresa('08836871000151', mapa), { codigo_empresa: '99', nome_empresa: 'N DE QUEIROZ DROGARIA LTDA' });
});

teste('_resolverCodigoEmpresa retorna null quando não encontra', () => {
    assert.strictEqual(_resolverCodigoEmpresa('00000000000000', {}), null);
});

// ===== _sanitizarNomeArquivo / _montarNomeArquivo =====

teste('_sanitizarNomeArquivo remove caracteres inválidos em nomes de arquivo Windows', () => {
    assert.strictEqual(_sanitizarNomeArquivo('03/08 a 07/09/2026: teste?'), '0308 a 07092026 teste');
});

teste('_montarNomeArquivo monta o nome final no padrão pedido', () => {
    assert.strictEqual(_montarNomeArquivo('453', 'AGO-2026'), '453_AVISO DE FERIAS_AGO-2026.pdf');
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
