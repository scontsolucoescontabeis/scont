// Projeto PDI/js/ui.js — helpers de interface (escape, toast, modal, formulário)
window.PdiUI = (function () {
    'use strict';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    const br = (v) => esc(v).replace(/\n/g, '<br>');

    function hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function toast(msg, tipo) {
        let box = document.getElementById('toasts');
        if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
        const t = document.createElement('div');
        t.className = `toast ${tipo || ''}`;
        t.setAttribute('role', 'status');
        t.textContent = msg;
        box.appendChild(t);
        setTimeout(() => t.remove(), tipo === 'erro' ? 7000 : 3500);
    }

    /**
     * Modal com formulário.
     * campos: [{ nome, rotulo, tipo: text|textarea|date|number|select|checkbox, opcoes:[[valor,rotulo]], obrigatorio, valor }]
     * Retorna Promise<objeto|null>.
     */
    function formulario(titulo, campos, opts) {
        opts = opts || {};
        return new Promise((resolve) => {
            const ov = document.createElement('div');
            ov.className = 'modal-ov';
            const html = campos.map(c => {
                const id = `f_${c.nome}`;
                const req = c.obrigatorio ? ' required' : '';
                const val = c.valor == null ? '' : c.valor;
                let ctl;
                if (c.tipo === 'textarea') ctl = `<textarea id="${id}" name="${c.nome}" rows="${c.linhas || 4}"${req}>${esc(val)}</textarea>`;
                else if (c.tipo === 'select') {
                    ctl = `<select id="${id}" name="${c.nome}"${req}>` +
                        (c.vazio === false ? '' : '<option value="">— selecione —</option>') +
                        (c.opcoes || []).map(o => `<option value="${esc(o[0])}"${String(o[0]) === String(val) ? ' selected' : ''}>${esc(o[1])}</option>`).join('') + '</select>';
                } else if (c.tipo === 'checkbox') ctl = `<input type="checkbox" id="${id}" name="${c.nome}"${val ? ' checked' : ''}>`;
                else ctl = `<input type="${c.tipo || 'text'}" id="${id}" name="${c.nome}" value="${esc(val)}"${req}${c.min != null ? ` min="${c.min}"` : ''}${c.max != null ? ` max="${c.max}"` : ''}${c.step ? ` step="${c.step}"` : ''}>`;
                const dica = c.dica ? `<small>${esc(c.dica)}</small>` : '';
                return c.tipo === 'checkbox'
                    ? `<label class="chk" for="${id}">${ctl} ${esc(c.rotulo)}</label>${dica}`
                    : `<label for="${id}">${esc(c.rotulo)}${c.obrigatorio ? ' *' : ''}</label>${ctl}${dica}`;
            }).join('');
            ov.innerHTML = `<form class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
                <h3>${esc(titulo)}</h3>${opts.texto ? `<p class="muted">${esc(opts.texto)}</p>` : ''}
                <div class="modal-corpo">${html}</div>
                <div class="modal-acoes">
                    <button type="button" class="btn sec" data-x="cancelar">Cancelar</button>
                    <button type="submit" class="btn">${esc(opts.confirmar || 'Salvar')}</button>
                </div></form>`;
            document.body.appendChild(ov);
            const form = ov.querySelector('form');
            const fechar = (v) => { ov.remove(); resolve(v); };
            ov.addEventListener('mousedown', (e) => { if (e.target === ov) fechar(null); });
            form.querySelector('[data-x="cancelar"]').onclick = () => fechar(null);
            form.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(null); });
            form.onsubmit = (e) => {
                e.preventDefault();
                const out = {};
                campos.forEach(c => {
                    const el = form.elements[c.nome];
                    if (c.tipo === 'checkbox') out[c.nome] = el.checked;
                    else if (c.tipo === 'number') out[c.nome] = el.value === '' ? null : Number(el.value);
                    else out[c.nome] = el.value === '' ? null : el.value;
                });
                fechar(out);
            };
            const primeiro = form.querySelector('input,textarea,select');
            if (primeiro) primeiro.focus();
        });
    }

    function confirmar(titulo, texto, rotulo) {
        return new Promise((resolve) => {
            const ov = document.createElement('div');
            ov.className = 'modal-ov';
            ov.innerHTML = `<div class="modal" role="alertdialog" aria-modal="true"><h3>${esc(titulo)}</h3>
                <p>${esc(texto)}</p><div class="modal-acoes">
                <button class="btn sec" data-r="0">Cancelar</button><button class="btn" data-r="1">${esc(rotulo || 'Confirmar')}</button></div></div>`;
            document.body.appendChild(ov);
            ov.querySelectorAll('button').forEach(b => b.onclick = () => { ov.remove(); resolve(b.dataset.r === '1'); });
        });
    }

    function badge(texto, cor) { return `<span class="badge ${cor || ''}">${esc(texto)}</span>`; }

    return { esc, br, hojeISO, toast, formulario, confirmar, badge };
})();
