// ============================================================
// Notificação por e-mail: novo formulário recebido
// Reaproveita a Edge Function "enviar-email" já existente no
// projeto (sem autenticação de usuário — usa a chave anon).
// Best-effort: nunca lança erro, só loga aviso no console.
// ============================================================

function _iconeNotificacaoFormulario(tipo) {
    return { empregado: '📋', registro: '🏢', alteracao: '📝' }[tipo] || '📨';
}

window.notificarNovoFormulario = async function notificarNovoFormulario(tipo, titulo, campos) {
    try {
        const config = {
            empregado: { destinatario: 'pessoal@scontdf.com.br', nomeDestinatario: 'Equipe Pessoal', rotulo: 'Formulário de Empregado' },
            registro:  { destinatario: 'contato@scontdf.com.br',  nomeDestinatario: 'Equipe Administrativo', rotulo: 'Formulário de Registro de Empresa' },
            alteracao: { destinatario: 'contato@scontdf.com.br',  nomeDestinatario: 'Equipe Administrativo', rotulo: 'Formulário de Alteração de Empresa' },
        }[tipo];

        if (!config) {
            console.warn('[notificar-formulario] tipo desconhecido:', tipo);
            return;
        }

        const linhas = (campos || [])
            .filter(c => c.valor !== null && c.valor !== undefined && String(c.valor).trim() !== '')
            .map(c => `<p style="margin:0 0 8px;font-size:14px;color:#434343;"><strong>${c.label}:</strong> ${c.valor}</p>`)
            .join('');

        const mensagem = `
          <p style="margin:0 0 16px;font-size:14px;color:#434343;">Um novo <strong>${config.rotulo}</strong> foi recebido${titulo ? ` — <strong>${titulo}</strong>` : ''}.</p>
          ${linhas}
        `;

        const resp = await fetch(`${window.SUPABASE_URL}/functions/v1/enviar-email`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'apikey':        window.SUPABASE_KEY,
            },
            body: JSON.stringify({
                destinatario:     config.destinatario,
                nomeDestinatario: config.nomeDestinatario,
                assunto:          `${_iconeNotificacaoFormulario(tipo)} Novo ${config.rotulo}${titulo ? ` — ${titulo}` : ''}`,
                params:           { mensagem },
            }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.ok === false) {
            console.warn('[notificar-formulario] falha ao enviar notificação:', json.error || resp.status);
        }
    } catch (err) {
        console.warn('[notificar-formulario] erro ao notificar novo formulário:', err);
    }
};

// ============================================================
// Pedido de validação ao cliente: e-mail com links "Confirmar
// Dados" e "Solicitar Correção" (validar-formulario.html /
// rejeitar-formulario.html). Best-effort, mesmo padrão acima.
// ============================================================

const _TIPO_LABEL_VALIDACAO = {
    registro:  'Registro de Empresa',
    alteracao: 'Alteração de Empresa',
    empregado: 'Admissão de Empregado',
};

window.enviarSolicitacaoValidacaoCliente = async function enviarSolicitacaoValidacaoCliente(tipo, formId, nomeExibicao, emailCliente, token, anexoPdf) {
    try {
        const tipoLabel = _TIPO_LABEL_VALIDACAO[tipo];
        if (!tipoLabel) {
            console.warn('[notificar-formulario] tipo desconhecido para validação:', tipo);
            return;
        }
        if (!emailCliente) {
            console.warn('[notificar-formulario] sem e-mail de destino para pedido de validação');
            return;
        }

        const baseDir = window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const query = `id=${encodeURIComponent(formId)}&tipo=${encodeURIComponent(tipo)}&token=${encodeURIComponent(token)}`;
        const linkValidar = `${baseDir}validar-formulario.html?${query}`;
        const linkRejeitar = `${baseDir}rejeitar-formulario.html?${query}`;

        const resp = await fetch(`${window.SUPABASE_URL}/functions/v1/enviar-email`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${window.SUPABASE_KEY}`,
                'apikey':        window.SUPABASE_KEY,
            },
            body: JSON.stringify({
                destinatario: emailCliente,
                assunto:      `📋 Validação necessária — ${tipoLabel} — ${nomeExibicao}`,
                params: {
                    tipo: 'solicitacao_validacao_formulario',
                    tipoFormularioLabel: tipoLabel,
                    nomeExibicao,
                    linkValidar,
                    linkRejeitar,
                },
                ...(anexoPdf && anexoPdf.conteudoBase64 ? { anexos: [anexoPdf] } : {}),
            }),
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json.ok === false) {
            console.warn('[notificar-formulario] falha ao enviar pedido de validação:', json.error || resp.status);
        }
    } catch (err) {
        console.warn('[notificar-formulario] erro ao enviar pedido de validação:', err);
    }
};
