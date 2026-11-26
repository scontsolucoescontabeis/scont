// Portal do Cliente - área logada (mesma dinâmica do portal.html do Portal SCONT).
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const A = window.AcessoCliente;
const E = window.EstadoCliente;
const LOGIN = 'index.html';

function $(id) { return document.getElementById(id); }

// Ferramentas do cliente. url(codigo) vazio = "Em breve".
const FERRAMENTAS = [
    {
        icone: '📅', nome: 'Montador de Escala 5x2',
        descricao: 'Monte a escala 5x2 da sua equipe com os dados do RH',
        url: (codigo) => E.urlMontador(codigo)
    },
    {
        icone: '💬', nome: 'Solicitações à SCONT',
        descricao: 'Envie pedidos e documentos para a equipe SCONT',
        url: null
    },
    {
        icone: '📋', nome: 'Acompanhar Demandas',
        descricao: 'Veja o andamento das suas solicitações',
        url: null
    }
];

let auth = null;
let empresaAtual = null;

// ─── HAMBURGER ─────────────────────────────────────────────
const sidebar = $('sidebar');
const overlay = $('overlay');
function fecharMenu() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    $('hamburger').setAttribute('aria-expanded', 'false');
}
$('hamburger').addEventListener('click', () => {
    const aberto = sidebar.classList.toggle('open');
    overlay.classList.toggle('show', aberto);
    $('hamburger').setAttribute('aria-expanded', String(aberto));
});
overlay.addEventListener('click', fecharMenu);

// ─── AUTH ──────────────────────────────────────────────────
function irParaLogin() {
    A.limparAuth();
    window.location.replace(LOGIN);
}

async function checkAuth() {
    const salvo = A.lerAuth();
    if (!salvo) { irParaLogin(); return null; }
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { irParaLogin(); return null; }
        // Reconfere no banco: acesso revogado ou empresas alteradas valem já no próximo carregamento.
        const r = await A.verificarAcesso(sb);
        if (!r.ok) {
            if (r.tipo === 'erro') { mostrarErro('❌ ' + r.mensagem); return null; }
            irParaLogin();
            return null;
        }
        if (salvo.authUserId === r.auth.authUserId) r.auth.loginTime = salvo.loginTime;
        A.salvarAuth(r.auth);
        return r.auth;
    } catch {
        irParaLogin();
        return null;
    }
}

function mostrarErro(msg) {
    const el = $('alertPortal');
    el.textContent = msg;
    el.classList.add('show');
}

// ─── EMPRESAS ──────────────────────────────────────────────
function criarCardEmpresa(codigo) {
    const nome = A.nomeEmpresa(codigo);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'empresa-card';
    card.dataset.busca = E.normalizarBusca(`${nome} ${codigo}`);
    const icon = document.createElement('span');
    icon.className = 'empresa-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🏢';
    const info = document.createElement('span');
    info.className = 'empresa-card-info';
    const nm = document.createElement('span');
    nm.className = 'empresa-card-nome';
    nm.textContent = nome || `Empresa ${codigo}`;
    const cd = document.createElement('span');
    cd.className = 'empresa-card-cod';
    cd.textContent = 'Código ' + codigo;
    info.append(nm, cd);
    const seta = document.createElement('span');
    seta.className = 'empresa-card-seta';
    seta.setAttribute('aria-hidden', 'true');
    seta.textContent = '→';
    card.append(icon, info, seta);
    card.addEventListener('click', () => selecionarEmpresa(codigo));
    return card;
}

function mostrarSeletor() {
    empresaAtual = null;
    A.gravarSession(A.CHAVE_EMPRESA, null);
    $('cardFerramentas').hidden = true;
    $('sidebarEmpresaBox').hidden = true;
    $('headerEmpresa').hidden = true;
    $('bannerAdmin').hidden = !auth.isAdmin;
    $('empresasTexto').textContent = auth.isAdmin
        ? 'Modo administrador: escolha qualquer empresa para visualizar o portal como o cliente.'
        : 'Você tem acesso a mais de uma empresa. Selecione qual deseja acessar.';
    $('buscaEmpresasWrap').hidden = !(auth.isAdmin || auth.empresas.length > 6);
    $('buscaEmpresas').value = '';
    const grid = $('empresasGrid');
    grid.replaceChildren(...auth.empresas.map(criarCardEmpresa));
    if (!auth.empresas.length) renderEmpty(grid, '🏢', 'Nenhuma empresa disponível.', 'Entre em contato com a SCONT.');
    $('cardEmpresas').hidden = false;
}

$('buscaEmpresas').addEventListener('input', () => {
    const t = E.normalizarBusca($('buscaEmpresas').value);
    const grid = $('empresasGrid');
    grid.querySelector('.empty-state-wrap')?.remove();
    let visiveis = 0;
    grid.querySelectorAll('.empresa-card').forEach(c => {
        c.hidden = t !== '' && !c.dataset.busca.includes(t);
        if (!c.hidden) visiveis++;
    });
    if (!visiveis) renderEmpty(grid, '🔍', 'Nenhuma empresa encontrada.', 'Tente outro termo de busca.', true);
});

