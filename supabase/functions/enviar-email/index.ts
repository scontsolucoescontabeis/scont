import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Rodapé padrão de todos os e-mails ────────────────────────
function _rodape(nomeRemetente: string): string {
    return `
          <hr style="border:none;border-top:1px solid #e0e6ed;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:12px;color:#999;text-align:center;line-height:1.8;">
            <strong style="color:#4e1820;">Nossos Departamentos</strong><br>
            📋 Fiscal: <a href="mailto:fiscal@scontdf.com.br" style="color:#b47938;">fiscal@scontdf.com.br</a><br>
            👥 Pessoal: <a href="mailto:pessoal@scontdf.com.br" style="color:#b47938;">pessoal@scontdf.com.br</a><br>
            📚 Contábil: <a href="mailto:contabil@scontdf.com.br" style="color:#b47938;">contabil@scontdf.com.br</a><br>
            🏢 Administrativo: <a href="mailto:contato@scontdf.com.br" style="color:#b47938;">contato@scontdf.com.br</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f8f9fa;padding:18px;text-align:center;border:1px solid #e0e6ed;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0;font-size:11px;color:#aaa;">© 2026 ${nomeRemetente} · Todos os direitos reservados</p>
        </td></tr>`;
}

function _cabecalho(nomeRemetente: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#4e1820,#3a1018);padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">${nomeRemetente}</h1>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Contabilidade com excelência</p>
        </td></tr>
        <tr><td style="background:#ffffff;padding:36px 32px;border:1px solid #e0e6ed;border-top:none;">`;
}

function _fechamento(): string {
    return `
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── Monta o HTML do e-mail ────────────────────────────────────
function montarHtml(cfg: Record<string, string>, params: Record<string, unknown>, nomeDestinatario: string): string {
    const nomeDest      = nomeDestinatario || 'Cliente';
    const nomeRemetente = cfg.nome_remetente || 'Scont Soluções Contábeis';
    const tipo          = (params.tipo as string) || '';

    // ── Aprovação de acesso ───────────────────────────────────
    if (tipo === 'aprovacao') {
        const portalUrl  = (params.portal_url as string) || '';
        const ferramentas = Array.isArray(params.ferramentas) ? params.ferramentas as Array<{nome:string;icone:string;descricao:string;url:string}> : [];

        const listaFerrs = ferramentas.map(f => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #f0f2f5;vertical-align:middle;">
                <span style="font-size:20px;margin-right:10px;">${f.icone || '🔧'}</span>
                <strong style="color:#4e1820;">${f.nome}</strong>
                ${f.descricao ? `<br><span style="font-size:12px;color:#888;padding-left:30px;">${f.descricao}</span>` : ''}
              </td>
            </tr>`).join('');

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">Olá, ${nomeDest}! 🎉</h2>
          <p style="color:#434343;margin:0 0 20px;line-height:1.7;">Ficamos felizes em informar que sua solicitação de acesso ao <strong>Portal SCONT</strong> foi <strong style="color:#33aa23;">aprovada</strong>!</p>

          <p style="color:#434343;margin:0 0 12px;font-weight:600;font-size:14px;">Ferramentas liberadas para você:</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e6ed;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            ${listaFerrs || '<tr><td style="padding:12px;color:#888;font-size:13px;">Nenhuma ferramenta registrada.</td></tr>'}
          </table>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background:linear-gradient(135deg,#4e1820,#3a1018);color:white;padding:15px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              🏠 Acessar o Portal
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Rejeição de acesso ────────────────────────────────────
    if (tipo === 'rejeicao') {
        const motivo = (params.motivo as string) || '';
        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">Olá, ${nomeDest}.</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">Agradecemos seu interesse no <strong>Portal SCONT</strong>. Após análise, informamos que sua solicitação de acesso <strong style="color:#E74C3C;">não foi aprovada</strong> no momento.</p>

          ${motivo ? `
          <div style="background:#FFF1F2;border-left:4px solid #E74C3C;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:20px;">
            <p style="margin:0;font-size:13px;color:#991B1B;font-weight:600;">Motivo:</p>
            <p style="margin:6px 0 0;font-size:13px;color:#434343;line-height:1.6;">${motivo}</p>
          </div>` : ''}

          <p style="color:#434343;font-size:13px;line-height:1.7;">Em caso de dúvidas ou para mais informações, entre em contato com nossa equipe pelos canais abaixo.</p>
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Template padrão (apresentação) ────────────────────────
    const empresa          = (params.empresa as string)           || '';
    const mensagem         = (params.mensagem as string)          || 'Preparamos uma apresentação personalizada para sua empresa. Acesse o link abaixo!';
    const linkApresentacao = (params.link_apresentacao as string) || '';

    return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 16px;font-size:20px;">Olá, ${nomeDest}! 👋</h2>
          ${empresa ? `<p style="color:#434343;margin:0 0 12px;">Preparamos uma apresentação personalizada para <strong>${empresa}</strong>.</p>` : ''}
          <p style="color:#434343;margin:0 0 20px;line-height:1.7;">${mensagem}</p>
          ${linkApresentacao ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 0;">
            <a href="${linkApresentacao}" style="background:linear-gradient(135deg,#4e1820,#3a1018);color:white;padding:15px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📄 Acessar Apresentação
            </a>
          </td></tr></table>
          <p style="font-size:12px;color:#999;text-align:center;word-break:break-all;margin:0 0 24px;">${linkApresentacao}</p>
          ` : ''}
    ` + _rodape(nomeRemetente) + _fechamento();
}

// ── Envia via Resend (API HTTP) ───────────────────────────────
async function enviarResend(cfg: Record<string, string>, payload: {
    from: string; to: string; subject: string; html: string;
}) {
    if (!cfg.resend_api_key) throw new Error('Resend API Key não configurada. Acesse Admin → Configurações.');

    const resp = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ from: payload.from, to: [payload.to], subject: payload.subject, html: payload.html }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error('Resend: ' + (json?.message ?? JSON.stringify(json)));
    return { provider: 'resend', id: json.id };
}

// ── Envia via SMTP (Outlook, Gmail, etc.) via nodemailer ─────
async function enviarSmtp(cfg: Record<string, string>, payload: {
    from: string; to: string; subject: string; html: string;
}) {
    if (!cfg.smtp_host || !cfg.smtp_usuario || !cfg.smtp_senha) {
        throw new Error('Configurações SMTP incompletas. Acesse Admin → Configurações → SMTP.');
    }

    const porta   = parseInt(cfg.smtp_porta || '587');
    const useSSL  = cfg.smtp_seguranca === 'SSL';   // true = porta 465, false = STARTTLS (587)

    const transporter = nodemailer.createTransport({
        host:   cfg.smtp_host,
        port:   porta,
        secure: useSSL,
        auth:   { user: cfg.smtp_usuario, pass: cfg.smtp_senha },
        tls:    { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
        from:    payload.from,
        to:      payload.to,
        subject: payload.subject,
        html:    payload.html,
    });

    return { provider: 'smtp', id: info.messageId };
}

// ── Handler principal ─────────────────────────────────────────
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }

    try {
        if (!req.headers.get('Authorization')) throw new Error('Não autorizado.');

        const body = await req.json() as {
            destinatario: string;
            nomeDestinatario?: string;
            assunto?: string;
            params?: Record<string, unknown>;
        };
        const { destinatario, nomeDestinatario, assunto } = body;
        const params: Record<string, unknown> = body.params ?? {};
        if (!destinatario) throw new Error('Campo "destinatario" é obrigatório.');

        // Buscar config no banco usando service role (nunca exposto ao browser)
        const adminDb = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const { data: cfgRows, error: cfgErr } = await adminDb
            .from('configuracoes_scont')
            .select('chave, valor');

        if (cfgErr) throw new Error('Erro ao ler configurações: ' + cfgErr.message);

        const cfg: Record<string, string> = {};
        (cfgRows ?? []).forEach((r: { chave: string; valor: string }) => {
            cfg[r.chave] = r.valor ?? '';
        });

        const nomeRem  = cfg.nome_remetente  || 'Scont Soluções Contábeis';
        const emailRem = cfg.email_remetente || cfg.smtp_usuario || 'onboarding@resend.dev';
        const provedor = cfg.email_provedor  || 'resend';

        const mailPayload = {
            from:    `${nomeRem} <${emailRem}>`,
            to:      destinatario,
            subject: assunto || 'Apresentação Personalizada — Scont Soluções Contábeis',
            html:    montarHtml(cfg, params, nomeDestinatario || ''),
        };

        const result = provedor === 'smtp'
            ? await enviarSmtp(cfg, mailPayload)
            : await enviarResend(cfg, mailPayload);

        return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { ...CORS, 'Content-Type': 'application/json' },
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 400,
            headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }
});
