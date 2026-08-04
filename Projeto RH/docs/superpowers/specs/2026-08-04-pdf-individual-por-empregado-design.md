# PDF individual por empregado (Benefícios e Folha de Ponto)

## Contexto

Hoje, tanto "Gerar Benefícios" (recibos de VT/VA) quanto "Gerar Folhas de Ponto" já agrupam a geração de PDF por empresa (nunca misturam empresas em um mesmo arquivo), mas dentro de cada arquivo de empresa todos os empregados aparecem juntos, como páginas/vias do mesmo PDF. Algumas empresas precisam receber um PDF separado por empregado (ex.: para envio individual por e-mail). Esta feature adiciona uma configuração por empresa que, quando ativada, faz a plataforma gerar um PDF por empregado em vez de um PDF único por empresa.

## Configuração

- Novo toggle no modal "Configurar Rubricas por Empresa" (`abrirModalConfigRubricas`), na mesma seção dos demais toggles de Benefícios/Período de Apuração: **"Gerar recibos e folhas de ponto individualmente por empregado"**.
- Um único toggle afeta tanto Benefícios quanto Folha de Ponto (não são configuráveis separadamente).
- Persistido como novo `evento = 'pdf_individual_por_empregado'` na tabela existente `rh_config_rubricas_txt` (mesmo padrão chave-valor por `codigo_empresa` já usado por `beneficios_periodo_ativo`, `periodo_apuracao_ativo` etc.), valor `'1'`/`'0'`. Sem SQL novo.
- Lido via `_buscarConfigRubricas()` (já cacheado por empresa) nos pontos de geração de PDF.
- Default: desativado. Empresas existentes mantêm o comportamento atual (1 PDF por empresa) até ativarem explicitamente.

## Gerar Benefícios — recibos (`_gerarPdfsRecibosBeneficios`, script.js)

- Comportamento atual: para cada `codigo_empresa` + tipo (VT/VA), monta um único PDF com todos os empregados como páginas (2 vias cada) via `_gerarPdfRecibos`.
- Novo comportamento (toggle ativo para a empresa): em vez de um PDF único por empresa+tipo, gera um PDF por empregado (mesmas 2 vias, apenas daquele empregado) e empacota todos os PDFs daquela empresa+tipo em um `.zip` via JSZip — `Recibos_${label}_${nomeEmpresa}_${mmaaaa}.zip`, contendo arquivos `${codigo_empresa}_Recibo_${label}_${matricula}_${nomeEmpregado}_${mmaaaa}.pdf`.
- **Relatório Líquido de Benefícios não é afetado** — permanece sempre 1 PDF-resumo por empresa, independente do toggle, pois é uma tabela com uma linha por empregado, não um recibo individual.

## Gerar Folhas de Ponto (`baixarPdfsFolhaPonto` / `_construirPdfEmpresaFolhaPonto`, script.js)

- Comportamento atual: 1 PDF por empresa com 1 página por empregado; se há múltiplas empresas selecionadas, todos os PDFs de empresa são empacotados em um único zip; se há apenas 1 empresa, o PDF é salvo diretamente (sem zip).
- Novo comportamento (toggle ativo para a empresa): em vez de páginas dentro de um PDF único da empresa, gera 1 PDF por empregado daquela empresa. Esses PDFs entram no mesmo zip já usado hoje para múltiplas empresas — estendendo o mecanismo existente em vez de criar um segundo. Quando há apenas 1 empresa selecionada e o toggle está ativo, a geração passa a sempre produzir um zip (em vez de `.save()` direto), já que há múltiplos arquivos de empregado a entregar.
- Nome dos arquivos individuais: `FolhaDePonto_${codigo_empresa}_${matricula}_${nomeEmpregado}_${mm}-${aaaa}.pdf`.

## Comportamento com múltiplas empresas selecionadas

Cada empresa é tratada de forma independente, conforme sua própria configuração. Numa mesma geração é possível ter empresas com o toggle ligado e outras desligado — cada uma segue sua própria lógica (PDF único ou PDFs individuais), e todos os arquivos resultantes continuam sendo entregues juntos (mesmo zip final na Folha de Ponto; mesma leva de downloads/zips em Benefícios).

## Fora de escopo

- Não altera o Relatório Líquido de Benefícios (permanece 1 PDF por empresa).
- Não introduz configuração separada por tipo de documento (recibo vs folha de ponto) — é um único toggle.
- Não altera o Controle de Frequência (que não gera PDF).

## Verificação

Sem testes automatizados nessas telas (app HTML/JS direto, sem cobertura de UI). Verificação manual: gerar Benefícios e Folha de Ponto para uma empresa com o toggle desligado (comportamento atual preservado, PDF único por empresa) e para uma empresa com o toggle ligado (zip contendo PDFs individuais por empregado, nomes e conteúdo corretos).
