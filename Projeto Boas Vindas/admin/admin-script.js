'use strict';

// ===== SUPABASE =====
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== ESTADO =====
let cnaePrincipalSelecionado   = null;
let cnaesSecundariosSelecionados = [];
let cnaesListaCompleta          = [];
let modalCNAETipo               = 'principal';

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item =>
        item.addEventListener('click', () => mudarSecao(item.getAttribute('data-section')))
    );

    document.getElementById('formCriarApresentacao')
        ?.addEventListener('submit', e => { e.preventDefault(); criarApresentacao(); });

    carregarHistorico();
});

// ===== NAVEGAÇÃO =====
function mudarSecao(secao) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(secao)?.classList.add('active');
    document.querySelector(`[data-section="${secao}"]`)?.classList.add('active');
    if (secao === 'historico') carregarHistorico();
}

// ===== CRIAR APRESENTAÇÃO =====
async function criarApresentacao() {
    if (!cnaePrincipalSelecionado) {
        showToast('Selecione um CNAE Principal obrigatoriamente', 'error');
        return;
    }

    const btn = document.querySelector('#formCriarApresentacao button[type="submit"]');
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    const fd = new FormData(document.getElementById('formCriarApresentacao'));

    const payload = {
        razao_social:      fd.get('razaoSocial'),
        cnpj:              fd.get('cnpj'),
        inscricao:         fd.get('inscricao') || null,
        regime:            fd.get('regime')    || null,
        porte:             fd.get('porte')     || null,
        ramo:              fd.get('ramo')      || null,
        cnae_principal:    `${cnaePrincipalSelecionado.codigo} — ${cnaePrincipalSelecionado.atividade}`,
        cnaes_secundarios: cnaesSecundariosSelecionados.length
            ? cnaesSecundariosSelecionados.map(c => `${c.codigo} — ${c.atividade}`).join('\n')
            : null,
        nome_contato:  fd.get('nomeContato'),
        email_cliente: fd.get('emailCliente'),
        telefone:      fd.get('telefone') || null,
        cargo:         fd.get('cargo')    || null,
        mensagem:      fd.get('mensagem') || null,
    };

    try {
        const { data, error } = await db
            .from('apresentacoes')
            .insert([payload])
            .select('id, razao_social, nome_contato')
            .single();

        if (error) throw error;

        exibirResultado(data);
        showToast('Apresentação criada com sucesso!', 'success');
        carregarHistorico();

    } catch (err) {
        console.error(err);
        showToast('Erro ao salvar: ' + (err.message || JSON.stringify(err)), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
}

// ===== EXIBIR RESULTADO =====
function exibirResultado(data) {
    document.getElementById('resultadoCliente').textContent = data.nome_contato;
    document.getElementById('resultadoEmpresa').textContent = data.razao_social;
    document.getElementById('resultadoData').textContent    = new Date().toLocaleDateString('pt-BR');

    const link = gerarLink(data.id);
    document.getElementById('linkUnico').value = link;
    const btnVer = document.getElementById('btnVisualizarApresentacao');
    if (btnVer) btnVer.href = link;

    const resultado = document.getElementById('resultado');
    resultado.style.display = 'block';
    resultado.scrollIntoView({ behavior: 'smooth' });
}

function gerarLink(id) {
    const base = window.location.href.replace(/admin\/admin\.html.*$/, '');
    return `${base}index.html?id=${id}`;
}

// ===== COPIAR LINK =====
function copiarLink() {
    const val = document.getElementById('linkUnico')?.value;
    if (!val) return;
    navigator.clipboard.writeText(val)
        .then(() => showToast('Link copiado!', 'success'))
        .catch(() => {
            document.getElementById('linkUnico').select();
            document.execCommand('copy');
            showToast('Link copiado!', 'success');
        });
}

function copiarLinkHistorico(link) {
    navigator.clipboard.writeText(link)
        .then(() => showToast('Link copiado!', 'success'))
        .catch(() => showToast('Não foi possível copiar', 'error'));
}

// ===== NOVA APRESENTAÇÃO =====
function novaApresentacao() {
    document.getElementById('formCriarApresentacao').reset();
    document.getElementById('resultado').style.display = 'none';
    removerCnaePrincipal();
    cnaesSecundariosSelecionados = [];
    atualizarListaCnaesSecundarios();
}

// ===== CARREGAR HISTÓRICO =====
async function carregarHistorico() {
    const tbody = document.getElementById('tabelaHistorico');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

    try {
        const { data, error } = await db
            .from('apresentacoes')
            .select('id, razao_social, nome_contato, email_cliente, criado_em, acessos')
            .eq('ativo', true)
            .order('criado_em', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!data?.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhuma apresentação criada ainda</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(item => {
            const dt   = new Date(item.criado_em).toLocaleDateString('pt-BR');
            const link = gerarLink(item.id);
            return `<tr>
                <td>${item.razao_social}</td>
                <td>${item.nome_contato}</td>
                <td>${item.email_cliente}</td>
                <td>${dt}</td>
                <td>${item.acessos || 0}</td>
                <td style="display:flex;gap:6px;">
                    <a href="${link}" target="_blank" class="btn btn-info btn-sm" title="Visualizar">
                        <i class="fas fa-eye"></i>
                    </a>
                    <button onclick="copiarLinkHistorico('${link}')" class="btn btn-secondary btn-sm" title="Copiar link">
                        <i class="fas fa-copy"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Erro ao carregar histórico</td></tr>';
        showToast('Erro ao carregar histórico', 'error');
    }
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = 'position:fixed;bottom:24px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(container);
    }
    const color = type === 'error' ? '#E74C3C' : '#27AE60';
    const t = document.createElement('div');
    t.style.cssText = `background:#fff;border-left:4px solid ${color};color:${color};padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,.12);opacity:0;transform:translateX(40px);transition:opacity .3s,transform .3s;max-width:320px;pointer-events:auto;`;
    t.textContent = msg;
    container.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateX(0)'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 4000);
}

// ===== MODAL CNAE =====
function abrirModalCNAE(tipo) {
    modalCNAETipo = tipo;
    if (!window.CNAES_LISTA?.length) { showToast('CNAEs não carregados', 'error'); return; }
    cnaesListaCompleta = window.CNAES_LISTA;
    exibirTabelaCNAE(cnaesListaCompleta);

    document.getElementById('modalCNAE')?.classList.add('active');
    const filtro = document.getElementById('filtroCNAE');
    if (filtro) { filtro.value = ''; filtro.focus(); }

    const h = document.querySelector('.modal-cnae-header h2');
    if (h) h.textContent = tipo === 'principal' ? 'Selecionar CNAE Principal' : 'Adicionar CNAE Secundário';
}

function fecharModalCNAE() {
    document.getElementById('modalCNAE')?.classList.remove('active');
    const f = document.getElementById('filtroCNAE');
    if (f) f.value = '';
}

function filtrarTabelaCNAE() {
    const termo = document.getElementById('filtroCNAE')?.value.toLowerCase() || '';
    exibirTabelaCNAE(
        termo
            ? cnaesListaCompleta.filter(c =>
                c.codigo.toLowerCase().includes(termo) ||
                c.atividade.toLowerCase().includes(termo))
            : cnaesListaCompleta
    );
}

function exibirTabelaCNAE(cnaes) {
    const tbody = document.getElementById('tabelaCNAECorpo');
    const total = document.getElementById('totalCNAEs');
    if (!tbody) return;
    if (total) total.textContent = cnaes.length;
    if (!cnaes.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum CNAE encontrado</td></tr>';
        return;
    }
    tbody.innerHTML = cnaes.slice(0, 300).map(c => `
        <tr>
            <td><strong>${c.codigo}</strong></td>
            <td>${c.atividade}</td>
            <td><button type="button" class="btn btn-info btn-sm"
                onclick="selecionarCNAE('${c.codigo}','${c.atividade.replace(/'/g, "\\'")}')">
                Selecionar
            </button></td>
        </tr>`).join('');
}

function selecionarCNAE(codigo, atividade) {
    modalCNAETipo === 'principal'
        ? selecionarCnaePrincipal(codigo, atividade)
        : adicionarCnaeSecundario(codigo, atividade);
    fecharModalCNAE();
}

function selecionarCnaePrincipal(codigo, atividade) {
    cnaePrincipalSelecionado = { codigo, atividade };
    const input = document.getElementById('cnaePrincipal');
    if (input) input.value = `${codigo} - ${atividade}`;
    const elCod = document.getElementById('cnaePrincipalCodigo');
    if (elCod) elCod.textContent = codigo;
    const elAtv = document.getElementById('cnaePrincipalAtividade');
    if (elAtv) elAtv.textContent = atividade;
    const info = document.getElementById('cnaePrincipalInfo');
    if (info) info.style.display = 'block';
    const grupo = document.getElementById('grupoSecundarios');
    if (grupo) grupo.style.display = 'block';
}

function removerCnaePrincipal() {
    cnaePrincipalSelecionado = null;
    const input = document.getElementById('cnaePrincipal');
    if (input) input.value = '';
    const info = document.getElementById('cnaePrincipalInfo');
    if (info) info.style.display = 'none';
    if (!cnaesSecundariosSelecionados.length) {
        const g = document.getElementById('grupoSecundarios');
        if (g) g.style.display = 'none';
    }
}

function abrirModalAdicionarSecundario() { abrirModalCNAE('secundario'); }

function adicionarCnaeSecundario(codigo, atividade) {
    if (cnaesSecundariosSelecionados.find(c => c.codigo === codigo)) {
        showToast('Este CNAE secundário já foi adicionado', 'error');
        return;
    }
    cnaesSecundariosSelecionados.push({ codigo, atividade });
    atualizarListaCnaesSecundarios();
    const g = document.getElementById('grupoSecundarios');
    if (g) g.style.display = 'block';
}

function atualizarListaCnaesSecundarios() {
    const lista = document.getElementById('listaCnaesSecundarios');
    if (!lista) return;
    if (!cnaesSecundariosSelecionados.length) {
        lista.innerHTML = '<p class="text-muted">Nenhum CNAE secundário adicionado</p>';
        return;
    }
    lista.innerHTML = cnaesSecundariosSelecionados.map((c, i) => `
        <div class="cnae-secundario-item">
            <div class="cnae-secundario-info">
                <strong>${c.codigo}</strong>
                <span>${c.atividade}</span>
            </div>
            <div class="cnae-secundario-acoes">
                <button type="button" class="btn-remover-secundario" onclick="removerCnaeSecundario(${i})">
                    <i class="fas fa-trash"></i> Remover
                </button>
            </div>
        </div>`).join('');
}

function removerCnaeSecundario(index) {
    cnaesSecundariosSelecionados.splice(index, 1);
    atualizarListaCnaesSecundarios();
}

// Fechar modal ao clicar fora
document.addEventListener('click', e => {
    const modal = document.getElementById('modalCNAE');
    if (modal && e.target === modal) fecharModalCNAE();
});
