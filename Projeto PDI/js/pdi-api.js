// Projeto PDI/js/pdi-api.js — camada de dados (Supabase do portal). RLS é a barreira real.
window.PdiApi = (function () {
    'use strict';
    let sb = null;
    const CODIGO_EMPRESA_SCONT = '48';

    function init(client) { sb = client; }

    function tabelaAusente(err) {
        if (!err) return false;
        const m = `${err.code || ''} ${err.message || ''}`;
        return /42P01|PGRST205|PGRST202|does not exist|schema cache|Could not find the (table|function)/i.test(m);
    }

    async function q(promise) {
        const { data, error } = await promise;
        if (error) {
            const e = new Error(error.message);
            e.ausente = tabelaAusente(error);
            e.codigo = error.code;
            throw e;
        }
        return data;
    }

    const T = (n) => sb.from(n);

    async function papeis() {
        const r = await q(sb.rpc('pdi_meus_papeis'));
        return r || { admin: false, socio: false, gestor: false, colaborador: false };
    }

    async function sessao() {
        const { data } = await sb.auth.getSession();
        const u = data && data.session && data.session.user;
        return u ? { id: u.id, email: u.email } : null;
    }

    function listarPdis() {
        return q(T('pdis').select('*').order('colaborador_nome'));
    }

    // Carrega o resumo de todos os PDIs visíveis (para os painéis)
    async function carregarTodos() {
        const pdis = await listarPdis();
        if (!pdis.length) return [];
        const ids = pdis.map(p => p.id);
        const get = (n, cols) => q(T(n).select(cols || '*').in('pdi_id', ids));
        const [tecnicas, niveis, acoes, indicadores, apuracoes, melhorias, alinhamentos, sinalizacoes, ciclos, avaliacoes, ciencias] =
            await Promise.all([
                get('pdi_competencias_tecnicas'), get('pdi_niveis_tecnicos'), get('pdi_acoes'), get('pdi_indicadores'),
                get('pdi_indicador_apuracoes'), get('pdi_melhorias'), get('pdi_alinhamentos_semanais'),
                get('pdi_sinalizacoes'), get('pdi_ciclos'), get('pdi_avaliacoes_trimestrais'), get('pdi_ciencias'),
            ]);
        const por = (arr, id) => arr.filter(x => x.pdi_id === id);
        return pdis.map(pdi => {
            const nv = por(niveis, pdi.id);
            const ap = por(apuracoes, pdi.id);
            return {
                pdi,
                tecnicas: por(tecnicas, pdi.id).map(t => ({ ...t, niveis: nv.filter(n => n.competencia_tecnica_id === t.id) })),
                acoes: por(acoes, pdi.id),
                indicadores: por(indicadores, pdi.id).map(i => ({ ...i, apuracoes: ap.filter(a => a.indicador_id === i.id) })),
                melhorias: por(melhorias, pdi.id),
                alinhamentos: por(alinhamentos, pdi.id),
                sinalizacoes: por(sinalizacoes, pdi.id),
                ciclos: por(ciclos, pdi.id).sort((a, b) => a.numero - b.numero),
                avaliacoes: por(avaliacoes, pdi.id),
                ciencias: por(ciencias, pdi.id),
            };
        });
    }

    async function carregar(id) {
        const pdi = await q(T('pdis').select('*').eq('id', id).single());
        const get = (n) => q(T(n).select('*').eq('pdi_id', id));
        const [tecnicas, niveis, comp, avComp, acoes, indicadores, apuracoes, melhorias, alinhamentos,
            sinalizacoes, ciclos, avaliacoes, pilares, feedbacks, evidencias, ciencias] = await Promise.all([
            get('pdi_competencias_tecnicas'), get('pdi_niveis_tecnicos'), get('pdi_competencias_comportamentais'),
            get('pdi_avaliacoes_comportamentais'), get('pdi_acoes'), get('pdi_indicadores'), get('pdi_indicador_apuracoes'),
            get('pdi_melhorias'), get('pdi_alinhamentos_semanais'), get('pdi_sinalizacoes'), get('pdi_ciclos'),
            get('pdi_avaliacoes_trimestrais'), get('pdi_avaliacao_pilares'), get('pdi_feedbacks'), get('pdi_evidencias'),
            get('pdi_ciencias'),
        ]);
        const ord = (a, f) => a.slice().sort((x, y) => (x[f] > y[f] ? 1 : x[f] < y[f] ? -1 : 0));
        return {
            pdi,
            tecnicas: ord(tecnicas, 'ordem').map(t => ({ ...t, niveis: ord(niveis.filter(n => n.competencia_tecnica_id === t.id), 'data') })),
            comportamentais: ord(comp, 'ordem').map(c => ({ ...c, avaliacoes: ord(avComp.filter(a => a.competencia_id === c.id), 'data') })),
            acoes: ord(acoes, 'ordem'),
            indicadores: ord(indicadores, 'ordem').map(i => ({ ...i, apuracoes: ord(apuracoes.filter(a => a.indicador_id === i.id), 'competencia_mes') })),
            melhorias: ord(melhorias, 'data'),
            alinhamentos: ord(alinhamentos, 'semana_ref'),
            sinalizacoes: ord(sinalizacoes, 'data_sinalizacao'),
            ciclos: ord(ciclos, 'numero'),
            avaliacoes: ord(avaliacoes, 'ciclo_numero').map(a => ({ ...a, pilares: pilares.filter(p => p.avaliacao_id === a.id) })),
            feedbacks: ord(feedbacks, 'created_at').reverse(),
            evidencias, ciencias,
        };
    }

    const ins = (t, row) => q(T(t).insert(row).select().single());
    const upd = (t, id, patch) => q(T(t).update(patch).eq('id', id).select().single());
    const del = (t, id) => q(T(t).delete().eq('id', id));

    async function atualizarSemEco(t, id, patch) {
        const r = await q(T(t).update(patch).eq('id', id).select());
        if (!r.length) throw new Error('Sem permissão para alterar este registro.');
        return r[0];
    }

    const upsertApuracao = (row) => q(T('pdi_indicador_apuracoes').upsert(row, { onConflict: 'indicador_id,competencia_mes' }).select().single());
    const upsertAlinhamento = (row) => q(T('pdi_alinhamentos_semanais').upsert(row, { onConflict: 'pdi_id,semana_ref' }).select().single());
    const upsertAvaliacao = (row) => q(T('pdi_avaliacoes_trimestrais').upsert(row, { onConflict: 'pdi_id,ciclo_numero' }).select().single());
    const upsertPilar = (row) => q(T('pdi_avaliacao_pilares').upsert(row, { onConflict: 'avaliacao_id,pilar' }).select().single());

    // Administração
    const modelos = () => q(T('pdi_modelos').select('*').order('cargo_setor'));
    const usuarios = () => q(T('usuarios').select('id,nome,email').order('nome'));
    const socios = () => q(T('pdi_socios').select('*').order('nome'));
    const rhSocios = () => q(T('rh_socios').select('id,nome_socio').eq('codigo_empresa', CODIGO_EMPRESA_SCONT).order('nome_socio'));
    const criarPdi = (p) => q(sb.rpc('pdi_criar_a_partir_do_modelo', {
        p_modelo_id: p.modelo_id, p_colaborador_user_id: p.colaborador_user_id || null,
        p_colaborador_nome: p.colaborador_nome, p_cargo_setor: p.cargo_setor || '',
        p_admissao: p.admissao || null, p_gestor_user_id: p.gestor_user_id || null,
        p_gestor_nome: p.gestor_nome || null, p_data_inicio: p.data_inicio,
    }));

    // Exclui o PDI (só admin): remove os relatórios do Storage e depois chama a função do banco,
    // que apaga o PDI e tudo que depende dele. A auditoria preserva o registro.
    async function excluirPdi(id) {
        try {
            const { data: arqs } = await sb.storage.from('pdi-relatorios').list(id, { limit: 100 });
            if (arqs && arqs.length) await sb.storage.from('pdi-relatorios').remove(arqs.map(a => `${id}/${a.name}`));
        } catch (_) { /* sem relatório anexado ou sem acesso: segue a exclusão */ }
        return q(sb.rpc('pdi_excluir', { p_pdi: id }));
    }

    // Renovação: cria o PDI do ano seguinte ligado a este (admin). Data vazia = fim do PDI anterior.
    const renovarPdi = (id, dataInicio) => q(sb.rpc('pdi_renovar', { p_anterior: id, p_data_inicio: dataInicio || null }));

    // Última ficha concluída (com pilares) de um PDI: origem das notas iniciais do PDI seguinte
    async function ultimaFichaConcluida(pdiId) {
        const av = await q(T('pdi_avaliacoes_trimestrais').select('*').eq('pdi_id', pdiId).eq('status', 'concluida')
            .order('ciclo_numero', { ascending: false }).limit(1));
        if (!av.length) return null;
        const pilares = await q(T('pdi_avaliacao_pilares').select('*').eq('avaliacao_id', av[0].id));
        return { ...av[0], pilares };
    }

    async function urlRelatorio(path) {
        const { data, error } = await sb.storage.from('pdi-relatorios').createSignedUrl(path, 300);
        if (error) throw new Error(error.message);
        return data.signedUrl;
    }
    async function enviarRelatorio(pdiId, file) {
        const path = `${pdiId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
        const { error } = await sb.storage.from('pdi-relatorios').upload(path, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        return path;
    }

    return {
        init, tabelaAusente, papeis, sessao, listarPdis, carregarTodos, carregar, ins, upd, del, atualizarSemEco,
        upsertApuracao, upsertAlinhamento, upsertAvaliacao, upsertPilar, modelos, usuarios, socios, rhSocios,
        criarPdi, excluirPdi, renovarPdi, ultimaFichaConcluida, urlRelatorio, enviarRelatorio, CODIGO_EMPRESA_SCONT,
        client: () => sb,
    };
})();
