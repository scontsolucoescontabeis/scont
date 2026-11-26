// Portal do Cliente - página de login/cadastro (mesma dinâmica do login.html do Portal SCONT).
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const A = window.AcessoCliente;
const DESTINO = 'portal.html';

let empresaSelecionadaCadastro = null; // { codigo_empresa, nome_empresa }

function $(id) { return document.getElementById(id); }

// Alertas: somem em 6 s (padrão do Portal SCONT), exceto quando fixo = true.
const timersAlerta = new WeakMap();
function showAlert(el, msg, type, fixo = false) {
    clearTimeout(timersAlerta.get(el));
    el.textContent = msg;
    el.className = `alert alert-${type} show`;
    if (!fixo) timersAlerta.set(el, setTimeout(() => el.classList.remove('show'), 6000));
}

function setCarregando(btn, texto) {
    btn.disabled = true;
    btn.textContent = '';
    const s = document.createElement('span');
    s.className = 'loading';
    btn.append(s, texto);
}
function fimCarregando(btn, texto) { btn.disabled = false; btn.textContent = texto; }

function irParaAba(nome) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === nome));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === nome));
}
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => irParaAba(btn.dataset.tab)));

// ─── LOGIN ─────────────────────────────────────────────────
$('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;
    const btn = $('btnLogin');
    const alertEl = $('alertLogin');

    setCarregando(btn, 'Entrando...');
    try {
        const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
        if (authErr) throw new Error(authErr.message);

        const r = await A.verificarAcesso(sb);
        if (!r.ok) {
            if (r.tipo !== 'erro') await sb.auth.signOut();
            showAlert(alertEl, '❌ ' + r.mensagem, 'error', r.tipo === 'negado');
            fimCarregando(btn, 'Entrar');
            return;
        }

        A.salvarAuth(r.auth);
        showAlert(alertEl, r.auth.isAdmin
            ? '✅ Acesso admin liberado! Redirecionando...'
            : '✅ Login realizado! Redirecionando...', 'success');
        setTimeout(() => { window.location.href = DESTINO; }, 1200);
    } catch (err) {
        showAlert(alertEl, '❌ ' + err.message, 'error');
        fimCarregando(btn, 'Entrar');
    }
});

$('btnEsqueci').addEventListener('click', async () => {
    const email = $('loginEmail').value.trim();
    const al = $('alertLogin');
    if (!email) { showAlert(al, 'ℹ️ Informe seu e-mail no campo acima para redefinir a senha.', 'info'); return; }
    try {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
            redirectTo: new URL('../redefinir-senha.html', window.location.href).href
        });
        if (error) throw new Error(error.message);
        showAlert(al, '✅ Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.', 'success', true);
    } catch (err) {
        showAlert(al, '❌ ' + err.message, 'error');
    }
});

// ─── BUSCA DE EMPRESA (cadastro, debounce 400 ms) ──────────
async function buscarEmpresas(texto) {
    const t = String(texto || '').trim();
    const digitos = t.replace(/\D/g, '');
    if (t.length < 4 && digitos.length < 4) return [];
    const { data, error } = await sb.rpc('buscar_empresas_publico', { p_texto: t });
    if (error) throw new Error(error.message);
    return data || [];
}

let timerBusca = null;
let seqBusca = 0;
$('cadastroBusca').addEventListener('input', () => {
    clearTimeout(timerBusca);
    const ul = $('buscaResultados');
    const dica = $('buscaDica');
    const texto = $('cadastroBusca').value;
    ul.replaceChildren();
    const t = texto.trim();
    if (t.length < 4 && t.replace(/\D/g, '').length < 4) {
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
        } catch {
            if (minha !== seqBusca) return;
            dica.textContent = 'Não foi possível buscar agora. Tente novamente.';
        }
    }, 400);
});

function escolherEmpresa(emp) {
    empresaSelecionadaCadastro = emp;
    A.lembrarNome(emp.codigo_empresa, emp.nome_empresa);
    $('buscaResultados').replaceChildren();
    $('cadastroBusca').value = '';
    $('buscaDica').textContent = '';
    const box = $('empresaEscolhida');
    box.textContent = `✅ Empresa selecionada: ${emp.nome_empresa} (código ${emp.codigo_empresa})`;
    box.hidden = false;
}

