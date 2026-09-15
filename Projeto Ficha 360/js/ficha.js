// Projeto Ficha 360/js/ficha.js
window.Ficha360Ficha = (function () {
    'use strict';

    const ABAS = [
        ['resumo', 'Resumo'], ['cadastro', 'Cadastro'], ['vencimentos', 'Vencimentos'],
        ['dp', 'DP'], ['socios', 'Sócios'], ['contabil', 'Contábil'], ['anotacoes', 'Anotações'], ['crm', 'CRM'],
    ];
    const NOME_MODULO = {
        certificado: 'Certificado', licenca: 'Licenças', folha: 'Folha', qsa: 'QSA', formularios: 'Formulários',
        diario: 'Diário', mapeamento: 'Mapeamento', onboarding: 'Onboarding', cadastro: 'Cadastro',
    };
    // Tipos reconhecidos de empregado (mesmo catálogo de carteira.js/admin.js); usado só pra rótulo.
    const ROTULO_TIPO_EMPREGADO = { Empregado: 'Empregados', 'Estágiario': 'Estagiários', Contribuinte: 'Contribuintes', Outros: 'Outros' };
    const FONTES_POR_ABA = {
        vencimentos: ['certificados', 'licencas', 'alvaras'],
        dp: ['empregados', 'socios', 'ciclos', 'formularios', 'empregadosForm', 'cfgFolha', 'respDp', 'jornadaPadrao', 'jornadasExtras', 'valoresVaVt', 'feriasCalculadas'],
        socios: ['socios'],
        contabil: ['cfgContabil', 'onboardings', 'mapeamentos', 'pendencias', 'diarioEventos', 'respContabil'],
    };

    // Em qual aba cada alerta é detalhado (usado no contador das abas e no link do Resumo).
    const ABA_DO_MODULO = {
        certificado: 'vencimentos', licenca: 'vencimentos',
        folha: 'dp', qsa: 'dp', formularios: 'dp',
        diario: 'contabil', mapeamento: 'contabil', onboarding: 'contabil',
        cadastro: 'cadastro',
    };

    let codigoAtual = null;
    let abaAtual = 'resumo';

    const esc = (v) => F360.esc(v);
    const item = () => F360.carteira.find(i => i.codigo === codigoAtual);

    // Contador de alertas (crítico/atenção) por aba, com a cor do mais grave.
    function badgeAba(it, aba) {
        const lista = it.alertas.filter(a => a.gravidade !== 'info' && (aba === 'resumo' || ABA_DO_MODULO[a.modulo] === aba));
        if (!lista.length) return '';
        const tom = lista.some(a => a.gravidade === 'critico') ? 'b-critico' : 'b-atencao';
        return ` <span class="badge ${tom}" aria-label="${lista.length} alerta(s)">${lista.length}</span>`;
    }

    function avisoFontes(aba) {
        const falhas = (FONTES_POR_ABA[aba] || []).filter(k => F360.falhas[k]);
        if (!falhas.length) return '';
        return `<div class="aviso-fontes">${falhas.map(k =>
            `${F360.falhas[k] === 'sem_permissao' ? '🔒 Sem permissão' : '⚠️ Indisponível'}: ${esc(F360.NOMES_FONTE[k] || k)}`).join(' · ')}</div>`;
    }

    function abrir(codigo, aba) {
        if (codigo !== codigoAtual) abaAtual = 'resumo';
        if (aba && ABAS.some(([k]) => k === aba)) abaAtual = aba;
        codigoAtual = codigo;
        const tela = document.getElementById('telaFicha');
        const it = item();
        if (!it) {
            tela.innerHTML = `<div class="cartao vazio">Empresa <strong>${esc(codigo)}</strong> não encontrada.<br><br>
                <button class="btn btn-primario" id="btnVoltarErro">Voltar ao painel</button></div>`;
            document.getElementById('btnVoltarErro').addEventListener('click', () => F360.irParaPainel());
            return;
        }
        const meta = (rotulo, valor, larga) =>
            `<div${larga ? ' class="meta-larga"' : ''}><dt>${rotulo}</dt><dd>${valor || '—'}</dd></div>`;
        tela.innerHTML = `
          <div class="ficha-cab sem-${it.semaforo}">
            <div class="ficha-topo">
              <button class="btn btn-mini" id="btnVoltar">← Painel</button>
            </div>
            <h2>${esc(it.nome)} ${F360.semaforoHtml(it.semaforo)}</h2>
            <dl class="ficha-meta">
              ${meta('Código', `<span class="mono">${esc(it.codigo)}</span>`)}
              ${meta('Regime', esc(it.regime))}
              ${meta('CNPJ', it.cnpj ? `<span class="mono">${esc(it.cnpj)}</span>` : '', true)}
              ${meta('Carteira', esc(F360.ROTULO_STATUS[it.statusCarteira] || it.statusCarteira))}
              ${it.grupo ? meta('Grupo', esc(it.grupo)) : ''}
              ${meta('Resp. DP', it.possuiFolha ? esc(it.responsaveisDp.join(', ')) : 'N/A', true)}
              ${meta('Resp. Contábil', it.possuiContabil ? esc(it.responsaveisContabil.join(', ')) : 'N/A', true)}
            </dl>
          </div>
          <div class="abas-wrap">
            <div class="abas" role="tablist" aria-label="Seções da ficha">${ABAS.map(([k, r]) =>
                `<button class="aba ${k === abaAtual ? 'ativa' : ''}" role="tab" aria-selected="${k === abaAtual}" data-aba="${k}">${r}${badgeAba(it, k)}</button>`).join('')}</div>
          </div>
          <div id="conteudoAba" role="tabpanel"></div>`;

        document.getElementById('btnVoltar').addEventListener('click', () => F360.irParaPainel());
        tela.querySelectorAll('.aba').forEach(b => b.addEventListener('click', () => trocarAba(b.dataset.aba)));

        // Setas ←/→ navegam entre as abas quando o foco está numa delas.
        tela.querySelector('.abas').addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const idx = ABAS.findIndex(([k]) => k === abaAtual);
            const prox = ABAS[(idx + (e.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length][0];
            trocarAba(prox);
            tela.querySelector(`.aba[data-aba="${prox}"]`).focus();
        });

        // Some o degradê "tem mais abas →" quando já rolou até o fim.
        const abasEl = tela.querySelector('.abas');
        const wrapAbas = tela.querySelector('.abas-wrap');
        const checarFim = () => wrapAbas.classList.toggle('fim', abasEl.scrollLeft + abasEl.clientWidth >= abasEl.scrollWidth - 4);
        abasEl.addEventListener('scroll', checarFim, { passive: true });
        requestAnimationFrame(() => { centralizarAbaAtiva(false); checarFim(); });

        renderAba();
    }

    function centralizarAbaAtiva(suave) {
        const abasEl = document.querySelector('#telaFicha .abas');
        const ativa = abasEl && abasEl.querySelector('.aba.ativa');
        if (!ativa || abasEl.scrollWidth <= abasEl.clientWidth) return;
        const alvo = ativa.offsetLeft - (abasEl.clientWidth - ativa.offsetWidth) / 2;
        abasEl.scrollTo({ left: Math.max(0, alvo), behavior: suave ? 'smooth' : 'auto' });
    }

    function trocarAba(aba) {
        if (!ABAS.some(([k]) => k === aba)) return;
        abaAtual = aba;
        const tela = document.getElementById('telaFicha');
        tela.querySelectorAll('.aba').forEach(x => {
            const ativa = x.dataset.aba === aba;
            x.classList.toggle('ativa', ativa);
            x.setAttribute('aria-selected', String(ativa));
        });
        // Guarda a aba na URL (sem criar entrada no histórico) — recarregar a página mantém a aba.
        const params = new URLSearchParams(window.location.search);
        if (aba === 'resumo') params.delete('aba'); else params.set('aba', aba);
        history.replaceState({}, '', `?${params.toString()}`);
        centralizarAbaAtiva(true);
        // Se a pessoa rolou pra baixo e trocou de aba, traz o topo das abas de volta pra tela.
        const wrap = tela.querySelector('.abas-wrap');
        if (wrap && wrap.getBoundingClientRect().top < 0) wrap.scrollIntoView({ block: 'start' });
        renderAba();
    }

    function reabrir() {
        if (codigoAtual) abrir(codigoAtual);
    }

    function renderAba() {
        const el = document.getElementById('conteudoAba');
        const it = item();
        const render = {
            resumo: renderResumo, vencimentos: renderVencimentos, dp: renderDp, socios: renderSocios,
            contabil: renderContabil, crm: renderCrm,
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
            ${it.alertas.length ? `<ul class="lista-alertas">${it.alertas.map(a => {
                const destino = ABA_DO_MODULO[a.modulo];
                const conteudo = `<span class="chip chip-${a.gravidade}">${esc(NOME_MODULO[a.modulo] || a.modulo)}</span><span class="alerta-msg">${esc(a.mensagem)}</span>`;
                return destino
                    ? `<li><button type="button" class="alerta-link" data-ir-aba="${destino}">${conteudo}<span class="alerta-ir">Ver ${esc((ABAS.find(([k]) => k === destino) || [])[1] || '')} ›</span></button></li>`
                    : `<li>${conteudo}</li>`;
            }).join('')}</ul>`
                : '<div class="bloqueado">✅ Nenhum alerta para esta empresa.</div>'}
          </div>`;
        el.querySelectorAll('[data-ir-aba]').forEach(b => b.addEventListener('click', () => trocarAba(b.dataset.irAba)));
    }

    // Rótulo "SET/2026" pro mês atual (offsetMeses=0) ou seguinte (offsetMeses=1), a partir de F360.hoje.
    function labelCompetencia(offsetMeses) {
        let ano = Number(F360.hoje.slice(0, 4)), mes = Number(F360.hoje.slice(5, 7)) + offsetMeses;
        while (mes > 12) { mes -= 12; ano += 1; }
        return `${ContabilDiarioUtil.MESES_LABELS[mes - 1]}/${ano}`;
    }

    function linhaDias(dataISO) {
        const d = Ficha360Regras.diasAte(dataISO, F360.hoje);
        if (d === null) return '—';
        const g = d < 0 ? 'critico' : d <= 30 ? 'atencao' : 'info';
        return `<span class="chip chip-${g}">${d < 0 ? `vencido há ${-d}d` : `${d}d`}</span>`;
    }

    function renderVencimentos(el, it) {
        const certs = it.certificados.map(c => `<tr>
            <td>${esc(c.cliente) || '—'}</td><td class="mono">${esc(c.cpf_cnpj) || '—'}</td><td>${esc(c.situacao) || '—'}</td>
            <td class="num">${F360.fmtData(c.data_vencimento)}</td><td class="t-right">${linhaDias(c.data_vencimento)}</td></tr>`).join('');
        const lics = it.licencas.slice().sort((a, b) => String(a.data_validade).localeCompare(String(b.data_validade))).map(l => `<tr>
            <td>${l.origem === 'alvara' ? 'Alvará' : 'Licença'}</td><td>${esc(l.tipo) || '—'}</td><td>${esc(l.estabelecimento) || '—'}</td>
            <td class="num">${F360.fmtData(l.data_validade)}</td><td class="t-right">${linhaDias(l.data_validade)}</td></tr>`).join('');
        el.innerHTML = `${avisoFontes('vencimentos')}
          <div class="cartao"><h3>Certificados digitais</h3>
            ${certs ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Titular</th><th>CPF/CNPJ</th><th>Situação</th><th>Vencimento</th><th class="t-right">Prazo</th></tr></thead><tbody>${certs}</tbody></table></div>`
                : '<div class="bloqueado">Nenhum certificado vinculado (vínculo por CNPJ da empresa ou CPF dos sócios).</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Licenças e alvarás</h3>
            ${lics ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Tipo</th><th>Descrição</th><th>Estabelecimento</th><th>Validade</th><th class="t-right">Prazo</th></tr></thead><tbody>${lics}</tbody></table></div>`
                : '<div class="bloqueado">Nenhuma licença ou alvará ativo.</div>'}
          </div>`;
    }

    function renderDp(el, it) {
        const ciclos = it.ciclos.slice().sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)));
        const ciclosHtml = ciclos.map(c => {
            const fases = c.fechamento_ciclo_fase || [];
            const pend = fases.filter(f => f.status !== 'concluida');
            return `<li><strong>${esc(c.competencia)}</strong> — ${c.concluido_em ? `concluída em ${F360.fmtData(c.concluido_em)}` : `${pend.length}/${fases.length} fase(s) pendente(s)${pend.length ? ': ' + esc(pend.map(f => f.nome_fase).join(', ')) : ''}`}</li>`;
        }).join('');
        const qsa = it.ocorrenciasQsa.map(o => `<li><span class="chip chip-${o.ocorrendo_agora ? 'critico' : 'atencao'}">${o.ocorrendo_agora ? 'agora' : 'histórico'}</span>
            ${esc(o.nome_socio)} × empregado ${esc(o.codigo_empregado)} (${esc(o.tipo_match)})</li>`).join('');
        const abertos = it.formularios.filter(f => !['validado', 'rejeitado', 'excluido'].includes(f.status));

        const porTipo = it.empregadosPorTipo;
        const detalheTipos = porTipo
            ? Object.entries(porTipo).filter(([, n]) => n > 0).map(([t, n]) => `${ROTULO_TIPO_EMPREGADO[t] || t} ${n}`).join(' · ') || 'nenhum ativo'
            : '';

        // Jornada Padrão + jornadas extras, com quantos empregados ativos usam cada uma
        // (cadastradas em Departamento Pessoal > Configurações > Configuração por Empresa).
        const jornadas = [];
        if (it.jornadaPadrao) jornadas.push({ nome: 'Jornada Padrão', ...it.jornadaPadrao });
        it.jornadasExtras.forEach(j => jornadas.push({
            nome: j.nome, diaria: j.jornada_diaria,
            sextaAtiva: j.jornada_sexta_ativa, sexta: j.jornada_sexta,
            sabadoSempreExtra: j.sabado_sempre_extra,
            sabadoAtiva: !j.sabado_sempre_extra && j.jornada_sabado_ativa, sabado: j.jornada_sabado,
        }));
        const jornadasHtml = jornadas.map(j => {
            const n = it.jornadaContagem ? (it.jornadaContagem[j.nome] || 0) : null;
            const partes = [`Diária ${esc(j.diaria)}`];
            if (j.sextaAtiva) partes.push(`Sexta ${esc(j.sexta)}`);
            if (j.sabadoSempreExtra) partes.push('Sábado sempre extra');
            else if (j.sabadoAtiva) partes.push(`Sábado ${esc(j.sabado)}`);
            return `<li><div><strong>${esc(j.nome)}</strong>${n != null ? ` <span class="chip chip-neutro">${n} empregado(s)</span>` : ''}
                <div class="bloqueado" style="margin-top:2px">${partes.join(' · ')}</div></div></li>`;
        }).join('');

        // Férias que tocam a competência atual e a seguinte (rh_ferias_calculadas).
        const feriasLinha = (f) => `<li>${esc(f.nome_empregado)} — ${F360.fmtData(f.ferias_inicio)} a ${F360.fmtData(f.ferias_fim)}</li>`;
        const feriasAtualHtml = (it.feriasAtual || []).map(feriasLinha).join('');
        const feriasProximaHtml = (it.feriasProxima || []).map(feriasLinha).join('');
        const subLabel = (t) => `<div class="sublabel">${esc(t)}</div>`;

        // Valores de VT/VA por empregado (Departamento Pessoal > Configurações > VA/VT).
        const valoresVaVt = it.valoresVaVt || [];
        const vaVtHtml = valoresVaVt.map(v => `<tr>
            <td>${esc(v.nome)}</td>
            <td class="num t-right">${fmtMoeda(v.vt)}</td>
            <td class="num t-right">${fmtMoeda(v.va)}</td>
        </tr>`).join('');

        el.innerHTML = `${avisoFontes('dp')}
          <div class="grade">
            <div class="cartao"><h3>Folha contratada</h3><div class="numero">${it.possuiFolha ? 'Sim' : 'Não'}</div></div>
            <div class="cartao"><h3>Empregados ativos</h3><div class="numero">${it.empregadosAtivos == null ? '—' : it.empregadosAtivos}</div><div class="bloqueado">${esc(detalheTipos)}</div></div>
            <div class="cartao"><h3>Formulários em aberto</h3><div class="numero">${abertos.length}</div></div>
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Fechamento da folha (mês passado e atual)</h3>
            ${ciclosHtml ? `<ul class="lista-alertas">${ciclosHtml}</ul>` : '<div class="bloqueado">Nenhum ciclo nas competências recentes.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Jornada de trabalho</h3>
            ${jornadasHtml ? `<ul class="lista-alertas">${jornadasHtml}</ul>` : '<div class="bloqueado">Nenhuma jornada configurada em Departamento Pessoal > Configurações.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Valores de VA/VT por empregado</h3>
            <div class="bloqueado" style="margin-bottom:8px">Configurados em Departamento Pessoal &gt; Configurações &gt; VA/VT.</div>
            ${vaVtHtml ? `<div class="tabela-wrap"><table class="tabela">
                <thead><tr><th>Nome</th><th class="t-right">VT</th><th class="t-right">VA</th></tr></thead>
                <tbody>${vaVtHtml}</tbody></table></div>`
                : '<div class="bloqueado">Nenhum empregado elegível para VA/VT nesta empresa.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Férias</h3>
            ${subLabel(labelCompetencia(0))}
            ${feriasAtualHtml ? `<ul class="lista-alertas">${feriasAtualHtml}</ul>` : '<div class="bloqueado">Ninguém de férias nesta competência.</div>'}
            <div style="margin-top:12px">${subLabel(labelCompetencia(1))}</div>
            ${feriasProximaHtml ? `<ul class="lista-alertas">${feriasProximaHtml}</ul>` : '<div class="bloqueado">Ninguém de férias na próxima competência.</div>'}
          </div>
          <div class="cartao" style="margin-top:12px"><h3>Análise do QSA</h3>
            ${qsa ? `<ul class="lista-alertas">${qsa}</ul>` : '<div class="bloqueado">Nenhuma sobreposição entre sócio e empregado.</div>'}
          </div>`;
    }

    function fmtMoeda(v) {
        return v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function fmtPercentual(v) {
        return v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
    }

    function renderSocios(el, it) {
        const lista = it.socios.slice().sort((a, b) => (a.nome_socio || '').localeCompare(b.nome_socio || '', 'pt-BR'));
        const linhas = lista.map(s => {
            const ativo = !s.data_saida;
            return `<tr>
                <td>${esc(s.nome_socio)}</td>
                <td class="mono">${esc(s.cpf) || '—'}</td>
                <td>${esc(s.cargo) || '—'}</td>
                <td class="num t-right">${fmtPercentual(s.participacao)}</td>
                <td class="num t-right">${fmtMoeda(s.capital_social)}</td>
                <td class="num">${F360.fmtData(s.data_entrada)}</td>
                <td class="num">${s.data_saida ? F360.fmtData(s.data_saida) : '—'}</td>
                <td><span class="chip chip-${ativo ? 'ok' : 'neutro'}">${ativo ? 'Ativo' : 'Saiu'}</span></td>
            </tr>`;
        }).join('');

        el.innerHTML = `${avisoFontes('socios')}
          <div class="cartao">
            <h3>Quadro societário (${lista.length})</h3>
            ${linhas ? `<div class="tabela-wrap"><table class="tabela">
                <thead><tr><th>Nome</th><th>CPF</th><th>Cargo</th><th class="t-right">Participação</th><th class="t-right">Capital social</th><th>Entrada</th><th>Saída</th><th>Situação</th></tr></thead>
                <tbody>${linhas}</tbody></table></div>`
                : '<div class="bloqueado">Nenhum sócio importado.</div>'}
          </div>`;
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
