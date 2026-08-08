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
        <tr><td bgcolor="#f8f9fa" style="background-color:#f8f9fa;padding:18px;text-align:center;border:1px solid #e0e6ed;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0;font-size:11px;color:#aaa;">© 2026 ${nomeRemetente} · Todos os direitos reservados</p>
        </td></tr>`;
}

function _cabecalho(nomeRemetente: string): string {
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
          <h1 style="color:#4e1820;margin:0;font-size:22px;font-weight:700;">${nomeRemetente}</h1>
          <p style="color:#8b4a4a;margin:6px 0 0;font-size:13px;">Contabilidade com excelência</p>
        </td></tr>
        <tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:36px 32px;border:1px solid #e0e6ed;border-top:none;">`;
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
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
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

    // ── Alerta: fechamento aguardando validação (Diário Contábil) ──
    if (tipo === 'validacao_fechamento') {
        const empresaNome  = (params.empresa as string)     || '';
        const mesAno       = (params.mes_ano as string)     || '';
        const enviadoPor   = (params.enviado_por as string) || 'um responsável';
        const portalUrl    = (params.portal_url as string)  || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">🔔 Fechamento aguardando validação</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            <strong>${enviadoPor}</strong> encerrou a contabilidade de <strong>${mesAno}</strong>
            da empresa <strong>${empresaNome}</strong> e enviou para validação da equipe Scont.
          </p>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📔 Acessar o Diário Contábil
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Fechamento aprovado pela equipe Scont (Diário Contábil) ──
    if (tipo === 'fechamento_aprovado') {
        const empresaNome = (params.empresa as string)    || '';
        const mesAno      = (params.mes_ano as string)    || '';
        const portalUrl   = (params.portal_url as string) || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">✅ Fechamento aprovado</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            O fechamento de <strong>${mesAno}</strong> da empresa <strong>${empresaNome}</strong>
            foi <strong style="color:#33aa23;">aprovado</strong> pela equipe Scont.
          </p>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📔 Acessar o Diário Contábil
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Fechamento rejeitado pela equipe Scont (Diário Contábil) ──
    if (tipo === 'fechamento_rejeitado') {
        const empresaNome = (params.empresa as string)    || '';
        const mesAno      = (params.mes_ano as string)    || '';
        const motivo      = (params.motivo as string)     || '';
        const portalUrl   = (params.portal_url as string) || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">❌ Fechamento rejeitado</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            O fechamento de <strong>${mesAno}</strong> da empresa <strong>${empresaNome}</strong>
            foi <strong style="color:#E74C3C;">rejeitado</strong> pela equipe Scont e voltou para aberto.
          </p>

          ${motivo ? `
          <div style="background:#FFF1F2;border-left:4px solid #E74C3C;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:20px;">
            <p style="margin:0;font-size:13px;color:#991B1B;font-weight:600;">Motivo:</p>
            <p style="margin:6px 0 0;font-size:13px;color:#434343;line-height:1.6;">${motivo}</p>
          </div>` : ''}

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📔 Acessar o Diário Contábil
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Fluxo de fechamento de folha concluído (Controle de Fechamento) ──
    if (tipo === 'fechamento_folha_concluido') {
        const empresaNome  = (params.empresa as string)      || '';
        const competencia  = (params.competencia as string)  || '';
        const portalUrl    = (params.portal_url as string)   || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#33aa23;margin:0 0 8px;font-size:20px;">✅ Fechamento de folha concluído</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            Todas as etapas do fluxo de fechamento da folha de <strong>${competencia}</strong>
            da empresa <strong>${empresaNome}</strong> foram <strong style="color:#33aa23;">concluídas</strong>.
          </p>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📊 Acessar o Controle de Fechamento
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Alerta: pendência de execução marcada na grade (Diário Contábil) ──
    if (tipo === 'pendencia_execucao') {
        const empresaNome  = (params.empresa as string)      || '';
        const mesAno       = (params.mes_ano as string)      || '';
        const marcadoPor   = (params.marcado_por as string)  || 'um responsável';
        const motivo       = (params.motivo as string)       || '';
        const portalUrl    = (params.portal_url as string)   || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#E74C3C;margin:0 0 8px;font-size:20px;">🔴 Pendência de execução</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            <strong>${marcadoPor}</strong> marcou uma pendência de execução em <strong>${mesAno}</strong>
            da empresa <strong>${empresaNome}</strong>.
          </p>

          ${motivo ? `
          <div style="background:#FFF1F2;border-left:4px solid #E74C3C;border-radius:0 6px 6px 0;padding:14px 18px;margin-bottom:20px;">
            <p style="margin:0;font-size:13px;color:#991B1B;font-weight:600;">Motivo:</p>
            <p style="margin:6px 0 0;font-size:13px;color:#434343;line-height:1.6;">${motivo}</p>
          </div>` : ''}

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📔 Acessar o Diário Contábil
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Alerta: pendência de execução sanada na grade (Diário Contábil) ──
    if (tipo === 'pendencia_resolvida') {
        const empresaNome  = (params.empresa as string)      || '';
        const mesAno       = (params.mes_ano as string)      || '';
        const resolvidoPor = (params.resolvido_por as string) || 'um responsável';
        const portalUrl    = (params.portal_url as string)   || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#22A366;margin:0 0 8px;font-size:20px;">🟢 Pendência sanada</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            <strong>${resolvidoPor}</strong> sanou a pendência de execução em <strong>${mesAno}</strong>
            da empresa <strong>${empresaNome}</strong>. O mês voltou a ficar em andamento.
          </p>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📔 Acessar o Diário Contábil
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Documentação marcada como disponível (Diário Contábil) ──
    if (tipo === 'documentacao_disponivel') {
        const empresaNome = (params.empresa as string)     || '';
        const mesAno      = (params.mes_ano as string)     || '';
        const marcadoPor  = (params.marcado_por as string) || 'a equipe Scont';
        const portalUrl   = (params.portal_url as string)  || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">📄 Documentação disponível</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            <strong>${marcadoPor}</strong> marcou a documentação de <strong>${mesAno}</strong>
            da empresa <strong>${empresaNome}</strong> como <strong style="color:#33aa23;">disponível</strong>.
            Você já pode iniciar o lançamento contábil do mês.
          </p>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📔 Acessar o Diário Contábil
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Alerta: certificado digital entrou em limiar de vencimento ──
    if (tipo === 'alerta_certificado_vencimento') {
        const empresaNome   = (params.empresa as string)        || '';
        const tipoCert      = (params.tipo_certificado as string) || '';
        const nivel         = (params.nivel as string)          || '';
        const dias          = params.dias as number;
        const vencimento    = (params.vencimento as string)     || '';
        const portalUrl     = (params.portal_url as string)     || '';

        const nivelInfo: Record<string, { label: string; cor: string; emoji: string }> = {
            atencao: { label: 'Atenção',  cor: '#F5A623', emoji: '🟡' },
            urgente: { label: 'Urgente',  cor: '#E8890C', emoji: '🟠' },
            critico: { label: 'Crítico',  cor: '#E74C3C', emoji: '🔴' },
            vencido: { label: 'Vencido',  cor: '#B91C1C', emoji: '⛔' },
        };
        const info = nivelInfo[nivel] || { label: nivel, cor: '#4e1820', emoji: '🔔' };
        const diasTexto = typeof dias === 'number'
            ? (dias < 0 ? `vencido há ${Math.abs(dias)} dia(s)` : `${dias} dia(s) restante(s)`)
            : '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:${info.cor};margin:0 0 8px;font-size:20px;">${info.emoji} Certificado digital — ${info.label}</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            O certificado ${tipoCert ? `<strong>${tipoCert}</strong> ` : ''}da empresa <strong>${empresaNome}</strong>
            ${vencimento ? `vence em <strong>${vencimento}</strong>` : ''}${diasTexto ? ` (${diasTexto})` : ''}.
          </p>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              🔐 Acessar Certificados Digitais
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Certificado renovado enquanto estava em alerta ──────────
    if (tipo === 'certificado_renovado_alerta_resolvido') {
        const empresaNome    = (params.empresa as string)         || '';
        const tipoCert       = (params.tipo_certificado as string) || '';
        const novoVencimento = (params.novo_vencimento as string)  || '';
        const portalUrl      = (params.portal_url as string)       || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#33aa23;margin:0 0 8px;font-size:20px;">✅ Certificado renovado</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            O certificado ${tipoCert ? `<strong>${tipoCert}</strong> ` : ''}da empresa <strong>${empresaNome}</strong>
            foi renovado${novoVencimento ? ` — novo vencimento em <strong>${novoVencimento}</strong>` : ''}.
            O alerta de vencimento para este certificado foi encerrado.
          </p>

          ${portalUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${portalUrl}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              🔐 Acessar Certificados Digitais
            </a>
          </td></tr></table>` : ''}
        ` + _rodape(nomeRemetente) + _fechamento();
    }

    // ── Documentos de Benefícios / Folha de Ponto (Controle de Frequência) ──
    if (tipo === 'documentos_frequencia') {
        const tipoDocumento = (params.tipoDocumento as string) || 'Documentos';
        const competencia   = (params.competencia as string)   || '';
        const destino       = (params.destino as string)       || '';

        return _cabecalho(nomeRemetente) + `
          <h2 style="color:#4e1820;margin:0 0 8px;font-size:20px;">📎 ${tipoDocumento} — ${competencia}</h2>
          <p style="color:#434343;margin:0 0 16px;line-height:1.7;">
            Segue${destino ? `m em anexo os documentos de <strong>${tipoDocumento}</strong> de <strong>${destino}</strong>` : ' em anexo os documentos'}
            referentes à competência <strong>${competencia}</strong>.
          </p>
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
            <a href="${linkApresentacao}" style="background-color:#f5eae9;color:#4e1820;border:2px solid #4e1820;padding:13px 34px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
              📄 Acessar Apresentação
            </a>
          </td></tr></table>
          <p style="font-size:12px;color:#999;text-align:center;word-break:break-all;margin:0 0 24px;">${linkApresentacao}</p>
          ` : ''}
    ` + _rodape(nomeRemetente) + _fechamento();
}

// ── Envia via Brevo (API HTTP) ─────────────────────────────────
async function enviarBrevo(cfg: Record<string, string>, payload: {
    nomeRemetente: string; emailRemetente: string; to: string; subject: string; html: string;
    anexos?: Array<{ nome: string; conteudoBase64: string }>;
}) {
    if (!cfg.brevo_api_key) throw new Error('Brevo API Key não configurada. Acesse Admin → Configurações.');

    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: { 'api-key': cfg.brevo_api_key, 'Content-Type': 'application/json', 'accept': 'application/json' },
        body:    JSON.stringify({
            sender:      { name: payload.nomeRemetente, email: payload.emailRemetente },
            to:          [{ email: payload.to }],
            subject:     payload.subject,
            htmlContent: payload.html,
            ...(payload.anexos?.length ? { attachment: payload.anexos.map(a => ({ content: a.conteudoBase64, name: a.nome })) } : {}),
        }),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error('Brevo: ' + (json?.message ?? JSON.stringify(json)));
    return { provider: 'brevo', id: json.messageId };
}

// ── Envia via SMTP (Outlook, Gmail, etc.) via nodemailer ─────
async function enviarSmtp(cfg: Record<string, string>, payload: {
    from: string; to: string; subject: string; html: string;
    anexos?: Array<{ nome: string; conteudoBase64: string }>;
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
        ...(payload.anexos?.length ? { attachments: payload.anexos.map(a => ({ filename: a.nome, content: a.conteudoBase64, encoding: 'base64' })) } : {}),
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
            destinatario?: string;
            usuarioId?: string;
            nomeDestinatario?: string;
            assunto?: string;
            params?: Record<string, unknown>;
            anexos?: Array<{ nome: string; conteudoBase64: string }>;
        };
        const { usuarioId, assunto, anexos } = body;
        let { destinatario, nomeDestinatario } = body;
        const params: Record<string, unknown> = body.params ?? {};

        // Buscar config no banco usando service role (nunca exposto ao browser)
        const adminDb = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        // Quando o chamador só tem o usuario_id (ex.: equipe Scont notificando
        // um Prestador de Serviço que não é dono da sessão), resolve o e-mail
        // pelo cadastro em solicitacoes_acesso via service role — contorna a
        // RLS que só permite ao próprio usuário ou a um admin do portal ler
        // essa tabela, e garante que o destino é sempre o e-mail do pedido de
        // acesso, nunca um valor arbitrário vindo do cliente.
        if (usuarioId) {
            const { data: solicitacao, error: solErr } = await adminDb
                .from('solicitacoes_acesso')
                .select('email, nome')
                .eq('id', usuarioId)
                .maybeSingle();
            if (solErr) throw new Error('Erro ao localizar e-mail do usuário: ' + solErr.message);
            if (!solicitacao) throw new Error('Usuário não encontrado em solicitacoes_acesso.');
            destinatario = solicitacao.email;
            if (!nomeDestinatario) nomeDestinatario = solicitacao.nome;
        }

        if (!destinatario) throw new Error('Campo "destinatario" ou "usuarioId" é obrigatório.');

        const { data: cfgRows, error: cfgErr } = await adminDb
            .from('configuracoes_scont')
            .select('chave, valor');

        if (cfgErr) throw new Error('Erro ao ler configurações: ' + cfgErr.message);

        const cfg: Record<string, string> = {};
        (cfgRows ?? []).forEach((r: { chave: string; valor: string }) => {
            cfg[r.chave] = r.valor ?? '';
        });

        const nomeRem  = cfg.nome_remetente  || 'Scont Soluções Contábeis';
        const emailRem = cfg.email_remetente || cfg.smtp_usuario || 'contato@scontdf.com.br';
        const provedor = cfg.email_provedor  || 'brevo';

        const mailPayload = {
            from:    `${nomeRem} <${emailRem}>`,
            to:      destinatario,
            subject: assunto || 'Apresentação Personalizada — Scont Soluções Contábeis',
            html:    montarHtml(cfg, params, nomeDestinatario || ''),
        };

        const result = provedor === 'smtp'
            ? await enviarSmtp(cfg, { ...mailPayload, anexos })
            : await enviarBrevo(cfg, { nomeRemetente: nomeRem, emailRemetente: emailRem, to: destinatario, subject: mailPayload.subject, html: mailPayload.html, anexos });

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
