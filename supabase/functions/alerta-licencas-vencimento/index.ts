import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Mesma lógica de "dias restantes" usada em Certificado Digital ──
function daysLeft(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const today = new Date();
    const appToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const target = new Date(dateStr);
    const targetUTC = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
    const diff = targetUTC.getTime() - appToday.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function nivelAlerta(dias: number | null, diasAlerta: number): string | null {
    if (dias === null) return null;
    if (dias < 0) return 'vencido';
    if (dias <= diasAlerta) return 'proximo';
    return null;
}

function fmtBR(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getUTCFullYear()}`;
}

type Documento = {
    id: string;
    empresa_id: string | null;
    estabelecimento: string | null;
    tipo: string | null;
    numero: string | null;
    data_validade: string | null;
    ativo: boolean | null;
    ultimo_alerta_nivel: string | null;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }

    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const portalUrl = Deno.env.get('LICENCAS_URL') || '';

        const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        const { data: cfgRows, error: cfgErr } = await adminDb
            .from('configuracoes_licencas')
            .select('chave, valor');
        if (cfgErr) throw new Error('Erro ao ler configurações: ' + cfgErr.message);

        const cfg: Record<string, string> = {};
        (cfgRows ?? []).forEach((r: { chave: string; valor: string }) => { cfg[r.chave] = r.valor ?? ''; });

        const ativado = cfg.alertas_ativado === 'true';
        const diasAlerta = parseInt(cfg.dias_alerta || '30', 10);
        const emails = (cfg.emails_alerta || '').split(',').map(e => e.trim()).filter(Boolean);

        if (!ativado || !emails.length) {
            return new Response(JSON.stringify({ ok: true, processed: 0, alerted: 0, motivo: !ativado ? 'alertas desativados' : 'sem destinatarios configurados' }), {
                headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const { data: empresas, error: empErr } = await adminDb
            .from('rh_empresas')
            .select('id, nome_empresa');
        if (empErr) throw new Error('Erro ao ler empresas: ' + empErr.message);
        const nomeEmpresaPorId: Record<string, string> = {};
        (empresas ?? []).forEach((e: { id: string; nome_empresa: string }) => { nomeEmpresaPorId[e.id] = e.nome_empresa; });

        let processed = 0;
        let alerted = 0;

        for (const tabela of ['licencas', 'alvaras'] as const) {
            const { data: docs, error: docErr } = await adminDb
                .from(tabela)
                .select('id, empresa_id, estabelecimento, tipo, numero, data_validade, ativo, ultimo_alerta_nivel')
                .is('deletado_em', null);
            if (docErr) throw new Error(`Erro ao ler ${tabela}: ` + docErr.message);

            for (const doc of (docs ?? []) as Documento[]) {
                if (doc.ativo === false) continue;
                processed++;

                const dias = daysLeft(doc.data_validade);
                const nivel = nivelAlerta(dias, diasAlerta);

                if (!nivel || nivel === doc.ultimo_alerta_nivel) continue;

                const empresaNome = doc.empresa_id ? (nomeEmpresaPorId[doc.empresa_id] || '') : '';

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
                                assunto: `Licença/Alvará — ${empresaNome || doc.estabelecimento || 'documento'} (${nivel === 'vencido' ? 'vencido' : 'vencimento próximo'})`,
                                params: {
                                    tipo: 'alerta_licenca_vencimento',
                                    empresa: empresaNome,
                                    estabelecimento: doc.estabelecimento,
                                    tipo_documento: doc.tipo,
                                    numero: doc.numero,
                                    nivel,
                                    dias,
                                    vencimento: fmtBR(doc.data_validade),
                                    portal_url: portalUrl,
                                },
                            }),
                        });
                    } catch (e) {
                        console.error('Falha ao enviar alerta para', destinatario, e);
                    }
                }

                const { error: updErr } = await adminDb
                    .from(tabela)
                    .update({ ultimo_alerta_nivel: nivel, ultimo_alerta_em: new Date().toISOString() })
                    .eq('id', doc.id);
                if (updErr) console.error(`Falha ao atualizar ultimo_alerta_nivel em ${tabela}:`, doc.id, updErr.message);

                alerted++;
            }
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
