import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Envia (ou testa) via Brevo usando a chave lida server-side, via service
// role — o cliente (Mala Direta, Projeto Mala Direta/index.html) nunca vê
// nem manipula a chave de API diretamente. Ver
// Projeto Mala Direta/schema-mala-direta-brevo-seguranca.sql para o motivo
// (chave ficava exposta no navegador e no DevTools a cada envio).
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const { data: cfgRows, error: cfgErr } = await adminDb
            .from('mala_direta_config')
            .select('chave, valor')
            .in('chave', ['brevo_key', 'brevo_nome', 'brevo_email']);
        if (cfgErr) throw new Error('Erro ao ler configuração: ' + cfgErr.message);

        const cfg: Record<string, string> = {};
        (cfgRows ?? []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor ?? ''; });

        if (!cfg.brevo_key) {
            return new Response(JSON.stringify({ ok: false, error: 'Brevo não configurado (chave ausente).' }), {
                status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const body = await req.json().catch(() => ({}));
        const modo = body.modo === 'testar' ? 'testar' : 'enviar';

        if (modo === 'testar') {
            const r = await fetch('https://api.brevo.com/v3/account', {
                headers: { 'api-key': cfg.brevo_key, 'accept': 'application/json' },
            });
            if (!r.ok) {
                return new Response(JSON.stringify({ ok: false, error: 'Chave inválida ou sem permissão.' }), {
                    status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
                });
            }
            const d = await r.json();
            return new Response(JSON.stringify({ ok: true, conta: d.email || d.companyName || 'OK' }), {
                headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        // modo === 'enviar' — destinatarios é um array porque um único
        // "envio" pode ter mais de um e-mail (campo separado por vírgula
        // no cadastro do contato), todos recebendo a mesma mensagem numa
        // única chamada à Brevo, igual ao comportamento anterior client-side.
        const { destinatarios, assunto, htmlContent, textContent } = body;
        if (!Array.isArray(destinatarios) || !destinatarios.length || !assunto || !htmlContent) {
            return new Response(JSON.stringify({ ok: false, error: 'Parâmetros de envio incompletos.' }), {
                status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': cfg.brevo_key },
            body: JSON.stringify({
                sender: { name: cfg.brevo_nome || 'SCONT', email: cfg.brevo_email },
                to: destinatarios.map((d: { email: string; nome?: string }) => ({ email: d.email, name: d.nome || '' })),
                subject: assunto,
                htmlContent,
                textContent: textContent || '',
            }),
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            return new Response(JSON.stringify({ ok: false, error: err.message || `HTTP ${resp.status}` }), {
                status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ ok: true }), {
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
