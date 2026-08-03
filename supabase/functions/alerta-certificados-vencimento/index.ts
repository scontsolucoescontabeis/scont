import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Mesma lógica de "dias restantes" usada no frontend (js/utils.js daysLeft) ──
function daysLeft(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const today = new Date();
    const appToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const target = new Date(dateStr);
    const targetUTC = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
    const diff = targetUTC.getTime() - appToday.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function nivelAlerta(dias: number | null, cfg: { critico: number; urgente: number; caution: number }): string | null {
    if (dias === null) return null;
    if (dias < 0) return 'vencido';
    if (dias <= cfg.critico) return 'critico';
    if (dias <= cfg.urgente) return 'urgente';
    if (dias <= cfg.caution) return 'atencao';
    return null;
}

function fmtBR(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getUTCFullYear()}`;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const portalUrl = Deno.env.get('CERTIFICADO_DIGITAL_URL') || '';

        const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const { data: cfgRows, error: cfgErr } = await adminDb
            .from('configuracoes_certificados')
            .select('chave, valor');
        if (cfgErr) throw new Error('Erro ao ler configurações: ' + cfgErr.message);

        const cfg: Record<string, string> = {};
        (cfgRows ?? []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor ?? ''; });

        const thresholds = {
            critico: parseInt(cfg.dias_critico || '7', 10),
            urgente: parseInt(cfg.dias_urgente || '15', 10),
            caution: parseInt(cfg.dias_caution || '30', 10),
        };
        const emails = (cfg.emails_alerta || '').split(',').map(e => e.trim()).filter(Boolean);

        const { data: certs, error: certErr } = await adminDb
            .from('certificados')
            .select('id, empresa_id, tipo_id, data_vencimento, ativo, ultimo_alerta_nivel')
            .is('deleted_at', null);
        if (certErr) throw new Error('Erro ao ler certificados: ' + certErr.message);

        let processed = 0;
        let alerted = 0;

        for (const cert of certs ?? []) {
            if (cert.ativo === false) continue;
            processed++;

            const dias = daysLeft(cert.data_vencimento);
            const nivel = nivelAlerta(dias, thresholds);

            if (!nivel || nivel === cert.ultimo_alerta_nivel) continue;

            if (emails.length) {
                for (const destinatario of emails) {
                    try {
                        await fetch(`${SUPABASE_URL}/functions/v1/enviar-email`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                            },
                            body: JSON.stringify({
                                destinatario,
                                assunto: `Certificado digital — ${cert.empresa_id} (${nivel})`,
                                params: {
                                    tipo: 'alerta_certificado_vencimento',
                                    empresa: cert.empresa_id,
                                    tipo_certificado: cert.tipo_id,
                                    nivel,
                                    dias,
                                    vencimento: fmtBR(cert.data_vencimento),
                                    portal_url: portalUrl,
                                },
                            }),
                        });
                    } catch (e) {
                        console.error('Falha ao enviar alerta para', destinatario, e);
                    }
                }
            }

            const { error: updErr } = await adminDb
                .from('certificados')
                .update({ ultimo_alerta_nivel: nivel, ultimo_alerta_em: new Date().toISOString() })
                .eq('id', cert.id);
            if (updErr) console.error('Falha ao atualizar ultimo_alerta_nivel:', cert.id, updErr.message);

            alerted++;
        }

        return new Response(JSON.stringify({ ok: true, processed, alerted, destinatarios: emails.length }), {
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
