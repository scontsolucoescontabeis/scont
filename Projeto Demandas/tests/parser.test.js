// Projeto Demandas/tests/parser.test.js — rodar: node "Projeto Demandas/tests/parser.test.js"
const assert = require('node:assert');
const P = require('../js/parser.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log(`OK  ${nome}`); }

const CAB = ['ID da conversa', 'Cliente', 'Solicitante', 'Data da demanda inicial', 'Demanda inicial', 'Área', 'Tipo',
    'Prioridade', 'Status', 'Responsável SCONT', 'Prazo', 'Observação do prazo', 'Próxima ação', 'Último movimento', 'E-mail (link)'];
function linha(o = {}) {
    const base = {
        'ID da conversa': 'abc123', Cliente: 'Conectando Pessoas', Solicitante: 'Miriam', 'Data da demanda inicial': '03/11/2026 12:10',
        'Demanda inicial': 'Férias coletivas', 'Área': 'DP', Tipo: 'Férias', Prioridade: 'Alta', Status: 'Aguardando SCONT',
        'Responsável SCONT': 'Thayane', Prazo: '13/11/2026', 'Observação do prazo': 'prometido', 'Próxima ação': 'Enviar opções',
        'Último movimento': '09/11/2026 11:35', 'E-mail (link)': 'https://mail.google.com/mail/u/0/#all/abc123',
    };
    const m = { ...base, ...o };
    return CAB.map(c => m[c]);
}

// ===== datas =====
teste('lerData: dd/mm/aaaa hh:mm vira ISO de Brasília', () => {
    assert.deepStrictEqual(P.lerData('03/11/2026 12:10', { comHora: true }), { ok: true, valor: '2026-11-03T12:10:00-03:00' });
});
teste('lerData: "n/d", vazio e null viram null válido', () => {
    for (const v of ['n/d', 'N/D', '', '  ', null, undefined]) assert.deepStrictEqual(P.lerData(v, { comHora: true }), { ok: true, valor: null });
});
teste('lerData: serial do Excel (2026-11-03 12:10)', () => {
    // 46329 = 2026-11-03; 12:10 = 0.5069444...
    const r = P.lerData(46329 + (12 * 60 + 10) / 1440, { comHora: true });
    assert.deepStrictEqual(r, { ok: true, valor: '2026-11-03T12:10:00-03:00' });
});
teste('lerData: prazo só data', () => {
    assert.deepStrictEqual(P.lerData('13/11/2026', { comHora: false }), { ok: true, valor: '2026-11-13' });
    assert.deepStrictEqual(P.lerData('2026-11-13 00:00:00', { comHora: false }), { ok: true, valor: '2026-11-13' });
});
teste('lerData: Date nativo (hora local)', () => {
    assert.deepStrictEqual(P.lerData(new Date(2026, 10, 3, 12, 10), { comHora: true }), { ok: true, valor: '2026-11-03T12:10:00-03:00' });
});
teste('lerData: inválidas (31/02, mês 13, hora 25, texto)', () => {
    for (const v of ['31/02/2026', '10/13/2026', '03/11/2026 25:00', 'amanhã', new Date('x')]) assert.strictEqual(P.lerData(v, { comHora: true }).ok, false, String(v));
});

// ===== listas =====
teste('lerLista ignora caixa/acento e normaliza o traço de "DP – eSocial"', () => {
    assert.strictEqual(P.lerLista('dp - esocial', P.AREAS), 'DP – eSocial');
    assert.strictEqual(P.lerLista('media', P.PRIORIDADES), 'Média');
    assert.strictEqual(P.lerLista('concluida', P.STATUS), 'Concluída');
    assert.strictEqual(P.lerLista('Urgente', P.PRIORIDADES), undefined);
    assert.strictEqual(P.lerLista('', P.PRIORIDADES), null);
});

// ===== aba Demandas =====
teste('parseDemandas: linha válida', () => {
    const r = P.parseDemandas([CAB, linha()]);
    assert.strictEqual(r.bloqueio, null);
    assert.strictEqual(r.erros.length, 0);
    assert.strictEqual(r.demandas.length, 1);
    const d = r.demandas[0];
    assert.strictEqual(d.gmail_thread_id, 'abc123');
    assert.strictEqual(d.aberta_em, '2026-11-03T12:10:00-03:00');
    assert.strictEqual(d.prazo, '2026-11-13');
    assert.strictEqual(d.status, 'Aguardando SCONT');
});
teste('parseDemandas: lê por NOME de coluna, não por posição (colunas embaralhadas + título acima)', () => {
    const emb = [...CAB].reverse();
    const v = linha().reverse();
    const r = P.parseDemandas([['Controle de Demandas'], [], emb, v]);
    assert.strictEqual(r.erros.length, 0);
    assert.strictEqual(r.demandas[0].cliente, 'Conectando Pessoas');
    assert.strictEqual(r.demandas[0].status, 'Aguardando SCONT');
});
teste('parseDemandas: "n/d" em data e prazo vira null sem erro', () => {
    const r = P.parseDemandas([CAB, linha({ 'Data da demanda inicial': 'n/d', Prazo: 'n/d' })]);
    assert.strictEqual(r.erros.length, 0);
    assert.strictEqual(r.demandas[0].aberta_em, null);
    assert.strictEqual(r.demandas[0].prazo, null);
});
teste('parseDemandas: coluna obrigatória ausente bloqueia o arquivo', () => {
    const semId = CAB.filter(c => c !== 'ID da conversa');
    const r = P.parseDemandas([semId, ['Cliente X', 'x']]);
    assert.ok(r.bloqueio && r.bloqueio.includes('ID da conversa'));
    assert.strictEqual(r.demandas.length, 0);
});
teste('parseDemandas: coluna opcional ausente só gera aviso', () => {
    const cab = CAB.filter(c => c !== 'Tipo');
    const l = linha(); l.splice(CAB.indexOf('Tipo'), 1);
    const r = P.parseDemandas([cab, l]);
    assert.strictEqual(r.bloqueio, null);
    assert.strictEqual(r.demandas.length, 1);
    assert.ok(r.avisos.some(a => a.includes('Tipo')));
});
teste('parseDemandas: erros por linha não bloqueiam as válidas', () => {
    const r = P.parseDemandas([CAB,
        linha({ 'ID da conversa': 'ok1' }),
        linha({ 'ID da conversa': 'ruim1', Status: 'Pendente' }),
        linha({ 'ID da conversa': 'ruim2', Prioridade: 'Urgente' }),
        linha({ 'ID da conversa': 'ruim3', Prazo: '32/13/2026' }),
        linha({ 'ID da conversa': '' }),
        linha({ 'ID da conversa': 'ok2', Prioridade: '', 'Área': '' }),
    ]);
    assert.deepStrictEqual(r.demandas.map(d => d.gmail_thread_id), ['ok1', 'ok2']);
    assert.strictEqual(r.erros.length, 4);
    assert.deepStrictEqual(r.erros.map(e => e.linha), [3, 4, 5, 6]);
    assert.ok(r.erros[0].mensagem.includes('Status fora da lista'));
    assert.ok(r.erros[1].mensagem.includes('Prioridade fora da lista'));
    assert.ok(r.erros[2].mensagem.includes('Prazo inválido'));
    assert.ok(r.erros[3].mensagem.includes('ID da conversa vazio'));
});
teste('parseDemandas: ID duplicado na planilha vira erro na segunda ocorrência', () => {
    const r = P.parseDemandas([CAB, linha(), linha()]);
    assert.strictEqual(r.demandas.length, 1);
    assert.strictEqual(r.erros.length, 1);
    assert.ok(r.erros[0].mensagem.includes('duplicado'));
});
teste('parseDemandas: link genérico do Gmail é trocado por link direto da conversa', () => {
    const r = P.parseDemandas([CAB, linha({ 'E-mail (link)': 'Abrir' }), linha({ 'ID da conversa': 'x2', 'E-mail (link)': 'https://mail.google.com/mail/?authuser=a@b.com' })]);
    assert.strictEqual(r.demandas[0].link_email, 'https://mail.google.com/mail/u/0/#all/abc123');
    assert.strictEqual(r.demandas[1].link_email, 'https://mail.google.com/mail/u/0/#all/x2');
});
teste('parseDemandas: aba vazia e linhas em branco', () => {
    assert.ok(P.parseDemandas([]).bloqueio);
    const r = P.parseDemandas([CAB, [], linha(), [null, '', null]]);
    assert.strictEqual(r.demandas.length, 1);
    assert.strictEqual(r.erros.length, 0);
});

// ===== aba Tratativas =====
const CABT = ['ID da conversa', 'Data/hora', 'Autor', 'Tratativa adotada'];
teste('parseTratativas: válidas e inválidas', () => {
    const r = P.parseTratativas([CABT,
        ['abc123', '03/11/2026 12:10', 'Cliente', 'Perguntou sobre férias coletivas'],
        ['abc123', '04/11/2026 09:00', 'SCONT', 'Prometeu retorno'],
        ['abc123', '04/11/2026', 'SCONT', 'sem hora'],
        ['abc123', '04/11/2026 09:00', 'Fulano', 'autor inválido'],
        ['abc123', 'n/d', 'SCONT', 'sem data'],
        ['abc123', '04/11/2026 09:00', 'SCONT', ''],
    ]);
    assert.strictEqual(r.tratativas.length, 2);
    assert.strictEqual(r.tratativas[0].ocorrida_em, '2026-11-03T12:10:00-03:00');
    assert.strictEqual(r.erros.length, 4);
});
teste('parseTratativas: coluna ausente bloqueia', () => {
    assert.ok(P.parseTratativas([['ID da conversa', 'Data/hora'], ['a', 'b']]).bloqueio);
});
teste('chaveTratativa: mesmo instante em fusos diferentes e caixa/espaços iguais geram a mesma chave', () => {
    assert.strictEqual(
        P.chaveTratativa('2026-11-03T12:10:00-03:00', '  Prometeu Retorno '),
        P.chaveTratativa('2026-11-03T15:10:00+00:00', 'prometeu retorno'));
});

console.log(`\n${n} testes passaram.`);
