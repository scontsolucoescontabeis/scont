const assert = require('node:assert');
const {
    _moedaBRparaFloat,
    _extrairDoc,
    _parsearLinhasSocios,
} = require('./socios-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

const CAB = 'CPF/CNPJ Nome do Sócio Participação (%) Ingresso Saída E-mail';
const TOPO = ['Empresa Capital Social E-mail', 'Data Quadro', 'Societário'];

// ===== _moedaBRparaFloat =====

teste('_moedaBRparaFloat converte 207.500,00 para 207500', () => {
    assert.strictEqual(_moedaBRparaFloat('207.500,00'), 207500);
});

teste('_moedaBRparaFloat converte 0,00 para 0 e vazio para null', () => {
    assert.strictEqual(_moedaBRparaFloat('0,00'), 0);
    assert.strictEqual(_moedaBRparaFloat(''), null);
});

// ===== _extrairDoc =====

teste('_extrairDoc limpa CPF quebrado por kerning', () => {
    assert.strictEqual(_extrairDoc('072.027.51 1-35 116 - CAROLANE 100,00 19/10/2022'), '072.027.511-35');
});

teste('_extrairDoc devolve CPF íntegro', () => {
    assert.strictEqual(_extrairDoc('658.894.601-53 106 - LUCIO 100,00 15/09/2022'), '658.894.601-53');
});

teste('_extrairDoc devolve null em linha sem documento', () => {
    assert.strictEqual(_extrairDoc('1 - CD SARACAI 100.000,00 05/09/2022 lv@x.com'), null);
});

// ===== _parsearLinhasSocios =====

teste('extrai contexto da empresa e emite os sócios', () => {
    const linhas = [
        ...TOPO,
        '1 - CD SARACAI COMERCIO DE ACAI E SORVETES L 100.000,00 05/09/2022 lv.saracai@gmail.com',
        CAB,
        '658.894.601-53 106 - LUCIO DE FARIA VIANA 100,00 15/09/2022 00/00/0000 LV.SARACAI@GMAIL.COM',
        '2 - CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA 50.000,00 17/06/2009 centroautomotivopassos01@hotmail.com',
        CAB,
        '783.190.991-53 3 - EDNA DE SOUSA PASSOS 50,00 03/09/2015 00/00/0000',
        '765.040.186-34 4 - ROBSON JOSE DOS PASSOS 50,00 03/09/2015 00/00/0000',
    ];
    const { registros, avisos } = _parsearLinhasSocios(linhas);
    assert.strictEqual(avisos.length, 0);
    assert.deepStrictEqual(registros[0], {
        codigo_empresa: '1',
        capital_social: 100000,
        email_empresa: 'lv.saracai@gmail.com',
        data_atualizacao_quadro: '2022-09-05',
        cpf: '658.894.601-53',
        nome_socio: 'LUCIO DE FARIA VIANA',
        participacao: 100,
        data_entrada: '2022-09-15',
        data_saida: null,
        email_socio: 'LV.SARACAI@GMAIL.COM',
    });
    assert.strictEqual(registros.length, 3);
    assert.strictEqual(registros[1].codigo_empresa, '2');
    assert.strictEqual(registros[1].nome_socio, 'EDNA DE SOUSA PASSOS');
    assert.strictEqual(registros[1].email_socio, null);
    assert.strictEqual(registros[2].nome_socio, 'ROBSON JOSE DOS PASSOS');
});

teste('sócio com data de saída real (duas datas na linha)', () => {
    const linhas = [
        '37 - FORTE EMPREENDIMENTOS IMOBILIARIOS LTDA 350.000,00 05/05/2010 pauloalves@opptima.com.br',
        CAB,
        '932.336.121-68 21 - RAFAELLA TELES ALVES 0,50 05/05/2010 07/02/2024',
    ];
    const { registros } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros[0].data_entrada, '2010-05-05');
    assert.strictEqual(registros[0].data_saida, '2024-02-07');
    assert.strictEqual(registros[0].participacao, 0.5);
});

teste('CPF quebrado por kerning é normalizado no registro', () => {
    const linhas = [
        '6 - ACOUGUE E FRUTARIA C. FELIX LTDA 30.000,00 24/05/2022 carolane13felix@gmail.com',
        CAB,
        '072.027.51 1-35 116 - CAROLANE FELIX DO NASCIMENTO 100,00 19/10/2022 00/00/0000 carolane13felix@gmail.com',
    ];
    const { registros } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros[0].cpf, '072.027.511-35');
});

teste('empresa sem e-mail e sem sócios com saída', () => {
    const linhas = [
        '40 - SEMANE SERVICOS MEDICOS DE ANESTESIOLO 330.000,00 16/04/2020',
        CAB,
        '283.867.792-68 220 - EVALDO OLIVEIRA DA SILVA 50,00 16/04/2020 00/00/0000',
    ];
    const { registros } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros[0].email_empresa, null);
    assert.strictEqual(registros[0].data_atualizacao_quadro, '2020-04-16');
});

