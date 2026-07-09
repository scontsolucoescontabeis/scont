-- ============================================================
-- GERADOR DE MODELOS — Seed: 9 modelos de Admissão + Evento "Admissão"
-- Conteúdo transcrito dos arquivos em "MODELO ADMISSÃO/", com os dados
-- do último preenchimento substituídos por variáveis do sistema.
-- Trechos específicos de cada acordo (valores de hora extra, horário
-- semanal, dados de contato da empresa) não têm campo correspondente
-- no cadastro e ficam como texto para preenchimento manual.
-- Execute no SQL Editor do Supabase (depois de schema-gerador-modelos.sql
-- e schema-gerador-modelos-eventos.sql)
-- ============================================================

DO $seed$
DECLARE
  v_evento_id         UUID;
  v_confiabilidade    UUID;
  v_lgpd              UUID;
  v_imagem            UUID;
  v_vt_solicitacao    UUID;
  v_vt_desistencia    UUID;
  v_plano_saude       UUID;
  v_compensacao       UUID;
  v_prorrogacao       UUID;
  v_responsabilidade  UUID;
BEGIN

  -- 1) Termo de Confiabilidade -------------------------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Termo de Confiabilidade',
    'Admissão — sigilo de informações da empresa',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Termo de Confiabilidade</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empregado</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}} — CPF {{empregado.cpf}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empresa</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empresa.nome_empresa}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 12px;">Pelo presente termo de confiabilidade, eu <strong>{{empregado.nome_empregado}}</strong>, portador do CPF {{empregado.cpf}}, funcionário da empresa <strong>{{empresa.nome_empresa}}</strong>, comprometo-me a guardar segredo das informações sigilosas obtidas nesta empresa, entendendo-se como tais as de caráter técnico, funcional ou pessoal, que porventura possam instigar ou interessar à concorrência, relacionadas ou não com o exercício de minha função.</p>
    <p style="margin:0 0 12px;">Declaro, ainda, que estou ciente de que qualquer prejuízo causado à empresa, perpetrado pela quebra do sigilo acima declinado, gerará o pagamento de multa no valor de 20 (vinte) salários-mínimos atuais, além das implicações nas esferas cível, criminal e administrativa.</p>
    <p style="margin:0 0 12px;">Por derradeiro, declaro que li e compreendi os termos aqui dispostos, assinando-o voluntariamente.</p>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
    <div style="margin-top:22px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="center" style="font-size:12px;">_____________________________<br><strong>({{empresa.nome_empresa}})</strong></td>
      <td align="center" style="font-size:12px;">_____________________________<br><strong>({{empregado.nome_empregado}})</strong></td>
    </tr></table>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_confiabilidade;

  -- 2) Termo LGPD ----------------------------------------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Termo de Consentimento LGPD',
    'Admissão — consentimento para tratamento de dados pessoais',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Termo de Consentimento LGPD</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Titular</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}} — CPF {{empregado.cpf}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empresa (Controlador)</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empresa.nome_empresa}} — CNPJ {{empresa.cnpj}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 12px;">Este documento visa registrar a manifestação livre, informada e inequívoca pela qual o Titular concorda com o tratamento de seus dados pessoais para finalidade específica, em conformidade com a Lei nº 13.709 – Lei Geral de Proteção de Dados Pessoais (LGPD).</p>
    <p style="margin:0 0 12px;">Ao assinar o presente termo, o Titular consente e concorda que a empresa <strong>{{empresa.nome_empresa}}</strong>, C.N.P.J: {{empresa.cnpj}}, com sede na {{empresa.endereco}}, {{empresa.cidade}}, CEP: {{empresa.cep}}, telefone _____________________, e-mail _____________________, doravante denominada Controlador, tome decisões referentes ao tratamento de seus dados pessoais, bem como realize o tratamento de seus dados pessoais, envolvendo operações como as que se referem a coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração.</p>
    <p style="margin:0 0 4px;font-weight:700;color:#7a1e1e;">Dados Pessoais</p>
    <p style="margin:0 0 8px;">O Controlador fica autorizado a tomar decisões referentes ao tratamento e a realizar o tratamento dos seguintes dados pessoais do Titular:</p>
    <ul style="margin:0 0 12px;padding-left:18px;">
      <li>Nome completo.</li>
      <li>Data de nascimento.</li>
      <li>Número e imagem da Carteira de Identidade (RG).</li>
      <li>Número e imagem do Cadastro de Pessoas Físicas (CPF).</li>
      <li>Número e imagem da Carteira Nacional de Habilitação (CNH).</li>
      <li>Fotografia 3x4.</li>
      <li>Estado civil.</li>
      <li>Nível de instrução ou escolaridade.</li>
      <li>Endereço completo.</li>
      <li>Números de telefone, aplicativos de comunicação como WhatsApp, Telegram e similares e endereços de e-mail.</li>
      <li>Banco, agência e número de contas bancárias.</li>
      <li>Comunicação, verbal e escrita, mantida entre o Titular e o Controlador.</li>
    </ul>
    <p style="margin:0 0 4px;font-weight:700;color:#7a1e1e;">Finalidades do Tratamento dos Dados</p>
    <p style="margin:0 0 8px;">O tratamento dos dados pessoais listados neste termo tem as seguintes finalidades:</p>
    <ul style="margin:0 0 12px;padding-left:18px;">
      <li>Possibilitar que o Controlador identifique e entre em contato com o Titular para fins de relacionamento contratual.</li>
      <li>Possibilitar que o Controlador cumpra com as obrigações trabalhistas e previdenciárias.</li>
      <li>Possibilitar que o Controlador envie ou forneça Informações Pessoais e de seus dependentes para viabilizar implantação de benefícios, junto a novos fornecedores, caso seja necessário.</li>
    </ul>
    <p style="margin:0 0 4px;font-weight:700;color:#7a1e1e;">Confidencialidade</p>
    <p style="margin:0 0 12px;">Estou ciente do compromisso assumido pelo controlador de tratar os meus Dados Pessoais de forma sigilosa e confidencial, mantendo-os em ambiente seguro e não sendo utilizados para qualquer fim que não os descritos acima.</p>
    <p style="margin:0 0 4px;font-weight:700;color:#7a1e1e;">Revogação</p>
    <p style="margin:0 0 12px;">Estou ciente que, a qualquer tempo, posso retirar o consentimento ora fornecido, hipótese em que as atividades desenvolvidas pelo controlador, no âmbito de nossa relação, poderão ser prejudicadas. Declaro e concordo que os meus Dados Pessoais poderão ser armazenados, mesmo após o término do tratamento — inclusive após a revogação do consentimento, para cumprimento de obrigação legal ou regulatória pelo controlador ou desde que tornados anônimos.</p>
    <p style="margin:0 0 4px;font-weight:700;color:#7a1e1e;">Canal de Comunicação</p>
    <p style="margin:0 0 12px;">Manifesto-me de forma informada, livre, expressa e consciente, no sentido de autorizar o controlador a realizar contato comigo através dos seguintes canais: e-mail, ligação, SMS ou App de comunicação.</p>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
    <div style="margin-top:22px;"></div>
    <p style="text-align:center;"><strong>{{empregado.nome_empregado}}</strong></p>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_lgpd;

  -- 3) Termo de Autorização de Uso de Imagem --------------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Termo de Autorização de Uso de Imagem',
    'Admissão — autorização de uso de imagem',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Autorização de Uso de Imagem</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empregado</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}} — CPF {{empregado.cpf}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empresa</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empresa.nome_empresa}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 12px;">Pelo presente instrumento, eu <strong>{{empregado.nome_empregado}}</strong>, inscrito(a) no CPF/MF sob o nº {{empregado.cpf}}, autorizo, a título gratuito e a qualquer tempo, a captação e utilização de minha imagem em divulgação dos serviços pela empresa <strong>{{empresa.nome_empresa}}</strong>, inscrita no CNPJ/MF sob o nº {{empresa.cnpj}}. Declaro, em caráter irrevogável e irretratável, estar ciente e de acordo com o uso institucional e comercial do material captado. E, por ser a expressão da verdade, firmo o presente Termo de Autorização de Uso de Imagem.</p>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual_extenso}}.</p>
    <div style="margin-top:22px;"></div>
    <p style="text-align:center;">____________________________________<br><strong>{{empregado.nome_empregado}}</strong><br><strong>CPF: {{empregado.cpf}}</strong></p>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_imagem;

  -- 4) Solicitação de Vale-Transporte ---------------------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Solicitação de Vale-Transporte',
    'Admissão — opção pela utilização do Vale-Transporte',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Solicitação de Vale-Transporte</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empregado</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}} — CPF {{empregado.cpf}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Função / CTPS</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.desc_funcao}} — {{empregado.ctps}} - {{empregado.serie_ctps}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 10px;">Empresa: <strong>{{empresa.nome_empresa}}</strong> — Endereço: {{empresa.endereco}} — {{empresa.cidade}} — CEP: {{empresa.cep}}</p>
    <p style="margin:0 0 10px;">( &nbsp;) Opto pela Utilização do Vale-Transporte &nbsp;&nbsp;&nbsp; ( &nbsp;) Não Opto pela Utilização do Vale-Transporte</p>
    <p style="margin:0 0 10px;">Nos termos da legislação vigente, solicito receber o Vale-Transporte e comprometo-me:</p>
    <p style="margin:0 0 6px;">a) A utilizá-lo exclusivamente para meu efetivo deslocamento residência-trabalho e vice-versa;</p>
    <p style="margin:0 0 6px;">b) A renovar anualmente ou sempre que ocorrer alteração no meu endereço residencial ou dos serviços e meios de transportes mais adequados ao meu deslocamento residência-trabalho e vice-versa;</p>
    <p style="margin:0 0 6px;">c) Autorizo a descontar até 6% (seis por cento) do meu salário-básico mensal para ocorrer o custeio do Vale-Transporte;</p>
    <p style="margin:0 0 10px;">d) Declaro estar ciente de que a declaração falsa ou o uso indevido do Vale-Transporte constituem falta grave.</p>
    <p style="margin:0 0 10px;">Minha residência atual:<br>
    Endereço: _____________________________ Nº: _____ &nbsp; Compl.: _____________ Bairro: _____________<br>
    Cidade: _____________________ UF: _____ CEP: _____________</p>
    <p style="margin:0 0 4px;font-weight:700;color:#7a1e1e;">Meio de Transporte</p>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px;" border="1">
    <tr><th>Tipo</th><th>Quantidade Ida e Volta</th><th>Valor Unitário</th></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    </table>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
    <div style="margin-top:18px;"></div>
    <p style="text-align:center;">_____________________________<br>{{empregado.nome_empregado}}</p>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_vt_solicitacao;

  -- 5) Opção de Desistência de Vale-Transporte ------------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Opção de Desistência de Vale-Transporte',
    'Admissão — desistência da utilização do Vale-Transporte',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Desistência de Vale-Transporte</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empregado</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}} — CPF {{empregado.cpf}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empresa</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empresa.nome_empresa}} — CNPJ {{empresa.cnpj}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 10px;">Endereço: {{empresa.endereco}} — {{empresa.cidade}} — CEP: {{empresa.cep}}</p>
    <p style="margin:0 0 10px;">Prezados Senhores:</p>
    <p style="margin:0 0 10px;">Pelo presente venho desistir da utilização de Vale-Transporte previsto na Lei nº 7.418, de 16/12/1985, com advento da Lei nº 7.619, de 30/09/1987 e a Nova Regulamentação pelo Decreto nº 95.247, de 17/11/1987.</p>
    <p style="margin:0 0 10px;">Esta decisão é válida enquanto não necessitar deste recurso legal por tempo indeterminado, de acordo com a minha livre e espontânea vontade.</p>
    <p style="margin:0 0 10px;">Função: {{empregado.desc_funcao}}</p>
    <p style="margin:0 0 4px;">Atenciosamente,</p>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
    <div style="margin-top:20px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="center" style="font-size:12px;">_____________________________<br>{{empregado.nome_empregado}}</td>
      <td align="center" style="font-size:12px;">_____________________________<br>Responsável Legal</td>
    </tr></table>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_vt_desistencia;

  -- 6) Autorização de Desconto do Plano de Saúde ----------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Autorização de Desconto do Plano de Saúde',
    'Admissão — opção de adesão ao plano de saúde',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Autorização — Plano de Saúde</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empregado</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}} — CPF {{empregado.cpf}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empresa</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empresa.nome_empresa}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 10px;">Tomei ciência dos benefícios oferecidos pela empresa {{empresa.nome_empresa}}, CNPJ {{empresa.cnpj}}, e estou marcando com X minha opção de aderir ou não aderir, conforme relacionados abaixo.</p>
    <p style="margin:0 0 10px;">Estou ciente e de acordo com as condições de pagamento do referido benefício, tanto para mim como para meu(s) dependente(s) declarado(s) também como optante(s), bem como os reajustes anuais e por faixa etária, tabela de valores para quem optar pelo plano com coparticipação, prazos e carências.</p>
    <p style="margin:0 0 10px;">( &nbsp;) Tenho interesse em aderir o plano &nbsp;&nbsp;&nbsp; ( &nbsp;) Não tenho interesse em aderir o plano</p>
    <table style="width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:10px;" border="1">
    <tr><th>Plano</th><th>Utilizado</th><th>Desconto Colaborador</th><th>Valor Colaborador</th><th>Valor Dependente</th><th>Valor Dependente</th><th>Valor Dependente</th><th>Valor Dependente</th></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
    </table>
    <p style="margin:0 0 8px;">Número de dependentes: _____ &nbsp;&nbsp; Valor com desconto colaborador: _____________________________</p>
    <p style="margin:0 0 10px;">Valor total desconto em folha: _____________________________</p>
    <p style="margin:0 0 10px;">Por fim, autorizo o desconto do referido benefício em folha de pagamento, conforme política de benefícios praticada pela empresa.</p>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual_extenso}}.</p>
    <div style="margin-top:20px;"></div>
    <p style="text-align:center;">_____________________________<br>Assinatura<br>CPF: {{empregado.cpf}}</p>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_plano_saude;

  -- 7) Acordo de Compensação de Horas de Trabalho ---------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Acordo de Compensação de Horas de Trabalho',
    'Admissão — banco de horas / compensação semanal',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-acordo-comp * { box-sizing: border-box; }
  .gm-acordo-comp {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-acordo-comp .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-acordo-comp .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-acordo-comp .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-acordo-comp .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-acordo-comp .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-acordo-comp .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-acordo-comp .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-acordo-comp .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-acordo-comp .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-acordo-comp .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-acordo-comp .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-acordo-comp .schedule-box {
    margin: 8px 0 24px 0;
  }
  .gm-acordo-comp .schedule-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-acordo-comp table.schedule {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-acordo-comp table.schedule th {
    background-color: #7a1e1e;
    color: #ffffff;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-weight: 500;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    font-size: 11px;
    padding: 10px 8px;
    text-align: center;
    border: 1px solid #7a1e1e;
  }
  .gm-acordo-comp table.schedule td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-acordo-comp table.schedule tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-acordo-comp table.schedule td.dia {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-acordo-comp .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-acordo-comp .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-acordo-comp .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-acordo-comp .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-acordo-comp .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-acordo-comp .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-acordo-comp .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-acordo-comp .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-acordo-comp .header {
      padding: 16px 28px;
    }
    .gm-acordo-comp .header .logo { font-size: 19px; }
    .gm-acordo-comp .header .tagline { font-size: 9px; }
    .gm-acordo-comp .title-block {
      padding: 14px 28px 4px 28px;
    }
    .gm-acordo-comp .title-block .eyebrow { font-size: 10px; }
    .gm-acordo-comp .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-acordo-comp .body-content {
      padding: 10px 28px 4px 28px;
      font-size: 12.5px;
      line-height: 1.45;
    }
    .gm-acordo-comp .body-content p { margin: 0 0 10px 0; }
    .gm-acordo-comp .schedule-box { margin: 4px 0 14px 0; }
    .gm-acordo-comp .schedule-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-acordo-comp table.schedule { font-size: 11px; }
    .gm-acordo-comp table.schedule th { padding: 6px 6px; font-size: 9px; }
    .gm-acordo-comp table.schedule td { padding: 5px 6px; }
    .gm-acordo-comp .signature-area { padding: 10px 28px 0 28px; }
    .gm-acordo-comp .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-acordo-comp .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-acordo-comp .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-acordo-comp .footer { padding: 10px 28px 12px 28px; }
    .gm-acordo-comp .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-acordo-comp">
  <div class="page-wrap">

    <!-- Cabeçalho bordô -->
    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <!-- Faixa de título -->
    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Acordo para Compensação de Horas de Trabalho</h1>
    </div>

    <!-- Corpo -->
    <div class="body-content">

      <p>
        Pelo presente acordo para compensação de horas de trabalho, firmado entre a empresa
        <span class="highlight">{{empresa.nome_empresa}}</span>,
        com estabelecimento em <span class="fill-blank">{{empresa.cidade}}</span>,
        {{empresa.endereco}},
        inscrita no CNPJ(MF)/CEI sob o nº <span class="fill-blank">{{empresa.cnpj}}</span>,
        neste ato representada pelo(a) Sr(a): <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
      </p>

      <p>
        e seu empregado(a) <span class="highlight">{{empregado.nome_empregado}}</span>,
        portador(a) da Carteira de Trabalho e Previdência Social nº/série
        <span class="fill-blank">{{empregado.ctps}} - {{empregado.serie_ctps}} - {{empregado.uf_ctps}}</span>,
        fica convencionado, de acordo com as disposições legais vigentes, o seguinte horário normal de trabalho semanal:
      </p>

      <div class="schedule-box">
        <p class="label">Horário de trabalho semanal</p>
        <table class="schedule">
          <tr>
            <th rowspan="2">Dias da Semana</th>
            <th colspan="3">Horário de Trabalho</th>
            <th colspan="3">Intervalo para Repouso e Alimentação</th>
          </tr>
          <tr>
            <th>Entrada</th>
            <th></th>
            <th>Saída</th>
            <th>Início</th>
            <th></th>
            <th>Fim</th>
          </tr>
          <tr>
            <td class="dia">Segunda</td>
            <td></td><td>às</td><td></td>
            <td></td><td></td><td></td>
          </tr>
          <tr>
            <td class="dia">Terça</td>
            <td></td><td>às</td><td></td>
            <td></td><td></td><td></td>
          </tr>
          <tr>
            <td class="dia">Quarta</td>
            <td></td><td>às</td><td></td>
            <td></td><td></td><td></td>
          </tr>
          <tr>
            <td class="dia">Quinta</td>
            <td></td><td>às</td><td></td>
            <td></td><td></td><td></td>
          </tr>
          <tr>
            <td class="dia">Sexta</td>
            <td></td><td>às</td><td></td>
            <td></td><td></td><td></td>
          </tr>
          <tr>
            <td class="dia">Sábado</td>
            <td></td><td></td><td></td>
            <td></td><td></td><td></td>
          </tr>
          <tr>
            <td class="dia">Domingo</td>
            <td></td><td></td><td></td>
            <td></td><td></td><td></td>
          </tr>
        </table>
      </div>

      <p>
        E, por estarem de pleno acordo, as partes contratantes assinam o presente em 2 (duas) vias,
        o qual vigorará por prazo indeterminado.
      </p>

    </div>

    <!-- Assinaturas -->
    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>

      <div class="signature-row">
        <div class="signature-col">
          <div class="signature-line">{{empregado.nome_empregado}}</div>
        </div>
        <div class="signature-col">
          <div class="signature-line">{{empresa.nome_empresa}}</div>
        </div>
      </div>

      <div class="signature-row">
        <div class="signature-col">
          <div class="signature-line">Testemunha</div>
        </div>
        <div class="signature-col">
          <div class="signature-line">Testemunha</div>
        </div>
      </div>
    </div>

    <!-- Rodapé -->
    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de acordo para compensação de horas de trabalho.
      </div>
    </div>

  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_compensacao;

  -- 8) Acordo de Prorrogação de Horas ----------------------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Acordo de Prorrogação de Horas',
    'Admissão — prorrogação da jornada diária',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Acordo de Prorrogação de Horas</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empregado</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}} — CTPS {{empregado.ctps}} - {{empregado.serie_ctps}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Empresa</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empresa.nome_empresa}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 10px;">Entre a empresa <strong>{{empresa.nome_empresa}}</strong> com estabelecimento à {{empresa.endereco}}, {{empresa.cidade}}, neste ato representada pelo(a) Sr(a): _____________________________ e seu(sua) empregado(a) <strong>{{empregado.nome_empregado}}</strong>, abaixo assinado(a), fica acertado este acordo para Prorrogação da Jornada de Trabalho, que se regerá pelas cláusulas abaixo:</p>
    <p style="margin:0 0 8px;">1º) A duração do trabalho diário poderá ser prorrogada por _____ (_____ HORAS), sendo considerada(s) extraordinária(s) e pagas com acréscimo abaixo as horas que ultrapassarem o horário normal de trabalho.</p>
    <p style="margin:0 0 8px;">2º) A remuneração de trabalho será a seguinte: Hora normal R$ _____ (_____); Hora extra a _____% (_____) no valor de R$ _____ (_____).</p>
    <p style="margin:0 0 8px;">3º) As horas extras serão feitas de acordo com as necessidades da empresa, conferindo assim com o cartão de ponto, ponto eletrônico ou livro de ponto, conforme Artigo 59 da CLT.</p>
    <p style="margin:0 0 10px;">4º) Comprovada a conveniência para isso, fica facultado a qualquer das partes rescindir unilateralmente este acordo, mediante aviso escrito, a partir do qual ficará cancelada a prorrogação de horário.</p>
    <p style="margin:0 0 10px;">E, por estarem de pleno acordo, as partes contratantes assinam o presente em 2 (duas) vias, o qual vigorará por prazo indeterminado.</p>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
    <div style="margin-top:18px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="center" style="font-size:12px;">_____________________________<br>{{empregado.nome_empregado}}</td>
      <td align="center" style="font-size:12px;">_____________________________<br>{{empresa.nome_empresa}}</td>
    </tr></table>
    <div style="margin-top:10px;"></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td align="center" style="font-size:12px;">Testemunha</td>
      <td align="center" style="font-size:12px;">Testemunha</td>
    </tr></table>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_prorrogacao;

  -- 9) Termo de Responsabilidade (Salário Família) --------------------------
  INSERT INTO public.gm_modelos (nome, descricao, tipo, template, fontes)
  VALUES (
    'Termo de Responsabilidade (Salário Família)',
    'Admissão — concessão de salário família (Portaria MPAS nº 3.040/82)',
    'por_registro',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<div style="font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#2a2422;background:#ffffff;border:1px solid #ece6e4;border-radius:8px;overflow:hidden;">
  <div style="background-color:#7a1e1e;padding:18px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:19px;font-weight:700;letter-spacing:1px;color:#ffffff;">SCONT</td>
      <td align="right" style="font-family:'DM Mono','Courier New',monospace;font-size:10px;color:#e8cfcf;text-transform:uppercase;letter-spacing:1px;">Soluções Contábeis</td>
    </tr></table>
  </div>
  <div style="padding:18px 28px 2px;">
    <p style="margin:0;font-family:'DM Mono','Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#7a1e1e;">Documento · Admissão</p>
    <h1 style="margin:6px 0 0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#2a2422;line-height:1.3;">Termo de Responsabilidade</h1>
  </div>
  <div style="padding:12px 28px 6px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#3a3431;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px;">
      <tr><td style="background-color:#f7efef;border-left:4px solid #7a1e1e;border-radius:4px;padding:10px 16px;">
        <p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">Segurado</p>
        <p style="margin:0 0 8px;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.nome_empregado}}</p><p style="margin:0 0 2px;font-family:'DM Mono','Courier New',monospace;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#7a1e1e;">CTPS / Série</p>
        <p style="margin:0;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#2a2422;">{{empregado.ctps}} - {{empregado.serie_ctps}}</p>
      </td></tr>
    </table>
    
    <p style="margin:0 0 10px;">Empresa: {{empresa.nome_empresa}} — C.N.P.J/C.E.I: {{empresa.cnpj}}</p>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px;" border="1">
    <tr><th>Nome do Dependente</th><th>Data de Nascimento</th></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
    <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
    </table>
    <p style="margin:0 0 4px;text-align:right;">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
    <div style="margin-top:20px;"></div>
    <p style="text-align:center;"><strong>{{empregado.nome_empregado}}</strong></p>
    <p style="text-align:center;font-size:10px;color:#9a8f8a;">Polegar direito<br><span style="display:inline-block;border:1px solid #ccc;width:56px;height:56px;margin-top:4px;"></span></p>
    <hr style="margin:14px 0;border:none;border-top:1px solid #ece6e4;">
    <p style="text-align:center;"><strong>Termo de Responsabilidade</strong><br><span style="font-size:11px;">(Concessão Salário Família – Portaria MPAS nº 3.040/82)</span></p>
    <p style="margin:8px 0 8px;">Pelo presente Termo de Responsabilidade declaro estar ciente de que deverei comunicar de imediato a ocorrência dos seguintes fatos ou ocorrências que determinam a perda do direito ao salário-família:</p>
    <ul style="margin:0 0 10px;padding-left:18px;">
      <li>Óbito de filho;</li>
      <li>Cessação da invalidez de filho inválido;</li>
      <li>Sentença judicial que determine o pagamento a outrem (casos de divórcio, desquite ou separação, abandono de filho ou perda do pátrio poder).</li>
    </ul>
    <p style="margin:0;">Estou ciente, ainda, de que a falta de cumprimento do compromisso ora assumido, além de obrigar à devolução das importâncias recebidas indevidamente, sujeitar-me-á às penalidades previstas no art. 171 do Código Penal e à rescisão do contrato de trabalho, por justa causa, nos termos do art. 482 da Consolidação das Leis do Trabalho.</p>
  </div>
  <div style="padding:6px 28px 18px;">
    <div style="border-top:1px solid #ece6e4;padding-top:8px;font-family:'DM Mono','Courier New',monospace;font-size:9px;color:#9a8f8a;">
      SCONT Soluções Contábeis · Departamento Pessoal
    </div>
  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_responsabilidade;

  -- ── Evento "Admissão" agrupando os 9 modelos acima, na ordem de assinatura ──
  INSERT INTO public.gm_eventos (nome, descricao)
  VALUES ('Admissão', 'Documentos gerados no momento da admissão de um empregado (pasta MODELO ADMISSÃO)')
  RETURNING id INTO v_evento_id;

  INSERT INTO public.gm_eventos_modelos (evento_id, modelo_id, ordem) VALUES
    (v_evento_id, v_confiabilidade,   0),
    (v_evento_id, v_lgpd,             1),
    (v_evento_id, v_imagem,           2),
    (v_evento_id, v_vt_solicitacao,   3),
    (v_evento_id, v_vt_desistencia,   4),
    (v_evento_id, v_plano_saude,      5),
    (v_evento_id, v_compensacao,      6),
    (v_evento_id, v_prorrogacao,      7),
    (v_evento_id, v_responsabilidade, 8);

END $seed$;
