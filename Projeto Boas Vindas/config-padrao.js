// Campos personalizáveis da apresentação (tela Configurações do admin).
// Os valores padrão abaixo são os mesmos textos que estão no index.html;
// o que for salvo em apresentacoes_config sobrescreve o padrão.
window.BV_CONFIG_CAMPOS = [
    { grupo: 'Simples Nacional', chave: 'simples.das', rotulo: 'DAS — texto do card (Fiscal)', linhas: 4,
      padrao: 'Guia única que reúne IRPJ, CSLL, PIS, COFINS, ISS/ICMS e a contribuição patronal previdenciária (CPP). Vencimento: todo dia 20 de cada mês. A alíquota depende do anexo e da faixa de receita bruta acumulada dos últimos 12 meses.' },
    { grupo: 'Simples Nacional', chave: 'simples.nfse', rotulo: 'Regra da NFS-e (Fiscal)', linhas: 3,
      padrao: 'Como optante pelo Simples Nacional, observe o limite de receita bruta e o sublimite estadual, e confira a retenção de ISS e INSS em serviços prestados a pessoas jurídicas.' },
    { grupo: 'Simples Nacional', chave: 'simples.inss', rotulo: 'INSS — alíquota na tabela (Pessoal)', linhas: 3,
      padrao: 'Contribuição patronal incluída no DAS (Anexos I, II, III e V); apenas a retenção do empregado (8% a 14%) é recolhida na folha. Anexo IV: 20% + RAT + terceiros' },

    { grupo: 'Lucro Presumido / Lucro Real', chave: 'presumido.iss', rotulo: 'ISS (Fiscal)', linhas: 2,
      padrao: 'Vencimento: todo dia 20 de cada mês' },
    { grupo: 'Lucro Presumido / Lucro Real', chave: 'presumido.pis_cofins', rotulo: 'PIS e COFINS (Fiscal)', linhas: 2,
      padrao: 'Vencimento: todo dia 20 de cada mês' },
    { grupo: 'Lucro Presumido / Lucro Real', chave: 'presumido.irpj_csll', rotulo: 'IRPJ e CSLL (Fiscal)', linhas: 2,
      padrao: 'Vencimento: último dia útil de abril, julho, outubro e janeiro' },
    { grupo: 'Lucro Presumido / Lucro Real', chave: 'presumido.nfse', rotulo: 'Regra da NFS-e (Fiscal)', linhas: 3,
      padrao: 'Como optante pelo Lucro Presumido, retenha IRPJ e CSLL de prestadores como advocacia, arquitetura, contabilidade e segurança.' },
    { grupo: 'Lucro Presumido / Lucro Real', chave: 'presumido.inss', rotulo: 'INSS — alíquota na tabela (Pessoal)', linhas: 2,
      padrao: '28,8% sobre o salário' },

    { grupo: 'Empresa nova', chave: 'nova.balanco', rotulo: 'Balanço de Abertura (Contábil)', linhas: 4,
      padrao: 'Por se tratar de empresa nova, a Scont realizará o balanço de abertura — registro inicial do capital social e dos bens, direitos e obrigações com que a empresa inicia suas atividades.' },
    { grupo: 'Vem de outra contabilidade', chave: 'outra.balanco', rotulo: 'Balanço de Abertura (Contábil)', linhas: 4,
      padrao: 'Estamos aguardando os saldos finais da contabilidade anterior para proceder com a auditoria e o balanço de abertura — inventário físico e documental dos bens, direitos e obrigações da empresa.' }
];
