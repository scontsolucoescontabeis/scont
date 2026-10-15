const assert = require('assert');
const path = require('path');
const fs = require('fs');
const U = require('./bpo-util.js');

// normalizar / datas
assert.strictEqual(U.normalizar('  Escola Pequeno Saber, LTDA. '), 'escola pequeno saber ltda');
assert.strictEqual(U.normalizar('SIA & Papel'), 'sia e papel');
assert.strictEqual(U.dataHoraIsoDeBr('01/09/2026 07:37'), '2026-09-01T07:37:00-03:00');
assert.strictEqual(U.dataIsoDeBr('25/09/2026'), '2026-09-25');
assert.strictEqual(U.competenciaSugerida('2026-09-30'), '2026-08');
assert.strictEqual(U.competenciaSugerida('2026-01-31'), '2025-12');
assert.strictEqual(U.competenciaDaPublicacao('2026-09-02T10:00:00-03:00'), '2026-08');
assert.strictEqual(U.competenciaDaPublicacao('2026-01-05T10:00:00-03:00'), '2025-12');
assert.strictEqual(U.competenciaDaPublicacao(null), null);

// parser (linhas sintéticas, mesmo layout do Onvio)
const L = (o) => { const a = []; Object.entries(o).forEach(([i, v]) => { a[i] = v; }); return a; };
const rel = U.parseRelatorio([
  L({ 1: 'DOCUMENTOS PUBLICADOS' }),
  L({ 1: 'Período: 01/09/2026 até 30/09/2026', 10: 'Página:' }),
  L({ 10: 'Emissão:', 12: '14/10/2026' }),
  L({ 10: 'Hora:', 12: '12:19:41' }),
  L({ 1: 'Pasta', 3: 'Arquivo', 4: 'Vencimento', 5: 'PUBLICAÇÃO' }),
  L({ 5: 'Data', 6: 'Usuário', 7: 'Data', 8: 'Usuário' }),
  L({ 1: 'Cliente: ', 2: 'POLARIS SOLUCOES LTDA' }),
  [],
  L({ 1: 'Extrato Bancário e Relatórios Financeiros', 3: 'Extrato_Polaris.pdf', 5: '01/09/2026 08:41', 6: 'Juliana', 7: '09/09/2026 11:47', 8: 'Anderson' }),
  L({ 1: '08 - AGO', 3: 'Folha.pdf', 4: '25/09/2026', 5: '01/09/2026 08:41', 6: 'Juliana' }),
  L({ 1: 'Cliente: ', 2: 'SEM ARQUIVOS LTDA' }),
  L({ 1: 'Cliente: ', 2: 'Polaris Soluções Ltda' }), // mesmo cliente (bloco repetido na paginação)
  L({ 1: 'Extrato Bancário e Relatórios Financeiros', 3: 'Extrato_Polaris.ofx', 5: '02/09/2026 09:00', 6: 'Juliana' }),
]);
assert.deepStrictEqual(rel.periodo, { ini: '2026-09-01', fim: '2026-09-30' });
assert.strictEqual(rel.emitidoEm, '2026-10-14T12:19:00-03:00');
assert.strictEqual(rel.clientes.length, 2);
assert.strictEqual(rel.clientes[0].arquivos.length, 3);
assert.strictEqual(rel.clientes[0].arquivos[1].vencimento, '2026-09-25');
assert.strictEqual(rel.clientes[1].arquivos.length, 0);

// casamento
const m = U.casarClientes(rel.clientes,
  [{ codigo_empresa: '10', nome_empresa: 'Polaris Soluções Ltda' }],
  [{ nome_normalizado: 'sem arquivos ltda', ignorar: true }]);
assert.strictEqual(m.reconhecidos.length, 1);
assert.strictEqual(m.reconhecidos[0].codigo, '10');
assert.strictEqual(m.ignorados.length, 1);
const m2 = U.casarClientes(rel.clientes, [], [{ nome_normalizado: 'polaris solucoes ltda', codigo_empresa: '77' }]);
assert.strictEqual(m2.reconhecidos[0].codigo, '77');
assert.strictEqual(m2.naoReconhecidos.length, 1);

// status
const tipos = [{ id: 't1', nome: 'Extrato bancário', pasta: 'Extrato Bancário e Relatórios Financeiros', ativo: true },
  { id: 't2', nome: 'Comprovantes', pasta: 'Comprovantes de pagamento', palavra_chave: 'pix', ativo: true }];
