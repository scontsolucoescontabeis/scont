const assert = require('node:assert');
const {
    _brParaIso, _diasEntreIso, _gerarDiasDoMes, _dataEmPeriodo,
    calcularTipoDiaFixa, calcularTipoDiaVariavelDatas, calcularTipoDiaVariavelPadrao,
    calcularTipoDiaPadrao5x2, calcularTipoDia, calcularResumoMes, validarConfigEscala
} = require('./escala-calculo.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// ===== helpers =====

teste('_brParaIso converte DD/MM/AAAA para AAAA-MM-DD', () => {
    assert.strictEqual(_brParaIso('16/07/2026'), '2026-07-16');
});

teste('_diasEntreIso calcula diferença em dias corridos (positiva e negativa)', () => {
    assert.strictEqual(_diasEntreIso('2026-07-01', '2026-07-05'), 4);
    assert.strictEqual(_diasEntreIso('2026-07-05', '2026-07-01'), -4);
    assert.strictEqual(_diasEntreIso('2026-07-01', '2026-07-01'), 0);
});

teste('_gerarDiasDoMes gera todos os dias do mês com dia da semana correto', () => {
    const dias = _gerarDiasDoMes('07/2026'); // julho/2026 tem 31 dias, começa numa quarta
    assert.strictEqual(dias.length, 31);
    assert.strictEqual(dias[0].data, '01/07/2026');
    assert.strictEqual(dias[0].diaSemana, 'Qua');
    assert.strictEqual(dias[30].data, '31/07/2026');
});

// ===== escala fixa =====

teste('calcularTipoDiaFixa: dia presente na lista é trabalho, ausente é folga', () => {
    const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
    assert.strictEqual(calcularTipoDiaFixa(diasSemana, 'quarta'), 'trabalho');
    assert.strictEqual(calcularTipoDiaFixa(diasSemana, 'sabado'), 'folga');
});

teste('calcularTipoDiaFixa: dias úteis + sábado', () => {
    const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    assert.strictEqual(calcularTipoDiaFixa(diasSemana, 'sabado'), 'trabalho');
    assert.strictEqual(calcularTipoDiaFixa(diasSemana, 'domingo'), 'folga');
});

// ===== escala variável por datas de folga =====

teste('calcularTipoDiaVariavelDatas: trabalha todo dia exceto os marcados como folga', () => {
    const datasFolga = ['2026-07-10', '2026-07-20'];
    assert.strictEqual(calcularTipoDiaVariavelDatas(datasFolga, '2026-07-10'), 'folga');
    assert.strictEqual(calcularTipoDiaVariavelDatas(datasFolga, '2026-07-11'), 'trabalho');
});

teste('calcularTipoDiaVariavelDatas: lista vazia = trabalha todo dia', () => {
    assert.strictEqual(calcularTipoDiaVariavelDatas([], '2026-07-11'), 'trabalho');
    assert.strictEqual(calcularTipoDiaVariavelDatas(null, '2026-07-11'), 'trabalho');
});

// ===== escala variável por padrão de repetição (blocos) =====

teste('calcularTipoDiaVariavelPadrao: ciclo simples 5 trabalho / 1 folga', () => {
    const blocos = [{ tipo: 'trabalho', dias: 5 }, { tipo: 'folga', dias: 1 }];
    const ancora = '2026-07-01'; // dia 1 = início do bloco de trabalho
    assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, '2026-07-01'), 'trabalho');
    assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, '2026-07-05'), 'trabalho');
    assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, '2026-07-06'), 'folga');
    assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, '2026-07-07'), 'trabalho'); // reinicia o ciclo
});

teste('calcularTipoDiaVariavelPadrao: ciclo com múltiplos blocos (5x1, 2x2, 3x1)', () => {
    // ciclo de 14 dias: trabalha 5, folga 1, trabalha 2, folga 2, trabalha 3, folga 1
    const blocos = [
        { tipo: 'trabalho', dias: 5 }, { tipo: 'folga', dias: 1 },
        { tipo: 'trabalho', dias: 2 }, { tipo: 'folga', dias: 2 },
        { tipo: 'trabalho', dias: 3 }, { tipo: 'folga', dias: 1 }
    ];
    const ancora = '2026-07-01';
    const esperado = ['trabalho', 'trabalho', 'trabalho', 'trabalho', 'trabalho', 'folga',
        'trabalho', 'trabalho', 'folga', 'folga', 'trabalho', 'trabalho', 'trabalho', 'folga'];
    for (let i = 0; i < 14; i++) {
        const data = new Date(Date.UTC(2026, 6, 1 + i));
        const iso = data.toISOString().substring(0, 10);
        assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, iso), esperado[i], `dia ${i} (${iso})`);
    }
    // dia 14 (índice 14) reinicia o ciclo em trabalho
    const dia14 = new Date(Date.UTC(2026, 6, 15)).toISOString().substring(0, 10);
    assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, dia14), 'trabalho');
});

