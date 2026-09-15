// Projeto Ficha 360/js/carteira.js
/**
 * Ficha 360 — consolida as fontes por empresa e calcula alertas/semáforo.
 * Módulo puro. `dados[chave]` = Array (fonte ok) ou null (fonte indisponível).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(
            require('./vinculos.js'),
            require('./regras.js'),
            require('../../Projeto RH/qsa-analise.js')
        );
    } else {
        root.Ficha360Carteira = factory(root.Ficha360Vinculos, root.Ficha360Regras, root.QsaAnalise);
    }
})(typeof self !== 'undefined' ? self : this, function (V, R, Qsa) {
    'use strict';

    // Tipos reconhecidos de rh_empregados.tipo_empregado (mesmo catálogo de Projeto RH/admin.js
    // `_VG_TIPOS`); qualquer outro valor cai em 'Outros'.
    const TIPOS_EMPREGADO = ['Empregado', 'Estágiario', 'Contribuinte'];

    function contarEmpregadosPorTipo(lista) {
        const out = { Empregado: 0, 'Estágiario': 0, Contribuinte: 0, Outros: 0 };
        for (const x of lista) {
            if (!R.empregadoAtivo(x.situacao)) continue;
            const t = (x.tipo_empregado || '').trim();
            out[TIPOS_EMPREGADO.includes(t) ? t : 'Outros'] += 1;
        }
        return out;
    }

    // Monta a Jornada Padrão da empresa a partir das linhas de rh_config_rubricas_txt
    // (evento -> codigo_rubrica). Sem linha 'jornada_diaria' = nada configurado ainda.
    function montarJornadaPadrao(linhas) {
        const m = {};
        for (const l of linhas) m[l.evento] = l.codigo_rubrica;
        if (!m.jornada_diaria) return null;
        const sempreExtra = m.sabado_sempre_extra === '1';
        return {
            diaria: m.jornada_diaria,
            sextaAtiva: m.jornada_sexta_ativa === '1',
            sexta: m.jornada_sexta || null,
            sabadoSempreExtra: sempreExtra,
            sabadoAtiva: !sempreExtra && m.jornada_sabado_ativa === '1',
            sabado: m.jornada_sabado || null,
        };
    }

    // Quantos empregados ativos usam cada jornada (extras pelo nome; sem jornada_id ou
    // apontando pra uma jornada que não existe mais = 'Jornada Padrão').
    function contarPorJornada(empregados, jornadasExtras) {
        const nomePorId = new Map(jornadasExtras.map(j => [j.id, j.nome]));
        const out = { 'Jornada Padrão': 0 };
        for (const j of jornadasExtras) out[j.nome] = 0;
        for (const e of empregados) {
            if (!R.empregadoAtivo(e.situacao)) continue;
            const nome = e.jornada_id && nomePorId.has(e.jornada_id) ? nomePorId.get(e.jornada_id) : 'Jornada Padrão';
            out[nome] = (out[nome] || 0) + 1;
        }
        return out;
    }

    // Lançamento de benefícios (VA/VT) mais recente da empresa, por competência de pagamento
    // 'MM/AAAA' — comparação numérica, não lexicográfica (senão '01/2027' < '12/2026' como texto).
    function lancamentoMaisRecente(lancamentos) {
        if (!lancamentos.length) return null;
        const chave = (l) => {
            const [m, a] = String(l.competencia_pagamento || '').split('/').map(Number);
            return (a || 0) * 12 + (m || 0);
        };
        return lancamentos.slice().sort((a, b) => chave(b) - chave(a))[0];
    }

    function montarCarteira(dados, hoje) {
        const ok = (k) => Array.isArray(dados[k]);
        const arr = (k) => (ok(k) ? dados[k] : []);
        const idx = (k, campo) => V.indexarPorCodigo(arr(k), campo);
        const mapaPor = (k, chave, valor) => new Map(arr(k).map(l => [l[chave], valor ? l[valor] : l]));

        const empresas = arr('empresas');
        const codigoPorId = new Map(empresas.map(e => [e.id, e.codigo_empresa]));

        const fichas = mapaPor('fichas', 'codigo_empresa');
        const contatos = idx('contatos');
        const nomesDp = mapaPor('usuariosDp', 'id', 'nome');
        const nomesCont = mapaPor('usuariosContabil', 'id', 'nome');
        const respDp = idx('respDp');
        const respCont = idx('respContabil');
        const cfgFolha = mapaPor('cfgFolha', 'codigo_empresa', 'possui_folha');
        const cfgCont = mapaPor('cfgContabil', 'codigo_empresa', 'possui_contabil');
        const certs = V.vincularCertificados(arr('certificados'), empresas, arr('socios'));

        const licencas = new Map();
        const addLic = (linhas, origem) => {
            for (const l of linhas) {
                const cod = codigoPorId.get(l.empresa_id);
                if (!cod) continue;
                if (!licencas.has(cod)) licencas.set(cod, []);
                licencas.get(cod).push(Object.assign({ origem }, l));
            }
        };
        addLic(arr('licencas'), 'licenca');
        addLic(arr('alvaras'), 'alvara');

        const empregados = idx('empregados');
        const socios = idx('socios');
        const qsaDisponivel = ok('socios') && ok('empregados');
        const ocorrencias = V.indexarPorCodigo(
            qsaDisponivel ? Qsa.computarOcorrencias(arr('socios'), arr('empregados'), empresas, hoje) : [],
            'empresa'
        );

        const ciclos = idx('ciclos');
        const forms = new Map();
        for (const f of arr('formularios').concat(arr('empregadosForm'))) {
            const cod = codigoPorId.get(f.rh_empresa_id);
            if (!cod) continue;
            if (!forms.has(cod)) forms.set(cod, []);
            forms.get(cod).push(f);
        }

        const onboardings = idx('onboardings');
        const mapeamentos = mapaPor('mapeamentos', 'codigo_empresa');
        const pendencias = idx('pendencias', 'mapeamento_id');
        const diario = idx('diarioEventos');
        const grupoPorCodigo = mapaPor('gruposItens', 'codigo_empresa', 'grupo_id');
        const nomeGrupo = mapaPor('grupos', 'id', 'nome_grupo');
        const jornadaPadraoLinhas = idx('jornadaPadrao');
        const jornadasExtras = idx('jornadasExtras');
        const lancamentosBeneficios = idx('beneficiosLancamentos');

        const nomes = (lista, mapaNomes) => lista.map(r => mapaNomes.get(r.usuario_id) || '(sem nome)');

        const itens = empresas.map(e => {
            const cod = e.codigo_empresa;
            const ficha = fichas.get(cod) || null;
            const statusCarteira = (ficha && ficha.status_carteira) || 'ativo';
            const possuiFolha = cfgFolha.get(cod) === true;
            const possuiContabil = cfgCont.get(cod) === true;
            const listaRespDp = respDp.get(cod) || [];
            const listaRespCont = respCont.get(cod) || [];
            const mapeamento = mapeamentos.get(cod) || null;
            const onboarding = (onboardings.get(cod) || [])
                .slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;

            const item = {
                codigo: cod,
                empresaId: e.id,
                nome: e.nome_empresa || '',
                cnpj: e.cnpj || '',
                regime: e.regime_enquadramento || '',
                uf: e.uf || '',
                cidade: e.cidade || e.municipio || '',
                situacaoDominio: e.status_situacao || '',
                dominio: e,
                ficha,
                statusCarteira,
                possuiFolha,
                possuiContabil,
                responsaveisDp: nomes(listaRespDp, nomesDp),
                responsaveisContabil: nomes(listaRespCont, nomesCont),
                grupo: nomeGrupo.get(grupoPorCodigo.get(cod)) || null,
                empregadosAtivos: ok('empregados')
                    ? (empregados.get(cod) || []).filter(x => (x.tipo_empregado || '').trim() === 'Empregado' && R.empregadoAtivo(x.situacao)).length
                    : null,
                empregadosPorTipo: ok('empregados') ? contarEmpregadosPorTipo(empregados.get(cod) || []) : null,
                jornadaPadrao: ok('jornadaPadrao') ? montarJornadaPadrao(jornadaPadraoLinhas.get(cod) || []) : null,
                jornadasExtras: jornadasExtras.get(cod) || [],
                jornadaContagem: (ok('empregados') && ok('jornadasExtras'))
                    ? contarPorJornada(empregados.get(cod) || [], jornadasExtras.get(cod) || [])
                    : null,
                beneficio: ok('beneficiosLancamentos') ? lancamentoMaisRecente(lancamentosBeneficios.get(cod) || []) : null,
                certificados: certs.get(cod) || [],
                licencas: licencas.get(cod) || [],
                socios: socios.get(cod) || [],
                ocorrenciasQsa: ocorrencias.get(cod) || [],
                ciclos: ciclos.get(cod) || [],
                formularios: forms.get(cod) || [],
                onboarding,
                mapeamento,
                pendencias: mapeamento ? (pendencias.get(mapeamento.id) || []) : [],
                diarioEventos: diario.get(cod) || [],
                contatos: contatos.get(cod) || [],
            };

            let alertas = [];
            if (statusCarteira !== 'inativo') {
                if (ok('certificados')) alertas = alertas.concat(R.alertasCertificados(item.certificados, hoje));
                if (ok('licencas') || ok('alvaras')) alertas = alertas.concat(R.alertasLicencas(item.licencas, hoje));
                if (ok('cfgFolha') && ok('ciclos') && ok('respDp')) {
                    alertas = alertas.concat(R.alertasFolha({ possuiFolha, ciclos: item.ciclos, temResponsavel: listaRespDp.length > 0 }, hoje));
                }
                if (qsaDisponivel) alertas = alertas.concat(R.alertasQsa(item.ocorrenciasQsa));
                if (ok('formularios') || ok('empregadosForm')) alertas = alertas.concat(R.alertasFormularios(item.formularios, hoje));
                if (ok('cfgContabil') && ok('diarioEventos') && ok('respContabil')) {
                    alertas = alertas.concat(R.alertasDiario({
                        possuiContabil,
                        periodicidade: mapeamento && mapeamento.periodicidade,
                        eventos: item.diarioEventos,
                        temResponsavel: listaRespCont.length > 0,
                    }, hoje));
                }
                if (ok('mapeamentos') && ok('pendencias')) alertas = alertas.concat(R.alertasMapeamento({ mapeamento, pendencias: item.pendencias }, hoje));
                if (ok('onboardings')) alertas = alertas.concat(R.alertasOnboarding(onboarding, hoje));
                if (ok('fichas') && ok('contatos')) alertas = alertas.concat(R.alertasCadastro({ ficha, contatos: item.contatos }));
            }
            item.alertas = R.ordenarAlertas(alertas);
            item.semaforo = R.semaforo(item.alertas, statusCarteira);
            return item;
        });

        itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        return itens;
    }

    return { montarCarteira };
});
