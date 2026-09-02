/**
 * Feriados nacionais e locais.
 *
 * Módulo puro: sem DOM, sem Supabase. Funciona como <script> global no
 * navegador (define as funções no escopo global) e via require() em Node
 * (para os testes).
 *
 * Uma linha de rh_feriados pode ser:
 *   - fixa recorrente:  data = 'DD/MM'        (todo ano)
 *   - fixa específica:   data = 'DD/MM/AAAA'  (uma vez)
 *   - móvel:            regra_movel = <chave> (calculada pela Páscoa do ano)
 *
 * Abrangência: 'nacional' (todas as empresas), 'estadual' (empresas da UF) ou
 * 'municipal' (empresas da UF + município). Tipo: 'feriado' ou 'facultativo'.
 */

// Offset em dias corridos sobre o Domingo de Páscoa.
const REGRAS_MOVEIS = {
    sexta_santa:      { offset: -2,  descricao: 'Sexta-feira Santa' },
    carnaval_segunda: { offset: -48, descricao: 'Carnaval (segunda-feira)' },
    carnaval_terca:   { offset: -47, descricao: 'Carnaval (terça-feira)' },
    quarta_cinzas:    { offset: -46, descricao: 'Quarta-feira de Cinzas' },
    corpus_christi:   { offset: 60,  descricao: 'Corpus Christi' },
};

// Algoritmo "Anonymous Gregorian" (Meeus/Jones/Butcher). Retorna Date em UTC.
function calcularDomingoPascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(ano, mes - 1, dia));
}

function _pad2(n) {
    return String(n).padStart(2, '0');
}

function _formatarBR(dateUTC) {
    return `${_pad2(dateUTC.getUTCDate())}/${_pad2(dateUTC.getUTCMonth() + 1)}/${dateUTC.getUTCFullYear()}`;
}

// regra: chave de REGRAS_MOVEIS. Retorna 'DD/MM/AAAA' ou null se a regra não existe.
function resolverDataMovel(regra, ano) {
    const r = REGRAS_MOVEIS[regra];
    if (!r) return null;
    const pascoa = calcularDomingoPascoa(ano);
    const alvo = new Date(Date.UTC(
        pascoa.getUTCFullYear(), pascoa.getUTCMonth(), pascoa.getUTCDate() + r.offset
    ));
    return _formatarBR(alvo);
}

// rows: linhas cruas de rh_feriados. ano: usado para resolver as regras móveis.
// Retorna [{ id, descricao, tipo, abrangencia, uf, municipio, movel, data }].
// Descarta ativo === false e itens sem data resolvida.
function expandirFeriados(rows, ano) {
    return (rows || [])
        .filter(r => r.ativo !== false)
        .map(r => {
            const item = {
                id: r.id,
                descricao: r.descricao || '',
                tipo: r.tipo === 'facultativo' ? 'facultativo' : 'feriado',
                abrangencia: r.abrangencia || 'nacional',
                uf: r.uf || null,
                municipio: r.municipio || null,
                movel: !!r.regra_movel,
            };
            item.data = r.regra_movel ? resolverDataMovel(r.regra_movel, ano) : (r.data || null);
            if (r.regra_movel) item.regra_movel = r.regra_movel;
            return item;
        })
        .filter(f => !!f.data);
}

function _norm(s) {
    return (s == null ? '' : String(s))
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

// expandidos: saída de expandirFeriados. empresa: { uf, municipio, cidade }.
// Nacional sempre; estadual casa pela UF; municipal casa por UF + município
// (município da empresa: usa 'municipio', caindo para 'cidade').
function feriadosDaEmpresa(expandidos, empresa) {
    const uf = _norm(empresa && empresa.uf);
    const municipioEmpresa = _norm(empresa && (empresa.municipio || empresa.cidade));
    return (expandidos || []).filter(f => {
        if (f.abrangencia === 'nacional') return true;
        if (!uf || _norm(f.uf) !== uf) return false;
        if (f.abrangencia === 'estadual') return true;
        if (f.abrangencia === 'municipal') return !!municipioEmpresa && _norm(f.municipio) === municipioEmpresa;
        return false;
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        REGRAS_MOVEIS,
        calcularDomingoPascoa,
        resolverDataMovel,
        expandirFeriados,
        feriadosDaEmpresa,
        _norm,
        _formatarBR,
    };
}
