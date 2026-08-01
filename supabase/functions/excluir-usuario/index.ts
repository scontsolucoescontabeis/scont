import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Não autorizado.');

        const body = await req.json() as { email?: string };
        const email = (body.email || '').trim();
        if (!email) throw new Error('Campo "email" é obrigatório.');

        const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
        const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
        const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        // 1. Valida a sessão do chamador (não confia apenas na presença do header)
        const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
        if (callerErr || !caller) throw new Error('Sessão inválida ou expirada.');

        const adminDb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        // 2. Confirma que o chamador é admin
        const { data: callerRow, error: callerRowErr } = await adminDb
            .from('usuarios')
            .select('is_admin')
            .eq('id', caller.id)
            .maybeSingle();
        if (callerRowErr) throw new Error('Erro ao verificar permissão: ' + callerRowErr.message);
        if (!callerRow?.is_admin) throw new Error('Apenas administradores podem excluir usuários.');

        // 3. Bloqueia auto-exclusão
        if ((caller.email || '').toLowerCase() === email.toLowerCase()) {
            throw new Error('Você não pode excluir sua própria conta.');
        }

        // 4. Remove o acesso ao portal — cascade apaga usuario_ferramentas
        const { error: delSolErr } = await adminDb
            .from('solicitacoes_acesso')
            .delete()
            .eq('email', email);
        if (delSolErr) throw new Error('Erro ao remover acesso ao portal: ' + delSolErr.message);

        // 5. Tenta apagar a conta de login (melhor esforço)
        const { data: usuarioRow } = await adminDb
            .from('usuarios')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (!usuarioRow) {
            return new Response(JSON.stringify({
                ok: true,
                accessRevoked: true,
                authDeleted: false,
                message: '✅ Acesso ao portal removido. Nenhuma conta de login encontrada para este e-mail.',
            }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
        }

        const { error: delAuthErr } = await adminDb.auth.admin.deleteUser(usuarioRow.id);
        if (delAuthErr) {
            return new Response(JSON.stringify({
                ok: true,
                accessRevoked: true,
                authDeleted: false,
                message: '⚠️ Acesso ao portal revogado, mas a conta de login não pôde ser excluída — ' +
                    'este usuário possui registros vinculados em outras ferramentas (ex.: CRM). ' +
                    'Detalhe: ' + delAuthErr.message,
            }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({
            ok: true,
            accessRevoked: true,
            authDeleted: true,
            message: '✅ Usuário excluído por completo (acesso ao portal e conta de login).',
        }), { headers: { ...CORS, 'Content-Type': 'application/json' } });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 400,
            headers: { ...CORS, 'Content-Type': 'application/json' },
        });
    }
});