teste('empresa com capital 0,00 e nome contendo dois-pontos', () => {
    const linhas = [
        '9 - BOUTIQUE AUTO: VENDA DE ACESSORIOS AUTOM 0,00 09/05/2016 glaucelio.aguiar@yahoo.com.br',
        CAB,
        '666.394.411-87 143 - GLAUCELIO DE AGUIAR SILVA 100,00 09/05/2016 00/00/0000',
    ];
    const { registros } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros[0].codigo_empresa, '9');
    assert.strictEqual(registros[0].capital_social, 0);
    assert.strictEqual(registros[0].nome_socio, 'GLAUCELIO DE AGUIAR SILVA');
});

teste('nome da empresa começando com número (CNPJ no nome)', () => {
    const linhas = [
        '18 - 01.353.870 SEBASTIAO SILVA E SOUSA 10.000,00 07/08/1996 eliane.farias01@gmail.com',
        CAB,
        '603.138.466-34 12 - SEBASTIAO SILVA E SOUSA 100,00 07/08/1996 00/00/0000',
    ];
    const { registros } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros[0].codigo_empresa, '18');
});

teste('ignora a empresa exemplo (9999) e seus sócios, sem gerar aviso', () => {
    const linhas = [
        '9999 - EMPRESA EXEMPLO LTDA 100.000,00 01/01/2005 exemplo.simples@exemplo.com.br',
        CAB,
        '300.000.000-35 1 - SÓCIO 1 DA EMPRESA EXEMPLO 50,00 01/01/2005 00/00/0000',
        '777.777.777-77 2 - SÓCIO 2 DA EMPRESA EXEMPLO 50,00 01/01/2005 00/00/0000',
        '100012 - PRESUMIDO CONSTRUTORA 250.000,00 28/02/2023',
        CAB,
        '028.329.311-03 238 - DANIELLE VIANA BARBOSA 50,00 11/08/2023 00/00/0000',
    ];
    const { registros, avisos } = _parsearLinhasSocios(linhas);
    assert.strictEqual(avisos.length, 0);
    assert.strictEqual(registros.length, 1);
    assert.strictEqual(registros[0].codigo_empresa, '100012');
});

teste('ignora linhas de cabeçalho de coluna e de topo de página', () => {
    const linhas = [
        ...TOPO,
        CAB,
        'Capital Social Data Quadro Societário Empresa E-mail',
    ];
    const { registros, avisos } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros.length, 0);
    assert.strictEqual(avisos.length, 0);
});

teste('sócio antes de qualquer empresa gera aviso', () => {
    const linhas = [
        '658.894.601-53 106 - LUCIO DE FARIA VIANA 100,00 15/09/2022 00/00/0000',
    ];
    const { registros, avisos } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros.length, 0);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /empresa/i);
});

teste('participação com casas decimais (fração societária)', () => {
    const linhas = [
        '14 - AQUARIA COSMETICA NATURAL LTDA 207.500,00 01/07/2026',
        CAB,
        '040.830.781-11 317 - BRENDA REIS DA SILVA 60,24 08/07/2024 00/00/0000 brendareis.qb@gmail.com',
        '611.450.171-34 207 - ALESSANDRA SANTOS LUDGERO NUNES 39,76 25/02/2022 00/00/0000',
    ];
    const { registros } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros[0].participacao, 60.24);
    assert.strictEqual(registros[0].email_socio, 'brendareis.qb@gmail.com');
    assert.strictEqual(registros[1].participacao, 39.76);
});

teste('nome longo colado na participação é recuperado; nome corrompido vira aviso', () => {
    const linhas = [
        '93 - NV PEDRO PORTUGAL 10.000,00 11/08/2023 nv.pedroportugal@gmail.com',
        CAB,
        '023.810.321-85 244 - PEDRO HENRIQUE BELCHIOR CARVALHO PORTUGAL100,00 11/08/2023 00/00/0000',
        '038.784.931-93 268 - MARIA KAMILA MORAIS TAVARES CANTANHEDE DUAR1T0E0,00 16/01/2024 00/00/0000',
    ];
    const { registros, avisos } = _parsearLinhasSocios(linhas);
    assert.strictEqual(registros.length, 1);
    assert.strictEqual(registros[0].nome_socio, 'PEDRO HENRIQUE BELCHIOR CARVALHO PORTUGAL');
    assert.strictEqual(registros[0].participacao, 100);
    assert.strictEqual(avisos.length, 1);
});

teste('mantém contexto da empresa entre páginas (cabeçalho de topo no meio)', () => {
    const linhas = [
        '515 - DTM II SERVICOS MEDICOS LTDA 10.000,00 10/06/2021 diego_ffs@hotmail.com',
        CAB,
        '007.371.621-98 967 - MARIANA OLIVEIRA LEAO FIGUEIREDO 25,00 10/06/2021 00/00/0000',
        ...TOPO,
        '044.023.924-97 966 - DIEGO FERNANDO FIGUEIREDO SANTOS 25,00 10/06/2021 00/00/0000',
    ];
    const { registros, avisos } = _parsearLinhasSocios(linhas);
    assert.strictEqual(avisos.length, 0);
    assert.strictEqual(registros.length, 2);
    assert.strictEqual(registros[1].codigo_empresa, '515');
    assert.strictEqual(registros[1].nome_socio, 'DIEGO FERNANDO FIGUEIREDO SANTOS');
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
