// ============================================================
// bpo-alertas — envio dos e-mails de alerta do BPO Financeiro
//
// Chamado pela tela Projeto BPO/index.html (fila de alertas).
// Destinatários e textos NUNCA vêm do chamador: são lidos aqui, com
// service role, das tabelas bpo_* — a função não vira um "envia
// qualquer coisa para qualquer um".
//
// Ações (body.acao):
//   cobrar     { competencia, codigo_empresa, etapa, tipo_texto, tipo_ids[], data_limite? }
//   relatorio  { competencia, etapa?, itens[], resumo?, portal_url? }
//   teste      { competencia, tipo_texto, assunto?, texto?, data_limite? }  -> só para o e-mail de teste
//
// Deploy: supabase functions deploy bpo-alertas
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TIPOS_TEXTO = ['inicial', 'lembrete', 'ultimo_aviso'];

const escapeHtml = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function competenciaTextos(comp: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(comp || '');
    if (!m) return { curta: comp, extenso: comp };
    return { curta: `${m[2]}/${m[1]}`, extenso: `${MESES[parseInt(m[2], 10) - 1]}/${m[1]}` };
}

function dataBr(iso?: string | null) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function emailsValidos(lista: unknown, dominiosIgnorados: string[] = []): string[] {
    const out: string[] = [];
    const ign = dominiosIgnorados.map((d) => d.toLowerCase());
    (Array.isArray(lista) ? lista : []).forEach((x) => {
        const v = String(x).trim().toLowerCase();
        if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && !out.includes(v) && !ign.includes(v.split('@')[1])) out.push(v);
    });
    return out;
}

function aplicarVariaveis(texto: string, vars: Record<string, string>) {
    return String(texto || '').replace(/\{(\w+)\}/g, (orig, k) => (k in vars ? vars[k] : orig));
}

// Linha em branco = parágrafo; "- " = item de lista; **x** = negrito.
// Estilos inline no padrão dos e-mails do Portal (enviar-email).
function textoParaHtml(texto: string, vars: Record<string, string>) {
    const seguros: Record<string, string> = {};
    Object.keys(vars).forEach((k) => { seguros[k] = escapeHtml(vars[k]); });
    const html = aplicarVariaveis(escapeHtml(texto), seguros);
    const negrito = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return html.replace(/\r\n/g, '\n').split(/\n\s*\n/).map((bloco) => {
        const partes: string[] = [];
        let lista: string[] = [], par: string[] = [];
        const fecharLista = () => {
            if (lista.length) partes.push(`<ul style="color:#434343;margin:0 0 16px;padding-left:22px;line-height:1.8;">${lista.join('')}</ul>`);
            lista = [];
        };
        const fecharPar = () => {
            if (par.length) partes.push(`<p style="color:#434343;margin:0 0 16px;line-height:1.7;">${par.join('<br>')}</p>`);
            par = [];
        };
        bloco.split('\n').filter((l) => l.trim()).forEach((l) => {
            const item = /^\s*-\s+(.*)$/.exec(l);
            if (item) { fecharPar(); lista.push(`<li>${negrito(item[1])}</li>`); } else { fecharLista(); par.push(negrito(l.trim())); }
        });
        fecharPar(); fecharLista();
        return partes.join('');
    }).join('');
}

