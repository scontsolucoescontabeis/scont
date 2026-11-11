-- ============================================================
-- GERADOR DE MODELOS — "Termo de Consentimento LGPD" em uma única folha
-- Causa: o CSS de impressão do modelo tem page-break-inside:avoid no
-- bloco inteiro; como o texto passa de 1 página, o navegador empurrava
-- tudo para a folha 2 e deixava só o cabeçalho na folha 1.
-- Correção (somente @media print; a prévia/editor não muda): remove o
-- avoid e compacta espaçamentos para caber em 1 A4. Idempotente.
-- Execute no SQL Editor do Supabase.
-- ============================================================
UPDATE public.gm_modelos
SET template = replace(template, '<div class="gm-lgpd">', $css$<style>
/* gm-lgpd-uma-pagina */
@media print {
  .gm-lgpd .page-wrap { page-break-inside: auto !important; }
  .gm-lgpd .title-block { padding: 6px 28px 0 !important; }
  .gm-lgpd .body-content { padding: 6px 28px 0 !important; line-height: 1.3 !important; }
  .gm-lgpd .body-content p { margin: 0 0 5px !important; line-height: 1.3 !important; }
  .gm-lgpd .section-title { margin: 4px 0 2px !important; }
  .gm-lgpd ul { margin: 0 0 5px !important; padding-left: 18px !important; }
  .gm-lgpd li { margin-bottom: 1px !important; line-height: 1.3 !important; }
  .gm-lgpd .signature-area { padding: 6px 28px 0 !important; }
  .gm-lgpd .signature-row { margin-bottom: 0 !important; }
  .gm-lgpd .signature-line { padding-top: 3px !important; }
  .gm-lgpd .footer { padding: 6px 28px !important; }
}
</style>
<div class="gm-lgpd">$css$)
WHERE nome = 'Termo de Consentimento LGPD'
  AND template NOT LIKE '%gm-lgpd-uma-pagina%';
