// Projeto Ficha 360/js/app.js
window.F360 = {
    sb: null, auth: null, userId: null, hoje: null,
    dados: null, falhas: {}, carteira: [],

    NOMES_FONTE: {
        empresas: 'Empresas', fichas: 'Cadastro Scont', contatos: 'Contatos', respDp: 'Responsáveis DP',
        usuariosDp: 'Usuários DP', respContabil: 'Responsáveis Contábil', usuariosContabil: 'Usuários Contábil',
        cfgFolha: 'Config. Folha', cfgContabil: 'Config. Contábil', certificados: 'Certificados',
        licencas: 'Licenças', alvaras: 'Alvarás', empregados: 'Empregados', socios: 'Sócios',
        ciclos: 'Fechamento da Folha', formularios: 'Formulários', empregadosForm: 'Formulários de empregado',
        onboardings: 'Onboarding', mapeamentos: 'Mapeamento', pendencias: 'Pendências do Mapeamento',
        diarioEventos: 'Diário Contábil', gruposItens: 'Grupos', grupos: 'Grupos',
    },
    ROTULO_SEMAFORO: { vermelho: 'Crítico', amarelo: 'Atenção', verde: 'OK', inativo: 'Inativa' },
    ROTULO_STATUS: { ativo: 'Ativo', em_implantacao: 'Em implantação', em_saida: 'Em saída', inativo: 'Inativo' },

    esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    fmtData(iso) {
        if (!iso) return '—';
        const [a, m, d] = String(iso).slice(0, 10).split('-');
        return d && m && a ? `${d}/${m}/${a}` : '—';
    },
    CLASSE_CHIP_SEMAFORO: { vermelho: 'critico', amarelo: 'atencao', verde: 'ok', inativo: 'neutro' },
    semaforoHtml(s) {
        const cls = F360.CLASSE_CHIP_SEMAFORO[s] || 'neutro';
        return `<span class="chip chip-${cls}">${F360.esc(F360.ROTULO_SEMAFORO[s] || s)}</span>`;
    },
    chipAlerta(a) {
        return `<span class="chip chip-${a.gravidade}">${F360.esc(a.mensagem)}</span>`;
    },

    async carregar() {
        const carregando = document.getElementById('carregando');
        carregando.hidden = false;
        const { dados, falhas } = await Ficha360Fontes.carregarCarteira(F360.sb, F360.hoje);
        carregando.hidden = true;
        F360.dados = dados;
        F360.falhas = falhas;
        if (!dados.empresas) {
            document.getElementById('telaPainel').hidden = false;
            document.getElementById('telaPainel').innerHTML =
                `<div class="cartao vazio">Não foi possível carregar as empresas (${F360.esc(falhas.empresas)}). Tente novamente mais tarde.</div>`;
            return false;
        }
        F360.recalcular();
        F360.renderAvisoFontes();
        return true;
    },

    recalcular() {
        F360.carteira = Ficha360Carteira.montarCarteira(F360.dados, F360.hoje);
    },

    renderAvisoFontes() {
        const el = document.getElementById('avisoFontes');
        const ignorar = ['fichas', 'contatos']; // tratados como "configuração pendente" nas abas
        const nomes = [...new Set(Object.keys(F360.falhas).filter(k => !ignorar.includes(k)).map(k => F360.NOMES_FONTE[k] || k))];
        const sqlPendente = F360.falhas.fichas === 'tabela_ausente' || F360.falhas.contatos === 'tabela_ausente';
        const partes = [];
        if (nomes.length) partes.push(`⚠️ Indisponível: ${F360.esc(nomes.join(', '))} — alertas incompletos.`);
        if (sqlPendente) partes.push('🛠️ Configuração pendente: o SQL da Ficha 360 ainda não foi executado (cadastro, contatos e anotações desativados).');
        el.innerHTML = partes.join('<br>');
        el.hidden = partes.length === 0;
    },

    irParaEmpresa(codigo) {
        history.pushState({}, '', `?empresa=${encodeURIComponent(codigo)}`);
        F360.rotear();
    },
    irParaPainel() {
        history.pushState({}, '', window.location.pathname);
        F360.rotear();
    },
    rotear() {
        const codigo = new URLSearchParams(window.location.search).get('empresa');
        document.getElementById('telaPainel').hidden = !!codigo;
        document.getElementById('telaFicha').hidden = !codigo;
        window.scrollTo(0, 0);
        if (codigo) Ficha360Ficha.abrir(codigo);
        else Ficha360Painel.render();
    },
};

document.addEventListener('DOMContentLoaded', async () => {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return;

    const empresaUsuario = (auth.userData?.empresa || '').trim().toLowerCase();
    if (!auth.isAdmin && empresaUsuario === 'prestador de serviço') {
        window.location.replace('../portal.html');
        return;
    }

    F360.auth = auth;
    F360.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    F360.hoje = F360.hojeISO();
    const { data } = await F360.sb.auth.getUser();
    F360.userId = data?.user?.id || null;

    document.getElementById('authOverlay')?.remove();
    document.getElementById('menuPainel').addEventListener('click', () => F360.irParaPainel());
    window.addEventListener('popstate', () => F360.rotear());

    if (await F360.carregar()) F360.rotear();
});
