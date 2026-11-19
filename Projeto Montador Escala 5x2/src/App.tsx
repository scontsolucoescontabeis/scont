import { ArrowLeft, ArrowRight, Home, RotateCcw } from 'lucide-react'
import { REGRAS, limitesDaEtapa } from './config/regras'
import { StepCobertura } from './components/StepCobertura'
import { StepEmpresa } from './components/StepEmpresa'
import { StepEquipe } from './components/StepEquipe'
import { StepEscala } from './components/StepEscala'
import { AvisoLegal } from './components/ui'
import { useStore } from './store/useStore'

const LOGO_URL = 'https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png'
const PASSOS = ['Empresa', 'Equipe', 'Cobertura', 'Escala']

export default function App() {
  const passo = useStore((s) => s.passo)
  const set = useStore((s) => s.set)
  const reiniciar = useStore((s) => s.reiniciar)
  const e1 = limitesDaEtapa('etapa1')

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 pb-16">
      <header className="mb-6 overflow-hidden rounded-xl bg-gradient-to-br from-brand to-secondary text-white shadow-card">
        <div className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <span className="rounded-lg bg-white px-3 py-1.5">
            <img src={LOGO_URL} alt="SCONT Soluções Contábeis" className="h-9 w-auto" />
          </span>
          <div className="mr-auto min-w-[220px]">
            <h1 className="text-2xl font-bold tracking-tight">Montador de Escala 5x2</h1>
            <p className="text-sm opacity-90">
              Planeje a escala para a EC 141/2026 — 1ª etapa em {REGRAS.etapa1.inicio.split('-').reverse().join('/')} ({e1.jornadaSemanalMax}h
              semanais).
            </p>
          </div>
          <a href="../../portal.html" className="btn border border-white/40 text-white hover:bg-white/15">
            <Home size={16} aria-hidden /> Portal
          </a>
          <button
            type="button"
            className="btn border border-white/40 text-white hover:bg-white/15"
            onClick={() => window.confirm('Apagar todos os dados e recomeçar?') && reiniciar()}
          >
            <RotateCcw size={16} aria-hidden /> Recomeçar
          </button>
        </div>
      </header>

      <nav aria-label="Passos" className="mb-4">
        <ol className="grid grid-cols-4 gap-2">
          {PASSOS.map((nome, i) => (
            <li key={nome}>
              <button
                type="button"
                aria-current={i === passo ? 'step' : undefined}
                onClick={() => set({ passo: i })}
                className={`w-full rounded-lg border px-2 py-2 text-xs font-semibold sm:text-sm ${
                  i === passo ? 'border-brand bg-brand text-white shadow-card' : 'border-line bg-white hover:border-brand'
                }`}
              >
                {i + 1}. {nome}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <main>
        {passo === 0 && <StepEmpresa />}
        {passo === 1 && <StepEquipe />}
        {passo === 2 && <StepCobertura />}
        {passo === 3 && <StepEscala />}
      </main>

      <div className="mt-4 flex justify-between">
        <button type="button" className="btn-sec" disabled={passo === 0} onClick={() => set({ passo: passo - 1 })}>
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
        <button type="button" className="btn-primario" disabled={passo === PASSOS.length - 1} onClick={() => set({ passo: passo + 1 })}>
          Avançar <ArrowRight size={16} aria-hidden />
        </button>
      </div>

      <footer className="mt-8 space-y-1">
        <AvisoLegal texto={REGRAS.avisoLegal} />
        <p className="text-xs text-soft">
          Regras versão {REGRAS.versao} · atualizadas em {REGRAS.atualizadoEm.split('-').reverse().join('/')}
        </p>
      </footer>
    </div>
  )
}
