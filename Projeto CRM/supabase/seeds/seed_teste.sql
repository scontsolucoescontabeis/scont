-- ============================================================
-- SCONT Messenger CRM — Seed de Dados de Teste
-- 20 conversas · 10 contatos · mensagens · tarefas
-- Execute no SQL Editor do Supabase (projeto Portal)
-- ============================================================

DO $$
DECLARE
  -- Agentes (usa os usuários cadastrados; NULL se ainda não houver)
  agente1 UUID := (SELECT id FROM usuarios ORDER BY criado_em ASC  LIMIT 1);
  agente2 UUID := (SELECT id FROM usuarios ORDER BY criado_em DESC LIMIT 1);

  -- IDs dos contatos (resolvidos após upsert)
  c1 UUID; c2 UUID; c3 UUID; c4 UUID; c5 UUID;
  c6 UUID; c7 UUID; c8 UUID; c9 UUID; c10 UUID;

  -- IDs das conversas (resolvidos após insert)
  d1  UUID; d2  UUID; d3  UUID; d4  UUID; d5  UUID;
  d6  UUID; d7  UUID; d8  UUID; d9  UUID; d10 UUID;
  d11 UUID; d12 UUID; d13 UUID; d14 UUID; d15 UUID;
  d16 UUID; d17 UUID; d18 UUID; d19 UUID; d20 UUID;

BEGIN

-- ── 1. Contatos (upsert → id real do banco) ───────────────────
INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110001','Maria Aparecida Santos','Santos & Cia Comércio Ltda','maria@santosecia.com.br','12.345.678/0001-90')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c1;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110002','João Carlos Ferreira','Ferreira Construções ME','joao@ferreiraconstrucoes.com','98.765.432/0001-10')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c2;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110003','Ana Paula Rodrigues','AP Serviços EIRELI','ana@apservicos.com.br','234.567.890-12')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c3;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110004','Carlos Eduardo Mendes','Mendes & Associados Advocacia','carlos@mendesadv.com.br','345.678.901-23')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c4;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110005','Fernanda Lima Costa','Costa Distribuidora Ltda','fernanda@costadist.com.br','45.678.901/0001-23')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c5;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110006','Roberto Alves Pereira','Pereira Tecnologia S.A.','roberto@pereiratec.com.br','56.789.012/0001-34')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c6;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110007','Luciana Souza Barbosa','Barbosa Distribuidora ME','luciana@barbosadist.com.br','678.901.234-56')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c7;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110008','Paulo Henrique Oliveira','Oliveira & Filhos Construtora','paulo@oliveiraconstrutora.com','78.901.234/0001-56')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c8;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110009','Mariana Cristina Torres','Torres Consultoria Empresarial','mariana@torresconsult.com.br','890.123.456-78')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c9;

INSERT INTO contatos (telefone, nome, empresa, email, cpf_cnpj)
  VALUES ('5561991110010','Diego Rafael Nascimento','Nascimento Agropecuária Ltda','diego@nascimentoagro.com.br','90.123.456/0001-78')
  ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome RETURNING id INTO c10;

-- ── 2. Conversas ──────────────────────────────────────────────
-- Protocolo gerado automaticamente pelo trigger

-- PESSOAL
INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c1,'PESSOAL','ENCERRADA',NOW()-'25 days'::interval,NOW()-'25 days'::interval+'22 min'::interval,agente1,NOW()-'25 days'::interval+'22 min'::interval)
  RETURNING id INTO d1;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c2,'PESSOAL','ENCERRADA',NOW()-'18 days'::interval,NOW()-'18 days'::interval+'35 min'::interval,agente2,NOW()-'18 days'::interval+'35 min'::interval)
  RETURNING id INTO d2;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c3,'PESSOAL','EM_ATENDIMENTO',NOW()-'2 days'::interval,NULL,agente1,NOW()-'1 hour'::interval)
  RETURNING id INTO d3;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c4,'PESSOAL','ABERTA',NOW()-'3 hours'::interval,NULL,NULL,NOW()-'3 hours'::interval)
  RETURNING id INTO d4;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c5,'PESSOAL','AGUARDANDO',NOW()-'1 day'::interval,NULL,agente1,NOW()-'4 hours'::interval)
  RETURNING id INTO d5;