const pubs = [
  { codigo_empresa: '10', pasta: 'Extrato Bancário e Relatórios Financeiros', arquivo: 'a.pdf' },
  { codigo_empresa: '20', pasta: 'Extrato Bancário e Relatórios Financeiros', arquivo: 'b.pdf', excluido_em: '2026-09-02T10:00:00-03:00' },
  { codigo_empresa: '30', pasta: 'Comprovantes de pagamento', arquivo: 'PIX 1.jpg' },
];
const emps = [{ codigo_empresa: '10', possui_bpo: true }, { codigo_empresa: '20', possui_bpo: true },
  { codigo_empresa: '30', possui_bpo: true }, { codigo_empresa: '40', possui_bpo: false }];
const st = U.calcularStatus(emps, tipos, pubs, [{ codigo_empresa: '20', tipo_id: 't2', situacao: 'DISPENSADO' }]);
assert.strictEqual(st.length, 6); // 3 empresas BPO x 2 tipos
const get = (c, t) => st.find((l) => l.codigo === c && l.tipoId === t).situacao;
assert.strictEqual(get('10', 't1'), 'ENVIADO');
assert.strictEqual(get('20', 't1'), 'PENDENTE'); // arquivo excluído não conta
assert.strictEqual(get('20', 't2'), 'DISPENSADO');
assert.strictEqual(get('30', 't2'), 'ENVIADO');
assert.strictEqual(get('30', 't1'), 'PENDENTE');
assert.strictEqual(U.contar(st).PENDENTE, 3);

// calendário: competência 09/2026 roda em outubro (10/10 é sábado; 12/10 é feriado)
const cfg = { etapas: [{ tipo: 'inicial', dia: 1 }, { tipo: 'lembrete', dia: 5 }, { tipo: 'lembrete', dia: 10 },
  { tipo: 'ultimo_aviso', dia: 15 }, { tipo: 'relatorio', dia: 17 }], ajustar_dia_util: true, feriados_extras: ['12-24'] };
const cal = U.calendarioCompetencia('2026-09', cfg);
assert.deepStrictEqual(cal.map((e) => e.data), ['2026-10-01', '2026-10-05', '2026-10-13', '2026-10-15', '2026-10-19']);
assert.strictEqual(U.etapaAtual(cal, '2026-10-14').etapa, 'D10');
assert.strictEqual(U.etapaAtual(cal, '2026-09-30'), null);
assert.strictEqual(U.dataLimite(cal), '2026-10-15');
assert.ok(U.feriadosDoAno(2026).has('2026-04-03')); // Sexta-feira Santa 2026
assert.ok(U.feriadosDoAno(2026).has('2026-06-04')); // Corpus Christi 2026
assert.strictEqual(U.proximoDiaUtil('2026-11-30'), '2026-12-01'); // Dia do Evangélico (DF)

// início dos ciclos, máscara e feriados em DD/MM
const calIni = U.calendarioCompetencia('2026-09', { ...cfg, inicio_ciclos: '2026-10-10' });
assert.deepStrictEqual(calIni.map((e) => e.ativa), [false, false, true, true, true]);
assert.strictEqual(U.etapaAtual(calIni, '2026-10-07'), null);
assert.strictEqual(U.etapaAtual(calIni, '2026-10-14').etapa, 'D10');
assert.strictEqual(cal[2].ajustada, true); // 10/10 (sábado) -> 13/10
assert.strictEqual(cal[2].diaSemana, 'ter');
assert.deepStrictEqual(U.cicloTextos('2026-09'), { mesCiclo: 'outubro/2026', competencia: '09/2026' });
assert.deepStrictEqual(U.cicloTextos('2026-12'), { mesCiclo: 'janeiro/2027', competencia: '12/2026' });
assert.strictEqual(U.mascaraData('01102026'), '01/10/2026');
assert.strictEqual(U.mascaraData('0110'), '01/10');
assert.strictEqual(U.mascaraData('01/10/20269999'), '01/10/2026');
assert.strictEqual(U.dataBrValida('01/10/2026'), '2026-10-01');
assert.strictEqual(U.dataBrValida('31/02/2026'), null);
assert.strictEqual(U.dataBrValida('1/10/2026'), null);
assert.strictEqual(U.feriadosExtrasParaTexto(['12-24', '2026-11-30']), '24/12, 30/11/2026');
const fx = U.textoParaFeriadosExtras('24/12, 31/12; 15/11/2026, 99/99, abc');
assert.deepStrictEqual(fx.lista, ['12-24', '12-31', '2026-11-15']);
assert.deepStrictEqual(fx.invalidos, ['99/99', 'abc']);

