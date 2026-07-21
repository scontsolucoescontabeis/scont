/**
 * SCONT — Onboarding Contábil
 * Catálogo do checklist de balanço inicial, restrito a itens de natureza
 * contábil. Premissa: os onboardings fiscal e de departamento pessoal já
 * foram feitos separadamente, então itens desses domínios (acessos a
 * portais fiscais, declarações/apurações fiscais por regime, dados de
 * empregados) não entram aqui — só o que a equipe contábil precisa para
 * montar o balanço de abertura.
 *
 * Cada seção pode ter `condicaoSecao` (a seção inteira só é gerada se a
 * condição bater). Cada item pode ter `condicao` (o item só é gerado se a
 * condição bater); itens sem `condicao` são sempre gerados quando a seção
 * está ativa — a equipe marca "não aplicável" manualmente quando não há um
 * gatilho binário claro para aquele item.
 */
(function () {
  'use strict';

  function bate(condicao, respostas) {
    if (!condicao) return true;
    const valorAtual = respostas[condicao.campo];
    if (condicao.valores) return condicao.valores.includes(valorAtual);
    return valorAtual === condicao.valor;
  }

  const CATALOGO = [
    {
      secao: 'A',
      titulo: 'Seção A — Dados cadastrais e societários',
      itens: [
        { codigo: 'A1', texto: 'Cartão CNPJ atualizado (Comprovante de Inscrição e Situação Cadastral)', exigencia: 'obrigatorio' },
        { codigo: 'A2', texto: 'Contrato social / estatuto e todas as alterações consolidadas', exigencia: 'obrigatorio' },
        { codigo: 'A4', texto: 'Documentos dos sócios (RG/CPF ou CNH) e percentuais de participação', exigencia: 'obrigatorio' },
        { codigo: 'A5', texto: 'Comprovante de endereço da sede', exigencia: 'obrigatorio' },
        { codigo: 'A7', texto: 'Certificado digital e-CNPJ vigente (tipo e validade)', exigencia: 'obrigatorio', observacao: 'Anotar vencimento' },
        { codigo: 'A8', texto: 'Dados de contato dos responsáveis (financeiro, fiscal, RH)', exigencia: 'obrigatorio' },
        { codigo: 'A9', texto: 'Identificação da contabilidade anterior (nome, CRC, contato)', exigencia: 'condicional', observacao: 'Se houver escrituração anterior', condicao: { campo: 'tem_contabilidade_anterior', valor: true } },
      ],
    },
    {
      secao: 'B',
      titulo: 'Seção B — Acessos, procurações e credenciais',
      itens: [
        { codigo: 'B1', texto: 'Procuração eletrônica e-CAC em favor da SCONT', exigencia: 'obrigatorio' },
        { codigo: 'B7', texto: 'Acessos bancários para extratos (internet banking, open finance ou envio periódico)', exigencia: 'obrigatorio' },
      ],
    },
    {
      secao: 'C1',
      titulo: 'Seção C.1 — Com escrituração contábil anterior',
      condicaoSecao: { campo: 'tem_contabilidade_anterior', valor: true },
      itens: [
        { codigo: 'C1-1', texto: 'Balancete analítico completo na data de corte', exigencia: 'obrigatorio', observacao: 'Base principal da abertura' },
        { codigo: 'C1-2', texto: 'Balanço patrimonial e DRE do último exercício encerrado', exigencia: 'obrigatorio' },
        { codigo: 'C1-3', texto: 'ECD (SPED Contábil) transmitida do último exercício', exigencia: 'obrigatorio', observacao: 'Arquivo .txt ou recibo' },
        { codigo: 'C1-4', texto: 'Razão contábil das contas patrimoniais relevantes', exigencia: 'obrigatorio', observacao: 'Clientes, fornecedores, empréstimos, tributos' },
        { codigo: 'C1-5', texto: 'Composição analítica de saldos: clientes / contas a receber', exigencia: 'obrigatorio', observacao: 'Relatório por cliente/título' },
        { codigo: 'C1-6', texto: 'Composição analítica de saldos: fornecedores / contas a pagar', exigencia: 'obrigatorio', observacao: 'Relatório por fornecedor/título' },
        { codigo: 'C1-7', texto: 'Controle de imobilizado com custo, depreciação acumulada e taxas', exigencia: 'obrigatorio' },
        { codigo: 'C1-8', texto: 'Inventário de estoques valorizado na data de corte', exigencia: 'condicional', observacao: 'Se houver estoques', condicao: { campo: 'tem_estoque', valor: true } },
        { codigo: 'C1-9', texto: 'Composição de tributos a recolher e a recuperar', exigencia: 'obrigatorio', observacao: 'Por tributo e competência' },
        { codigo: 'C1-10', texto: 'Contratos e saldos devedores de empréstimos e financiamentos', exigencia: 'condicional', observacao: 'Se houver', condicao: { campo: 'tem_emprestimos', valor: true } },
        { codigo: 'C1-11', texto: 'Plano de contas utilizado pela contabilidade anterior', exigencia: 'obrigatorio', observacao: 'Insumo do de-para' },
      ],
    },
    {
      secao: 'C2',
      titulo: 'Seção C.2 — Sem escrituração contábil anterior',
      condicaoSecao: { campo: 'tem_contabilidade_anterior', valor: false },
      itens: [
        { codigo: 'C2-1', texto: 'Extratos bancários de todas as contas na data de corte', exigencia: 'obrigatorio' },
        { codigo: 'C2-2', texto: 'Relação de bens e direitos com documentos de aquisição (notas fiscais)', exigencia: 'obrigatorio' },
        { codigo: 'C2-3', texto: 'Relação de dívidas e obrigações com comprovantes', exigencia: 'obrigatorio' },
        { codigo: 'C2-4', texto: 'Comprovantes de integralização do capital social', exigencia: 'obrigatorio' },
        { codigo: 'C2-5', texto: 'Relação de valores a receber e a pagar (controles gerenciais)', exigencia: 'condicional', observacao: 'Planilhas, sistemas de gestão' },
        { codigo: 'C2-6', texto: 'Inventário físico de estoques valorizado', exigencia: 'condicional', observacao: 'Se houver estoques', condicao: { campo: 'tem_estoque', valor: true } },
      ],
    },
    {
      secao: 'D',
      titulo: 'Seção D — Financeiro e bancos',
      itens: [
        { codigo: 'D1', texto: 'Relação de todas as contas bancárias ativas (banco, agência, conta)', exigencia: 'obrigatorio' },
        { codigo: 'D2', texto: 'Extratos bancários com saldo na data de corte', exigencia: 'obrigatorio', observacao: 'Todas as contas' },
        { codigo: 'D3', texto: 'Extratos de aplicações financeiras na data de corte', exigencia: 'condicional', observacao: 'Se houver' },
        { codigo: 'D4', texto: 'Contratos de empréstimos/financiamentos com planilha de amortização', exigencia: 'condicional', observacao: 'Se houver', condicao: { campo: 'tem_emprestimos', valor: true } },
        { codigo: 'D5', texto: 'Relação de cartões de crédito corporativos e faturas em aberto', exigencia: 'condicional', observacao: 'Se houver' },
        { codigo: 'D6', texto: 'Saldo de caixa físico declarado pelo responsável', exigencia: 'condicional', observacao: 'Se a empresa operar caixa' },
      ],
    },
    {
      secao: 'G',
      titulo: 'Seção G — Informações complementares',
      itens: [
        { codigo: 'G1', texto: 'Processos judiciais e contingências (trabalhistas, cíveis, tributárias)', exigencia: 'condicional', observacao: 'Para provisões/notas' },
        { codigo: 'G2', texto: 'Parcelamentos tributários ativos (federais, estaduais, municipais)', exigencia: 'condicional', observacao: 'Extratos consolidados' },
        { codigo: 'G3', texto: 'Contratos relevantes vigentes (aluguel, leasing, fornecimento)', exigencia: 'condicional', observacao: 'Se houver' },
        { codigo: 'G4', texto: 'Adiantamentos a sócios / de sócios (mútuos)', exigencia: 'condicional', observacao: 'Contratos e saldos' },
        { codigo: 'G5', texto: 'Distribuição de lucros pendente de pagamento', exigencia: 'condicional', observacao: 'Se houver' },
        { codigo: 'G6', texto: 'Provisões de férias e 13º salário na data de corte', exigencia: 'condicional', observacao: 'Com encargos; insumo do DP', condicao: { campo: 'tem_empregados', valor: true } },
        { codigo: 'G7', texto: 'Pró-labore: valores e sócios contemplados', exigencia: 'obrigatorio' },
      ],
    },
    {
      secao: 'H',
      titulo: 'Seção H — Validações internas SCONT (uso interno)',
      interna: true,
      itens: [
        { codigo: 'H1', texto: 'De-para do plano de contas anterior para o plano SCONT concluído e revisado', exigencia: 'obrigatorio' },
        { codigo: 'H2', texto: 'Equação patrimonial conferida (Ativo = Passivo + PL)', exigencia: 'obrigatorio' },
        { codigo: 'H3', texto: 'Saldos bancários do balancete batidos com os extratos na data de corte', exigencia: 'obrigatorio' },
        { codigo: 'H4', texto: 'Balancete de abertura conciliado com a última ECD transmitida', exigencia: 'condicional', observacao: 'Se houver ECD', condicao: { campo: 'tem_contabilidade_anterior', valor: true } },
        { codigo: 'H5', texto: 'Composições analíticas batidas com os saldos sintéticos', exigencia: 'obrigatorio', observacao: 'Clientes, fornecedores, tributos' },
        { codigo: 'H6', texto: 'Imobilizado: custo e depreciação acumulada conferidos com o controle patrimonial', exigencia: 'obrigatorio' },
        { codigo: 'H8', texto: 'Divergências documentadas e formalizadas ao cliente', exigencia: 'obrigatorio', observacao: 'Relatório de divergências' },
        { codigo: 'H9', texto: 'Arquivo de importação de lançamentos gerado e validado no Domínio', exigencia: 'obrigatorio' },
        { codigo: 'H10', texto: 'Lançamento de abertura conferido por segundo colaborador (dupla checagem)', exigencia: 'obrigatorio' },
      ],
    },
  ];

  /** Gera a lista plana de itens aplicáveis a partir das respostas-gatilho do onboarding. */
  function gerarItens(respostas) {
    const itens = [];
    CATALOGO.forEach((secao) => {
      if (!bate(secao.condicaoSecao, respostas)) return;
      secao.itens.forEach((item) => {
        if (!bate(item.condicao, respostas)) return;
        itens.push({
          secao: secao.secao,
          item_codigo: item.codigo,
          item_texto: item.texto,
          exigencia: item.exigencia,
          observacao_catalogo: item.observacao || null,
        });
      });
    });
    return itens;
  }

  window.CONTABIL_CATALOGO = CATALOGO;
  window.gerarItensOnboarding = gerarItens;
})();