-- CONTABIL
INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c6,'CONTABIL','ENCERRADA',NOW()-'22 days'::interval,NOW()-'22 days'::interval+'18 min'::interval,agente2,NOW()-'22 days'::interval+'18 min'::interval)
  RETURNING id INTO d6;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c7,'CONTABIL','ENCERRADA',NOW()-'14 days'::interval,NOW()-'14 days'::interval+'42 min'::interval,agente1,NOW()-'14 days'::interval+'42 min'::interval)
  RETURNING id INTO d7;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c8,'CONTABIL','EM_ATENDIMENTO',NOW()-'3 days'::interval,NULL,agente2,NOW()-'2 hours'::interval)
  RETURNING id INTO d8;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c9,'CONTABIL','ABERTA',NOW()-'1 hour'::interval,NULL,NULL,NOW()-'1 hour'::interval)
  RETURNING id INTO d9;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c10,'CONTABIL','ENCERRADA',NOW()-'8 days'::interval,NOW()-'8 days'::interval+'28 min'::interval,agente1,NOW()-'8 days'::interval+'28 min'::interval)
  RETURNING id INTO d10;

-- ADMINISTRATIVO
INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c1,'ADMINISTRATIVO','ENCERRADA',NOW()-'20 days'::interval,NOW()-'20 days'::interval+'15 min'::interval,agente1,NOW()-'20 days'::interval+'15 min'::interval)
  RETURNING id INTO d11;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c2,'ADMINISTRATIVO','EM_ATENDIMENTO',NOW()-'1 day'::interval,NULL,agente2,NOW()-'30 min'::interval)
  RETURNING id INTO d12;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c3,'ADMINISTRATIVO','ABERTA',NOW()-'2 hours'::interval,NULL,NULL,NOW()-'2 hours'::interval)
  RETURNING id INTO d13;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c4,'ADMINISTRATIVO','AGUARDANDO',NOW()-'2 days'::interval,NULL,agente1,NOW()-'6 hours'::interval)
  RETURNING id INTO d14;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c5,'ADMINISTRATIVO','ENCERRADA',NOW()-'5 days'::interval,NOW()-'5 days'::interval+'9 min'::interval,agente2,NOW()-'5 days'::interval+'9 min'::interval)
  RETURNING id INTO d15;

-- TRIBUTARIO
INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c6,'TRIBUTARIO','ENCERRADA',NOW()-'12 days'::interval,NOW()-'12 days'::interval+'38 min'::interval,agente2,NOW()-'12 days'::interval+'38 min'::interval)
  RETURNING id INTO d16;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c7,'TRIBUTARIO','ENCERRADA',NOW()-'5 days'::interval,NOW()-'5 days'::interval+'51 min'::interval,agente1,NOW()-'5 days'::interval+'51 min'::interval)
  RETURNING id INTO d17;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c8,'TRIBUTARIO','EM_ATENDIMENTO',NOW()-'4 hours'::interval,NULL,agente2,NOW()-'1 hour'::interval)
  RETURNING id INTO d18;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c9,'TRIBUTARIO','ABERTA',NOW()-'30 min'::interval,NULL,NULL,NOW()-'30 min'::interval)
  RETURNING id INTO d19;

INSERT INTO conversas (contato_id,departamento,status,aberto_em,encerrado_em,agente_id,atualizado_em)
  VALUES (c10,'TRIBUTARIO','AGUARDANDO',NOW()-'3 days'::interval,NULL,agente1,NOW()-'8 hours'::interval)
  RETURNING id INTO d20;

