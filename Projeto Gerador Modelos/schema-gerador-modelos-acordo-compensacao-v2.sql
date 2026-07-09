-- ============================================================
-- GERADOR DE MODELOS — Reescreve "Acordo de Compensação de Horas de
-- Trabalho" usando o HTML fornecido pelo usuário como base (com
-- variáveis no lugar dos dados do último preenchimento).
-- Execute no SQL Editor do Supabase (em bancos que já rodaram
-- schema-gerador-modelos-seed-admissao.sql)
-- ============================================================

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
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
</div>$doc$, cabecalho_padrao = 'nenhum'
WHERE nome = 'Acordo de Compensação de Horas de Trabalho';
