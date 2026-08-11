(function () {
    'use strict';

    const TIPOS = [
        { tipo: 'registro',  label: 'Registro de Empresas' },
        { tipo: 'alteracao', label: 'Alteração de Empresas' },
        { tipo: 'empregado', label: 'Admissão de Empregados' },
    ];

    let supabaseClient;
    let configPorTipo = {};

    document.addEventListener('DOMContentLoaded', iniciar);

    async function iniciar() {
        const auth = await window.PortalAuthGuard.init(1);
        if (!auth) return;

        if (!auth.isAdmin) {
            window.location.href = 'index.html';
            return;
        }

        document.getElementById('portalAuthOverlay')?.remove();

        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        await carregarConfig();
        renderLinhas();
    }

    async function carregarConfig() {
        const { data, error } = await supabaseClient
            .from('formularios_config_email')
            .select('tipo_formulario, email');

        if (error) {
            console.error(error);
            mostrarToast('Erro ao carregar as configurações.', 'erro');
            return;
        }

        configPorTipo = {};
        (data || []).forEach((row) => { configPorTipo[row.tipo_formulario] = row.email || ''; });
    }

    function renderLinhas() {
        const container = document.getElementById('linhasConfigEmail');
        container.innerHTML = TIPOS.map((t) => `
            <div class="detail-row">
                <div class="detail-field" style="flex:1;">
                    <label class="detail-label">${escapeHtml(t.label)}</label>
                    <input type="email" id="email_${t.tipo}" class="search-input" style="padding: var(--spacing-md);"
                           placeholder="ex: contato@scontdf.com.br" value="${escapeAttr(configPorTipo[t.tipo] || '')}">
                </div>
                <div class="detail-field" style="flex:0 0 auto;align-self:flex-end;">
                    <button type="button" class="btn btn-primary" data-tipo="${t.tipo}" id="btnSalvar_${t.tipo}" style="padding:6px 14px;font-size:12px;">Salvar</button>
                </div>
            </div>
        `).join('');

        TIPOS.forEach((t) => {
            document.getElementById(`btnSalvar_${t.tipo}`).addEventListener('click', () => salvarLinha(t.tipo));
        });
    }

    async function salvarLinha(tipo) {
        const input = document.getElementById(`email_${tipo}`);
        const email = input.value.trim();

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            mostrarToast('Informe um e-mail válido ou deixe o campo vazio.', 'erro');
            return;
        }

        const btn = document.getElementById(`btnSalvar_${tipo}`);
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const { error } = await supabaseClient
            .from('formularios_config_email')
            .update({ email: email || null, updated_at: new Date().toISOString() })
            .eq('tipo_formulario', tipo);

        btn.disabled = false;
        btn.textContent = 'Salvar';

        if (error) {
            console.error(error);
            mostrarToast('Erro ao salvar. Tente novamente.', 'erro');
            return;
        }

        configPorTipo[tipo] = email;
        mostrarToast('E-mail salvo com sucesso.', 'sucesso');
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function escapeAttr(str) { return escapeHtml(str); }

    function mostrarToast(msg, tipo) {
        let toast = document.getElementById('toastConfig');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toastConfig';
            toast.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:14px 22px;border-radius:8px;color:#fff;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:3000;opacity:0;transform:translateY(10px);transition:opacity 0.2s, transform 0.2s;';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.background = tipo === 'erro' ? '#D32F2F' : '#388E3C';
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
        }, 3000);
    }
})();