teste('calcularTipoDiaVariavelPadrao: funciona para datas anteriores à âncora', () => {
    const blocos = [{ tipo: 'trabalho', dias: 5 }, { tipo: 'folga', dias: 1 }];
    const ancora = '2026-07-07'; // início de um bloco de trabalho
    // 1 dia antes da âncora deve ser o último dia do ciclo anterior (folga)
    assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, '2026-07-06'), 'folga');
    assert.strictEqual(calcularTipoDiaVariavelPadrao(ancora, blocos, '2026-07-01'), 'trabalho');
});

teste('calcularTipoDiaVariavelPadrao: sem blocos ou âncora retorna trabalho (sem quebrar)', () => {
    assert.strictEqual(calcularTipoDiaVariavelPadrao(null, [], '2026-07-01'), 'trabalho');
    assert.strictEqual(calcularTipoDiaVariavelPadrao('2026-07-01', null, '2026-07-01'), 'trabalho');
});

// ===== padrão 5x2 (sem escala configurada) =====

teste('calcularTipoDiaPadrao5x2: segunda a sexta trabalho, sábado/domingo folga', () => {
    assert.strictEqual(calcularTipoDiaPadrao5x2('segunda'), 'trabalho');
    assert.strictEqual(calcularTipoDiaPadrao5x2('sexta'), 'trabalho');
    assert.strictEqual(calcularTipoDiaPadrao5x2('sabado'), 'folga');
    assert.strictEqual(calcularTipoDiaPadrao5x2('domingo'), 'folga');
});

// ===== dispatcher calcularTipoDia =====

teste('calcularTipoDia: escala null aplica padrão 5x2', () => {
    assert.strictEqual(calcularTipoDia(null, '11/07/2026', 'Sab'), 'folga'); // sábado
    assert.strictEqual(calcularTipoDia(null, '13/07/2026', 'Seg'), 'trabalho'); // segunda
});

teste('calcularTipoDia: despacha corretamente para cada tipo_escala', () => {
    const escalaFixa = { tipo_escala: 'fixa', dias_semana: ['sabado', 'domingo'] };
    assert.strictEqual(calcularTipoDia(escalaFixa, '11/07/2026', 'Sab'), 'trabalho');

    const escalaDatas = { tipo_escala: 'variavel_datas', datas_folga: ['2026-07-11'] };
    assert.strictEqual(calcularTipoDia(escalaDatas, '11/07/2026', 'Sab'), 'folga');

    const escalaPadrao = { tipo_escala: 'variavel_padrao', padrao_ancora: '2026-07-01', padrao_blocos: [{ tipo: 'trabalho', dias: 6 }, { tipo: 'folga', dias: 1 }] };
    assert.strictEqual(calcularTipoDia(escalaPadrao, '07/07/2026', 'Ter'), 'folga');
});

// ===== calcularResumoMes =====

teste('calcularResumoMes: totaliza corretamente uma escala fixa em julho/2026', () => {
    const escala = { tipo_escala: 'fixa', dias_semana: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] };
    const resumo = calcularResumoMes(escala, '07/2026');
    assert.strictEqual(resumo.totalDias, 31);
    assert.strictEqual(resumo.totalTrabalho + resumo.totalFolga, 31);
    assert.strictEqual(resumo.dias.length, 31);
    // conferência manual: julho/2026 tem 5 sábados+domingos completos... valida só consistência de soma
    const contagemTrabalho = resumo.dias.filter(d => d.tipo === 'trabalho').length;
    assert.strictEqual(contagemTrabalho, resumo.totalTrabalho);
});

teste('calcularResumoMes: sem escala (null) usa padrão 5x2', () => {
    const resumo = calcularResumoMes(null, '07/2026');
    const domingosSabados = resumo.dias.filter(d => d.diaSemana === 'Dom' || d.diaSemana === 'Sab').length;
    assert.strictEqual(resumo.totalFolga, domingosSabados);
});

