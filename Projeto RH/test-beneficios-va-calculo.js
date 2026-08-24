const assert = require('node:assert');
const {
    minutosJornadaEfetivaDia, diaSemJornadaVA, calcularDiasReduzidosVA
} = require('./beneficios-va-calculo.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

teste('minutosJornadaEfetivaDia: dia comum usa jornada diária', () => {
    const jornada = { jornadaDiaria: '08:00' };
    assert.strictEqual(minutosJornadaEfetivaDia(jornada, 'Ter'), 480);
});

teste('minutosJornadaEfetivaDia: sexta sem jornada diferenciada usa jornada diária', () => {
    const jornada = { jornadaDiaria: '08:00', jornadaSextaAtiva: false };
    assert.strictEqual(minutosJornadaEfetivaDia(jornada, 'Sex'), 480);
});

teste('minutosJornadaEfetivaDia: sexta com jornada diferenciada usa jornadaSexta', () => {
    const jornada = { jornadaDiaria: '08:00', jornadaSextaAtiva: true, jornadaSexta: '04:00' };
    assert.strictEqual(minutosJornadaEfetivaDia(jornada, 'Sex'), 240);
});

teste('minutosJornadaEfetivaDia: sábado com jornada diferenciada usa jornadaSabado', () => {
    const jornada = { jornadaDiaria: '08:00', jornadaSabadoAtiva: true, jornadaSabado: '04:00' };
    assert.strictEqual(minutosJornadaEfetivaDia(jornada, 'Sab'), 240);
});

teste('minutosJornadaEfetivaDia: sábado sempre extra retorna null (fora da regra)', () => {
    const jornada = { jornadaDiaria: '08:00', sabadoSempreExtra: true, jornadaSabadoAtiva: false };
    assert.strictEqual(minutosJornadaEfetivaDia(jornada, 'Sab'), null);
});

teste('minutosJornadaEfetivaDia: sem jornada informada usa padrão 08:00', () => {
    assert.strictEqual(minutosJornadaEfetivaDia(null, 'Qua'), 480);
});

teste('diaSemJornadaVA: true quando jornada efetiva <= 4h', () => {
    const jornada = { jornadaDiaria: '08:00', jornadaSabadoAtiva: true, jornadaSabado: '04:00' };
    assert.strictEqual(diaSemJornadaVA(jornada, 'Sab'), true);
});

teste('diaSemJornadaVA: false quando jornada efetiva > 4h', () => {
    const jornada = { jornadaDiaria: '08:00' };
    assert.strictEqual(diaSemJornadaVA(jornada, 'Seg'), false);
});

teste('diaSemJornadaVA: false quando o dia está fora da regra (sábado sempre extra)', () => {
    const jornada = { jornadaDiaria: '08:00', sabadoSempreExtra: true };
    assert.strictEqual(diaSemJornadaVA(jornada, 'Sab'), false);
});

teste('calcularDiasReduzidosVA: conta só dias de trabalho com jornada <= 4h', () => {
    const jornada = { jornadaDiaria: '08:00', jornadaSabadoAtiva: true, jornadaSabado: '04:00' };
    const dias = [
        { data: '03/08/2026', diaSemana: 'Seg', tipo: 'trabalho' },
        { data: '04/08/2026', diaSemana: 'Ter', tipo: 'trabalho' },
        { data: '08/08/2026', diaSemana: 'Sab', tipo: 'trabalho' },
        { data: '09/08/2026', diaSemana: 'Dom', tipo: 'folga' },
    ];
    const resultado = calcularDiasReduzidosVA(dias, jornada);
    assert.strictEqual(resultado.total, 1);
    assert.deepStrictEqual(resultado.dias, ['08/08/2026']);
});

teste('calcularDiasReduzidosVA: sábado sempre extra não entra na contagem mesmo sendo dia de trabalho', () => {
    const jornada = { jornadaDiaria: '08:00', sabadoSempreExtra: true };
    const dias = [
        { data: '08/08/2026', diaSemana: 'Sab', tipo: 'trabalho' },
    ];
    const resultado = calcularDiasReduzidosVA(dias, jornada);
    assert.strictEqual(resultado.total, 0);
    assert.deepStrictEqual(resultado.dias, []);
});

teste('calcularDiasReduzidosVA: lista vazia retorna total zero', () => {
    const resultado = calcularDiasReduzidosVA([], { jornadaDiaria: '08:00' });
    assert.strictEqual(resultado.total, 0);
    assert.deepStrictEqual(resultado.dias, []);
});

teste('calcularDiasReduzidosVA: não conta um dia que já foi descontado por falta/atestado (evita dupla dedução do VA)', () => {
    const jornada = { jornadaDiaria: '08:00', jornadaSabadoAtiva: true, jornadaSabado: '04:00' };
    const dias = [
        { data: '01/08/2026', diaSemana: 'Sab', tipo: 'trabalho' },
        { data: '08/08/2026', diaSemana: 'Sab', tipo: 'trabalho' },
    ];
    const resultado = calcularDiasReduzidosVA(dias, jornada, ['01/08/2026']);
    assert.strictEqual(resultado.total, 1);
    assert.deepStrictEqual(resultado.dias, ['08/08/2026']);
});

console.log(`\n${testesExecutados} teste(s) executado(s) com sucesso.`);
