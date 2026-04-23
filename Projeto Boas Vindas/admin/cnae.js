// ===== CARREGAR DADOS CNAE DO ARQUIVO =====
window.CNAES_LISTA = [];

async function carregarCNAEs() {
    try {
        console.log('🔄 Iniciando carregamento de CNAEs...');
        
        const response = await fetch('/cnaes.txt');
        
        if (!response.ok) {
            console.error('❌ Erro ao buscar cnaes.txt:', response.status);
            return;
        }
        
        const texto = await response.text();
        console.log('✓ Arquivo cnaes.txt carregado');
        
        // Extrair dados entre window.CNAE_DATA = ` e `;
        const inicio = texto.indexOf('window.CNAE_DATA = `');
        const fim = texto.indexOf('`;', inicio);
        
        if (inicio === -1 || fim === -1) {
            console.error('❌ Marcadores CNAE_DATA não encontrados');
            return;
        }
        
        const dataInicio = inicio + 'window.CNAE_DATA = `'.length;
        const dados = texto.substring(dataInicio, fim);
        const linhas = dados.split('\n');
        
        console.log(`📊 Total de linhas no arquivo: ${linhas.length}`);
        
        let contadorAdicionados = 0;
        
        linhas.forEach((linha, index) => {
            linha = linha.trim();
            
            // Pular linhas vazias e comentários
            if (!linha || linha.startsWith('//')) {
                return;
            }
            
            // Formato: ;;;;CODIGO;ATIVIDADE
            const partes = linha.split(';');
            
            // Coluna 5 = CNAE (índice 4), Coluna 6 = Atividade (índice 5)
            if (partes.length >= 6) {
                const codigo = partes[4]?.trim();
                const atividade = partes[5]?.trim().replace(/"/g, '');
                
                // Apenas adicionar se código não está vazio e contém /
                if (codigo && atividade && codigo.includes('/')) {
                    window.CNAES_LISTA.push({
                        codigo: codigo,
                        atividade: atividade
                    });
                    contadorAdicionados++;
                }
            }
        });
        
        console.log(`✅ Carregados ${contadorAdicionados} CNAEs com sucesso!`);
        console.log('📋 Primeiros 5 CNAEs:', window.CNAES_LISTA.slice(0, 5));
        
    } catch (error) {
        console.error('❌ Erro ao carregar CNAEs:', error);
    }
}

// Carregar ao inicializar
console.log('📌 Script cnae.js carregado');

if (document.readyState === 'loading') {
    console.log('⏳ DOM ainda carregando, aguardando DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 DOMContentLoaded disparado, carregando CNAEs...');
        carregarCNAEs();
    });
} else {
    console.log('🚀 DOM já carregado, carregando CNAEs imediatamente...');
    carregarCNAEs();
}