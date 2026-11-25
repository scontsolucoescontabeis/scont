#!/usr/bin/env bash
# Roda o teste de isolacao do portal do cliente num Postgres local descartavel.
# Requer: docker run -d --name portal-cliente-pg -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:16-alpine
set -euo pipefail
cd "$(dirname "$0")/../../.."
C=${PG_CONTAINER:-portal-cliente-pg}
psql_() { MSYS_NO_PATHCONV=1 docker exec -i "$C" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
until docker exec "$C" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
psql_ -d postgres -c "DROP DATABASE IF EXISTS portal_test WITH (FORCE)" -c "CREATE DATABASE portal_test"
# roles sao globais: recria limpo
psql_ -d postgres -c "DROP ROLE IF EXISTS anon" -c "DROP ROLE IF EXISTS authenticated" >/dev/null 2>&1 || true
psql_ -d portal_test < _sql/tests/local/00_supabase_stub.sql
psql_ -d portal_test < _sql/tests/local/01_fixtures_tabelas_atuais.sql
psql_ -d portal_test < _sql/tests/local/02_fixtures_rh_montador.sql
if [ -z "${SKIP_SCHEMA:-}" ]; then
  psql_ -d portal_test < _sql/schema_portal_cliente.sql
  # 2x: guardas devem ser idempotentes
  psql_ -d portal_test < _sql/schema_portal_cliente_guardas.sql
  psql_ -d portal_test < _sql/schema_portal_cliente_guardas.sql
fi
# SKIP_BLOQUEIO=1 permite ver o RED (teste de isolacao sem a politica restritiva)
if [ -z "${SKIP_BLOQUEIO:-}" ]; then psql_ -d portal_test < _sql/schema_portal_cliente_bloqueio.sql; fi
psql_ -d portal_test < _sql/tests/portal_cliente_isolamento.test.sql
# administrador visualiza qualquer empresa (SKIP_ADMIN=1 mostra o RED)
if [ -z "${SKIP_ADMIN:-}" ]; then psql_ -d portal_test < _sql/schema_portal_cliente_admin.sql; fi
psql_ -d portal_test < _sql/tests/portal_cliente_admin_visualiza.test.sql
# Montador de Escala no portal do cliente (2x: idempotente)
psql_ -d portal_test < _sql/schema_montador_portal.sql
psql_ -d portal_test < _sql/schema_montador_portal.sql
psql_ -d portal_test < _sql/tests/montador_portal.test.sql
if [ -z "${SKIP_BLOQUEIO:-}" ]; then
  psql_ -d portal_test < _sql/tests/portal_cliente_revisao_final.test.sql
fi
if [ -z "${SKIP_BLOQUEIO:-}" ]; then
  sed -e '/@@APLICAR@@/{r _sql/schema_portal_cliente_bloqueio.sql' -e 'd}'       -e '/@@REVERTER@@/{r _sql/schema_portal_cliente_bloqueio_reverter.sql' -e 'd}'       _sql/tests/portal_cliente_bloqueio.test.sql | psql_ -d portal_test
fi
# auditoria: so valida que o SQL e valido (dados locais sao vazios)
psql_ -d portal_test < _sql/tests/portal_cliente_auditoria_equipe.sql >/dev/null
# auditoria parte de auth.users: conta sem linha em usuarios tem de aparecer
saida=$(sed -e '/@@AUDITORIA@@/{r _sql/tests/portal_cliente_auditoria_equipe.sql' -e 'd}'   _sql/tests/portal_cliente_auditoria.test.sql | psql_ -d portal_test -qAt)
if ! printf '%s
' "$saida" | grep -q '|orfao@auditoria.test|'; then
  echo "FALHA auditoria_parte_de_auth_users: conta sem linha em usuarios nao apareceu" >&2
  exit 1
fi
echo "OK: testes de isolacao passaram"
