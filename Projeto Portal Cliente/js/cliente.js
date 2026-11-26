// Portal do Cliente - login, cadastro e estados de acesso.
// O banco (RLS) é quem autoriza; sessionStorage é só conveniência.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CHAVE_EMPRESA = 'cliente_empresa';          // código da empresa escolhida
const CHAVE_NOMES = 'cliente_empresas_nomes';     // { codigo: nome } lembrado da busca
const ESTADOS = ['login', 'cadastro', 'aguardando', 'negado', 'seletor', 'home'];

let empresaSelecionadaCadastro = null; // { codigo_empresa, nome_empresa }
let perfilAtual = null;                // { nome, ... } de cliente_usuarios
let empresasAprovadas = [];
let modoAdmin = false;                 // administrador do portal visualizando como cliente

// ─── Utilidades ──────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function lerSession(chave) { try { return sessionStorage.getItem(chave); } catch { return null; } }
function gravarSession(chave, valor) {
    try { if (valor === null) sessionStorage.removeItem(chave); else sessionStorage.setItem(chave, valor); } catch { /* ignorar */ }
}
function lerNomes() {
    try { return JSON.parse(lerSession(CHAVE_NOMES) || '{}') || {}; } catch { return {}; }
}
function lembrarNome(codigo, nome) {
    const nomes = lerNomes();
    nomes[codigo] = nome;
    gravarSession(CHAVE_NOMES, JSON.stringify(nomes));
}
// Cliente não lê rh_empresas: o nome só existe se foi lembrado da busca; senão mostra o código.
function rotuloEmpresa(codigo) {
    const nome = lerNomes()[codigo];
    return nome ? `${nome} (${codigo})` : `Empresa ${codigo}`;
}

function mostrarAlerta(el, msg, tipo) {
    el.textContent = msg;
    el.className = `alert alert-${tipo} show`;
}
function limparAlerta(el) { el.className = 'alert'; el.textContent = ''; }

const ESTADOS_APP = ['seletor', 'home'];   // renderizados na área logada (barra superior)
function mostrarEstado(nome) {
    ESTADOS.forEach(e => $('estado-' + e).classList.toggle('ativo', e === nome));
    document.body.dataset.area = ESTADOS_APP.includes(nome) ? 'app' : 'auth';
    fecharMenuUsuario();
}

// Barra superior: nome e iniciais do usuário (sempre via textContent/atributos).
function preencherTopo() {
    const nome = (perfilAtual && perfilAtual.nome) || '';
    $('topoNome').textContent = nome;
    $('topoNomeMenu').textContent = nome;
    $('topoAvatar').dataset.iniciais = window.EstadoCliente.iniciais(nome);
    $('menuUsuario').querySelector('summary')
        .setAttribute('aria-label', nome ? `Menu do usuário: ${nome}` : 'Menu do usuário');
}
function fecharMenuUsuario() { const m = $('menuUsuario'); if (m) m.open = false; }

function setCarregando(btn, texto) {
    btn.disabled = true;
    btn.textContent = '';
    const s = document.createElement('span');
    s.className = 'loading';
    btn.append(s, texto);
}
function fimCarregando(btn, texto) { btn.disabled = false; btn.textContent = texto; }

// ─── Autenticação ────────────────────────────────────────
async function entrar(email, senha) {
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message);
    await rotearPorEstado();
}

async function cadastrar({ nome, email, senha, cargo, telefone, codigo_empresa }) {
    const { data, error } = await sb.auth.signUp({
        email,
        password: senha,
        options: {
            emailRedirectTo: new URL('index.html', window.location.href).href,
            data: { portal: 'cliente', nome, cargo, telefone, codigo_empresa }
        }
    });
    if (error) throw new Error(error.message);
    return data;
}

async function sair() {
    await sb.auth.signOut();
    gravarSession(CHAVE_EMPRESA, null);
    perfilAtual = null;
    empresasAprovadas = [];
    modoAdmin = false;
    mostrarEstado('login');
}

async function esqueciSenha(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: new URL('../redefinir-senha.html', window.location.href).href
    });
    if (error) throw new Error(error.message);
}