// ===== férias sobrepondo a escala =====

teste('_dataEmPeriodo: identifica data dentro/fora de períodos', () => {
    const periodos = [{ inicio: '2026-07-10', fim: '2026-07-20' }];
    assert.strictEqual(_dataEmPeriodo('2026-07-15', periodos), true);
    assert.strictEqual(_dataEmPeriodo('2026-07-10', periodos), true); // borda inicial
    assert.strictEqual(_dataEmPeriodo('2026-07-20', periodos), true); // borda final
    assert.strictEqual(_dataEmPeriodo('2026-07-21', periodos), false);
});

teste('calcularResumoMes: dias em período de férias sempre viram folga, mesmo em dia de trabalho da escala', () => {
    const escalaFixa = { tipo_escala: 'fixa', dias_semana: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] };
    const periodos = [{ inicio: '2026-07-13', fim: '2026-07-17' }]; // segunda a sexta, dias de trabalho na escala
    const resumo = calcularResumoMes(escalaFixa, '07/2026', periodos);

    const diasFerias = resumo.dias.filter(d => ['13/07/2026', '14/07/2026', '15/07/2026', '16/07/2026', '17/07/2026'].includes(d.data));
    assert.strictEqual(diasFerias.length, 5);
    diasFerias.forEach(d => {
        assert.strictEqual(d.tipo, 'folga');
        assert.strictEqual(d.ferias, true);
    });
    assert.strictEqual(resumo.totalFerias, 5);

    // sem férias, esses 5 dias úteis contariam como trabalho — confirma que a férias realmente reduziu o total
    const resumoSemFerias = calcularResumoMes(escalaFixa, '07/2026');
    assert.strictEqual(resumoSemFerias.totalTrabalho - resumo.totalTrabalho, 5);
});

teste('calcularResumoMes: sem períodos de férias, totalFerias é 0 e nada muda', () => {
    const resumo = calcularResumoMes(null, '07/2026', []);
    assert.strictEqual(resumo.totalFerias, 0);
});

// ===== período de apuração customizado (diaInicio/diaFim) =====

teste('_gerarDiasDoMes: com diaInicio/diaFim válidos, apura de um mês a outro', () => {
    const dias = _gerarDiasDoMes('07/2026', 5, 5); // 05/06/2026 a 05/07/2026
    assert.strictEqual(dias[0].data, '05/06/2026');
    assert.strictEqual(dias.at(-1).data, '05/07/2026');
    assert.strictEqual(dias.length, 31); // junho tem 30 dias: 26 dias (05-30) + 5 dias de julho (01-05)
});

teste('_gerarDiasDoMes: diaInicio/diaFim ausentes mantém comportamento padrão (mês calendário)', () => {
    const dias = _gerarDiasDoMes('07/2026');
    assert.strictEqual(dias.length, 31);
    assert.strictEqual(dias[0].data, '01/07/2026');
});

teste('_gerarDiasDoMes: diaInicio (mês anterior) maior que diaFim (mês da competência) é um intervalo curto válido, não inverte', () => {
    // início=20 (junho) é cronologicamente anterior a fim=5 (julho), mesmo com 20 > 5 como número de dia
    const dias = _gerarDiasDoMes('07/2026', 20, 5);
    assert.strictEqual(dias[0].data, '20/06/2026');
    assert.strictEqual(dias.at(-1).data, '05/07/2026');
    assert.strictEqual(dias.length, 16);
});

teste('_gerarDiasDoMes: valores fora de 1-31 ignoram o período customizado e usam o mês calendário', () => {
    const dias = _gerarDiasDoMes('07/2026', 0, 40);
    assert.strictEqual(dias.length, 31);
    assert.strictEqual(dias[0].data, '01/07/2026');
    assert.strictEqual(dias.at(-1).data, '31/07/2026');
});

teste('_gerarDiasDoMes: dia inexistente no mês usa o último dia real como fallback', () => {
    const dias = _gerarDiasDoMes('03/2026', 31, 31); // fevereiro/2026 tem 28 dias
    assert.strictEqual(dias[0].data, '28/02/2026');
});

