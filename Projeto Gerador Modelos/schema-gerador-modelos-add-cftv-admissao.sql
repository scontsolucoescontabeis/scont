-- ============================================================
-- GERADOR DE MODELOS — Adiciona o 10º modelo de Admissão: "Termo de
-- Ciência e Responsabilidade – Monitoramento por Câmeras (CFTV)"
-- Conteúdo transcrito de "MODELO ADMISSÃO/TERMO DE CIÊNCIA E
-- RESPONSABILIDADE MONITORAMENTO POR CÂMERAS (CFTV).odt", com os
-- dados do último preenchimento substituídos por variáveis do
-- sistema, seguindo a mesma identidade visual dos demais 9 modelos
-- (ver schema-gerador-modelos-remove-header-embutido.sql).
-- Execute no SQL Editor do Supabase (em bancos que já rodaram
-- schema-gerador-modelos-seed-admissao.sql e
-- schema-gerador-modelos-eventos.sql)
-- ============================================================

DO $seed$
DECLARE
  v_evento_id UUID;
  v_cftv      UUID;
BEGIN

  INSERT INTO public.gm_modelos (nome, descricao, tipo, cabecalho_padrao, template, fontes)
  VALUES (
    'Termo de Ciência e Responsabilidade – Monitoramento por Câmeras (CFTV)',
    'Admissão — ciência sobre o sistema de monitoramento por câmeras (CFTV)',
    'por_registro',
    'nenhum',
    $doc$<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  .gm-cftv * { box-sizing: border-box; }
  .gm-cftv {
    font-family: 'DM Sans', Arial, Helvetica, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #3a3431;
  }
  .gm-cftv .page-wrap {
    max-width: 760px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
  .gm-cftv .header {
    background-color: #7a1e1e;
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .gm-cftv .header .logo {
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1px;
    color: #ffffff;
  }
  .gm-cftv .header .tagline {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    color: #e8cfcf;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .gm-cftv .title-block {
    padding: 32px 40px 8px 40px;
  }
  .gm-cftv .title-block .eyebrow {
    margin: 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-cftv .title-block h1 {
    margin: 8px 0 0 0;
    font-family: 'DM Sans', Arial, sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #2a2422;
    line-height: 1.3;
  }
  .gm-cftv .body-content {
    padding: 20px 40px 8px 40px;
    font-size: 15px;
    line-height: 1.7;
  }
  .gm-cftv .body-content p {
    margin: 0 0 16px 0;
    text-align: justify;
  }
  .gm-cftv .section-title {
    margin: 0 0 8px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-cftv ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }
  .gm-cftv li { margin-bottom: 6px; }
  .gm-cftv .highlight {
    color: #7a1e1e;
    font-weight: 700;
  }
  .gm-cftv .fill-blank {
    border-bottom: 1px solid #9a8f8a;
    padding: 0 2px;
  }
  .gm-cftv .table-box {
    margin: 8px 0 24px 0;
  }
  .gm-cftv .table-box .label {
    margin: 0 0 10px 0;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #7a1e1e;
  }
  .gm-cftv table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .gm-cftv table.grid th {
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
  .gm-cftv table.grid td {
    padding: 9px 8px;
    text-align: center;
    border: 1px solid #ece6e4;
  }
  .gm-cftv table.grid tr:nth-child(even) td {
    background-color: #f7efef;
  }
  .gm-cftv table.grid td.rotulo {
    font-weight: 700;
    color: #2a2422;
    text-align: left;
    background-color: #f7efef !important;
  }
  .gm-cftv .signature-area {
    padding: 24px 40px 0 40px;
  }
  .gm-cftv .signature-date {
    margin: 24px 0 40px 0;
    font-size: 15px;
  }
  .gm-cftv .signature-row {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-bottom: 48px;
  }
  .gm-cftv .signature-col {
    flex: 1;
    text-align: center;
  }
  .gm-cftv .signature-line {
    border-top: 1px solid #2a2422;
    padding-top: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #2a2422;
  }
  .gm-cftv .thumbprint-box {
    display: inline-block;
    border: 1px solid #9a8f8a;
    width: 56px;
    height: 56px;
    margin-top: 6px;
  }
  .gm-cftv .divider {
    border: none;
    border-top: 1px solid #ece6e4;
    margin: 20px 40px;
  }
  .gm-cftv .footer {
    padding: 24px 40px 28px 40px;
  }
  .gm-cftv .footer-inner {
    border-top: 1px solid #ece6e4;
    padding-top: 16px;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #9a8f8a;
  }
  @media print {
    .gm-cftv .page-wrap {
      box-shadow: none;
      margin: 0;
      max-width: 100%;
      border-radius: 0;
      page-break-inside: avoid;
    }
    .gm-cftv .header { padding: 16px 28px; }
    .gm-cftv .header .logo { font-size: 19px; }
    .gm-cftv .header .tagline { font-size: 9px; }
    .gm-cftv .title-block { padding: 14px 28px 4px 28px; }
    .gm-cftv .title-block .eyebrow { font-size: 10px; }
    .gm-cftv .title-block h1 { font-size: 17px; margin-top: 4px; }
    .gm-cftv .body-content { padding: 10px 28px 4px 28px; font-size: 12.5px; line-height: 1.45; }
    .gm-cftv .body-content p { margin: 0 0 10px 0; }
    .gm-cftv ul { margin: 0 0 10px 0; }
    .gm-cftv li { margin-bottom: 3px; }
    .gm-cftv .table-box { margin: 4px 0 14px 0; }
    .gm-cftv .table-box .label { font-size: 9.5px; margin-bottom: 6px; }
    .gm-cftv table.grid { font-size: 11px; }
    .gm-cftv table.grid th { padding: 6px 6px; font-size: 9px; }
    .gm-cftv table.grid td { padding: 5px 6px; }
    .gm-cftv .signature-area { padding: 10px 28px 0 28px; }
    .gm-cftv .signature-date { font-size: 12.5px; margin: 10px 0 22px 0; }
    .gm-cftv .signature-row { margin-bottom: 26px; gap: 24px; }
    .gm-cftv .signature-line { font-size: 11px; padding-top: 5px; }
    .gm-cftv .divider { margin: 10px 28px; }
    .gm-cftv .footer { padding: 10px 28px 12px 28px; }
    .gm-cftv .footer-inner { padding-top: 8px; font-size: 9px; }
  }
</style>

<div class="gm-cftv">
  <div class="page-wrap">

    <div class="body-content">

      <p>
        Pelo presente instrumento, eu, <span class="highlight">{{empregado.nome_empregado}}</span>, inscrito(a)
        no CPF sob o nº <span class="fill-blank">{{empregado.cpf}}</span>, na qualidade de empregado(a) da
        empresa <span class="highlight">{{empresa.nome_empresa}}</span>, declaro que fui devidamente informado(a)
        e estou ciente sobre a existência e o funcionamento do sistema de circuito fechado de televisão (CFTV)
        nas dependências da organização.
      </p>
      <p>Reconheço e concordo com os seguintes termos:</p>
      <ul>
        <li>
          <strong>Finalidade:</strong> Estou ciente de que as câmeras de segurança têm como finalidade exclusiva
          garantir a segurança patrimonial, a integridade física de colaboradores e clientes, e a prevenção de
          sinistros e incidentes operacionais na indústria e no comércio.
        </li>
        <li>
          <strong>Localização:</strong> Fui informado(a) de que o monitoramento ocorre em áreas comuns,
          operacionais e de trabalho (como recepção, corredores, áreas de produção, estoques e escritórios) e
          que todas as áreas monitoradas possuem placas de sinalização visíveis.
        </li>
        <li>
          <strong>Privacidade:</strong> Tenho ciência de que a empresa respeita rigorosamente o direito à
          privacidade e à dignidade humana, garantindo a inexistência de câmeras em banheiros, vestiários ou
          áreas restritas de descanso.
        </li>
        <li>
          <strong>Proteção de Dados (LGPD):</strong> Compreendo que a minha imagem captada constitui dado
          pessoal e que o tratamento dessas informações pela empresa segue os critérios de segurança,
          confidencialidade e tempo limitado de retenção previstos na Lei Geral de Proteção de Dados (Lei nº
          13.709/18).
        </li>
        <li>
          <strong>Uso Legal:</strong> Estou ciente de que as imagens gravadas são de propriedade da empresa, de
          acesso restrito à equipe de segurança/diretoria, e poderão ser utilizadas como meio de prova em
          auditorias internas, processos administrativos ou judiciais, caso ocorram incidentes ou infrações
          regulamentares.
        </li>
      </ul>
      <p>
        Por estar de pleno acordo com as informações e diretrizes recebidas durante o processo de integração
        (<em>Onboarding</em>), firmo o presente termo.
      </p>
    </div>

    <div class="signature-area">
      <p class="signature-date">{{empresa.cidade}}, {{sistema.data_atual}}.</p>
      <div class="signature-row">
        <div class="signature-col"><div class="signature-line">{{empregado.nome_empregado}}</div></div>
        <div class="signature-col"><div class="signature-line">{{empresa.nome_empresa}}</div></div>
      </div>
    </div>

    <div class="footer">
      <div class="footer-inner">
        SCONT Soluções Contábeis · Departamento Pessoal<br>
        Modelo de termo de ciência e responsabilidade sobre monitoramento por câmeras (CFTV).
      </div>
    </div>

  </div>
</div>$doc$,
    '{empregados}'
  ) RETURNING id INTO v_cftv;

  -- ── Vincula ao evento "Admissão" já existente, como último item ──────────
  SELECT id INTO v_evento_id FROM public.gm_eventos WHERE nome = 'Admissão' LIMIT 1;

  IF v_evento_id IS NOT NULL THEN
    INSERT INTO public.gm_eventos_modelos (evento_id, modelo_id, ordem)
    VALUES (v_evento_id, v_cftv, 9);
  END IF;

END $seed$;
