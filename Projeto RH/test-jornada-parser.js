const assert = require('node:assert');
const {
    _agruparItensPorLinha,
    _extrairColunas,
    _normalizarDia,
    _parsearLinhasJornada
} = require('./jornada-parser.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

// Helper: converte { str, x, y } em item no formato do PDF.js (transform[4]=x, transform[5]=y)
function item(str, x, y) {
    return { str, transform: [1, 0, 0, 1, x, y] };
}

// ===== _normalizarDia =====

teste('_normalizarDia reconhece dias simples', () => {
    assert.deepStrictEqual(_normalizarDia('Segunda'), ['segunda']);
    assert.deepStrictEqual(_normalizarDia('Terça'), ['terca']);
    assert.deepStrictEqual(_normalizarDia('Sábado'), ['sabado']);
    assert.deepStrictEqual(_normalizarDia('Domingo'), ['domingo']);
});

teste('_normalizarDia expande a faixa "Segunda à sexta" em 5 dias', () => {
    assert.deepStrictEqual(_normalizarDia('Segunda à sexta'), ['segunda', 'terca', 'quarta', 'quinta', 'sexta']);
});

teste('_normalizarDia retorna null para texto não reconhecido', () => {
    assert.strictEqual(_normalizarDia('Feriado'), null);
});

// ===== _agruparItensPorLinha =====

teste('_agruparItensPorLinha agrupa por Y (dentro do limiar) e ordena por X', () => {
    const items = [
        item('18:00', 420.4, 742.1),
        item('08:00', 352.5, 742.1),
        item('Segunda', 289.6, 742.1),
        item('ANTONIO ALEXSANDRO MARQUES DA SILVA', 29.0, 742.1),
        item('5', 12.0, 742.1)
    ];
    const linhas = _agruparItensPorLinha(items);
    assert.strictEqual(linhas.length, 1);
    assert.deepStrictEqual(linhas[0].map(i => i.str), ['5', 'ANTONIO ALEXSANDRO MARQUES DA SILVA', 'Segunda', '08:00', '18:00']);
});

teste('_agruparItensPorLinha ignora itens em branco', () => {
    const items = [item('', 0, 100), item(' ', 15.2, 100), item('Sistema licenciado', 0, 100)];
    const linhas = _agruparItensPorLinha(items);
    assert.strictEqual(linhas.length, 1);
    assert.deepStrictEqual(linhas[0].map(i => i.str), ['Sistema licenciado']);
});

// ===== _parsearLinhasJornada: caso simples (sem intervalo, sem faixa) =====
// Dados reais extraídos via pdfjs-dist da página 1 do PDF de exemplo (empresa 2, empregados 5 e 6)

teste('_parsearLinhasJornada extrai empregado com jornada Segunda a Sexta sem intervalo', () => {
    const linhas = _agruparItensPorLinha([
        item('Empresa:', 0.0, 835.6),
        item('2-CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA', 54.5, 835.6),
        item('Página:', 478.3, 835.6),
        item('1/1', 557.0, 835.6),

        item('5', 12.0, 742.1),
        item('ANTONIO ALEXSANDRO MARQUES DA SILVA', 29.0, 742.1),
        item('01/07/2016', 132.3, 742.4),
        item('MECANICO 0002', 179.8, 742.1),
        item('00095545', 237.5, 742.1),
        item('00024', 268.9, 742.1),
        item('Segunda', 289.6, 742.1),
        item('08:00', 352.5, 742.1),
        item('18:00', 420.4, 742.1),

        item('Terça', 289.6, 733.3),
        item('08:00', 352.5, 733.3),
        item('18:00', 420.4, 733.3),

        item('Sexta', 289.6, 706.6),
        item('08:00', 352.5, 706.6),
        item('18:00', 420.4, 706.6),

        // Empregado 6 na sequência, nome+data grudados no mesmo item (sem espaço extra sobrando)
        item('6', 12.0, 697.2),
        item('KARINA LORRANE DE SOUSA PASSOS 01/07/2016', 29.0, 697.2),
        item('GERENTE', 179.8, 697.2),
        item('00089656', 237.5, 697.2),
        item('00032', 268.9, 697.2),
        item('Segunda', 289.6, 697.2),
        item('08:00', 352.5, 697.2),
        item('18:00', 420.4, 697.2)
    ]);

    const { registros, avisos } = _parsearLinhasJornada(linhas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 4);
    assert.deepStrictEqual(registros[0], {
        codigo_empresa: '2', nome_empresa: 'CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA',
        codigo_empregado: '5', nome_empregado: 'ANTONIO ALEXSANDRO MARQUES DA SILVA',
        dia_semana: 'segunda', entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '18:00'
    });
    assert.strictEqual(registros[1].dia_semana, 'terca');
    assert.strictEqual(registros[2].dia_semana, 'sexta');
    assert.deepStrictEqual(registros[3], {
        codigo_empresa: '2', nome_empresa: 'CENTRO AUTOMOTIVO E MECANICA PASSOS LTDA',
        codigo_empregado: '6', nome_empregado: 'KARINA LORRANE DE SOUSA PASSOS',
        dia_semana: 'segunda', entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '18:00'
    });
});

// ===== _parsearLinhasJornada: faixa "Segunda à sexta", intervalo e folga =====
// Dados reais extraídos via pdfjs-dist da página 10 (empresa 9)

teste('_parsearLinhasJornada extrai faixa Segunda à sexta com intervalo, e ignora dia marcado como Folga', () => {
    const linhas = _agruparItensPorLinha([
        item('Empresa:', 0.0, 835.6),
        item('9-BOUTIQUE AUTO: VENDA DE ACESSORIOS AUTOM', 54.5, 835.6),

        // Empregado 4: Segunda à sexta com intervalo (12:00 as 14:00)
        item('4', 12.0, 634.0),
        item('RENATO JOSE MENDES GONCALVES', 29.0, 634.0),
        item('19/06/2023', 132.3, 634.3),
        item('POLIDOR', 179.8, 634.0),
        item('44402', 247.2, 634.0),
        item('00033', 268.9, 634.0),
        item('Segunda à sexta', 289.6, 634.0),
        item('08:00', 352.5, 634.0),
        item('12:00 as 14:00', 374.7, 634.0),
        item('18:00', 420.4, 634.0),

        item('Sábado', 289.6, 625.1),
        item('08:00', 352.5, 625.1),
        item('12:00', 420.4, 625.1),

        // Empregado 20: nome longo grudado sem espaço com a data (SILVA01/07/2025)
        item('20', 12.0, 300.0),
        item('MARCIA PRISCILA MUNIZ DA SILVA01/07/2025', 29.0, 300.0),
        item('ATENDENTE', 179.8, 300.0),
        item('0114990', 237.5, 300.0),
        item('5140', 268.9, 300.0),
        item('Segunda à sexta', 289.6, 300.0),
        item('07:30', 352.5, 300.0),
        item('17:30', 420.4, 300.0),

        item('Sábado', 289.6, 291.1),
        item('08:00', 352.5, 291.1),
        item('12:00', 420.4, 291.1),

        item('Domingo', 289.6, 282.2),
        item('00:00', 352.5, 282.2),
        item('00:00', 420.4, 282.2),
        item('Folga', 441.1, 282.2)
    ]);

    const { registros, avisos } = _parsearLinhasJornada(linhas);
    assert.deepStrictEqual(avisos, []);

    const doEmpregado4 = registros.filter(r => r.codigo_empregado === '4');
    assert.strictEqual(doEmpregado4.length, 6); // seg-sex + sábado
    assert.deepStrictEqual(doEmpregado4[0], {
        codigo_empresa: '9', nome_empresa: 'BOUTIQUE AUTO: VENDA DE ACESSORIOS AUTOM',
        codigo_empregado: '4', nome_empregado: 'RENATO JOSE MENDES GONCALVES',
        dia_semana: 'segunda', entrada: '08:00', intervalo_inicio: '12:00', intervalo_fim: '14:00', saida: '18:00'
    });
    const sabadoEmpregado4 = doEmpregado4.find(r => r.dia_semana === 'sabado');
    assert.deepStrictEqual(sabadoEmpregado4, {
        codigo_empresa: '9', nome_empresa: 'BOUTIQUE AUTO: VENDA DE ACESSORIOS AUTOM',
        codigo_empregado: '4', nome_empregado: 'RENATO JOSE MENDES GONCALVES',
        dia_semana: 'sabado', entrada: '08:00', intervalo_inicio: null, intervalo_fim: null, saida: '12:00'
    });

    const doEmpregado20 = registros.filter(r => r.codigo_empregado === '20');
    assert.strictEqual(doEmpregado20[0].nome_empregado, 'MARCIA PRISCILA MUNIZ DA SILVA');
    // Segunda a sexta (5) + Sábado (1) = 6; Domingo com Folga não gera registro
    assert.strictEqual(doEmpregado20.length, 6);
    assert.ok(!doEmpregado20.some(r => r.dia_semana === 'domingo'));
});

// ===== avisos =====

teste('_parsearLinhasJornada reporta aviso quando linha de horário aparece antes de qualquer empresa', () => {
    const linhas = _agruparItensPorLinha([
        item('5', 12.0, 742.1),
        item('FULANO DE TAL', 29.0, 742.1),
        item('Segunda', 289.6, 742.1),
        item('08:00', 352.5, 742.1),
        item('18:00', 420.4, 742.1)
    ]);
    const { registros, avisos } = _parsearLinhasJornada(linhas);
    assert.strictEqual(registros.length, 0);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /antes de qualquer cabeçalho de empresa/);
});

