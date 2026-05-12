// ============================================
// AUTENTICAÇÃO — Portal SCONT
// Integrado com portal-auth-guard.js
// ============================================

async function checkAuth() {
  try {
    const auth = await window.PortalAuthGuard.init(1);
    if (!auth) return; // guard já redirecionou para login.html

    APP_STATE.currentUser = {
      nome_usuario: auth.userData?.nome || auth.email,
      usuario_email: auth.email,
      usuario_id: auth.userId || null,
      isAdmin: auth.isAdmin === true,
      ativo: true
    };

    hideAuthCheck();
    showApp();
    updateUserUI();
    initializeApp();

  } catch (err) {
    console.error('Erro na verificação de autenticação:', err);
    window.location.replace('../login.html');
  }
}

function hideAuthCheck() {
  const container = q('#authCheckContainer');
  if (container) container.style.display = 'none';
}

function showApp() {
  const app = q('#app');
  if (app) app.style.display = 'flex';
}

function updateUserUI() {
  if (!APP_STATE.currentUser) return;
  const initials = getInitials(APP_STATE.currentUser.nome_usuario);
  if (q('#userAvatar'))  q('#userAvatar').textContent  = initials;
  if (q('#userName'))    q('#userName').textContent    = APP_STATE.currentUser.nome_usuario;
  if (q('#userEmail'))   q('#userEmail').textContent   = APP_STATE.currentUser.usuario_email;
}

async function registrarAcesso() {
  // Funcionalidade de log — implementar conforme necessário
}

async function handleLogout() {
  sessionStorage.removeItem('userAuth');
  try {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    await sb.auth.signOut();
  } catch (e) {}
  window.location.href = '../login.html';
}

function handleBackToPortal() {
  window.location.href = '../portal.html';
}

function setupAuthListeners() {
  q('#logoutItem')?.addEventListener('click', handleLogout);
  q('#backPortalItem')?.addEventListener('click', handleBackToPortal);
}
