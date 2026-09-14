// Projeto Ficha 360/js/regras.js
/**
 * Ficha 360 — regras de alerta por módulo e semáforo.
 * Módulo puro: sem DOM, sem Supabase, sem new Date() (hoje é parâmetro ISO).
 * Depende de ContabilDiarioUtil (Projeto Onboarding Contabil/contabil-diario-util.js).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../../Projeto Onboarding Contabil/contabil-diario-util.js'));
    } else {
        root.Ficha360Regras = factory(root.ContabilDiarioUtil);
    }
})(typeof self !== 'undefined' ? self : this, function (DiarioUtil) {
    'use strict';

    const LIMITES = {
        certCriticoDias: 7,
        certAtencaoDias: 30,
        licCriticoDias: 15,
        licAtencaoDias: 60,
        folhaDiaLimite: 10,
        formCriticoDias: 15,
        onboardingAtencaoDias: 60,
    };

    const PESO = { critico: 3, atencao: 2, info: 1 };
    const FORM_FECHADOS = ['validado', 'rejeitado', 'excluido'];

    function alerta(modulo, gravidade, mensagem) {
        return { modulo, gravidade, mensagem };
    }

    function _utc(iso) {
        const [a, m, d] = String(iso == null ? '' : iso).slice(0, 10).split('-').map(Number);
        if (!a || !m || !d) return null;
        return Date.UTC(a, m - 1, d);
    }

    function diasAte(dataISO, hojeISO) {
        const alvo = _utc(dataISO), hoje = _utc(hojeISO);
        if (alvo === null || hoje === null) return null;
        return Math.round((alvo - hoje) / 86400000);
    }

    function _mesAnterior(hojeISO) {
        let ano = Number(hojeISO.slice(0, 4));
        let mes = Number(hojeISO.slice(5, 7)) - 1;
        if (mes < 1) { mes = 12; ano -= 1; }
        return { ano, mes };
    }

    function competenciaAnterior(hojeISO) {
        const { ano, mes } = _mesAnterior(hojeISO);
        return `${String(mes).padStart(2, '0')}/${ano}`;
    }

    function periodoEsperado(periodicidade, hojeISO) {
        const per = periodicidade || 'mensal';
        const { ano, mes } = _mesAnterior(hojeISO);
        const fim = DiarioUtil.mesFinalDoPeriodo(mes, per);
        if (fim === mes) return { ano, mes };
        let m = fim - DiarioUtil.qtdMesesNoPeriodo(per);
        let a = ano;
        if (m < 1) { m += 12; a -= 1; }
        return { ano: a, mes: m };
    }

    function empregadoAtivo(situacao) {
        const s = String(situacao == null ? '' : situacao).toLowerCase();
        return s.includes('ativ') && !s.includes('inativ');
    }

    function _porDias(modulo, rotulo, dias, limCritico, limAtencao) {
        if (dias === null) return null;
        if (dias < 0) return alerta(modulo, 'critico', `${rotulo} vencido há ${-dias}d`);
        if (dias <= limCritico) return alerta(modulo, 'critico', `${rotulo} vence em ${dias}d`);
        if (dias <= limAtencao) return alerta(modulo, 'atencao', `${rotulo} vence em ${dias}d`);
        return null;
    }

    function alertasCertificados(certs, hoje) {
        const ativos = (certs || []).filter(c => c.ativo !== false && c.situacao !== 'Renovado');
        if (!ativos.length) return [alerta('certificado', 'info', 'Nenhum certificado vinculado')];
        const out = [];
        for (const c of ativos) {
            const rotulo = c.cliente ? `Certificado (${c.cliente})` : 'Certificado';
            const a = _porDias('certificado', rotulo, diasAte(c.data_vencimento, hoje), LIMITES.certCriticoDias, LIMITES.certAtencaoDias);
            if (a) out.push(a);
        }
        return out;
    }

    function alertasLicencas(itens, hoje) {
        const out = [];
        for (const l of itens || []) {
            const base = l.origem === 'alvara' ? 'Alvará' : 'Licença';
            const rotulo = l.tipo ? `${base} ${l.tipo}` : base;
            const a = _porDias('licenca', rotulo, diasAte(l.data_validade, hoje), LIMITES.licCriticoDias, LIMITES.licAtencaoDias);
            if (a) out.push(a);
        }
        return out;
    }

    function alertasFolha({ possuiFolha, ciclos, temResponsavel }, hoje) {
        if (!possuiFolha) return [];
        const out = [];
        if (!temResponsavel) out.push(alerta('folha', 'info', 'Sem responsável DP'));
        const comp = competenciaAnterior(hoje);
        const ciclo = (ciclos || []).find(c => c.competencia === comp);
        if (ciclo && ciclo.concluido_em) return out;
        const detalhe = ciclo
            ? `${(ciclo.fechamento_ciclo_fase || []).filter(f => f.status !== 'concluida').length} fase(s) pendente(s)`
            : 'ciclo não iniciado';
        const dia = Number(hoje.slice(8, 10));
        if (dia > LIMITES.folhaDiaLimite) {
            out.push(alerta('folha', 'critico', `Folha ${comp} não concluída após dia ${LIMITES.folhaDiaLimite} (${detalhe})`));
        } else {
            out.push(alerta('folha', 'atencao', `Folha ${comp} em andamento (${detalhe})`));
        }
        return out;
    }

    function alertasQsa(ocorrencias) {
        return (ocorrencias || []).map(o => o.ocorrendo_agora
            ? alerta('qsa', 'critico', `Sócio ${o.nome_socio} também é empregado ativo`)
            : alerta('qsa', 'atencao', `Sócio ${o.nome_socio} já foi empregado no mesmo período`));
    }

    function alertasFormularios(forms, hoje) {
        let criticos = 0, atencao = 0;
        for (const f of forms || []) {
            if (FORM_FECHADOS.includes(f.status)) continue;
            const idade = -diasAte(f.created_at, hoje);
            if (idade > LIMITES.formCriticoDias) criticos++; else atencao++;
        }
        const out = [];
        if (criticos) out.push(alerta('formularios', 'critico', `${criticos} formulário(s) em aberto há mais de ${LIMITES.formCriticoDias} dias`));
        if (atencao) out.push(alerta('formularios', 'atencao', `${atencao} formulário(s) em aberto`));
        return out;
    }

    function alertasDiario({ possuiContabil, periodicidade, eventos, temResponsavel }, hoje) {
        if (!possuiContabil) return [];
        const per = periodicidade || 'mensal';
        const out = [];
        if (!temResponsavel) out.push(alerta('diario', 'info', 'Sem responsável Contábil'));

        const ultimo = new Map();
        const ordenados = (eventos || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        for (const ev of ordenados) ultimo.set(`${ev.ano}|${ev.mes}`, ev);

        for (const ev of ultimo.values()) {
            if (ev.tipo_evento === 'rejeitado') {
                out.push(alerta('diario', 'critico', `Diário ${DiarioUtil.descricaoPeriodo(per, ev.ano, ev.mes)} rejeitado sem reenvio`));
            }
        }
        const esp = periodoEsperado(per, hoje);
        if (!ultimo.has(`${esp.ano}|${esp.mes}`)) {
            out.push(alerta('diario', 'atencao', `Diário ${DiarioUtil.descricaoPeriodo(per, esp.ano, esp.mes)} não enviado`));
        }
        return out;
    }

    function alertasMapeamento({ mapeamento, pendencias }, hoje) {
        if (!mapeamento) return [];
        const out = [];
        if (mapeamento.nivel_atencao === 'critico') out.push(alerta('mapeamento', 'critico', 'Nível de atenção crítico'));
        if (mapeamento.nivel_atencao === 'alto') out.push(alerta('mapeamento', 'atencao', 'Nível de atenção alto'));
        const abertas = (pendencias || []).filter(p => p.status === 'aberta');
        const vencidas = abertas.filter(p => p.prazo && diasAte(p.prazo, hoje) < 0);
        if (vencidas.length) out.push(alerta('mapeamento', 'atencao', `${vencidas.length} pendência(s) do mapeamento vencida(s)`));
        else if (abertas.length) out.push(alerta('mapeamento', 'info', `${abertas.length} pendência(s) do mapeamento aberta(s)`));
        return out;
    }

    function alertasOnboarding(onboarding, hoje) {
        if (!onboarding || onboarding.status !== 'em_andamento' || !onboarding.data_inicio) return [];
        const idade = -diasAte(onboarding.data_inicio, hoje);
        return idade > LIMITES.onboardingAtencaoDias
            ? [alerta('onboarding', 'atencao', `Onboarding em andamento há ${idade} dias`)]
            : [];
    }

    function alertasCadastro({ ficha, contatos }) {
        if (!ficha) return [alerta('cadastro', 'info', 'Cadastro Scont não preenchido')];
        if (!(contatos || []).some(c => c.principal)) return [alerta('cadastro', 'info', 'Sem contato principal')];
        return [];
    }

    function semaforo(alertas, statusCarteira) {
        if (statusCarteira === 'inativo') return 'inativo';
        const lista = alertas || [];
        if (lista.some(a => a.gravidade === 'critico')) return 'vermelho';
        if (lista.some(a => a.gravidade === 'atencao')) return 'amarelo';
        return 'verde';
    }

    function ordenarAlertas(alertas) {
        return (alertas || []).slice().sort((a, b) => (PESO[b.gravidade] || 0) - (PESO[a.gravidade] || 0));
    }

    return {
        LIMITES, diasAte, competenciaAnterior, periodoEsperado, empregadoAtivo,
        alertasCertificados, alertasLicencas, alertasFolha, alertasQsa, alertasFormularios,
        alertasDiario, alertasMapeamento, alertasOnboarding, alertasCadastro,
        semaforo, ordenarAlertas,
    };
});