// ── Layout Scont: MESMO padrão da função enviar-email (cabeçalho, corpo, rodapé "Nossos Departamentos").
//    Mantenha igual a enviar-email/index.ts (_cabecalho/_rodape/_fechamento) e a bpo-util.js (envelopeEmail).
function envelope(nomeRemetente: string, miolo: string): string {
    const nome = escapeHtml(nomeRemetente);
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f0f2f5" style="background-color:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td bgcolor="#f5eae9" style="background-color:#f5eae9;padding:32px;text-align:center;border-radius:12px 12px 0 0;border:1px solid #e0c8c6;border-bottom:none;">
          <h1 style="color:#4e1820;margin:0;font-size:22px;font-weight:700;">${nome}</h1>
          <p style="color:#8b4a4a;margin:6px 0 0;font-size:13px;">Contabilidade com excelência</p>
        </td></tr>
        <tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:36px 32px;border:1px solid #e0e6ed;border-top:none;">
${miolo}
          <hr style="border:none;border-top:1px solid #e0e6ed;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:12px;color:#999;text-align:center;line-height:1.8;">
            <strong style="color:#4e1820;">Nossos Departamentos</strong><br>
            📋 Fiscal: <a href="mailto:fiscal@scontdf.com.br" style="color:#b47938;">fiscal@scontdf.com.br</a><br>
            👥 Pessoal: <a href="mailto:pessoal@scontdf.com.br" style="color:#b47938;">pessoal@scontdf.com.br</a><br>
            📚 Contábil: <a href="mailto:contabil@scontdf.com.br" style="color:#b47938;">contabil@scontdf.com.br</a><br>
            🏢 Administrativo: <a href="mailto:contato@scontdf.com.br" style="color:#b47938;">contato@scontdf.com.br</a>
          </td></tr></table>
        </td></tr>
        <tr><td bgcolor="#f8f9fa" style="background-color:#f8f9fa;padding:18px;text-align:center;border:1px solid #e0e6ed;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0;font-size:11px;color:#aaa;">© ${new Date().getFullYear()} ${nome} · Todos os direitos reservados</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Título (h2 com emoji e cor por nível, como os alertas do Hub) e botão no padrão do portal.
const TITULOS_EMAIL: Record<string, { texto: string; cor: string }> = {
    inicial: { texto: '📥 Solicitação de documentos', cor: '#4e1820' },
    lembrete: { texto: '🔔 Lembrete: documentos pendentes', cor: '#E8890C' },
    ultimo_aviso: { texto: '⚠️ Último aviso: documentos pendentes', cor: '#E74C3C' },
    relatorio: { texto: '📋 Documentos não recebidos', cor: '#4e1820' },
};

function tituloHtml(tipo: string, competenciaCurta: string): string {
    const t = TITULOS_EMAIL[tipo] || TITULOS_EMAIL.lembrete;
    return `<h2 style="color:${t.cor};margin:0 0 8px;font-size:20px;">${t.texto} — ${escapeHtml(competenciaCurta)}</h2>\n`;
}

function botaoHtml(url: string, rotulo: string): string {
    return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${escapeHtml(url)}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              ${rotulo}
            </a>
          </td></tr></table>`;
}

// ── Envio (mesmos provedores configurados em configuracoes_scont) ───
async function enviar(cfgMail: Record<string, string>, msg: { para: string[]; cc: string[]; assunto: string; html: string }) {
    const nomeRem = cfgMail.nome_remetente || 'Scont Soluções Contábeis';
    const emailRem = cfgMail.email_remetente || cfgMail.smtp_usuario || 'contato@scontdf.com.br';
    const provedor = cfgMail.email_provedor || 'brevo';

    if (provedor === 'smtp') {
        if (!cfgMail.smtp_host || !cfgMail.smtp_usuario || !cfgMail.smtp_senha) {
            throw new Error('Configurações SMTP incompletas. Acesse Admin → Configurações → SMTP.');
        }
        const transporter = nodemailer.createTransport({
            host: cfgMail.smtp_host, port: parseInt(cfgMail.smtp_porta || '587'),
            secure: cfgMail.smtp_seguranca === 'SSL',
            auth: { user: cfgMail.smtp_usuario, pass: cfgMail.smtp_senha },
            tls: { rejectUnauthorized: false },
        });
        const info = await transporter.sendMail({
            from: `${nomeRem} <${emailRem}>`, to: msg.para.join(', '),
            ...(msg.cc.length ? { cc: msg.cc.join(', ') } : {}),
            replyTo: cfgMail.email_resposta_contabil || 'contabil@scontdf.com.br',
            subject: msg.assunto, html: msg.html,
        });
        return { provider: 'smtp', id: info.messageId };
    }

    if (!cfgMail.brevo_api_key) throw new Error('Brevo API Key não configurada. Acesse Admin → Configurações.');
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': cfgMail.brevo_api_key, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            sender: { name: nomeRem, email: emailRem },
            to: msg.para.map((email) => ({ email })),
            ...(msg.cc.length ? { cc: msg.cc.map((email) => ({ email })) } : {}),
            replyTo: { email: cfgMail.email_resposta_contabil || 'contabil@scontdf.com.br' },
            subject: msg.assunto, htmlContent: msg.html,
        }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error('Brevo: ' + (json?.message ?? JSON.stringify(json)));
    return { provider: 'brevo', id: json.messageId };
}

// Modo teste: tudo vai só para o e-mail de teste, com aviso no topo.
function aplicarModoTeste(cfg: Record<string, unknown>, para: string[], cc: string[], assunto: string, html: string) {
    if (!cfg.modo_teste) return { para, cc, assunto, html, teste: false };
    const alvo = emailsValidos([cfg.email_teste]);
    if (!alvo.length) throw new Error('Modo teste ligado, mas o e-mail de teste não está configurado (Regras e textos).');
    const aviso = `<div style="background:#fdf1e6;border:1px solid #f3cfa6;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#8a5a1f;">
      <strong>MODO TESTE</strong> — destinatários reais: ${escapeHtml(para.join(', ') || '—')}${cc.length ? ` (cc: ${escapeHtml(cc.join(', '))})` : ''}</div>`;
    return { para: alvo, cc: [], assunto: `[TESTE] ${assunto}`, html: aviso + html, teste: true };
}

type LinhaRel = [string, { nome: string; docs: string[]; alertas: number }];

// Corpo do relatório da chefe (usado no envio real e no e-mail de teste), no padrão visual do Hub.
function htmlRelatorio(curta: string, comp: string, lista: LinhaRel[], portal: string): string {
    const tdBase = 'padding:10px 12px;border-bottom:1px solid #f0f2f5;vertical-align:middle;';
    const linhas = lista.map(([cod, g]) => `
            <tr>
              <td style="${tdBase}"><strong style="color:#4e1820;">${escapeHtml(g.nome)}</strong><br><span style="font-size:12px;color:#888;">${escapeHtml(cod)}</span></td>
              <td style="${tdBase}color:#434343;font-size:13px;">${escapeHtml(g.docs.join(', '))}</td>
              <td style="${tdBase}color:#434343;font-size:13px;text-align:center;">${g.alertas}</td>
            </tr>`).join('');
    const th = 'padding:10px 12px;font-size:12px;font-weight:700;color:#4e1820;text-align:left;';
    return tituloHtml('relatorio', curta) + `
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            <strong>${lista.length}</strong> empresa(s) com BPO financeiro ainda possuem documentos pendentes da competência <strong>${escapeHtml(curta)}</strong>.
          </p>
          ${lista.length ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e6ed;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <tr bgcolor="#f5eae9" style="background-color:#f5eae9;">
              <td style="${th}">Empresa</td><td style="${th}">Pendente</td><td style="${th}text-align:center;">Alertas</td>
            </tr>${linhas}
          </table>` : '<p style="color:#33aa23;margin:0 0 24px;font-weight:600;">✅ Nenhuma pendência.</p>'}
          ${portal ? botaoHtml(`${portal}?competencia=${comp}`, '💼 Abrir o BPO Financeiro') : ''}`;
}

function resposta(obj: unknown, status = 200) {
    return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Não autorizado.');

        // Quem chama precisa ser admin ou equipe Scont (mesma regra da RLS das tabelas).
        const userDb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: pode, error: podeErr } = await userDb.rpc('bpo_pode_gerir');
        if (podeErr || pode !== true) return resposta({ ok: false, error: 'Sem permissão para o BPO Financeiro.' }, 403);
        const { data: u } = await userDb.auth.getUser();
        const quem = u?.user?.email || 'desconhecido';

        const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const body = await req.json() as Record<string, unknown>;
        const acao = String(body.acao || '');
        const comp = String(body.competencia || '');
        if (!/^\d{4}-\d{2}$/.test(comp)) throw new Error('Competência inválida.');
        const { curta, extenso } = competenciaTextos(comp);

        const { data: cfgRow, error: cfgErr } = await db.from('bpo_config').select('*').eq('id', 1).maybeSingle();
        if (cfgErr || !cfgRow) throw new Error('Configuração do BPO não encontrada (rode schema_bpo_documentos.sql).');
        const cfg = cfgRow as Record<string, unknown> & { ignorar_emails_dominio?: string[] };

        const { data: mailRows, error: mailErr } = await db.from('configuracoes_scont').select('chave, valor');
        if (mailErr) throw new Error('Erro ao ler configurações de e-mail: ' + mailErr.message);
        const cfgMail: Record<string, string> = {};
        (mailRows ?? []).forEach((r: { chave: string; valor: string }) => { cfgMail[r.chave] = r.valor ?? ''; });
        const nomeRem = cfgMail.nome_remetente || 'Scont Soluções Contábeis';

        // ── COBRAR (1 e-mail por empresa, com todos os documentos pendentes) ──
        if (acao === 'cobrar') {
            const codigo = String(body.codigo_empresa || '');
            const etapa = String(body.etapa || 'MANUAL').toUpperCase();
            const tipoTexto = String(body.tipo_texto || 'lembrete');
            if (!TIPOS_TEXTO.includes(tipoTexto)) throw new Error('tipo_texto inválido.');
            const tipoIds = (Array.isArray(body.tipo_ids) ? body.tipo_ids : []).map(String);
            if (!codigo || !tipoIds.length) throw new Error('Empresa e documentos são obrigatórios.');

            const [{ data: emp }, { data: rh }, { data: tps }, { data: marc }, { data: jaFoi }] = await Promise.all([
                db.from('bpo_empresas').select('*').eq('codigo_empresa', codigo).maybeSingle(),
                db.from('rh_empresas').select('nome_empresa').eq('codigo_empresa', codigo).maybeSingle(),
                db.from('bpo_tipos_documento').select('id, nome').in('id', tipoIds),
                db.from('bpo_marcacoes').select('tipo_id').eq('competencia', comp).eq('codigo_empresa', codigo).in('tipo_id', tipoIds),
                etapa === 'MANUAL' ? Promise.resolve({ data: null }) :
                    db.from('bpo_alertas').select('id').eq('competencia', comp).eq('codigo_empresa', codigo)
                        .eq('etapa', etapa).eq('ok', true).limit(1).maybeSingle(),
            ]);
            if (jaFoi) return resposta({ ok: true, duplicado: true });
            if (!emp || !(emp as { possui_bpo?: boolean }).possui_bpo) {
                return resposta({ ok: false, error: 'Empresa não está marcada com BPO.' }, 409);
            }
            const dispensados = new Set((marc ?? []).map((m: { tipo_id: string }) => m.tipo_id));
            const docs = (tps ?? []).filter((t: { id: string }) => !dispensados.has(t.id)).map((t: { nome: string }) => t.nome);
            if (!docs.length) return resposta({ ok: false, error: 'Documentos já recebidos ou dispensados.' }, 409);

            const para = emailsValidos((emp as { emails?: string[] }).emails, cfg.ignorar_emails_dominio);
            const cc = emailsValidos((emp as { emails_cc?: string[] }).emails_cc, cfg.ignorar_emails_dominio).filter((e) => !para.includes(e));
            const registrar = async (ok: boolean, dest: string[], teste: boolean, erro?: string) => {
                await db.from('bpo_alertas').insert({
                    competencia: comp, codigo_empresa: codigo, etapa, tipo_texto: tipoTexto, documentos: docs,
                    para: dest, ok, modo_teste: teste, erro: erro || null, enviado_por: quem,
                });
            };
            if (!para.length) {
                await registrar(false, [], !!cfg.modo_teste, 'SEM_EMAIL');
                return resposta({ ok: false, sem_email: true, error: 'Empresa sem e-mail cadastrado.' }, 422);
            }

            const vars: Record<string, string> = {
                cliente: (rh as { nome_empresa?: string } | null)?.nome_empresa || codigo,
                competencia: curta, competencia_extenso: extenso,
                data_limite: dataBr(String(body.data_limite || '')) || 'o quanto antes',
                documentos: docs.map((d) => `- ${d}`).join('\n'),
            };
            const assunto = aplicarVariaveis(String(cfg[`assunto_${tipoTexto}`] || ''), vars);
            const miolo = tituloHtml(tipoTexto, curta) + textoParaHtml(String(cfg[`texto_${tipoTexto}`] || ''), vars);
            const final = aplicarModoTeste(cfg, para, cc, assunto, miolo);
            try {
                const r = await enviar(cfgMail, { para: final.para, cc: final.cc, assunto: final.assunto, html: envelope(nomeRem, final.html) });
                await registrar(true, para, final.teste);
                return resposta({ ok: true, para, modo_teste: final.teste, ...r });
            } catch (e) {
                await registrar(false, para, final.teste, e instanceof Error ? e.message : String(e));
                throw e;
            }
        }

        // ── RELATÓRIO PARA A CHEFE ─────────────────────────────────
        if (acao === 'relatorio') {
            const itens = (Array.isArray(body.itens) ? body.itens : []) as Array<Record<string, unknown>>;
            const para = emailsValidos([cfg.email_chefe]);
            const cc = emailsValidos([...((cfg.emails_copia_relatorio as string[]) || []), cfg.email_operador]).filter((e) => !para.includes(e));
            if (!para.length && !cc.length) throw new Error('Nenhum destinatário para o relatório (preencha o e-mail da chefe em Regras e textos).');

            const porEmpresa = new Map<string, { nome: string; docs: string[]; alertas: number }>();
            itens.forEach((i) => {
                const k = String(i.codigo);
                const g = porEmpresa.get(k) || { nome: String(i.nome || k), docs: [], alertas: Number(i.alertas) || 0 };
                g.docs.push(String(i.documento || ''));
                porEmpresa.set(k, g);
            });
            const lista = Array.from(porEmpresa.entries()).sort((a, b) => a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
            const portal = typeof body.portal_url === 'string' && /^https:\/\//.test(body.portal_url) ? body.portal_url : '';
            const miolo = htmlRelatorio(curta, comp, lista, portal);
            const assunto = aplicarVariaveis(String(cfg.assunto_relatorio || ''), { competencia: curta, competencia_extenso: extenso });
            const destPara = para.length ? para : cc.slice(0, 1);
            const destCc = para.length ? cc : cc.slice(1);
            const final = aplicarModoTeste(cfg, destPara, destCc, assunto, miolo);
            const registrar = async (ok: boolean, erro?: string) => {
                await db.from('bpo_alertas').insert({
                    competencia: comp, codigo_empresa: null, etapa: String(body.etapa || 'MANUAL').toUpperCase(),
                    tipo_texto: 'relatorio', documentos: [], para: destPara, ok, modo_teste: final.teste,
                    erro: erro || null, enviado_por: quem,
                });
            };
            try {
                const r = await enviar(cfgMail, { para: final.para, cc: final.cc, assunto: final.assunto, html: envelope(nomeRem, final.html) });
                await registrar(true);
                return resposta({ ok: true, para: destPara, modo_teste: final.teste, total: lista.length, ...r });
            } catch (e) {
                await registrar(false, e instanceof Error ? e.message : String(e));
                throw e;
            }
        }

        // ── E-MAIL DE TESTE (um texto, com dados fictícios, só para a equipe) ──
        // O destinatário NUNCA vem do chamador: e-mail de teste, senão operador, senão o próprio usuário.
        if (acao === 'teste') {
            const tipoTexto = String(body.tipo_texto || '');
            if (![...TIPOS_TEXTO, 'relatorio'].includes(tipoTexto)) throw new Error('tipo_texto inválido.');
            const para = emailsValidos([cfg.email_teste, cfg.email_operador, quem]).slice(0, 1);
            if (!para.length) throw new Error('Nenhum e-mail de teste disponível (configure o e-mail de teste).');

            const { data: tps } = await db.from('bpo_tipos_documento').select('nome').eq('ativo', true).order('ordem');
            const nomesDocs = (tps ?? []).map((t: { nome: string }) => t.nome);
            const exemplo = nomesDocs.length ? nomesDocs : ['Extrato bancário'];
            const vars: Record<string, string> = {
                cliente: 'EMPRESA EXEMPLO LTDA', competencia: curta, competencia_extenso: extenso,
                data_limite: dataBr(String(body.data_limite || '')) || 'o quanto antes',
                documentos: exemplo.map((d) => `- ${d}`).join('\n'),
            };
            const assuntoBase = String(body.assunto ?? cfg[`assunto_${tipoTexto}`] ?? '').slice(0, 300);
            let miolo: string;
            if (tipoTexto === 'relatorio') {
                const lista: LinhaRel[] = [
                    ['101', { nome: 'EMPRESA EXEMPLO LTDA', docs: exemplo, alertas: 2 }],
                    ['102', { nome: 'OUTRA EMPRESA EXEMPLO SA', docs: [exemplo[0]], alertas: 1 }],
                ];
                miolo = htmlRelatorio(curta, comp, lista, '');
            } else {
                miolo = tituloHtml(tipoTexto, curta) + textoParaHtml(String(body.texto ?? cfg[`texto_${tipoTexto}`] ?? '').slice(0, 20000), vars);
            }
            const aviso = `<div style="background:#eaf1ff;border:1px solid #bcd0f7;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#2c4a7c;">
              <strong>E-MAIL DE TESTE</strong> — exemplo com dados fictícios. Nenhum cliente recebeu esta mensagem.</div>`;
            const assunto = `[TESTE] ${aplicarVariaveis(assuntoBase, vars)}`;
            const r = await enviar(cfgMail, { para, cc: [], assunto, html: envelope(nomeRem, aviso + miolo) });
            return resposta({ ok: true, para, teste: true, ...r });
        }

        throw new Error(`Ação desconhecida: ${acao}`);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return resposta({ ok: false, error: msg }, 400);
    }
});