teste('calcularResumoMes: com diaInicio/diaFim, totaliza sobre o intervalo customizado, não o mês calendário', () => {
    const escala = { tipo_escala: 'fixa', dias_semana: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] };
    const resumoCustom = calcularResumoMes(escala, '07/2026', null, 20, 5); // 20/06 a 05/07, 16 dias
    const resumoPadrao = calcularResumoMes(escala, '07/2026'); // mês calendário, 31 dias
    assert.strictEqual(resumoCustom.dias[0].data, '20/06/2026');
    assert.strictEqual(resumoCustom.dias.at(-1).data, '05/07/2026');
    assert.strictEqual(resumoCustom.totalDias, 16);
    assert.notStrictEqual(resumoCustom.totalDias, resumoPadrao.totalDias);
});

// ===== exceção de folga pontual (datasExcecaoFolga) =====

teste('calcularResumoMes: dia em datasExcecaoFolga vira folga mesmo em dia de trabalho da escala', () => {
    const escalaFixa = { tipo_escala: 'fixa', dias_semana: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] };
    const resumo = calcularResumoMes(escalaFixa, '07/2026', null, null, null, ['2026-07-15']); // quarta, dia de trabalho
    const dia = resumo.dias.find(d => d.data === '15/07/2026');
    assert.strictEqual(dia.tipo, 'folga');
    assert.strictEqual(dia.excecao, true);
    assert.strictEqual(dia.ferias, false);

    const resumoSemExcecao = calcularResumoMes(escalaFixa, '07/2026');
    assert.strictEqual(resumoSemExcecao.totalTrabalho - resumo.totalTrabalho, 1);
});

teste('calcularResumoMes: dias fora de datasExcecaoFolga não ganham o flag excecao', () => {
    const resumo = calcularResumoMes(null, '07/2026', null, null, null, ['2026-07-15']);
    const outroDia = resumo.dias.find(d => d.data === '16/07/2026');
    assert.strictEqual(outroDia.excecao, false);
});

teste('calcularResumoMes: férias tem prioridade sobre exceção (dia não fica marcado como excecao)', () => {
    const escalaFixa = { tipo_escala: 'fixa', dias_semana: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'] };
    const periodos = [{ inicio: '2026-07-15', fim: '2026-07-15' }];
    const resumo = calcularResumoMes(escalaFixa, '07/2026', periodos, null, null, ['2026-07-15']);
    const dia = resumo.dias.find(d => d.data === '15/07/2026');
    assert.strictEqual(dia.tipo, 'folga');
    assert.strictEqual(dia.ferias, true);
    assert.strictEqual(dia.excecao, false);
});

teste('calcularResumoMes: sem datasExcecaoFolga, nenhum dia fica marcado como excecao', () => {
    const resumo = calcularResumoMes(null, '07/2026');
    assert.strictEqual(resumo.dias.every(d => d.excecao === false), true);
});

// ===== validarConfigEscala =====

teste('validarConfigEscala: fixa sem dias selecionados é inválida', () => {
    const r = validarConfigEscala({ tipo_escala: 'fixa', dias_semana: [] });
    assert.strictEqual(r.ok, false);
});

teste('validarConfigEscala: fixa com ao menos 1 dia é válida', () => {
    const r = validarConfigEscala({ tipo_escala: 'fixa', dias_semana: ['segunda'] });
    assert.strictEqual(r.ok, true);
});

teste('validarConfigEscala: variavel_datas sempre válida, mesmo vazia', () => {
    const r = validarConfigEscala({ tipo_escala: 'variavel_datas', datas_folga: [] });
    assert.strictEqual(r.ok, true);
});

teste('validarConfigEscala: variavel_padrao exige âncora e blocos válidos', () => {
    assert.strictEqual(validarConfigEscala({ tipo_escala: 'variavel_padrao', padrao_blocos: [{ tipo: 'trabalho', dias: 5 }] }).ok, false); // sem âncora
    assert.strictEqual(validarConfigEscala({ tipo_escala: 'variavel_padrao', padrao_ancora: '2026-07-01', padrao_blocos: [] }).ok, false); // sem blocos
    assert.strictEqual(validarConfigEscala({ tipo_escala: 'variavel_padrao', padrao_ancora: '2026-07-01', padrao_blocos: [{ tipo: 'trabalho', dias: 0 }] }).ok, false); // bloco com 0 dias
    assert.strictEqual(validarConfigEscala({ tipo_escala: 'variavel_padrao', padrao_ancora: '2026-07-01', padrao_blocos: [{ tipo: 'trabalho', dias: 5 }, { tipo: 'folga', dias: 1 }] }).ok, true);
});

console.log(`\n${testesExecutados} teste(s) executado(s) com sucesso.`);
