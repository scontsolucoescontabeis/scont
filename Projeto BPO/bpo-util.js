(function (root) {
  'use strict';

  // BPO Financeiro — Monitor de Documentos Publicados.
  // Funções puras (sem DOM nem Supabase): interpretação do relatório do Onvio,
  // casamento de nomes, status por empresa/tipo, calendário e fila de alertas.

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  const SITUACOES = {
    ENVIADO:         { label: 'Enviado',           classe: 'bpo-sit-ok' },
    RECEBIDO_MANUAL: { label: 'Recebido (manual)', classe: 'bpo-sit-ok' },
    PENDENTE:        { label: 'Pendente',          classe: 'bpo-sit-pend' },
    DISPENSADO:      { label: 'Dispensado',        classe: 'bpo-sit-neutro' },
  };

  const TIPOS_ETAPA = { inicial: 'Solicitação', lembrete: 'Lembrete', ultimo_aviso: 'Último aviso', relatorio: 'Relatório' };

  // ─── TEXTO ──────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Sem acento, minúsculo, só letras/números separados por 1 espaço.
  function normalizar(s) {
    return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function parseEmails(texto) {
    const out = [];
    String(texto || '').split(/[;,\s]+/).forEach((e) => {
      const v = e.trim().toLowerCase();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && !out.includes(v)) out.push(v);
    });
    return out;
  }

  function aplicarVariaveis(texto, vars) {
    return String(texto || '').replace(/\{(\w+)\}/g, (orig, k) => (k in vars ? vars[k] : orig));
  }

  // Mesma regra de formatação da edge function (pré-visualização na tela).
  function textoParaHtml(texto, vars) {
    const seguros = {};
    Object.keys(vars || {}).forEach((k) => { seguros[k] = k === 'documentos_html' ? vars[k] : escapeHtml(vars[k]); });
    const html = aplicarVariaveis(escapeHtml(texto), seguros);
    const negrito = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return html.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((bloco) => {
      const partes = [];
      let lista = [], par = [];
      const fecharLista = () => { if (lista.length) partes.push(`<ul>${lista.join('')}</ul>`); lista = []; };
      const fecharPar = () => { if (par.length) partes.push(`<p>${par.join('<br>')}</p>`); par = []; };
      bloco.split('\n').filter((l) => l.trim()).forEach((l) => {
        const item = /^\s*-\s+(.*)$/.exec(l);
        if (item) { fecharPar(); lista.push(`<li>${negrito(item[1])}</li>`); } else { fecharLista(); par.push(negrito(l.trim())); }
      });
      fecharPar(); fecharLista();
      return partes.join('');
    }).join('');
  }

  // ─── DATAS ──────────────────────────────────────────────────

  const pad = (n) => String(n).padStart(2, '0');

  function competenciaTextos(comp) {
    const m = /^(\d{4})-(\d{2})$/.exec(comp || '');
    if (!m) return { curta: comp || '', extenso: comp || '' };
    return { curta: `${m[2]}/${m[1]}`, extenso: `${MESES[parseInt(m[2], 10) - 1]}/${m[1]}` };
  }

  function dataBr(iso, comHora) {
    if (!iso) return '';
    const d = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return '';
    const s = d.toLocaleDateString('pt-BR');
    return comHora ? `${s} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : s;
  }

  // 'dd/mm/aaaa' -> 'aaaa-mm-dd' | null
  function dataIsoDeBr(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || '').trim());
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }

  // 'dd/mm/aaaa hh:mm' -> 'aaaa-mm-ddThh:mm:00-03:00' | null (horário de Brasília)
  function dataHoraIsoDeBr(s) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(s || '').trim());
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00'}:${m[5] || '00'}:00-03:00`;
  }

  // Competência sugerida: mês anterior ao do fim do período ('2026-09-30' -> '2026-08').
  function competenciaSugerida(periodoFimIso) {
    const m = /^(\d{4})-(\d{2})/.exec(periodoFimIso || '');
    if (!m) return '';
    let a = parseInt(m[1], 10), mes = parseInt(m[2], 10) - 1;
    if (mes === 0) { mes = 12; a -= 1; }
    return `${a}-${pad(mes)}`;
  }

  // Competência de uma publicação: o mês anterior ao da data de publicação (Brasília).
  // '2026-09-02T10:00:00-03:00' -> '2026-08'. Sem data -> null.
  function competenciaDaPublicacao(iso) {
    const m = /^(\d{4})-(\d{2})/.exec(iso || '');
    if (!m) return null;
    let a = parseInt(m[1], 10), mes = parseInt(m[2], 10) - 1;
    if (mes === 0) { mes = 12; a -= 1; }
    return `${a}-${pad(mes)}`;
  }

  function listaCompetencias(hoje, n) {
    const d = hoje || new Date();
    let a = d.getFullYear(), m = d.getMonth(); // mês anterior em base 1
    if (m === 0) { m = 12; a -= 1; }
    const out = [];
    for (let i = 0; i < (n || 12); i++) {
      out.push(`${a}-${pad(m)}`);
      m -= 1;
      if (m < 1) { m = 12; a -= 1; }
    }
    return out;
  }

  // ─── INTERPRETAÇÃO DO RELATÓRIO (linhas de planilha: array de arrays) ──
  // Colunas do "Documentos Publicados": B pasta · D arquivo · E vencimento · F/G publicação
  // (data/usuário) · H/I visualização · J/L exclusão (data/usuário). Blocos "Cliente: NOME".
  const COL = { pasta: 1, arquivo: 3, venc: 4, pubData: 5, pubUser: 6, visData: 7, excData: 9 };

  function txt(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()} ${pad(v.getHours())}:${pad(v.getMinutes())}`;
    return String(v).replace(/\s+/g, ' ').trim();
  }

  function parseRelatorio(linhas) {
    const out = { periodo: { ini: null, fim: null }, emitidoEm: null, clientes: [], avisos: [] };
    const porNome = new Map();
    let atual = null;
    let emissaoData = null, emissaoHora = null;

    for (const linha of linhas || []) {
      const c = (linha || []).map(txt);
      const primeiro = c.find((x) => x) || '';

      const per = /Per[ií]odo:\s*(\d{2}\/\d{2}\/\d{4})\D+(\d{2}\/\d{2}\/\d{4})/i.exec(c.join(' '));
      if (per && !out.periodo.ini) { out.periodo.ini = dataIsoDeBr(per[1]); out.periodo.fim = dataIsoDeBr(per[2]); }

      if (!emissaoData) {
        const i = c.findIndex((x) => /^Emiss/i.test(x));
        if (i >= 0) emissaoData = c.slice(i + 1).find((x) => /^\d{2}\/\d{2}\/\d{4}$/.test(x)) || null;
      }
      if (!emissaoHora) {
        const i = c.findIndex((x) => /^Hora:?$/i.test(x));
        if (i >= 0) emissaoHora = c.slice(i + 1).find((x) => /^\d{2}:\d{2}/.test(x)) || null;
      }

      if (/^Cliente:/i.test(c[COL.pasta] || '')) {
        const nome = c[COL.pasta + 1] || c.slice(COL.pasta + 1).find((x) => x) || '';
        if (nome) {
          const chave = normalizar(nome);
          atual = porNome.get(chave);
          if (!atual) { atual = { nome, nomeNormalizado: chave, arquivos: [] }; porNome.set(chave, atual); out.clientes.push(atual); }
        }
        continue;
      }
      if (!atual || /^(Pasta|DOCUMENTOS PUBLICADOS|SCONT)/i.test(primeiro) || /^(Data|Usu)/i.test(c[COL.pubData] || '')) continue;

      const pasta = c[COL.pasta], arquivo = c[COL.arquivo];
      if (!pasta || !arquivo) continue;
      atual.arquivos.push({
        pasta,
        arquivo,
        vencimento: dataIsoDeBr(c[COL.venc]),
        publicadoEm: dataHoraIsoDeBr(c[COL.pubData]),
        publicadoPor: c[COL.pubUser] || null,
        visualizadoEm: dataHoraIsoDeBr(c[COL.visData]),
        excluidoEm: dataHoraIsoDeBr(c[COL.excData]),
      });
    }

    if (emissaoData) {
      const iso = dataHoraIsoDeBr(`${emissaoData} ${emissaoHora || '00:00'}`);
      out.emitidoEm = iso;
    }
    if (!out.periodo.ini) out.avisos.push('Período do relatório não encontrado.');
    if (!out.clientes.length) out.avisos.push('Nenhum bloco "Cliente:" encontrado — confira se é o relatório "Documentos Publicados".');
    out.totalArquivos = out.clientes.reduce((n, cl) => n + cl.arquivos.length, 0);
    return out;
  }

  // ─── CASAMENTO DE NOMES ─────────────────────────────────────

  // empresasRh: [{codigo_empresa, nome_empresa}] · vinculos: [{nome_normalizado, codigo_empresa, ignorar}]
  // -> { reconhecidos: [{cliente, codigo}], naoReconhecidos: [cliente], ignorados: [cliente] }
  function casarClientes(clientes, empresasRh, vinculos) {
    const porNome = new Map();
    (empresasRh || []).forEach((e) => {
      const k = normalizar(e.nome_empresa);
      if (k && !porNome.has(k)) porNome.set(k, e.codigo_empresa);
    });
    const vinc = new Map((vinculos || []).map((v) => [v.nome_normalizado, v]));
    const out = { reconhecidos: [], naoReconhecidos: [], ignorados: [] };
    (clientes || []).forEach((cl) => {
      const v = vinc.get(cl.nomeNormalizado);
      if (v && v.ignorar) { out.ignorados.push(cl); return; }
      const codigo = (v && v.codigo_empresa) || porNome.get(cl.nomeNormalizado);
      if (codigo) out.reconhecidos.push({ cliente: cl, codigo });
      else out.naoReconhecidos.push(cl);
    });
    return out;
  }

  // ─── STATUS ─────────────────────────────────────────────────

  function arquivoCasaTipo(pub, tipo) {
    if (pub.excluido_em || pub.excluidoEm) return false;
    const pasta = normalizar(pub.pasta);
    const alvo = normalizar(tipo.pasta);
    if (!alvo || !pasta.includes(alvo)) return false;
    const kw = normalizar(tipo.palavra_chave || '');
    return !kw || normalizar(pub.arquivo).includes(kw);
  }

  // empresas: [{codigo_empresa, possui_bpo}] · tipos ativos · publicacoes da competência ·
  // marcacoes: [{codigo_empresa, tipo_id, situacao}]
  // -> [{codigo, tipoId, situacao, arquivos:[{arquivo, publicado_em, publicado_por}]}]
  function calcularStatus(empresas, tipos, publicacoes, marcacoes) {
    const pubPor = new Map();
    (publicacoes || []).forEach((p) => { (pubPor.get(p.codigo_empresa) || pubPor.set(p.codigo_empresa, []).get(p.codigo_empresa)).push(p); });
    const marc = new Map((marcacoes || []).map((m) => [`${m.codigo_empresa}|${m.tipo_id}`, m]));
    const linhas = [];
    (empresas || []).filter((e) => e.possui_bpo).forEach((e) => {
      (tipos || []).filter((t) => t.ativo !== false).forEach((t) => {
        const arquivos = (pubPor.get(e.codigo_empresa) || []).filter((p) => arquivoCasaTipo(p, t));
        const m = marc.get(`${e.codigo_empresa}|${t.id}`);
        let situacao = arquivos.length ? 'ENVIADO' : 'PENDENTE';
        if (m) situacao = m.situacao;
        linhas.push({
          codigo: e.codigo_empresa, tipoId: t.id, situacao,
          manual: m ? { motivo: m.motivo || '', por: m.marcado_por || '', em: m.marcado_em || null } : null,
          arquivos: arquivos.map((p) => ({ arquivo: p.arquivo, publicado_em: p.publicado_em, publicado_por: p.publicado_por })),
        });
      });
    });
    return linhas;
  }

  function contar(linhas) {
    const c = { total: linhas.length, ENVIADO: 0, RECEBIDO_MANUAL: 0, PENDENTE: 0, DISPENSADO: 0 };
    linhas.forEach((l) => { c[l.situacao] += 1; });
    c.ok = c.ENVIADO + c.RECEBIDO_MANUAL;
    return c;
  }

  // ─── CALENDÁRIO ─────────────────────────────────────────────

  function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(ano, mes - 1, dia));
  }

  function isoUtc(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

  // Feriados nacionais + DF (30/11) + extras ("MM-DD" ou "AAAA-MM-DD") do ano.
  function feriadosDoAno(ano, extras) {
    const set = new Set();
    ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25', '11-30']
      .forEach((md) => set.add(`${ano}-${md}`));
    const p = pascoa(ano);
    [-48, -47, -2, 60].forEach((off) => set.add(isoUtc(new Date(p.getTime() + off * 86400000))));
    (extras || []).forEach((x) => {
      if (/^\d{2}-\d{2}$/.test(x)) set.add(`${ano}-${x}`);
      else if (/^\d{4}-\d{2}-\d{2}$/.test(x) && x.startsWith(String(ano))) set.add(x);
    });
    return set;
  }

  function ehDiaUtil(iso, extras) {
    const d = new Date(iso + 'T12:00:00Z');
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) return false;
    return !feriadosDoAno(d.getUTCFullYear(), extras).has(iso);
  }

  function proximoDiaUtil(iso, extras) {
    let d = new Date(iso + 'T12:00:00Z');
    for (let i = 0; i < 15; i++) {
      const s = isoUtc(d);
      if (ehDiaUtil(s, extras)) return s;
      d = new Date(d.getTime() + 86400000);
    }
    return iso;
  }

  // Ciclo da competência 'AAAA-MM' roda no mês seguinte.
  function calendarioCompetencia(comp, config) {
    const m = /^(\d{4})-(\d{2})$/.exec(comp || '');
    if (!m) return [];
    let a = parseInt(m[1], 10), mes = parseInt(m[2], 10) + 1;
    if (mes === 13) { mes = 1; a += 1; }
    const etapas = Array.isArray(config?.etapas) ? config.etapas : [];
    const ajustar = config?.ajustar_dia_util !== false;
    return etapas.map((e) => {
      const ultimo = new Date(Date.UTC(a, mes, 0)).getUTCDate();
      const dia = Math.min(Math.max(parseInt(e.dia, 10) || 1, 1), ultimo);
      let data = `${a}-${pad(mes)}-${pad(dia)}`;
      if (ajustar) data = proximoDiaUtil(data, config?.feriados_extras);
      return { etapa: `D${e.dia}`, tipo: e.tipo, dia: e.dia, data };
    }).sort((x, y) => x.data.localeCompare(y.data));
  }

  // Última etapa de cobrança (não relatório) com data <= hoje; null se nenhuma chegou.
  function etapaAtual(calendario, hojeIso) {
    let atual = null;
    (calendario || []).forEach((e) => { if (e.data <= hojeIso) atual = e; });
    return atual;
  }

  function dataLimite(calendario) {
    const u = (calendario || []).filter((e) => e.tipo === 'ultimo_aviso').pop();
    return u ? u.data : ((calendario || []).filter((e) => e.tipo !== 'relatorio').pop() || {}).data || null;
  }

  // ─── FILA DE ALERTAS ────────────────────────────────────────

  function emailsValidos(lista, dominiosIgnorados) {
    const ign = (dominiosIgnorados || []).map((d) => String(d).toLowerCase());
    return parseEmails((lista || []).join(' ')).filter((e) => !ign.includes(e.split('@')[1]));
  }

  // linhas: calcularStatus · empresasCad: bpo_empresas · alertas: bpo_alertas da competência
  // -> [{codigo, nome, documentos:[tipo.nome], tipoIds, para, cc, semEmail, jaEnviado}]
  function montarFila(linhas, empresasCad, tipos, nomes, alertas, etapa, config) {
    const tipoPor = new Map((tipos || []).map((t) => [t.id, t]));
    const cadPor = new Map((empresasCad || []).map((e) => [e.codigo_empresa, e]));
    const jaEnviou = new Set((alertas || []).filter((a) => a.ok && a.etapa === etapa && a.codigo_empresa).map((a) => a.codigo_empresa));
    const grupos = new Map();
    (linhas || []).filter((l) => l.situacao === 'PENDENTE').forEach((l) => {
      if (!grupos.has(l.codigo)) grupos.set(l.codigo, []);
      grupos.get(l.codigo).push(l);
    });
    const ign = config?.ignorar_emails_dominio;
    return Array.from(grupos.entries()).map(([codigo, ls]) => {
      const cad = cadPor.get(codigo) || {};
      const para = emailsValidos(cad.emails, ign);
      return {
        codigo,
        nome: nomes[codigo] || `(código ${codigo})`,
        tipoIds: ls.map((l) => l.tipoId),
        documentos: ls.map((l) => (tipoPor.get(l.tipoId) || {}).nome || l.tipoId),
        para,
        cc: emailsValidos(cad.emails_cc, ign).filter((e) => !para.includes(e)),
        semEmail: !para.length,
        jaEnviado: jaEnviou.has(codigo),
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // ─── PLANILHA DE EMPRESAS COM BPO ───────────────────────────
  // rows: linhas como objetos (cabeçalho na 1ª linha, via XLSX.utils.sheet_to_json).
  // Cabeçalhos aceitos (sem acento/caixa): codigo | empresa/nome/razao social | email(s) | cc/copia | bpo/possui bpo.
  // Coluna BPO ausente = todas as linhas contam como "possui BPO".
  function lerPlanilhaEmpresas(rows, empresasRh) {
    const achar = (obj, nomes) => {
      for (const k of Object.keys(obj)) {
        const n = normalizar(k);
        if (nomes.some((x) => n === x || n.startsWith(x))) return obj[k];
      }
      return undefined;
    };
    const porCodigo = new Map();
    const porNome = new Map();
    (empresasRh || []).forEach((e) => {
      porCodigo.set(String(e.codigo_empresa).trim(), e);
      const k = normalizar(e.nome_empresa);
      if (k && !porNome.has(k)) porNome.set(k, e);
    });
    const semZeros = (s) => String(s).trim().replace(/^0+(?=\d)/, '');
    const porCodigoSemZeros = new Map();
    porCodigo.forEach((e, c) => porCodigoSemZeros.set(semZeros(c), e));
    const simNao = (v) => {
      const n = normalizar(v);
      if (!n) return true;
      return !['nao', 'n', '0', 'false', 'falso', 'no'].includes(n);
    };

    const out = { itens: [], naoEncontrados: [], duplicados: 0, avisos: [] };
    const vistos = new Set();
    (rows || []).forEach((r, i) => {
      const cod = achar(r, ['codigo', 'cod']);
      const nome = achar(r, ['empresa', 'nome', 'razao']);
      if ((cod === undefined || cod === null || cod === '') && !nome) return; // linha vazia
      let emp = null;
      if (cod !== undefined && cod !== null && String(cod).trim() !== '') {
        const c = String(cod).trim();
        emp = porCodigo.get(c) || porCodigoSemZeros.get(semZeros(c)) || null;
      }
      if (!emp && nome) emp = porNome.get(normalizar(nome)) || null;
      if (!emp) { out.naoEncontrados.push({ linha: i + 2, texto: [cod, nome].filter((x) => x !== undefined && x !== null && x !== '').join(' · ') }); return; }
      if (vistos.has(emp.codigo_empresa)) { out.duplicados += 1; return; }
      vistos.add(emp.codigo_empresa);
      const emails = parseEmails(String(achar(r, ['e mail', 'email', 'emails']) ?? ''));
      const cc = parseEmails(String(achar(r, ['cc', 'copia', 'com copia']) ?? ''));
      out.itens.push({
        codigo: emp.codigo_empresa, nome: emp.nome_empresa,
        possui_bpo: simNao(achar(r, ['bpo', 'possui bpo'])),
        emails, emails_cc: cc,
      });
    });
    if (!out.itens.length && !out.naoEncontrados.length) out.avisos.push('Nenhuma linha reconhecida — a planilha precisa de cabeçalho com "Código" e/ou "Empresa".');
    return out;
  }

  const api = {
    MESES, SITUACOES, TIPOS_ETAPA, escapeHtml, normalizar, parseEmails, aplicarVariaveis, textoParaHtml,
    competenciaTextos, dataBr, dataIsoDeBr, dataHoraIsoDeBr, competenciaSugerida, competenciaDaPublicacao, listaCompetencias,
    parseRelatorio, casarClientes, arquivoCasaTipo, calcularStatus, contar,
    feriadosDoAno, ehDiaUtil, proximoDiaUtil, calendarioCompetencia, etapaAtual, dataLimite,
    emailsValidos, montarFila, lerPlanilhaEmpresas,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BpoUtil = api;
})(typeof window !== 'undefined' ? window : globalThis);
