/**
 * Fluxos de Rescisão — Departamento Pessoal
 * Conteúdo extraído dos documentos em "Fluxo Rescisão/*.docx" (fonte original,
 * mantida na raiz do projeto apenas como referência).
 */
window.DP_CATEGORIAS = [
  {
    id: 'rescisao',
    nome: 'Rescisão',
    icone: '📤',
    fluxos: [

      // ────────────────────────────────────────────────────────────
      {
        id: 'sem-justa-causa-com-aviso',
        nome: 'Dispensa sem justa causa — aviso prévio trabalhado',
        resumo: {
          prazo: 'Até o 1º dia útil imediato ao término do contrato.',
          observacaoAvisoPrevio: 'O contrato termina ao final do aviso trabalhado; o prazo conta do término efetivo do vínculo.',
          referenciasLegais: 'CLT, art. 477, §6º, I.'
        },
        etapas: [
          {
            titulo: 'Etapa 1: Início do Processo e Comunicação (Aviso Prévio)',
            tarefas: [
              {
                titulo: 'Recebimento da Solicitação',
                detalhes: ['Receber o pedido do cliente (empresa contratante) formalizado com a data de desligamento.']
              },
              {
                titulo: 'Cadastro do Aviso Prévio no Domínio',
                detalhes: [
                  'Acesse: Processos > Rescisões > Aviso Prévio > Individual.',
                  'Clique em [Novo] e informe o Colaborador.',
                  'Selecione Motivo: 01-Dispensa sem justa causa. Concedido por: Empregador. Tipo: Trabalhado.',
                  'Preencha a Data do Aviso (início) e o Último dia trabalhado.',
                  'Regra Legal (Redução): escolha se o funcionário reduzirá 2 horas diárias ou faltará os últimos 7 dias (art. 488 CLT).',
                  'Clique em [Gravar] e [Imprimir] o Aviso Prévio em 2 vias.',
                  'Documentação: Aviso Prévio assinado pelo empregado.'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 2: Acompanhamento e Preparação',
            tarefas: [
              {
                titulo: 'Exame Demissional',
                detalhes: ['Agendar/conferir o ASO Demissional (obrigatório se o último exame periódico tiver mais de 135 dias para empresas de grau 3/4 ou 270 dias para grau 1/2).']
              },
              {
                titulo: 'Levantamento de Informações',
                detalhes: ['Coletar holerites faltantes, faltas ou horas extras do período de aviso para cálculo preciso.']
              }
            ]
          },
          {
            titulo: 'Etapa 3: Cálculo e Fechamento no Domínio',
            tarefas: [
              {
                titulo: 'Cálculo da Rescisão (Pós-Aviso)',
                detalhes: [
                  'Após o último dia de trabalho, acesse Processos > Rescisões > Individual.',
                  'Colaborador, Demitido em (data do fim do aviso). Motivo Rescisão: 01-Dispensa sem justa causa.',
                  'Confira se o sistema puxou o Aviso Prévio criado na Etapa 1.',
                  'Clique em [Calcular] e verifique as verbas (saldo salário, 13º, férias + 1/3).'
                ]
              },
              {
                titulo: 'Geração de Documentos e eSocial',
                detalhes: [
                  'Gere o TRCT em Processos > Rescisões > Individual > Relatórios > Termo de Rescisão.',
                  'O sistema gerará automaticamente o evento S-2299 (Desligamento) para o eSocial.',
                  'Documentação: TRCT, ASO Demissional, Extrato FGTS.'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 4: Pagamento e Guias (FGTS Digital/eSocial)',
            tarefas: [
              {
                titulo: 'Pagamento das Verbas (Cliente)',
                detalhes: ['Emitir a guia de pagamento (Rescisão) para o cliente pagar o funcionário até 10 dias corridos após o fim do aviso.']
              },
              {
                titulo: 'Geração de Guias (Domínio)',
                detalhes: [
                  'Acesse Processos > Rescisões > FGTS Digital para gerar a guia da multa de 40% (GRRF).',
                  'Acesse Processos > Rescisões > DCTFWeb para o recolhimento dos encargos sociais (INSS/IRRF).',
                  'Documentação: Comprovante bancário de pagamento das verbas.'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 5: Finalização e Arquivamento',
            tarefas: [
              {
                titulo: 'Encerramento no eSocial',
                detalhes: ['Conferir no Painel eSocial se o evento S-2299 foi aceito.']
              },
              {
                titulo: 'Arquivamento Digital',
                detalhes: ['Salvar TRCT, Aviso, ASO e comprovantes na pasta do cliente no sistema de GED (Gestão Eletrônica de Documentos) do escritório.']
              }
            ]
          }
        ],
        documentos: [
          'TRCT (Termo de Rescisão do Contrato de Trabalho) assinado',
          'Aviso Prévio Trabalhado',
          'Guia de recolhimento da multa de 40% do FGTS',
          'Comprovante de pagamento da rescisão',
          'ASO Demissional',
          'Requerimento de Seguro-Desemprego (se aplicável)'
        ],
        mermaid: `flowchart TD
  A[Etapa 1<br/>Aviso Prévio] --> B[Etapa 2<br/>Acompanhamento e Preparação]
  B --> C[Etapa 3<br/>Cálculo e TRCT]
  C --> D[Etapa 4<br/>Pagamento e Guias]
  D --> E[Etapa 5<br/>Finalização e Arquivamento]`
      },

      // ────────────────────────────────────────────────────────────
      {
        id: 'sem-justa-causa-sem-aviso',
        nome: 'Dispensa sem justa causa — aviso prévio indenizado',
        resumo: {
          prazo: 'Até 10 dias corridos contados a partir do término do contrato.',
          observacaoAvisoPrevio: 'A projeção do aviso prévio indenizado integra o tempo de serviço para efeitos legais.',
          referenciasLegais: 'CLT, art. 477, §6º, II; CLT, art. 487, §1º; Lei 12.506/2011.'
        },
        etapas: [
          {
            titulo: 'Etapa 1: Iniciação e Formalização (até D+1 da dispensa)',
            tarefas: [
              {
                titulo: 'Recebimento da solicitação do cliente (e-mail/portal)',
                detalhes: ['Receber a data da dispensa e o motivo (dispensa sem justa causa).']
              },
              {
                titulo: 'Cadastro do Aviso Prévio no Domínio',
                detalhes: [
                  'Acesse Processos > Rescisões > Aviso Prévio > Individual.',
                  'Informe o colaborador, data do aviso, Motivo: "4-Dispensa sem justa causa", Tipo: "Indenizado".',
                  'O sistema calculará a projeção do aviso automaticamente.'
                ]
              },
              {
                titulo: 'Emissão do Aviso Prévio',
                detalhes: ['Gerar e enviar ao cliente/colaborador para assinatura.', 'Documentos: Carta de Aviso Prévio Indenizado.']
              }
            ]
          },
          {
            titulo: 'Etapa 2: Cálculo da Rescisão e Preparação (até D+3 da dispensa)',
            tarefas: [
              {
                titulo: 'Cálculo da Rescisão no Domínio',
                detalhes: [
                  'Acesse Processos > Rescisões > Individual.',
                  'Informe Colaborador, Demitido em (data final), Motivo: 2-Demissão sem justa causa.',
                  'Verifique se o campo "Aviso Prévio" está como "Indenizado".',
                  'Confira o cálculo de médias (horas extras, comissões) e 13º salário proporcional.'
                ]
              },
              {
                titulo: 'Emissão do TRCT e Documentos',
                detalhes: ['Relatórios > Rescisão > Termo de Rescisão de Contrato de Trabalho.']
              },
              {
                titulo: 'Envio de Documentos para Cliente',
                detalhes: ['Enviar TRCT, Guia de Recolhimento do Seguro-Desemprego (se houver) e guia de recolhimento FGTS rescisório.']
              }
            ]
          },
          {
            titulo: 'Etapa 3: eSocial e FGTS Digital (até D+7 da dispensa)',
            tarefas: [
              {
                titulo: 'Envio do Evento S-2299 (Desligamento) ao eSocial',
                detalhes: [
                  'Ao calcular a rescisão no Domínio, o sistema gera o S-2299.',
                  'Acesse Processos > eSocial > Eventos Periódicos (ou painel de pendências) e envie.',
                  'Nota: o desligamento com aviso indenizado pode gerar a projeção automaticamente no sistema.'
                ]
              },
              {
                titulo: 'Geração da Multa FGTS e Guia Rescisória (GRRF) no FGTS Digital',
                detalhes: [
                  'O Domínio se integra ao FGTS Digital. Acesse Processos > FGTS Digital para validar o cálculo da multa de 40%.',
                  'Documentos: XML S-2299, Guia de recolhimento da multa (GRRF).'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 4: Finalização e Arquivamento (até D+10 da dispensa)',
            tarefas: [
              {
                titulo: 'Confirmação de Pagamento pelo Cliente',
                detalhes: ['Validar se o cliente pagou as verbas e a guia dentro dos 10 dias.']
              },
              {
                titulo: 'Envio do Evento S-1210 (Pagamento) ao eSocial',
                detalhes: ['Após o pagamento, o Domínio deve enviar o S-1210 (ou informar o pagamento via DCTFWeb).']
              },
              {
                titulo: 'Arquivamento Digital',
                detalhes: ['Salvar TRCT, Aviso, ASO Demissional e comprovantes de envio eSocial na pasta do cliente no Domínio GED ou servidor.']
              }
            ]
          }
        ],
        observacoes: [
          'FGTS Digital: a multa de 40% (ou 20% em alguns casos) é calculada com base no histórico do eSocial, automatizando o cálculo.',
          'Aviso Prévio Misto/Projeção: a projeção do aviso prévio indenizado integra o tempo de serviço para cálculo de férias e 13º.',
          'ASO Demissional: o atestado médico demissional é obrigatório (a menos que o ASO periódico esteja válido conforme NR7).',
          'Assinatura Digital: preferencialmente, utilizar ferramentas de assinatura digital (como o Portal do Empregado Thomson Reuters) para garantir celeridade.'
        ],
        documentos: [
          'Carta de Aviso Prévio Indenizado',
          'TRCT (Termo de Rescisão do Contrato de Trabalho)',
          'Guia de Recolhimento do Seguro-Desemprego (se houver)',
          'Guia de recolhimento FGTS rescisório',
          'XML do evento S-2299',
          'Guia de recolhimento da multa de 40% do FGTS (GRRF)'
        ],
        mermaid: `flowchart TD
  A[Etapa 1<br/>Iniciação e Formalização] --> B[Etapa 2<br/>Cálculo da Rescisão]
  B --> C[Etapa 3<br/>eSocial e FGTS Digital]
  C --> D[Etapa 4<br/>Finalização e Arquivamento]`
      },

      // ────────────────────────────────────────────────────────────
      {
        id: 'pedido-demissao-com-aviso',
        nome: 'Pedido de demissão — aviso prévio trabalhado',
        resumo: {
          prazo: 'Até o 1º dia útil imediato ao término do contrato.',
          observacaoAvisoPrevio: 'Segue a lógica de encerramento no último dia efetivo de trabalho.',
          referenciasLegais: 'CLT, art. 477, §6º, I; CLT, art. 487.'
        },
        etapas: [
          {
            titulo: 'Etapa 1: Solicitação e Formalização (Início do Aviso)',
            tarefas: [
              {
                titulo: 'Recebimento e Análise da Documentação',
                detalhes: [
                  'Ação: o cliente envia a carta de pedido de demissão manuscrita.',
                  'Documento: Carta de Pedido de Demissão (com data de início do aviso) e Ficha de Registro.',
                  'Registro: digitalizar e anexar ao GED (Gestão Eletrônica de Documentos) do Domínio, pasta do funcionário.'
                ]
              },
              {
                titulo: 'Cadastro do Aviso Prévio no Domínio',
                detalhes: [
                  'Caminho: Processos > Rescisões > Aviso Prévio > Individual.',
                  'Clique em [Novo], selecione o funcionário.',
                  'Campos: Motivo "4 - Pedido de demissão", Concedido por "Empregado", Tipo "Trabalhado". Data: Data do Pedido.',
                  'Configuração: redução de jornada (se for o caso).',
                  'Emissão: emitir o termo de aviso prévio para assinatura.'
                ]
              },
              {
                titulo: 'Envio de eSocial (S-2250/S-2206)',
                detalhes: ['O sistema gera automaticamente o evento de aviso prévio (S-2250) quando o aviso é trabalhado e a rescisão é calculada posteriormente. Se houve alteração de contrato na data, S-2206.']
              }
            ]
          },
          {
            titulo: 'Etapa 2: Processamento da Rescisão',
            tarefas: [
              {
                titulo: 'Cálculo da Rescisão no Domínio',
                detalhes: [
                  'Ação: ao final dos 30 dias de aviso (ou data acordada).',
                  'Caminho: Processos > Rescisões > Individual. Clique em [Novo].',
                  'Campos: Motivo "4 - Pedido de demissão", Data da Demissão: "Último dia trabalhado".',
                  'Aviso Prévio: selecione o aviso cadastrado na Etapa 1.',
                  'Confirmação: clique em [Calcular]. Verifique saldos de dias trabalhados, 13º proporcional e férias proporcionais.'
                ]
              },
              {
                titulo: 'Emissão do TRCT e Documentos',
                detalhes: [
                  'Caminho: Relatórios > Recibos > Rescisão. Selecione o modelo (por código/período).',
                  'Documentos: Termo de Rescisão (TRCT) — 4 vias, Termo de Quitação, Termo de Homologação (THRCT — se necessário), Ficha de registro atualizada.'
                ]
              },
              {
                titulo: 'Envio de eSocial (S-2299)',
                detalhes: ['Caminho: eSocial > Gerenciamento de Rescisões. Gerar o evento S-2299 (Desligamento) após conferência do cálculo. O sistema já integra com FGTS Digital.']
              }
            ]
          },
          {
            titulo: 'Etapa 3: Encerramento e Entrega',
            tarefas: [
              {
                titulo: 'Geração de Guias de Pagamento',
                detalhes: [
                  'Ação: pagar a rescisão e entregar os documentos ao funcionário.',
                  'FGTS: acessar o ambiente do FGTS Digital para gerar a guia das verbas rescisórias (competência da rescisão).',
                  'IRRF/INSS: acessar DCTFWeb para gerar a guia de impostos da rescisão.'
                ]
              },
              {
                titulo: 'Envio para o Cliente',
                detalhes: ['Enviar TRCT, Guias de recolhimento e a Ficha de Registro atualizada ao cliente para pagamento e assinatura do funcionário.']
              },
              {
                titulo: 'Arquivamento e Finalização',
                detalhes: [
                  'Arquivar os documentos assinados no GED do Domínio (através da integração BGR).',
                  'Status: alterar o status do processo no módulo "Domínio Processos" para "Concluído".'
                ]
              }
            ]
          }
        ],
        observacoes: [
          'Aviso Prévio Trabalhado: o funcionário trabalha os 30 dias. Se o pedido de demissão não for cumprido, a empresa pode descontar os dias não trabalhados (Lei 12.506/2011).',
          'Pedido de Demissão: o funcionário não saca FGTS, não recebe a multa de 40% e não tem direito ao seguro-desemprego.',
          'Exame Demissional: obrigatório. A data do último exame médico deve ser verificada para saber se ainda está válido (regra geral: 135 dias para empresas de risco 1 e 2, 90 dias para risco 3 e 4).',
          'Assinatura: o TRCT deve ser assinado pelo funcionário. Em caso de pedido de demissão, é importante a assinatura da carta pelo próprio punho.'
        ],
        documentos: [
          'Carta de Pedido de Demissão',
          'Ficha de Registro (e atualizada ao final)',
          'Termo de Aviso Prévio',
          'Termo de Rescisão (TRCT) — 4 vias',
          'Termo de Quitação',
          'Termo de Homologação (THRCT, se necessário)',
          'Guias de recolhimento FGTS/DCTFWeb'
        ],
        mermaid: `flowchart TD
  A[Etapa 1<br/>Solicitação e Formalização] --> B[Etapa 2<br/>Processamento da Rescisão]
  B --> C[Etapa 3<br/>Encerramento e Entrega]`
      },

      // ────────────────────────────────────────────────────────────
      {
        id: 'pedido-demissao-desconto-dispensa',
        nome: 'Pedido de demissão — desconto ou dispensa do aviso prévio',
        resumo: {
          prazo: 'Até 10 dias corridos contados a partir do término do contrato.',
          observacaoAvisoPrevio: 'Quando houver dispensa do aviso pelo empregador ou indenização do aviso em favor da empresa, a organização deve observar o encerramento contratual e a regra do art. 477.',
          referenciasLegais: 'CLT, art. 477, §6º, II; CLT, art. 487, §2º.'
        },
        etapas: [
          {
            titulo: 'Etapa 1: Recebimento da Documentação e Formalização (Cliente/Escritório)',
            tarefas: [
              {
                titulo: 'Receber a carta de pedido de demissão',
                detalhes: [
                  'Verificar dispensa de aviso e novo emprego.',
                  'Documentação: Carta de Pedido de Demissão (de próprio punho ou assinada) informando se cumprirá ou não o aviso.',
                  'Comprovante de Novo Emprego (se houver, para isenção do desconto de aviso).',
                  'Ação no Domínio: nenhum lançamento técnico ainda. Apenas salvamento da documentação no GED, vinculado ao cliente.'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 2: Lançamento e Cálculo da Rescisão no Domínio',
            tarefas: [
              {
                titulo: 'Registrar a rescisão e tratar o aviso prévio',
                detalhes: [
                  'Acesse o menu Processos > Rescisões > Individual.',
                  'Colaborador: informe o funcionário. Demitido em: informe o último dia trabalhado.',
                  'Motivo: selecione "4 - Pedido de demissão SEM justa causa".'
                ]
              },
              {
                titulo: 'Quadro Aviso Prévio — decisão entre 3 situações',
                detalhes: [
                  'Situação A — Desconto Total (não trabalhou): selecione "Data da demissão" e Tipo "Indenizado" (descontará 30 dias).',
                  'Situação B — Dispensa do Aviso (empresa aceitou): selecione "Ausência/Dispensa" (sem desconto).',
                  'Situação C — Comprovou Novo Emprego: marque "[x] Colaborador comprovou ter novo emprego" e Tipo "Indenizado" (sistema não desconta o aviso).',
                  'Em qualquer situação: clique em [Calcular] e depois em [Gravar].'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 3: Emissão de Documentos e Conferência',
            tarefas: [
              {
                titulo: 'Emitir TRCT e documentos complementares',
                detalhes: [
                  'Acesse Relatórios > Rescisão > Termo de Rescisão de Contrato de Trabalho (TRCT).',
                  'Selecione o modelo do TRCT e o colaborador.',
                  'Imprima o TRCT e o Termo de Quitação do Aviso Prévio.',
                  'Enviar documentos assinados pelo funcionário e cliente via "Portal do Empregado" ou e-mail seguro.'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 4: Envio ao eSocial e FGTS Digital (obrigatório)',
            tarefas: [
              {
                titulo: 'Transmitir o evento S-2299 e processar o FGTS',
                detalhes: [
                  'Acesse o menu eSocial > Gerenciamento de Eventos.',
                  'O sistema gerará automaticamente o evento S-2299. Verifique se as informações de aviso prévio e verbas estão corretas.',
                  'Clique em [Enviar].',
                  'Após retorno do eSocial, acesse o FGTS Digital para gerar a guia da multa (se aplicável — no pedido de demissão não há) e a rescisória (FGTS do mês da rescisão).'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 5: Pagamento e Encerramento',
            tarefas: [
              {
                titulo: 'Pagar verbas rescisórias dentro do prazo de 10 dias',
                detalhes: [
                  'Orientar o cliente a realizar o pagamento (TED/PIX) até o 10º dia corrido após o término do contrato.',
                  'Conformidade: o descumprimento gera multa de um salário do funcionário (Art. 477 CLT).'
                ]
              }
            ]
          }
        ],
        observacoes: [
          'Desconto de Aviso: se o funcionário não cumprir e não tiver novo emprego, o sistema Domínio deve estar com o aviso prévio configurado como Indenizado no quadro de aviso do pedido de demissão para descontar 30 dias.',
          'Novo Emprego: comprovante de novo emprego desonera o empregado do desconto de aviso.',
          'eSocial: o aviso prévio deve ser informado no S-2299, mas o documento de aviso prévio (papel) é preenchido e assinado fora do sistema.'
        ],
        documentos: [
          'Carta de Pedido de Demissão (com decisão sobre o aviso)',
          'Comprovante de Novo Emprego (se houver)',
          'TRCT (Termo de Rescisão do Contrato de Trabalho)',
          'Termo de Quitação do Aviso Prévio',
          'Guia FGTS rescisória',
          'Guia da multa FGTS (se aplicável)'
        ],
        mermaid: `flowchart TD
  A[Etapa 1<br/>Recebimento e Formalização] --> B[Etapa 2<br/>Lançamento no Domínio]
  B --> D{Situação do Aviso Prévio}
  D -->|A: Desconto total| E[Indenizado<br/>desconta 30 dias]
  D -->|B: Dispensa pela empresa| F[Ausência/Dispensa<br/>sem desconto]
  D -->|C: Novo emprego comprovado| G[Indenizado<br/>sem desconto]
  E --> H[Etapa 3<br/>TRCT e Documentos]
  F --> H
  G --> H
  H --> I[Etapa 4<br/>eSocial e FGTS Digital]
  I --> J[Etapa 5<br/>Pagamento e Encerramento]`
      },

      // ────────────────────────────────────────────────────────────
      {
        id: 'acordo-mutuo',
        nome: 'Rescisão por acordo entre as partes (mútuo acordo)',
        resumo: {
          prazo: 'Até 10 dias corridos contados a partir do término do contrato.',
          observacaoAvisoPrevio: 'Aplica-se a lógica do término contratual com parcelas específicas do acordo trabalhista.',
          referenciasLegais: 'CLT, art. 484-A; CLT, art. 477, §6º, II.'
        },
        observacoes: [
          'Definição: modalidade introduzida pela Reforma Trabalhista (2017) onde ambas as partes decidem encerrar o contrato.',
          'Direitos do Empregado: Saldo de Salário, Férias + 1/3, 13º Proporcional, 20% Multa FGTS, saque 80% FGTS, 50% Aviso Prévio Indenizado. Sem Seguro-Desemprego.',
          'Motivo da Rescisão: usar o motivo 44 - Rescisão por acordo entre as partes em Processos > Rescisões > Individual automatiza o cálculo do aviso pela metade, a multa do FGTS em 20% e o código de saque de 80% do FGTS.',
          'Aviso Prévio no Domínio: em Processos > Rescisões > Aviso Prévio > Individual, selecione o modelo "Termo de Acordo entre as Partes" para emitir o documento correto.',
          'Saída no eSocial: o campo "Motivo eSocial" deve ser preenchido com a opção de acordo mútuo para envio do S-2299.',
          'Integração Contábil: acesse Controle > Parâmetros > Contabilidade para conferir se a integração da rescisão será por colaborador.'
        ],
        etapas: [
          {
            titulo: '1. Iniciação e Formalização',
            tarefas: [
              {
                titulo: 'Recebimento da Carta de Acordo',
                detalhes: [
                  'Cliente envia carta assinada (empresa e funcionário) ou ofício formalizando o acordo.',
                  'Documento: Carta de pedido de rescisão por acordo mútuo (assinada).'
                ]
              }
            ]
          },
          {
            titulo: '2. Cadastro da Rescisão',
            tarefas: [
              {
                titulo: 'Cadastro do Aviso Prévio',
                detalhes: [
                  'Processos > Rescisões > Aviso Prévio > Individual.',
                  'Selecionar motivo "44 - Rescisão por acordo entre as partes". Definir data e se é indenizado ou trabalhado.',
                  'Documento: Aviso Prévio com motivo 44.'
                ]
              }
            ]
          },
          {
            titulo: '3. Cálculo da Rescisão',
            tarefas: [
              {
                titulo: 'Calcular Rescisão',
                detalhes: [
                  'Processos > Rescisões > Individual. Informar colaborador, data da saída e motivo 44.',
                  'O sistema calcula automaticamente multa de 20% e metade do aviso.',
                  'Documento: conferência do TRCT (Termo de Rescisão de Contrato de Trabalho).'
                ]
              }
            ]
          },
          {
            titulo: '4. Envio ao eSocial',
            tarefas: [
              {
                titulo: 'Enviar S-2299 (Desligamento)',
                detalhes: [
                  'Processos > Rescisões > Individual. Clicar em [eSocial] para gerar o evento S-2299.',
                  'Garantir que o motivo é "Acordo entre as partes".'
                ]
              }
            ]
          },
          {
            titulo: '5. Fechamento da Folha',
            tarefas: [
              {
                titulo: 'Integrar Rescisão',
                detalhes: [
                  'Arquivos > Contabilidade > Integração.',
                  'Verificar se as rubricas de rescisão acordo estão configuradas corretamente.',
                  'Documento: provisões rescisórias contábeis.'
                ]
              }
            ]
          },
          {
            titulo: '6. Finalização e Pagamento',
            tarefas: [
              {
                titulo: 'Emitir TRCT e Guias',
                detalhes: [
                  'Relatórios > Rescisões > Termo de Rescisão.',
                  'Emitir TRCT, GRRF (multa FGTS) e guias de INSS/FGTS.',
                  'Documentos: TRCT, GRRF (20% multa), chave de conectividade (saque 80% FGTS).'
                ]
              }
            ]
          },
          {
            titulo: '7. Envio ao Cliente/Funcionário',
            tarefas: [
              {
                titulo: 'Enviar documentos para assinar',
                detalhes: [
                  'O sistema Domínio/Portal do Empregado envia documentos para assinaturas eletrônicas.',
                  'Documento: Termo de Rescisão e documentos de quitação assinados pelo empregado.'
                ]
              }
            ]
          }
        ],
        documentos: [
          'Carta de pedido de rescisão por acordo mútuo (assinada)',
          'Aviso Prévio com motivo 44',
          'TRCT (Termo de Rescisão do Contrato de Trabalho)',
          'GRRF (20% de multa do FGTS)',
          'Chave de conectividade (saque de 80% do FGTS)',
          'Comprovante do evento S-2299'
        ],
        mermaid: `flowchart TD
  A[1. Iniciação e Formalização] --> B[2. Cadastro do Aviso Prévio]
  B --> C[3. Cálculo da Rescisão]
  C --> D[4. Envio ao eSocial]
  D --> E[5. Fechamento da Folha]
  E --> F[6. TRCT e Guias]
  F --> G[7. Envio ao Cliente]`
      },

      // ────────────────────────────────────────────────────────────
      {
        id: 'justa-causa',
        nome: 'Rescisão por justa causa',
        resumo: {
          prazo: 'Até 10 dias corridos contados a partir do término do contrato.',
          observacaoAvisoPrevio: 'Não há aviso prévio indenizado ou trabalhado; a quitação segue a data de extinção contratual.',
          referenciasLegais: 'CLT, art. 477, §6º, II; CLT, art. 482.'
        },
        observacoes: [
          'Definição: conjunto de etapas para o desligamento imediato de funcionário por falta grave, garantindo a conformidade legal e a emissão correta de verbas.',
          'Imediaticidade: a penalidade deve ser aplicada logo após o conhecimento do fato.',
          'Justa causa não paga férias proporcionais, 13º proporcional, aviso prévio, multa FGTS (40%) ou seguro-desemprego.'
        ],
        etapas: [
          {
            titulo: 'Etapa 1: Solicitação e Formalização (Cliente → Escritório)',
            tarefas: [
              {
                titulo: 'Recebimento de Documentos',
                detalhes: ['Receber via sistema de gestão (ou e-mail) a solicitação da empresa com carta de punições anteriores (se houver) e o relato do fato grave.']
              },
              {
                titulo: 'Emissão da Carta de Justa Causa',
                detalhes: ['Elaborar a carta detalhando o motivo (ex.: desídia, insubordinação — alíneas art. 482 CLT).']
              },
              {
                titulo: 'Registro no Domínio Processos',
                detalhes: ['Iniciar o processo "Rescisão" no Domínio Processos, anexando a documentação.']
              }
            ]
          },
          {
            titulo: 'Etapa 2: Cadastro da Rescisão no Sistema Domínio',
            tarefas: [
              {
                titulo: 'Acessar Tela de Rescisão',
                detalhes: [
                  'Menu Processos > Rescisões > Individual.',
                  'Colaborador: selecionar o funcionário. Demitido em: data do último dia de trabalho (imediato).',
                  'Motivo: selecionar 1 - Demitido COM justa causa.',
                  'Motivo eSocial será preenchido automaticamente como 1 - Rescisão com justa causa, por iniciativa do empregador.',
                  'Clique em [Calcular]. Verifique verbas (Saldo de Salário, Férias Vencidas + 1/3).',
                  'Clique em [Gravar].'
                ]
              }
            ]
          },
          {
            titulo: 'Etapa 3: Documentação e Rotinas Legais (Envio eSocial/FGTS Digital)',
            tarefas: [
              {
                titulo: 'Envio do Evento S-2299 (eSocial)',
                detalhes: ['Acessar Relatórios > Acompanhamento eSocial. O sistema Domínio gera automaticamente o envio do desligamento com o motivo da justa causa.']
              },
              {
                titulo: 'Geração de Guia Rescisória (FGTS Digital)',
                detalhes: [
                  'Acessar o portal do FGTS Digital (via ferramenta da Thomson Reuters ou site oficial) para gerar a guia de recolhimento dos depósitos do mês da rescisão (se houver).',
                  'Nota: a multa de 40% não é gerada.'
                ]
              },
              {
                titulo: 'Emissão de Documentos (Domínio)',
                detalhes: [
                  'Menu Relatórios > Rescisões > Termo de Rescisão de Contrato de Trabalho (TRCT).',
                  'Gerar o PPP (Perfil Profissiográfico Previdenciário) se necessário.',
                  'Gerar a carta de justa causa (importação BGR se houver modelo).'
                ]
              },
              {
                titulo: 'Envio ao Cliente',
                detalhes: ['Enviar os documentos (TRCT, Guia FGTS) para assinatura do funcionário e do empregador.']
              }
            ]
          },
          {
            titulo: 'Etapa 4: Finalização e Arquivamento',
            tarefas: [
              {
                titulo: 'Conferência de Pagamento',
                detalhes: ['Monitorar se o cliente pagou a rescisão e o FGTS até o 10º dia corrido (garantia de que a multa do Art. 477 não ocorra).']
              },
              {
                titulo: 'Baixa na CTPS Digital',
                detalhes: ['Confirmar se o eSocial enviou corretamente a baixa para a CTPS Digital.']
              },
              {
                titulo: 'Fechamento do Processo',
                detalhes: ['Finalizar o fluxo no "Domínio Processos".']
              }
            ]
          }
        ],
        documentos: [
          'Carta de Justa Causa (motivo detalhado)',
          'Relato do fato grave / punições anteriores',
          'TRCT (Termo de Rescisão do Contrato de Trabalho)',
          'Guia FGTS do mês da rescisão (se houver saldo)',
          'PPP (Perfil Profissiográfico Previdenciário), se necessário'
        ],
        mermaid: `flowchart TD
  A[Etapa 1<br/>Solicitação e Formalização] --> B[Etapa 2<br/>Cadastro da Rescisão]
  B --> C[Etapa 3<br/>Documentação e Rotinas Legais]
  C --> D[Etapa 4<br/>Finalização e Arquivamento]`
      }

    ]
  }
];
