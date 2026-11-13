const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'SCONT — Renomeador de Arquivos',
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        show: false,
        backgroundColor: '#F4F7F6',
    });

    win.loadFile('index.html');
    win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ── IPC: salvar arquivos direto no filesystem ──────────────────────────────

ipcMain.handle('salvar-arquivos', async (_event, arquivos) => {
    /*
     * arquivos: Array de { novoNome, bufferBase64, pathExpress, pathDinamico }
     * Retorna: { salvos, erros: string[] }
     */
    let salvos = 0;
    const erros = [];

    for (const arq of arquivos) {
        try {
            const buffer = Buffer.from(arq.bufferBase64, 'base64');

            // Cópia 1 — EXPRESS (pasta fixa, arquivo na raiz)
            if (arq.pathExpress) {
                fs.mkdirSync(arq.pathExpress, { recursive: true });
                fs.writeFileSync(path.join(arq.pathExpress, arq.novoNome), buffer);
            }

            // Cópia 2 — DINÂMICO (hierarquia de subpastas variável)
            if (arq.pathDinamico) {
                fs.mkdirSync(arq.pathDinamico, { recursive: true });
                fs.writeFileSync(path.join(arq.pathDinamico, arq.novoNome), buffer);
            }

            salvos++;
        } catch (e) {
            erros.push(`${arq.novoNome}: ${e.message}`);
        }
    }

    return { salvos, erros };
});

// ── IPC: abrir diálogo de escolha de pasta (opcional, para browse) ─────────

ipcMain.handle('escolher-pasta', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Selecionar pasta',
    });
    return result.canceled ? null : result.filePaths[0];
});