// ─── Busca de empresas ───────────────────────────────────
async function buscarEmpresas(texto) {
    const t = String(texto || '').trim();
    const digitos = t.replace(/\D/g, '');
    if (t.length < 4 && !digitos) return [];
    if (t.length < 4 && digitos.length < 4) return [];
    const { data, error } = await sb.rpc('buscar_empresas_publico', { p_texto: t });
    if (error) throw new Error(error.message);
    return data || [];
}

// ─── Roteamento por estado ───────────────────────────────
async function rotearPorEstado() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { mostrarEstado('login'); return; }

    // Administrador do portal: visualiza qualquer empresa (o banco é quem autoriza: empresas_do_cliente()).
    const { data: adm } = await sb.from('usuarios').select('nome, is_admin').eq('id', user.id).maybeSingle();
    if (adm && adm.is_admin === true) {
        const { data: empresas, error: empErr } = await sb
            .from('rh_empresas').select('codigo_empresa, nome_empresa').order('nome_empresa');
        if (empErr) {
            mostrarEstado('login');
            mostrarAlerta($('alertLogin'), 'Não foi possível carregar as empresas. Tente novamente.', 'error');
            return;
        }
        modoAdmin = true;
        perfilAtual = { nome: adm.nome || user.email };
        empresasAprovadas = (empresas || []).map(e => e.codigo_empresa);
        (empresas || []).forEach(e => lembrarNome(e.codigo_empresa, e.nome_empresa));
        const guardadaAdm = lerSession(CHAVE_EMPRESA);
        if (guardadaAdm && empresasAprovadas.includes(guardadaAdm)) { abrirHome(guardadaAdm); }
        else { montarSeletor(empresasAprovadas); mostrarEstado('seletor'); }
        return;
    }
    modoAdmin = false;

    // Perfil de cliente (admin lê todos, por isso filtra pelo próprio id)
    const { data: perfil, error: perfilErr } = await sb
        .from('cliente_usuarios').select('id, nome').eq('id', user.id).maybeSingle();
    if (perfilErr) {
        mostrarEstado('login');
        mostrarAlerta($('alertLogin'), 'Não foi possível verificar seu acesso. Tente novamente.', 'error');
        return;
    }
    if (!perfil) {
        await sb.auth.signOut();
        mostrarEstado('login');
        mostrarAlerta($('alertLogin'), 'Esta área é para clientes.', 'error');
        return;
    }
    perfilAtual = perfil;

    const { data: vinculos, error: vincErr } = await sb
        .from('cliente_acessos').select('codigo_empresa, status, motivo')
        .eq('usuario_id', user.id);
    if (vincErr) {
        mostrarEstado('login');
        mostrarAlerta($('alertLogin'), 'Não foi possível consultar seus acessos. Tente novamente.', 'error');
        return;
    }

    const r = window.EstadoCliente.decidirEstado(vinculos);
    empresasAprovadas = r.empresas;

    switch (r.estado) {
        case 'aguardando':
            mostrarEstado('aguardando');
            break;
        case 'sem_pedido':
        case 'negado': {
            $('negadoTexto').textContent = r.estado === 'sem_pedido'
                ? 'Não encontramos nenhum pedido de acesso para a sua conta. Entre em contato com a SCONT.'
                : 'Seu pedido de acesso não foi liberado. Em caso de dúvida, entre em contato com a SCONT.';
            const m = $('negadoMotivo');
            if (r.motivo) { mostrarAlerta(m, 'Motivo: ' + r.motivo, 'error'); } else { limparAlerta(m); }
            mostrarEstado('negado');
            break;
        }
        case 'seletor': {
            const guardada = lerSession(CHAVE_EMPRESA);
            if (guardada && r.empresas.includes(guardada)) { abrirHome(guardada); }
            else { montarSeletor(r.empresas); mostrarEstado('seletor'); }
            break;
        }
        case 'home':
            abrirHome(r.empresas[0]);
            break;
    }
}

