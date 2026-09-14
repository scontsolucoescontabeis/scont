// Projeto Ficha 360/tests/carteira.test.js
const assert = require('node:assert');
const { montarCarteira } = require('../js/carteira.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }
const HOJE = '2026-09-14';

function base() {
    return {
        empresas: [
            { id: 'u1', codigo_empresa: '10', nome_empresa: 'Beta Ltda', cnpj: '12345678000190', regime_enquadramento: 'Simples', status_situacao: 'Ativo' },
            { id: 'u2', codigo_empresa: '20', nome_empresa: 'Alfa ME', cnpj: '98765432000110', regime_enquadramento: 'Presumido', status_situacao: 'Ativo' },
        ],
        fichas: [{ codigo_empresa: '10', status_carteira: 'ativo' }],
        contatos: [{ codigo_empresa: '10', nome: 'Ana', principal: true }],
        respDp: [{ codigo_empresa: '10', usuario_id: 'd1' }],
        usuariosDp: [{ id: 'd1', nome: 'Dora DP' }],
        respContabil: [{ codigo_empresa: '10', usuario_id: 'k1' }],
        usuariosContabil: [{ id: 'k1', nome: 'Caio Contábil' }],
        cfgFolha: [{ codigo_empresa: '10', possui_folha: true }],
        cfgContabil: [{ codigo_empresa: '10', possui_contabil: true }],
        certificados: [{ id: 'c1', cpf_cnpj: '12.345.678/0001-90', situacao: 'Ativo', ativo: true, data_vencimento: '2026-12-31' }],
        licencas: [{ id: 'l1', empresa_id: 'u1', tipo: 'Bombeiros', data_validade: '2026-09-20' }],
        alvaras: [],
        empregados: [
            { codigo_empresa: '10', codigo_empregado: '1', nome_empregado: 'X', situacao: 'Ativo', tipo_empregado: 'Empregado' },
            { codigo_empresa: '10', codigo_empregado: '2', nome_empregado: 'Y', situacao: 'Inativo', tipo_empregado: 'Empregado' },
            { codigo_empresa: '10', codigo_empregado: '3', nome_empregado: 'Z', situacao: 'Ativo', tipo_empregado: 'Estagiário' },
        ],
        socios: [],
        ciclos: [{ codigo_empresa: '10', competencia: '08/2026', concluido_em: '2026-09-05T00:00:00Z', fechamento_ciclo_fase: [] }],
        formularios: [],
        empregadosForm: [],
        onboardings: [],
        mapeamentos: [{ id: 'm1', codigo_empresa: '10', periodicidade: 'mensal', nivel_atencao: 'baixo' }],
        pendencias: [],
        diarioEventos: [{ codigo_empresa: '10', ano: 2026, mes: 8, tipo_evento: 'aprovado', created_at: '2026-09-03T00:00:00Z' }],
        gruposItens: [{ grupo_id: 'g1', codigo_empresa: '10' }],
        grupos: [{ id: 'g1', nome_grupo: 'Grupo Beta' }],
    };
}

teste('monta item com responsáveis, grupo, contagem de ativos e ordena por nome', () => {
    const c = montarCarteira(base(), HOJE);
    assert.deepStrictEqual(c.map(i => i.codigo), ['20', '10']);
    const beta = c.find(i => i.codigo === '10');
    assert.deepStrictEqual(beta.responsaveisDp, ['Dora DP']);
    assert.deepStrictEqual(beta.responsaveisContabil, ['Caio Contábil']);
    assert.strictEqual(beta.grupo, 'Grupo Beta');
    assert.strictEqual(beta.empregadosAtivos, 1);
    assert.strictEqual(beta.certificados.length, 1);
    assert.strictEqual(beta.licencas[0].origem, 'licenca');
});

teste('licença vencendo em 6 dias deixa a empresa vermelha', () => {
    const beta = montarCarteira(base(), HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.semaforo, 'vermelho');
    assert.strictEqual(beta.alertas[0].modulo, 'licenca');
});

teste('empresa sem nada configurado fica verde com infos', () => {
    const alfa = montarCarteira(base(), HOJE).find(i => i.codigo === '20');
    assert.strictEqual(alfa.statusCarteira, 'ativo');
    assert.strictEqual(alfa.possuiFolha, false);
    assert.strictEqual(alfa.semaforo, 'verde');
    assert.ok(alfa.alertas.some(a => a.modulo === 'cadastro'));
    assert.ok(alfa.alertas.some(a => a.modulo === 'certificado' && a.gravidade === 'info'));
});

teste('fonte indisponível (null) não gera alertas daquele módulo', () => {
    const d = base();
    d.licencas = null;
    d.certificados = null;
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.alertas.some(a => a.modulo === 'licenca' || a.modulo === 'certificado'), false);
    assert.strictEqual(beta.semaforo, 'verde');
});

teste('empregados indisponível → empregadosAtivos null e sem QSA', () => {
    const d = base();
    d.empregados = null;
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.empregadosAtivos, null);
    assert.deepStrictEqual(beta.ocorrenciasQsa, []);
    assert.strictEqual(beta.alertas.some(a => a.modulo === 'qsa'), false);
});

teste('status inativo vira semáforo inativo', () => {
    const d = base();
    d.fichas[0].status_carteira = 'inativo';
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.strictEqual(beta.semaforo, 'inativo');
});

teste('formulários por rh_empresa_id e QSA ocorrendo agora', () => {
    const d = base();
    d.formularios = [{ id: 'f1', rh_empresa_id: 'u2', status: 'recebido', created_at: '2026-08-01T00:00:00Z' }];
    d.socios = [{ codigo_empresa: '20', nome_socio: 'João', cpf: '11122233344', data_entrada: '2020-01-01', data_saida: null }];
    d.empregados.push({ codigo_empresa: '20', codigo_empregado: '9', nome_empregado: 'João', cpf: '111.222.333-44', situacao: 'Ativo', tipo_empregado: 'Empregado', data_admissao: '2021-01-01', data_demissao: null });
    const alfa = montarCarteira(d, HOJE).find(i => i.codigo === '20');
    assert.strictEqual(alfa.formularios.length, 1);
    assert.strictEqual(alfa.ocorrenciasQsa.length, 1);
    assert.strictEqual(alfa.semaforo, 'vermelho');
});

teste('responsável sem nome resolvido aparece como "(sem nome)"', () => {
    const d = base();
    d.usuariosDp = null;
    const beta = montarCarteira(d, HOJE).find(i => i.codigo === '10');
    assert.deepStrictEqual(beta.responsaveisDp, ['(sem nome)']);
});

console.log(`\n${n} testes OK`);
