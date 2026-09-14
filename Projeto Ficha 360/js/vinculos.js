// Projeto Ficha 360/js/vinculos.js
/**
 * Ficha 360 — normalização e vínculos entre módulos.
 * Módulo puro: sem DOM, sem Supabase. Global `Ficha360Vinculos` no navegador; require() em Node.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.Ficha360Vinculos = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SUFIXOS = ['LTDA', 'ME', 'EPP', 'EIRELI', 'SA', 'SS', 'MEI'];

    function soDigitos(v) {
        return String(v == null ? '' : v).replace(/\D/g, '');
    }

    function normalizarNome(v) {
        let s = String(v == null ? '' : v)
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toUpperCase()
            .replace(/S\/A|S\.A\./g, ' SA ')
            .replace(/[^A-Z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const partes = s ? s.split(' ') : [];
        while (partes.length > 1 && SUFIXOS.includes(partes[partes.length - 1])) partes.pop();
        return partes.join(' ');
    }

    function indexarPorCodigo(linhas, campo) {
        const chave = campo || 'codigo_empresa';
        const mapa = new Map();
        for (const l of linhas || []) {
            const k = l[chave];
            if (k == null) continue;
            if (!mapa.has(k)) mapa.set(k, []);
            mapa.get(k).push(l);
        }
        return mapa;
    }

    function _adicionar(mapa, codigo, item) {
        if (!mapa.has(codigo)) mapa.set(codigo, []);
        mapa.get(codigo).push(item);
    }

    function vincularCertificados(certificados, empresas, socios) {
        const porCnpj = new Map();
        for (const e of empresas || []) {
            const d = soDigitos(e.cnpj);
            if (d.length === 14) porCnpj.set(d, e.codigo_empresa);
        }
        const porCpf = new Map();
        for (const s of socios || []) {
            const d = soDigitos(s.cpf);
            if (d.length !== 11) continue;
            if (!porCpf.has(d)) porCpf.set(d, new Set());
            porCpf.get(d).add(s.codigo_empresa);
        }
        const out = new Map();
        for (const c of certificados || []) {
            const d = soDigitos(c.cpf_cnpj);
            if (d.length === 14 && porCnpj.has(d)) {
                _adicionar(out, porCnpj.get(d), c);
            } else if (d.length === 11 && porCpf.has(d)) {
                for (const cod of porCpf.get(d)) _adicionar(out, cod, c);
            }
        }
        return out;
    }

    function vincularContatosCrm(contatosEmpresas, empresas) {
        const porNome = new Map();
        for (const e of empresas || []) {
            const n = normalizarNome(e.nome_empresa);
            if (!n) continue;
            if (!porNome.has(n)) porNome.set(n, []);
            porNome.get(n).push(e.codigo_empresa);
        }
        const out = new Map();
        for (const ce of contatosEmpresas || []) {
            const codigos = porNome.get(normalizarNome(ce.empresa));
            if (!codigos) continue;
            for (const cod of codigos) {
                if (!out.has(cod)) out.set(cod, []);
                if (!out.get(cod).includes(ce.contato_id)) out.get(cod).push(ce.contato_id);
            }
        }
        return out;
    }

    return { soDigitos, normalizarNome, indexarPorCodigo, vincularCertificados, vincularContatosCrm };
});
