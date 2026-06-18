const { contextBridge, ipcRenderer } = require('electron');

const SB_URL = 'https://dsdqwigopzrdmxtmhsez.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzZHF3aWdvcHpyZG14dG1oc2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODM2OTUsImV4cCI6MjA5MjI1OTY5NX0.MPxbcKh6N_BNh0zTTb-jtNigQwCp-e6g3xboBbNbRmw';

let accessToken = null;

// ── Helpers REST ──────────────────────────────────────────────────────────────

async function sbPost(path, body) {
    const r = await fetch(`${SB_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
        body: JSON.stringify(body),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error_description || json.message || 'Erro Supabase');
    return json;
}

function authHeaders() {
    return {
        'apikey':        SB_KEY,
        'Authorization': `Bearer ${accessToken || SB_KEY}`,
        'Content-Type':  'application/json',
    };
}

async function sbQuery(table, params = '') {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers: authHeaders() });
    const json = await r.json();
    if (!r.ok) throw new Error(json.message || 'Erro ao consultar ' + table);
    return json;
}

async function sbPatch(table, id, body) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        const json = await r.json().catch(() => ({}));
        throw new Error(json.message || 'Erro ao atualizar ' + table);
    }
    return true;
}

// ── API exposta ao renderer ───────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    // ── Auth ──────────────────────────────────────────────────────────────────
    login: async (email, senha) => {
        const data = await sbPost('/auth/v1/token?grant_type=password', { email, password: senha });
        accessToken = data.access_token;
        return { email: data.user.email, id: data.user.id };
    },
    logout: () => { accessToken = null; },

    // ── Campanhas ─────────────────────────────────────────────────────────────
    getCampanhas: () =>
        sbQuery('mala_direta_campanhas', 'select=*&order=created_at.desc'),

    getCampanha: (id) =>
        sbQuery('mala_direta_campanhas', `select=*&id=eq.${id}`).then(r => r[0] || null),

    // ── Envios ────────────────────────────────────────────────────────────────
    getEnvios: (campId) =>
        sbQuery('mala_direta_envios', `select=*&campanha_id=eq.${campId}&order=nome.asc`),

    marcarEnviado: (envioId) =>
        sbPatch('mala_direta_envios', envioId, {
            status_envio: 'enviado',
            data_envio:   new Date().toISOString(),
        }),

    // ── Envio via Outlook COM ─────────────────────────────────────────────────
    enviarEmail: (dest, assunto, htmlBody) =>
        ipcRenderer.invoke('enviar-email-outlook', { dest, assunto, htmlBody }),
});
