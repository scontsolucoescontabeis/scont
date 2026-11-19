/**
 * Tema visual — identidade do Portal SCONT (espelha ../../shared.css).
 * O Tailwind (tailwind.config.ts) e o PDF/Excel leem daqui.
 */
export const TEMA = {
  nome: 'SCONT Soluções Contábeis',
  cores: {
    acento: '#8B3A3A', // --primary do portal
    acentoEscuro: '#6B2A2A', // --primary-dark
    acentoClaro: '#F7ECEC',
    secundaria: '#2C3E50', // --secondary
    texto: '#2C3E50',
    textoSuave: '#5A6C7D',
    borda: '#E0E6ED',
    fundo: '#F0F2F5',
    verde: '#15803d',
    amarelo: '#a16207',
    vermelho: '#b91c1c',
  },
} as const

export type Tema = typeof TEMA
