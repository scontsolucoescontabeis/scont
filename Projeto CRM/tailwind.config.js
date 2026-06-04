/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'scont-primary': '#7a1e1e',
        'scont-primary-dark': '#5c1515',
        'scont-primary-light': '#9b2c2c',
        'scont-primary-muted': '#f0e8e8',
        'scont-bg': '#f2f2f0',
        'scont-surface': '#ffffff',
        'scont-surface-2': '#f7f6f4',
        'scont-border': '#e0dcd8',
        'scont-text': '#1a1a1a',
        'scont-text-muted': '#888480',
        'scont-ok': '#2d7a4f',
        'scont-warn': '#b87a00',
        'scont-danger': '#b83232',
        depto: {
          pessoal: '#3B82F6',
          contabil: '#10B981',
          administrativo: '#F59E0B',
          tributario: '#8B5CF6',
        },
      },
      fontFamily: {
        serif: ['Merriweather', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px',
      },
    },
  },
  plugins: [],
}
