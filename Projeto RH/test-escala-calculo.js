const assert = require('node:assert');
const {
    _brParaIso, _diasEntreIso, _gerarDiasDoMes,
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
