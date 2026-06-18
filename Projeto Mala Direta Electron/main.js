const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'SCONT — Mala Direta',
        show: false,
        backgroundColor: '#F7F8FA',
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

// ── IPC: enviar email via Outlook COM (PowerShell) ────────────────────────────

ipcMain.handle('enviar-email-outlook', async (_event, { dest, assunto, htmlBody }) => {
    const ts      = Date.now();
    const tmpHtml = path.join(app.getPath('temp'), `md_body_${ts}.html`);
    const tmpPs   = path.join(app.getPath('temp'), `md_send_${ts}.ps1`);

    // Escreve o HTML em arquivo temporário (evita problemas de escape)
    fs.writeFileSync(tmpHtml, htmlBody, { encoding: 'utf8' });

    // Escapa aspas simples para PowerShell single-quoted strings
    const esc = s => String(s || '').replace(/'/g, "''");

    const psScript = `
$ErrorActionPreference = 'Stop'
try {
    $outlook = New-Object -ComObject Outlook.Application
    $mail    = $outlook.CreateItem(0)
    $mail.To      = '${esc(dest)}'
    $mail.Subject = '${esc(assunto)}'
    $mail.HTMLBody = [System.IO.File]::ReadAllText('${esc(tmpHtml)}', [System.Text.Encoding]::UTF8)
    $mail.Send()
    Write-Output 'OK'
} catch {
    Write-Error $_.Exception.Message
    exit 1
} finally {
    try { Remove-Item '${esc(tmpHtml)}' -Force -ErrorAction SilentlyContinue } catch {}
}
`;

    fs.writeFileSync(tmpPs, psScript, { encoding: 'utf8' });

    const { execFile } = require('child_process');
    return new Promise((resolve) => {
        execFile('powershell', ['-ExecutionPolicy', 'Bypass', '-File', tmpPs],
            { timeout: 30000 },
            (err, stdout, stderr) => {
                try { fs.unlinkSync(tmpPs); } catch (_) {}
                if (err) {
                    resolve({ ok: false, erro: (stderr || err.message).trim() });
                } else {
                    resolve({ ok: true });
                }
            }
        );
    });
});
