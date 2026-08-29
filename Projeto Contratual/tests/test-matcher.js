const assert = require('node:assert');
const P = require('../js/parser.js');
const M = require('../js/matcher.js');
const { carregarVias, fixturesDisponiveis } = require('./extrair-pdf-node.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log('OK  ' + nome); }

const cl = (ordinal, titulo, corpo) => ({ ordinal, titulo, corpo, textoCompleto: titulo + '. ' + corpo });

// ─── unidade ────────────────────────────────────────────────────────────

teste('cláusula só na nova → nova; só na antiga → suprimida', () => {
    const ant = [cl(1, 'SEDE', 'rua A, 1')];
    const nova = [cl(1, 'SEDE', 'rua A, 1'), cl(2, 'FILIAL', 'abre filial em SP')];
    const { linhas, resumo } = M.comparar(ant, nova);
    assert.strictEqual(resumo.novas, 1);
    assert.strictEqual(resumo.suprimidas, 0);
    assert.strictEqual(linhas.find(l => l.classificacao === 'nova').titulo, 'FILIAL');

    const r2 = M.comparar(nova, ant);
    assert.strictEqual(r2.resumo.suprimidas, 1);
});

teste('mudança só de pontuação NÃO conta como alterada', () => {
    const ant = [cl(2, 'SEDE', 'Rua Pedro Palácios 104 – Centro – Vitória/ES – CEP: 29.015-160.')];
    const nova = [cl(2, 'SEDE', 'Rua Pedro Palácios 104, Centro, Vitória/ES, CEP 29.015-160.')];
    const { resumo } = M.comparar(ant, nova);
    assert.strictEqual(resumo.iguais, 1);
    assert.strictEqual(resumo.alteradas, 0);
});

teste('casa por conteúdo quando o título some (Fórum → título vazio)', () => {
    const ant = [cl(15, 'FÓRUM', 'Fica eleito o Fórum de Brasília/DF para o cumprimento das obrigações deste contrato.')];
    const nova = [cl(15, '', 'Fica eleito o Foro de Brasília/DF para o cumprimento das obrigações deste contrato.')];
    const { linhas, resumo } = M.comparar(ant, nova);
    assert.strictEqual(resumo.alteradas, 1);
    assert.strictEqual(resumo.novas, 0);
    assert.strictEqual(resumo.suprimidas, 0);
    assert.strictEqual(linhas[0].classificacao, 'alterada');
});

// ─── integração com os 3 PDFs reais ────────────────────────────────────

async function main() {
    if (!fixturesDisponiveis()) {
        console.log('\n⚠ PDFs de exemplo ausentes (não versionados) — pulando testes de integração.');
        console.log(`\n${n} testes OK (matcher)`);
        return;
    }
    const V = await carregarVias();
    const r1 = P.analisarContrato(V.v1);
    const r2 = P.analisarContrato(V.v2);
    const r3 = P.analisarContrato(V.v3);

    teste('PDF real 1ª→2ª: SEDE, EXERCÍCIO, DISSOLUÇÃO e FORO alteradas; nada novo/suprimido', () => {
        const { linhas, resumo } = M.comparar(r1.clausulas, r2.clausulas);
        assert.strictEqual(resumo.novas, 0);
        assert.strictEqual(resumo.suprimidas, 0);
        const alteradas = new Set(
            linhas.filter(l => l.classificacao === 'alterada').map(l => P.normalizarTitulo(l.titulo))
        );
        for (const t of ['SEDE', 'EXERCICIO SOCIAL', 'DISSOLUCAO DA SOCIEDADE', 'FORO']) {
            assert.ok(alteradas.has(t), 'esperava alterada: ' + t);
        }
        assert.ok(linhas.some(l => P.normalizarTitulo(l.titulo) === 'OBJETO SOCIAL' && l.classificacao === 'igual'));
    });

    teste('PDF real 2ª→3ª: NOME EMPRESARIAL, PRÓ-LABORE, FORO, ADMINISTRAÇÃO, FILIAIS alteradas; nada suprimido', () => {
        const { linhas, resumo } = M.comparar(r2.clausulas, r3.clausulas);
        assert.strictEqual(resumo.suprimidas, 0);
        assert.strictEqual(resumo.novas, 0);
        const alteradas = new Set(
            linhas.filter(l => l.classificacao === 'alterada').map(l => P.normalizarTitulo(l.titulo))
        );
        for (const t of ['NOME EMPRESARIAL', 'PRO LABORE', 'FORO', 'ADMINISTRACAO DA SOCIEDADE', 'FILIAIS']) {
            assert.ok(alteradas.has(t), 'esperava alterada: ' + t);
        }
    });

    teste('PDF real: total de linhas = união das cláusulas casadas (15)', () => {
        const { linhas } = M.comparar(r1.clausulas, r2.clausulas);
        assert.strictEqual(linhas.length, 15);
    });

    console.log(`\n${n} testes OK (matcher)`);
}

main().catch(e => { console.error(e); process.exit(1); });
