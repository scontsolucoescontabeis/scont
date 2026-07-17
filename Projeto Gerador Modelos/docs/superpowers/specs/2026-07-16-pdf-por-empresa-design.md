# Gerador de Modelos — um PDF por empresa na exportação

## Contexto

`exportarPDF()` (app.js) monta todas as páginas de `wizardRegistros` numa única
janela de impressão, independente de quantas empresas foram selecionadas no
wizard. Quando o mesmo modelo é gerado para mais de uma empresa (ex.: Vale
Alimentação para 3 empresas), os documentos de todas saem misturados num único
arquivo/impressão.

## Requisito

Quando o modelo é gerado para mais de uma empresa, deve ser produzido um
arquivo por empresa, cada um contendo todos os registros daquela empresa.

## Abordagem

Agrupar `wizardRegistros` por empresa antes de montar o HTML de impressão:

- Chave de agrupamento: `varMap['empresa.codigo_empresa']`, com fallback para
  `varMap['empresa.nome_empresa']`, e um grupo `'__sem_empresa__'` quando
  nenhum dos dois existir (evita perder registros silenciosamente).
- **1 grupo só** (empresa única selecionada, ou modo Excel puro sem vínculo de
  empresa): comportamento idêntico ao atual — uma janela de impressão.
- **2+ grupos**: reaproveita a mesma lógica de montagem de páginas já
  existente (incluindo o fluxo de evento com múltiplos modelos por registro) e
  abre uma janela de impressão por empresa, em sequência, cada uma com
  `<title>` = `"${modelo.nome} — ${nomeEmpresa}"` (nome sugerido pelo
  navegador ao salvar como PDF). As janelas são escalonadas (delay incremental
  por índice) para não abrir vários diálogos de impressão simultaneamente.
- Toast final informa quantos arquivos foram gerados.
- `registrarGeracao()` não muda — continua registrando uma linha agregada em
  `gm_geracoes` (já grava `empresas_ids` com todas as empresas envolvidas).

## Fora do escopo

- Preview (`renderPreview`) e Exportar Excel (`exportarExcel`) não mudam —
  a mudança é isolada em `exportarPDF()`.
- Não migra o mecanismo de impressão (window.print) para geração de PDF real
  via jsPDF/html2canvas — mantém o padrão atual de "abrir janela → usuário
  salva como PDF pelo diálogo do navegador", só que uma vez por empresa.

## Edge cases

- Registro sem empresa identificável cai num grupo próprio, não é descartado
  nem misturado com outra empresa.
