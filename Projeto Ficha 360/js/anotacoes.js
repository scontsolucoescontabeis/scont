// Projeto Ficha 360/js/anotacoes.js
window.Ficha360Anotacoes = (function () {
    'use strict';

    const esc = (v) => F360.esc(v);
    const CATEGORIAS = { geral: 'Geral', dp: 'DP', contabil: 'Contábil', financeiro: 'Financeiro', combinado: 'Combinado com cliente' };
    let filtroCategoria = '';
    // Rascunho da "nova anotação" e da edição aberta — qualquer um conta como "não salvo".
    let rascunhoNova = false;
    let editando = false;
    const atualizarSujo = () => { F360.sujo = rascunhoNova || editando; };

    // silencioso=true: recarrega a lista sem trocar a tela por "Carregando…" (evita piscar após salvar).
    async function render(el, it, silencioso) {
        rascunhoNova = false; editando = false; atualizarSujo();
        if (!silencioso) el.innerHTML = '<div class="cartao"><div class="bloqueado">Carregando anotações…</div></div>';
        const { data, error } = await F360.sb.from('ficha360_anotacoes')
            .select('*').eq('codigo_empresa', it.codigo)
            .order('fixada', { ascending: false }).order('created_at', { ascending: false });
        if (!el.isConnected) return;
        if (error) {
            const motivo = Ficha360Fontes.classificarErro(error);
            el.innerHTML = `<div class="cartao bloqueado">${motivo === 'tabela_ausente' ? `${F360.ico('config')}Configuração pendente — SQL da Ficha 360 não executado.`
                : motivo === 'sem_permissao' ? `${F360.ico('cadeado')}Sem permissão.` : `${F360.ico('aviso')}Anotações indisponíveis no momento. Tente atualizar a página.`}</div>`;
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
              ${a.fixada ? `<span title="Anotação fixada">${F360.ico('fixar')}<span class="sr-only">Fixada</span></span>` : ''}<span class="chip chip-neutro">${esc(CATEGORIAS[a.categoria] || a.categoria)}</span>
              <strong>${esc(a.autor_nome) || '—'}</strong> · ${F360.fmtData(a.created_at)}${a.editado_em ? ' · editada' : ''}
              ${podeEditar(a) ? `<span class="anotacao-acoes">
                <button type="button" class="btn btn-mini" data-acao="fixar">${a.fixada ? 'Desafixar' : 'Fixar'}</button>
                <button type="button" class="btn btn-mini" data-acao="editar">Editar</button>
                <button type="button" class="btn btn-mini btn-perigo" data-acao="excluir">Excluir</button></span>` : ''}
            </div>
            <div class="anotacao-texto">${esc(a.texto)}</div>
          </div>`).join('');

        el.innerHTML = `
          <div class="cartao">
            <h3>Nova anotação</h3>
            <label class="campo"><span class="sr-only">Texto da anotação</span><textarea id="anTexto" name="texto" autocomplete="off" placeholder="Ex.: Cliente pediu envio da folha até dia 5; combinado com o sócio João…"></textarea></label>
            <div class="erro-campo" id="anErro" role="alert" hidden></div>
            <div class="acoes">
              <select id="anCategoria" name="categoria" aria-label="Categoria" class="empurra">${Object.entries(CATEGORIAS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select>
              <button type="button" class="btn btn-primario" id="anSalvar">Registrar anotação</button>
            </div>
          </div>
          <div class="cartao">
            <div class="cabecalho-cartao">
              <h3>Histórico (${lista.length})</h3>
              <select id="anFiltro" name="filtro-categoria" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${Object.entries(CATEGORIAS).map(([k, r]) =>
                  `<option value="${k}" ${filtroCategoria === k ? 'selected' : ''}>${r}</option>`).join('')}</select>
            </div>
            ${cards || `<div class="bloqueado">${filtroCategoria && lista.length ? 'Nenhuma anotação nessa categoria.' : 'Nenhuma anotação ainda. Registre a primeira acima.'}</div>`}
          </div>`;

        const texto = document.getElementById('anTexto');
        const erro = document.getElementById('anErro');
        texto.addEventListener('input', () => { rascunhoNova = texto.value.trim() !== ''; atualizarSujo(); erro.hidden = true; });

        document.getElementById('anFiltro').addEventListener('change', (e) => {
            filtroCategoria = e.target.value;
            // Preserva o que já foi digitado na nova anotação ao trocar o filtro.
            const digitado = texto.value, cat = document.getElementById('anCategoria').value;
            desenhar(el, it, lista);
            document.getElementById('anTexto').value = digitado;
            document.getElementById('anCategoria').value = cat;
            rascunhoNova = digitado.trim() !== ''; atualizarSujo();
            document.getElementById('anFiltro').focus();
        });

        document.getElementById('anSalvar').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const conteudo = texto.value.trim();
            if (!conteudo) {
                erro.textContent = 'Escreva a anotação antes de registrar.';
                erro.hidden = false;
                texto.focus();
                return;
            }
            const rotuloOriginal = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Registrando…';
            const { error } = await F360.sb.from('ficha360_anotacoes').insert({
                codigo_empresa: it.codigo, texto: conteudo,
                categoria: document.getElementById('anCategoria').value,
                autor_nome: F360.auth.userData?.nome || F360.auth.email || null,
            });
            if (error) {
                btn.disabled = false;
                btn.textContent = rotuloOriginal;
                F360.avisar(`Não foi possível registrar a anotação: ${error.message}. O texto foi mantido; tente de novo.`, 'erro');
                return;
            }
            await render(el, it, true);
            F360.avisar('Anotação registrada.');
        });

        el.querySelectorAll('.anotacao [data-acao]').forEach(b => b.addEventListener('click', async () => {
            const id = b.closest('.anotacao').dataset.id;
            const a = lista.find(x => x.id === id);
            let resp;
            if (b.dataset.acao === 'editar') {
                editarInline(b.closest('.anotacao'), a, el, it);
                return;
            }
            if (b.dataset.acao === 'excluir') {
                if (!(await F360.confirmar('Excluir esta anotação? Essa ação não pode ser desfeita.', 'Excluir anotação'))) return;
            }
            b.disabled = true;
            if (b.dataset.acao === 'fixar') {
                resp = await F360.sb.from('ficha360_anotacoes').update({ fixada: !a.fixada }).eq('id', id);
            } else {
                resp = await F360.sb.from('ficha360_anotacoes').delete().eq('id', id);
            }
            if (resp.error) {
                b.disabled = false;
                F360.avisar(`Não foi possível concluir a ação: ${resp.error.message}. Tente de novo.`, 'erro');
                return;
            }
            // Mantém o rascunho digitado enquanto a lista recarrega.
            const digitado = document.getElementById('anTexto')?.value || '';
            await render(el, it, true);
            const novo = document.getElementById('anTexto');
            if (novo && digitado) { novo.value = digitado; rascunhoNova = true; atualizarSujo(); }
            F360.avisar(b.dataset.acao === 'excluir' ? 'Anotação excluída.' : (a.fixada ? 'Anotação desafixada.' : 'Anotação fixada.'));
        }));
    }

    // Troca o texto do card por um textarea com Salvar/Cancelar (prompt() é ruim no celular).
    function editarInline(card, a, el, it) {
        const textoEl = card.querySelector('.anotacao-texto');
        const acoesEl = card.querySelector('.anotacao-acoes');
        if (acoesEl) acoesEl.hidden = true;
        textoEl.outerHTML = `<div class="anotacao-edicao">
            <label class="campo form-topo"><span class="sr-only">Editar anotação</span><textarea name="texto-editado" autocomplete="off">${esc(a.texto)}</textarea></label>
            <div class="acoes">
              <button type="button" class="btn btn-mini" data-ed="cancelar">Cancelar</button>
              <button type="button" class="btn btn-mini btn-primario" data-ed="salvar">Salvar edição</button>
            </div></div>`;
        const edicao = card.querySelector('.anotacao-edicao');
        const ta = edicao.querySelector('textarea');
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.addEventListener('input', () => { editando = ta.value.trim() !== a.texto.trim(); atualizarSujo(); });
        edicao.querySelector('[data-ed="cancelar"]').addEventListener('click', () => render(el, it, true));
        edicao.querySelector('[data-ed="salvar"]').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const novo = ta.value.trim();
            if (!novo || novo === a.texto) { render(el, it, true); return; }
            btn.disabled = true;
            btn.textContent = 'Salvando…';
            const { error } = await F360.sb.from('ficha360_anotacoes').update({ texto: novo, editado_em: new Date().toISOString() }).eq('id', a.id);
            if (error) {
                btn.disabled = false;
                btn.textContent = 'Salvar edição';
                F360.avisar(`Não foi possível salvar a edição: ${error.message}. Tente de novo.`, 'erro');
                return;
            }
            await render(el, it, true);
            F360.avisar('Anotação atualizada.');
        });
    }

    return { render };
})();
