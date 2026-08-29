// Executa todos os testes da ferramenta.  Uso: node tests/run.js
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const arquivos = ['test-differ.js', 'test-parser.js', 'test-matcher.js'];
let falhou = false;

for (const f of arquivos) {
    console.log('\n══════ ' + f + ' ══════');
    try {
        execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
    } catch (e) {
        falhou = true;
    }
}

if (falhou) { console.error('\n✗ HÁ TESTES FALHANDO'); process.exit(1); }
console.log('\n✓ todos os testes passaram');