function montarSeletor(codigos) {
    const ul = $('listaEmpresas');
    ul.replaceChildren();
    $('seletorFiltroWrap').hidden = !modoAdmin;
    $('seletorTexto').textContent = modoAdmin
        ? 'Modo administrador: escolha qualquer empresa para visualizar o portal como o cliente.'
        : 'Você tem acesso a mais de uma empresa. Selecione qual deseja acessar.';
    if (modoAdmin) $('seletorFiltro').value = '';
    $('seletorVazio').hidden = codigos.length > 0;
    $('btnTrocarEmpresa').hidden = true;
    $('topoEmpresaChip').hidden = true;
    $('bannerAdmin').hidden = true;
    preencherTopo();
    const nomes = lerNomes();
    codigos.forEach(cod => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        const nome = nomes[cod];
        const avatar = document.createElement('span');
        avatar.className = 'avatar';
        avatar.setAttribute('aria-hidden', 'true');
        avatar.dataset.iniciais = nome ? window.EstadoCliente.iniciais(nome) : '#';
        const info = document.createElement('span');
        info.className = 'empresa-info';
        const nm = document.createElement('span');
        nm.className = 'empresa-nome';
        nm.textContent = nome || `Empresa ${cod}`;
        const cd = document.createElement('span');
        cd.className = 'cod';
        cd.textContent = 'Código ' + cod;
        info.append(nm, ' ', cd);
        b.append(avatar, info);
        b.addEventListener('click', () => { gravarSession(CHAVE_EMPRESA, cod); abrirHome(cod); });
        li.appendChild(b);
        ul.appendChild(li);
    });
}

function abrirHome(codigo) {
    gravarSession(CHAVE_EMPRESA, codigo);
    $('homeEmpresa').textContent = rotuloEmpresa(codigo);
    $('homeNome').textContent = (perfilAtual && perfilAtual.nome) || '';
    $('btnTrocarEmpresa').hidden = empresasAprovadas.length < 2;
    $('bannerAdmin').hidden = !modoAdmin;
    $('topoEmpresa').textContent = rotuloEmpresa(codigo);
    $('topoEmpresaChip').hidden = false;
    preencherTopo();
    const cardMontador = $('cardMontador');
    const hrefMontador = window.EstadoCliente.urlMontador(codigo);
    if (hrefMontador) cardMontador.setAttribute('href', hrefMontador);
    cardMontador.hidden = !hrefMontador;
    mostrarEstado('home');
}

// ─── Eventos ─────────────────────────────────────────────
document.querySelectorAll('[data-ir]').forEach(b =>
    b.addEventListener('click', () => mostrarEstado(b.dataset.ir)));

document.querySelectorAll('[data-acao="sair"]').forEach(b => b.addEventListener('click', sair));
document.querySelectorAll('[data-acao="atualizar"]').forEach(b =>
    b.addEventListener('click', () => rotearPorEstado()));

$('btnTrocarEmpresa').addEventListener('click', () => {
    gravarSession(CHAVE_EMPRESA, null);
    montarSeletor(empresasAprovadas);
    mostrarEstado('seletor');
});

$('seletorFiltro').addEventListener('input', () => {
    const t = window.EstadoCliente.normalizarBusca($('seletorFiltro').value);
    let visiveis = 0;
    document.querySelectorAll('#listaEmpresas li').forEach(li => {
        li.hidden = t !== '' && !window.EstadoCliente.normalizarBusca(li.textContent).includes(t);
        if (!li.hidden) visiveis++;
    });
    $('seletorVazio').hidden = visiveis > 0;
});

// Menu do usuário: fecha ao clicar fora, ao escolher uma opção ou com Esc.
document.addEventListener('click', (e) => {
    const m = $('menuUsuario');
    if (m.open && !m.contains(e.target)) m.open = false;
});
$('menuUsuario').querySelectorAll('.menu-item').forEach(b => b.addEventListener('click', fecharMenuUsuario));
document.addEventListener('keydown', (e) => {
    const m = $('menuUsuario');
    if (e.key === 'Escape' && m.open) { m.open = false; m.querySelector('summary').focus(); }
});

$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('btnLogin');
    limparAlerta($('alertLogin'));
    setCarregando(btn, 'Entrando...');
    try {
        await entrar($('loginEmail').value.trim(), $('loginSenha').value);
    } catch (err) {
        mostrarAlerta($('alertLogin'), err.message, 'error');
    } finally {
        fimCarregando(btn, 'Entrar');
    }
});

