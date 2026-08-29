/**
 * Monta o HTML do documento de controle (view de impressão / "Salvar como PDF").
 * Módulo puro. <script> global no navegador + require() em Node (testes).
 *
 * Depende de Differ.
 */
(function (root, factory) {
    const dep = (typeof module === 'object' && module.exports)
        ? require('./differ.js')
        : root.Differ;
    const api = factory(dep);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.ContratoReport = api;
})(typeof self !== 'undefined' ? self : this, function (Differ) {

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    const ROTULO = {
        alterada: 'Alterada',
        nova: 'Nova',
        suprimida: 'Suprimida',
        igual: 'Sem alteração',
    };

    function ladoHtml(segs, lado) {
        const filtrados = Differ.segmentosParaLado(segs, lado);
        if (!filtrados.length) return '<span class="vazio">—</span>';
        return filtrados.map(s => {
            const t = escapeHtml(s.texto);
            if (s.tipo === 'add') return `<ins>${t}</ins>`;
            if (s.tipo === 'del') return `<del>${t}</del>`;
            return t;
        }).join('');
    }

    function seccaoClausula(linha) {
        const segs = Differ.diffPalavras(linha.corpoAnt || '', linha.corpoNova || '');
        const obs = linha.observacao
            ? `<p class="obs"><strong>Observação:</strong> ${escapeHtml(linha.observacao)}</p>`
            : '';
        return `
        <section class="clausula ${linha.classificacao}">
            <h3>
                <span class="selo selo-${linha.classificacao}">${ROTULO[linha.classificacao] || ''}</span>
                ${escapeHtml(linha.titulo || '(sem título)')}
            </h3>
            <div class="colunas">
                <div class="col">
                    <div class="col-rot">Redação anterior</div>
                    <div class="col-txt">${linha.classificacao === 'nova' ? '<span class="vazio">—</span>' : ladoHtml(segs, 'ant')}</div>
                </div>
                <div class="col">
                    <div class="col-rot">Redação atual</div>
                    <div class="col-txt">${linha.classificacao === 'suprimida' ? '<span class="vazio">—</span>' : ladoHtml(segs, 'nova')}</div>
                </div>
            </div>
            ${obs}
        </section>`;
    }

    /**
     * @param {{capa, linhas, dataEmissao}} dados
     *   linhas: já filtradas/ordenadas pela UI (só as que devem sair no PDF)
     */
    function montarRelatorio(dados) {
        const capa = dados.capa || {};
        const linhas = (dados.linhas || []).filter(
            l => ['alterada', 'nova', 'suprimida'].includes(l.classificacao)
        );
        const socios = (capa.socios || [])
            .map(s => `${escapeHtml(s.nome)}${s.cpf ? ' — CPF ' + escapeHtml(s.cpf) : ''}`)
            .join('<br>');

        const numero = capa.numeroAlteracao != null ? `${capa.numeroAlteracao}ª ` : '';

        const corpo = linhas.length
            ? linhas.map(seccaoClausula).join('')
            : '<p class="nenhuma">Nenhuma cláusula alterada, nova ou suprimida foi identificada.</p>';

        return `
<div class="doc-controle">
    <header class="doc-header">
        <h1>Documento de Controle de Alterações Contratuais</h1>
        <table class="doc-capa">
            <tr><th>Razão social</th><td>${escapeHtml(capa.razaoSocial || '—')}</td></tr>
            ${capa.nomeFantasia ? `<tr><th>Nome fantasia</th><td>${escapeHtml(capa.nomeFantasia)}</td></tr>` : ''}
            <tr><th>CNPJ</th><td>${escapeHtml(capa.cnpj || '—')}</td></tr>
            <tr><th>Alteração</th><td>${numero}Alteração Contratual</td></tr>
            <tr><th>Data do ato</th><td>${escapeHtml(capa.dataAto || '—')}</td></tr>
            ${socios ? `<tr><th>Sócios</th><td>${socios}</td></tr>` : ''}
        </table>
    </header>

    <div class="doc-resumo">
        ${resumoLinha(linhas)}
    </div>

    <main class="doc-corpo">
        ${corpo}
    </main>

    <footer class="doc-footer">
        <p class="aviso">Documento de conferência. Não substitui análise jurídica
        e não valida se a alteração está correta ou completa.</p>
        <p class="assinatura">SCONT Soluções Contábeis — Documento de controle de
        alterações — emitido em ${escapeHtml(dados.dataEmissao || '')}</p>
    </footer>
</div>`;
    }

    function resumoLinha(linhas) {
        const c = { alterada: 0, nova: 0, suprimida: 0 };
        linhas.forEach(l => { c[l.classificacao]++; });
        return `<strong>${c.alterada}</strong> alterada(s) &nbsp;·&nbsp; ` +
               `<strong>${c.nova}</strong> nova(s) &nbsp;·&nbsp; ` +
               `<strong>${c.suprimida}</strong> suprimida(s)`;
    }

    return { montarRelatorio, escapeHtml };
});
