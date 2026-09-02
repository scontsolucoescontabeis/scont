const assert = require('node:assert');
const {
    _DIA_ABREV_PARA_CHAVE, agruparJornadaPorDiaSemana,
    formatarHorarioJornadaDia, montarLinhasFolhaPonto, resumirJornadaSemana
} = require('./folha-ponto-calculo.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

teste('_DIA_ABREV_PARA_CHAVE mapeia todas as abreviações', () => {
    assert.strictEqual(_DIA_ABREV_PARA_CHAVE.Seg, 'segunda');
    assert.strictEqual(_DIA_ABREV_PARA_CHAVE.Sab, 'sabado');
    assert.strictEqual(_DIA_ABREV_PARA_CHAVE.Dom, 'domingo');
});

teste('agruparJornadaPorDiaSemana indexa registros pelo dia_semana', () => {
    const linhas = [
        { dia_semana: 'segunda', entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '17:00' },
        { dia_semana: 'sexta', entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', saida: '16:48' },
    ];
    const mapa = agruparJornadaPorDiaSemana(linhas);
    assert.strictEqual(mapa.segunda.saida, '17:00');
    assert.strictEqual(mapa.sexta.intervalo_fim, '13:00');
    assert.strictEqual(mapa.terca, undefined);
});

teste('agruparJornadaPorDiaSemana lida com lista vazia/nula', () => {
    assert.deepStrictEqual(agruparJornadaPorDiaSemana([]), {});
    assert.deepStrictEqual(agruparJornadaPorDiaSemana(null), {});
});

teste('formatarHorarioJornadaDia: sem registro retorna travessão', () => {
    assert.strictEqual(formatarHorarioJornadaDia(null), '—');
});

teste('formatarHorarioJornadaDia: sem intervalo', () => {
    assert.strictEqual(
        formatarHorarioJornadaDia({ entrada: '06:00', intervalo_inicio: null, intervalo_fim: null, saida: '15:48' }),
        '06:00-15:48'
    );
});

teste('formatarHorarioJornadaDia: com intervalo', () => {
    assert.strictEqual(
        formatarHorarioJornadaDia({ entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', saida: '17:48' }),
        '08:00-12:00 / 13:00-17:48'
    );
});

teste('montarLinhasFolhaPonto: dia de trabalho com jornada cadastrada mostra horário', () => {
    const dias = [{ data: '03/08/2026', diaSemana: 'Seg', tipo: 'trabalho', ferias: false, excecao: false }];
    const jornada = { segunda: { entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', saida: '17:48' } };
    const linhas = montarLinhasFolhaPonto(dias, jornada);
    assert.strictEqual(linhas[0].horarioPrevisto, '08:00-12:00 / 13:00-17:48');
    assert.strictEqual(linhas[0].data, '03/08/2026');
});

teste('montarLinhasFolhaPonto: dia de folga sempre travessão mesmo com jornada cadastrada naquele dia da semana', () => {
    const dias = [{ data: '08/08/2026', diaSemana: 'Sab', tipo: 'folga', ferias: false, excecao: false }];
    const jornada = { sabado: { entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '12:00' } };
    const linhas = montarLinhasFolhaPonto(dias, jornada);
    assert.strictEqual(linhas[0].horarioPrevisto, '—');
});

teste('montarLinhasFolhaPonto: dia de trabalho sem jornada cadastrada para aquele dia da semana', () => {
    const dias = [{ data: '04/08/2026', diaSemana: 'Ter', tipo: 'trabalho', ferias: false, excecao: false }];
    const linhas = montarLinhasFolhaPonto(dias, {});
    assert.strictEqual(linhas[0].horarioPrevisto, '—');
});

teste('montarLinhasFolhaPonto: preserva ferias e excecao no retorno', () => {
    const dias = [{ data: '10/08/2026', diaSemana: 'Seg', tipo: 'folga', ferias: true, excecao: false }];
    const linhas = montarLinhasFolhaPonto(dias, {});
    assert.strictEqual(linhas[0].ferias, true);
});

teste('montarLinhasFolhaPonto: feriado (folga) mostra travessão e propaga feriadoTipo/descrição', () => {
    const jornada = { segunda: { entrada: '08:00', saida: '17:00' } };
    const dias = [{ data: '09/07/2026', diaSemana: 'Seg', tipo: 'folga', ferias: false, excecao: false, feriado: true, feriadoTipo: 'feriado', feriadoDescricao: 'Revolução Constitucionalista' }];
    const linhas = montarLinhasFolhaPonto(dias, jornada);
    assert.strictEqual(linhas[0].horarioPrevisto, '—');
    assert.strictEqual(linhas[0].feriado, true);
    assert.strictEqual(linhas[0].feriadoTipo, 'feriado');
    assert.strictEqual(linhas[0].feriadoDescricao, 'Revolução Constitucionalista');
});

const _jorSegSex = { entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '13:00', saida: '17:48' };

teste('resumirJornadaSemana: Seg a Sex idêntico, sem sábado', () => {
    const jornada = { segunda: _jorSegSex, terca: _jorSegSex, quarta: _jorSegSex, quinta: _jorSegSex, sexta: _jorSegSex };
    assert.strictEqual(resumirJornadaSemana(jornada), 'Seg a Sex: 08:00-12:00 / 13:00-17:48');
});

teste('resumirJornadaSemana: sexta diferente vira grupo separado', () => {
    const sexCurta = { entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '13:00' };
    const jornada = { segunda: _jorSegSex, terca: _jorSegSex, quarta: _jorSegSex, quinta: _jorSegSex, sexta: sexCurta };
    assert.strictEqual(resumirJornadaSemana(jornada), 'Seg a Qui: 08:00-12:00 / 13:00-17:48 · Sex: 08:00-13:00');
});

teste('resumirJornadaSemana: Seg a Sex + sábado', () => {
    const sab = { entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '12:00' };
    const jornada = { segunda: _jorSegSex, terca: _jorSegSex, quarta: _jorSegSex, quinta: _jorSegSex, sexta: _jorSegSex, sabado: sab };
    assert.strictEqual(resumirJornadaSemana(jornada), 'Seg a Sex: 08:00-12:00 / 13:00-17:48 · Sáb: 08:00-12:00');
});

teste('resumirJornadaSemana: dia sem registro no meio quebra o agrupamento', () => {
    const jornada = { segunda: _jorSegSex, quarta: _jorSegSex, quinta: _jorSegSex, sexta: _jorSegSex };
    assert.strictEqual(resumirJornadaSemana(jornada), 'Seg: 08:00-12:00 / 13:00-17:48 · Qua a Sex: 08:00-12:00 / 13:00-17:48');
});

teste('resumirJornadaSemana: sem jornada cadastrada retorna string vazia', () => {
    assert.strictEqual(resumirJornadaSemana({}), '');
    assert.strictEqual(resumirJornadaSemana(null), '');
});

console.log(`\n${testesExecutados} teste(s) executado(s) com sucesso.`);