-- ── 3. Mensagens ──────────────────────────────────────────────
INSERT INTO mensagens (conversa_id,origem,conteudo,agente_id,criado_em) VALUES
  (d1,'CLIENTE','Boa tarde! Preciso processar a admissão de um novo funcionário. Quais documentos são necessários?',NULL,NOW()-'25 days'::interval),
  (d1,'AGENTE','Boa tarde! Para a admissão precisamos: RG, CPF, carteira de trabalho, comprovante de residência e PIS.',agente1,NOW()-'25 days'::interval+'5 min'::interval),
  (d1,'CLIENTE','Sim, todos os documentos estão em mãos.',NULL,NOW()-'25 days'::interval+'12 min'::interval),
  (d1,'AGENTE','Perfeito! Vou processar agora. Em breve envio o contrato para assinatura.',agente1,NOW()-'25 days'::interval+'18 min'::interval),
  (d1,'SISTEMA','Conversa encerrada.',NULL,NOW()-'25 days'::interval+'22 min'::interval),

  (d2,'CLIENTE','Olá, quero tirar férias no próximo mês. Como funciona o processo?',NULL,NOW()-'18 days'::interval),
  (d2,'AGENTE','As férias devem ser solicitadas com 30 dias de antecedência. Vou verificar seu saldo.',agente2,NOW()-'18 days'::interval+'8 min'::interval),
  (d2,'CLIENTE','Tenho 3 meses trabalhados. Já tenho direito?',NULL,NOW()-'18 days'::interval+'15 min'::interval),
  (d2,'AGENTE','Ainda não. O direito completo ocorre após 12 meses, mas podemos verificar férias proporcionais.',agente2,NOW()-'18 days'::interval+'25 min'::interval),
  (d2,'CLIENTE','Entendi, obrigado!',NULL,NOW()-'18 days'::interval+'30 min'::interval),
  (d2,'SISTEMA','Conversa encerrada.',NULL,NOW()-'18 days'::interval+'35 min'::interval),

  (d3,'CLIENTE','Bom dia! Preciso iniciar o processo de rescisão de um funcionário.',NULL,NOW()-'2 days'::interval),
  (d3,'AGENTE','Qual o motivo da rescisão — sem justa causa ou com justa causa?',agente1,NOW()-'2 days'::interval+'10 min'::interval),
  (d3,'CLIENTE','Sem justa causa. Ele tem 2 anos de empresa.',NULL,NOW()-'2 days'::interval+'20 min'::interval),
  (d3,'AGENTE','Estou calculando as verbas rescisórias. Em breve envio o demonstrativo.',agente1,NOW()-'1 hour'::interval),

  (d4,'CLIENTE','Oi, preciso de uma declaração de vínculo empregatício para financiamento.',NULL,NOW()-'3 hours'::interval),

  (d5,'CLIENTE','Preciso de ajuda com o eSocial. Deu um erro no envio da folha.',NULL,NOW()-'1 day'::interval),
  (d5,'AGENTE','Pode me enviar o código do erro que apareceu?',agente1,NOW()-'1 day'::interval+'5 min'::interval),
  (d5,'CLIENTE','Vou tirar um print e te mando.',NULL,NOW()-'4 hours'::interval),

  (d6,'CLIENTE','Meu DAS do MEI venceu. Como faço para pagar em atraso?',NULL,NOW()-'22 days'::interval),
  (d6,'AGENTE','Você pode emitir o DAS com multa e juros direto pelo Portal do Empreendedor ou Receita Federal.',agente2,NOW()-'22 days'::interval+'7 min'::interval),
  (d6,'CLIENTE','Consegui emitir e pagar. Obrigado!',NULL,NOW()-'22 days'::interval+'15 min'::interval),
  (d6,'SISTEMA','Conversa encerrada.',NULL,NOW()-'22 days'::interval+'18 min'::interval),

  (d7,'CLIENTE','Preciso do balanço patrimonial do ano passado para apresentar ao banco.',NULL,NOW()-'14 days'::interval),
  (d7,'AGENTE','Vou gerar e assinar digitalmente. Qual o prazo que você precisa?',agente1,NOW()-'14 days'::interval+'10 min'::interval),
  (d7,'CLIENTE','Amanhã de manhã se possível.',NULL,NOW()-'14 days'::interval+'15 min'::interval),
  (d7,'AGENTE','Pode deixar, estarei enviando até as 9h.',agente1,NOW()-'14 days'::interval+'35 min'::interval),
  (d7,'SISTEMA','Conversa encerrada.',NULL,NOW()-'14 days'::interval+'42 min'::interval),

  (d8,'CLIENTE','Tenho dúvidas sobre o imposto de renda da minha empresa esse ano.',NULL,NOW()-'3 days'::interval),
  (d8,'AGENTE','Qual o regime tributário da sua empresa?',agente2,NOW()-'3 days'::interval+'30 min'::interval),
  (d8,'CLIENTE','Lucro Presumido.',NULL,NOW()-'3 days'::interval+'45 min'::interval),
  (d8,'AGENTE','Entendido. Estou analisando sua escrituração e retorno em breve com os valores.',agente2,NOW()-'2 hours'::interval),

  (d9,'CLIENTE','Preciso de uma certidão negativa de débitos para licitação. Como solicito?',NULL,NOW()-'1 hour'::interval),

  (d10,'CLIENTE','Posso parcelar os impostos atrasados? Quanto ficaria cada parcela?',NULL,NOW()-'8 days'::interval),
  (d10,'AGENTE','Sim! O PERT permite parcelamento em até 60 meses. Me passe o valor total do débito.',agente1,NOW()-'8 days'::interval+'8 min'::interval),
  (d10,'CLIENTE','São R$ 24.000 entre federal e estadual.',NULL,NOW()-'8 days'::interval+'14 min'::interval),
  (d10,'AGENTE','Em 60 meses ficaria em torno de R$ 520/mês. Posso iniciar o processo de adesão?',agente1,NOW()-'8 days'::interval+'22 min'::interval),
  (d10,'CLIENTE','Sim, por favor!',NULL,NOW()-'8 days'::interval+'25 min'::interval),
  (d10,'SISTEMA','Conversa encerrada.',NULL,NOW()-'8 days'::interval+'28 min'::interval),

  (d11,'CLIENTE','Meu alvará vence esse mês. O que preciso para renovar?',NULL,NOW()-'20 days'::interval),
  (d11,'AGENTE','Para renovar precisamos: IPTU em dia, Bombeiros, Vigilância Sanitária e taxa municipal.',agente1,NOW()-'20 days'::interval+'5 min'::interval),
  (d11,'CLIENTE','Tenho tudo. Pode protocolar!',NULL,NOW()-'20 days'::interval+'10 min'::interval),
  (d11,'SISTEMA','Conversa encerrada.',NULL,NOW()-'20 days'::interval+'15 min'::interval),

  (d12,'CLIENTE','Preciso alterar o contrato social para incluir um novo sócio.',NULL,NOW()-'1 day'::interval),
  (d12,'AGENTE','Qual será a participação societária e função do novo sócio?',agente2,NOW()-'1 day'::interval+'20 min'::interval),
  (d12,'CLIENTE','30% de participação. Ele será diretor financeiro.',NULL,NOW()-'30 min'::interval),

  (d13,'CLIENTE','Quero abrir uma empresa. Por onde começo?',NULL,NOW()-'2 hours'::interval),

  (d14,'CLIENTE','Precisamos de uma procuração para representar a empresa junto à Receita Federal.',NULL,NOW()-'2 days'::interval),
  (d14,'AGENTE','Podemos elaborar. Você pode nos enviar os poderes que devem ser outorgados?',agente1,NOW()-'2 days'::interval+'15 min'::interval),
  (d14,'CLIENTE','Vou verificar com o jurídico e te retorno.',NULL,NOW()-'6 hours'::interval),

  (d15,'CLIENTE','Vocês emitem nota fiscal de serviço?',NULL,NOW()-'5 days'::interval),
  (d15,'AGENTE','Sim! Qual o serviço contratado para constar na nota?',agente2,NOW()-'5 days'::interval+'3 min'::interval),
  (d15,'CLIENTE','Consultoria contábil mensal.',NULL,NOW()-'5 days'::interval+'6 min'::interval),
  (d15,'SISTEMA','Conversa encerrada.',NULL,NOW()-'5 days'::interval+'9 min'::interval),

  (d16,'CLIENTE','Minha empresa pode aderir ao Simples Nacional? Faturamento de R$ 2,8 milhões.',NULL,NOW()-'12 days'::interval),
  (d16,'AGENTE','O limite é R$ 4,8 milhões. Vou verificar se há impedimentos cadastrais.',agente2,NOW()-'12 days'::interval+'10 min'::interval),
  (d16,'CLIENTE','Há débitos em aberto com a Receita. Isso impede?',NULL,NOW()-'12 days'::interval+'20 min'::interval),
  (d16,'AGENTE','Impede. Precisamos regularizar os débitos primeiro.',agente2,NOW()-'12 days'::interval+'30 min'::interval),
  (d16,'SISTEMA','Conversa encerrada.',NULL,NOW()-'12 days'::interval+'38 min'::interval),

  (d17,'CLIENTE','Qual a alíquota de IRPJ para Lucro Real?',NULL,NOW()-'5 days'::interval),
  (d17,'AGENTE','Alíquota base 15%, com adicional de 10% sobre o que exceder R$ 20 mil/mês.',agente1,NOW()-'5 days'::interval+'12 min'::interval),
  (d17,'CLIENTE','E a CSLL incide em cima disso também?',NULL,NOW()-'5 days'::interval+'20 min'::interval),
  (d17,'AGENTE','Sim, CSLL é 9% sobre o Lucro Real. Posso montar uma simulação para você?',agente1,NOW()-'5 days'::interval+'35 min'::interval),
  (d17,'CLIENTE','Por favor! Mando os dados da escrituração.',NULL,NOW()-'5 days'::interval+'45 min'::interval),
  (d17,'SISTEMA','Conversa encerrada.',NULL,NOW()-'5 days'::interval+'51 min'::interval),

  (d18,'CLIENTE','Recebi uma notificação do ICMS. Podem me ajudar a entender?',NULL,NOW()-'4 hours'::interval),
  (d18,'AGENTE','Pode enviar a notificação por foto ou PDF?',agente2,NOW()-'3 hours'::interval),
  (d18,'CLIENTE','[Imagem enviada]',NULL,NOW()-'2 hours'::interval),
  (d18,'AGENTE','Parece ser uma autuação por diferença de alíquota interestadual. Elaborando a defesa.',agente2,NOW()-'1 hour'::interval),

  (d19,'CLIENTE','Como regularizar débitos junto à Fazenda Estadual?',NULL,NOW()-'30 min'::interval),

  (d20,'CLIENTE','Preciso parcelar dívida com a PGFN. Qual a documentação?',NULL,NOW()-'3 days'::interval),
  (d20,'AGENTE','Para o PERT-PGFN precisamos: certidão de regularidade, CNPJ, demonstrativo de débitos e procuração.',agente1,NOW()-'3 days'::interval+'20 min'::interval),
  (d20,'CLIENTE','Vou verificar o acesso ao e-CAC e te retorno.',NULL,NOW()-'8 hours'::interval);

