// Projeto Ficha 360/tests/regras.test.js
const assert = require('node:assert');
const R = require('../js/regras.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }
const grav = (alertas) => alertas.map(a => a.gravidade);
const HOJE = '2026-09-14';

// ===== helpers =====
teste('diasAte conta dias corridos e trata null', () => {
    assert.strictEqual(R.diasAte('2026-09-21', HOJE), 7);
    assert.strictEqual(R.diasAte('2026-09-13', HOJE), -1);
    assert.strictEqual(R.diasAte('2026-09-14T10:00:00Z', HOJE), 0);
    assert.strictEqual(R.diasAte(null, HOJE), null);
});

teste('competenciaAnterior vira o ano em janeiro', () => {
    assert.strictEqual(R.competenciaAnterior('2026-09-14'), '08/2026');
    assert.strictEqual(R.competenciaAnterior('2027-01-05'), '12/2026');
});

teste('periodoEsperado respeita periodicidade', () => {
    assert.deepStrictEqual(R.periodoEsperado('mensal', '2026-09-14'), { ano: 2026, mes: 8 });
    assert.deepStrictEqual(R.periodoEsperado('trimestral', '2026-09-14'), { ano: 2026, mes: 6 });
    assert.deepStrictEqual(R.periodoEsperado('trimestral', '2026-10-01'), { ano: 2026, mes: 9 });
    assert.deepStrictEqual(R.periodoEsperado('semestral', '2026-09-14'), { ano: 2026, mes: 6 });
    assert.deepStrictEqual(R.periodoEsperado('anual', '2026-09-14'), { ano: 2025, mes: 12 });
    assert.deepStrictEqual(R.periodoEsperado('mensal', '2027-01-10'), { ano: 2026, mes: 12 });
    assert.deepStrictEqual(R.periodoEsperado(null, '2026-09-14'), { ano: 2026, mes: 8 });
});

teste('empregadoAtivo', () => {
    assert.strictEqual(R.empregadoAtivo('Ativo'), true);
    assert.strictEqual(R.empregadoAtivo('Inativo'), false);
    assert.strictEqual(R.empregadoAtivo(null), false);
});

// ===== certificado =====
teste('certificado: bordas 7/8 e 30/31 dias', () => {
    const c = (d) => ({ situacao: 'Ativo', ativo: true, data_vencimento: d });
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-09-21')], HOJE)), ['critico']);   // 7
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-09-22')], HOJE)), ['atencao']);   // 8
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-10-14')], HOJE)), ['atencao']);   // 30
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-10-15')], HOJE)), []);            // 31
    assert.deepStrictEqual(grav(R.alertasCertificados([c('2026-09-01')], HOJE)), ['critico']);   // vencido
});

teste('certificado: inativo/renovado ignorado; lista vazia gera info', () => {
    assert.deepStrictEqual(grav(R.alertasCertificados([], HOJE)), ['info']);
    assert.deepStrictEqual(grav(R.alertasCertificados([{ ativo: false, data_vencimento: '2026-09-01' }], HOJE)), ['info']);
    assert.deepStrictEqual(grav(R.alertasCertificados([{ ativo: true, situacao: 'Renovado', data_vencimento: '2026-09-01' }], HOJE)), ['info']);
});

// ===== licença =====
teste('licença: bordas 15/16 e 60/61 dias', () => {
    const l = (d) => ({ origem: 'licenca', tipo: 'Bombeiros', data_validade: d });
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-09-29')], HOJE)), ['critico']);   // 15
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-09-30')], HOJE)), ['atencao']);   // 16
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-11-13')], HOJE)), ['atencao']);   // 60
    assert.deepStrictEqual(grav(R.alertasLicencas([l('2026-11-14')], HOJE)), []);            // 61
    assert.deepStrictEqual(grav(R.alertasLicencas([{ origem: 'alvara', data_validade: null }], HOJE)), []);
});

// ===== folha =====
teste('folha: sem folha contratada não gera alerta', () => {
    assert.deepStrictEqual(R.alertasFolha({ possuiFolha: false, ciclos: [], temResponsavel: false }, HOJE), []);
});

teste('folha: dia 10 atenção, dia 11 crítico; concluído limpa', () => {
    const ciclos = [{ competencia: '08/2026', concluido_em: null, fechamento_ciclo_fase: [{ status: 'pendente' }, { status: 'concluida' }] }];
    assert.deepStrictEqual(grav(R.alertasFolha({ possuiFolha: true, ciclos, temResponsavel: true }, '2026-09-10')), ['atencao']);
    assert.deepStrictEqual(grav(R.alertasFolha({ possuiFolha: true, ciclos, temResponsavel: true }, '2026-09-11')), ['critico']);
    const ok = [{ competencia: '08/2026', concluido_em: '2026-09-05T12:00:00Z', fechamento_ciclo_fase: [] }];
    assert.deepStrictEqual(grav(R.alertasFolha({ possuiFolha: true, ciclos: ok, temResponsavel: true }, '2026-09-11')), []);
});

teste('folha: ciclo inexistente após dia 10 é crítico e sem responsável gera info', () => {
    const a = R.alertasFolha({ possuiFolha: true, ciclos: [], temResponsavel: false }, '2026-09-11');
    assert.deepStrictEqual(grav(a).sort(), ['critico', 'info']);
    assert.ok(a.find(x => x.gravidade === 'critico').mensagem.includes('não iniciado'));
});

// ===== QSA =====
teste('QSA: ocorrendo agora é crítico; histórico é atenção', () => {
    assert.deepStrictEqual(grav(R.alertasQsa([{ nome_socio: 'A', ocorrendo_agora: true }, { nome_socio: 'B', ocorrendo_agora: false }])), ['critico', 'atencao']);
    assert.deepStrictEqual(R.alertasQsa([]), []);
});

// ===== formulários =====
teste('formulários: 15 dias atenção, 16 crítico; fechados ignorados; agrega por gravidade', () => {
    const f = (d, status = 'recebido') => ({ status, created_at: `${d}T09:00:00Z` });
    assert.deepStrictEqual(grav(R.alertasFormularios([f('2026-08-30')], HOJE)), ['atencao']);  // 15
    assert.deepStrictEqual(grav(R.alertasFormularios([f('2026-08-29')], HOJE)), ['critico']);  // 16
    assert.deepStrictEqual(grav(R.alertasFormularios([f('2026-08-01', 'validado'), f('2026-08-01', 'excluido'), f('2026-08-01', 'rejeitado')], HOJE)), []);
    const a = R.alertasFormularios([f('2026-08-01'), f('2026-08-02'), f('2026-09-13')], HOJE);
    assert.deepStrictEqual(grav(a), ['critico', 'atencao']);
    assert.ok(a[0].mensagem.startsWith('2 '));
});

// ===== diário =====
teste('diário: sem contábil não gera alerta', () => {
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: false, periodicidade: 'mensal', eventos: [], temResponsavel: false }, HOJE), []);
});

