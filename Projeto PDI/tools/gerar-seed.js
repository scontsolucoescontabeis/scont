// Projeto PDI/tools/gerar-seed.js — gera _sql/seed_pdi.sql a partir de js/textos.js
// Uso: node "Projeto PDI/tools/gerar-seed.js"
const fs = require('fs');
const path = require('path');
const T = require('../js/textos.js');

const q = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
const json = (o) => `${q(JSON.stringify(o))}::jsonb`;
const S = T.SEED_JULIA;

const sql = `-- ============================================================
-- SCONT – PDI: seed do modelo "${T.MODELO_DP.cargo_setor}" e do PDI de exemplo
-- Gerado por Projeto PDI/tools/gerar-seed.js a partir de js/textos.js (NÃO editar à mão).
-- Pré-requisito: _sql/schema_pdi.sql. Idempotente.
-- O PDI de exemplo fica sem colaborador_user_id: o admin vincula o usuário depois.
-- ============================================================
DO $seed$
DECLARE
    v_modelo UUID;
    v_pdi UUID;
BEGIN
    SELECT id INTO v_modelo FROM public.pdi_modelos WHERE cargo_setor = ${q(T.MODELO_DP.cargo_setor)} ORDER BY versao DESC LIMIT 1;
    IF v_modelo IS NULL THEN
        INSERT INTO public.pdi_modelos (cargo_setor, conteudo)
        VALUES (${q(T.MODELO_DP.cargo_setor)}, ${json(T.MODELO_DP.conteudo)})
        RETURNING id INTO v_modelo;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.pdis WHERE colaborador_nome = ${q(S.colaborador_nome)} AND data_inicio = ${q(S.data_inicio)}) THEN
        v_pdi := public.pdi_criar_a_partir_do_modelo(
            v_modelo, NULL, ${q(S.colaborador_nome)}, ${q(S.cargo_setor)}, ${q(S.admissao)}::date,
            NULL, ${q(S.gestor_nome)}, ${q(S.data_inicio)}::date);
        UPDATE public.pdis
           SET contexto_desenvolvimento = ${q(S.contexto_desenvolvimento)},
               perfil_comportamental = ${json(S.perfil_comportamental)}
         WHERE id = v_pdi;
    END IF;
END
$seed$;
`;
const out = path.join(__dirname, '..', '..', '_sql', 'seed_pdi.sql');
fs.writeFileSync(out, sql, 'utf8');
console.log('gerado', out);
