/**
 * Ficha 360 — acesso ao Supabase. Cada fonte falha isoladamente.
 * Colunas conferidas na Task 0 do plano; ajuste aqui se o schema divergir.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('./vinculos.js'));
    } else {
        root.Ficha360Fontes = factory(root.Ficha360Vinculos);
    }
})(typeof self !== 'undefined' ? self : this, function (V) {
    'use strict';

    const TAM_PAGINA = 1000;

    const soAtivosLic = (q) => q.eq('ativo', true).is('deletado_em', null);
    const comEmpresaRh = (q) => q.not('rh_empresa_id', 'is', null);

    const FONTES = {
        empresas:       { tabela: 'rh_empresas', ordem: 'codigo_empresa', colunas: 'id, codigo_empresa, nome_empresa, cnpj, regime_enquadramento, inscricao_estadual, inscricao_municipal, endereco, cidade, municipio, uf, cep, status_situacao, email, data_cadastro' },
        fichas:         { tabela: 'ficha360_empresa', ordem: 'codigo_empresa', colunas: '*' },
        contatos:       { tabela: 'ficha360_contatos', ordem: 'id', colunas: '*' },
        respDp:         { tabela: 'fechamento_empresas_responsaveis', ordem: 'id', colunas: 'codigo_empresa, usuario_id' },
        usuariosDp:     { tabela: 'usuarios', ordem: 'id', colunas: 'id, nome' },
        respContabil:   { tabela: 'contabil_empresas_responsaveis', ordem: 'id', colunas: 'codigo_empresa, usuario_id' },
        cfgFolha:       { tabela: 'fechamento_empresas_config', ordem: 'codigo_empresa', colunas: 'codigo_empresa, possui_folha' },
        cfgContabil:    { tabela: 'contabil_empresas_config', ordem: 'codigo_empresa', colunas: 'codigo_empresa, possui_contabil' },
        certificados:   { tabela: 'certificados', ordem: 'id', colunas: 'id, cliente, cpf_cnpj, situacao, data_vencimento, ativo' },
        licencas:       { tabela: 'licencas', ordem: 'id', colunas: 'id, empresa_id, tipo, estabelecimento, numero, data_validade', filtro: soAtivosLic },
        alvaras:        { tabela: 'alvaras', ordem: 'id', colunas: 'id, empresa_id, tipo, estabelecimento, numero, data_validade', filtro: soAtivosLic },
        empregados:     { tabela: 'rh_empregados', ordem: 'id', colunas: 'codigo_empresa, codigo_empregado, nome_empregado, cpf, situacao, tipo_empregado, data_admissao, data_demissao, jornada_id' },
        socios:         { tabela: 'rh_socios', ordem: 'id', colunas: 'id, codigo_empresa, nome_socio, cpf, cargo, participacao, capital_social, email_socio, data_entrada, data_saida' },
        ciclos:         { tabela: 'fechamento_ciclo', ordem: 'id', colunas: 'id, codigo_empresa, competencia, concluido_em, fechamento_ciclo_fase(nome_fase, status)',
                          filtro: (q, hoje) => q.in('competencia', _competenciasRecentes(hoje)) },
        formularios:    { tabela: 'formularios', ordem: 'id', colunas: 'id, rh_empresa_id, status, created_at', filtro: comEmpresaRh },
        empregadosForm: { tabela: 'empregados', ordem: 'id', colunas: 'id, rh_empresa_id, status, created_at', filtro: comEmpresaRh },
        onboardings:    { tabela: 'contabil_onboardings', ordem: 'id', colunas: 'id, codigo_empresa, status, data_inicio, created_at, contabil_onboarding_itens(status)' },
        mapeamentos:    { tabela: 'contabil_mapeamento', ordem: 'id', colunas: 'id, codigo_empresa, periodicidade, ultimo_mes_fechado, nivel_atencao' },
        pendencias:     { tabela: 'contabil_mapeamento_pendencias', ordem: 'id', colunas: 'id, mapeamento_id, descricao, responsavel, prazo, status' },
        diarioEventos:  { tabela: 'contabil_diario_fechamentos', ordem: 'id', colunas: 'codigo_empresa, ano, mes, tipo_evento, mensagem, created_at',
                          filtro: (q, hoje) => q.gte('ano', Number(hoje.slice(0, 4)) - 1) },
        gruposItens:    { tabela: 'rh_grupos_empresas_itens', ordem: 'id', colunas: 'grupo_id, codigo_empresa' },
        grupos:         { tabela: 'rh_grupos_empresas', ordem: 'id', colunas: 'id, nome_grupo' },
        // Jornada Padrão fica em rh_config_rubricas_txt como linhas por "evento" (mesmo padrão de
        // configuração usado no Controle de Frequência — codigo_rubrica guarda o valor, não um
        // código de rubrica de verdade, nesses eventos específicos).
        jornadaPadrao:  { tabela: 'rh_config_rubricas_txt', ordem: 'id', colunas: 'codigo_empresa, evento, codigo_rubrica',
                          filtro: (q) => q.in('evento', ['jornada_diaria', 'jornada_sexta_ativa', 'jornada_sexta', 'jornada_sabado_ativa', 'jornada_sabado', 'sabado_sempre_extra']) },
        jornadasExtras: { tabela: 'rh_jornadas', ordem: 'nome', colunas: 'id, codigo_empresa, nome, jornada_diaria, jornada_sexta_ativa, jornada_sexta, jornada_sabado_ativa, jornada_sabado, sabado_sempre_extra' },
        beneficiosLancamentos: { tabela: 'rh_beneficios_lancamentos', ordem: 'id', colunas: 'codigo_empresa, competencia_pagamento, mes_referencia, linhas_json' },
    };

    // Mês passado e mês corrente, formato 'MM/AAAA' (padrão de fechamento_ciclo.competencia)
    function _competenciasRecentes(hoje) {
        const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7));
        const fmt = (m, a) => `${String(m).padStart(2, '0')}/${a}`;
        const antMes = mes === 1 ? 12 : mes - 1;
        const antAno = mes === 1 ? ano - 1 : ano;
        return [fmt(antMes, antAno), fmt(mes, ano)];
    }

    function classificarErro(error) {
        if (!error) return null;
        const code = String(error.code || '');
        const status = Number(error.status || 0);
        const msg = String(error.message || '').toLowerCase();
        if (code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table')) return 'tabela_ausente';
        if (code === '42501' || status === 401 || status === 403 || msg.includes('permission denied')) return 'sem_permissao';
        return 'erro';
    }

    async function buscarTodos(sb, def, hoje) {
        const linhas = [];
        for (let de = 0; ; de += TAM_PAGINA) {
            let q = sb.from(def.tabela).select(def.colunas).order(def.ordem).range(de, de + TAM_PAGINA - 1);
            if (def.filtro) q = def.filtro(q, hoje);
            const res = await q;
            if (res.error) throw Object.assign(res.error, { status: res.status });
            const pagina = res.data || [];
            linhas.push(...pagina);
            if (pagina.length < TAM_PAGINA) break;
        }
        return linhas;
    }

    async function carregarCarteira(sb, hoje) {
        const chaves = Object.keys(FONTES);
        const promessas = chaves.map(k => buscarTodos(sb, FONTES[k], hoje));
        promessas.push(sb.rpc('contabil_listar_usuarios_aprovados').then(res => {
            if (res.error) throw Object.assign(res.error, { status: res.status });
            return res.data || [];
        }));
        const resultados = await Promise.allSettled(promessas);

        const dados = {};
        const falhas = {};
        chaves.concat(['usuariosContabil']).forEach((k, i) => {
            const r = resultados[i];
            if (r.status === 'fulfilled') {
                dados[k] = r.value;
            } else {
                dados[k] = null;
                falhas[k] = classificarErro(r.reason) || 'erro';
                if (typeof console !== 'undefined') console.warn(`[Ficha360] fonte ${k} indisponível`, r.reason);
            }
        });
        return { dados, falhas };
    }

    async function contarJornadaEscala(sb, codigo) {
        const contar = async (tabela) => {
            const { count, error } = await sb.from(tabela).select('id', { count: 'exact', head: true }).eq('codigo_empresa', codigo);
            return error ? null : (count || 0);
        };
        const [jornada, escala] = await Promise.all([contar('rh_jornada_trabalho'), contar('rh_escala_trabalho')]);
        return { jornada, escala };
    }

    let _cacheContatosEmpresas = null;

    async function carregarCrm(sb, item) {
        try {
            if (!_cacheContatosEmpresas) {
                _cacheContatosEmpresas = await buscarTodos(sb, { tabela: 'contatos_empresas', ordem: 'id', colunas: 'contato_id, empresa' });
            }
            const ids = V.vincularContatosCrm(_cacheContatosEmpresas, [{ codigo_empresa: item.codigo, nome_empresa: item.nome }]).get(item.codigo) || [];
            if (!ids.length) return { ok: true, dados: [] };
            const res = await sb.from('conversas')
                .select('id, protocolo, departamento, status, aberto_em, encerrado_em, contatos(nome, telefone)')
                .in('contato_id', ids.slice(0, 100))
                .order('aberto_em', { ascending: false })
                .limit(10);
            if (res.error) throw Object.assign(res.error, { status: res.status });
            return { ok: true, dados: res.data || [] };
        } catch (e) {
            _cacheContatosEmpresas = null;
            return { ok: false, motivo: classificarErro(e) || 'erro' };
        }
    }

    return { FONTES, classificarErro, buscarTodos, carregarCarteira, contarJornadaEscala, carregarCrm };
});
