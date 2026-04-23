// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================

function initializeApp() {
  setupAuthListeners();  // ← Adicionar esta linha
  setupAppListeners();
  setPage('dashboard');
  fetchCertificates();
  applyTheme(APP_STATE.isDarkMode);
}

// ============================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ============================================

function initializeApp() {
  setupAppListeners();
  setPage('dashboard');
  fetchCertificates();
  applyTheme(APP_STATE.isDarkMode);
}

// ============================================
// NAVEGAÇÃO
// ============================================

function setPage(pageName) {
  qa('.page').forEach(p => p.classList.remove('active'));
  q(`#page-${pageName}`)?.classList.add('active');
  
  const [title, subtitle] = PAGE_MAP[pageName] || ['', ''];
  q('#pageTitle').textContent = title;
  q('#pageSubtitle').textContent = subtitle;

  qa('.nav button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === pageName);
  });

  if (pageName === 'certificados') fetchCertificates();
}

function toggleSidebar() {
  q('#sidebar').classList.toggle('collapsed');
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  const label = q('#themeLabel');
  if (label) {
    label.textContent = isDark ? '☀️ Tema escuro' : '🌙 Tema claro';
  }
  setLocalStorage('theme', isDark ? 'dark' : 'light');
}

// ============================================
// RENDERIZAÇÃO - DASHBOARD
// ============================================

