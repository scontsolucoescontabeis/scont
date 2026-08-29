const assert = require('node:assert');
const D = require('../js/differ.js');

let n = 0;
function teste(nome, fn) { fn(); n++; console.log('OK  ' + nome); }

teste('tokenizar preserva espaços como tokens', () => {
    assert.deepStrictEqual(D.tokenizar('a  b\nc'), ['a', '  ', 'b', '\n', 'c']);
});

teste('diffPalavras: substituição de uma palavra', () => {
    const segs = D.diffPalavras('a bola azul', 'a bola verde');
    assert.deepStrictEqual(segs, [
        { tipo: 'igual', texto: 'a bola ' },
        { tipo: 'del', texto: 'azul' },
        { tipo: 'add', texto: 'verde' },
    ]);
});

teste('diffPalavras: textos iguais → um único segmento igual', () => {
    const segs = D.diffPalavras('foro de Brasília', 'foro de Brasília');
    assert.deepStrictEqual(segs, [{ tipo: 'igual', texto: 'foro de Brasília' }]);
    assert.strictEqual(D.temAlteracao(segs), false);
});

teste('diffPalavras: inserção no início', () => {
    const segs = D.diffPalavras('sócios podem fixar', 'os sócios podem fixar');
    assert.strictEqual(segs[0].tipo, 'add');
    assert.strictEqual(D.temAlteracao(segs), true);
});

teste('segmentosParaLado remove o lado certo', () => {
    const segs = D.diffPalavras('a X c', 'a Y c');
    const ant = D.segmentosParaLado(segs, 'ant').map(s => s.texto).join('');
    const nova = D.segmentosParaLado(segs, 'nova').map(s => s.texto).join('');
    assert.strictEqual(ant, 'a X c');
    assert.strictEqual(nova, 'a Y c');
});

teste('reconstrução: concatenar segmentos "igual"+"add" recompõe o texto novo', () => {
    const a = 'A sociedade tem sua sede na rua velha, 100.';
    const b = 'A sociedade tem sua sede na rua nova, 200, centro.';
    const segs = D.diffPalavras(a, b);
    const recomp = D.segmentosParaLado(segs, 'nova').map(s => s.texto).join('');
    assert.strictEqual(recomp, b);
});

console.log(`\n${n} testes OK (differ)`);
