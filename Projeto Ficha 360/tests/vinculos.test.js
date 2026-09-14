// Projeto Ficha 360/tests/vinculos.test.js
const assert = require('node:assert');
const V = require('../js/vinculos.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }

teste('soDigitos remove máscara e trata null', () => {
    assert.strictEqual(V.soDigitos('12.345.678/0001-90'), '12345678000190');
    assert.strictEqual(V.soDigitos(null), '');
});

teste('normalizarNome remove acento, pontuação e sufixos societários', () => {
    assert.strictEqual(V.normalizarNome('  Padaria  São João Ltda. '), 'PADARIA SAO JOAO');
    assert.strictEqual(V.normalizarNome('ALFA COMERCIO - ME'), 'ALFA COMERCIO');
    assert.strictEqual(V.normalizarNome('Beta Serviços EIRELI'), 'BETA SERVICOS');
    assert.strictEqual(V.normalizarNome('Gama Indústria S/A'), 'GAMA INDUSTRIA');
    assert.strictEqual(V.normalizarNome('Delta EPP LTDA'), 'DELTA');
    assert.strictEqual(V.normalizarNome('ACME'), 'ACME');
    assert.strictEqual(V.normalizarNome('LTDA'), 'LTDA');
});

teste('indexarPorCodigo agrupa linhas', () => {
    const m = V.indexarPorCodigo([{ codigo_empresa: '1', x: 1 }, { codigo_empresa: '1', x: 2 }, { codigo_empresa: '2', x: 3 }]);
    assert.strictEqual(m.get('1').length, 2);
    assert.strictEqual(m.get('2').length, 1);
    assert.strictEqual(m.get('3'), undefined);
});

teste('indexarPorCodigo aceita campo customizado', () => {
    const m = V.indexarPorCodigo([{ mapeamento_id: 'a' }], 'mapeamento_id');
    assert.strictEqual(m.get('a').length, 1);
});

const EMPRESAS = [
    { codigo_empresa: '10', nome_empresa: 'Alfa Ltda', cnpj: '12.345.678/0001-90' },
    { codigo_empresa: '20', nome_empresa: 'Beta ME', cnpj: '98765432000110' },
];
const SOCIOS = [
    { codigo_empresa: '10', cpf: '111.222.333-44' },
    { codigo_empresa: '20', cpf: '11122233344' },
];

teste('vincularCertificados casa e-CNPJ por CNPJ sem máscara', () => {
    const m = V.vincularCertificados([{ id: 'c1', cpf_cnpj: '12345678000190' }], EMPRESAS, SOCIOS);
    assert.deepStrictEqual(m.get('10').map(c => c.id), ['c1']);
    assert.strictEqual(m.get('20'), undefined);
});

teste('vincularCertificados casa e-CPF em todas as empresas do sócio', () => {
    const m = V.vincularCertificados([{ id: 'c2', cpf_cnpj: '111.222.333-44' }], EMPRESAS, SOCIOS);
    assert.deepStrictEqual(m.get('10').map(c => c.id), ['c2']);
    assert.deepStrictEqual(m.get('20').map(c => c.id), ['c2']);
});

teste('vincularCertificados ignora documento sem correspondência', () => {
    const m = V.vincularCertificados([{ id: 'c3', cpf_cnpj: '00000000000000' }, { id: 'c4', cpf_cnpj: null }], EMPRESAS, SOCIOS);
    assert.strictEqual(m.size, 0);
});

teste('vincularContatosCrm casa por nome normalizado, sem duplicar contato', () => {
    const m = V.vincularContatosCrm([
        { contato_id: 'k1', empresa: 'ALFA LTDA.' },
        { contato_id: 'k1', empresa: 'alfa' },
        { contato_id: 'k2', empresa: 'Beta' },
        { contato_id: 'k3', empresa: 'Outra' },
    ], EMPRESAS);
    assert.deepStrictEqual(m.get('10'), ['k1']);
    assert.deepStrictEqual(m.get('20'), ['k2']);
    assert.strictEqual(m.size, 2);
});

console.log(`\n${n} testes OK`);
