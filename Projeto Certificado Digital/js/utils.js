// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

// Seletores DOM
const q = (sel) => document.querySelector(sel);
const qa = (sel) => document.querySelectorAll(sel);

// ============================================
// FORMATAÇÃO DE DADOS
// ============================================

function toISODate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return date.toISOString().split('T')[0];
}

function fmt(date, format = 'DD/MM/YYYY') {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return format.replace('DD', day).replace('MM', month).replace('YYYY', year);
}

function toISODateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  const appToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(dateStr);
  const diff = target - appToday;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function statusVisual(days) {
  if (days === null) return '⚪ Sem data';
  if (days < 0) return '🔴 Vencido';
  if (days <= 7) return '🔴 Crítico';
  if (days <= 15) return '🟠 Urgente';
  if (days <= 30) return '🟡 Atenção';
  return '🟢 Normal';
}

function badgeClass(status) {
  const map = {
    'Ativo': 'badge-success',
    'Vencido': 'badge-danger',
    'Agendado': 'badge-info',
    'Renovado': 'badge-success',
    'Aguardando Contato': 'badge-warning'
  };
  return map[status] || 'badge-info';
}

function getInitials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================
// VALIDAÇÃO
// ============================================

function validateEmail(email) {
  return VALIDATION_RULES.email.test(email);
}

function validatePassword(password) {
  return password.length >= VALIDATION_RULES.password.minLength;
}

function validateCPF(cpf) {
  return VALIDATION_RULES.cpf.test(cpf);
}

function validateCNPJ(cnpj) {
  return VALIDATION_RULES.cnpj.test(cnpj);
}

// ============================================
// SISTEMA DE TOASTS
// ============================================

function showToast(message, type = 'success', duration = 4000) {
  let container = q('#toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

function showError(elementId, message) { showToast(message, 'error'); }
function showSuccess(elementId, message) { showToast(message, 'success'); }

// ============================================
// CRIPTOGRAFIA
// ============================================

function hashPassword(password) {
  // Implementação simplificada - em produção, usar bcrypt no backend
  return btoa(password);
}

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// ============================================
// UTILITÁRIOS DE REDE
// ============================================

async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

// ============================================
// ARMAZENAMENTO LOCAL
// ============================================

function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Erro ao salvar no localStorage:', err);
  }
}

function getLocalStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (err) {
    console.error('Erro ao ler do localStorage:', err);
    return null;
  }
}

function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Erro ao remover do localStorage:', err);
  }
}

// ============================================
// UTILITÁRIOS DE DATA
// ============================================

function getCurrentDate() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDaysDifference(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2 - date1) / oneDay);
}