// layout do e-mail (padrão do Hub: enviar-email)
const env = U.envelopeEmail('Scont Soluções Contábeis', '<p>miolo</p>');
assert.ok(env.includes('width="600"') && env.includes('#f5eae9') && env.includes('#4e1820'));
assert.ok(env.includes('Contabilidade com excelência') && env.includes('Nossos Departamentos'));
assert.ok(env.includes('Todos os direitos reservados') && env.includes('<p>miolo</p>'));
assert.ok(U.tituloEmail('ultimo_aviso', '09/2026').includes('#E74C3C'));
assert.ok(U.tituloEmail('lembrete', '09/2026').includes('09/2026'));
assert.ok(U.textoParaHtml('Olá **x**\n\n- a\n- b', {}).includes('<ul style="color:#434343'));

// fila
const fila = U.montarFila(st, [{ codigo_empresa: '20', emails: ['a@cli.com', 'x@scontdf.com.br'], emails_cc: ['b@cli.com'] }],
  tipos, { '20': 'EMPRESA VINTE', '30': 'EMPRESA TRINTA' }, [{ ok: true, etapa: 'D5', codigo_empresa: '30' }], 'D5', { ignorar_emails_dominio: ['scontdf.com.br'] });
assert.strictEqual(fila.length, 3); // 10 (comprovantes), 20 (extrato), 30 (extrato)
const f20 = fila.find((f) => f.codigo === '20');
assert.deepStrictEqual(f20.para, ['a@cli.com']);
assert.deepStrictEqual(f20.documentos, ['Extrato bancário']);
assert.strictEqual(fila.find((f) => f.codigo === '30').jaEnviado, true);
assert.strictEqual(fila.find((f) => f.codigo === '30').semEmail, true);


// planilha de empresas com BPO
const rhx = [{ codigo_empresa: '0100', nome_empresa: 'Polaris Soluções Ltda' }, { codigo_empresa: '200', nome_empresa: 'Zena Ltda' }, { codigo_empresa: '300', nome_empresa: 'Maxi Seguros Ltda' }];
const pl = U.lerPlanilhaEmpresas([
  { 'Código': 100, 'Empresa': 'qualquer', 'E-mails': 'a@x.com; b@x.com', 'CC': 'c@x.com', 'Possui BPO': 'Sim' },
  { 'Código': '', 'Empresa': 'ZENA LTDA.', 'E-mail': 'z@x.com', 'Possui BPO': 'Não' },
  { 'Código': '999', 'Empresa': 'Inexistente' },
  { 'Código': '300', 'Empresa': 'Maxi Seguros Ltda' },
  { 'Código': '0300' },
  {},
], rhx);
assert.strictEqual(pl.itens.length, 3);
assert.strictEqual(pl.itens[0].codigo, '0100');
assert.deepStrictEqual(pl.itens[0].emails, ['a@x.com', 'b@x.com']);
assert.deepStrictEqual(pl.itens[0].emails_cc, ['c@x.com']);
assert.strictEqual(pl.itens[1].codigo, '200');
assert.strictEqual(pl.itens[1].possui_bpo, false);
assert.strictEqual(pl.itens[2].possui_bpo, true);
assert.strictEqual(pl.naoEncontrados.length, 1);
assert.strictEqual(pl.naoEncontrados[0].linha, 4);
assert.strictEqual(pl.duplicados, 1);

// relatório real (se estiver na pasta)
const real = path.join(__dirname, 'documentos-publicados.xlsx');
if (fs.existsSync(real)) {
  const XLSX = require(path.join(__dirname, '..', 'node_modules', 'xlsx'));
  const wb = XLSX.readFile(real, { cellDates: false });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
  const r = U.parseRelatorio(rows);
  assert.strictEqual(r.periodo.ini, '2026-09-01');
  assert.strictEqual(r.periodo.fim, '2026-09-30');
  assert.ok(r.clientes.length > 100, 'clientes: ' + r.clientes.length);
  assert.ok(r.totalArquivos > 3000, 'arquivos: ' + r.totalArquivos);
  const comExtrato = r.clientes.filter((c) => c.arquivos.some((a) => U.arquivoCasaTipo(a, tipos[0])));
  console.log(`relatório real: ${r.clientes.length} clientes, ${r.totalArquivos} arquivos, ${comExtrato.length} com extrato, emitido ${r.emitidoEm}`);
}
console.log('OK');
