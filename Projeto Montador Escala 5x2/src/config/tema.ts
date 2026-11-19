/**
 * Tema visual. Troque os valores pelas cores oficiais da SCONT quando
 * disponíveis — o Tailwind (tailwind.config.js) e o PDF/Excel leem daqui.
 */
export const TEMA = {
  nome: 'SCONT Soluções Contábeis',
  cores: {
    acento: '#0b5ed7', // TODO: trocar pelo azul/cor oficial da SCONT
    acentoEscuro: '#0842a0',
    acentoClaro: '#e7f0fe',
    texto: '#1f2937',
    textoSuave: '#4b5563',
    borda: '#d1d5db',
    fundo: '#f8fafc',
    verde: '#15803d',
    amarelo: '#a16207',
    vermelho: '#b91c1c',
  },
} as const

export type Tema = typeof TEMA
