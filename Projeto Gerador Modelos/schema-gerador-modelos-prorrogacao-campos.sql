-- ============================================================
-- GERADOR DE MODELOS — "Acordo de Prorrogação de Horas":
-- campos em aberto das cláusulas 1ª e 2ª viram variáveis
-- {{prorrogacao.horas}}, {{prorrogacao.horas_extenso}},
-- {{prorrogacao.hora_normal}}, {{prorrogacao.percentual}},
-- {{prorrogacao.hora_extra_valor}}. O app pergunta os valores ao gerar
-- (individualmente ou via evento); vazios continuam em branco.
-- Execute no SQL Editor do Supabase.
-- ============================================================

UPDATE public.gm_modelos SET template = $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&amp;family=DM+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
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
  <div class="page-wrap"><div class="title-block">
      <h1 align="center">Acordo de Prorrogação de Horas</h1>
    </div>

    <div class="body-content">

      <p>
        Entre a empresa <span class="highlight">{{empresa.nome_empresa}}</span> com estabelecimento à
        {{empresa.endereco}},&nbsp;{{empresa.municipio}}, neste ato representada pelo(a) Sr(a):
        <span class="fill-blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        e seu(sua) empregado(a) <span class="highlight">{{empregado.nome_empregado}}</span>, abaixo assinado(a),
        portador(a) da Carteira de Trabalho e Previdência Social nº
        <span class="fill-blank">{{empregado.ctps}} - {{empregado.serie_ctps}} - {{empregado.uf_ctps}}</span>,
        fica acertado este acordo para Prorrogação da Jornada de Trabalho, que se regerá pelas cláusulas abaixo:
      </p>
      <p>1º) A duração do trabalho diário poderá ser prorrogada por <span class="fill-blank">{{prorrogacao.horas}}&nbsp;&nbsp;</span>&nbsp; (<span class="fill-blank">{{prorrogacao.horas_extenso}}&nbsp;&nbsp;</span> HORAS), sendo considerada(s) extraordinária(s) e pagas com acréscimo abaixo as horas que ultrapassarem o horário normal de trabalho.</p>
      <p>2º) A remuneração de trabalho será a seguinte: Hora normal R$ <span class="fill-blank">{{prorrogacao.hora_normal}}&nbsp;&nbsp;</span>; Hora extra a <span class="fill-blank">{{prorrogacao.percentual}}&nbsp;&nbsp;</span>% no valor de R$ <span class="fill-blank">{{prorrogacao.hora_extra_valor}}&nbsp;&nbsp;</span>.</p>
      <p>3º) As horas extras serão feitas de acordo com as necessidades da empresa, conferindo assim com o cartão de ponto, ponto eletrônico ou livro de ponto, conforme Artigo 59 da CLT.</p>
      <p>4º) Comprovada a conveniência para isso, fica facultado a qualquer das partes rescindir unilateralmente este acordo, mediante aviso escrito, a partir do qual ficará cancelada a prorrogação de horário.</p>
      <p>E, por estarem de pleno acordo, as partes contratantes assinam o presente em 2 (duas) vias, o qual vigorará por prazo indeterminado.</p>
    </div>

    <div class="signature-area">
      <p class="signature-date" align="right">{{empresa.municipio}}, {{sistema.data_atual}}.</p><p class="signature-date"><br></p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}}</div></div>
        <div class="signature-col"><div class="signature-line">{{empresa.nome_empresa}}<br><br><br><br></div></div>
      </div>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">Testemunha</div></div>
        <div class="signature-col"><div class="signature-line">Testemunha</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal
      </div>
    </div>

  </div>
</div>$doc$
WHERE nome = 'Acordo de Prorrogação de Horas';
