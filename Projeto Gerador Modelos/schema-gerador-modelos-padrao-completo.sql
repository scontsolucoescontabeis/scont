-- ============================================================
-- GERADOR DE MODELOS — Aplica aos outros 8 modelos de Admissão o mesmo
-- padrão visual usado no Acordo de Compensação de Horas (header bordô,
-- faixa de título, tabelas com cabeçalho bordô/listras, área de
-- assinatura em colunas via flexbox, media query própria de impressão).
-- Cada modelo usa uma classe-prefixo própria (.gm-xxx) para não colidir
-- com os demais quando concatenados na geração por Evento.
-- Execute no SQL Editor do Supabase (em bancos que já rodaram
-- schema-gerador-modelos-seed-admissao.sql)
-- ============================================================

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-confiabilidade * { box-sizing: border-box; }
  .gm-confiabilidade {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-confiabilidade .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-confiabilidade .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-confiabilidade .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-confiabilidade .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-confiabilidade .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-confiabilidade .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-confiabilidade .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-confiabilidade .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-confiabilidade .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-confiabilidade .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-confiabilidade ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-confiabilidade li { margin-bottom: 6px; }
  .gm-confiabilidade .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-confiabilidade .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-confiabilidade .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-confiabilidade .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-confiabilidade table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-confiabilidade table.grid th {
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
  .gm-confiabilidade table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-confiabilidade table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-confiabilidade table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-confiabilidade .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-confiabilidade .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-confiabilidade .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-confiabilidade .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-confiabilidade .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-confiabilidade .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-confiabilidade .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-confiabilidade .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-confiabilidade .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-confiabilidade .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-confiabilidade .header { padding: 16px 28px; }
    .gm-confiabilidade .header .logo { font-size: 19px; }
    .gm-confiabilidade .header .tagline { font-size: 9px; }
    .gm-confiabilidade .title-block { padding: 14px 28px 4px 28px; }
    .gm-confiabilidade .title-block .eyebrow { font-size: 10px; }
    .gm-confiabilidade .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-confiabilidade .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-confiabilidade .body-content p { margin: 0 0 10px 0; }
    .gm-confiabilidade ul { margin: 0 0 10px 0; }
    .gm-confiabilidade li { margin-bottom: 3px; }
    .gm-confiabilidade .table-box { margin: 4px 0 14px 0; }
    .gm-confiabilidade .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-confiabilidade table.grid { font-size: 11px; }
    .gm-confiabilidade table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-confiabilidade table.grid td { padding: 5px 6px; }
    .gm-confiabilidade .signature-area { padding: 10px 28px 0 28px; }
    .gm-confiabilidade .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-confiabilidade .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-confiabilidade .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-confiabilidade .divider { margin: 10px 28px; }
    .gm-confiabilidade .footer { padding: 10px 28px 12px 28px; }
    .gm-confiabilidade .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-confiabilidade">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Termo de Confiabilidade</h1>
    </div>

    <div class="body-content">

      <p>
        Pelo presente termo de confiabilidade, eu <span class="highlight">{{empregado.nome_empregado}}</span>,
        portador do CPF <span class="fill-blank">{{empregado.cpf}}</span>, funcionário da empresa
        <span class="highlight">{{empresa.nome_empresa}}</span>, comprometo-me a guardar segredo das informações
        sigilosas obtidas nesta empresa, entendendo-se como tais as de caráter técnico, funcional ou pessoal,
        que porventura possam instigar ou interessar à concorrência, relacionadas ou não com o exercício de
        minha função.
      </p>
      <p>
        Declaro, ainda, que estou ciente de que qualquer prejuízo causado à empresa, perpetrado pela quebra do
        sigilo acima declinado, gerará o pagamento de multa no valor de 20 (vinte) salários-mínimos atuais,
        além das implicações nas esferas cível, criminal e administrativa.
      </p>
      <p>Por derradeiro, declaro que li e compreendi os termos aqui dispostos, assinando-o voluntariamente.</p>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">({{empresa.nome_empresa}})</div></div>
        <div class="signature-col"><div class="signature-line">({{empregado.nome_empregado}})</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de termo de confiabilidade e sigilo de informações.
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Termo de Confiabilidade';

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-lgpd * { box-sizing: border-box; }
  .gm-lgpd {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-lgpd .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-lgpd .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-lgpd .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-lgpd .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-lgpd .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-lgpd .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-lgpd .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-lgpd .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-lgpd .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-lgpd .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-lgpd ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-lgpd li { margin-bottom: 6px; }
  .gm-lgpd .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-lgpd .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-lgpd .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-lgpd .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-lgpd table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-lgpd table.grid th {
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
  .gm-lgpd table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-lgpd table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-lgpd table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-lgpd .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-lgpd .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-lgpd .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-lgpd .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-lgpd .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-lgpd .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-lgpd .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-lgpd .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-lgpd .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-lgpd .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-lgpd .header { padding: 16px 28px; }
    .gm-lgpd .header .logo { font-size: 19px; }
    .gm-lgpd .header .tagline { font-size: 9px; }
    .gm-lgpd .title-block { padding: 14px 28px 4px 28px; }
    .gm-lgpd .title-block .eyebrow { font-size: 10px; }
    .gm-lgpd .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-lgpd .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-lgpd .body-content p { margin: 0 0 10px 0; }
    .gm-lgpd ul { margin: 0 0 10px 0; }
    .gm-lgpd li { margin-bottom: 3px; }
    .gm-lgpd .table-box { margin: 4px 0 14px 0; }
    .gm-lgpd .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-lgpd table.grid { font-size: 11px; }
    .gm-lgpd table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-lgpd table.grid td { padding: 5px 6px; }
    .gm-lgpd .signature-area { padding: 10px 28px 0 28px; }
    .gm-lgpd .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-lgpd .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-lgpd .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-lgpd .divider { margin: 10px 28px; }
    .gm-lgpd .footer { padding: 10px 28px 12px 28px; }
    .gm-lgpd .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-lgpd">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Termo de Consentimento LGPD</h1>
    </div>

    <div class="body-content">

      <p>
        Este documento visa registrar a manifestação livre, informada e inequívoca pela qual o Titular concorda
        com o tratamento de seus dados pessoais para finalidade específica, em conformidade com a Lei nº 13.709 –
        Lei Geral de Proteção de Dados Pessoais (LGPD).
      </p>
      <p>
        Titular: <span class="highlight">{{empregado.nome_empregado}}</span> — CPF
        <span class="fill-blank">{{empregado.cpf}}</span>.
      </p>
      <p>
        Ao assinar o presente termo, o Titular consente e concorda que a empresa
        <span class="highlight">{{empresa.nome_empresa}}</span>, C.N.P.J: <span class="fill-blank">{{empresa.cnpj}}</span>,
        com sede na {{empresa.endereco}}, {{empresa.cidade}}, CEP: {{empresa.cep}}, telefone
        <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
        e-mail <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>,
        doravante denominada Controlador, tome decisões referentes ao tratamento de seus dados pessoais, bem como
        realize o tratamento de seus dados pessoais, envolvendo operações como as que se referem a coleta,
        produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição,
        processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação,
        comunicação, transferência, difusão ou extração.
      </p>
      <p class="section-title">Dados Pessoais</p>
      <p>O Controlador fica autorizado a tomar decisões referentes ao tratamento e a realizar o tratamento dos seguintes dados pessoais do Titular:</p>
      <ul>
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
      <p class="section-title">Finalidades do Tratamento dos Dados</p>
      <p>O tratamento dos dados pessoais listados neste termo tem as seguintes finalidades:</p>
      <ul>
        <li>Possibilitar que o Controlador identifique e entre em contato com o Titular para fins de relacionamento contratual.</li>
        <li>Possibilitar que o Controlador cumpra com as obrigações trabalhistas e previdenciárias.</li>
        <li>Possibilitar que o Controlador envie ou forneça Informações Pessoais e de seus dependentes para viabilizar implantação de benefícios, junto a novos fornecedores, caso seja necessário.</li>
      </ul>
      <p class="section-title">Confidencialidade</p>
      <p>Estou ciente do compromisso assumido pelo controlador de tratar os meus Dados Pessoais de forma sigilosa e confidencial, mantendo-os em ambiente seguro e não sendo utilizados para qualquer fim que não os descritos acima.</p>
      <p class="section-title">Revogação</p>
      <p>Estou ciente que, a qualquer tempo, posso retirar o consentimento ora fornecido, hipótese em que as atividades desenvolvidas pelo controlador, no âmbito de nossa relação, poderão ser prejudicadas. Declaro e concordo que os meus Dados Pessoais poderão ser armazenados, mesmo após o término do tratamento — inclusive após a revogação do consentimento, para cumprimento de obrigação legal ou regulatória pelo controlador ou desde que tornados anônimos.</p>
      <p class="section-title">Canal de Comunicação</p>
      <p>Manifesto-me de forma informada, livre, expressa e consciente, no sentido de autorizar o controlador a realizar contato comigo através dos seguintes canais: e-mail, ligação, SMS ou App de comunicação.</p>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}}</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de termo de consentimento para tratamento de dados pessoais (LGPD).
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Termo de Consentimento LGPD';

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-imagem * { box-sizing: border-box; }
  .gm-imagem {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-imagem .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-imagem .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-imagem .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-imagem .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-imagem .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-imagem .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-imagem .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-imagem .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-imagem .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-imagem .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-imagem ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-imagem li { margin-bottom: 6px; }
  .gm-imagem .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-imagem .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-imagem .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-imagem .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-imagem table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-imagem table.grid th {
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
  .gm-imagem table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-imagem table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-imagem table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-imagem .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-imagem .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-imagem .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-imagem .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-imagem .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-imagem .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-imagem .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-imagem .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-imagem .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-imagem .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-imagem .header { padding: 16px 28px; }
    .gm-imagem .header .logo { font-size: 19px; }
    .gm-imagem .header .tagline { font-size: 9px; }
    .gm-imagem .title-block { padding: 14px 28px 4px 28px; }
    .gm-imagem .title-block .eyebrow { font-size: 10px; }
    .gm-imagem .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-imagem .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-imagem .body-content p { margin: 0 0 10px 0; }
    .gm-imagem ul { margin: 0 0 10px 0; }
    .gm-imagem li { margin-bottom: 3px; }
    .gm-imagem .table-box { margin: 4px 0 14px 0; }
    .gm-imagem .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-imagem table.grid { font-size: 11px; }
    .gm-imagem table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-imagem table.grid td { padding: 5px 6px; }
    .gm-imagem .signature-area { padding: 10px 28px 0 28px; }
    .gm-imagem .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-imagem .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-imagem .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-imagem .divider { margin: 10px 28px; }
    .gm-imagem .footer { padding: 10px 28px 12px 28px; }
    .gm-imagem .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-imagem">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Autorização de Uso de Imagem</h1>
    </div>

    <div class="body-content">

      <p>
        Pelo presente instrumento, eu <span class="highlight">{{empregado.nome_empregado}}</span>, inscrito(a) no
        CPF/MF sob o nº <span class="fill-blank">{{empregado.cpf}}</span>, autorizo, a título gratuito e a
        qualquer tempo, a captação e utilização de minha imagem em divulgação dos serviços pela empresa
        <span class="highlight">{{empresa.nome_empresa}}</span>, inscrita no CNPJ/MF sob o nº
        <span class="fill-blank">{{empresa.cnpj}}</span>. Declaro, em caráter irrevogável e irretratável, estar
        ciente e de acordo com o uso institucional e comercial do material captado. E, por ser a expressão da
        verdade, firmo o presente Termo de Autorização de Uso de Imagem.
      </p>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual_extenso}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}} — CPF: {{empregado.cpf}}</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de termo de autorização de uso de imagem.
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Termo de Autorização de Uso de Imagem';

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-solic-vt * { box-sizing: border-box; }
  .gm-solic-vt {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-solic-vt .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-solic-vt .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-solic-vt .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-solic-vt .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-solic-vt .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-solic-vt .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-solic-vt .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-solic-vt .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-solic-vt .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-solic-vt .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-solic-vt ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-solic-vt li { margin-bottom: 6px; }
  .gm-solic-vt .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-solic-vt .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-solic-vt .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-solic-vt .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-solic-vt table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-solic-vt table.grid th {
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
  .gm-solic-vt table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-solic-vt table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-solic-vt table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-solic-vt .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-solic-vt .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-solic-vt .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-solic-vt .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-solic-vt .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-solic-vt .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-solic-vt .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-solic-vt .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-solic-vt .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-solic-vt .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-solic-vt .header { padding: 16px 28px; }
    .gm-solic-vt .header .logo { font-size: 19px; }
    .gm-solic-vt .header .tagline { font-size: 9px; }
    .gm-solic-vt .title-block { padding: 14px 28px 4px 28px; }
    .gm-solic-vt .title-block .eyebrow { font-size: 10px; }
    .gm-solic-vt .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-solic-vt .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-solic-vt .body-content p { margin: 0 0 10px 0; }
    .gm-solic-vt ul { margin: 0 0 10px 0; }
    .gm-solic-vt li { margin-bottom: 3px; }
    .gm-solic-vt .table-box { margin: 4px 0 14px 0; }
    .gm-solic-vt .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-solic-vt table.grid { font-size: 11px; }
    .gm-solic-vt table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-solic-vt table.grid td { padding: 5px 6px; }
    .gm-solic-vt .signature-area { padding: 10px 28px 0 28px; }
    .gm-solic-vt .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-solic-vt .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-solic-vt .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-solic-vt .divider { margin: 10px 28px; }
    .gm-solic-vt .footer { padding: 10px 28px 12px 28px; }
    .gm-solic-vt .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-solic-vt">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Solicitação de Vale-Transporte</h1>
    </div>

    <div class="body-content">

      <p>
        Empresa: <span class="highlight">{{empresa.nome_empresa}}</span> — Endereço: {{empresa.endereco}} —
        {{empresa.cidade}} — CEP: {{empresa.cep}}
      </p>
      <p>
        Empregado: <span class="highlight">{{empregado.nome_empregado}}</span> — CPF:
        <span class="fill-blank">{{empregado.cpf}}</span> — Função: {{empregado.desc_funcao}} — CTPS:
        <span class="fill-blank">{{empregado.ctps}} - {{empregado.serie_ctps}}</span>
      </p>
      <p>( &nbsp;) Opto pela Utilização do Vale-Transporte &nbsp;&nbsp;&nbsp; ( &nbsp;) Não Opto pela Utilização do Vale-Transporte</p>
      <p>Nos termos da legislação vigente, solicito receber o Vale-Transporte e comprometo-me:</p>
      <p>a) A utilizá-lo exclusivamente para meu efetivo deslocamento residência-trabalho e vice-versa;</p>
      <p>b) A renovar anualmente ou sempre que ocorrer alteração no meu endereço residencial ou dos serviços e meios de transportes mais adequados ao meu deslocamento residência-trabalho e vice-versa;</p>
      <p>c) Autorizo a descontar até 6% (seis por cento) do meu salário-básico mensal para ocorrer o custeio do Vale-Transporte;</p>
      <p>d) Declaro estar ciente de que a declaração falsa ou o uso indevido do Vale-Transporte constituem falta grave.</p>
      <p>
        Minha residência atual: Endereço: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        Nº: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;</span>
        Bairro: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        Cidade: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        UF: <span class="fill-blank">&nbsp;&nbsp;</span>
        CEP: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
      </p>
      <div class="table-box">
        <p class="label">Meio de Transporte</p>
        <table class="grid">
          <tr><th>Tipo</th><th>Quantidade Ida e Volta</th><th>Valor Unitário</th></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        </table>
      </div>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}}</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de solicitação de Vale-Transporte.
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Solicitação de Vale-Transporte';

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-desist-vt * { box-sizing: border-box; }
  .gm-desist-vt {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-desist-vt .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-desist-vt .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-desist-vt .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-desist-vt .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-desist-vt .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-desist-vt .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-desist-vt .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-desist-vt .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-desist-vt .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-desist-vt .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-desist-vt ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-desist-vt li { margin-bottom: 6px; }
  .gm-desist-vt .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-desist-vt .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-desist-vt .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-desist-vt .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-desist-vt table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-desist-vt table.grid th {
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
  .gm-desist-vt table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-desist-vt table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-desist-vt table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-desist-vt .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-desist-vt .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-desist-vt .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-desist-vt .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-desist-vt .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-desist-vt .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-desist-vt .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-desist-vt .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-desist-vt .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-desist-vt .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-desist-vt .header { padding: 16px 28px; }
    .gm-desist-vt .header .logo { font-size: 19px; }
    .gm-desist-vt .header .tagline { font-size: 9px; }
    .gm-desist-vt .title-block { padding: 14px 28px 4px 28px; }
    .gm-desist-vt .title-block .eyebrow { font-size: 10px; }
    .gm-desist-vt .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-desist-vt .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-desist-vt .body-content p { margin: 0 0 10px 0; }
    .gm-desist-vt ul { margin: 0 0 10px 0; }
    .gm-desist-vt li { margin-bottom: 3px; }
    .gm-desist-vt .table-box { margin: 4px 0 14px 0; }
    .gm-desist-vt .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-desist-vt table.grid { font-size: 11px; }
    .gm-desist-vt table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-desist-vt table.grid td { padding: 5px 6px; }
    .gm-desist-vt .signature-area { padding: 10px 28px 0 28px; }
    .gm-desist-vt .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-desist-vt .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-desist-vt .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-desist-vt .divider { margin: 10px 28px; }
    .gm-desist-vt .footer { padding: 10px 28px 12px 28px; }
    .gm-desist-vt .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-desist-vt">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Desistência de Vale-Transporte</h1>
    </div>

    <div class="body-content">

      <p>
        Razão Social: <span class="highlight">{{empresa.nome_empresa}}</span> — CNPJ:
        <span class="fill-blank">{{empresa.cnpj}}</span> — Endereço: {{empresa.endereco}} — {{empresa.cidade}} —
        CEP: {{empresa.cep}}
      </p>
      <p>Prezados Senhores:</p>
      <p>
        Pelo presente venho desistir da utilização de Vale-Transporte previsto na Lei nº 7.418, de 16/12/1985,
        com advento da Lei nº 7.619, de 30/09/1987 e a Nova Regulamentação pelo Decreto nº 95.247, de 17/11/1987.
      </p>
      <p>Esta decisão é válida enquanto não necessitar deste recurso legal por tempo indeterminado, de acordo com a minha livre e espontânea vontade.</p>
      <p>
        Empregado: <span class="highlight">{{empregado.nome_empregado}}</span> — CPF:
        <span class="fill-blank">{{empregado.cpf}}</span> — Função: {{empregado.desc_funcao}}
      </p>
      <p>Atenciosamente,</p>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}}</div></div>
        <div class="signature-col"><div class="signature-line">Responsável Legal</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de opção de desistência do Vale-Transporte.
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Opção de Desistência de Vale-Transporte';

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-plano-saude * { box-sizing: border-box; }
  .gm-plano-saude {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-plano-saude .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-plano-saude .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-plano-saude .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-plano-saude .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-plano-saude .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-plano-saude .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-plano-saude .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-plano-saude .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-plano-saude .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-plano-saude .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-plano-saude ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-plano-saude li { margin-bottom: 6px; }
  .gm-plano-saude .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-plano-saude .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-plano-saude .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-plano-saude .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-plano-saude table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-plano-saude table.grid th {
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
  .gm-plano-saude table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-plano-saude table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-plano-saude table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-plano-saude .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-plano-saude .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-plano-saude .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-plano-saude .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-plano-saude .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-plano-saude .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-plano-saude .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-plano-saude .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-plano-saude .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-plano-saude .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-plano-saude .header { padding: 16px 28px; }
    .gm-plano-saude .header .logo { font-size: 19px; }
    .gm-plano-saude .header .tagline { font-size: 9px; }
    .gm-plano-saude .title-block { padding: 14px 28px 4px 28px; }
    .gm-plano-saude .title-block .eyebrow { font-size: 10px; }
    .gm-plano-saude .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-plano-saude .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-plano-saude .body-content p { margin: 0 0 10px 0; }
    .gm-plano-saude ul { margin: 0 0 10px 0; }
    .gm-plano-saude li { margin-bottom: 3px; }
    .gm-plano-saude .table-box { margin: 4px 0 14px 0; }
    .gm-plano-saude .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-plano-saude table.grid { font-size: 11px; }
    .gm-plano-saude table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-plano-saude table.grid td { padding: 5px 6px; }
    .gm-plano-saude .signature-area { padding: 10px 28px 0 28px; }
    .gm-plano-saude .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-plano-saude .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-plano-saude .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-plano-saude .divider { margin: 10px 28px; }
    .gm-plano-saude .footer { padding: 10px 28px 12px 28px; }
    .gm-plano-saude .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-plano-saude">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Autorização — Plano de Saúde</h1>
    </div>

    <div class="body-content">

      <p>
        Eu, <span class="highlight">{{empregado.nome_empregado}}</span>, CPF:
        <span class="fill-blank">{{empregado.cpf}}</span>, tomei ciência dos benefícios oferecidos pela empresa
        <span class="highlight">{{empresa.nome_empresa}}</span>, CNPJ <span class="fill-blank">{{empresa.cnpj}}</span>,
        e estou marcando com X minha opção de aderir ou não aderir, conforme relacionados abaixo.
      </p>
      <p>
        Estou ciente e de acordo com as condições de pagamento do referido benefício, tanto para mim como para
        meu(s) dependente(s) declarado(s) também como optante(s), bem como os reajustes anuais e por faixa
        etária, tabela de valores para quem optar pelo plano com coparticipação, prazos e carências.
      </p>
      <p>( &nbsp;) Tenho interesse em aderir o plano &nbsp;&nbsp;&nbsp; ( &nbsp;) Não tenho interesse em aderir o plano</p>
      <div class="table-box">
        <table class="grid" style="font-size:11px;">
          <tr><th>Plano</th><th>Utilizado</th><th>Desconto Colaborador</th><th>Valor Colaborador</th><th>Valor Dependente</th><th>Valor Dependente</th><th>Valor Dependente</th><th>Valor Dependente</th></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
        </table>
      </div>
      <p>Número de dependentes: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;</span> &nbsp;&nbsp; Valor com desconto colaborador: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
      <p>Valor total desconto em folha: <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
      <p>Por fim, autorizo o desconto do referido benefício em folha de pagamento, conforme política de benefícios praticada pela empresa.</p>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual_extenso}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">Assinatura — CPF: {{empregado.cpf}}</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de autorização de desconto do plano de saúde.
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Autorização de Desconto do Plano de Saúde';

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-prorrogacao * { box-sizing: border-box; }
  .gm-prorrogacao {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-prorrogacao .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-prorrogacao .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-prorrogacao .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-prorrogacao .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-prorrogacao .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-prorrogacao .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-prorrogacao .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-prorrogacao .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-prorrogacao .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-prorrogacao .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-prorrogacao ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-prorrogacao li { margin-bottom: 6px; }
  .gm-prorrogacao .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-prorrogacao .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-prorrogacao .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-prorrogacao .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-prorrogacao table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-prorrogacao table.grid th {
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
  .gm-prorrogacao table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-prorrogacao table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-prorrogacao table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-prorrogacao .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-prorrogacao .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-prorrogacao .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-prorrogacao .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-prorrogacao .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-prorrogacao .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-prorrogacao .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-prorrogacao .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-prorrogacao .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-prorrogacao .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-prorrogacao .header { padding: 16px 28px; }
    .gm-prorrogacao .header .logo { font-size: 19px; }
    .gm-prorrogacao .header .tagline { font-size: 9px; }
    .gm-prorrogacao .title-block { padding: 14px 28px 4px 28px; }
    .gm-prorrogacao .title-block .eyebrow { font-size: 10px; }
    .gm-prorrogacao .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-prorrogacao .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-prorrogacao .body-content p { margin: 0 0 10px 0; }
    .gm-prorrogacao ul { margin: 0 0 10px 0; }
    .gm-prorrogacao li { margin-bottom: 3px; }
    .gm-prorrogacao .table-box { margin: 4px 0 14px 0; }
    .gm-prorrogacao .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-prorrogacao table.grid { font-size: 11px; }
    .gm-prorrogacao table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-prorrogacao table.grid td { padding: 5px 6px; }
    .gm-prorrogacao .signature-area { padding: 10px 28px 0 28px; }
    .gm-prorrogacao .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-prorrogacao .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-prorrogacao .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-prorrogacao .divider { margin: 10px 28px; }
    .gm-prorrogacao .footer { padding: 10px 28px 12px 28px; }
    .gm-prorrogacao .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-prorrogacao">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Acordo de Prorrogação de Horas</h1>
    </div>

    <div class="body-content">

      <p>
        Entre a empresa <span class="highlight">{{empresa.nome_empresa}}</span> com estabelecimento à
        {{empresa.endereco}}, {{empresa.cidade}}, neste ato representada pelo(a) Sr(a):
        <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        e seu(sua) empregado(a) <span class="highlight">{{empregado.nome_empregado}}</span>, abaixo assinado(a),
        portador(a) da Carteira de Trabalho e Previdência Social nº
        <span class="fill-blank">{{empregado.ctps}} - {{empregado.serie_ctps}} - {{empregado.uf_ctps}}</span>,
        fica acertado este acordo para Prorrogação da Jornada de Trabalho, que se regerá pelas cláusulas abaixo:
      </p>
      <p>1º) A duração do trabalho diário poderá ser prorrogada por <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;</span> (<span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> HORAS), sendo considerada(s) extraordinária(s) e pagas com acréscimo abaixo as horas que ultrapassarem o horário normal de trabalho.</p>
      <p>2º) A remuneração de trabalho será a seguinte: Hora normal R$ <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>; Hora extra a <span class="fill-blank">&nbsp;&nbsp;&nbsp;</span>% no valor de R$ <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>.</p>
      <p>3º) As horas extras serão feitas de acordo com as necessidades da empresa, conferindo assim com o cartão de ponto, ponto eletrônico ou livro de ponto, conforme Artigo 59 da CLT.</p>
      <p>4º) Comprovada a conveniência para isso, fica facultado a qualquer das partes rescindir unilateralmente este acordo, mediante aviso escrito, a partir do qual ficará cancelada a prorrogação de horário.</p>
      <p>E, por estarem de pleno acordo, as partes contratantes assinam o presente em 2 (duas) vias, o qual vigorará por prazo indeterminado.</p>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}}</div></div>
        <div class="signature-col"><div class="signature-line">{{empresa.nome_empresa}}</div></div>
      </div>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">Testemunha</div></div>
        <div class="signature-col"><div class="signature-line">Testemunha</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de acordo de prorrogação de horas.
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Acordo de Prorrogação de Horas';

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-resp-familia * { box-sizing: border-box; }
  .gm-resp-familia {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-resp-familia .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-resp-familia .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-resp-familia .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-resp-familia .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-resp-familia .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-resp-familia .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-resp-familia .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-resp-familia .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-resp-familia .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-resp-familia .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-resp-familia ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-resp-familia li { margin-bottom: 6px; }
  .gm-resp-familia .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-resp-familia .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-resp-familia .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-resp-familia .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-resp-familia table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-resp-familia table.grid th {
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
  .gm-resp-familia table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-resp-familia table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-resp-familia table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-resp-familia .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-resp-familia .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-resp-familia .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-resp-familia .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-resp-familia .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-resp-familia .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-resp-familia .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-resp-familia .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-resp-familia .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-resp-familia .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-resp-familia .header { padding: 16px 28px; }
    .gm-resp-familia .header .logo { font-size: 19px; }
    .gm-resp-familia .header .tagline { font-size: 9px; }
    .gm-resp-familia .title-block { padding: 14px 28px 4px 28px; }
    .gm-resp-familia .title-block .eyebrow { font-size: 10px; }
    .gm-resp-familia .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-resp-familia .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-resp-familia .body-content p { margin: 0 0 10px 0; }
    .gm-resp-familia ul { margin: 0 0 10px 0; }
    .gm-resp-familia li { margin-bottom: 3px; }
    .gm-resp-familia .table-box { margin: 4px 0 14px 0; }
    .gm-resp-familia .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-resp-familia table.grid { font-size: 11px; }
    .gm-resp-familia table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-resp-familia table.grid td { padding: 5px 6px; }
    .gm-resp-familia .signature-area { padding: 10px 28px 0 28px; }
    .gm-resp-familia .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-resp-familia .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-resp-familia .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-resp-familia .divider { margin: 10px 28px; }
    .gm-resp-familia .footer { padding: 10px 28px 12px 28px; }
    .gm-resp-familia .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-resp-familia">
  <div class="page-wrap">

    <div class="header">
      <div class="logo">SCONT</div>
      <div class="tagline">Soluções Contábeis</div>
    </div>

    <div class="title-block">
      <p class="eyebrow">Modelo · Departamento Pessoal</p>
      <h1>Termo de Responsabilidade</h1>
    </div>

    <div class="body-content">

      <p>
        Empresa: <span class="highlight">{{empresa.nome_empresa}}</span> — C.N.P.J/C.E.I:
        <span class="fill-blank">{{empresa.cnpj}}</span>
      </p>
      <p>
        Nome do segurado: <span class="highlight">{{empregado.nome_empregado}}</span> — Cart. Prof./Série:
        <span class="fill-blank">{{empregado.ctps}} - {{empregado.serie_ctps}}</span>
      </p>
      <div class="table-box">
        <table class="grid">
          <tr><th>Nome do Dependente</th><th>Data de Nascimento</th></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
          <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
        </table>
      </div>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}}</div></div>
      </div>
      <p style="text-align:center;font-size:11px;color:#9a8f8a;">Polegar direito<br><span class="thumbprint-box"></span></p>
    </div>

    <hr class="divider">

    <div class="body-content" style="padding-top:0;">
      <p style="text-align:center;"><strong>Termo de Responsabilidade</strong><br><span style="font-size:12px;">(Concessão Salário Família – Portaria MPAS nº 3.040/82)</span></p>
      <p>Pelo presente Termo de Responsabilidade declaro estar ciente de que deverei comunicar de imediato a ocorrência dos seguintes fatos ou ocorrências que determinam a perda do direito ao salário-família:</p>
      <ul>
        <li>Óbito de filho;</li>
        <li>Cessação da invalidez de filho inválido;</li>
        <li>Sentença judicial que determine o pagamento a outrem (casos de divórcio, desquite ou separação, abandono de filho ou perda do pátrio poder).</li>
      </ul>
      <p style="margin-bottom:0;">Estou ciente, ainda, de que a falta de cumprimento do compromisso ora assumido, além de obrigar à devolução das importâncias recebidas indevidamente, sujeitar-me-á às penalidades previstas no art. 171 do Código Penal e à rescisão do contrato de trabalho, por justa causa, nos termos do art. 482 da Consolidação das Leis do Trabalho.</p>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de termo de responsabilidade para concessão de salário família.
      </div>
    </div>

  </div>
</div>$doc$ WHERE nome = 'Termo de Responsabilidade (Salário Família)';
