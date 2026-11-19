import type { Config } from 'tailwindcss'
import { TEMA } from './src/config/tema'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: TEMA.cores.acento,
          dark: TEMA.cores.acentoEscuro,
          light: TEMA.cores.acentoClaro,
        },
        ok: TEMA.cores.verde,
        warn: TEMA.cores.amarelo,
        bad: TEMA.cores.vermelho,
        ink: TEMA.cores.texto,
        soft: TEMA.cores.textoSuave,
        line: TEMA.cores.borda,
        paper: TEMA.cores.fundo,
      },
    },
  },
} satisfies Config
