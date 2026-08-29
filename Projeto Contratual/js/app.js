/**
 * Orquestração + UI da ferramenta "Controle de Alterações Contratuais".
 * Sem lógica de parsing (delegada a extract/parser/matcher/differ/report).
 */
(function () {
    'use strict';

    const $ = sel => document.querySelector(sel);
    const { ContratoExtract, ContratoParser, ContratoMatcher, ContratoReport, Differ } = window;

    const estado = {
        ant: null,   // { file, texto, analise }
        nova: null,
        linhas: [],
        capa: null,
    };

    // ─── alertas ────────────────────────────────────────────────────
    function limparAlertas() { $('#alertas').innerHTML = ''; }
    function alerta(tipo, msg) {
        const div = document.createElement('div');
        div.className = 'alerta alerta-' + tipo;
        div.innerHTML = msg;
        $('#alertas').appendChild(div);
    }

    // ─── dropzones ──────────────────────────────────────────────────
    function ligarDropzone(el, chave) {
        const input = el.querySelector('input[type=file]');
        const arqEl = el.querySelector('.arq');

        input.addEventListener('change', () => {
            if (input.files[0]) receber(input.files[0]);
        });
        el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag'); });
        el.addEventListener('dragleave', () => el.classList.remove('drag'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.classList.remove('drag');
            if (e.dataTransfer.files[0]) receber(e.dataTransfer.files[0]);
        });

        function receber(file) {
            estado[chave] = { file, texto: null, analise: null };
            arqEl.textContent = file.name;
            el.classList.add('tem');
            atualizarBotaoComparar();
        }
    }

    function atualizarBotaoComparar() {
        $('#btnComparar').disabled = !(estado.ant && estado.nova);
    }

    // ─── comparar ───────────────────────────────────────────────────
    async function comparar() {
        limparAlertas();
        $('#btnComparar').disabled = true;
        const status = $('#statusExtracao');

        try {
            for (const chave of ['ant', 'nova']) {
                const slot = estado[chave];
                if (slot.analise) continue;
                status.textContent = `Lendo ${slot.file.name}…`;
                const { texto } = await ContratoExtract.extrairTexto(slot.file);
                slot.texto = texto;
                slot.analise = ContratoParser.analisarContrato(texto);
            }
            status.textContent = '';

            avisosDeAnalise();
            const { linhas, resumo } = ContratoMatcher.comparar(
                estado.ant.analise.clausulas,
                estado.nova.analise.clausulas
            );
            estado.linhas = linhas.map(l => ({ ...l, classificacaoUsuario: l.classificacao, observacao: '' }));
            estado.capa = { ...estado.nova.analise.capa };

            preencherCapa();
            renderResumo(resumo);
            renderRevisao();
            sugerirInversao();

            $('#painelCapa').classList.remove('oculto');
            $('#painelRevisao').classList.remove('oculto');
            $('#painelRevisao').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            console.error(err);
            status.textContent = '';
            if (err instanceof ContratoExtract.ErroSemTextoSelecionavel) {
                alerta('danger', '❌ ' + err.message);
            } else {
                alerta('danger', '❌ Não consegui processar os arquivos: ' + (err.message || err));
            }
        } finally {
            $('#btnComparar').disabled = false;
        }
    }

    function avisosDeAnalise() {
        const a = estado.ant.analise, b = estado.nova.analise;
        if (a.avisos.includes('layout') || b.avisos.includes('layout')) {
            alerta('warning', '⚠️ Não reconheci o bloco "CONSOLIDAÇÃO CONTRATUAL" em pelo menos um dos ' +
                'arquivos. Comparei o texto integral — confira as cláusulas abaixo com atenção.');
        }
        const cA = a.capa.cnpj, cB = b.capa.cnpj;
        if (cA && cB && cA !== cB) {
            alerta('warning', `⚠️ Os CNPJs não batem: <strong>${cA}</strong> (anterior) × ` +
                `<strong>${cB}</strong> (nova). Verifique se os dois arquivos são da mesma empresa.`);
        }
    }

    function sugerirInversao() {
        const nA = estado.ant.analise.capa.numeroAlteracao;
        const nB = estado.nova.analise.capa.numeroAlteracao;
        const btn = $('#btnInverter');
        if (nA != null && nB != null && nA > nB) {
            alerta('info', `ℹ️ A "versão anterior" é a <strong>${nA}ª</strong> alteração e a "nova" é a ` +
                `<strong>${nB}ª</strong>. Parece invertido.`);
            btn.classList.remove('oculto');
        } else {
            btn.classList.add('oculto');
        }
    }

    function inverter() {
        const t = estado.ant; estado.ant = estado.nova; estado.nova = t;
        for (const [chave, el] of [['ant', '#dzAnt'], ['nova', '#dzNova']]) {
            const dz = $(el);
            dz.querySelector('.arq').textContent = estado[chave].file.name;
            dz.classList.add('tem');
        }
        comparar();
    }

    // ─── capa ───────────────────────────────────────────────────────
    function preencherCapa() {
        const c = estado.capa;
        $('#cRazao').value = c.razaoSocial || '';
        $('#cFantasia').value = c.nomeFantasia || '';
        $('#cCnpj').value = c.cnpj || '';
        $('#cNumero').value = c.numeroAlteracao != null ? c.numeroAlteracao : '';
        $('#cData').value = c.dataAto || '';
        $('#cSocios').value = (c.socios || [])
            .map(s => s.cpf ? `${s.nome} — CPF ${s.cpf}` : s.nome).join('\n');
    }

    function lerCapa() {
        const socios = $('#cSocios').value.split('\n').map(l => l.trim()).filter(Boolean)
            .map(l => {
                const m = l.match(/^(.*?)\s*[—-]\s*CPF\s*(.+)$/i);
                return m ? { nome: m[1].trim(), cpf: m[2].trim() } : { nome: l, cpf: '' };
            });
        const num = parseInt($('#cNumero').value, 10);
        return {
            razaoSocial: $('#cRazao').value.trim(),
            nomeFantasia: $('#cFantasia').value.trim(),
            cnpj: $('#cCnpj').value.trim(),
            numeroAlteracao: isNaN(num) ? null : num,
            dataAto: $('#cData').value.trim(),
            socios,
        };
    }

    // ─── resumo ─────────────────────────────────────────────────────
    function renderResumo(resumo) {
        $('#resumoChips').innerHTML =
            `<span class="chip chip-alterada">${resumo.alteradas} alterada(s)</span>` +
            `<span class="chip chip-nova">${resumo.novas} nova(s)</span>` +
            `<span class="chip chip-suprimida">${resumo.suprimidas} suprimida(s)</span>` +
            `<span class="chip chip-igual">${resumo.iguais} sem alteração</span>`;
    }

    // ─── tabela de revisão ─────────────────────────────────────────
    const CLASSES = ['alterada', 'nova', 'suprimida', 'igual', 'ignorar'];

    function ladoHtml(linha, lado) {
        const segs = Differ.diffPalavras(linha.corpoAnt || '', linha.corpoNova || '');
        if (lado === 'ant' && linha.classificacaoUsuario === 'nova') return '<span class="vazio">—</span>';
        if (lado === 'nova' && linha.classificacaoUsuario === 'suprimida') return '<span class="vazio">—</span>';
        const filtrados = Differ.segmentosParaLado(segs, lado);
        if (!filtrados.length) return '<span class="vazio">—</span>';
        return filtrados.map(s => {
            const t = ContratoReport.escapeHtml(s.texto);
            if (s.tipo === 'add') return `<ins>${t}</ins>`;
            if (s.tipo === 'del') return `<del>${t}</del>`;
            return t;
        }).join('');
    }

    function renderRevisao() {
        const body = $('#revisaoBody');
        const iguaisBody = $('#iguaisBody');
        body.innerHTML = '';
        iguaisBody.innerHTML = '';
        let nIguais = 0;

        estado.linhas.forEach((linha, idx) => {
            const tr = document.createElement('tr');
            const cls = linha.classificacaoUsuario;
            if (cls === 'ignorar') tr.className = 'linha-ignorada';
            if (cls === 'igual') tr.className = 'linha-igual';

            const opts = CLASSES.map(c =>
                `<option value="${c}"${c === cls ? ' selected' : ''}>${rotulo(c)}</option>`).join('');

            tr.innerHTML = `
                <td class="col-clausula">${ContratoReport.escapeHtml(linha.titulo)}</td>
                <td class="col-class"><select data-idx="${idx}">${opts}</select></td>
                <td class="col-red">${ladoHtml(linha, 'ant')}</td>
                <td class="col-red">${ladoHtml(linha, 'nova')}</td>`;

            const tdNova = tr.children[3];
            const obs = document.createElement('input');
            obs.className = 'obs-input';
            obs.placeholder = 'observação (opcional, sai no PDF)';
            obs.value = linha.observacao || '';
            obs.addEventListener('input', () => { linha.observacao = obs.value; });
            tdNova.appendChild(obs);

            if (cls === 'igual') { iguaisBody.appendChild(tr); nIguais++; }
            else body.appendChild(tr);
        });

        body.querySelectorAll('select').forEach(sel => {
            sel.addEventListener('change', () => {
                estado.linhas[+sel.dataset.idx].classificacaoUsuario = sel.value;
                renderRevisao();
            });
        });

        const acc = $('#accIguais');
        if (nIguais) {
            acc.classList.remove('oculto');
            acc.querySelector('summary').textContent = `${nIguais} cláusula(s) sem alteração`;
        } else {
            acc.classList.add('oculto');
        }
    }

    function rotulo(c) {
        return { alterada: 'Alterada', nova: 'Nova', suprimida: 'Suprimida',
                 igual: 'Sem alteração', ignorar: 'Ignorar' }[c] || c;
    }

    // ─── gerar PDF ─────────────────────────────────────────────────
    function gerar() {
        const capa = lerCapa();
        const linhas = estado.linhas
            .filter(l => ['alterada', 'nova', 'suprimida'].includes(l.classificacaoUsuario))
            .map(l => ({
                titulo: l.titulo,
                classificacao: l.classificacaoUsuario,
                corpoAnt: l.corpoAnt,
                corpoNova: l.corpoNova,
                observacao: l.observacao,
            }));

        if (!linhas.length && !confirm(
            'Nenhuma cláusula marcada como alterada, nova ou suprimida. Gerar mesmo assim?')) return;

        const html = ContratoReport.montarRelatorio({
            capa, linhas, dataEmissao: hoje(),
        });
        $('#printRoot').innerHTML = html;
        setTimeout(() => window.print(), 60);
    }

    function hoje() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    // ─── reset ─────────────────────────────────────────────────────
    function reset() {
        estado.ant = estado.nova = null;
        estado.linhas = [];
        estado.capa = null;
        ['#dzAnt', '#dzNova'].forEach(s => {
            const dz = $(s);
            dz.classList.remove('tem');
            dz.querySelector('.arq').textContent = '';
            dz.querySelector('input').value = '';
        });
        $('#painelCapa').classList.add('oculto');
        $('#painelRevisao').classList.add('oculto');
        $('#btnInverter').classList.add('oculto');
        limparAlertas();
        atualizarBotaoComparar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ─── init ──────────────────────────────────────────────────────
    ligarDropzone($('#dzAnt'), 'ant');
    ligarDropzone($('#dzNova'), 'nova');
    $('#btnComparar').addEventListener('click', comparar);
    $('#btnInverter').addEventListener('click', inverter);
    $('#btnGerar').addEventListener('click', gerar);
    $('#btnReset').addEventListener('click', reset);
})();
