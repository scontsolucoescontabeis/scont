const { contextBridge, ipcRenderer } = require('electron');

const URL  = 'https://dsdqwigopzrdmxtmhsez.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzZHF3aWdvcHpyZG14dG1oc2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODM2OTUsImV4cCI6MjA5MjI1OTY5NX0.MPxbcKh6N_BNh0zTTb-jtNigQwCp-e6g3xboBbNbRmw';

let accessToken = null;

// ── helpers REST ─────────────────────────────────────────────────────────────

async function sbPost(path, body) {
    const r = await fetch(`${URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': KEY },
        body: JSON.stringify(body),
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json.error_description || json.message || 'Erro Supabase');
    return json;
}

async function sbGet(table, select = '*') {
    const headers = { 'apikey': KEY, 'Authorization': `Bearer ${accessToken || KEY}` };
    const r = await fetch(`${URL}/rest/v1/${table}?select=${select}`, { headers });
    const json = await r.json();
    if (!r.ok) throw new Error(json.message || 'Erro ao consultar ' + table);
    return json;
}

// ── API exposta ao renderer ───────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    // Auth
    login: async (email, senha) => {
        const data = await sbPost('/auth/v1/token?grant_type=password', { email, password: senha });
        accessToken = data.access_token;
        return { email: data.user.email, id: data.user.id };
    },
    logout: () => { accessToken = null; },

    // Dados do portal
    carregarRegras:      () => sbGet('rh_regras_renomeacao', '*'),
    carregarEmpresas:    () => sbGet('rh_empresas', 'codigo_empresa,nome_empresa,cnpj'),
    carregarTags:        () => sbGet('rh_renomeador_tags', '*&ativo=eq.true'),
    carregarMapeamentos: () => sbGet('rh_mapeamento_nomes', 'nome_arquivo,nome_documento'),

    // Filesystem
    salvarArquivos: (arquivos) => ipcRenderer.invoke('salvar-arquivos', arquivos),
    escolherPasta:  ()        => ipcRenderer.invoke('escolher-pasta'),
});
