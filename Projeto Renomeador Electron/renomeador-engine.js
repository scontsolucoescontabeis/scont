/**
 * SCONT - Motor do Renomeador (compartilhado Portal Web + App Electron)
 * Arquivo: renomeador-engine.js
 *
 * As TAGS ({CNPJ}, {MM-1}, ...) são DADOS (tabela rh_renomeador_tags), não código.
 * O motor lê a definição de cada tag e monta a regex do padrão DE e a substituição
 * do padrão PARA. Assim, novas tags de tipos já suportados não exigem nova versão
 * do app — basta cadastrar a tag em Configurações.
 *
 * !! Este arquivo existe em DUAS cópias idênticas:
 *      Projeto RH/renomeador-engine.js
 *      Projeto Renomeador Electron/renomeador-engine.js
 *    Ao alterar uma, copie para a outra (o app Electron empacota seus próprios arquivos).
 *
 * Definição de uma tag (linha de rh_renomeador_tags):
 *   nome           'CNPJ'                      (sem chaves; pode ter hífen: 'MM-1')
 *   regex_de       '(?<cnpj>\d{14})' | null    regex inserida no padrão DE (null = tag não vale no DE)
 *   empresa_chave  'codigo_empresa'|'cnpj'|null  se preenchido, o grupo `grupo_de` identifica a empresa
 *   grupo_de       'cnpj'                      nome do grupo nomeado usado por empresa_chave
 *   tipo_para      'nenhum' | 'captura' | 'empresa_campo' | 'mapeamento' | 'competencia'
 *   config_para    JSON conforme o tipo:
 *       captura        { grupo: 'dia' }                      valor capturado no DE (obrigatório)
 *       empresa_campo  { campo: 'nome_empresa' }             campo da empresa identificada
 *       mapeamento     { grupo: 'nome' }                     dicionário rh_mapeamento_nomes
 *       competencia    { campo: 'mes'|'ano', deslocamento: -1,
 *                        grupo_mes: 'gerMes', grupo_ano: 'gerAno' }
 *                      parte de grupo_mes/grupo_ano (se capturados no DE) ou, senão,
 *                      da competência informada na tela; desloca N meses; devolve mês ou ano.
 */
