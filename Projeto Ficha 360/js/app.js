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

    // Ícones SVG inline (traço único, herdam a cor do texto). Substituem os emojis, que mudam por sistema.
    ICONES: {
        atualizar: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
        filtros: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h9M17 18h3"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
        pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/>',
        estrela: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
        fixar: '<path d="M12 17v5M8 3h8l-1 7 3 3v2H6v-2l3-3z"/>',
        aviso: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
        cadeado: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
        ok: '<path d="M4 12.5 9.5 18 20 6"/>',
        config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
        voltar: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    },
    ico(nome) {
        return `<svg class="ico" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${F360.ICONES[nome] || ''}</svg>`;
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
