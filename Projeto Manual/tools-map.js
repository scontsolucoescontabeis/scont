/**
 * Mapa dos grupos do Manual do Usuário.
 *
 * Cada grupo vira uma seção no menu lateral e carrega um fragmento HTML de
 * content/<slug>.html. `prefixos` lista os começos de url_base (tabela
 * `ferramentas`, minúsculo, sem acento no separador) que autorizam o grupo:
 * se o usuário tem acesso a QUALQUER ferramenta cujo url_base comece com um
 * desses prefixos, o grupo aparece para ele — igual à lógica de autorização
 * por pasta já usada em portal-auth-guard.js.
 *
 * Para adicionar um novo grupo: acrescentar aqui + criar content/<slug>.html.
 */
window.MANUAL_GRUPOS = [
    {
        slug: 'rh-controle-frequencia',
        nome: 'Controle de Frequência',
        icone: '🕐',
        prefixos: ['./projeto rh/index.html'],
    },
    {
        slug: 'rh-lancamentos',
        nome: 'Lançamentos de Folha',
        icone: '📋',
        prefixos: ['./projeto rh/lancamentos.html'],
    },
    {
        slug: 'rh-admin',
        nome: 'Administração RH',
        icone: '⚙️',
        prefixos: ['./projeto rh/admin.html'],
    },
    {
        slug: 'rh-conversor-renomeador',
        nome: 'Conversor e Renomeador de Arquivos',
        icone: '📂',
        prefixos: ['./projeto rh/conversor.html', './projeto rh/renomeador.html'],
    },
    {
        slug: 'beneficios',
        nome: 'Benefícios (VT/VA)',
        icone: '🎫',
        prefixos: ['./projeto beneficios/'],
    },
    {
        slug: 'calendario-folha',
        nome: 'Calendário da Folha',
        icone: '📅',
        prefixos: ['./projeto calendario folha/'],
    },
    {
        slug: 'fechamento-folha',
        nome: 'Fechamento de Folha',
        icone: '📊',
        prefixos: ['./projeto fechamento folha/'],
    },
    {
        slug: 'simulador-folha',
        nome: 'Simulador de Folha de Pagamento',
        icone: '🧮',
        prefixos: ['./projeto simulador folha/'],
    },
];