-- ── 4. Transferências ─────────────────────────────────────────
INSERT INTO transferencias (conversa_id,de_departamento,para_departamento,motivo,criado_em) VALUES
  (d3, 'PESSOAL',   'ADMINISTRATIVO','Rescisão envolve alteração contratual',         NOW()-'2 days'::interval+'30 min'::interval),
  (d8, 'CONTABIL',  'TRIBUTARIO',    'Questão tributária específica de IRPJ',          NOW()-'3 days'::interval+'1 hour'::interval),
  (d16,'TRIBUTARIO','ADMINISTRATIVO','Necessário verificar situação cadastral primeiro',NOW()-'12 days'::interval+'5 min'::interval);

-- ── 5. Tarefas ────────────────────────────────────────────────
IF agente1 IS NOT NULL THEN
  INSERT INTO tarefas (titulo,descricao,demandante,departamento,status,prioridade,criado_por,atribuido_a,prazo,conversa_id,criado_em) VALUES
    ('Processar rescisão sem justa causa',
     'Calcular verbas rescisórias: aviso prévio, 13º proporcional, férias + 1/3, multa FGTS 40%. Emitir TRCT.',
     'Ferreira Construções ME','PESSOAL','ABERTA','ALTA',agente1,agente1,NOW()+'3 days'::interval,d3,NOW()-'2 days'::interval),

    ('Balanço patrimonial para banco — Barbosa Distribuidora',
     'Gerar, revisar e assinar digitalmente o balanço 2025 para apresentação ao Bradesco.',
     'Barbosa Distribuidora ME','CONTABIL','CONCLUIDA','URGENTE',agente1,agente1,NOW()-'13 days'::interval,d7,NOW()-'14 days'::interval),

    ('Elaborar defesa contra autuação ICMS',
     'Preparar impugnação administrativa. Prazo: 30 dias do recebimento da notificação.',
     'Pereira Tecnologia S.A.','TRIBUTARIO','EM_EXECUCAO','URGENTE',agente1,agente1,NOW()+'15 days'::interval,d18,NOW()-'4 hours'::interval),

    ('Adesão ao parcelamento PERT — PGFN',
     'Verificar débitos, calcular parcelas e formalizar adesão ao parcelamento especial.',
     'Nascimento Agropecuária Ltda','TRIBUTARIO','ABERTA','ALTA',agente1,agente1,NOW()+'7 days'::interval,d20,NOW()-'3 days'::interval),

    ('Alterar contrato social — inclusão de sócio',
     'Minutar alteração contratual com nova participação societária (30%). Registrar na Junta Comercial.',
     'Ferreira Construções ME','ADMINISTRATIVO','EM_EXECUCAO','NORMAL',agente1,agente1,NOW()+'5 days'::interval,d12,NOW()-'1 day'::interval);
END IF;

END $$;

-- ── Verificação final ─────────────────────────────────────────
SELECT 'Contatos'     AS tabela, COUNT(*) AS total FROM contatos   WHERE telefone LIKE '5561991110%'
UNION ALL
SELECT 'Conversas',             COUNT(*)           FROM conversas  WHERE aberto_em > NOW()-'26 days'::interval
UNION ALL
SELECT 'Mensagens',             COUNT(*)           FROM mensagens  WHERE criado_em > NOW()-'26 days'::interval
UNION ALL
SELECT 'Transferencias',        COUNT(*)           FROM transferencias WHERE criado_em > NOW()-'26 days'::interval
UNION ALL
SELECT 'Tarefas',               COUNT(*)           FROM tarefas    WHERE criado_em  > NOW()-'26 days'::interval;
