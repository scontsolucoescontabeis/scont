// ===== PARSER DE CNAEs =====
// Lê window.CNAE_DATA definido por cnaes.js (carregado antes deste script)
// Formato CSV: secao;divisao;grupo;classe;subclasse;denominacao
// Apenas subclasses têm código no formato NNNN-N/NN (índice 4)

window.CNAES_LISTA = [];

function parsearCNAEs() {
    if (!window.CNAE_DATA) {
        console.error('[cnae.js] window.CNAE_DATA não encontrado — verifique se cnaes.js foi carregado antes');
        return;
    }

    const linhas = window.CNAE_DATA.split('\n');
    let count = 0;

    linhas.forEach(linha => {
        linha = linha.trim();
        if (!linha || linha.startsWith('//')) return;

        const partes = linha.split(';');
        if (partes.length < 6) return;

        const codigo    = partes[4]?.trim();
        const atividade = partes[5]?.trim().replace(/"/g, '');

        // Subclasses têm código no formato NNNN-N/NN (ex: 0111-3/01)
        if (codigo && atividade && /\d{4}-\d\/\d{2}/.test(codigo)) {
            window.CNAES_LISTA.push({ codigo, atividade });
            count++;
        }
    });

    console.log(`[cnae.js] ${count} CNAEs carregados.`);
}

// Executar após o DOM estar pronto (garante que cnaes.js já foi executado)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', parsearCNAEs);
} else {
    parsearCNAEs();
}
