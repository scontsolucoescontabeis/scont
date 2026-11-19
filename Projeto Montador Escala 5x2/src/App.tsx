import { ArrowLeft, ArrowRight, Building2, CalendarDays, Home, Menu, RotateCcw, ShieldCheck, Users, X } from 'lucide-react'
import { useState } from 'react'
import { REGRAS, limitesDaEtapa } from './config/regras'
import { StepCobertura } from './components/StepCobertura'
import { StepEmpresa } from './components/StepEmpresa'
import { StepEquipe } from './components/StepEquipe'
import { StepEscala } from './components/StepEscala'
import { AvisoLegal } from './components/ui'
import { useStore } from './store/useStore'

const LOGO_URL = 'https://scontdf.com.br/wp-content/uploads/2019/11/logo-scont-1024x363.png'
const PASSOS = [
  { nome: 'Empresa', Icone: Building2 },
  { nome: 'Equipe', Icone: Users },
  { nome: 'Cobertura', Icone: ShieldCheck },
  { nome: 'Escala', Icone: CalendarDays },
]

export default function App() {
  const passo = useStore((s) => s.passo)
  const irParaPasso = useStore((s) => s.irParaPasso)
  const reiniciar = useStore((s) => s.reiniciar)
  const e1 = limitesDaEtapa('etapa1')
  const [menuAberto, setMenuAberto] = useState(false)

  const irPara = (i: number) => {
    irParaPasso(i)
    setMenuAberto(false)
  }

  return (
    <div className="min-h-screen">
      <button
        type="button"
        aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuAberto}
        onClick={() => setMenuAberto((v) => !v)}
        className="fixed left-3 top-3 z-[1100] rounded-lg bg-brand p-2 text-white shadow-lg lg:hidden"
      >
        {menuAberto ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>
      {menuAberto && (
        <div className="fixed inset-0 z-[900] bg-black/50 lg:hidden" onClick={() => setMenuAberto(false)} aria-hidden />
      )}

      <aside
        className={`fixed left-0 top-0 z-[1000] flex h-screen w-[260px] flex-col overflow-y-auto bg-gradient-to-br from-brand to-secondary p-5 text-white shadow-lg transition-transform duration-300 lg:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 border-b border-white/15 pb-5 text-center">
          <span className="mx-auto mb-3 block w-fit rounded-lg bg-white px-3 py-1.5">
            <img src={LOGO_URL} alt="SCONT Soluções Contábeis" className="h-9 w-auto" />
          </span>
          <h2 className="text-[17px] font-bold tracking-wide">Montador de Escala</h2>
          <p className="text-xs font-medium opacity-85">EC 141/2026 · 5x2</p>
        </div>

        <nav aria-label="Passos">
          <ol className="space-y-1">
            {PASSOS.map(({ nome, Icone }, i) => (
              <li key={nome}>
                <button
                  type="button"
                  aria-current={i === passo ? 'step' : undefined}
                  onClick={() => irPara(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    i === passo ? 'bg-white text-brand shadow-card' : 'text-white/90 hover:bg-white/15'
                  }`}
                >
                  <Icone size={18} aria-hidden />
                  {i + 1}. {nome}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-auto space-y-2 border-t border-white/15 pt-5">
          <a
            href="../../portal.html"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/40 px-3 py-2 text-sm font-semibold hover:bg-white/15"
          >
            <Home size={16} aria-hidden /> Voltar ao Portal
          </a>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/40 px-3 py-2 text-sm font-semibold hover:bg-white/15"
            onClick={() => window.confirm('Apagar todos os dados e recomeçar?') && reiniciar()}
          >
            <RotateCcw size={16} aria-hidden /> Recomeçar
          </button>
        </div>
      </aside>

      <div className="px-4 pb-16 pt-14 lg:ml-[260px] lg:p-8">
        <div className={passo === 3 ? 'w-full' : 'max-w-6xl'}>
          <header className="mb-6 rounded-xl border-l-4 border-brand bg-white p-5 shadow-card sm:p-6">
            <h1 className="text-2xl font-bold tracking-tight text-brand">Montador de Escala 5x2</h1>
            <p className="text-sm text-soft">
              Planeje a escala para a EC 141/2026 — 1ª etapa em {REGRAS.etapa1.inicio.split('-').reverse().join('/')} (
              {e1.jornadaSemanalMax}h semanais).
            </p>
          </header>

          <main>
            {passo === 0 && <StepEmpresa />}
            {passo === 1 && <StepEquipe />}
            {passo === 2 && <StepCobertura />}
            {passo === 3 && <StepEscala />}
          </main>

          <div className="mt-4 flex justify-between">
            <button type="button" className="btn-sec" disabled={passo === 0} onClick={() => irPara(passo - 1)}>
              <ArrowLeft size={16} aria-hidden /> Voltar
            </button>
            <button
              type="button"
              className="btn-primario"
              disabled={passo === PASSOS.length - 1}
              onClick={() => irPara(passo + 1)}
            >
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
      </div>
    </div>
  )
}
