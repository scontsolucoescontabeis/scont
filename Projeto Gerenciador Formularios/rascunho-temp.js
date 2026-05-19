/**
 * rascunho-temp.js
 * Auto-salva rascunho de formulário para usuários não autenticados.
 * Usa um token UUID único na URL (?token=...) como chave na tabela
 * formulario_rascunho_temp. O registro é deletado ao enviar o formulário.
 */
(function () {
    const TABLE = 'formulario_rascunho_temp';

    function getOrCreateToken() {
        const params = new URLSearchParams(location.search);
        let token = params.get('token');
        if (!token) {
            token = (crypto.randomUUID
                ? crypto.randomUUID()
                : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                }));
            const url = new URL(location.href);
            url.searchParams.set('token', token);
            history.replaceState(null, '', url.toString());
        }
        return token;
    }

    function serializeForm(form) {
        const data = {};
        for (const el of form.elements) {
            if (!el.name || el.type === 'file' || el.type === 'submit' || el.type === 'button') continue;
            if (el.type === 'radio' || el.type === 'checkbox') {
                if (el.checked) data[el.name] = el.value;
            } else {
                data[el.name] = el.value;
            }
        }
        return data;
    }

    function restoreForm(form, data) {
        for (const [name, value] of Object.entries(data)) {
            if (name.startsWith('__')) continue;
            const els = form.elements[name];
            if (!els) continue;
            // RadioNodeList (radio/checkbox groups)
            if (els.length !== undefined && typeof els.item === 'function') {
                Array.from(els).forEach(el => {
                    if (el.type === 'radio' || el.type === 'checkbox') {
                        el.checked = el.value === value;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            } else {
                const el = els;
                if (el.type === 'file') continue;
                if (el.type === 'radio' || el.type === 'checkbox') {
                    el.checked = el.value === value;
                } else {
                    el.value = value;
                }
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    window.RascunhoTemp = {
        _token: null,
        _timer: null,
        _form: null,
        _tipo: null,
        _sb: null,
        _customSerialize: null,
        _customRestore: null,

        /**
         * @param {HTMLFormElement} form
         * @param {string} tipoFormulario  'alteracao' | 'registro' | 'empregado'
         * @param {object} opts
         * @param {object}   opts.client          cliente Supabase já inicializado pelo formulário (obrigatório)
         * @param {function} [opts.customSerialize]   retorna objeto com campos extras
         * @param {function} [opts.onBeforeRestore]   async, chamado com dados salvos antes de restaurar campos
         * @param {function} [opts.customRestore]     async, chamado com dados salvos após restaurar campos nomeados
         */
        async init(form, tipoFormulario, opts) {
            opts = opts || {};
            this._form = form;
            this._tipo = tipoFormulario;
            this._sb = opts.client || null;
            this._customSerialize = opts.customSerialize || null;
            this._customRestore = opts.customRestore || null;
            this._token = getOrCreateToken();

            if (!this._sb) {
                console.warn('⚠️ RascunhoTemp: opts.client não informado — rascunho desativado.');
                return;
            }

            try {
                const { data: row } = await this._sb
                    .from(TABLE)
                    .select('dados')
                    .eq('token', this._token)
                    .maybeSingle();

                if (row && row.dados && Object.keys(row.dados).length > 0) {
                    if (opts.onBeforeRestore) await opts.onBeforeRestore(row.dados);
                    restoreForm(form, row.dados);
                    if (this._customRestore) await this._customRestore(row.dados);
                    console.log('✅ Rascunho restaurado do servidor (token:', this._token, ')');
                    this._showBanner();
                }
            } catch (e) {
                console.warn('⚠️ Não foi possível carregar rascunho:', e.message);
            }

            const self = this;
            form.addEventListener('input', function () { self.scheduleAutoSave(); });
            form.addEventListener('change', function () { self.scheduleAutoSave(); });
        },

        scheduleAutoSave() {
            const self = this;
            clearTimeout(this._timer);
            this._timer = setTimeout(function () { self.save(); }, 2000);
        },

        async save() {
            if (!this._token || !this._form || !this._sb) return;
            try {
                const dados = serializeForm(this._form);
                if (this._customSerialize) Object.assign(dados, this._customSerialize());
                await this._sb.from(TABLE).upsert({
                    token: this._token,
                    tipo_formulario: this._tipo,
                    dados: dados,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'token' });
            } catch (e) {
                console.warn('⚠️ Falha ao salvar rascunho:', e.message);
            }
        },

        async deleteOnSubmit() {
            if (!this._token || !this._sb) return;
            try {
                await this._sb.from(TABLE).delete().eq('token', this._token);
                console.log('🗑️ Rascunho deletado após envio');
            } catch (e) {
                console.warn('⚠️ Falha ao deletar rascunho:', e.message);
            }
        },

        getToken() { return this._token; },

        getShareURL() {
            const url = new URL(location.href);
            url.searchParams.set('token', this._token);
            return url.toString();
        },

        _showBanner() {
            if (document.getElementById('rascunho-banner')) return;
            const banner = document.createElement('div');
            banner.id = 'rascunho-banner';
            banner.style.cssText = [
                'position:fixed', 'bottom:20px', 'right:20px', 'z-index:9999',
                'background:#1a7f4b', 'color:#fff', 'padding:10px 16px',
                'border-radius:8px', 'font-size:13px', 'font-family:sans-serif',
                'box-shadow:0 4px 12px rgba(0,0,0,0.2)', 'max-width:280px',
                'line-height:1.4'
            ].join(';');
            banner.innerHTML = '✅ <strong>Rascunho carregado!</strong><br>Suas respostas anteriores foram restauradas.';
            document.body.appendChild(banner);
            setTimeout(function () { banner.remove(); }, 4000);
        }
    };
})();
