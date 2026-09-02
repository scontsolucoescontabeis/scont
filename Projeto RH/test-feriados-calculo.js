const assert = require('node:assert');
const {
    calcularDomingoPascoa,
    resolverDataMovel,
    REGRAS_MOVEIS,
    expandirFeriados,
    feriadosDaEmpresa,
    _norm,
} = require('./feriados-calculo.js');

let testesExecutados = 0;
function teste(nome, fn) {
    fn();
    testesExecutados++;
    console.log(`OK  ${nome}`);
}

function iso(dateUTC) {
    return `${dateUTC.getUTCFullYear()}-${String(dateUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(dateUTC.getUTCDate()).padStart(2, '0')}`;
}

// ===== Páscoa =====

teste('calcularDomingoPascoa: anos conhecidos', () => {
    assert.strictEqual(iso(calcularDomingoPascoa(2024)), '2024-03-31');
    assert.strictEqual(iso(calcularDomingoPascoa(2025)), '2025-04-20');
    assert.strictEqual(iso(calcularDomingoPascoa(2026)), '2026-04-05');
    assert.strictEqual(iso(calcularDomingoPascoa(2027)), '2027-03-28');
});

// ===== feriados móveis =====

teste('resolverDataMovel: 2026 (Páscoa 05/04)', () => {
    assert.strictEqual(resolverDataMovel('sexta_santa', 2026), '03/04/2026');
    assert.strictEqual(resolverDataMovel('carnaval_segunda', 2026), '16/02/2026');
    assert.strictEqual(resolverDataMovel('carnaval_terca', 2026), '17/02/2026');
    assert.strictEqual(resolverDataMovel('quarta_cinzas', 2026), '18/02/2026');
    assert.strictEqual(resolverDataMovel('corpus_christi', 2026), '04/06/2026');
});

teste('resolverDataMovel: 2025 (Páscoa 20/04)', () => {
    assert.strictEqual(resolverDataMovel('sexta_santa', 2025), '18/04/2025');
    assert.strictEqual(resolverDataMovel('carnaval_terca', 2025), '04/03/2025');
    assert.strictEqual(resolverDataMovel('corpus_christi', 2025), '19/06/2025');
});

teste('resolverDataMovel: regra desconhecida retorna null', () => {
    assert.strictEqual(resolverDataMovel('inexistente', 2026), null);
});

teste('REGRAS_MOVEIS tem as 5 chaves esperadas', () => {
    assert.deepStrictEqual(
        Object.keys(REGRAS_MOVEIS).sort(),
        ['carnaval_segunda', 'carnaval_terca', 'corpus_christi', 'quarta_cinzas', 'sexta_santa'].sort()
    );
});

// ===== expandirFeriados =====

teste('expandirFeriados: resolve móvel e recorrente para o ano pedido', () => {
    const rows = [
        { id: '1', descricao: 'Natal', data: '25/12', abrangencia: 'nacional', tipo: 'feriado', ativo: true },
        { id: '2', descricao: 'Sexta-feira Santa', regra_movel: 'sexta_santa', abrangencia: 'nacional', tipo: 'feriado', ativo: true },
        { id: '3', descricao: 'Data única', data: '10/06/2027', abrangencia: 'nacional', tipo: 'feriado', ativo: true },
    ];
    const exp = expandirFeriados(rows, 2026);
    assert.strictEqual(exp.length, 3);
    assert.strictEqual(exp.find(f => f.id === '1').data, '25/12/2026');
    assert.strictEqual(exp.find(f => f.id === '3').data, '10/06/2027');
    const santa = exp.find(f => f.id === '2');
    assert.strictEqual(santa.data, '03/04/2026');
    assert.strictEqual(santa.movel, true);
});

teste('expandirFeriados: descarta inativos', () => {
    const rows = [
        { id: '1', descricao: 'A', data: '25/12', ativo: true },
        { id: '2', descricao: 'B', data: '01/01', ativo: false },
    ];
    const exp = expandirFeriados(rows, 2026);
    assert.strictEqual(exp.length, 1);
    assert.strictEqual(exp[0].id, '1');
});

teste('expandirFeriados: default de tipo e abrangencia', () => {
    const exp = expandirFeriados([{ id: '1', descricao: 'X', data: '25/12' }], 2026);
    assert.strictEqual(exp[0].tipo, 'feriado');
    assert.strictEqual(exp[0].abrangencia, 'nacional');
});

teste('expandirFeriados: móvel com regra inválida é descartado (sem data)', () => {
    const exp = expandirFeriados([{ id: '1', descricao: 'X', regra_movel: 'xpto', ativo: true }], 2026);
    assert.strictEqual(exp.length, 0);
});

// ===== feriadosDaEmpresa =====

const base = [
    { id: 'n', descricao: 'Natal', data: '25/12', abrangencia: 'nacional', tipo: 'feriado' },
    { id: 'sp', descricao: 'Revolução Constitucionalista', data: '09/07', abrangencia: 'estadual', uf: 'SP', tipo: 'feriado' },
    { id: 'rj', descricao: 'São Jorge', data: '23/04', abrangencia: 'estadual', uf: 'RJ', tipo: 'feriado' },
    { id: 'santos', descricao: 'Aniversário de Santos', data: '26/01', abrangencia: 'municipal', uf: 'SP', municipio: 'Santos', tipo: 'feriado' },
];

teste('feriadosDaEmpresa: nacional sempre entra', () => {
    const r = feriadosDaEmpresa(base, { uf: 'MG', municipio: 'Uberlândia' });
    assert.deepStrictEqual(r.map(f => f.id), ['n']);
});

teste('feriadosDaEmpresa: estadual casa por UF', () => {
    const r = feriadosDaEmpresa(base, { uf: 'SP', municipio: 'Campinas' });
    assert.deepStrictEqual(r.map(f => f.id).sort(), ['n', 'sp']);
});

teste('feriadosDaEmpresa: municipal exige UF + município (normalizado)', () => {
    const r = feriadosDaEmpresa(base, { uf: 'sp', municipio: 'SANTOS' });
    assert.deepStrictEqual(r.map(f => f.id).sort(), ['n', 'santos', 'sp']);
});

teste('feriadosDaEmpresa: usa cidade como fallback de município', () => {
    const r = feriadosDaEmpresa(base, { uf: 'SP', cidade: 'Santos' });
    assert.ok(r.some(f => f.id === 'santos'));
});

teste('feriadosDaEmpresa: não vaza feriado de outra UF', () => {
    const r = feriadosDaEmpresa(base, { uf: 'RJ', municipio: 'Niterói' });
    assert.deepStrictEqual(r.map(f => f.id).sort(), ['n', 'rj']);
});

teste('feriadosDaEmpresa: empresa sem UF só pega nacional', () => {
    const r = feriadosDaEmpresa(base, {});
    assert.deepStrictEqual(r.map(f => f.id), ['n']);
});

// ===== _norm =====

teste('_norm: maiúsculas, trim, sem acento', () => {
    assert.strictEqual(_norm('  São paulo '), 'SAO PAULO');
    assert.strictEqual(_norm('Uberlândia'), 'UBERLANDIA');
    assert.strictEqual(_norm(null), '');
});

console.log(`\n${testesExecutados} teste(s) executado(s) com sucesso.`);