// ─── CADASTRO ──────────────────────────────────────────────
$('cadastroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = $('cadastroNome').value.trim();
    const email = $('cadastroEmail').value.trim();
    const password = $('cadastroPassword').value;
    const confirmar = $('cadastroPasswordConfirm').value;
    const cargo = $('cadastroCargo').value.trim();
    const telefone = $('cadastroTelefone').value.trim();
    const btn = $('btnCadastro');
    const alertEl = $('alertCadastro');

    if (password !== confirmar) { showAlert(alertEl, '❌ As senhas não conferem', 'error'); return; }
    if (!empresaSelecionadaCadastro) { showAlert(alertEl, '❌ Busque e selecione a sua empresa', 'error'); return; }

    setCarregando(btn, 'Processando...');
    try {
        const { data, error } = await sb.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: new URL('index.html', window.location.href).href,
                data: { portal: 'cliente', nome, cargo, telefone, codigo_empresa: empresaSelecionadaCadastro.codigo_empresa }
            }
        });
        if (error) throw new Error(error.message);

        // O pedido nasce pendente: não fica logado até a equipe SCONT aprovar.
        const precisaConfirmar = !(data && data.session);
        if (!precisaConfirmar) await sb.auth.signOut();

        showAlert(alertEl, '✅ Solicitação enviada! Aguarde a aprovação da equipe SCONT.', 'success');
        $('cadastroForm').reset();
        empresaSelecionadaCadastro = null;
        $('empresaEscolhida').hidden = true;
        $('buscaDica').textContent = 'Digite ao menos 4 letras ou o CNPJ';
        setTimeout(() => {
            irParaAba('login');
            showAlert($('alertLogin'), precisaConfirmar
                ? 'ℹ️ Enviamos um e-mail de confirmação. Confirme seu endereço; você poderá entrar assim que a equipe SCONT aprovar o acesso.'
                : 'ℹ️ Solicitação enviada. Você poderá entrar assim que a equipe SCONT aprovar o acesso.', 'info', true);
        }, 2200);
    } catch (err) {
        showAlert(alertEl, '❌ ' + err.message, 'error');
    } finally {
        fimCarregando(btn, 'Solicitar Acesso');
    }
});

// ─── REDIRECT SE JÁ LOGADO ─────────────────────────────────
// Sessão existente (cliente aprovado voltando de uma ferramenta, ou admin vindo do painel)
// vai direto ao portal. Sem acesso liberado, permanece no login sem derrubar a sessão.
async function checkAutoLogin() {
    try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) { A.limparAuth(); return; }
        const r = await A.verificarAcesso(sb);
        if (r.ok) {
            const anterior = A.lerAuth();
            if (anterior && anterior.authUserId === r.auth.authUserId) r.auth.loginTime = anterior.loginTime;
            A.salvarAuth(r.auth);
            window.location.replace(DESTINO);
        } else if (['aguardando', 'negado', 'sem_pedido'].includes(r.tipo)) {
            // Cliente que acabou de confirmar o e-mail (ou com pedido recusado): explica e encerra a sessão.
            await sb.auth.signOut();
            showAlert($('alertLogin'), (r.tipo === 'aguardando' ? 'ℹ️ ' : '❌ ') + r.mensagem,
                r.tipo === 'aguardando' ? 'info' : 'error', true);
        }
    } catch { /* permanece no login */ }
}
document.addEventListener('DOMContentLoaded', checkAutoLogin);
window.addEventListener('pageshow', (e) => { if (e.persisted) checkAutoLogin(); });

// ─── AVISO DE DESCONEXÃO POR INATIVIDADE ───────────────────
if (new URLSearchParams(location.search).get('motivo') === 'inatividade') {
    document.addEventListener('DOMContentLoaded', () => {
        showAlert($('alertLogin'),
            '🔒 Sua sessão foi encerrada por inatividade. Faça login novamente para continuar.', 'info', true);
    });
}
