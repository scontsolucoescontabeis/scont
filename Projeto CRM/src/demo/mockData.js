export const mockPerfil = {
  id: 'user-1',
  auth_id: 'auth-1',
  nome: 'Herbert',
  email: 'herbertscont@gmail.com',
  departamento: 'PESSOAL',
  role: 'ADMIN',
  ativo: true,
}

export const mockContatos = [
  { id: 'c1', nome: 'João Silva', telefone: '5561991110001', empresa: 'Empresa ABC Ltda' },
  { id: 'c2', nome: 'Maria Oliveira', telefone: '5561991110002', empresa: 'Comércio XYZ ME' },
  { id: 'c3', nome: 'Carlos Pereira', telefone: '5561991110003', empresa: null },
  { id: 'c4', nome: 'Ana Costa', telefone: '5561991110004', empresa: 'Construtora Delta' },
  { id: 'c5', nome: 'Pedro Mendes', telefone: '5561991110005', empresa: 'Tech Solutions' },
]

export const mockAgentes = [
  { id: 'user-1', nome: 'Herbert', email: 'herbertscont@gmail.com', departamento: 'PESSOAL', role: 'ADMIN', ativo: true },
  { id: 'user-2', nome: 'Fernanda Lima', email: 'fernanda@scont.com.br', departamento: 'CONTABIL', role: 'AGENTE', ativo: true },
  { id: 'user-3', nome: 'Ricardo Souza', email: 'ricardo@scont.com.br', departamento: 'TRIBUTARIO', role: 'AGENTE', ativo: true },
  { id: 'user-4', nome: 'Camila Torres', email: 'camila@scont.com.br', departamento: 'ADMINISTRATIVO', role: 'AGENTE', ativo: true },
  { id: 'user-5', nome: 'Bruno Alves', email: 'bruno@scont.com.br', departamento: 'PESSOAL', role: 'AGENTE', ativo: false },
]

const agora = new Date()
const h = (n) => new Date(agora - n * 60 * 1000).toISOString()

export const mockConversas = [
  {
    id: 'conv-1',
    protocolo: 'SCT-20260603-a1b2c3',
    departamento: 'PESSOAL',
    status: 'EM_ATENDIMENTO',
    nao_lidas: 0,
    criado_em: h(120),
    atualizado_em: h(5),
    agente_id: 'user-1',
    contatos: mockContatos[0],
    agente: mockAgentes[0],
    _ultimaMensagem: { conteudo: 'Obrigado, vou verificar os documentos.' },
  },
  {
    id: 'conv-2',
    protocolo: 'SCT-20260603-d4e5f6',
    departamento: 'CONTABIL',
    status: 'ABERTA',
    nao_lidas: 3,
    criado_em: h(60),
    atualizado_em: h(2),
    agente_id: null,
    contatos: mockContatos[1],
    agente: null,
    _ultimaMensagem: { conteudo: 'Preciso do balancete do mês passado, é urgente!' },
  },
  {
    id: 'conv-3',
    protocolo: 'SCT-20260603-g7h8i9',
    departamento: 'TRIBUTARIO',
    status: 'AGUARDANDO',
    nao_lidas: 1,
    criado_em: h(240),
    atualizado_em: h(30),
    agente_id: 'user-3',
    contatos: mockContatos[2],
    agente: mockAgentes[2],
    _ultimaMensagem: { conteudo: 'Aguardando retorno sobre o IRPJ.' },
  },
  {
    id: 'conv-4',
    protocolo: 'SCT-20260602-j1k2l3',
    departamento: 'ADMINISTRATIVO',
    status: 'ENCERRADA',
    nao_lidas: 0,
    criado_em: h(1440),
    atualizado_em: h(600),
    encerrado_em: h(600),
    agente_id: 'user-4',
    contatos: mockContatos[3],
    agente: mockAgentes[3],
    _ultimaMensagem: { conteudo: 'Atendimento encerrado. Protocolo: SCT-20260602-j1k2l3.' },
  },
  {
    id: 'conv-5',
    protocolo: 'SCT-20260603-m4n5o6',
    departamento: 'PESSOAL',
    status: 'ABERTA',
    nao_lidas: 2,
    criado_em: h(15),
    atualizado_em: h(1),
    agente_id: null,
    contatos: mockContatos[4],
    agente: null,
    _ultimaMensagem: { conteudo: 'Boa tarde! Preciso de ajuda com a rescisão.' },
  },
]