function renderDashboard() {
  const today = getCurrentDate();
  const total = APP_STATE.certificates.length;
  const active = APP_STATE.certificates.filter(c => c.situacao === 'Ativo').length;
  const expired = APP_STATE.certificates.filter(c => {
    const days = daysLeft(c.data_vencimento);
    return days !== null && days < 0;
  }).length;
  const upcoming = APP_STATE.certificates.filter(c => {
    const days = daysLeft(c.data_vencimento);
    return days !== null && days >= 0 && days <= 30;
  }).length;

  const cardsHTML = `
    <div class="card">
      <div class="card-label">Total de Certificados</div>
      <div class="card-value">${total}</div>
      <div class="card-meta">Carteira completa</div>
    </div>
    <div class="card success">
      <div class="card-label">Certificados Ativos</div>
      <div class="card-value">${active}</div>
      <div class="card-meta">${total > 0 ? ((active/total)*100).toFixed(0) : 0}% da carteira</div>
    </div>
    <div class="card critical">
      <div class="card-label">Vencidos</div>
      <div class="card-value">${expired}</div>
      <div class="card-meta">Requer ação imediata</div>
    </div>
    <div class="card warning">
      <div class="card-label">Vencimento Próximo</div>
      <div class="card-value">${upcoming}</div>
      <div class="card-meta">Próximos 30 dias</div>
    </div>
  `;
  q('#cards').innerHTML = cardsHTML;

  // Alertas críticos
  const alerts = APP_STATE.certificates
    .filter(c => {
      const days = daysLeft(c.data_vencimento);
      return days !== null && days <= 30;
    })
    .sort((a, b) => daysLeft(a.data_vencimento) - daysLeft(b.data_vencimento))
    .slice(0, 5);

  const alertsHTML = alerts.map(c => `
    <tr>
      <td><strong>${c.empresa_id}</strong></td>
      <td>${fmt(c.data_vencimento)}</td>
      <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao}</span></td>
      <td>${daysLeft(c.data_vencimento)} dias</td>
    </tr>
  `).join('');
  q('#alertsTable').innerHTML = alertsHTML || '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Nenhum alerta crítico</td></tr>';

  // Agenda rápida
  const agendaHTML = APP_STATE.certificates
    .filter(c => c.data_renovacao_agendada)
    .slice(0, 5)
    .map(c => `
      <tr>
        <td><strong>${c.empresa_id}</strong></td>
        <td>${fmt(c.data_renovacao_agendada)}</td>
        <td><span class="badge badge-info">${c.situacao}</span></td>
      </tr>
    `).join('');
  q('#agendaTable').innerHTML = agendaHTML || '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Nenhum agendamento</td></tr>';

  // Timeline
  const timelineHTML = APP_STATE.historyLog.slice(0, 5).map(log => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-time">${fmt(log.data_alteracao)}</div>
        <div class="timeline-title">${log.tipo_alteracao}</div>
      </div>
    </div>
  `).join('');
  q('#timeline').innerHTML = timelineHTML || '<div style="color: var(--text-muted); text-align: center;">Nenhuma atividade registrada</div>';
}

// ============================================
// RENDERIZAÇÃO - CERTIFICADOS
// ============================================

function renderCertTable() {
  const start = (APP_STATE.currentPage - 1) * APP_STATE.pageSize;
  const end = start + APP_STATE.pageSize;
  const paginated = APP_STATE.certificates.slice(start, end);

  const html = paginated.map(c => `
    <tr>
      <td><strong>${c.empresa_id}</strong></td>
      <td>${c.tipo_id}</td>
      <td>${fmt(c.data_vencimento)}</td>
      <td>${fmt(c.data_emissao)}</td>
      <td><span class="badge ${badgeClass(c.situacao)}">${c.situacao}</span></td>
      <td>${c.responsavel_nome || '-'}</td>
      <td>
        <button class="btn btn-ghost" onclick="openDetails('${c.id}')" style="padding: 6px 12px; font-size: 12px;">Ver</button>
        <button class="btn btn-ghost" onclick="removeCert('${c.id}')" style="padding: 6px 12px; font-size: 12px; color: var(--danger);">Excluir</button>
      </td>
    </tr>
  `).join('');

  q('#certTable').innerHTML = html || '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Nenhum certificado encontrado</td></tr>';

  const totalPages = Math.ceil(APP_STATE.certificates.length / APP_STATE.pageSize);
  q('#currentPage').textContent = APP_STATE.currentPage;
  q('#totalPages').textContent = totalPages;
  q('#totalRecords').textContent = APP_STATE.certificates.length;

  q('#prevPage').disabled = APP_STATE.currentPage === 1;
  q('#nextPage').disabled = APP_STATE.currentPage === totalPages;
}

// ============================================
// MODAIS
// ============================================

function openCertModal(id = null) {
  const modal = q('#certModal');
  const form = q('#certForm');
  
  if (id) {
    const cert = APP_STATE.certificates.find(c => c.id === id);
    if (cert) {
      q('#certModalTitle').textContent = 'Editar certificado';
      q('#certId').value = cert.id;
      q('#empresa').value = cert.empresa_id;
      q('#cpfcnpj').value = cert.cpf_cnpj || '';
      q('#tipo').value = cert.tipo_id;
      q('#autoridade').value = cert.autoridade_id || '';
      q('#emissao').value = toISODate(cert.data_emissao);
      q('#vencimento').value = toISODate(cert.data_vencimento);
      q('#senha').value = cert.senha_hash || '';
      q('#situacao').value = cert.situacao;
      q('#agendamento').value = toISODate(cert.data_renovacao_agendada);
      q('#responsavel').value = cert.responsavel_nome || '';
      q('#email').value = cert.responsavel_email || '';
      q('#telefone').value = cert.responsavel_telefone || '';
      q('#info').value = cert.informacoes_adicionais || '';
      q('#risco').value = cert.observacao_risco || '';
    }
  } else {
    q('#certModalTitle').textContent = 'Novo certificado';
    form.reset();
    q('#certId').value = '';
  }
  
  modal.classList.add('active');
}

function closeCertModal() {
  q('#certModal').classList.remove('active');
}

function openDetails(id) {
  const cert = APP_STATE.certificates.find(c => c.id === id);
  if (!cert) return;

  const detailsHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div>
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Empresa</div>
        <div style="font-size: 14px; font-weight: 600;">${cert.empresa_id}</div>
      </div>
      <div>
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Tipo</div>
        <div style="font-size: 14px; font-weight: 600;">${cert.tipo_id}</div>
      </div>
      <div>
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Vencimento</div>
        <div style="font-size: 14px; font-weight: 600;">${fmt(cert.data_vencimento)}</div>
      </div>
      <div>
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Situação</div>
        <div style="font-size: 14px; font-weight: 600;"><span class="badge ${badgeClass(cert.situacao)}">${cert.situacao}</span></div>
      </div>
      <div>
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">Responsável</div>
        <div style="font-size: 14px; font-weight: 600;">${cert.responsavel_nome || '-'}</div>
      </div>
    </div>
  `;
  q('#detailsContent').innerHTML = detailsHTML;
  q('#detailsModal').classList.add('active');
}

function closeDetailsModal() {
  q('#detailsModal').classList.remove('active');
}

// ============================================
// SUPABASE - CRUD
// ============================================

async function fetchCertificates() {
  try {
    updateConnectionStatus(false);
    const { data, error } = await supabaseClient
      .from(TABLE_NAMES.CERTIFICADOS)
      .select('*');
    
    if (error) throw error;
    
    APP_STATE.certificates = data || [];
    updateConnectionStatus(true);
    renderCertTable();
    renderDashboard();
  } catch (err) {
    console.error('Erro ao buscar certificados:', err);
    updateConnectionStatus(false);
  }
}

async function saveCertificate(formData) {
  try {
    const id = formData.get('certId');
    const cert = {
      empresa_id: formData.get('empresa'),
      cpf_cnpj: formData.get('cpfcnpj'),
      tipo_id: formData.get('tipo'),
      autoridade_id: formData.get('autoridade'),
      data_emissao: formData.get('emissao'),
      data_vencimento: formData.get('vencimento'),
      senha_hash: formData.get('senha'),
      situacao: formData.get('situacao'),
      data_renovacao_agendada: formData.get('agendamento'),
      responsavel_nome: formData.get('responsavel'),
      responsavel_email: formData.get('email'),
      responsavel_telefone: formData.get('telefone'),
      informacoes_adicionais: formData.get('info'),
      observacao_risco: formData.get('risco'),
      atualizado_por: APP_STATE.currentUser?.usuario_id
    };

    if (id) {
      const { error } = await supabaseClient
        .from(TABLE_NAMES.CERTIFICADOS)
        .update(cert)
        .eq('id', id);
      if (error) throw error;
    } else {
      cert.criado_por = APP_STATE.currentUser?.usuario_id;
      const { error } = await supabaseClient
        .from(TABLE_NAMES.CERTIFICADOS)
        .insert([cert]);
      if (error) throw error;
    }

    closeCertModal();
    await fetchCertificates();
    showSuccess('loginSuccess', 'Certificado salvo com sucesso!');
  } catch (err) {
    showError('loginError', 'Erro ao salvar: ' + err.message);
  }
}

async function removeCert(id) {
  if (!confirm('Tem certeza que deseja excluir este certificado?')) return;
  try {
    const { error } = await supabaseClient
      .from(TABLE_NAMES.CERTIFICADOS)
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchCertificates();
  } catch (err) {
    showError('loginError', 'Erro ao excluir: ' + err.message);
  }
}

function updateConnectionStatus(connected) {
  APP_STATE.isConnected = connected;
  const badge = q('#statusConnection .status-badge');
  if (badge) {
    badge.className = 'status-badge ' + (connected ? 'connected' : 'disconnected');
    badge.textContent = (connected ? '🟢 Conectado' : '⚫ Desconectado');
  }
}

// ============================================
// EVENT LISTENERS - APLICAÇÃO
// ============================================

function setupAppListeners() {
  // Navegação
  qa('.nav button').forEach(btn => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  // Sidebar
  q('#sidebarCollapseBtn')?.addEventListener('click', toggleSidebar);
  q('#themeLabel')?.addEventListener('click', () => {
    APP_STATE.isDarkMode = !APP_STATE.isDarkMode;
    applyTheme(APP_STATE.isDarkMode);
  });

  // Certificados
  q('#btnNewCert')?.addEventListener('click', () => openCertModal());
  q('#closeCertModal')?.addEventListener('click', closeCertModal);
  q('#cancelCertForm')?.addEventListener('click', closeCertModal);
  q('#certForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveCertificate(new FormData(q('#certForm')));
  });

  // Filtros
  q('#btnFilterCert')?.addEventListener('click', () => {
    const empresa = q('#filterEmpresa').value.toLowerCase();
    const tipo = q('#filterTipo').value;
    const situacao = q('#filterSituacao').value;

    APP_STATE.certificates = APP_STATE.certificates.filter(c => 
      (!empresa || c.empresa_id.toLowerCase().includes(empresa)) &&
      (!tipo || c.tipo_id === tipo) &&
      (!situacao || c.situacao === situacao)
    );
    APP_STATE.currentPage = 1;
    renderCertTable();
  });

  q('#btnClearFilter')?.addEventListener('click', () => {
    q('#filterEmpresa').value = '';
    q('#filterTipo').value = '';
    q('#filterSituacao').value = '';
    fetchCertificates();
  });

  // Paginação
  q('#prevPage')?.addEventListener('click', () => {
    if (APP_STATE.currentPage > 1) {
      APP_STATE.currentPage--;
      renderCertTable();
    }
  });

  q('#nextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil(APP_STATE.certificates.length / APP_STATE.pageSize);
    if (APP_STATE.currentPage < totalPages) {
      APP_STATE.currentPage++;
      renderCertTable();
    }
  });

  // Detalhes
  q('#closeDetailsModal')?.addEventListener('click', closeDetailsModal);

  // Menu do usuário
  q('#userMenuBtn')?.addEventListener('click', () => {
    q('#userDropdown').classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
      q('#userDropdown')?.classList.remove('active');
    }
  });

  // Logout
  q('#logoutItem')?.addEventListener('click', handleLogout);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupAuthListeners();
  checkAuth();
});

// Verificar autenticação periodicamente (a cada 5 minutos)
setInterval(checkAuth, 5 * 60 * 1000);

// Expor funções globais
window.openDetails = openDetails;
window.openCertModal = openCertModal;
window.removeCert = removeCert;










