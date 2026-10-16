// Projeto Ficha 360/js/cadastro.js
window.Ficha360Cadastro = (function () {
    'use strict';

    const esc = (v) => F360.esc(v);
    const AREAS = { geral: 'Geral', dp: 'DP', contabil: 'Contábil', fiscal: 'Fiscal', financeiro: 'Financeiro' };

    // Cada bloco com formulário controla o seu "não salvo"; F360.sujo é a soma dos dois.
    const sujos = { scont: false, contato: false };
    function marcarSujo(bloco, valor) {
        sujos[bloco] = valor;
        F360.sujo = sujos.scont || sujos.contato;
    }

    function tabelaIndisponivel(chave) {
        return F360.falhas[chave] === 'tabela_ausente'
            ? `${F360.ico('config')}Configuração pendente — SQL da Ficha 360 não executado.`
            : F360.falhas[chave] === 'sem_permissao' ? `${F360.ico('cadeado')}Sem permissão.` : F360.falhas[chave] ? `${F360.ico('aviso')}Indisponível no momento. Tente atualizar a página.` : '';
    }

    function render(el, it) {
        sujos.scont = false; sujos.contato = false; F360.sujo = false;
        const d = it.dominio;
        const ro = (rotulo, valor) => `<div class="campo"><span class="rotulo">${rotulo}</span><div class="campo-ro">${esc(valor) || '—'}</div></div>`;

        el.innerHTML = `
          <div class="cartao"><h3>Dados do Domínio (somente leitura)</h3>
            <div class="form-grade ro-grade">
              ${ro('Razão social', d.nome_empresa)}${ro('CNPJ', d.cnpj)}${ro('Regime', d.regime_enquadramento)}
              ${ro('Inscrição estadual', d.inscricao_estadual)}${ro('Inscrição municipal', d.inscricao_municipal)}
              ${ro('Situação no Domínio', d.status_situacao)}${ro('Endereço', d.endereco)}
              ${ro('Cidade / UF', [d.cidade || d.municipio, d.uf].filter(Boolean).join(' / '))}${ro('CEP', d.cep)}${ro('E-mail', d.email)}
              ${ro('Cliente desde', F360.fmtData(d.data_cadastro))}
            </div>
            <div class="checks form-topo">
              <span>DP/Folha: <strong>${it.possuiFolha ? 'Sim' : 'Não'}</strong></span>
              <span>Contábil: <strong>${it.possuiContabil ? 'Sim' : 'Não'}</strong></span>
              <span class="bloqueado">(configurados no Fechamento da Folha e na Central Contábil)</span>
            </div>
          </div>
          <div class="cartao" id="blocoScont"></div>
          <div class="cartao" id="blocoContatos"></div>`;

        renderScont(document.getElementById('blocoScont'), it);
        renderContatos(document.getElementById('blocoContatos'), it);
    }

    function renderScont(el, it) {
        marcarSujo('scont', false);
        const indisp = tabelaIndisponivel('fichas');
        if (indisp) { el.innerHTML = `<h3>Dados Scont</h3><div class="bloqueado">${indisp}</div>`; return; }
        const f = it.ficha || {};
        const opt = (valor, rotulo, atual) => `<option value="${valor}" ${valor === atual ? 'selected' : ''}>${rotulo}</option>`;
        const chk = (id, nome, rotulo, v) => `<label><input type="checkbox" id="${id}" name="${nome}" ${v ? 'checked' : ''}> ${rotulo}</label>`;

        el.innerHTML = `<h3>Dados Scont</h3>
          <div class="form-grade">
            <label class="campo"><span class="rotulo">Status na carteira</span>
              <select id="cStatus" name="status_carteira">${Object.entries(F360.ROTULO_STATUS).map(([k, r]) => opt(k, r, f.status_carteira || 'ativo')).join('')}</select></label>
            <label class="campo"><span class="rotulo">Saída do cliente</span> <input type="date" id="cSaida" name="data_saida_cliente" autocomplete="off" value="${esc(f.data_saida_cliente || '')}"></label>
            <label class="campo"><span class="rotulo">Porte</span> <input type="text" id="cPorte" name="porte" autocomplete="off" value="${esc(f.porte || '')}"></label>
            <label class="campo"><span class="rotulo">Atividade principal</span> <input type="text" id="cAtividade" name="atividade_principal" autocomplete="off" value="${esc(f.atividade_principal || '')}"></label>
          </div>
          <div class="checks form-topo">
            ${chk('cFiscal', 'atende_fiscal', 'Atende Fiscal', f.atende_fiscal)}${chk('cSocietario', 'atende_societario', 'Atende Societário', f.atende_societario)}${chk('cBpo', 'atende_bpo', 'Atende BPO', f.atende_bpo)}
          </div>
          <label class="campo form-topo"><span class="rotulo">Observação geral</span> <textarea id="cObs" name="observacao_geral" autocomplete="off">${esc(f.observacao_geral || '')}</textarea></label>
          <div class="acoes">
            ${f.updated_at ? `<span class="bloqueado empurra">Atualizado por ${esc(f.atualizado_por || '—')} em ${F360.fmtData(f.updated_at)}</span>` : ''}
            <button type="button" class="btn btn-primario" id="cSalvar">Salvar dados Scont</button>
          </div>`;

        el.addEventListener('input', () => marcarSujo('scont', true));
        el.addEventListener('change', () => marcarSujo('scont', true));

        document.getElementById('cSalvar').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
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
            const rotuloOriginal = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Salvando…';
            const { data, error } = await F360.sb.from('ficha360_empresa').upsert(registro, { onConflict: 'codigo_empresa' }).select().single();
            if (error) {
                btn.disabled = false;
                btn.textContent = rotuloOriginal;
                F360.avisar(`Não foi possível salvar os dados Scont: ${error.message}. Confira a conexão e tente de novo.`, 'erro');
                return;
            }
            F360.dados.fichas = (F360.dados.fichas || []).filter(x => x.codigo_empresa !== it.codigo).concat([data]);
            F360.recalcular();
            marcarSujo('scont', false);
            // Atualiza só o que mudou (topo + este bloco); a página não pisca nem volta ao início.
            Ficha360Ficha.atualizarCabecalho();
            const novo = F360.carteira.find(i => i.codigo === it.codigo) || it;
            renderScont(el, novo);
            document.getElementById('cSalvar')?.focus({ preventScroll: true });
            F360.avisar('Dados Scont salvos.');
        });
    }

    function renderContatos(el, it) {
        marcarSujo('contato', false);
        const indisp = tabelaIndisponivel('contatos');
        if (indisp) { el.innerHTML = `<h3>Contatos do cliente</h3><div class="bloqueado">${indisp}</div>`; return; }
        const linhas = it.contatos.slice().sort((a, b) => Number(b.principal) - Number(a.principal)).map(c => `<tr>
            <td>${c.principal ? `<span title="Contato principal">${F360.ico('estrela')}<span class="sr-only">Principal: </span></span> ` : ''}${esc(c.nome)}</td><td>${esc(c.funcao) || '—'}</td><td>${esc(AREAS[c.area] || c.area)}</td>
            <td>${esc(c.telefone) || '—'}</td><td>${esc(c.whatsapp) || '—'}</td><td>${esc(c.email) || '—'}</td>
            <td><button type="button" class="btn btn-mini btn-perigo" data-excluir="${esc(c.id)}" data-nome="${esc(c.nome)}">Excluir</button></td></tr>`).join('');

        el.innerHTML = `<h3>Contatos do cliente</h3>
          ${linhas ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>Função</th><th>Área</th><th>Telefone</th><th>WhatsApp</th><th>E-mail</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${linhas}</tbody></table></div>`
            : '<div class="bloqueado">Nenhum contato cadastrado.</div>'}
          <div class="form-grade form-topo">
            <label class="campo"><span class="rotulo">Nome *</span> <input type="text" id="ktNome" name="nome" autocomplete="off" required></label>
            <label class="campo"><span class="rotulo">Função</span> <input type="text" id="ktFuncao" name="funcao" autocomplete="off"></label>
            <label class="campo"><span class="rotulo">Área</span> <select id="ktArea" name="area">${Object.entries(AREAS).map(([k, r]) => `<option value="${k}">${r}</option>`).join('')}</select></label>
            <label class="campo"><span class="rotulo">Telefone</span> <input type="tel" inputmode="tel" id="ktTelefone" name="telefone" autocomplete="off" placeholder="(61) 3000-0000"></label>
            <label class="campo"><span class="rotulo">WhatsApp</span> <input type="tel" inputmode="tel" id="ktWhats" name="whatsapp" autocomplete="off" placeholder="(61) 90000-0000"></label>
            <label class="campo"><span class="rotulo">E-mail</span> <input type="email" inputmode="email" id="ktEmail" name="email" autocomplete="off" spellcheck="false" placeholder="nome@empresa.com.br"></label>
          </div>
          <div class="erro-campo" id="ktErro" role="alert" hidden></div>
          <div class="acoes">
            <label class="checks empurra"><input type="checkbox" id="ktPrincipal" name="principal"> Contato principal</label>
            <button type="button" class="btn btn-primario" id="ktAdd">Adicionar contato</button>
          </div>`;

        el.querySelector('.form-grade').addEventListener('input', () => marcarSujo('contato', true));

        const erro = document.getElementById('ktErro');
        document.getElementById('ktAdd').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const nome = document.getElementById('ktNome').value.trim();
            if (!nome) {
                erro.textContent = 'Informe o nome do contato para adicioná-lo.';
                erro.hidden = false;
                document.getElementById('ktNome').focus();
                return;
            }
            erro.hidden = true;
            const registro = {
                codigo_empresa: it.codigo, nome,
                funcao: document.getElementById('ktFuncao').value.trim() || null,
                area: document.getElementById('ktArea').value,
                telefone: document.getElementById('ktTelefone').value.trim() || null,
                whatsapp: document.getElementById('ktWhats').value.trim() || null,
                email: document.getElementById('ktEmail').value.trim() || null,
                principal: document.getElementById('ktPrincipal').checked,
            };
            const rotuloOriginal = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Adicionando…';
            const { data, error } = await F360.sb.from('ficha360_contatos').insert(registro).select().single();
            if (error) {
                btn.disabled = false;
                btn.textContent = rotuloOriginal;
                F360.avisar(`Não foi possível adicionar o contato: ${error.message}. Tente de novo.`, 'erro');
                return;
            }
            F360.dados.contatos = (F360.dados.contatos || []).concat([data]);
            F360.recalcular();
            marcarSujo('contato', false);
            Ficha360Ficha.atualizarCabecalho();
            renderContatos(el, F360.carteira.find(i => i.codigo === it.codigo) || it);
            document.getElementById('ktNome')?.focus({ preventScroll: true });
            F360.avisar('Contato adicionado.');
        });

        el.querySelectorAll('[data-excluir]').forEach(b => b.addEventListener('click', async () => {
            if (!(await F360.confirmar(`Excluir o contato "${b.dataset.nome}"? Essa ação não pode ser desfeita.`, 'Excluir contato'))) return;
            b.disabled = true;
            const { error } = await F360.sb.from('ficha360_contatos').delete().eq('id', b.dataset.excluir);
            if (error) {
                b.disabled = false;
                F360.avisar(`Não foi possível excluir o contato: ${error.message}. Tente de novo.`, 'erro');
                return;
            }
            F360.dados.contatos = (F360.dados.contatos || []).filter(x => x.id !== b.dataset.excluir);
            F360.recalcular();
            Ficha360Ficha.atualizarCabecalho();
            renderContatos(el, F360.carteira.find(i => i.codigo === it.codigo) || it);
            F360.avisar('Contato excluído.');
        }));
    }

    return { render };
})();