export const mockMensagens = {
  'conv-1': [
    { id: 'm1', conversa_id: 'conv-1', conteudo: 'Olá! Bem-vindo à SCONT Soluções Contábeis. Em breve um de nossos especialistas irá atendê-lo.', tipo: 'text', origem: 'BOT', timestamp: h(120), agente: null },
    { id: 'm2', conversa_id: 'conv-1', conteudo: 'Bom dia! Preciso atualizar minha carteira de trabalho na empresa.', tipo: 'text', origem: 'CLIENTE', timestamp: h(118), agente: null },
    { id: 'm3', conversa_id: 'conv-1', conteudo: 'Bom dia, João! Vou verificar o que precisamos para dar entrada na atualização. Pode me enviar os seus dados de admissão?', tipo: 'text', origem: 'AGENTE', timestamp: h(115), agente: mockAgentes[0] },
    { id: 'm4', conversa_id: 'conv-1', conteudo: 'Fui admitido em 15/03/2024. Meu CPF é 123.456.789-00.', tipo: 'text', origem: 'CLIENTE', timestamp: h(110), agente: null },
    { id: 'm5', conversa_id: 'conv-1', conteudo: 'Perfeito! Já estou acessando o sistema.', tipo: 'text', origem: 'AGENTE', timestamp: h(108), agente: mockAgentes[0] },
    { id: 'm6', conversa_id: 'conv-1', conteudo: 'Obrigado, vou verificar os documentos.', tipo: 'text', origem: 'CLIENTE', timestamp: h(5), agente: null },
  ],
  'conv-2': [
    { id: 'm7', conversa_id: 'conv-2', conteudo: 'Olá! Bem-vindo à SCONT Soluções Contábeis. Em breve um de nossos especialistas irá atendê-lo.', tipo: 'text', origem: 'BOT', timestamp: h(62), agente: null },
    { id: 'm8', conversa_id: 'conv-2', conteudo: 'Boa tarde! Preciso do balancete do mês passado para apresentar ao banco amanhã.', tipo: 'text', origem: 'CLIENTE', timestamp: h(60), agente: null },
    { id: 'm9', conversa_id: 'conv-2', conteudo: 'Olá Maria! Estou acessando o sistema agora para gerar o balancete.', tipo: 'text', origem: 'CLIENTE', timestamp: h(5), agente: null },
    { id: 'm10', conversa_id: 'conv-2', conteudo: 'Preciso do balancete do mês passado, é urgente!', tipo: 'text', origem: 'CLIENTE', timestamp: h(2), agente: null },
  ],
  'conv-5': [
    { id: 'm11', conversa_id: 'conv-5', conteudo: 'Boa tarde! Preciso de ajuda com a rescisão.', tipo: 'text', origem: 'CLIENTE', timestamp: h(15), agente: null },
    { id: 'm12', conversa_id: 'conv-5', conteudo: 'Fui demitido sem justa causa hoje.', tipo: 'text', origem: 'CLIENTE', timestamp: h(1), agente: null },
  ],
}

export const mockAnotacoes = {
  'conv-1': [
    {
      id: 'nota-1',
      conversa_id: 'conv-1',
      conteudo: 'Cliente tem histórico de atraso nos envios de documentos. Cobrar proativamente.',
      timestamp: h(100),
      agente: mockAgentes[0],
    },
  ],
}

export const mockTransferencias = {
  'conv-3': [
    {
      id: 'tr-1',
      conversa_id: 'conv-3',
      de_departamento: 'PESSOAL',
      para_departamento: 'TRIBUTARIO',
      motivo: 'Questão específica de IRPJ — redirecionado para equipe tributária.',
      timestamp: h(200),
      de_agente: mockAgentes[0],
      para_agente: mockAgentes[2],
    },
  ],
}

export const mockTags = [
  { id: 'tag-1', nome: 'Urgente', cor: '#b83232' },
  { id: 'tag-2', nome: 'Aguardando Doc', cor: '#b87a00' },
  { id: 'tag-3', nome: 'Retorno Pendente', cor: '#7a1e1e' },
  { id: 'tag-4', nome: 'Concluído', cor: '#2d7a4f' },
]

export const mockTagsDaConversa = {
  'conv-1': [mockTags[2]],
  'conv-2': [mockTags[0], mockTags[1]],
}

export const mockMetricas = {
  kpi: { abertas: 3, emAtendimento: 2, encerradasHoje: 5 },
  distribuicao: [
    { name: 'PESSOAL', value: 12 },
    { name: 'CONTABIL', value: 8 },
    { name: 'ADMINISTRATIVO', value: 4 },
    { name: 'TRIBUTARIO', value: 6 },
  ],
  volume: [
    { data: '2026-05-28', total: 4 },
    { data: '2026-05-29', total: 7 },
    { data: '2026-05-30', total: 3 },
    { data: '2026-05-31', total: 9 },
    { data: '2026-06-01', total: 6 },
    { data: '2026-06-02', total: 11 },
    { data: '2026-06-03', total: 5 },
  ],
  ranking: [
    { agente: mockAgentes[0], total: 18 },
    { agente: mockAgentes[1], total: 14 },
    { agente: mockAgentes[2], total: 11 },
    { agente: mockAgentes[3], total: 9 },
  ],
}
