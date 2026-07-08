'use strict';

/**
 * Utilitário global de notificações — SCONT
 * Email: Brevo ou SMTP via Supabase Edge Function (credenciais seguras no servidor)
 * WhatsApp: wa.me (abre chat com mensagem pré-preenchida)
 * Config armazenada em Supabase: tabela configuracoes_scont
 */
const Notificacoes = (() => {
    let _cfg = null;
    let _db  = null;

    function _getDb() {
        if (!_db) _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        return _db;
    }

    // ── Carrega configurações públicas do Supabase (com cache) ──
    // Nota: a Resend API key NÃO é lida aqui — fica no servidor (Edge Function)
    async function carregarConfig(forcar = false) {
        if (_cfg && !forcar) return _cfg;
        const { data, error } = await _getDb()
            .from('configuracoes_scont')
            .select('chave, valor');
        if (error) throw new Error('Erro ao carregar configurações: ' + error.message);
        _cfg = {};
        (data || []).forEach(r => { _cfg[r.chave] = r.valor || ''; });
        return _cfg;
    }

    // ── Envia e-mail via Supabase Edge Function (Resend no servidor) ──
    async function enviarEmail({ destinatario, nomeDestinatario, assunto, params = {} }) {
        if (!destinatario) throw new Error('Destinatário obrigatório.');

        // Obter sessão ativa do Supabase (necessária para autenticar a Edge Function)
        const { data: { session }, error: sessErr } = await _getDb().auth.getSession();
        if (sessErr || !session) throw new Error('Sessão expirada. Faça login novamente.');

        const edgeFnUrl = `${SUPABASE_URL}/functions/v1/enviar-email`;

        const resp = await fetch(edgeFnUrl, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey':        SUPABASE_KEY,
            },
            body: JSON.stringify({ destinatario, nomeDestinatario, assunto, params }),
        });

        const json = await resp.json();
        if (!json.ok) throw new Error(json.error || 'Falha no envio do e-mail.');
        return json;
    }

    // ── Abre WhatsApp para o DESTINATÁRIO (SCONT envia para cliente) ──
    function abrirWhatsAppCliente({ numero, mensagem }) {
        const n = (numero || '').replace(/\D/g, '');
        if (!n) throw new Error('Número de telefone inválido.');
        const comDDI = n.startsWith('55') ? n : '55' + n;
        const url = `https://wa.me/${comDDI}?text=${encodeURIComponent(mensagem || '')}`;
        window.open(url, '_blank');
        return url;
    }

    // ── Gera link para clientes contatarem a SCONT ───────────────
    async function getLinkWhatsAppScont(mensagem) {
        const cfg = await carregarConfig();
        const n = (cfg.whatsapp_numero || '').replace(/\D/g, '');
        if (!n) throw new Error('Número WhatsApp da SCONT não configurado. Acesse Admin → Configurações.');
        return `https://wa.me/${n}?text=${encodeURIComponent(mensagem || '')}`;
    }

    async function abrirWhatsAppScont(mensagem) {
        const url = await getLinkWhatsAppScont(mensagem);
        window.open(url, '_blank');
        return url;
    }

    async function getConfig()         { return carregarConfig(); }
    async function recarregarConfig()  { return carregarConfig(true); }

    return {
        enviarEmail,
        abrirWhatsAppCliente,
        getLinkWhatsAppScont,
        abrirWhatsAppScont,
        getConfig,
        recarregarConfig,
    };
})();
