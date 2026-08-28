/**
 * Análise do QSA × rh_empregados.
 *
 * Para cada sócio (rh_socios), verifica se a mesma pessoa esteve
 * registrada como empregado (rh_empregados, tipo "Empregado") da MESMA
 * empresa num período que se sobrepõe ao período como sócio. Match
 * principal por CPF; quando o sócio não tem CPF, tenta por nome
 * normalizado (menor confiança).
 *
 * Cada ocorrência traz `ocorrendo_agora`: true quando o sócio E o
 * vínculo de empregado estão ambos ativos na data de referência
 * (por padrão, hoje) — o caso que a equipe SCONT precisa tratar
 * imediatamente.
 *
 * Módulo puro: sem DOM, sem Supabase. Funciona como <script> global no
 * navegador (expõe `QsaAnalise`) e via require() em Node (testes).
 * Envolto numa IIFE para não colidir com `const` de mesmo nome nos
 * outros <script>s clássicos.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.QsaAnalise = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function _soDigitos(v) {
        return String(v == null ? '' : v).replace(/\D/g, '');
    }

    function _normalizarNome(v) {
        return String(v == null ? '' : v)
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toUpperCase().replace(/\s+/g, ' ').trim();
    }

    function _ms(d, fallback) {
        if (!d) return fallback;
        const t = new Date(d + 'T00:00:00').getTime();
        return isNaN(t) ? fallback : t;
    }

    /**
     * Sobreposição de dois intervalos, tratando datas ausentes como
     * limite aberto (−∞ para início, +∞ para fim).
     */
    function _periodosSobrepoem(ini1, fim1, ini2, fim2) {
        const MIN = -8.64e15, MAX = 8.64e15;
        const a1 = _ms(ini1, MIN), b1 = _ms(fim1, MAX);
        const a2 = _ms(ini2, MIN), b2 = _ms(fim2, MAX);
        return a1 <= b2 && a2 <= b1;
    }

    /** Um intervalo [inicio, fim] (limites abertos quando ausentes) contém `ref`? */
    function _ativoEm(inicio, fim, ref) {
        const MIN = -8.64e15, MAX = 8.64e15;
        const r = _ms(ref, Date.now());
        return _ms(inicio, MIN) <= r && r <= _ms(fim, MAX);
    }

    function _hojeISO() {
        return new Date().toISOString().slice(0, 10);
    }

    /**
     * @param {Array} socios      linhas de rh_socios
     * @param {Array} empregados  linhas de rh_empregados
     * @param {Array} empresas    linhas de rh_empresas (codigo_empresa, nome_empresa) — só p/ rótulo
     * @param {string} [hoje]     data de referência ISO (YYYY-MM-DD); default: hoje
     * @returns {Array} ocorrências ordenadas por nome do sócio
     */
    function computarOcorrencias(socios, empregados, empresas, hoje) {
        const ref = hoje || _hojeISO();
        socios = Array.isArray(socios) ? socios : [];
        empregados = Array.isArray(empregados) ? empregados : [];
        empresas = Array.isArray(empresas) ? empresas : [];

        // Índices de empregados por CPF e por nome normalizado — só vínculos "Empregado".
        const porCpf = new Map();
        const porNome = new Map();
        for (const e of empregados) {
            if ((e.tipo_empregado || '').trim() !== 'Empregado') continue;
            const cpf = _soDigitos(e.cpf);
            if (cpf.length === 11) {
                if (!porCpf.has(cpf)) porCpf.set(cpf, []);
                porCpf.get(cpf).push(e);
            }
            const nome = _normalizarNome(e.nome_empregado);
            if (nome) {
                if (!porNome.has(nome)) porNome.set(nome, []);
                porNome.get(nome).push(e);
            }
        }

        const nomeEmpresa = cod => {
            const emp = empresas.find(x => x.codigo_empresa === cod);
            return emp ? emp.nome_empresa : '';
        };

        const ocorrencias = [];
        for (const s of socios) {
            const cpfSocio = _soDigitos(s.cpf);
            let candidatos, tipoMatch;
            if (cpfSocio.length === 11) {
                candidatos = porCpf.get(cpfSocio) || [];
                tipoMatch = 'CPF';
            } else {
                const nomeSocio = _normalizarNome(s.nome_socio);
                candidatos = nomeSocio ? (porNome.get(nomeSocio) || []) : [];
                tipoMatch = 'Nome (possível)';
            }

            for (const e of candidatos) {
                if ((e.codigo_empresa || '') !== (s.codigo_empresa || '')) continue;
                if (!_periodosSobrepoem(s.data_entrada, s.data_saida, e.data_admissao, e.data_demissao)) continue;

                const obs = [];
                if (!s.data_entrada && !s.data_saida) obs.push('período do sócio indefinido');
                else if (!s.data_entrada || !s.data_saida) obs.push('período do sócio parcialmente indefinido');

                const socioAtivo = _ativoEm(s.data_entrada, s.data_saida, ref);
                const vinculoAtivo = _ativoEm(e.data_admissao, e.data_demissao, ref);

                ocorrencias.push({
                    nome_socio:       s.nome_socio || '',
                    cpf:              s.cpf || '',
                    empresa:          s.codigo_empresa || '',
                    empresa_nome:     nomeEmpresa(s.codigo_empresa),
                    socio_entrada:    s.data_entrada || null,
                    socio_saida:      s.data_saida || null,
                    codigo_empregado: e.codigo_empregado || '',
                    nome_empregado:   e.nome_empregado || '',
                    vinculo_admissao: e.data_admissao || null,
                    vinculo_demissao: e.data_demissao || null,
                    tipo_match:       tipoMatch,
                    observacao:       obs.join('; '),
                    ocorrendo_agora:  socioAtivo && vinculoAtivo,
                });
            }
        }

        ocorrencias.sort((a, b) =>
            (a.nome_socio || '').localeCompare(b.nome_socio || '', 'pt-BR') ||
            (a.empresa || '').localeCompare(b.empresa || ''));

        return ocorrencias;
    }

    return { _soDigitos, _normalizarNome, _periodosSobrepoem, _ativoEm, computarOcorrencias };
});
