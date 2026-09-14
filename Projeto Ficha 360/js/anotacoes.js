// Projeto Ficha 360/js/anotacoes.js
window.Ficha360Anotacoes = (function () {
    'use strict';

    const esc = (v) => F360.esc(v);
    const CATEGORIAS = { geral: 'Geral', dp: 'DP', contabil: 'Contábil', financeiro: 'Financeiro', combinado: 'Combinado com cliente' };
    let filtroCategoria = '';

    async function render(el, it) {
        el.innerHTML = '<div class="cartao"><div class="bloqueado">Carregando anotações…</div></div>';
        const { data, error } = await F360.sb.from('ficha360_anotacoes')
            .select('*').eq('codigo_empresa', it.codigo)
            .order('fixada', { ascending: false }).order('created_at', { ascending: false });
        if (!el.isConnected) return;
        if (error) {
            const motivo = Ficha360Fontes.classificarErro(error);
            el.innerHTML = `<div class="cartao bloqueado">${motivo === 'tabela_ausente' ? '🛠️ Configuração pendente — SQL da Ficha 360 não executado.'
                : motivo === 'sem_permissao' ? '🔒 Sem permissão.' : '⚠️ Anotações indisponíveis no momento.'}</div>`;
            return;
        }
        desenhar(el, it, data || []);
    }

    function podeEditar(a) {
        return F360.auth.isAdmin || (F360.userId && a.autor_id === F360.userId);
    }

    function desenhar(el, it, lista) {
        const visiveis = filtroCategoria ? lista.filter(a => a.categoria === filtroCategoria) : lista;
        const cards = visiveis.map(a => `
          <div class="anotacao ${a.fixada ? 'fixada' : ''}" data-id="${esc(a.id)}">
            <div class="anotacao-meta">
              ${a.fixada ? '📌' : ''}<span class="chip chip-neutro">${esc(CATEGORIAS[a.categoria] || a.categoria)}</span>
              <strong>${esc(a.autor_nome) || '—'}</strong> · ${F360.fmtData(a.created_at)}${a.editado_em ? ' · editada' : ''}
              ${podeEditar(a) ? `<span style="margin-left:auto;display:flex;gap:4px">
                <button class="btn btn-mini" data-acao="fixar">${a.fixada ? 'Desafixar' : 'Fixar'}</button>
                <button class="btn btn-mini" data-acao="editar">Editar</button>
                <button class="btn btn-mini btn-perigo" data-acao="excluir">Excluir</button></span>` : ''}
            </div>
            <div class="anotacao-texto">${esc(a.texto)}</div>
          </div>`).join('');

        el.innerHTML = `
          <div class="cartao">
            <h3>Nova anotação</h3>
            <label class="campo"><textarea id="anTexto" placeholder="Ex.: Cliente pediu envio da folha até dia 5; combinado com o sócio João."></textarea></label>
            <div class="acoes">
              <select id="anCategoria" style="margin-right:auto">${Object.entries(CATEGORIAS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select>
              <button class="btn btn-primario" id="anSalvar">Registrar</button>
            </div>
          </div>
          <div class="cartao" style="margin-top:12px">
            <div class="cabecalho-tela" style="margin-bottom:8px">
              <h3 style="margin:0">Histórico (${lista.length})</h3>
              <select id="anFiltro"><option value="">Todas as categorias</option>${Object.entries(CATEGORIAS).map(([k, r]) =>
                  `<option value="${k}" ${filtroCategoria === k ? 'selected' : ''}>${r}</option>`).join('')}</select>
            </div>
            ${cards || '<div class="bloqueado">Nenhuma anotação.</div>'}
          </div>`;

        document.getElementById('anFiltro').addEventListener('change', (e) => { filtroCategoria = e.target.value; desenhar(el, it, lista); });

        document.getElementById('anSalvar').addEventListener('click', async (e) => {
            const texto = document.getElementById('anTexto').value.trim();
            if (!texto) { alert('Escreva a anotação.'); return; }
            e.target.disabled = true;
            const { error } = await F360.sb.from('ficha360_anotacoes').insert({
                codigo_empresa: it.codigo, texto,
                categoria: document.getElementById('anCategoria').value,
                autor_nome: F360.auth.userData?.nome || F360.auth.email || null,
            });
            e.target.disabled = false;
            if (error) { alert(`Não foi possível registrar: ${error.message}`); return; }
            render(el, it);
        });

        el.querySelectorAll('.anotacao [data-acao]').forEach(b => b.addEventListener('click', async () => {
            const id = b.closest('.anotacao').dataset.id;
            const a = lista.find(x => x.id === id);
            let resp;
            if (b.dataset.acao === 'fixar') {
                resp = await F360.sb.from('ficha360_anotacoes').update({ fixada: !a.fixada }).eq('id', id);
            } else if (b.dataset.acao === 'editar') {
                const novo = prompt('Editar anotação:', a.texto);
                if (novo == null || !novo.trim() || novo.trim() === a.texto) return;
                resp = await F360.sb.from('ficha360_anotacoes').update({ texto: novo.trim(), editado_em: new Date().toISOString() }).eq('id', id);
            } else {
                if (!confirm('Excluir esta anotação?')) return;
                resp = await F360.sb.from('ficha360_anotacoes').delete().eq('id', id);
            }
            if (resp.error) { alert(`Não foi possível concluir: ${resp.error.message}`); return; }
            render(el, it);
        }));
    }

    return { render };
})();
