const assert = require('node:assert');
const {
    _soDigitos,
    _normalizarNome,
    _periodosSobrepoem,
    _ativoEm,
    computarOcorrencias,
} = require('./qsa-analise.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

const EMPRESAS = [
    { codigo_empresa: '1', nome_empresa: 'ACAI SARACAI LTDA' },
    { codigo_empresa: '2', nome_empresa: 'MECANICA PASSOS LTDA' },
];

// ===== helpers puros =====

teste('_soDigitos remove tudo que não é dígito', () => {
    assert.strictEqual(_soDigitos('072.027.511-35'), '07202751135');
    assert.strictEqual(_soDigitos(null), '');
});

teste('_normalizarNome remove acento, colapsa espaço e sobe caixa', () => {
    assert.strictEqual(_normalizarNome('  Lúcio  de   Faria Viana '), 'LUCIO DE FARIA VIANA');
});

teste('_periodosSobrepoem trata data ausente como limite aberto', () => {
    assert.strictEqual(_periodosSobrepoem('2020-01-01', null, '2019-01-01', '2019-06-01'), false);
    assert.strictEqual(_periodosSobrepoem('2020-01-01', null, '2019-01-01', '2021-06-01'), true);
    assert.strictEqual(_periodosSobrepoem(null, null, '2000-01-01', '2000-02-01'), true);
});

teste('_ativoEm considera início/fim abertos e data de referência', () => {
    assert.strictEqual(_ativoEm('2020-01-01', null, '2026-08-28'), true);
    assert.strictEqual(_ativoEm('2020-01-01', '2026-08-27', '2026-08-28'), false);
    assert.strictEqual(_ativoEm('2027-01-01', null, '2026-08-28'), false);
    assert.strictEqual(_ativoEm(null, null, '2026-08-28'), true);
});

// ===== computarOcorrencias =====

teste('match por CPF, mesma empresa, períodos sobrepostos', () => {
    const socios = [{
        cpf: '111.111.111-11', nome_socio: 'ANA SOUZA', codigo_empresa: '1',
        data_entrada: '2020-01-01', data_saida: '2022-01-01',
    }];
    const empregados = [{
        cpf: '11111111111', nome_empregado: 'ANA SOUZA', codigo_empresa: '1', codigo_empregado: '10',
        tipo_empregado: 'Empregado', data_admissao: '2021-06-01', data_demissao: '2023-01-01',
    }];
    const oc = computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28');
    assert.strictEqual(oc.length, 1);
    assert.strictEqual(oc[0].tipo_match, 'CPF');
    assert.strictEqual(oc[0].empresa_nome, 'ACAI SARACAI LTDA');
    assert.strictEqual(oc[0].codigo_empregado, '10');
    assert.strictEqual(oc[0].ocorrendo_agora, false);
});

teste('empresas diferentes não geram ocorrência', () => {
    const socios = [{ cpf: '111.111.111-11', nome_socio: 'ANA', codigo_empresa: '1', data_entrada: '2020-01-01', data_saida: null }];
    const empregados = [{ cpf: '11111111111', nome_empregado: 'ANA', codigo_empresa: '2', codigo_empregado: '10', tipo_empregado: 'Empregado', data_admissao: '2020-01-01', data_demissao: null }];
    assert.strictEqual(computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28').length, 0);
});

teste('só considera vínculo tipo "Empregado"', () => {
    const socios = [{ cpf: '111.111.111-11', nome_socio: 'ANA', codigo_empresa: '1', data_entrada: '2020-01-01', data_saida: null }];
    const empregados = [{ cpf: '11111111111', nome_empregado: 'ANA', codigo_empresa: '1', codigo_empregado: '10', tipo_empregado: 'Autônomo', data_admissao: '2020-01-01', data_demissao: null }];
    assert.strictEqual(computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28').length, 0);
});

teste('fallback por nome quando o sócio não tem CPF', () => {
    const socios = [{ cpf: null, nome_socio: 'João  Pereira', codigo_empresa: '2', data_entrada: '2015-01-01', data_saida: null }];
    const empregados = [{ cpf: '99999999999', nome_empregado: 'JOAO PEREIRA', codigo_empresa: '2', codigo_empregado: '7', tipo_empregado: 'Empregado', data_admissao: '2016-01-01', data_demissao: null }];
    const oc = computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28');
    assert.strictEqual(oc.length, 1);
    assert.strictEqual(oc[0].tipo_match, 'Nome (possível)');
});

teste('ocorrendo_agora = true quando sócio e empregado estão ativos na data de referência', () => {
    const socios = [{ cpf: '111.111.111-11', nome_socio: 'ANA', codigo_empresa: '1', data_entrada: '2020-01-01', data_saida: null }];
    const empregados = [{ cpf: '11111111111', nome_empregado: 'ANA', codigo_empresa: '1', codigo_empregado: '10', tipo_empregado: 'Empregado', data_admissao: '2021-06-01', data_demissao: null }];
    const oc = computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28');
    assert.strictEqual(oc[0].ocorrendo_agora, true);
});

teste('ocorrendo_agora = false quando o vínculo de empregado já foi encerrado', () => {
    const socios = [{ cpf: '111.111.111-11', nome_socio: 'ANA', codigo_empresa: '1', data_entrada: '2020-01-01', data_saida: null }];
    const empregados = [{ cpf: '11111111111', nome_empregado: 'ANA', codigo_empresa: '1', codigo_empregado: '10', tipo_empregado: 'Empregado', data_admissao: '2021-06-01', data_demissao: '2026-08-01' }];
    const oc = computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28');
    assert.strictEqual(oc.length, 1);
    assert.strictEqual(oc[0].ocorrendo_agora, false);
});

teste('ocorrendo_agora = false quando a saída do sócio é anterior à data de referência', () => {
    const socios = [{ cpf: '111.111.111-11', nome_socio: 'ANA', codigo_empresa: '1', data_entrada: '2020-01-01', data_saida: '2026-08-27' }];
    const empregados = [{ cpf: '11111111111', nome_empregado: 'ANA', codigo_empresa: '1', codigo_empregado: '10', tipo_empregado: 'Empregado', data_admissao: '2021-06-01', data_demissao: null }];
    const oc = computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28');
    assert.strictEqual(oc[0].ocorrendo_agora, false);
});

teste('observação sinaliza período do sócio indefinido', () => {
    const socios = [{ cpf: '111.111.111-11', nome_socio: 'ANA', codigo_empresa: '1', data_entrada: null, data_saida: null }];
    const empregados = [{ cpf: '11111111111', nome_empregado: 'ANA', codigo_empresa: '1', codigo_empregado: '10', tipo_empregado: 'Empregado', data_admissao: '2021-06-01', data_demissao: null }];
    const oc = computarOcorrencias(socios, empregados, EMPRESAS, '2026-08-28');
    assert.match(oc[0].observacao, /indefinido/);
});

teste('resultado ordenado por nome do sócio e sem depender de empresas cadastradas', () => {
    const socios = [
        { cpf: '222.222.222-22', nome_socio: 'ZECA', codigo_empresa: '1', data_entrada: '2020-01-01', data_saida: null },
        { cpf: '111.111.111-11', nome_socio: 'ANA', codigo_empresa: '1', data_entrada: '2020-01-01', data_saida: null },
    ];
    const empregados = [
        { cpf: '22222222222', nome_empregado: 'ZECA', codigo_empresa: '1', codigo_empregado: '2', tipo_empregado: 'Empregado', data_admissao: '2020-01-01', data_demissao: null },
        { cpf: '11111111111', nome_empregado: 'ANA', codigo_empresa: '1', codigo_empregado: '1', tipo_empregado: 'Empregado', data_admissao: '2020-01-01', data_demissao: null },
    ];
    const oc = computarOcorrencias(socios, empregados, [], '2026-08-28');
    assert.deepStrictEqual(oc.map(o => o.nome_socio), ['ANA', 'ZECA']);
    assert.strictEqual(oc[0].empresa_nome, '');
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
