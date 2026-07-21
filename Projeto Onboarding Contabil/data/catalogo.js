/**
 * SCONT — Onboarding Contábil
 * Catálogo do checklist de balanço inicial, restrito a itens de natureza
 * contábil. Premissa: os onboardings fiscal e de departamento pessoal já
 * foram feitos separadamente, e os dados cadastrais/societários e os
 * acessos/procurações (antigas Seções A e B) são levantados pelo
 * Administrativo — então nada desses domínios entra aqui, só o que a
 * equipe contábil precisa para montar o balanço de abertura.
 *
 * Seção C.0 cobre o cenário de empresa recém-aberta (em constituição):
 * capital social, integralização, alocação dos recursos e imobilizado
 * inicial. É um refinamento de "sem contabilidade anterior" — só aparece
 * quando o gatilho `empresa_recem_aberta` está marcado (e esse gatilho só
 * fica habilitável quando `tem_contabilidade_anterior` é falso).
 *
 * Cada seção pode ter `condicaoSecao` (a seção inteira só é gerada se a
 * condição bater; pode ser um objeto único ou um array de condições, todas
 * avaliadas em AND). Cada item pode ter `condicao` (o item só é gerado se a
 * condição bater); itens sem `condicao` são sempre gerados quando a seção
 * está ativa — a equipe marca "não aplicável" manualmente quando não há um
 * gatilho binário claro para aquele item.
 */
(function () {
  'use strict';

  function bate(condicao, respostas) {
    if (!condicao) return true;
    const lista = Array.isArray(condicao) ? condicao : [condicao];
    return lista.every((c) => {
      const valorAtual = respostas[c.campo];
      if (c.valores) return c.valores.includes(valorAtual);
      return valorAtual === c.valor;
    });
  }

  const CATALOGO = [
    {
      secao: 'C0',
      titulo: 'Seção C.0 — Empresa recém-aberta (constituição)',
      condicaoSecao: { campo: 'empresa_recem_aberta', valor: true },
      itens: [
        { codigo: 'C0-1', texto: 'Capital social subscrito: valor total e prazo de integralização', exigencia: 'obrigatorio', observacao: 'Conforme contrato social' },
        { codigo: 'C0-2', texto: 'Comprovante de integralização do capital em dinheiro (extrato da conta mostrando o depósito)', exigencia: 'obrigatorio' },
        { codigo: 'C0-3', texto: 'Bens conferidos para integralização de capital (notas fiscais e/ou laudo de avaliação)', exigencia: 'condicional', observacao: 'Se parte do capital foi integralizada em bens' },
        { codigo: 'C0-4', texto: 'Destinação/aplicação dos recursos do capital social', exigencia: 'obrigatorio', observacao: 'O que foi comprado ou reservado como capital de giro' },
        { codigo: 'C0-5', texto: 'Notas fiscais de aquisição de imobilizado/equipamentos iniciais', exigencia: 'condicional', observacao: 'Se houve compra de bens/equipamentos na abertura' },
        { codigo: 'C0-6', texto: 'Estoque inicial adquirido (notas fiscais de compra)', exigencia: 'condicional', observacao: 'Se houver estoques', condicao: { campo: 'tem_estoque', valor: true } },
        { codigo: 'C0-7', texto: 'Despesas pré-operacionais (taxas de registro, honorários, reformas/instalações anteriores ao início das atividades)', exigencia: 'obrigatorio' },
        { codigo: 'C0-8', texto: 'Data efetiva de início das operações (primeira venda/nota fiscal emitida)', exigencia: 'obrigatorio', observacao: 'Separa o período pré-operacional' },
        { codigo: 'C0-9', texto: 'Plano de contas a ser adotado, definido em conjunto com o cliente', exigencia: 'obrigatorio', observacao: 'Sem histórico anterior para basear o de-para' },
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
      condicaoSecao: [
        { campo: 'tem_contabilidade_anterior', valor: false },
        { campo: 'empresa_recem_aberta', valor: false },
      ],
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
        { codigo: 'H11', texto: 'Capital social integralizado batendo com a aplicação dos recursos (Ativo = Capital Social)', exigencia: 'condicional', observacao: 'Somente empresas recém-abertas', condicao: { campo: 'empresa_recem_aberta', valor: true } },
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
