// Projeto Ficha 360/js/cadastro.js
window.Ficha360Cadastro = (function () {
    'use strict';

    const esc = (v) => F360.esc(v);
    const AREAS = { geral: 'Geral', dp: 'DP', contabil: 'Contábil', fiscal: 'Fiscal', financeiro: 'Financeiro' };

    function tabelaIndisponivel(chave) {
        return F360.falhas[chave] === 'tabela_ausente'
            ? '🛠️ Configuração pendente — SQL da Ficha 360 não executado.'
            : F360.falhas[chave] === 'sem_permissao' ? '🔒 Sem permissão.' : F360.falhas[chave] ? '⚠️ Indisponível no momento.' : '';
    }

    function render(el, it) {
        const d = it.dominio;
        const ro = (rotulo, valor) => `<div class="campo"><span>${rotulo}</span><div class="campo-ro">${esc(valor) || '—'}</div></div>`;

        el.innerHTML = `
          <div class="cartao"><h3>Dados do Domínio (somente leitura)</h3>
            <div class="form-grade">
              ${ro('Razão social', d.nome_empresa)}${ro('CNPJ', d.cnpj)}${ro('Regime', d.regime_enquadramento)}
              ${ro('Inscrição estadual', d.inscricao_estadual)}${ro('Inscrição municipal', d.inscricao_municipal)}
              ${ro('Situação no Domínio', d.status_situacao)}${ro('Endereço', d.endereco)}
              ${ro('Cidade / UF', [d.cidade || d.municipio, d.uf].filter(Boolean).join(' / '))}${ro('CEP', d.cep)}${ro('E-mail', d.email)}
              ${ro('Cliente desde', F360.fmtData(d.data_cadastro))}
            </div>
            <div class="checks" style="margin-top:10px">
              <span>DP/Folha: <strong>${it.possuiFolha ? 'Sim' : 'Não'}</strong></span>
              <span>Contábil: <strong>${it.possuiContabil ? 'Sim' : 'Não'}</strong></span>
              <span class="bloqueado">(configurados no Fechamento da Folha e na Central Contábil)</span>
            </div>
          </div>
          <div class="cartao" style="margin-top:12px" id="blocoScont"></div>
          <div class="cartao" style="margin-top:12px" id="blocoContatos"></div>`;

        renderScont(document.getElementById('blocoScont'), it);
        renderContatos(document.getElementById('blocoContatos'), it);
    }

    function renderScont(el, it) {
        const indisp = tabelaIndisponivel('fichas');
        if (indisp) { el.innerHTML = `<h3>Dados Scont</h3><div class="bloqueado">${indisp}</div>`; return; }
        const f = it.ficha || {};
        const opt = (valor, rotulo, atual) => `<option value="${valor}" ${valor === atual ? 'selected' : ''}>${rotulo}</option>`;
        const chk = (id, rotulo, v) => `<label><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${rotulo}</label>`;

        el.innerHTML = `<h3>Dados Scont</h3>
          <div class="form-grade">
            <label class="campo">Status na carteira
              <select id="cStatus">${Object.entries(F360.ROTULO_STATUS).map(([k, r]) => opt(k, r, f.status_carteira || 'ativo')).join('')}</select></label>
            <label class="campo">Saída do cliente <input type="date" id="cSaida" value="${esc(f.data_saida_cliente || '')}"></label>
            <label class="campo">Porte <input type="text" id="cPorte" value="${esc(f.porte || '')}"></label>
            <label class="campo">Atividade principal <input type="text" id="cAtividade" value="${esc(f.atividade_principal || '')}"></label>
          </div>
          <div class="checks" style="margin-top:10px">
            ${chk('cFiscal', 'Atende Fiscal', f.atende_fiscal)}${chk('cSocietario', 'Atende Societário', f.atende_societario)}${chk('cBpo', 'Atende BPO', f.atende_bpo)}
          </div>
          <label class="campo" style="margin-top:10px">Observação geral <textarea id="cObs">${esc(f.observacao_geral || '')}</textarea></label>
          <div class="acoes">
            ${f.updated_at ? `<span class="bloqueado" style="margin-right:auto">Atualizado por ${esc(f.atualizado_por || '—')} em ${F360.fmtData(f.updated_at)}</span>` : ''}
            <button class="btn btn-primario" id="cSalvar">Salvar</button>
          </div>`;

        document.getElementById('cSalvar').addEventListener('click', async (e) => {
            const btn = e.target;
            const registro = {
                codigo_empresa: it.codigo,
                status_carteira: document.getElementById('cStatus').value,
                data_saida_cliente: document.getElementById('cSaida').value || null,
                porte: document.getElementById('cPorte').value.trim() || null,
                atividade_principal: document.getElementById('cAtividade').value.trim() || null,
                atende_fiscal: document.getElementById('cFiscal').checked,
                atende_societario: document.getElementById('cSocietario').checked,
                atende_bpo: document.getElementById('cBpo').checked,
                observacao_geral: document.getElementById('cObs').value.trim() || null,
                atualizado_por: F360.auth.userData?.nome || F360.auth.email || null,
            };
            btn.disabled = true;
            const { data, error } = await F360.sb.from('ficha360_empresa').upsert(registro, { onConflict: 'codigo_empresa' }).select().single();
            btn.disabled = false;
            if (error) { alert(`Não foi possível salvar: ${error.message}`); return; }
            F360.dados.fichas = (F360.dados.fichas || []).filter(x => x.codigo_empresa !== it.codigo).concat([data]);
            F360.recalcular();
            Ficha360Ficha.reabrir();
        });
    }

    function renderContatos(el, it) {
        const indisp = tabelaIndisponivel('contatos');
        if (indisp) { el.innerHTML = `<h3>Contatos do cliente</h3><div class="bloqueado">${indisp}</div>`; return; }
        const linhas = it.contatos.slice().sort((a, b) => Number(b.principal) - Number(a.principal)).map(c => `<tr>
            <td>${c.principal ? '⭐ ' : ''}${esc(c.nome)}</td><td>${esc(c.funcao) || '—'}</td><td>${esc(AREAS[c.area] || c.area)}</td>
            <td>${esc(c.telefone) || '—'}</td><td>${esc(c.whatsapp) || '—'}</td><td>${esc(c.email) || '—'}</td>
            <td><button class="btn btn-mini btn-perigo" data-excluir="${esc(c.id)}">Excluir</button></td></tr>`).join('');

        el.innerHTML = `<h3>Contatos do cliente</h3>
          ${linhas ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>Função</th><th>Área</th><th>Telefone</th><th>WhatsApp</th><th>E-mail</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
            : '<div class="bloqueado">Nenhum contato cadastrado.</div>'}
          <div class="form-grade" style="margin-top:12px">
            <label class="campo">Nome* <input type="text" id="ktNome"></label>
            <label class="campo">Função <input type="text" id="ktFuncao"></label>
            <label class="campo">Área <select id="ktArea">${Object.entries(AREAS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></label>
            <label class="campo">Telefone <input type="text" id="ktTelefone"></label>
            <label class="campo">WhatsApp <input type="text" id="ktWhats"></label>
            <label class="campo">E-mail <input type="email" id="ktEmail"></label>
          </div>
          <div class="acoes">
            <label class="checks" style="margin-right:auto"><input type="checkbox" id="ktPrincipal"> Contato principal</label>
            <button class="btn btn-primario" id="ktAdd">Adicionar contato</button>
          </div>`;

        document.getElementById('ktAdd').addEventListener('click', async (e) => {
            const nome = document.getElementById('ktNome').value.trim();
            if (!nome) { alert('Informe o nome do contato.'); return; }
            const registro = {
                codigo_empresa: it.codigo, nome,
                funcao: document.getElementById('ktFuncao').value.trim() || null,
                area: document.getElementById('ktArea').value,
                telefone: document.getElementById('ktTelefone').value.trim() || null,
                whatsapp: document.getElementById('ktWhats').value.trim() || null,
                email: document.getElementById('ktEmail').value.trim() || null,
                principal: document.getElementById('ktPrincipal').checked,
            };
            e.target.disabled = true;
            const { data, error } = await F360.sb.from('ficha360_contatos').insert(registro).select().single();
            e.target.disabled = false;
            if (error) { alert(`Não foi possível adicionar: ${error.message}`); return; }
            F360.dados.contatos = (F360.dados.contatos || []).concat([data]);
            F360.recalcular();
            Ficha360Ficha.reabrir();
        });

        el.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Excluir este contato?')) return;
            const { error } = await F360.sb.from('ficha360_contatos').delete().eq('id', b.dataset.excluir);
            if (error) { alert(`Não foi possível excluir: ${error.message}`); return; }
            F360.dados.contatos = (F360.dados.contatos || []).filter(x => x.id !== b.dataset.excluir);
            F360.recalcular();
            Ficha360Ficha.reabrir();
        }));
    }

    return { render };
})();
