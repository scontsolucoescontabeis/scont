// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================

// SUPABASE_URL e SUPABASE_KEY carregados de ../supabase-config.js via index.html

const TABLE_NAMES = {
  CERTIFICADOS: "certificados",
  EMPRESAS: "empresas",
  TIPOS: "tipos_certificados",
  AUTORIDADES: "autoridades_certificadoras",
  HISTORICO: "historico_certificados",
  ALERTAS: "alertas",
  AGENDA: "agenda",
  LOGS: "logs_auditoria",
  INTEGRACAO: "integracao_portal",
  NOTIFICACOES: "notificacoes",
  RELATORIOS: "relatorios_salvos",
  CONFIG: "configuracoes_certificados"
};

const BUCKET_NAMES = {
  CERTIFICADOS: "certificados"
};

// Inicializar Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// CONSTANTES DA APLICAÇÃO
// ============================================

const SITUACOES_CERTIFICADO = [
  'Ativo',
  'Agendado',
  'Renovado',
  'Aguardando Contato',
  'Vencido'
];

const TIPOS_CERTIFICADO = [
  'A1',
  'A3',
  'e-CNPJ',
  'e-CPF'
];

const SEVERIDADES_ALERTA = [
  'critical',
  'urgent',
  'caution',
  'warning',
  'info'
];

const PAGE_MAP = {
  dashboard: ['Dashboard', 'Visão geral operacional da carteira'],
  certificados: ['Certificados', 'Gestão, filtros, paginação e ações rápidas'],
  relatorios: ['Relatórios', 'Análise avançada com múltiplos filtros'],
  agenda: ['Agenda', 'Compromissos e renovações'],
  historico: ['Histórico', 'Linha do tempo de alterações'],
  seguranca: ['Segurança', 'Criptografia local e senha mestra'],
  configuracoes: ['Configurações', 'Preferências visuais e parâmetros operacionais']
};

// ============================================
// ESTADO GLOBAL
// ============================================

const APP_STATE = {
  currentUser: null,
  currentSession: null,
  certificates: [],
  historyLog: [],
  currentPage: 1,
  pageSize: 10,
  sortKey: 'data_vencimento',
  sortDir: 'asc',
  isConnected: false,
  isDarkMode: localStorage.getItem('theme') === 'dark'
};

// ============================================
// CONFIGURAÇÕES DE VALIDAÇÃO
// ============================================

const VALIDATION_RULES = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  cnpj: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  password: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  }
};

// ============================================
// CONFIGURAÇÕES DE ALERTAS
// ============================================

const ALERT_CONFIG = {
  dias_critico: 7,
  dias_urgente: 15,
  dias_caution: 30
};