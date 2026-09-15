// Projeto Ficha 360/js/painel.js
window.Ficha360Painel = (function () {
    'use strict';

    const FILTROS_VAZIOS = { busca: '', responsavel: '', regime: '', status: '', depto: '', semaforo: '', inativas: false };
    const filtros = { ...FILTROS_VAZIOS };
    // Filtros extras (selects) ficam recolhidos no celular; lembra se o usuário abriu.
    let filtrosAbertos = false;
    let timerBusca = null;

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

    // Quantos filtros "extras" (os selects/checkbox que ficam recolhidos no celular) estão ligados.
    function qtdFiltrosExtras() {
        return ['responsavel', 'regime', 'status', 'depto'].filter(k => filtros[k]).length + (filtros.inativas ? 1 : 0);
    }

    function algumFiltroAtivo() {
        return Object.keys(FILTROS_VAZIOS).some(k => filtros[k] !== FILTROS_VAZIOS[k]);
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

        const contador = (valor, rotulo, chave, tom) => {
            const ativo = filtros.semaforo === chave;
            return `<button type="button" class="contador ${tom ? 'contador-' + tom : ''} ${ativo ? 'ativo' : ''}" data-semaforo="${chave}" aria-pressed="${ativo}"><strong class="num">${valor}</strong><span>${rotulo}</span></button>`;
        };

        const statusOpts = Object.entries(F360.ROTULO_STATUS).map(([k, v]) =>
            `<option value="${k}" ${filtros.status === k ? 'selected' : ''}>${v}</option>`).join('');
        const deptoOpts = [['folha', 'DP / Folha'], ['contabil', 'Contábil'], ['fiscal', 'Fiscal'], ['societario', 'Societário'], ['bpo', 'BPO']]
            .map(([k, v]) => `<option value="${k}" ${filtros.depto === k ? 'selected' : ''}>${v}</option>`).join('');
        const extras = qtdFiltrosExtras();

        tela.innerHTML = `
          <div class="cabecalho-tela">
            <h2>Painel da Carteira<span class="sub">Toque em uma empresa para abrir a ficha completa</span></h2>
            <button class="btn" id="btnAtualizar" title="Recarregar os dados">🔄 <span>Atualizar</span></button>
          </div>
          <div class="contadores">
            ${contador(ativos.length, 'Empresas ativas', '')}
            ${contador(conta(i => i.semaforo === 'vermelho'), 'Críticas', 'vermelho', 'critico')}
            ${contador(conta(i => i.semaforo === 'amarelo'), 'Atenção', 'amarelo', 'atencao')}
            ${contador(semResp, 'Sem responsável', 'sem_responsavel')}
          </div>
          <div class="filtros">
            <label class="busca"><span class="sr-only">Buscar empresa</span>
              <input type="search" id="fBusca" placeholder="Código, nome ou CNPJ" value="${F360.esc(filtros.busca)}" autocomplete="off" enterkeyhint="search"></label>
            <button type="button" class="btn btn-filtros" id="btnFiltros" aria-expanded="${filtrosAbertos}" aria-controls="filtrosExtra">
              ⚙️ Filtros ${extras ? `<span class="badge">${extras}</span>` : ''}</button>
            <div class="filtros-extra ${filtrosAbertos ? 'aberto' : ''}" id="filtrosExtra">
              <select id="fResp" aria-label="Responsável">${opcoes(todos.flatMap(i => i.responsaveisDp.concat(i.responsaveisContabil)), filtros.responsavel, 'Responsável')}</select>
              <select id="fRegime" aria-label="Regime">${opcoes(todos.map(i => i.regime), filtros.regime, 'Regime')}</select>
              <select id="fStatus" aria-label="Status na carteira"><option value="">Status na carteira</option>${statusOpts}</select>
              <select id="fDepto" aria-label="Departamento"><option value="">Departamento</option>${deptoOpts}</select>
              <label><input type="checkbox" id="fInativas" ${filtros.inativas ? 'checked' : ''}> Mostrar inativas</label>
            </div>
          </div>
          <div class="resumo-filtros" id="resumoFiltros" aria-live="polite"></div>
          <div class="tabela-wrap" id="tabelaCarteira"></div>`;

        renderTabela();
        ligarEventos(tela);
    }

    function renderResumoFiltros(qtd) {
        const el = document.getElementById('resumoFiltros');
        el.innerHTML = `<span>${qtd} empresa(s)</span>${algumFiltroAtivo() ? '<button type="button" class="btn-link" id="btnLimparFiltros">Limpar filtros</button>' : ''}`;
        const limpar = document.getElementById('btnLimparFiltros');
        if (limpar) limpar.addEventListener('click', () => { Object.assign(filtros, FILTROS_VAZIOS); render(); });
    }

    function renderTabela() {
        const lista = aplicarFiltros(F360.carteira);
        const wrap = document.getElementById('tabelaCarteira');
        renderResumoFiltros(lista.length);
        if (!lista.length) {
            wrap.innerHTML = `<div class="vazio">Nenhuma empresa encontrada com esses filtros.${algumFiltroAtivo()
                ? '<br><button type="button" class="btn-link" id="btnLimparVazio">Limpar filtros</button>' : ''}</div>`;
            const b = document.getElementById('btnLimparVazio');
            if (b) b.addEventListener('click', () => { Object.assign(filtros, FILTROS_VAZIOS); render(); });
            return;
        }
        const linhas = lista.map(i => {
            const visiveis = i.alertas.filter(a => a.gravidade !== 'info');
            const chips = visiveis.slice(0, 3).map(F360.chipAlerta).join('') +
                (visiveis.length > 3 ? `<span class="chip chip-neutro">+${visiveis.length - 3}</span>` : '');
            const resp = [
                i.responsaveisDp.length ? `DP: ${F360.esc(i.responsaveisDp.join(', '))}` : '',
                i.responsaveisContabil.length ? `Cont.: ${F360.esc(i.responsaveisContabil.join(', '))}` : '',
            ].filter(Boolean);
            // Linha compacta só do celular: regime · empregados · responsáveis.
            const infoMovel = [
                i.regime ? F360.esc(i.regime) : '',
                i.empregadosAtivos == null ? '' : `👥 ${i.empregadosAtivos}`,
                ...resp,
            ].filter(Boolean).map(t => `<span>${t}</span>`).join('');
            const rotulo = F360.ROTULO_SEMAFORO[i.semaforo] || '';
            return `<tr class="clicavel sem-${i.semaforo}" data-codigo="${F360.esc(i.codigo)}" tabindex="0" role="link" aria-label="${F360.esc(`${i.nome} — ${rotulo}`)}">
                <td class="col-barra" title="${F360.esc(rotulo)}"></td>
                <td class="mono cel-codigo">${F360.esc(i.codigo)}</td>
                <td class="cel-nome"><strong>${F360.esc(i.nome)}</strong>${i.grupo ? `<br><span class="chip chip-neutro">${F360.esc(i.grupo)}</span>` : ''}</td>
                <td class="col-hide-movel">${F360.esc(i.regime) || '—'}</td>
                <td class="col-hide-movel">${resp.join('<br>') || '<span class="bloqueado">—</span>'}</td>
                <td class="num t-right col-hide-movel">${i.empregadosAtivos == null ? '—' : i.empregadosAtivos}</td>
                <td class="so-movel cel-info">${infoMovel}</td>
                <td class="cel-alertas">${chips || '<span class="bloqueado">Sem alertas</span>'}</td>
                <td class="cel-seta" aria-hidden="true">›</td>
            </tr>`;
        }).join('');
        wrap.innerHTML = `<table class="tabela tabela-carteira">
            <thead><tr><th></th><th>Código</th><th>Empresa</th><th class="col-hide-movel">Regime</th><th class="col-hide-movel">Responsáveis</th><th class="t-right col-hide-movel">Empreg. ativos</th><th class="so-movel"></th><th>Alertas</th><th></th></tr></thead>
            <tbody>${linhas}</tbody></table>`;
        wrap.querySelectorAll('tr.clicavel').forEach(tr => {
            tr.addEventListener('click', () => F360.irParaEmpresa(tr.dataset.codigo));
            tr.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); F360.irParaEmpresa(tr.dataset.codigo); }
            });
        });
    }

    function ligarEventos(tela) {
        const bind = (id, evento, chave, valor) =>
            document.getElementById(id).addEventListener(evento, (e) => { filtros[chave] = valor(e.target); atualizarBadgeFiltros(); renderTabela(); });
        document.getElementById('fBusca').addEventListener('input', (e) => {
            filtros.busca = e.target.value;
            clearTimeout(timerBusca);
            timerBusca = setTimeout(renderTabela, 120);
        });
        bind('fResp', 'change', 'responsavel', el => el.value);
        bind('fRegime', 'change', 'regime', el => el.value);
        bind('fStatus', 'change', 'status', el => el.value);
        bind('fDepto', 'change', 'depto', el => el.value);
        bind('fInativas', 'change', 'inativas', el => el.checked);
        document.getElementById('btnFiltros').addEventListener('click', (e) => {
            filtrosAbertos = !filtrosAbertos;
            document.getElementById('filtrosExtra').classList.toggle('aberto', filtrosAbertos);
            e.currentTarget.setAttribute('aria-expanded', String(filtrosAbertos));
        });
        tela.querySelectorAll('.contador').forEach(c => c.addEventListener('click', () => {
            filtros.semaforo = filtros.semaforo === c.dataset.semaforo ? '' : c.dataset.semaforo;
            render();
        }));
        document.getElementById('btnAtualizar').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            const ok = await F360.carregar();
            btn.disabled = false;
            if (ok) render();
        });
    }

    function atualizarBadgeFiltros() {
        const btn = document.getElementById('btnFiltros');
        const n = qtdFiltrosExtras();
        btn.innerHTML = `⚙️ Filtros ${n ? `<span class="badge">${n}</span>` : ''}`;
    }

    return { render };
})();
