-- supabase/migrations/011_dev_simulator.sql
-- Permite ao simulador (anon key) ler mensagens e conversas via Realtime.
-- ATENÇÃO: policies permissivas intencionais — usar apenas em ambiente de dev.

DROP POLICY IF EXISTS "dev_sim_mensagens_read" ON mensagens;
CREATE POLICY "dev_sim_mensagens_read" ON mensagens
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "dev_sim_conversas_read" ON conversas;
CREATE POLICY "dev_sim_conversas_read" ON conversas
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "dev_sim_usuarios_read" ON usuarios;
CREATE POLICY "dev_sim_usuarios_read" ON usuarios
  FOR SELECT USING (true);
