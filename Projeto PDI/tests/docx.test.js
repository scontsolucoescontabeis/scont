// Projeto PDI/tests/docx.test.js
// Gera o DOCX com a lib `docx` e confere o conteúdo. Requer: DOCX_LIB=<caminho para node_modules/docx>
// (a lib é carregada via CDN no navegador; aqui usa uma instalação temporária fora do projeto).
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const lib = process.env.DOCX_LIB;
if (!lib) { console.log('SKIP docx.test.js (defina DOCX_LIB para rodar)'); process.exit(0); }
const docx = require(lib);
const T = require('../js/textos.js');
const Doc = require('../js/pdi-documento.js');
const Dx = require('../js/pdi-docx.js');

const c = T.MODELO_DP.conteudo;
const d = {
    pdi: { colaborador_nome: 'Julia Costa Faria', cargo_setor: 'Assistente de Departamento Pessoal', admissao: '2026-09-08',
        gestor_nome: 'Brenna Costa', data_inicio: '2026-10-07', contexto_desenvolvimento: T.SEED_JULIA.contexto_desenvolvimento,
        perfil_comportamental: T.SEED_JULIA.perfil_comportamental, conteudo: c },
    tecnicas: c.tecnicas.map(r => ({ competencia: r.competencia, pratica: r.pratica, meta_ciclo1: r.meta, priorizada: false, niveis: [] })),
    comportamentais: c.comportamentais.map(r => ({ competencia: r.competencia, comportamento_esperado: r.comportamento, acao_evidencia: r.acao, avaliacoes: [] })),
    acoes: c.acoes.map(r => ({ foco_acao: r.foco, responsaveis: r.responsaveis, prazo_dias: r.dias, recorrencia: r.recorrencia, evidencia_esperada: r.evidencia, status: 'a_iniciar' })),
    indicadores: c.indicadores.map(r => ({ ...r, apuracoes: [] })),
    melhorias: [], ciclos: [], avaliacoes: [], ciencias: [], sinalizacoes: [], alinhamentos: [],
};

(async () => {
    const logo = fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo-scont.png'));
    const documento = Dx.construir(docx, Doc.montar(d), { logo });
    const buf = await docx.Packer.toBuffer(documento);
    assert.ok(buf.length > 10000, 'docx gerado');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdi-docx-'));
    const arq = path.join(tmp, 'pdi.docx');
    fs.writeFileSync(arq, buf);
    const py = 'import zipfile,re,sys,html;z=zipfile.ZipFile(sys.argv[1]);x=z.read("word/document.xml").decode();' +
        'print(html.unescape(re.sub(r"<[^>]+>"," ",x)));print("MEDIA", [n for n in z.namelist() if "media" in n])';
    const out = execFileSync('python', ['-I', '-X', 'utf8', '-c', py, arq], { encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    ['PLANO DE DESENVOLVIMENTO INDIVIDUAL', 'Julia Costa Faria', 'Sistema Domínio', 'Visão Sistêmica',
     'D + 90 dias', '05/01/2027', 'Evolução entre ciclos', 'Ciência e alinhamento', 'Ficha de avaliação trimestral']
        .forEach(s => assert.ok(out.includes(s), `DOCX deve conter "${s}"`));
    assert.ok(/MEDIA \[.*png/.test(out), 'logo embutido');
    console.log(`OK  DOCX gerado (${buf.length} bytes) com seções, textos e logo`);
    fs.rmSync(tmp, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exit(1); });