function selecionarEmpresa(codigo) {
    empresaAtual = codigo;
    A.gravarSession(A.CHAVE_EMPRESA, codigo);
    $('cardEmpresas').hidden = true;
    $('sidebarEmpresa').textContent = A.rotuloEmpresa(codigo);
    $('sidebarEmpresaBox').hidden = false;
    $('btnTrocarEmpresa').hidden = auth.empresas.length < 2;
    $('headerEmpresa').textContent = '🏢 ' + A.rotuloEmpresa(codigo);
    $('headerEmpresa').hidden = false;
    $('bannerAdmin').hidden = !auth.isAdmin;
    $('buscaFerramentas').value = '';
    aplicarFiltro();
    $('cardFerramentas').hidden = false;
    fecharMenu();
}

$('btnTrocarEmpresa').addEventListener('click', () => { mostrarSeletor(); fecharMenu(); });

// ─── FERRAMENTAS ───────────────────────────────────────────
function criarCardFerramenta(f) {
    const href = f.url ? f.url(empresaAtual) : '';
    const card = document.createElement('div');
    card.className = 'ferramenta-card' + (href ? '' : ' ferramenta-breve');
    const icon = document.createElement('div');
    icon.className = 'ferramenta-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = f.icone;
    const nome = document.createElement('div');
    nome.className = 'ferramenta-nome';
    nome.textContent = f.nome;
    const desc = document.createElement('div');
    desc.className = 'ferramenta-desc';
    desc.textContent = f.descricao;
    card.append(icon, nome, desc);

    if (href) {
        const btn = document.createElement('a');
        btn.className = 'btn-acessar';
        btn.href = href;
        btn.textContent = 'Acessar →';
        card.addEventListener('click', (e) => { if (e.target !== btn) window.location.href = href; });
        card.appendChild(btn);
    } else {
        const selo = document.createElement('span');
        selo.className = 'selo-breve';
        selo.textContent = 'Em breve';
        card.setAttribute('aria-disabled', 'true');
        card.appendChild(selo);
    }
    return card;
}

function renderEmpty(grid, icone, msg, dica, anexar = false) {
    const wrap = document.createElement('div');
    wrap.className = 'empty-state-wrap';
    const box = document.createElement('div');
    box.className = 'empty-state';
    const i = document.createElement('div');
    i.className = 'empty-state-icon';
    i.textContent = icone;
    const p1 = document.createElement('p');
    p1.textContent = msg;
    const p2 = document.createElement('p');
    p2.textContent = dica;
    box.append(i, p1, p2);
    wrap.appendChild(box);
    if (anexar) grid.appendChild(wrap); else grid.replaceChildren(wrap);
}

function aplicarFiltro() {
    const termo = E.normalizarBusca($('buscaFerramentas').value);
    const filtradas = termo
        ? FERRAMENTAS.filter(f => E.normalizarBusca(f.nome).includes(termo))
        : FERRAMENTAS;
    const grid = $('ferramentasGrid');
    if (!filtradas.length) {
        renderEmpty(grid, '🔍', 'Nenhuma ferramenta encontrada.', 'Tente outro termo de busca.');
        return;
    }
    grid.replaceChildren(...filtradas.map(criarCardFerramenta));
}
$('buscaFerramentas').addEventListener('input', aplicarFiltro);

// ─── LOGOUT ────────────────────────────────────────────────
$('btnLogout').addEventListener('click', async () => {
    if (!confirm('Deseja sair?')) return;
    A.limparAuth();
    await sb.auth.signOut();
    window.location.replace(LOGIN);
});

// ─── INICIALIZAR ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    auth = await checkAuth();
    if (!auth) return;
    const nome = auth.nome || auth.email;
    $('welcomeMsg').textContent = `Bem-vindo, ${nome.split(' ')[0]}!`;
    $('sidebarNome').textContent = nome;
    $('sidebarEmail').textContent = auth.email;
    $('headerEmail').textContent = auth.email;
    $('headerLogin').textContent = `Login: ${new Date(auth.loginTime).toLocaleTimeString('pt-BR')}`;

    const guardada = A.lerSession(A.CHAVE_EMPRESA);
    if (guardada && auth.empresas.includes(guardada)) selecionarEmpresa(guardada);
    else if (auth.empresas.length === 1) selecionarEmpresa(auth.empresas[0]);
    else mostrarSeletor();

    window.PortalInatividade?.iniciar({
        sb, depthToRoot: 0, loginPage: LOGIN,
        sessionKeys: [A.CHAVE_AUTH, A.CHAVE_EMPRESA, 'userAuth', 'adminAuth']
    });
});
