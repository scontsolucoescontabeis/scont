// Projeto Ficha 360/js/painel.js
window.Ficha360Painel = (function () {
    'use strict';

    const filtros = { busca: '', responsavel: '', regime: '', status: '', depto: '', semaforo: '', inativas: false };

    function deptoContratado(item, depto) {
        const f = item.ficha || {};
        return {
            folha: item.possuiFolha, contabil: item.possuiContabil,
            fiscal: !!f.atende_fiscal, societario: !!f.atende_societario, bpo: !!f.atende_bpo,
        }[depto];
    }

    function aplicarFiltros(itens) {
        const busca = filtros.busca.trim().toLowerCase();
        return itens.filter(i => {
            if (!filtros.inativas && i.statusCarteira === 'inativo' && filtros.status !== 'inativo') return false;
            if (busca && !(`${i.codigo} ${i.nome} ${i.cnpj}`.toLowerCase().includes(busca))) return false;
            if (filtros.responsavel && !i.responsaveisDp.concat(i.responsaveisContabil).includes(filtros.responsavel)) return false;
            if (filtros.regime && i.regime !== filtros.regime) return false;
            if (filtros.status && i.statusCarteira !== filtros.status) return false;
            if (filtros.depto && !deptoContratado(i, filtros.depto)) return false;
            if (filtros.semaforo === 'sem_responsavel') {
                const semDp = i.possuiFolha && i.responsaveisDp.length === 0;
                const semCont = i.possuiContabil && i.responsaveisContabil.length === 0;
                if (!semDp && !semCont) return false;
            } else if (filtros.semaforo && i.semaforo !== filtros.semaforo) {
                return false;
            }
            return true;
        });
    }

    function opcoes(valores, selecionado, rotulo) {
        const unicos = [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        return `<option value="">${rotulo}</option>` + unicos.map(v =>
            `<option value="${F360.esc(v)}" ${v === selecionado ? 'selected' : ''}>${F360.esc(v)}</option>`).join('');
    }

    function render() {
        const tela = document.getElementById('telaPainel');
        const todos = F360.carteira;
        const ativos = todos.filter(i => i.statusCarteira !== 'inativo');
        const conta = (fn) => ativos.filter(fn).length;
        const semResp = conta(i => (i.possuiFolha && !i.responsaveisDp.length) || (i.possuiContabil && !i.responsaveisContabil.length));

        const contador = (valor, rotulo, chave, tom) =>
            `<div class="contador ${tom ? 'contador-' + tom : ''} ${filtros.semaforo === chave ? 'ativo' : ''}" data-semaforo="${chave}"><strong>${valor}</strong><span>${rotulo}</span></div>`;

        const statusOpts = Object.entries(F360.ROTULO_STATUS).map(([k, v]) =>
            `<option value="${k}" ${filtros.status === k ? 'selected' : ''}>${v}</option>`).join('');
        const deptoOpts = [['folha', 'DP / Folha'], ['contabil', 'Contábil'], ['fiscal', 'Fiscal'], ['societario', 'Societário'], ['bpo', 'BPO']]
            .map(([k, v]) => `<option value="${k}" ${filtros.depto === k ? 'selected' : ''}>${v}</option>`).join('');

        tela.innerHTML = `
          <div class="cabecalho-tela">
            <h2>Painel da Carteira</h2>
            <button class="btn" id="btnAtualizar">🔄 Atualizar</button>
          </div>
          <div class="contadores">
            ${contador(ativos.length, 'Empresas ativas', '')}
            ${contador(conta(i => i.semaforo === 'vermelho'), 'Críticas', 'vermelho', 'critico')}
            ${contador(conta(i => i.semaforo === 'amarelo'), 'Atenção', 'amarelo', 'atencao')}
            ${contador(semResp, 'Sem responsável definido', 'sem_responsavel')}
          </div>
          <div class="filtros">
            <input type="search" id="fBusca" placeholder="Buscar por código, nome ou CNPJ" value="${F360.esc(filtros.busca)}">
            <select id="fResp">${opcoes(todos.flatMap(i => i.responsaveisDp.concat(i.responsaveisContabil)), filtros.responsavel, 'Responsável')}</select>
            <select id="fRegime">${opcoes(todos.map(i => i.regime), filtros.regime, 'Regime')}</select>
            <select id="fStatus"><option value="">Status na carteira</option>${statusOpts}</select>
            <select id="fDepto"><option value="">Departamento</option>${deptoOpts}</select>
            <label><input type="checkbox" id="fInativas" ${filtros.inativas ? 'checked' : ''}> Mostrar inativas</label>
          </div>
          <div class="tabela-wrap" id="tabelaCarteira"></div>`;

        renderTabela();
        ligarEventos(tela);
    }

    function renderTabela() {
        const lista = aplicarFiltros(F360.carteira);
        const wrap = document.getElementById('tabelaCarteira');
        if (!lista.length) {
            wrap.innerHTML = '<div class="vazio">Nenhuma empresa encontrada com esses filtros.</div>';
            return;
        }
        const linhas = lista.map(i => {
            const visiveis = i.alertas.filter(a => a.gravidade !== 'info');
            const chips = visiveis.slice(0, 3).map(F360.chipAlerta).join('') +
                (visiveis.length > 3 ? `<span class="chip chip-neutro">+${visiveis.length - 3}</span>` : '');
            const resp = [
                i.responsaveisDp.length ? `DP: ${F360.esc(i.responsaveisDp.join(', '))}` : '',
                i.responsaveisContabil.length ? `Cont.: ${F360.esc(i.responsaveisContabil.join(', '))}` : '',
            ].filter(Boolean).join('<br>') || '<span class="bloqueado">—</span>';
            return `<tr class="clicavel sem-${i.semaforo}" data-codigo="${F360.esc(i.codigo)}">
                <td class="col-barra" title="${F360.esc(F360.ROTULO_SEMAFORO[i.semaforo] || '')}"></td>
                <td class="mono">${F360.esc(i.codigo)}</td>
                <td><strong>${F360.esc(i.nome)}</strong>${i.grupo ? `<br><span class="chip chip-neutro">${F360.esc(i.grupo)}</span>` : ''}</td>
                <td>${F360.esc(i.regime) || '—'}</td>
                <td>${resp}</td>
                <td class="num t-right">${i.empregadosAtivos == null ? '—' : i.empregadosAtivos}</td>
                <td>${chips || '<span class="bloqueado">Sem alertas</span>'}</td>
            </tr>`;
        }).join('');
        wrap.innerHTML = `<table class="tabela">
            <thead><tr><th></th><th>Código</th><th>Empresa</th><th>Regime</th><th>Responsáveis</th><th class="t-right">Empreg. ativos</th><th>Alertas</th></tr></thead>
            <tbody>${linhas}</tbody></table>
            <div class="vazio" style="text-align:right;padding:8px 12px">${lista.length} empresa(s)</div>`;
        wrap.querySelectorAll('tr.clicavel').forEach(tr =>
            tr.addEventListener('click', () => F360.irParaEmpresa(tr.dataset.codigo)));
    }

    function ligarEventos(tela) {
        const bind = (id, evento, chave, valor) =>
            document.getElementById(id).addEventListener(evento, (e) => { filtros[chave] = valor(e.target); renderTabela(); });
        bind('fBusca', 'input', 'busca', el => el.value);
        bind('fResp', 'change', 'responsavel', el => el.value);
        bind('fRegime', 'change', 'regime', el => el.value);
        bind('fStatus', 'change', 'status', el => el.value);
        bind('fDepto', 'change', 'depto', el => el.value);
        bind('fInativas', 'change', 'inativas', el => el.checked);
        tela.querySelectorAll('.contador').forEach(c => c.addEventListener('click', () => {
            filtros.semaforo = filtros.semaforo === c.dataset.semaforo ? '' : c.dataset.semaforo;
            render();
        }));
        document.getElementById('btnAtualizar').addEventListener('click', async () => {
            if (await F360.carregar()) render();
        });
    }

    return { render };
})();
