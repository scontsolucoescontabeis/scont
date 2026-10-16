// Projeto Ficha 360/js/app.js
window.F360 = {
    sb: null, auth: null, userId: null, hoje: null,
    dados: null, falhas: {}, carteira: [],
    // Alterações digitadas e ainda não salvas (Cadastro/Anotações) — protege contra perda ao sair.
    sujo: false,
    // Rolagem do painel guardada ao abrir uma ficha, pra voltar exatamente onde estava.
    scrollPainel: 0,

    NOMES_FONTE: {
        empresas: 'Empresas', fichas: 'Cadastro Scont', contatos: 'Contatos', respDp: 'Responsáveis DP',
        usuariosDp: 'Usuários DP', respContabil: 'Responsáveis Contábil', usuariosContabil: 'Usuários Contábil',
        cfgFolha: 'Config. Folha', cfgContabil: 'Config. Contábil', certificados: 'Certificados',
        licencas: 'Licenças', alvaras: 'Alvarás', empregados: 'Empregados', socios: 'Sócios',
        ciclos: 'Fechamento da Folha', formularios: 'Formulários', empregadosForm: 'Formulários de empregado',
        onboardings: 'Onboarding', mapeamentos: 'Mapeamento', pendencias: 'Pendências do Mapeamento',
        diarioEventos: 'Diário Contábil', gruposItens: 'Grupos', grupos: 'Grupos',
        jornadaPadrao: 'Jornada Padrão', jornadasExtras: 'Jornadas', valoresVaVt: 'Valores VA/VT',
        feriasCalculadas: 'Férias',
    },
    ROTULO_SEMAFORO: { vermelho: 'Crítico', amarelo: 'Atenção', verde: 'OK', inativo: 'Inativa' },
    ROTULO_STATUS: { ativo: 'Ativo', em_implantacao: 'Em implantação', em_saida: 'Em saída', inativo: 'Inativo' },

    // Ícones em emoji — mesma linguagem visual do portal e das outras ferramentas.
    // Sempre escondidos de leitores de tela (o texto ao lado já diz o que é).
    ICONES: {
        atualizar: '🔄', filtros: '⚙️', pessoas: '👥', estrela: '⭐', fixar: '📌',
        aviso: '⚠️', cadeado: '🔒', ok: '✅', config: '🛠️', info: 'ℹ️', voltar: '←',
    },
    ico(nome) {
        return `<span class="ico" aria-hidden="true">${F360.ICONES[nome] || ''}</span>`;
    },

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

    // Aviso temporário (substitui alert()): tipo 'ok' ou 'erro'. Erros ficam mais tempo na tela.
    avisar(mensagem, tipo = 'ok') {
        const caixa = document.getElementById('toasts');
        if (!caixa) return;
        const el = document.createElement('div');
        el.className = `toast toast-${tipo}`;
        el.innerHTML = `${F360.ico(tipo === 'erro' ? 'aviso' : 'ok')}<span>${F360.esc(mensagem)}</span>`;
        caixa.appendChild(el);
        setTimeout(() => el.remove(), tipo === 'erro' ? 7000 : 3200);
    },

    // Confirmação própria (substitui confirm()). Devolve Promise<boolean>.
    confirmar(mensagem, rotuloOk = 'Confirmar', perigo = true) {
        return new Promise(resolve => {
            const dlg = document.createElement('dialog');
            dlg.className = 'dialogo';
            dlg.setAttribute('aria-label', 'Confirmação');
            dlg.innerHTML = `<div class="dialogo-corpo">${F360.esc(mensagem)}</div>
                <div class="acoes"><button type="button" class="btn" data-r="nao">Cancelar</button>
                <button type="button" class="btn ${perigo ? 'btn-perigo-cheio' : 'btn-primario'}" data-r="sim">${F360.esc(rotuloOk)}</button></div>`;
            const fim = (r) => { dlg.close(); dlg.remove(); resolve(r); };
            dlg.querySelector('[data-r="sim"]').addEventListener('click', () => fim(true));
            dlg.querySelector('[data-r="nao"]').addEventListener('click', () => fim(false));
            dlg.addEventListener('cancel', (e) => { e.preventDefault(); fim(false); });
            document.body.appendChild(dlg);
            dlg.showModal();
            dlg.querySelector('[data-r="nao"]').focus();
        });
    },

    // Chamada antes de qualquer navegação interna: se há texto não salvo, pergunta antes de descartar.
    async podeSair() {
        if (!F360.sujo) return true;
        const ok = await F360.confirmar('Há alterações não salvas. Sair mesmo assim?', 'Sair sem salvar');
        if (ok) F360.sujo = false;
        return ok;
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
                `<div class="cartao vazio">Não foi possível carregar as empresas (${F360.esc(falhas.empresas)}). Atualize a página em instantes; se persistir, avise o suporte.</div>`;
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
        if (nomes.length) partes.push(`<div>${F360.ico('aviso')}Indisponível: ${F360.esc(nomes.join(', '))} — alertas incompletos.</div>`);
        if (sqlPendente) partes.push(`<div>${F360.ico('config')}Configuração pendente: o SQL da Ficha 360 ainda não foi executado (cadastro, contatos e anotações desativados).</div>`);
        el.innerHTML = partes.join('');
        el.hidden = partes.length === 0;
    },

    async irParaEmpresa(codigo) {
        if (!(await F360.podeSair())) return;
        // Só guarda a posição se está saindo do painel (não ao trocar de ficha).
        if (!new URLSearchParams(window.location.search).get('empresa')) F360.scrollPainel = window.scrollY;
        history.pushState({}, '', `?empresa=${encodeURIComponent(codigo)}`);
        F360.rotear();
    },
    async irParaPainel() {
        if (!(await F360.podeSair())) return;
        history.pushState({}, '', window.location.pathname);
        F360.rotear();
    },
    rotear(moverFoco = true) {
        const params = new URLSearchParams(window.location.search);
        const codigo = params.get('empresa');
        document.getElementById('telaPainel').hidden = !!codigo;
        document.getElementById('telaFicha').hidden = !codigo;
        document.getElementById('menuPainel').classList.toggle('ativo', !codigo);
        if (codigo) {
            window.scrollTo(0, 0);
            Ficha360Ficha.abrir(codigo, params.get('aba'));
            const it = F360.carteira.find(i => i.codigo === codigo);
            document.title = `${it ? it.nome : codigo} — Ficha 360`;
        } else {
            Ficha360Painel.render();
            window.scrollTo(0, F360.scrollPainel || 0);
            document.title = 'Ficha 360 do Cliente — Scont';
        }
        // Em SPA o leitor de tela não percebe a troca de tela: leva o foco pro título dela.
        if (moverFoco) {
            const h = document.querySelector(codigo ? '#telaFicha h2' : '#telaPainel h2');
            if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
        }
    },

    // No celular as tabelas viram cartões; cada célula precisa do nome da coluna (data-label)
    // pra mostrar "Vencimento: 10/10/2026" em vez de um valor solto. Feito aqui, uma vez,
    // pra qualquer tabela renderizada em qualquer aba — sem mexer em cada template.
    rotularTabelas(raiz) {
        raiz.querySelectorAll('table.tabela').forEach(tabela => {
            const titulos = [...tabela.querySelectorAll('thead th')].map(th => th.textContent.trim());
            tabela.querySelectorAll('tbody tr').forEach(tr => {
                [...tr.children].forEach((td, idx) => {
                    if (!td.hasAttribute('data-label')) td.setAttribute('data-label', titulos[idx] || '');
                });
            });
        });
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
    window.addEventListener('popstate', () => { F360.sujo = false; F360.rotear(); });
    window.addEventListener('beforeunload', (e) => { if (F360.sujo) { e.preventDefault(); e.returnValue = ''; } });
    const main = document.querySelector('.main');
    new MutationObserver(() => F360.rotularTabelas(main)).observe(main, { childList: true, subtree: true });

    if (await F360.carregar()) F360.rotear(false);
});
