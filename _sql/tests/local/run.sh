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
if [ -z "${SKIP_SCHEMA:-}" ]; then psql_ -d portal_test < _sql/schema_portal_cliente.sql; fi
# SKIP_BLOQUEIO=1 permite ver o RED (teste de isolacao sem a politica restritiva)
if [ -z "${SKIP_BLOQUEIO:-}" ]; then psql_ -d portal_test < _sql/schema_portal_cliente_bloqueio.sql; fi
psql_ -d portal_test < _sql/tests/portal_cliente_isolamento.test.sql
if [ -z "${SKIP_BLOQUEIO:-}" ]; then
  sed -e '/@@APLICAR@@/{r _sql/schema_portal_cliente_bloqueio.sql' -e 'd}'       -e '/@@REVERTER@@/{r _sql/schema_portal_cliente_bloqueio_reverter.sql' -e 'd}'       _sql/tests/portal_cliente_bloqueio.test.sql | psql_ -d portal_test
fi
# auditoria: so valida que o SQL e valido (dados locais sao vazios)
psql_ -d portal_test < _sql/tests/portal_cliente_auditoria_equipe.sql >/dev/null
echo "OK: testes de isolacao passaram"
