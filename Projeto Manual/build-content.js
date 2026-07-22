// Gera content-data.js a partir dos fragmentos em content/*.html.
// Necessário porque o portal é usado tanto por http(s) quanto abrindo os
// arquivos direto no navegador (file://), onde fetch() de arquivo local é
// bloqueado por CORS — então o conteúdo precisa ir embutido em JS, não
// carregado à parte.
//
// Rodar `node build-content.js` (dentro de Projeto Manual/) sempre que um
// arquivo de content/*.html for criado ou editado.
const fs = require('fs');
const path = require('path');

const contentDir = path.join(__dirname, 'content');
const arquivos = fs.readdirSync(contentDir).filter(f => f.endsWith('.html'));

const entradas = arquivos.map(f => {
    const slug = f.replace(/\.html$/, '');
    const html = fs.readFileSync(path.join(contentDir, f), 'utf8');
    return `    ${JSON.stringify(slug)}: ${JSON.stringify(html)}`;
});

const saida = `// GERADO AUTOMATICAMENTE por build-content.js — não editar à mão.\n// Para atualizar: edite o .html correspondente em content/ e rode \`node build-content.js\`.\nwindow.MANUAL_CONTENT = {\n${entradas.join(',\n')}\n};\n`;

fs.writeFileSync(path.join(__dirname, 'content-data.js'), saida, 'utf8');
console.log(`content-data.js gerado com ${arquivos.length} grupo(s).`);
