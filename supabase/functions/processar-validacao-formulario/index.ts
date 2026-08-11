import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================
// Consome o link público de validação/rejeição enviado ao
// cliente (Gerenciador de Formulários). Roda com service_role —
// anon nunca ganha UPDATE direto em formularios/empregados
// (mesmo princípio de LGPD do resto do schema). O link só é
// aceito se o status ainda for 'aguardando_validacao_cliente' e
// o token bater; qualquer outra combinação é tratada como link
// inválido/expirado, sem tocar o banco.
// ============================================================

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TIPO_LABEL: Record<string, string> = {
    registro:  'Registro de Empresa',
    alteracao: 'Alteração de Empresa',
    empregado: 'Admissão de Empregado',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }

    try {
        if (!req.headers.get('Authorization')) throw new Error('Não autorizado.');

        const body = await req.json() as {
            id?: string;
            tipo?: string;
            token?: string;
            acao?: string;
            motivo?: string;
        };
        const { id, tipo, token, acao } = body;
        const motivo = (body.motivo || '').trim();

        if (!id || !tipo || !token || !acao) throw new Error('Parâmetros obrigatórios ausentes.');
        if (!['registro', 'alteracao', 'empregado'].includes(tipo)) throw new Error('Tipo de formulário inválido.');
        if (!['validar', 'rejeitar'].includes(acao)) throw new Error('Ação inválida.');
        if (acao === 'rejeitar' && !motivo) {
            return new Response(JSON.stringify({ ok: false, error: 'motivo_obrigatorio' }), {
                status: 400,
                headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const tabela = tipo === 'empregado' ? 'empregados' : 'formularios';
        const campoNome = tipo === 'empregado' ? 'nome_completo' : 'nome_empresa';

        const adminDb = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );

        const { data: registro, error: fetchErr } = await adminDb
            .from(tabela)
            .select(`id, status, token_validacao, ${campoNome}`)
            .eq('id', id)
            .maybeSingle();

        if (fetchErr) throw new Error('Erro ao buscar formulário: ' + fetchErr.message);

        const linkValido = registro
            && registro.status === 'aguardando_validacao_cliente'
            && registro.token_validacao
            && registro.token_validacao === token;

        if (!linkValido) {
            return new Response(JSON.stringify({ ok: false, error: 'link_invalido' }), {
                status: 400,
                headers: { ...CORS, 'Content-Type': 'application/json' },
            });
        }

        const nomeExibicao = (registro as Record<string, unknown>)[campoNome] as string || '';
        const tipoFormularioLabel = TIPO_LABEL[tipo];

        const novoStatus = acao === 'validar' ? 'validado' : 'pendencia_preenchimento_documentacao';
        const updateData: Record<string, unknown> = {
            status: novoStatus,
            token_validacao: null,
            updated_at: new Date().toISOString(),
        };
        if (acao === 'rejeitar') updateData.observacoes = motivo;

        const { error: updateErr } = await adminDb.from(tabela).update(updateData).eq('id', id);
        if (updateErr) throw new Error('Erro ao atualizar formulário: ' + updateErr.message);

        // Avisa a equipe Scont (melhor esforço — não desfaz a mudança de status se falhar)
        try {
            const { data: configRow } = await adminDb
                .from('formularios_config_email')
                .select('email')
                .eq('tipo_formulario', tipo)
                .maybeSingle();

            const emailScont = configRow?.email;
            if (emailScont) {
                const params = acao === 'validar'
                    ? { tipo: 'formulario_validado_cliente', tipoFormularioLabel, nomeExibicao }
                    : { tipo: 'formulario_pendencia_cliente', tipoFormularioLabel, nomeExibicao, motivo };

                const assunto = acao === 'validar'
                    ? `✅ Cliente validou — ${tipoFormularioLabel} — ${nomeExibicao}`
                    : `⚠️ Pendência reportada pelo cliente — ${tipoFormularioLabel} — ${nomeExibicao}`;

                await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/enviar-email`, {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
                        'apikey':        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
                    },
                    body: JSON.stringify({
                        destinatario:     emailScont,
                        nomeDestinatario: 'Equipe Scont',
                        assunto,
                        params,
                    }),
                });
            }
        } catch (notifyErr) {
            console.warn('[processar-validacao-formulario] falha ao notificar Scont:', notifyErr);
        }

        return new Response(JSON.stringify({ ok: true, tipoFormularioLabel, nomeExibicao, acao }), {
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