$('btnEsqueci').addEventListener('click', async () => {
    const email = $('loginEmail').value.trim();
    const al = $('alertLogin');
    if (!email) { mostrarAlerta(al, 'Informe seu e-mail no campo acima para redefinir a senha.', 'info'); return; }
    try {
        await esqueciSenha(email);
        mostrarAlerta(al, 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.', 'success');
    } catch (err) {
        mostrarAlerta(al, err.message, 'error');
    }
});

// Busca de empresa (debounce 400 ms)
let timerBusca = null;
let seqBusca = 0;
$('cadBusca').addEventListener('input', () => {
    clearTimeout(timerBusca);
    const ul = $('buscaResultados');
    const dica = $('buscaDica');
    const texto = $('cadBusca').value;
    ul.replaceChildren();
    const t = texto.trim();
    const digitos = t.replace(/\D/g, '');
    if (t.length < 4 && digitos.length < 4) {
        dica.textContent = 'Digite ao menos 4 letras ou o CNPJ';
        return;
    }
    dica.textContent = 'Buscando...';
    const minha = ++seqBusca;
    timerBusca = setTimeout(async () => {
        try {
            const lista = (await buscarEmpresas(texto)).slice(0, 8);
            if (minha !== seqBusca) return;
            dica.textContent = lista.length ? 'Clique na sua empresa para selecioná-la.' : 'Nenhuma empresa encontrada.';
            lista.forEach(emp => {
                const li = document.createElement('li');
                const b = document.createElement('button');
                b.type = 'button';
                b.append(document.createTextNode(emp.nome_empresa || ''));
                const cod = document.createElement('span');
                cod.className = 'cod';
                cod.textContent = 'Código ' + emp.codigo_empresa;
                b.appendChild(cod);
                b.addEventListener('click', () => escolherEmpresa(emp));
                li.appendChild(b);
                ul.appendChild(li);
            });
        } catch (err) {
            if (minha !== seqBusca) return;
            dica.textContent = 'Não foi possível buscar agora. Tente novamente.';
        }
    }, 400);
});

function escolherEmpresa(emp) {
    empresaSelecionadaCadastro = emp;
    lembrarNome(emp.codigo_empresa, emp.nome_empresa);
    $('buscaResultados').replaceChildren();
    $('cadBusca').value = '';
    $('buscaDica').textContent = '';
    const box = $('empresaEscolhida');
    box.textContent = `Empresa selecionada: ${emp.nome_empresa} (código ${emp.codigo_empresa})`;
    box.hidden = false;
}

$('cadastroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const al = $('alertCadastro');
    limparAlerta(al);
    const senha = $('cadSenha').value;
    if (senha !== $('cadSenha2').value) { mostrarAlerta(al, 'As senhas não conferem.', 'error'); return; }
    if (!empresaSelecionadaCadastro) { mostrarAlerta(al, 'Busque e selecione a sua empresa.', 'error'); return; }

    const btn = $('btnCadastro');
    setCarregando(btn, 'Enviando...');
    try {
        const data = await cadastrar({
            nome: $('cadNome').value.trim(),
            email: $('cadEmail').value.trim(),
            senha,
            cargo: $('cadCargo').value.trim(),
            telefone: $('cadTelefone').value.trim(),
            codigo_empresa: empresaSelecionadaCadastro.codigo_empresa
        });
        $('cadastroForm').hidden = true;
        if (data && data.session) {
            await rotearPorEstado();
        } else {
            mostrarAlerta($('cadastroConfirmacao'),
                'Enviamos um e-mail de confirmação. Confirme seu endereço e depois entre para acompanhar a análise do seu acesso.',
                'success');
        }
    } catch (err) {
        mostrarAlerta(al, err.message, 'error');
    } finally {
        fimCarregando(btn, 'Solicitar acesso');
    }
});

// ─── Inicialização ───────────────────────────────────────
async function iniciar() {
    mostrarEstado('login');
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (session) await rotearPorEstado();
    } catch { /* permanece no login */ }
}
document.addEventListener('DOMContentLoaded', iniciar);
