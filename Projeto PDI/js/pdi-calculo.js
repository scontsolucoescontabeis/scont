// Projeto PDI/js/pdi-calculo.js
/**
 * PDI — regras de cálculo (datas D + n, ciclos, indicadores, ficha trimestral).
 * Módulo puro: sem DOM, sem Supabase, sem new Date() implícito (hoje é parâmetro ISO).
 * Datas sempre no formato ISO 'YYYY-MM-DD'.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory();
    else root.PdiCalculo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const PILARES = ['tecnicas', 'comportamentais', 'performance', 'melhorias'];
    const PAPEIS_CIENCIA = ['colaborador', 'gestor', 'diretoria'];

    function parse(iso) {
        const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
        return { a, m, d };
    }
    function fmt(a, m, d) {
        return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    function diasNoMes(a, m) { return new Date(Date.UTC(a, m, 0)).getUTCDate(); }

    function somarDias(iso, n) {
        const { a, m, d } = parse(iso);
        const t = new Date(Date.UTC(a, m - 1, d + n));
        return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    }

    function somarMeses(iso, n) {
        const { a, m, d } = parse(iso);
        const idx = (a * 12 + (m - 1)) + n;
        const na = Math.floor(idx / 12);
        const nm = (idx % 12) + 1;
        return fmt(na, nm, Math.min(d, diasNoMes(na, nm)));
    }

    function diasEntre(deIso, ateIso) {
        const x = parse(deIso), y = parse(ateIso);
        return Math.round((Date.UTC(y.a, y.m - 1, y.d) - Date.UTC(x.a, x.m - 1, x.d)) / 86400000);
    }

    function prazoRelativo(inicio, dias, recorrencia) {
        if (recorrencia) {
            return { rotulo: recorrencia.charAt(0).toUpperCase() + recorrencia.slice(1), data: null, recorrente: true };
        }
        return { rotulo: `D + ${dias} dias`, data: somarDias(inicio, dias), recorrente: false };
    }

    function fimPdi(inicio, meses) { return somarMeses(inicio, meses || 12); }

    function ciclos(inicio) {
        const out = [];
        for (let k = 1; k <= 4; k++) {
            out.push({
                numero: k,
                inicio: somarMeses(inicio, 3 * (k - 1)),
                fim: somarDias(somarMeses(inicio, 3 * k), -1),
                mesesRotulo: `Meses ${3 * (k - 1) + 1} a ${3 * k}`,
            });
        }
        return out;
    }

    function percentual(num, den) {
        if (num == null || den == null || Number(den) === 0) return null;
        return Math.round((Number(num) / Number(den)) * 1000) / 10;
    }

    function atingimento(ind, valor) {
        if (valor == null || !ind) return 'sem_medicao';
        if (ind.tipo_meta === 'a_pactuar') return 'sem_medicao';
        if (ind.valor_meta == null) return 'sem_medicao';
        const meta = Number(ind.valor_meta);
        const op = ind.operador || '>=';
        if (op === '<=') {
            if (valor <= meta) return 'atingida';
            return valor <= meta * 1.2 ? 'parcial' : 'nao_atingida';
        }
        if (op === '=') {
            if (valor === meta) return 'atingida';
            return valor >= meta * 0.8 ? 'parcial' : 'nao_atingida';
        }
        if (valor >= meta) return 'atingida';
        return valor >= meta * 0.8 ? 'parcial' : 'nao_atingida';
    }

    function nivelAtual(niveis) {
        const v = (niveis || []).filter(x => x.validado_em)
            .sort((a, b) => String(a.data).localeCompare(String(b.data)));
        return v.length ? v[v.length - 1].nivel : null;
    }

    function progressoTecnico(rotinas, minimo) {
        const prio = (rotinas || []).filter(r => r.priorizada);
        const atingidas = prio.filter(r => (nivelAtual(r.niveis) || 0) >= minimo).length;
        return { atingidas, total: prio.length };
    }

    function autonomia(rotinas) {
        const p = progressoTecnico(rotinas, 3);
        return percentual(p.atingidas, p.total);
    }

    function controles(realizadas, previstas) { return percentual(realizadas, previstas); }

    function pendencias(sinalizacoes) {
        const lista = sinalizacoes || [];
        const antes = lista.filter(s => String(s.data_sinalizacao) <= String(s.prazo_entrega)).length;
        return percentual(antes, lista.length);
    }

    function mediaNotas(notas) {
        const v = (notas || []).filter(x => x != null && !isNaN(x));
        if (!v.length) return null;
        return Math.round((v.reduce((s, x) => s + Number(x), 0) / v.length) * 10) / 10;
    }

    function validarFicha(f) {
        const erros = [];
        const pilares = f.pilares || [];
        PILARES.forEach(p => {
            const x = pilares.find(q => q.pilar === p);
            if (!x) { erros.push(`Pilar "${p}" sem avaliação.`); return; }
            if (x.na) {
                if (!String(x.justificativa_na || '').trim()) erros.push(`Pilar "${p}": N/A exige justificativa.`);
            } else if (!(x.nota_ciclo >= 1 && x.nota_ciclo <= 4)) {
                erros.push(`Pilar "${p}": informe nota de 1 a 4 ou N/A justificado.`);
            }
        });
        if (!f.resultado) erros.push('Informe o resultado do ciclo.');
        if (!(f.direcionamentos || []).length) erros.push('Informe ao menos um direcionamento.');
        PAPEIS_CIENCIA.forEach(p => {
            if (!(f.ciencias || []).includes(p)) erros.push(`Ciência pendente: ${p}.`);
        });
        return erros;
    }

    function nivelInicialPendente(inicio, hoje, qtdNiveisRegistrados) {
        return qtdNiveisRegistrados === 0 && String(hoje) > somarDias(inicio, 15);
    }

    return {
        PILARES, PAPEIS_CIENCIA, somarDias, somarMeses, diasEntre, prazoRelativo, fimPdi, ciclos,
        percentual, atingimento, nivelAtual, progressoTecnico, autonomia, controles, pendencias,
        mediaNotas, validarFicha, nivelInicialPendente,
    };
});
