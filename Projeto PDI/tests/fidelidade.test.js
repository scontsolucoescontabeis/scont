// Projeto PDI/tests/fidelidade.test.js
// Confere textos.js e o documento montado contra o texto extraído do .docx de referência
// (tests/fixtures/docx-texto.txt). Gera o checklist de conferência (docs/checklist-fidelidade.md).
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = require('../js/textos.js');
const Doc = require('../js/pdi-documento.js');

const norm = (s) => String(s).toLowerCase().replace(/[–—−]/g, '-').replace(/\s+/g, ' ').replace(/[“”"]/g, '').trim();
const docx = norm(fs.readFileSync(path.join(__dirname, 'fixtures', 'docx-texto.txt'), 'utf8'))
    // correções ortográficas aplicadas na ferramenta (ver spec): normaliza o documento antes de comparar
    .replace('dominio', 'domínio').replace('sistemica', 'sistêmica').replace('afim de', 'a fim de');

// Frases genéricas por modelo (o documento cita a Julia) — conferidas pela forma neutra
const GENERALIZADAS = [
    'Gestor e colaboradora', 'Colaboradora; apoio do gestor', 'Colaboradora; conferência do gestor',
    'Colaboradora; orientação do gestor', 'Colaboradora; feedback do gestor', 'Colaboradora, gestor e Diretoria',
    'A colaboradora registra prática e dificuldades',
];

let n = 0, ausentes = [];
const linhas = [];
function confere(origem, texto) {
    if (texto == null || String(texto).trim() === '') return;
    const t = norm(texto);
    const ok = docx.includes(t) || GENERALIZADAS.some(g => String(texto).includes(g));
    linhas.push(`| ${origem} | ${String(texto).replace(/\|/g, '/').slice(0, 90)} | ${ok ? 'sim' : 'NÃO'} |`);
    if (!ok) ausentes.push(`${origem}: ${texto}`);
    n++;
}

const c = T.MODELO_DP.conteudo;
Object.entries(T.TEXTOS).forEach(([k, v]) => { if (typeof v === 'string') confere(`TEXTOS.${k}`, v); });
c.perfil_esperado.forEach((r, i) => { confere(`perfil[${i}].competencia`, r.competencia); confere(`perfil[${i}].evidencia`, r.evidencia); confere(`perfil[${i}].direcionamento`, r.direcionamento); });
c.tecnicas.forEach((r, i) => { confere(`tecnica[${i}].competencia`, r.competencia); confere(`tecnica[${i}].pratica`, r.pratica); confere(`tecnica[${i}].meta`, r.meta); });
c.comportamentais.forEach((r, i) => { confere(`comport[${i}].competencia`, r.competencia); confere(`comport[${i}].comportamento`, r.comportamento); confere(`comport[${i}].acao`, r.acao); });
c.acoes.forEach((r, i) => { confere(`acao[${i}].foco`, r.foco); confere(`acao[${i}].responsaveis`, r.responsaveis); confere(`acao[${i}].evidencia`, r.evidencia); });
c.indicadores.forEach((r, i) => { confere(`indicador[${i}].formula`, r.formula); confere(`indicador[${i}].meta`, r.meta_texto); confere(`indicador[${i}].evidencia`, r.evidencia); });
T.CICLOS.forEach((r, i) => { confere(`ciclo[${i}].periodo`, r.periodo); confere(`ciclo[${i}].foco`, r.foco); });
['ESCALA_TECNICA', 'ESCALA_COMPORTAMENTAL', 'ESCALA_PERFORMANCE', 'ESCALA_MELHORIAS'].forEach(k =>
    T[k].forEach(e => { confere(`${k}.${e.nivel}`, e.titulo); if (e.descricao) confere(`${k}.${e.nivel}.desc`, e.descricao); }));
Object.values(T.RESULTADOS).forEach((v, i) => confere(`resultado[${i}]`, v));
Object.values(T.DIRECIONAMENTOS).forEach((v, i) => confere(`direcionamento[${i}]`, v));
Object.values(T.PILARES_ROTULO).forEach((v, i) => confere(`pilar[${i}]`, v));
confere('seed.contexto', T.SEED_JULIA.contexto_desenvolvimento);
confere('seed.perfil.descricao', T.SEED_JULIA.perfil_comportamental.descricao);

console.log(`conferidos ${n} textos contra o .docx`);
if (ausentes.length) {
    console.log('NÃO ENCONTRADOS NO DOCX:\n' + ausentes.join('\n'));
}
assert.strictEqual(ausentes.length, 0, 'há textos que não constam no documento de referência');

// Documento montado contém as seções na ordem e os textos-chave
const demo = {
    pdi: { colaborador_nome: 'Julia Costa Faria', cargo_setor: 'Assistente de Departamento Pessoal', admissao: '2026-09-08',
        gestor_nome: 'Brenna Costa', data_inicio: '2026-10-07', contexto_desenvolvimento: T.SEED_JULIA.contexto_desenvolvimento,
        perfil_comportamental: T.SEED_JULIA.perfil_comportamental, conteudo: c, acompanhamento_texto: T.CABECALHO_PADRAO.acompanhamento },
    tecnicas: c.tecnicas.map((r, i) => ({ competencia: r.competencia, pratica: r.pratica, meta_ciclo1: r.meta, priorizada: false, niveis: [] })),
    comportamentais: c.comportamentais.map(r => ({ competencia: r.competencia, comportamento_esperado: r.comportamento, acao_evidencia: r.acao, avaliacoes: [] })),
    acoes: c.acoes.map(r => ({ foco_acao: r.foco, responsaveis: r.responsaveis, prazo_dias: r.dias, recorrencia: r.recorrencia, evidencia_esperada: r.evidencia, status: 'a_iniciar' })),
    indicadores: c.indicadores.map(r => ({ ...r, apuracoes: [] })),
    melhorias: [], ciclos: [], avaliacoes: [], ciencias: [], sinalizacoes: [], alinhamentos: [],
};
const blocos = Doc.montar(demo);
const secoes = blocos.filter(b => b.t === 'secao').map(b => b.texto);
assert.deepStrictEqual(secoes, T.SECOES.slice(1).map(s => s.titulo), 'ordem das seções');
const achatado = norm(JSON.stringify(blocos));
['Plano de Desenvolvimento Individual', 'D + 15 dias (22/10/2026)', 'D + 90 dias (05/01/2027)', 'Semanal',
 'Julia Costa Faria', '08/09/2026', '07/10/2026', '11/09/2026', 'Prioritário', 'Sem medição'].forEach(s =>
    assert.ok(achatado.includes(norm(s)), `documento deveria conter "${s}"`));
console.log('OK  documento montado: 8 seções na ordem, datas D + n corretas');

const md = ['# Checklist de conferência — documento de referência × ferramenta', '',
    `Gerado automaticamente por tests/fidelidade.test.js (${n} itens).`, '',
    '| Item | Texto | Presente no .docx |', '|---|---|---|', ...linhas, ''].join('\n');
fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'checklist-fidelidade.md'), md, 'utf8');
console.log('OK  checklist gravado em docs/checklist-fidelidade.md');
