// Projeto PDI/js/textos.js
/**
 * PDI — textos literais do documento de referência
 * ("PDI - Julia Costa Faria - Assistente de Depart. Pessoal").
 * Sem paráfrase. Correções aplicadas: "Sistema Domínio", "Visão Sistêmica", "a fim de".
 * Numeração sequencial coerente (o .docx tem numeração irregular).
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) module.exports = factory();
    else root.PdiTextos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SECOES = [
        { id: 'cabecalho', titulo: 'Plano de Desenvolvimento Individual' },
        { id: 'objetivo', titulo: '1. Informações gerais — Objetivo do PDI' },
        { id: 'perfil', titulo: '2. Perfil comportamental e aderência ao cargo' },
        { id: 'pilares12', titulo: '3. Pilares do desenvolvimento' },
        { id: 'plano', titulo: '4. Plano de desenvolvimento do primeiro ciclo' },
        { id: 'pilares34', titulo: '5. Pilares 3 e 4 — Performance e melhorias' },
        { id: 'ficha', titulo: '6. Ficha de avaliação trimestral' },
        { id: 'evolucao', titulo: '7. Evolução entre ciclos' },
        { id: 'ciencia', titulo: '8. Ciência e alinhamento' },
    ];

    const CABECALHO_PADRAO = {
        acompanhamento: '12 meses propostos a partir do início do PDI',
        avaliacao: 'Trimestral, com acompanhamento da Diretoria',
    };

    const TEXTOS = {
        objetivo1: 'Direcionar o desenvolvimento profissional, fortalecendo o domínio das rotinas de DP, a autonomia operacional, a comunicação e a qualidade das entregas. O plano considera as competências da função, o perfil comportamental e os resultados observados na prática.',
        objetivo2: 'O acompanhamento será realizado com participação da colaboradora, orientação do gestor e acompanhamento da Diretoria. Cada trimestre permitirá registrar avanços, revisar prioridades e estabelecer o próximo ciclo.',
        avisoPerfilEvidenciado: 'Esses resultados orientam o desenvolvimento e devem ser confirmados por observações da rotina.',
        statusPerfilProposto: 'Status inicial proposto: Consolidado | Em desenvolvimento | Prioritário.',
        avisoPerfilEsperado: 'A classificação comportamental é uma referência de planejamento e será validada com o gestor. Não constitui nota de desempenho.',
        pilar1Intro: 'Trilha proposta para a função. Definir a carteira e as rotinas de responsabilidade da Assistente; processos de maior risco devem permanecer sujeitos à conferência prevista pelo setor.',
        pilar1Regra: 'Registrar o nível inicial por rotina nos primeiros 15 dias do PDI. A meta é atingir nível 2 nas rotinas priorizadas no primeiro trimestre; avançar a nível 3 nas rotinas consolidadas nos ciclos seguintes.',
        planoIntro: 'D = data de início do PDI. Prazos, apoio e metas propostos serão alinhados na apresentação. Status das ações: A iniciar | Em andamento | Concluído.',
        planoStatusInicial: 'A iniciar, sujeito à confirmação de atividades já realizadas.',
        apoioScont: 'acesso ao sistema, procedimentos, exemplos de conferência e tempo para orientação técnica.',
        pilar3Intro: 'Apurar mensalmente sobre as atividades atribuídas à colaboradora. Levantar a linha de base no primeiro mês. As metas abaixo são propostas para alinhamento; os resultados permanecem em aberto até a medição.',
        pilar4Intro: 'Registrar o que mudou em relação ao início, com situação anterior, evidência atual e resultado. Exemplos a observar: redução de correções, nova rotina executada com segurança, melhor comunicação e uso mais consistente do Domínio.',
        pilar4Colunas: ['Data e rotina', 'Situação anterior', 'Melhoria e evidência', 'Validação do gestor'],
        frequencia: 'alinhamento semanal com o gestor, revisão mensal dos indicadores e fechamento trimestral com a Diretoria. A colaboradora registra prática e dificuldades; o gestor oferece apoio e verifica evidências; a Diretoria acompanha evolução e prioridades.',
        fichaNaRegra: 'Usar N/A quando não houver evidência e justificar.',
        evolucaoIntro: 'Calendário proposto a partir da data de início do PDI. Registrar as datas na apresentação e agendar cada avaliação com a Diretoria.',
        evolucaoRodape: 'A evolução será comparada pelas notas e evidências, considerando mudanças no escopo e apoio oferecido. As prioridades do próximo ciclo devem ser registradas no plano de ação, com prazo e evidência esperada.',
        ciencia: 'Na apresentação, colaboradora, gestor e Diretoria alinham objetivos, ações, recursos, metas e rotina de acompanhamento. A ciência registra o recebimento e a discussão do plano e permite registrar considerações sobre as avaliações.',
    };

    const ESCALA_TECNICA = [
        { nivel: 1, titulo: 'Em aprendizagem', descricao: 'necessita orientação para compreender a rotina.' },
        { nivel: 2, titulo: 'Execução assistida', descricao: 'realiza com acompanhamento e conferência.' },
        { nivel: 3, titulo: 'Execução autônoma', descricao: 'realiza corretamente, respeitando as validações do setor.' },
        { nivel: 4, titulo: 'Domínio', descricao: 'mantém consistência, identifica riscos e propõe melhorias.' },
    ];
    const ESCALA_COMPORTAMENTAL = [
        { nivel: 1, titulo: 'Requer orientação frequente' },
        { nivel: 2, titulo: 'Demonstra com apoio' },
        { nivel: 3, titulo: 'Demonstra de forma consistente' },
        { nivel: 4, titulo: 'Mantém consistência e contribui para melhorias' },
    ];
    const ESCALA_PERFORMANCE = [
        { nivel: 1, titulo: 'Metas predominantemente não atingidas' },
        { nivel: 2, titulo: 'Atingidas parcialmente' },
        { nivel: 3, titulo: 'Atingidas' },
        { nivel: 4, titulo: 'Superadas com qualidade' },
    ];
    const ESCALA_MELHORIAS = [
        { nivel: 1, titulo: 'Sem evidência suficiente' },
        { nivel: 2, titulo: 'Melhoria pontual' },
        { nivel: 3, titulo: 'Melhoria consistente' },
        { nivel: 4, titulo: 'Melhoria sustentada com impacto demonstrado' },
    ];
    const CRITERIOS_PILAR = {
        tecnicas: ESCALA_TECNICA,
        comportamentais: ESCALA_COMPORTAMENTAL,
        performance: ESCALA_PERFORMANCE,
        melhorias: ESCALA_MELHORIAS,
    };
    const PILARES_ROTULO = {
        tecnicas: 'Competências técnicas',
        comportamentais: 'Competências comportamentais',
        performance: 'Indicadores de performance',
        melhorias: 'Melhorias apresentadas',
    };
    const PILARES_CURTO = {
        tecnicas: 'Técnicas', comportamentais: 'Comportamentais', performance: 'Performance', melhorias: 'Melhorias',
    };

    const STATUS_PERFIL = { consolidado: 'Consolidado', em_desenvolvimento: 'Em desenvolvimento', prioritario: 'Prioritário' };
    const STATUS_ACAO = { a_iniciar: 'A iniciar', em_andamento: 'Em andamento', concluido: 'Concluído' };
    const RESULTADOS = {
        abaixo: 'Abaixo do esperado', parcial: 'Parcial', dentro: 'Dentro do esperado', acima: 'Acima do esperado',
    };
    const DIRECIONAMENTOS = {
        manutencao: 'Manutenção do PDI', revisao_prioridades: 'Revisão de prioridades',
        ampliacao: 'Ampliação de responsabilidades', novo_ciclo: 'Novo ciclo',
    };
    const STATUS_FICHA = {
        rascunho: 'Rascunho', em_reuniao: 'Em reunião', aguardando_ciencia: 'Aguardando ciência', concluida: 'Concluída',
    };
    const ATINGIMENTO = {
        atingida: 'Atingida', parcial: 'Parcial', nao_atingida: 'Não atingida', sem_medicao: 'Sem medição',
    };

    const CICLOS = [
        { numero: 1, periodo: 'Meses 1 a 3', foco: 'Integração, Domínio e rotinas básicas; execução assistida com qualidade' },
        { numero: 2, periodo: 'Meses 4 a 6', foco: 'Consolidação técnica; autonomia nas rotinas validadas e redução de retrabalho' },
        { numero: 3, periodo: 'Meses 7 a 9', foco: 'Consistência de prazos e qualidade; ampliação gradual de complexidade' },
        { numero: 4, periodo: 'Meses 10 a 12', foco: 'Domínio do escopo da função; revisão de lacunas e possibilidades de desenvolvimento' },
    ];

    // Modelo padrão "Assistente de Departamento Pessoal"
    const MODELO_DP = {
        cargo_setor: 'Assistente de Departamento Pessoal',
        conteudo: {
            objetivo: [TEXTOS.objetivo1, TEXTOS.objetivo2],
            apoio_scont: TEXTOS.apoioScont,
            perfil_esperado: [
                { competencia: 'Organização e atenção', evidencia: 'Orientação a processos e detalhes', direcionamento: 'Consolidado no perfil; confirmar nas entregas', status: 'consolidado' },
                { competencia: 'Estabilidade e Colaboração', evidencia: 'Paciência, escuta e cooperação', direcionamento: 'Consolidado no perfil; manter', status: 'consolidado' },
                { competencia: 'Abertura a mudanças', evidencia: 'Oportunidade expressa', direcionamento: 'Em desenvolvimento; praticar novos fluxos', status: 'em_desenvolvimento' },
                { competencia: 'Visibilidade profissional', evidencia: 'Oportunidade expressa', direcionamento: 'Em desenvolvimento; apresentar entregas', status: 'em_desenvolvimento' },
                { competencia: 'Comunicação assertiva', evidencia: 'Estilo diplomático e busca de consenso', direcionamento: 'Em desenvolvimento; comunicar riscos objetivamente', status: 'em_desenvolvimento' },
                { competencia: 'Autonomia e iniciativa', evidencia: 'Sem medida direta no relatório', direcionamento: 'Prioritário no plano; avaliar na prática', status: 'prioritario' },
                { competencia: 'Agilidade e prioridades', evidencia: 'Sem medida direta no relatório', direcionamento: 'Em desenvolvimento; avaliar na prática', status: 'em_desenvolvimento' },
            ],
            tecnicas: [
                { competencia: 'Sistema Domínio', pratica: 'Treinamento guiado, ambiente de prática e roteiro de uso', meta: 'Executar rotinas básicas com acompanhamento' },
                { competencia: 'Onboarding do cliente', pratica: 'Checklist documental, particularidades CCT etc', meta: 'Executar o ciclo de forma completa' },
                { competencia: 'Admissões e cadastros', pratica: 'Checklist documental e execução supervisionada', meta: 'Concluir processo e identificar pendências' },
                { competencia: 'Ponto e Benefícios', pratica: 'Conferir registros e lançar informações orientadas', meta: 'Aplicar checklist e explicar divergências' },
                { competencia: 'Férias e afastamentos', pratica: 'Acompanhar fluxo, documentos e calendário', meta: 'Executar etapas atribuídas com conferência' },
                { competencia: 'Folha e conferência', pratica: 'Observar fechamento e conferir lançamentos selecionados', meta: 'Identificar divergências e encaminhar correções' },
                { competencia: 'Obrigações e rescisões', pratica: 'Conhecer fluxo, prazos e responsabilidades; acompanhar casos', meta: 'Reconhecer documentos, riscos e limites da função' },
                { competencia: 'CCT e procedimentos', pratica: 'Estudar regras aplicáveis aos clientes sob orientação', meta: 'Localizar regras necessárias às rotinas' },
                { competencia: 'Organização documental', pratica: 'Padronizar arquivos e controle de pendências', meta: 'Manter rastreabilidade e agenda atualizada' },
            ],
            comportamentais: [
                { competencia: 'Autonomia', comportamento: 'Resolver rotinas aprendidas e encaminhar exceções', acao: 'Usar roteiro antes de pedir validação; registrar casos executados' },
                { competencia: 'Proatividade', comportamento: 'Antecipar pendências e riscos de prazo', acao: 'Revisar agenda diariamente; sinalizar pendência antes do vencimento' },
                { competencia: 'Comunicação assertiva', comportamento: 'Informar situação, impacto e próximo passo', acao: 'Praticar relatos objetivos; reunir exemplos de comunicação' },
                { competencia: 'Adaptabilidade', comportamento: 'Aplicar mudanças com segurança', acao: 'Testar novo fluxo com orientação; registrar aprendizado' },
                { competencia: 'Decisão e prioridades', comportamento: 'Distinguir rotina, urgência e exceção', acao: 'Definir prioridades com gestor; explicar critérios usados' },
                { competencia: 'Visibilidade', comportamento: 'Compartilhar entregas e necessidades de apoio', acao: 'Apresentar resumo semanal de concluídos, pendências e apoio' },
                { competencia: 'Visão Sistêmica', comportamento: 'Acompanhar demandas de maior complexidade do setor', acao: 'Orientando o time nos ajustes necessários a fim de evitar erros de processo' },
            ],
            acoes: [
                { foco: 'Avaliar domínio inicial e priorizar rotinas', responsaveis: 'Gestor e colaboradora', dias: 15, recorrencia: null, evidencia: 'Níveis iniciais registrados e rotinas selecionadas' },
                { foco: 'Concluir trilha inicial do Domínio e praticar', responsaveis: 'Colaboradora; apoio do gestor', dias: 30, recorrencia: null, evidencia: 'Roteiro aplicado em casos supervisionados' },
                { foco: 'Aplicar checklists de admissão, ponto e benefícios', responsaveis: 'Colaboradora; conferência do gestor', dias: 60, recorrencia: null, evidencia: 'Amostras conferidas e correções registradas' },
                { foco: 'Praticar conferência de folha e controles de prazo', responsaveis: 'Colaboradora; orientação do gestor', dias: 90, recorrencia: null, evidencia: 'Conferências documentadas e indicador de prazo' },
                { foco: 'Relatar entregas e antecipar pendências', responsaveis: 'Colaboradora; feedback do gestor', dias: null, recorrencia: 'semanal', evidencia: 'Resumo objetivo e exemplos de sinalização' },
                { foco: 'Avaliar evolução e pactuar próximo ciclo', responsaveis: 'Colaboradora, gestor e Diretoria', dias: 90, recorrencia: null, evidencia: 'Avaliação trimestral e novas prioridades' },
            ],
            indicadores: [
                { chave: 'prazos', nome: 'Prazos', formula: 'entregas no prazo ÷ entregas previstas × 100', meta_texto: '≥ 95%; sinalizar riscos antes do vencimento', tipo_meta: 'numerica', operador: '>=', valor_meta: 95, evidencia: 'Agenda e registro de entregas', calculo_automatico: null },
                { chave: 'retrabalho', nome: 'Retrabalho', formula: 'entregas corrigidas por erro de execução ÷ entregas conferidas × 100', meta_texto: 'Reduzir frente à linha de base; definir percentual após medição', tipo_meta: 'relativa_linha_base', operador: '<=', valor_meta: null, evidencia: 'Controle de correções e causas', calculo_automatico: null },
                { chave: 'conferencia', nome: 'Conferência', formula: 'rotinas com checklist completo ÷ rotinas que exigem checklist × 100', meta_texto: '100% das rotinas priorizadas', tipo_meta: 'numerica', operador: '=', valor_meta: 100, evidencia: 'Checklists datados', calculo_automatico: null },
                { chave: 'autonomia', nome: 'Autonomia', formula: 'rotinas consolidadas no nível 3 ÷ rotinas priorizadas × 100', meta_texto: 'Medir no ciclo 1; pactuar avanço no ciclo 2', tipo_meta: 'a_pactuar', operador: null, valor_meta: null, evidencia: 'Registro de nível e amostras', calculo_automatico: 'autonomia' },
                { chave: 'pendencias', nome: 'Pendências', formula: 'riscos sinalizados antes do prazo ÷ riscos identificados × 100', meta_texto: '100% dos riscos identificados', tipo_meta: 'numerica', operador: '=', valor_meta: 100, evidencia: 'Histórico de sinalizações', calculo_automatico: 'pendencias' },
                { chave: 'controles', nome: 'Controles', formula: 'revisões semanais realizadas ÷ revisões previstas × 100', meta_texto: '100% das revisões previstas', tipo_meta: 'numerica', operador: '=', valor_meta: 100, evidencia: 'Agenda e controle atualizado', calculo_automatico: 'controles' },
            ],
            ciclos: CICLOS,
        },
    };

    // Dados do PDI de exemplo (Julia Costa Faria) — validação da ferramenta
    const SEED_JULIA = {
        colaborador_nome: 'Julia Costa Faria',
        cargo_setor: 'Assistente de Departamento Pessoal',
        admissao: '2026-09-08',
        gestor_nome: 'Brenna Costa',
        data_inicio: '2026-10-07',
        contexto_desenvolvimento: 'Experiência informada de 1 ano e 7 meses no cargo de Encarregada de DP, concentrada em rotinas operacionais de DP completa; sem experiência no sistema Domínio e sem formação em Contabilidade. A prioridade é construir repertório técnico e prática supervisionada.',
        perfil_comportamental: {
            data_relatorio: '2026-09-11',
            disc: 'S',
            disc_descritor: 'Estabilidade e Suporte',
            descricao: 'Descreve estabilidade, paciência, colaboração, escuta ativa, comunicação calma e diplomática, orientação a processos e atenção aos detalhes. Indica busca de consenso e manutenção da calma sob pressão.',
            complementares: 'Como informações complementares, o relatório registra ISFJ e estilo Realizador. As oportunidades apontadas são abertura a mudanças e networking e visibilidade.',
            mbti: 'ISFJ',
            estilo: 'Realizador',
            oportunidades: 'Abertura a mudanças e networking e visibilidade',
        },
    };

    return {
        SECOES, CABECALHO_PADRAO, TEXTOS, ESCALA_TECNICA, ESCALA_COMPORTAMENTAL, ESCALA_PERFORMANCE,
        ESCALA_MELHORIAS, CRITERIOS_PILAR, PILARES_ROTULO, PILARES_CURTO, STATUS_PERFIL, STATUS_ACAO,
        RESULTADOS, DIRECIONAMENTOS, STATUS_FICHA, ATINGIMENTO, CICLOS, MODELO_DP, SEED_JULIA,
    };
});