teste('_parsearLinhasJornada reporta aviso quando dia da semana não é reconhecido', () => {
    const linhas = _agruparItensPorLinha([
        item('Empresa:', 0.0, 835.6),
        item('2-EMPRESA TESTE LTDA', 54.5, 835.6),
        item('5', 12.0, 742.1),
        item('FULANO DE TAL', 29.0, 742.1),
        item('Feriado', 289.6, 742.1),
        item('08:00', 352.5, 742.1),
        item('18:00', 420.4, 742.1)
    ]);
    const { registros, avisos } = _parsearLinhasJornada(linhas);
    assert.strictEqual(registros.length, 0);
    assert.strictEqual(avisos.length, 1);
    assert.match(avisos[0].motivo, /Dia da semana não reconhecido/);
});

teste('_parsearLinhasJornada ignora linhas de cabeçalho/rodapé (CNPJ, Empregador, Endereço, coluna, sistema)', () => {
    const linhas = _agruparItensPorLinha([
        item('Empresa:', 0.0, 835.6),
        item('2-EMPRESA TESTE LTDA', 54.5, 835.6),
        item('CNPJ:', 0.0, 827.3),
        item('10.912.505/0001-86', 54.5, 827.3),
        item('HORÁRIO DE TRABALHO', 246.1, 802.2),
        item('Empregador:', 0.0, 786.1),
        item('EMPRESA TESTE LTDA', 37.9, 786.1),
        item('Endereço:', 0.0, 777.8),
        item('RUA TESTE', 37.9, 777.8),
        item('Código', 0.0, 761.0),
        item('Nome', 29.0, 761.0),
        item('Dias da Semana', 291.4, 761.6),
        item('5', 12.0, 742.1),
        item('FULANO DE TAL', 29.0, 742.1),
        item('Segunda', 289.6, 742.1),
        item('08:00', 352.5, 742.1),
        item('18:00', 420.4, 742.1),
        item('Sistema licenciado para SCONT SOLUCOES CONTABEIS LTDA', 0.0, 50.0)
    ]);
    const { registros, avisos } = _parsearLinhasJornada(linhas);
    assert.deepStrictEqual(avisos, []);
    assert.strictEqual(registros.length, 1);
    assert.strictEqual(registros[0].nome_empregado, 'FULANO DE TAL');
});

console.log(`\n${testesExecutados} teste(s) passaram.`);
