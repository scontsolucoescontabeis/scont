// Projeto Ficha 360/js/ficha.js
window.Ficha360Ficha = (function () {
    'use strict';

    const ABAS = [
        ['resumo', 'Resumo'], ['cadastro', 'Cadastro'], ['vencimentos', 'Vencimentos'],
        ['dp', 'DP'], ['contabil', 'Contábil'], ['anotacoes', 'Anotações'], ['crm', 'CRM'],
    ];
    const NOME_MODULO = {
        certificado: 'Certificado', licenca: 'Licenças', folha: 'Folha', qsa: 'QSA', formularios: 'Formulários',
        diario: 'Diário', mapeamento: 'Mapeamento', onboarding: 'Onboarding', cadastro: 'Cadastro',
    };
    const FONTES_POR_ABA = {
        vencimentos: ['certificados', 'licencas', 'alvaras'],
        dp: ['empregados', 'socios', 'ciclos', 'formularios', 'empregadosForm', 'cfgFolha', 'respDp'],
        contabil: ['cfgContabil', 'onboardings', 'mapeamentos', 'pendencias', 'diarioEventos', 'respContabil'],
    };

    let codigoAtual = null;
    let abaAtual = 'resumo';

    const esc = (v) => F360.esc(v);
    const item = () => F360.carteira.find(i => i.codigo === codigoAtual);

    function avisoFontes(aba) {
        const falhas = (FONTES_POR_ABA[aba] || []).filter(k => F360.falhas[k]);
        if (!falhas.length) return '';
        return `<div class="aviso-fontes">${falhas.map(k =>
            `${F360.falhas[k] === 'sem_permissao' ? '🔒 Sem permissão' : '⚠️ Indisponível'}: ${esc(F360.NOMES_FONTE[k] || k)}`).join(' · ')}</div>`;
    }

    function abrir(codigo) {
        if (codigo !== codigoAtual) abaAtual = 'resumo';
        codigoAtual = codigo;
        const tela = document.getElementById('telaFicha');
        const it = item();
        if (!it) {
            tela.innerHTML = `<div class="cartao vazio">Empresa <strong>${esc(codigo)}</strong> não encontrada.<br><br>
                <button class="btn btn-primario" id="btnVoltarErro">Voltar ao painel</button></div>`;
            document.getElementById('btnVoltarErro').addEventListener('click', () => F360.irParaPainel());
            return;
        }
        const cod = encodeURIComponent(it.codigo);
        const atalhos = [
            ['📔 Diário', `../Projeto Onboarding Contabil/diario.html?empresa=${cod}`],
            ['📜 Licenças', `../Projeto Licenças/index.html?empresa=${cod}`],
            ['🔑 Certificado', `../Projeto Certificado Digital/index.html?empresa=${cod}`],
            ['⏱️ Controle de Frequência', `../Projeto RH/admin.html?empresa=${cod}`],
            ['✅ Fechamento', `../Projeto Fechamento Folha/controle.html?empresa=${cod}`],
        ].map(([r, href]) => `<a class="btn btn-mini" href="${href}" target="_blank" rel="noopener">${r}</a>`).join('');

        tela.innerHTML = `
          <div class="ficha-cab">
            <button class="btn btn-mini" id="btnVoltar">← Painel</button>
            <h2 style="margin-top:8px">${F360.semaforoHtml(it.semaforo)} ${esc(it.nome)}</h2>
            <div class="ficha-meta">
              <span>Código <strong>${esc(it.codigo)}</strong></span>
              <span>CNPJ <strong>${esc(it.cnpj) || '—'}</strong></span>
              <span>Regime <strong>${esc(it.regime) || '—'}</strong></span>
              <span>Carteira <strong>${esc(F360.ROTULO_STATUS[it.statusCarteira] || it.statusCarteira)}</strong></span>
              <span>DP <strong>${esc(it.responsaveisDp.join(', ')) || '—'}</strong></span>
              <span>Contábil <strong>${esc(it.responsaveisContabil.join(', ')) || '—'}</strong></span>
              ${it.grupo ? `<span>Grupo <strong>${esc(it.grupo)}</strong></span>` : ''}
            </div>
            <div class="atalhos">${atalhos}</div>
          </div>
          <div class="abas">${ABAS.map(([k, r]) => `<button class="aba ${k === abaAtual ? 'ativa' : ''}" data-aba="${k}">${r}</button>`).join('')}</div>
          <div id="conteudoAba"></div>`;

        document.getElementById('btnVoltar').addEventListener('click', () => F360.irParaPainel());
        tela.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => {
            abaAtual = b.dataset.aba;
            tela.querySelectorAll('.aba').forEach(x => x.classList.toggle('ativa', x === b));
            renderAba();
        }));
        renderAba();
    }

    function reabrir() {
        if (codigoAtual) abrir(codigoAtual);
    }

    function renderAba() {
        const el = document.getElementById('conteudoAba');
        const it = item();
        const render = {
            resumo: renderResumo, vencimentos: renderVencimentos, dp: renderDp, contabil: renderContabil, crm: renderCrm,
            cadastro: (c, i) => Ficha360Cadastro.render(c, i),
            anotacoes: (c, i) => Ficha360Anotacoes.render(c, i),
        }[abaAtual];
        el.innerHTML = '';
        render(el, it);
    }

    function renderResumo(el, it) {
        const vencProx = it.certificados.concat(it.licencas)
            .map(x => Ficha360Regras.diasAte(x.data_vencimento || x.data_validade, F360.hoje))
            .filter(d => d !== null).sort((a, b) => a - b)[0];
        const ultimoCiclo = it.ciclos.slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)))[0];
        const pendAbertas = it.pendencias.filter(p => p.status === 'aberta').length;
        const cartao = (titulo, numero, sub) =>
            `<div class="cartao"><h3>${titulo}</h3><div class="numero">${numero}</div><div class="bloqueado">${sub || ''}</div></div>`;

        el.innerHTML = `
          <div class="grade">
            ${cartao('Empregados ativos', it.empregadosAtivos == null ? '—' : it.empregadosAtivos, `${it.socios.length} sócio(s)`)}
            ${cartao('Próximo vencimento', vencProx == null ? '—' : (vencProx < 0 ? `vencido ${-vencProx}d` : `${vencProx}d`), `${it.certificados.length} cert. · ${it.licencas.length} lic./alv.`)}
            ${cartao('Folha', it.possuiFolha ? (ultimoCiclo ? esc(ultimoCiclo.competencia) : 'sem ciclo') : 'não contratada', ultimoCiclo ? (ultimoCiclo.concluido_em ? 'concluída' : 'em andamento') : '')}
            ${cartao('Contábil', it.possuiContabil ? esc((it.mapeamento && it.mapeamento.nivel_atencao) || 'sem mapeamento') : 'não contratado', `${pendAbertas} pendência(s) aberta(s)`)}
          </div>
          <div class="cartao" style="margin-top:12px">
            <h3>Alertas (${it.alertas.length})</h3>
            ${it.alertas.length ? `<ul class="lista-alertas">${it.alertas.map(a =>
                `<li><span class="chip chip-${a.gravidade}">${esc(NOME_MODULO[a.modulo] || a.modulo)}</span>${esc(a.mensagem)}</li>`).join('')}</ul>`
                : '<div class="bloqueado">Nenhum alerta.</div>'}
          </div>`;
    }

    function linhaDias(dataISO) {
        const d = Ficha360Regras.diasAte(dataISO, F360.hoje);
        if (d === null) return '—';
        const g = d < 0 ? 'critico' : d <= 30 ? 'atencao' : 'info';
        return `<span class="chip chip-${g}">${d < 0 ? `vencido há ${-d}d` : `${d}d`}</span>`;
    }

    function renderVencimentos(el, it) {
        const certs = it.certificados.map(c => `<tr>
            <td>${esc(c.cliente) || '—'}</td><td>${esc(c.cpf_cnpj) || '—'}</td><td>${esc(c.situacao) || '—'}</td>
            <td>${F360.fmtData(c.data_vencimento)}</td><td>${linhaDias(c.data_vencimento)}</td></tr>`).join('');
        const lics = it.licencas.slice().sort((a, b) => String(a.data_validade).localeCompare(String(b.data_validade))).map(l => `<tr>
            <td>${l.origem === 'alvara' ? 'Alvará' : 'Licença'}</td><td>${esc(l.tipo) || '—'}</td><td>${esc(l.estabelecimento) || '—'}</td>
            <td>${F360.fmtData(l.data_validade)}</td><td>${linhaDias(l.data_validade)}</td></tr>`).join('');
        el.innerHTML = `${avisoFontes('vencimentos')}
          <div class="cartao"><h3>Certificados digitais</h3>
            ${certs ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Titular</th><th>CPF/CNPJ</th><th>Situação</th><th>Vencimento</th><th>Prazo</th></tr></thead><tbody>${certs}</tbody></table></div>`
                : '<div class="bloqueado">Nenhum certificado vinculado (vínculo por CNPJ da empresa ou CPF dos sócios).</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Licenças e alvarás</h3>
            ${lics ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Tipo</th><th>Descrição</th><th>Estabelecimento</th><th>Validade</th><th>Prazo</th></tr></thead><tbody>${lics}</tbody></table></div>`
                : '<div class="bloqueado">Nenhuma licença ou alvará ativo.</div>'}
          </div>`;
    }

    async function renderDp(el, it) {
        const ciclos = it.ciclos.slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
        const ciclosHtml = ciclos.map(c => {
            const fases = c.fechamento_ciclo_fase || [];
            const pend = fases.filter(f => f.status !== 'concluida');
            return `<li><strong>${esc(c.competencia)}</strong> — ${c.concluido_em ? `concluída em ${F360.fmtData(c.concluido_em)}` : `${pend.length}/${fases.length} fase(s) pendente(s)${pend.length ? ': ' + esc(pend.map(f => f.nome_fase).join(', ')) : ''}`}</li>`;
        }).join('');
        const qsa = it.ocorrenciasQsa.map(o => `<li><span class="chip chip-${o.ocorrendo_agora ? 'critico' : 'atencao'}">${o.ocorrendo_agora ? 'agora' : 'histórico'}</span>
            ${esc(o.nome_socio)} × empregado ${esc(o.codigo_empregado)} (${esc(o.tipo_match)})</li>`).join('');
        const abertos = it.formularios.filter(f => !['validado', 'rejeitado', 'excluido'].includes(f.status));

        el.innerHTML = `${avisoFontes('dp')}
          <div class="grade">
            <div class="cartao"><h3>Folha contratada</h3><div class="numero">${it.possuiFolha ? 'Sim' : 'Não'}</div></div>
            <div class="cartao"><h3>Empregados ativos</h3><div class="numero">${it.empregadosAtivos == null ? '—' : it.empregadosAtivos}</div></div>
            <div class="cartao"><h3>Formulários em aberto</h3><div class="numero">${abertos.length}</div></div>
            <div class="cartao"><h3>Jornada / Escala</h3><div class="numero" id="jornadaEscala">…</div></div>
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Fechamento da folha (mês passado e atual)</h3>
            ${ciclosHtml ? `<ul class="lista-alertas">${ciclosHtml}</ul>` : '<div class="bloqueado">Nenhum ciclo nas competências recentes.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Sócios (${it.socios.length})</h3>
            ${it.socios.length ? `<ul class="lista-alertas">${it.socios.map(s => `<li>${esc(s.nome_socio)} — entrada ${F360.fmtData(s.data_entrada)}${s.data_saida ? ` · saída ${F360.fmtData(s.data_saida)}` : ''}</li>`).join('')}</ul>` : '<div class="bloqueado">Nenhum sócio importado.</div>'}
            ${qsa ? `<h3 style="margin-top:12px">Análise do QSA</h3><ul class="lista-alertas">${qsa}</ul>` : ''}
          </div>`;

        const { jornada, escala } = await Ficha360Fontes.contarJornadaEscala(F360.sb, it.codigo);
        const alvo = document.getElementById('jornadaEscala');
        if (!alvo) return; // usuário trocou de aba
        const fmt = (n) => n == null ? '🔒' : (n > 0 ? '✅' : '—');
        alvo.innerHTML = `<span title="Jornada">${fmt(jornada)}</span> / <span title="Escala">${fmt(escala)}</span>`;
    }

    function renderContabil(el, it) {
        const per = (it.mapeamento && it.mapeamento.periodicidade) || 'mensal';
        const ultimo = new Map();
        it.diarioEventos.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
            .forEach(ev => ultimo.set(`${ev.ano}|${ev.mes}`, ev));
        const diario = [...ultimo.values()].sort((a, b) => (b.ano * 12 + b.mes) - (a.ano * 12 + a.mes)).slice(0, 6).map(ev => {
            const g = ev.tipo_evento === 'rejeitado' ? 'critico' : ev.tipo_evento === 'aprovado' ? 'info' : 'atencao';
            return `<li><strong>${esc(ContabilDiarioUtil.descricaoPeriodo(per, ev.ano, ev.mes))}</strong>
                <span class="chip chip-${g}">${esc(ev.tipo_evento)}</span> ${F360.fmtData(ev.created_at)}${ev.mensagem ? ` — ${esc(ev.mensagem)}` : ''}</li>`;
        }).join('');
        const onb = it.onboarding;
        const itensOnb = onb ? (onb.contabil_onboarding_itens || []) : [];
        const pctOnb = itensOnb.length ? Math.round(100 * itensOnb.filter(x => ['aprovado', 'nao_aplicavel'].includes(x.status)).length / itensOnb.length) : null;
        const pend = it.pendencias.filter(p => p.status === 'aberta').map(p =>
            `<li>${esc(p.descricao)}${p.responsavel ? ` — ${esc(p.responsavel)}` : ''} ${p.prazo ? linhaDias(p.prazo) : ''}</li>`).join('');

        el.innerHTML = `${avisoFontes('contabil')}
          <div class="grade">
            <div class="cartao"><h3>Contábil contratado</h3><div class="numero">${it.possuiContabil ? 'Sim' : 'Não'}</div></div>
            <div class="cartao"><h3>Periodicidade</h3><div class="numero">${esc(per)}</div><div class="bloqueado">Último mês fechado: ${F360.fmtData(it.mapeamento && it.mapeamento.ultimo_mes_fechado)}</div></div>
            <div class="cartao"><h3>Nível de atenção</h3><div class="numero">${esc((it.mapeamento && it.mapeamento.nivel_atencao) || '—')}</div></div>
            <div class="cartao"><h3>Onboarding</h3><div class="numero">${onb ? esc(onb.status) : '—'}</div><div class="bloqueado">${pctOnb == null ? '' : `${pctOnb}% dos itens concluídos`}</div></div>
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Diário — últimas competências</h3>
            ${diario ? `<ul class="lista-alertas">${diario}</ul>` : '<div class="bloqueado">Nenhum envio registrado.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Pendências do mapeamento</h3>
            ${pend ? `<ul class="lista-alertas">${pend}</ul>` : '<div class="bloqueado">Nenhuma pendência aberta.</div>'}
          </div>`;
    }

    async function renderCrm(el, it) {
        el.innerHTML = '<div class="cartao"><div class="bloqueado">Carregando conversas…</div></div>';
        const res = await Ficha360Fontes.carregarCrm(F360.sb, it);
        if (abaAtual !== 'crm' || codigoAtual !== it.codigo) return;
        if (!res.ok) {
            el.innerHTML = `<div class="cartao bloqueado">${res.motivo === 'sem_permissao' ? '🔒 Sem permissão para ver o CRM.' : '⚠️ CRM indisponível no momento.'}</div>`;
            return;
        }
        const linhas = res.dados.map(c => `<tr>
            <td>${esc(c.protocolo) || '—'}</td><td>${esc(c.contatos && c.contatos.nome) || '—'}</td>
            <td>${esc(c.departamento)}</td><td>${esc(c.status)}</td><td>${F360.fmtData(c.aberto_em)}</td></tr>`).join('');
        el.innerHTML = `<div class="aviso-fontes">ℹ️ Vínculo por nome da empresa (aproximado).</div>
          <div class="cartao"><h3>Últimas conversas</h3>
            ${linhas ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Protocolo</th><th>Contato</th><th>Departamento</th><th>Status</th><th>Aberta em</th></tr></thead><tbody>${linhas}</tbody></table></div>`
                : '<div class="bloqueado">Nenhuma conversa vinculada a esta empresa.</div>'}
          </div>`;
    }

    return { abrir, reabrir };
})();