teste('diário: competência esperada não enviada é atenção', () => {
    const a = R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: [], temResponsavel: true }, HOJE);
    assert.deepStrictEqual(grav(a), ['atencao']);
});

teste('diário: enviado/aprovado na esperada não gera alerta', () => {
    const ev = [{ ano: 2026, mes: 8, tipo_evento: 'enviado', created_at: '2026-09-02T10:00:00Z' }];
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: ev, temResponsavel: true }, HOJE), []);
});

teste('diário: último evento rejeitado é crítico; reenvio limpa', () => {
    const rej = [
        { ano: 2026, mes: 7, tipo_evento: 'enviado', created_at: '2026-08-02T10:00:00Z' },
        { ano: 2026, mes: 7, tipo_evento: 'rejeitado', created_at: '2026-08-03T10:00:00Z' },
        { ano: 2026, mes: 8, tipo_evento: 'aprovado', created_at: '2026-09-03T10:00:00Z' },
    ];
    assert.deepStrictEqual(grav(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: rej, temResponsavel: true }, HOJE)), ['critico']);
    const reenviado = rej.concat([{ ano: 2026, mes: 7, tipo_evento: 'enviado', created_at: '2026-08-04T10:00:00Z' }]);
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: reenviado, temResponsavel: true }, HOJE), []);
});

