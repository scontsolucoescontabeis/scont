// ============================================
// 🔐 AUTH GUARD - PROTEÇÃO DE ROTAS
// ============================================

/**
 * Sistema centralizado de autenticação e proteção de rotas
 * Deve ser incluído em TODAS as aplicações do portal
 * <script src="js/auth-guard.js"></script>
 */

class AuthGuard {
    constructor(options = {}) {
        this.portalUrl = options.portalUrl || 'portal.html';
        this.requiredTool = options.requiredTool || null;
        this.redirectDelay = options.redirectDelay || 2000;
        this.debug = options.debug || false;
        
        // Inicializar verificação
        this.init();
    }

    /**
     * Inicializar o guard
     */
    init() {
        this.log('🔐 AuthGuard inicializado');
        
        // Verificar autenticação ao carregar
        if (!this.isAuthenticated()) {
            this.handleUnauthorized();
            return;
        }

        // Se requer ferramenta específica, verificar acesso
        if (this.requiredTool && !this.hasToolAccess()) {
            this.handleForbidden();
            return;
        }

        this.log('✅ Autenticação válida');
        this.setupLogoutListener();
    }

    /**
     * Verificar se usuário está autenticado
     */
    isAuthenticated() {
        const userAuth = sessionStorage.getItem('userAuth');
        
        if (!userAuth) {
            this.log('❌ Sem autenticação');
            return false;
        }

        try {
            const user = JSON.parse(userAuth);
            
            // Validar estrutura mínima
            if (!user.email || !user.token) {
                this.log('❌ Autenticação inválida');
                return false;
            }

            this.currentUser = user;
            return true;
        } catch (err) {
            this.log('❌ Erro ao parsear autenticação:', err);
            return false;
        }
    }

    /**
     * Verificar se usuário tem acesso à ferramenta
     */
    hasToolAccess() {
        if (!this.requiredTool) return true;

        const ferramentas = this.currentUser?.ferramentas || [];
        const hasAccess = ferramentas.includes(this.requiredTool);

        this.log(`Verificando acesso a '${this.requiredTool}': ${hasAccess ? '✅' : '❌'}`);
        return hasAccess;
    }

    /**
     * Lidar com acesso não autorizado (sem autenticação)
     */
    handleUnauthorized() {
        this.log('🚫 Acesso não autorizado - redirecionando para portal');
        
        // Mostrar modal de aviso
        this.showModal({
            title: '🔒 Acesso Restrito',
            message: 'Você precisa estar autenticado para acessar esta ferramenta.',
            subtitle: 'Você será redirecionado para o portal de solicitação de acesso.',
            icon: '🔐',
            type: 'unauthorized'
        });

        // Redirecionar após delay
        setTimeout(() => {
            this.redirectToPortal('unauthorized');
        }, this.redirectDelay);
    }

    /**
     * Lidar com acesso proibido (sem permissão para ferramenta)
     */
    handleForbidden() {
        this.log(`🚫 Acesso proibido à ferramenta '${this.requiredTool}'`);
        
        // Mostrar modal de aviso
        this.showModal({
            title: '⛔ Acesso Negado',
            message: `Você não tem permissão para acessar esta ferramenta (${this.requiredTool}).`,
            subtitle: 'Solicite acesso ao administrador do sistema.',
            icon: '⛔',
            type: 'forbidden'
        });

        // Redirecionar após delay
        setTimeout(() => {
            this.redirectToPortal('forbidden');
        }, this.redirectDelay);
    }

    /**
     * Redirecionar para portal
     */
    redirectToPortal(reason = 'default') {
        const params = new URLSearchParams({
            redirect: window.location.href,
            reason: reason,
            timestamp: new Date().toISOString()
        });

        window.location.href = `${this.portalUrl}?${params.toString()}`;
    }

    /**
     * Mostrar modal de aviso
     */
    showModal(options) {
        const { title, message, subtitle, icon, type } = options;

        // Criar overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(5px);
        `;

        // Criar modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
            animation: slideUp 0.3s ease-out;
        `;

        // Cores por tipo
        const colors = {
            unauthorized: '#3498DB',
            forbidden: '#E74C3C'
        };

        const color = colors[type] || '#3498DB';

        modal.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 16px;">${icon}</div>
            <h2 style="font-size: 22px; font-weight: 700; color: #2C3E50; margin-bottom: 12px;">
                ${title}
            </h2>
            <p style="font-size: 14px; color: #7F8C8D; margin-bottom: 8px;">
                ${message}
            </p>
            <p style="font-size: 12px; color: #95A5A6; margin-bottom: 24px;">
                ${subtitle}
            </p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #7F8C8D; font-size: 13px;">
                <span style="display: inline-block; width: 8px; height: 8px; background: ${color}; border-radius: 50%; animation: pulse 1.5s infinite;"></span>
                Redirecionando em alguns instantes...
            </div>
        `;

        // Adicionar estilos de animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
        `;

        document.head.appendChild(style);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    /**
     * Configurar listener de logout
     */
    setupLogoutListener() {
        // Monitorar mudanças no sessionStorage
        window.addEventListener('storage', (e) => {
            if (e.key === 'userAuth' && !e.newValue) {
                this.log('🚪 Logout detectado - redirecionando');
                this.redirectToPortal('logout');
            }
        });

        // Monitorar inatividade (opcional)
        this.setupInactivityTimer();
    }

    /**
     * Timer de inatividade (30 minutos)
     */
    setupInactivityTimer() {
        let inactivityTimer;
        const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                this.log('⏱️ Sessão expirada por inatividade');
                sessionStorage.removeItem('userAuth');
                this.redirectToPortal('timeout');
            }, INACTIVITY_TIMEOUT);
        };

        // Resetar timer em atividades do usuário
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        resetTimer();
    }

    /**
     * Log com debug
     */
    log(...args) {
        if (this.debug) {
            console.log('[AuthGuard]', ...args);
        }
    }

    /**
     * Obter usuário atual
     */
    getCurrentUser() {
        return this.currentUser || null;
    }

    /**
     * Fazer logout
     */
    logout() {
        sessionStorage.removeItem('userAuth');
        localStorage.removeItem('authToken');
        this.redirectToPortal('manual-logout');
    }
}

// ============================================
// INICIALIZAÇÃO AUTOMÁTICA
// ============================================

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.authGuard = new AuthGuard({
            debug: false // Mudar para true para ver logs
        });
    });
} else {
    window.authGuard = new AuthGuard({
        debug: false
    });
}

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthGuard;
}