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
            empregado: { destinatario: 'pessoal@contatodf.com.br', nomeDestinatario: 'Equipe Pessoal', rotulo: 'Formulário de Empregado' },
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