teste('diário: trimestral espera 06/2026 em setembro', () => {
    const ev = [{ ano: 2026, mes: 6, tipo_evento: 'aprovado', created_at: '2026-07-10T10:00:00Z' }];
    assert.deepStrictEqual(R.alertasDiario({ possuiContabil: true, periodicidade: 'trimestral', eventos: ev, temResponsavel: true }, HOJE), []);
});

teste('diário: sem responsável gera info', () => {
    const ev = [{ ano: 2026, mes: 8, tipo_evento: 'aprovado', created_at: '2026-09-03T10:00:00Z' }];
    assert.deepStrictEqual(grav(R.alertasDiario({ possuiContabil: true, periodicidade: 'mensal', eventos: ev, temResponsavel: false }, HOJE)), ['info']);
});

// ===== mapeamento =====
teste('mapeamento: níveis e pendências', () => {
    assert.deepStrictEqual(R.alertasMapeamento({ mapeamento: null, pendencias: [] }, HOJE), []);
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'critico' }, pendencias: [] }, HOJE)), ['critico']);
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'alto' }, pendencias: [] }, HOJE)), ['atencao']);
    assert.deepStrictEqual(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'medio' }, pendencias: [] }, HOJE), []);
    const vencida = { status: 'aberta', prazo: '2026-09-13' };
    const futura = { status: 'aberta', prazo: '2026-09-20' };
    const resolvida = { status: 'resolvida', prazo: '2026-01-01' };
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'baixo' }, pendencias: [vencida, futura] }, HOJE)), ['atencao']);
    assert.deepStrictEqual(grav(R.alertasMapeamento({ mapeamento: { nivel_atencao: 'baixo' }, pendencias: [futura, resolvida] }, HOJE)), ['info']);
});

// ===== onboarding =====
teste('onboarding: 60 dias ok, 61 atenção, concluído ignorado', () => {
    assert.deepStrictEqual(R.alertasOnboarding({ status: 'em_andamento', data_inicio: '2026-07-16' }, HOJE), []);           // 60
    assert.deepStrictEqual(grav(R.alertasOnboarding({ status: 'em_andamento', data_inicio: '2026-07-15' }, HOJE)), ['atencao']); // 61
    assert.deepStrictEqual(R.alertasOnboarding({ status: 'concluido', data_inicio: '2025-01-01' }, HOJE), []);
    assert.deepStrictEqual(R.alertasOnboarding(null, HOJE), []);
});

// ===== cadastro =====
teste('cadastro: sem ficha / sem contato principal geram info', () => {
    assert.deepStrictEqual(grav(R.alertasCadastro({ ficha: null, contatos: [] })), ['info']);
    assert.deepStrictEqual(grav(R.alertasCadastro({ ficha: {}, contatos: [{ principal: false }] })), ['info']);
    assert.deepStrictEqual(R.alertasCadastro({ ficha: {}, contatos: [{ principal: true }] }), []);
});

// ===== semáforo =====
teste('semáforo: pior gravidade vence; info é verde; inativo sobrepõe', () => {
    const a = (g) => ({ modulo: 'x', gravidade: g, mensagem: '' });
    assert.strictEqual(R.semaforo([a('info'), a('critico'), a('atencao')], 'ativo'), 'vermelho');
    assert.strictEqual(R.semaforo([a('info'), a('atencao')], 'ativo'), 'amarelo');
    assert.strictEqual(R.semaforo([a('info')], 'ativo'), 'verde');
    assert.strictEqual(R.semaforo([], undefined), 'verde');
    assert.strictEqual(R.semaforo([a('critico')], 'inativo'), 'inativo');
});

teste('ordenarAlertas coloca crítico primeiro sem mutar a entrada', () => {
    const entrada = [{ gravidade: 'info' }, { gravidade: 'critico' }, { gravidade: 'atencao' }];
    assert.deepStrictEqual(grav(R.ordenarAlertas(entrada)), ['critico', 'atencao', 'info']);
    assert.strictEqual(entrada[0].gravidade, 'info');
});

console.log(`\n${n} testes OK`);
