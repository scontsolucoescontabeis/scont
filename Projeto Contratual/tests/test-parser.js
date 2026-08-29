const assert = require('node:assert');
const P = require('../js/parser.js');
const { carregarVias, fixturesDisponiveis } = require('./extrair-pdf-node.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log('OK  ' + nome); }

// ─── unidade ────────────────────────────────────────────────────────────

teste('limparRodape remove certificação repetida da Junta', () => {
    const t = P.limparRodape(
        'PRIMEIRA CLÁUSULA – SEDE\n' +
        'Junta Comercial, Industrial e Serviços do Distrito Federal\n' +
        'Certifico registro sob o nº 2067205 em 18/04/2023 da Empresa FH\n' +
        'pág. 3/9\n' +
        'A sociedade tem sua sede...'
    );
    assert.ok(!/Certifico registro/.test(t));
    assert.ok(!/pág\. 3\/9/.test(t));
    assert.ok(/PRIMEIRA CLÁUSULA/.test(t) && /A sociedade tem sua sede/.test(t));
});

teste('extrairBlocoConsolidacao pega o ÚLTIMO cabeçalho e corta nas assinaturas', () => {
    const texto = [
        'SEGUNDA CLÁUSULA - CONSOLIDAÇÃO CONTRATUAL',
        'passa a ter a seguinte redação:',
        'CONSOLIDAÇÃO CONTRATUAL',
        'PRIMEIRA CLÁUSULA – NOME EMPRESARIAL',
        'A sociedade gira sob o nome empresarial X LTDA.',
        'Brasília/DF, 15 de abril de 2025.',
        '_____________________',
    ].join('\n');
    const { bloco, achou } = P.extrairBlocoConsolidacao(texto);
    assert.strictEqual(achou, true);
    assert.ok(bloco.startsWith('PRIMEIRA CLÁUSULA'));
    assert.ok(!/Brasília\/DF, 15/.test(bloco));
});

teste('segmentarClausulas: ordinal por extenso e título vazio', () => {
    const bloco = [
        'PRIMEIRA CLÁUSULA – NOME EMPRESARIAL',
        'A sociedade gira sob X.',
        'DÉCIMA QUINTA CLÁUSULA',
        'Fica eleito o Foro de Brasília/DF.',
    ].join('\n');
    const cl = P.segmentarClausulas(bloco);
    assert.strictEqual(cl.length, 2);
    assert.strictEqual(cl[0].ordinal, 1);
    assert.strictEqual(cl[0].titulo, 'NOME EMPRESARIAL');
    assert.strictEqual(cl[1].ordinal, 15);
    assert.strictEqual(cl[1].titulo, '');
    assert.ok(/Fica eleito o Foro/.test(cl[1].corpo));
});

teste('normalizarTitulo: sinônimos e acento', () => {
    assert.strictEqual(P.normalizarTitulo('Fórum'), 'FORO');
    assert.strictEqual(P.normalizarTitulo('FORO'), 'FORO');
    assert.strictEqual(P.normalizarTitulo('Alteração de Endereço (Transferência de UF)'), 'SEDE');
    assert.strictEqual(P.normalizarTitulo('FILIAIS E OUTRAS DEPENDÊNCIAS'), 'FILIAIS');
    assert.strictEqual(P.normalizarTitulo(''), '');
});

// ─── integração com os 3 PDFs reais ────────────────────────────────────

let VIAS;
async function main() {
    if (!fixturesDisponiveis()) {
        console.log('\n⚠ PDFs de exemplo ausentes (não versionados) — pulando testes de integração.');
        console.log(`\n${n} testes OK (parser)`);
        return;
    }
    VIAS = await carregarVias();

    teste('PDF real: 1ª via → 15 cláusulas, sem avisos', () => {
        const r = P.analisarContrato(VIAS.v1);
        assert.deepStrictEqual(r.avisos, []);
        assert.strictEqual(r.clausulas.length, 15);
    });

    teste('PDF real: 2ª e 3ª vias → 15 cláusulas cada', () => {
        assert.strictEqual(P.analisarContrato(VIAS.v2).clausulas.length, 15);
        assert.strictEqual(P.analisarContrato(VIAS.v3).clausulas.length, 15);
    });

    teste('PDF real: capa da 3ª via', () => {
        const c = P.analisarContrato(VIAS.v3).capa;
        assert.strictEqual(c.cnpj, '48.639.533/0001-44');
        assert.strictEqual(c.razaoSocial, 'FH TECNOLOGIA LTDA');
        assert.strictEqual(c.nomeFantasia, 'DELTAAI');
        assert.strictEqual(c.numeroAlteracao, 3);
        assert.strictEqual(c.dataAto, '15/04/2025');
        assert.strictEqual(c.socios.length, 2);
        assert.strictEqual(c.socios[0].nome, 'PATRÍCIA CARVALHO DOS SANTOS');
        assert.strictEqual(c.socios[0].cpf, '022.234.281-18');
        assert.strictEqual(c.socios[1].cpf, '032.518.691-08');
    });

    teste('PDF real: nº da alteração difere entre as vias (1, 2, 3)', () => {
        assert.strictEqual(P.analisarContrato(VIAS.v1).capa.numeroAlteracao, 1);
        assert.strictEqual(P.analisarContrato(VIAS.v2).capa.numeroAlteracao, 2);
        assert.strictEqual(P.analisarContrato(VIAS.v3).capa.numeroAlteracao, 3);
    });

    teste('PDF real: renumeração 2ª→3ª (Pró-labore e Exercício trocam de posição)', () => {
        const c2 = P.analisarContrato(VIAS.v2).clausulas;
        const c3 = P.analisarContrato(VIAS.v3).clausulas;
        const pos = (cl, t) => cl.find(x => P.normalizarTitulo(x.titulo) === t).ordinal;
        assert.strictEqual(pos(c2, 'PRO LABORE'), 11);
        assert.strictEqual(pos(c2, 'EXERCICIO SOCIAL'), 12);
        assert.strictEqual(pos(c3, 'EXERCICIO SOCIAL'), 11);
        assert.strictEqual(pos(c3, 'PRO LABORE'), 12);
    });

    console.log(`\n${n} testes OK (parser)`);
}

main().catch(e => { console.error(e); process.exit(1); });
