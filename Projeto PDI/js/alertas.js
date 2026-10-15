// Projeto PDI/js/alertas.js
/**
 * PDI — alertas calculados sob demanda (sem cron). Módulo puro: `hoje` é parâmetro ISO.
 * Gravidade: 'critico' | 'atencao' | 'info'.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./pdi-calculo.js'));
    else root.PdiAlertas = factory(root.PdiCalculo);
})(typeof self !== 'undefined' ? self : this, function (C) {
    'use strict';

    const PESO = { critico: 3, atencao: 2, info: 1 };
    const a = (tipo, gravidade, mensagem) => ({ tipo, gravidade, mensagem });

    function segunda(iso) {
        const [y, m, d] = iso.split('-').map(Number);
        const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dom
        return C.somarDias(iso, -((dow + 6) % 7));
    }

    /** Semanas já decorridas desde o início (revisões previstas), limitadas ao fim do PDI. */
    function semanasPrevistas(inicio, hoje, fim) {
        const ate = String(hoje) < fim ? hoje : fim;
        if (String(ate) < inicio) return 0;
        return Math.floor(C.diasEntre(inicio, ate) / 7) + 1;
    }

    function calcular(d, hoje) {
        const out = [];
        const pdi = d.pdi;
        if (pdi.status === 'encerrado') return out;
        const fim = C.fimPdi(pdi.data_inicio, pdi.meses_acompanhamento);

        const registrados = (d.tecnicas || []).reduce((s, t) => s + ((t.niveis || []).length > 0 ? 1 : 0), 0);
        if (C.nivelInicialPendente(pdi.data_inicio, hoje, registrados)) {
            out.push(a('nivel_inicial', 'critico', 'Nível inicial das rotinas não registrado (prazo: D + 15 dias).'));
        }

        (d.acoes || []).forEach(x => {
            if (x.status === 'concluido' || x.recorrencia) return;
            const venc = C.somarDias(pdi.data_inicio, x.prazo_dias);
            const dias = C.diasEntre(hoje, venc);
            if (dias < 0) out.push(a('acao_vencida', 'critico', `Ação vencida há ${-dias} dia(s): ${x.foco_acao}`));
            else if (dias <= 3) out.push(a('acao_vencer', 'atencao', `Ação vence em ${dias} dia(s): ${x.foco_acao}`));
        });

        if (String(hoje) >= pdi.data_inicio && String(hoje) <= fim) {
            const semanaAtual = segunda(hoje);
            const semanaAnterior = C.somarDias(semanaAtual, -7);
            if (String(semanaAnterior) >= segunda(pdi.data_inicio)) {
                const tem = (d.alinhamentos || []).some(x => String(x.semana_ref).slice(0, 10) === semanaAnterior);
                if (!tem) out.push(a('resumo_semanal', 'atencao', 'Resumo semanal da semana anterior não registrado.'));
            }
            const mesAnterior = C.somarMeses(hoje.slice(0, 8) + '01', -1);
            if (String(mesAnterior) >= pdi.data_inicio.slice(0, 8) + '01') {
                const faltam = (d.indicadores || []).filter(i => !i.calculo_automatico).filter(i =>
                    !(i.apuracoes || []).some(p => String(p.competencia_mes).slice(0, 7) === mesAnterior.slice(0, 7)));
                if (faltam.length) out.push(a('apuracao', 'atencao', `Apuração mensal pendente (${mesAnterior.slice(5, 7)}/${mesAnterior.slice(0, 4)}): ${faltam.map(i => i.nome).join(', ')}.`));
            }
        }

        (d.ciclos || []).forEach(c => {
            const ficha = (d.avaliacoes || []).find(f => f.ciclo_numero === c.numero);
            if (ficha && ficha.status === 'concluida') return;
            const dias = C.diasEntre(hoje, c.fim);
            if (dias >= 0 && dias <= 15 && !c.data_avaliacao_agendada) {
                out.push(a('avaliacao_agendar', 'atencao', `Agendar a avaliação do ciclo ${c.numero} (termina em ${dias} dia(s)).`));
            }
            if (dias < 0 && !ficha) out.push(a('avaliacao_atrasada', 'critico', `Avaliação do ciclo ${c.numero} ainda não aberta.`));
        });

        (d.avaliacoes || []).forEach(f => {
            if (f.status === 'aguardando_ciencia') {
                const have = (d.ciencias || []).filter(c => c.referencia === 'avaliacao' && c.referencia_id === f.id).map(c => c.papel);
                const falta = C.PAPEIS_CIENCIA.filter(p => !have.includes(p));
                if (falta.length) out.push(a('ciencia', 'atencao', `Ciência pendente na ficha do ciclo ${f.ciclo_numero}: ${falta.join(', ')}.`));
            }
        });
        const cPdi = (d.ciencias || []).filter(c => c.referencia === 'pdi').map(c => c.papel);
        if (C.PAPEIS_CIENCIA.some(p => !cPdi.includes(p)) && String(hoje) > C.somarDias(pdi.data_inicio, 7)) {
            out.push(a('ciencia_pdi', 'info', 'Ciência da apresentação do PDI pendente.'));
        }

        const pend = (d.melhorias || []).filter(m => m.validacao_gestor === 'pendente').length;
        if (pend) out.push(a('melhoria', 'info', `${pend} melhoria(s) aguardando validação do gestor.`));

        return out.sort((x, y) => PESO[y.gravidade] - PESO[x.gravidade]);
    }

    return { calcular, semanasPrevistas, segunda };
});
