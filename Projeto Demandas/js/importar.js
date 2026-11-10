// Projeto Demandas/js/importar.js — Importação da planilha em duas etapas (pré-visualização + confirmação).
// O arquivo é lido no navegador (SheetJS); nada é enviado a serviços externos.
// Só os dados já validados vão ao banco, numa única chamada transacional: rpc demandas_importar().
DEM.importar = {
    TAM_MAX: 10 * 1024 * 1024,
    est: null,      // estado da importação em andamento

    render() {
        DEM.importar.est = null;
        DEM.$('tela-importar').innerHTML = `
            <div class="cabecalho"><div><h2>Importar planilha</h2>
                <p class="sub">Envie o Controle de Demandas (.xlsx) com as abas <strong>Demandas</strong> e <strong>Tratativas</strong>.
                Reimportar o mesmo arquivo não duplica nada.</p></div></div>
            <div class="dropzone" id="imDrop" tabindex="0" role="button" aria-label="Escolher ou arrastar a planilha .xlsx">
                <div style="font-size:36px" aria-hidden="true">📥</div>
                <p><strong>Arraste o .xlsx aqui</strong> ou clique para escolher</p>
                <input type="file" id="imArq" accept=".xlsx,.xlsm" hidden>
            </div>
            <div id="imPrevia"></div>`;
        const drop = DEM.$('imDrop'), inp = DEM.$('imArq');
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
        inp.addEventListener('change', () => inp.files[0] && DEM.importar.ler(inp.files[0]));
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('sobre'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('sobre'));
        drop.addEventListener('drop', (e) => {
            e.preventDefault(); drop.classList.remove('sobre');
            if (e.dataTransfer.files[0]) DEM.importar.ler(e.dataTransfer.files[0]);
        });
    },

    aviso(html, tipo = 'erro') { DEM.$('imPrevia').innerHTML = `<div class="aviso aviso-${tipo}">${html}</div>`; },

    async ler(arquivo) {
        const I = DEM.importar, esc = DEM.esc;
        if (!/\.xlsx?m?$/i.test(arquivo.name)) return I.aviso('Formato não suportado. Envie um arquivo .xlsx.');
        if (arquivo.size > I.TAM_MAX) return I.aviso('Arquivo maior que 10 MB.');
        I.aviso('Lendo a planilha…', 'atencao');
        try {
            const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });   // sem cellDates: datas chegam como serial e o parser converte
            const achar = (nome) => wb.SheetNames.find(n => DEM.parser.norm(n) === nome);
            const abaD = achar('demandas'), abaT = achar('tratativas');
            if (!abaD) return I.aviso(`A planilha não tem a aba <strong>Demandas</strong>. Abas encontradas: ${wb.SheetNames.map(esc).join(', ') || 'nenhuma'}.`);
            const aoa = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false });
            const pd = DEM.parser.parseDemandas(aoa(abaD));
            if (pd.bloqueio) return I.aviso(esc(pd.bloqueio));
            const pt = abaT ? DEM.parser.parseTratativas(aoa(abaT)) : { tratativas: [], erros: [], avisos: ['A planilha não tem a aba "Tratativas": serão importadas só as demandas.'], bloqueio: null };
            if (pt.bloqueio) pd.avisos.push(pt.bloqueio + ' As tratativas serão ignoradas.');

            I.aviso('Comparando com o que já está no Portal…', 'atencao');
            await DEM.carregar();                                  // garante base atualizada
            const existentes = new Map(DEM.demandas.map(d => [d.gmail_thread_id, d]));
            const chaves = await I.chavesTratativas(pd.demandas, existentes);

            const dataNome = (arquivo.name.match(/(\d{4}-\d{2}-\d{2})/) || [])[1];
            I.est = {
                arquivo: arquivo.name, pd, pt, existentes, chaves, sobrescrever: {},
                dataLeitura: dataNome || DEM.hojeISO(),
            };
            I.previa();
        } catch (e) {
            I.aviso('Não foi possível ler o arquivo: ' + esc(e.message || e));
        }
    },

    /** Mapa thread_id -> Set(chaves) das tratativas que já existem no banco para as demandas da planilha. */
    async chavesTratativas(demandas, existentes) {
        const idPorThread = new Map(), mapa = new Map();
        for (const d of demandas) { const ex = existentes.get(d.gmail_thread_id); if (ex) idPorThread.set(ex.id, d.gmail_thread_id); }
        const ids = [...idPorThread.keys()];
        for (let i = 0; i < ids.length; i += 100) {
            const parte = ids.slice(i, i + 100);
            const linhas = await DEM.buscarTudo(() => DEM.sb.from('tratativas').select('id, demanda_id, ocorrida_em, descricao').in('demanda_id', parte).order('id'));
            for (const t of linhas) {
                const th = idPorThread.get(t.demanda_id);
                if (!mapa.has(th)) mapa.set(th, new Set());
                mapa.get(th).add(DEM.parser.chaveTratativa(t.ocorrida_em, t.descricao));
            }
        }
        return mapa;
    },

    calcular() {
        const e = DEM.importar.est;
        e.cls = DEM.diff.classificarDemandas(e.pd.demandas, e.existentes, e.sobrescrever);
        const threads = new Set([...e.pd.demandas.map(d => d.gmail_thread_id)]);
        e.tr = DEM.diff.tratativasNovas(e.pt.tratativas, e.chaves, threads);
    },

    previa() {
        const I = DEM.importar, e = I.est, esc = DEM.esc;
        I.calcular();
        const { cls, tr, pd, pt } = e;
        const erros = [...pd.erros.map(x => ({ ...x, aba: 'Demandas' })), ...pt.erros.map(x => ({ ...x, aba: 'Tratativas' }))];
        const avisos = [...pd.avisos, ...pt.avisos];
        const nada = !cls.novas.length && !cls.atualizadas.length && !tr.novas.length;
        const podeConfirmar = pd.demandas.length > 0;

        const confl = cls.conflitos.length ? `
            <details open><summary>⚠️ ${cls.conflitos.length} conflito(s) com edição manual — escolha manter ou sobrescrever</summary>
                <p class="sub">Estes campos foram alterados à mão no Portal e a planilha traz outro valor. Por padrão, o valor do Portal é mantido.</p>
                <div class="acoes" style="margin-bottom:8px"><button class="btn sec" data-em-massa="manter">Manter todos</button><button class="btn sec" data-em-massa="sobrescrever">Sobrescrever todos</button></div>
                <div class="tabela-wrap"><table><thead><tr><th>Cliente / demanda</th><th>Campo</th><th>No Portal (atual)</th><th>Na planilha</th><th>Ação</th></tr></thead><tbody>
                ${cls.conflitos.map((c, i) => {
                    const sob = (e.sobrescrever[c.id] || []).includes(c.campo);
                    const f = (v) => v == null || v === '' ? '—' : c.campo === 'prazo' ? DEM.fData(v) : esc(v);
                    return `<tr><td>${esc(c.cliente)}<br><span class="sub">${esc((c.demanda || '').slice(0, 70))}</span></td><td>${esc(c.rotulo)}</td><td>${f(c.atual)}</td><td>${f(c.planilha)}</td>
                        <td><label><input type="radio" name="cf${i}" data-id="${esc(c.id)}" data-campo="${c.campo}" value="manter" ${sob ? '' : 'checked'}> Manter</label>
                            <label style="margin-left:10px"><input type="radio" name="cf${i}" data-id="${esc(c.id)}" data-campo="${c.campo}" value="sobrescrever" ${sob ? 'checked' : ''}> Sobrescrever</label></td></tr>`;
                }).join('')}</tbody></table></div></details>` : '';

        const detErros = erros.length ? `
            <details><summary>❌ ${erros.length} erro(s) em linhas (essas linhas não serão importadas)</summary>
                <div class="tabela-wrap"><table><thead><tr><th>Aba</th><th>Linha</th><th>ID da conversa</th><th>Problema</th></tr></thead><tbody>
                ${erros.map(x => `<tr><td>${x.aba}</td><td class="num">${x.linha}</td><td class="mono">${esc(x.id || '—')}</td><td>${esc(x.mensagem)}</td></tr>`).join('')}</tbody></table></div></details>` : '';

        DEM.$('imPrevia').innerHTML = `
            <h3 style="margin-top:20px">Pré-visualização — ${esc(e.arquivo)}</h3>
            ${avisos.map(a => `<div class="aviso aviso-atencao">${esc(a)}</div>`).join('')}
            <div class="res-grid">
                <div><strong class="num">${cls.novas.length}</strong>demanda(s) nova(s)</div>
                <div><strong class="num">${cls.atualizadas.length}</strong>atualizada(s)</div>
                <div><strong class="num">${cls.inalteradas.length}</strong>inalterada(s)</div>
                <div><strong class="num">${tr.novas.length}</strong>tratativa(s) nova(s)</div>
                <div><strong class="num">${cls.conflitos.length}</strong>conflito(s)</div>
                <div><strong class="num">${erros.length}</strong>erro(s) de linha</div>
            </div>
            ${tr.semDemanda.length ? `<div class="aviso aviso-atencao">${tr.semDemanda.length} tratativa(s) referem conversas que não estão na aba Demandas e serão ignoradas.</div>` : ''}
            ${confl}${detErros}
            ${cls.novas.length ? `<details><summary>🆕 Demandas novas (${cls.novas.length})</summary><div class="tabela-wrap"><table><tbody>
                ${cls.novas.slice(0, 100).map(d => `<tr><td>${esc(d.cliente)}</td><td>${esc((d.demanda_inicial || '').slice(0, 90))}</td><td>${DEM.badgeStatus(d.status)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
            <div class="acoes" style="margin-top:14px">
                <label class="sub">Data da leitura <input type="date" id="imData" value="${esc(e.dataLeitura)}" style="width:auto"></label>
                <button class="btn" id="imConfirmar" ${podeConfirmar ? '' : 'disabled'}>Confirmar importação</button>
                <button class="btn sec" id="imCancelar">Cancelar</button>
            </div>
            ${nada && podeConfirmar ? '<p class="sub">Nada de novo neste arquivo: confirmar apenas registra a leitura no histórico.</p>' : ''}
            ${podeConfirmar ? '' : '<p class="sub">Nenhuma linha válida para importar.</p>'}`;

        DEM.$('imPrevia').querySelectorAll('input[type=radio]').forEach(r => r.addEventListener('change', () => {
            const lista = new Set(e.sobrescrever[r.dataset.id] || []);
            r.value === 'sobrescrever' ? lista.add(r.dataset.campo) : lista.delete(r.dataset.campo);
            if (lista.size) e.sobrescrever[r.dataset.id] = [...lista]; else delete e.sobrescrever[r.dataset.id];
            I.previa();
        }));
        DEM.$('imPrevia').querySelectorAll('[data-em-massa]').forEach(b => b.addEventListener('click', () => {
            e.sobrescrever = {};
            if (b.dataset.emMassa === 'sobrescrever') for (const c of cls.conflitos) (e.sobrescrever[c.id] = e.sobrescrever[c.id] || []).push(c.campo);
            I.previa();
        }));
        DEM.$('imData').addEventListener('change', (ev) => { e.dataLeitura = ev.target.value; });
        DEM.$('imCancelar').addEventListener('click', () => DEM.importar.render());
        DEM.$('imConfirmar').addEventListener('click', () => I.confirmar());
    },

    async confirmar() {
        const I = DEM.importar, e = I.est, esc = DEM.esc;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.dataLeitura || '')) { DEM.toast('Informe a data da leitura.', 'erro'); return; }
        const btn = DEM.$('imConfirmar'); btn.disabled = true; btn.textContent = 'Importando…';
        const limpa = (o) => { const { _linha, _mudancas, ...r } = o; return r; };
        const erros = e.pd.erros.length + e.pt.erros.length;
        const { data, error } = await DEM.sb.rpc('demandas_importar', {
            p_arquivo: e.arquivo, p_data_leitura: e.dataLeitura,
            p_demandas: e.pd.demandas.map(limpa), p_tratativas: e.pt.tratativas.map(limpa),
            p_sobrescrever: e.sobrescrever, p_linhas_com_erro: erros,
        });
        if (error) {
            btn.disabled = false; btn.textContent = 'Confirmar importação';
            DEM.$('imPrevia').insertAdjacentHTML('afterbegin', `<div class="aviso aviso-erro">A importação falhou e <strong>nada foi gravado</strong> (tudo ou nada): ${esc(error.message)}</div>`);
            return;
        }
        await DEM.carregar();
        DEM.$('imPrevia').innerHTML = `
            <div class="aviso aviso-ok"><strong>Importação concluída.</strong></div>
            <div class="res-grid">
                <div><strong class="num">${data.novas}</strong>nova(s)</div><div><strong class="num">${data.atualizadas}</strong>atualizada(s)</div>
                <div><strong class="num">${data.inalteradas}</strong>inalterada(s)</div><div><strong class="num">${data.tratativas_novas}</strong>tratativa(s) nova(s)</div>
            </div>
            <div class="acoes"><button class="btn" id="imPainel">Ver painel</button><button class="btn sec" id="imOutra">Importar outro arquivo</button></div>`;
        DEM.$('imPainel').addEventListener('click', () => DEM.ir('painel'));
        DEM.$('imOutra').addEventListener('click', () => DEM.importar.render());
    },
};
