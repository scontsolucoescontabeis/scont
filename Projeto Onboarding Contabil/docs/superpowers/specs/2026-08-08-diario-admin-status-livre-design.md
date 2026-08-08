# Admin do Portal: mudar livremente o status mensal da grade

## Contexto

Hoje o status mensal (`contabil_diario_status_mensal`) segue um pipeline
fixo, só andando pra frente, disparado por clique na célula
(`diario.js:renderGradeMensal`, listener em `.mapa-grade-cel`):
`nao_iniciado → em_andamento → (pendencia ↔ em_andamento) → concluido`, com
`reabrirMes` sendo a única exceção (`concluido → em_andamento`, com
confirmação). Isso vale pra qualquer usuário que possa clicar na grade
(sem checagem de permissão hoje, além do lock de `aprovado`). O único
freio existente é: se `statusFechamentoDoMes(...) === 'aprovado'`
(encerramento já validado pela equipe Scont), a célula trava e nenhum
clique faz nada — esse lock já é exatamente "validação de encerramento",
citado no pedido.

O pedido: o **administrador do portal** (`_isAdmin`, o super-admin do
Portal Scont — distinto de `_isScontTeam`, que é qualquer usuário da
empresa "Scont Soluções Contábeis") deve poder pular pra **qualquer**
status diretamente, sem seguir o pipeline, contanto que o mês não esteja
travado por `aprovado`.

## O que muda

1. **Só pra `_isAdmin`**, o clique na célula da grade passa a abrir um
   popover com as 4 opções de status (Não Iniciado / Em Andamento /
   Pendência / Concluído), em vez de seguir a ação única do pipeline atual.
   O botão do status atual aparece desabilitado (`(atual)`), os outros 3
   são clicáveis. Escolher "Pendência" abre o mesmo textarea de motivo
   obrigatório já usado hoje (`abrirFormPendenciaNoPopover`), só que
   generalizado pra qualquer origem, não só `em_andamento → pendencia`.
2. **Demais perfis** (Scont Team não-admin, Prestador de Serviço) continuam
   exatamente no fluxo/pipeline atual — nenhuma mudança de comportamento
   pra eles.
3. Nova função `alterarStatusMesAdmin(codigoEmpresa, ano, mes, statusAtual,
   statusNovo, motivo)`: valida `_isAdmin` e o lock de `aprovado` (defesa
   em profundidade, mesmo padrão das demais funções de transição), depois
   chama `transicionarStatusMes` diretamente — a mesma função genérica que
   já grava em `contabil_diario_status_mensal` e em
   `contabil_diario_auditoria` (`registrarAuditoria`), então toda mudança
   feita pelo admin continua 100% rastreável no Histórico, com o "de/para"
   real (ex.: `Concluído → Não Iniciado`), independente de ser ou não uma
   transição que o pipeline normal permitiria.
4. **Sem e-mail automático** nas transições feitas por esse caminho
   administrativo — os alertas existentes (`enviarAlertaPendencia`,
   `enviarAlertaPendenciaResolvida`) são acoplados às funções do pipeline
   normal (`marcarPendencia`, `resolverPendencia`, disparadas por quem
   opera a execução no dia a dia); um ajuste administrativo do admin é
   tratado como correção pontual, não um evento operacional que deva
   notificar a equipe Scont. Continua auditável via Histórico de qualquer
   forma.

## Fora de escopo

- Fluxo de fechamento/validação (`contabil_diario_fechamentos`,
  enviado/aprovado/rejeitado) não muda — continua sendo o único jeito de
  travar (`aprovado`) ou destravar (rejeitar) um mês pra edição.
- Sem mudança de permissão pra `_isScontTeam` não-admin — só o
  super-admin do portal ganha esse poder, conforme pedido.
- Documentação Disponível (`alternarDocumentacaoDisponivel`) já é
  Scont/Admin, sem mudança.