(function (raiz) {
    'use strict';

    // Conjunto embutido: usado se a tabela não existir/estiver vazia ou o servidor não responder.
    const TAGS_PADRAO = [
        { nome: 'CODIGO_EMPRESA', descricao: 'Extrai o código (DE) ou insere o código (PARA).', regex_de: '(?<codigo>\\d+)', grupo_de: 'codigo', empresa_chave: 'codigo_empresa', tipo_para: 'empresa_campo', config_para: { campo: 'codigo_empresa' } },
        { nome: 'NOME_EMPRESA', descricao: 'Insere o nome da empresa (apenas no PARA).', regex_de: null, grupo_de: null, empresa_chave: null, tipo_para: 'empresa_campo', config_para: { campo: 'nome_empresa' } },
        { nome: 'NOME_ARQUIVO', descricao: 'Extrai o nome original (DE).', regex_de: '(?<nome>.+?)', grupo_de: 'nome', empresa_chave: null, tipo_para: 'captura', config_para: { grupo: 'nome' } },
        { nome: 'NOME_DOCUMENTO', descricao: 'Insere o nome mapeado (apenas no PARA). Requer cadastro no passo 2.', regex_de: null, grupo_de: null, empresa_chave: null, tipo_para: 'mapeamento', config_para: { grupo: 'nome' } },
        { nome: 'MM', descricao: 'Mês da competência (2 dígitos).', regex_de: '(?<mes>\\d{2})', grupo_de: 'mes', empresa_chave: null, tipo_para: 'competencia', config_para: { campo: 'mes', deslocamento: 0 } },
        { nome: 'AAAA', descricao: 'Ano da competência (4 dígitos).', regex_de: '(?<ano>\\d{4})', grupo_de: 'ano', empresa_chave: null, tipo_para: 'competencia', config_para: { campo: 'ano', deslocamento: 0 } },
        { nome: 'DD', descricao: 'Dia (2 dígitos). No DE extrai o dia do nome; no PARA insere o dia extraído.', regex_de: '(?<dia>\\d{2})', grupo_de: 'dia', empresa_chave: null, tipo_para: 'captura', config_para: { grupo: 'dia' } },
        { nome: 'CNPJ', descricao: 'Extrai o CNPJ (DE), com ou sem máscara, e identifica a empresa por ele. No PARA insere o CNPJ cadastrado.', regex_de: '(?<cnpj>\\d{2}\\.?\\d{3}\\.?\\d{3}[\\/_-]?\\d{4}[-_]?\\d{2})', grupo_de: 'cnpj', empresa_chave: 'cnpj', tipo_para: 'empresa_campo', config_para: { campo: 'cnpj' } },
        { nome: 'COMPETENCIA_GERACAO', descricao: 'Competência de geração do arquivo (DE), formato MMAAAA (aceita - _ . entre mês e ano).', regex_de: '(?<gerMes>\\d{2})[-_.]?(?<gerAno>\\d{4})', grupo_de: null, empresa_chave: null, tipo_para: 'nenhum', config_para: {} },
        { nome: 'MM-1', descricao: 'Mês anterior (apenas no PARA). Parte da competência de geração, se houver no DE; senão da competência informada.', regex_de: null, grupo_de: null, empresa_chave: null, tipo_para: 'competencia', config_para: { campo: 'mes', deslocamento: -1, grupo_mes: 'gerMes', grupo_ano: 'gerAno' } },
        { nome: 'AAAA-1', descricao: 'Ano do mês anterior (apenas no PARA). Em janeiro, é o ano anterior.', regex_de: null, grupo_de: null, empresa_chave: null, tipo_para: 'competencia', config_para: { campo: 'ano', deslocamento: -1, grupo_mes: 'gerMes', grupo_ano: 'gerAno' } },
        { nome: 'IGNORAR', descricao: 'Ignora uma parte do texto original (apenas no DE).', regex_de: '.*?', grupo_de: null, empresa_chave: null, tipo_para: 'nenhum', config_para: {} },
    ];

    const RE_TAG = /\{([^{}\s]+)\}/g;

    function somenteDigitos(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

    function normalizarChave(campo, valor) {
        return campo === 'cnpj' ? somenteDigitos(valor) : String(valor == null ? '' : valor).trim();
    }

    function lerConfig(tag) {
        const c = tag.config_para;
        if (c && typeof c === 'object') return c;
        try { return JSON.parse(c || '{}') || {}; } catch (_) { return {}; }
    }

    // Desloca (ano, mês) em N meses; devolve { mes: '07', ano: '2026' }.
    function deslocarCompetencia(mes, ano, delta) {
        const total = parseInt(ano, 10) * 12 + (parseInt(mes, 10) - 1) + delta;
        const a = Math.floor(total / 12);
        const m = total - a * 12 + 1;
        return { mes: String(m).padStart(2, '0'), ano: String(a) };
    }

    /**
     * @param {{tags?:Array, empresas?:Array, mapeamentos?:Object}} dados
     *   tags         linhas de rh_renomeador_tags (ativas). Vazio => TAGS_PADRAO.
     *   empresas     linhas de rh_empresas ({codigo_empresa, nome_empresa, cnpj})
     *   mapeamentos  { nome_arquivo: nome_documento }
     */
    function criarMotor(dados) {
        const d = dados || {};
        const listaTags = (d.tags && d.tags.length ? d.tags : TAGS_PADRAO).filter(t => t.ativo !== false);
        const tags = {};
        listaTags.forEach(t => { tags[t.nome] = t; });
        const empresas = d.empresas || [];
        const mapeamentos = d.mapeamentos || {};

        const indiceEmpresas = {}; // campo -> { chaveNormalizada -> empresa }
        function empresaPorChave(campo, valor) {
            if (!indiceEmpresas[campo]) {
                const idx = {};
                empresas.forEach(e => { const k = normalizarChave(campo, e[campo]); if (k) idx[k] = e; });
                indiceEmpresas[campo] = idx;
            }
            return indiceEmpresas[campo][normalizarChave(campo, valor)];
        }

        // Padrão DE -> RegExp (null se a regex resultante for inválida, ex.: mesma tag repetida)
        function criarRegexDoPadrao(padraoDe) {
            let r = String(padraoDe).replace(/[.*+?^$()|[\]\\]/g, '\\$&');
            r = r.replace(RE_TAG, (txt, nome) => {
                const t = tags[nome];
                return t && t.regex_de ? t.regex_de : txt;
            });
            try { return new RegExp('^' + r + '$', 'i'); } catch (_) { return null; }
        }

        // Acha a primeira regra que casa com o nome (sem extensão).
        function reconhecer(nomeSemExt, regras) {
            for (const regra of regras) {
                const re = criarRegexDoPadrao(regra.padrao_de);
                if (!re) continue;
                const m = nomeSemExt.match(re);
                if (m) return { regra, grupos: m.groups || {} };
            }
            return null;
        }

        // Identifica a empresa: a primeira tag do DE (na ordem de aparição) com empresa_chave e grupo capturado.
        function resolverEmpresa(regra, grupos) {
            let rotulo = '';
            const nomesNoDe = [];
            String(regra.padrao_de).replace(RE_TAG, (txt, nome) => { nomesNoDe.push(nome); return txt; });
            for (const nome of nomesNoDe) {
                const t = tags[nome];
                if (!t || !t.empresa_chave || !t.grupo_de) continue;
                const valor = grupos[t.grupo_de];
                if (valor == null) continue;
                rotulo = t.empresa_chave === 'cnpj' ? `CNPJ ${valor}` : valor;
                const emp = empresaPorChave(t.empresa_chave, valor);
                return { empresa: emp || null, rotulo };
            }
            return { empresa: null, rotulo: '' };
        }

        // Substitui as tags do template PARA/caminho. Lança Error('TAG_SEM_VALOR:NOME') se faltar valor.
        function montar(template, ctx) {
            return String(template).replace(RE_TAG, (txt, nome) => {
                const t = tags[nome];
                if (!t || t.tipo_para === 'nenhum' || !t.tipo_para) return txt;
                const cfg = lerConfig(t);
                let valor;
                switch (t.tipo_para) {
                    case 'captura':
                        valor = ctx.grupos[cfg.grupo];
                        break;
                    case 'empresa_campo':
                        valor = ctx.empresa ? ctx.empresa[cfg.campo] : undefined;
                        break;
                    case 'mapeamento': {
                        const cru = ctx.grupos[cfg.grupo] || '';
                        valor = mapeamentos[cru] || cru;
                        break;
                    }
                    case 'competencia': {
                        const g = ctx.grupos;
                        const temGer = cfg.grupo_mes && g[cfg.grupo_mes] !== undefined && g[cfg.grupo_ano] !== undefined;
                        const baseMes = temGer ? g[cfg.grupo_mes] : ctx.competencia.mes;
                        const baseAno = temGer ? g[cfg.grupo_ano] : ctx.competencia.ano;
                        const r = deslocarCompetencia(baseMes, baseAno, Number(cfg.deslocamento) || 0);
                        valor = cfg.campo === 'ano' ? r.ano : r.mes;
                        break;
                    }
                    default:
                        return txt;
                }
                if (valor === undefined || valor === null || valor === '') throw new Error('TAG_SEM_VALOR:' + nome);
                return String(valor);
            });
        }

        /**
         * Processa um arquivo.
         * @returns {{reconhecido:false}} | {{erro:string}} | {{ok:true, novoNomeBase, caminhoDinamico, empresa}}
         */
        function processar(nomeSemExt, regras, competencia, caminhoDinamicoRaw) {
            const rec = reconhecer(nomeSemExt, regras);
            if (!rec) return { reconhecido: false };

            const { empresa, rotulo } = resolverEmpresa(rec.regra, rec.grupos);
            if (!empresa) return { erro: `Empresa ${rotulo || '(sem código/CNPJ no padrão)'} não encontrada` };

            const ctx = { grupos: rec.grupos, empresa, competencia };
            try {
                return {
                    ok: true,
                    empresa,
                    novoNomeBase: montar(rec.regra.padrao_para, ctx),
                    caminhoDinamico: montar(caminhoDinamicoRaw, ctx),
                };
            } catch (e) {
                const m = /^TAG_SEM_VALOR:(.+)$/.exec(e.message);
                if (m) return { erro: `Tag {${m[1]}} usada no PARA, mas não há valor para ela no padrão DE` };
                throw e;
            }
        }

        return { tags, criarRegexDoPadrao, reconhecer, resolverEmpresa, montar, processar };
    }

    const api = { TAGS_PADRAO, criarMotor, deslocarCompetencia, somenteDigitos };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.RenomeadorEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
