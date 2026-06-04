import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { MessageSquare, BarChart2, Users, LogOut, ClipboardList, BookUser } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { buscarMeuPerfil } from '@/services/crm.service'
import CRMPage from '@/pages/CRMPage'
import MetricasPage from '@/pages/MetricasPage'
import UsuariosPage from '@/pages/UsuariosPage'
import TarefasPage from '@/pages/TarefasPage'
import ContatosPage from '@/pages/ContatosPage'
import SemAcessoPage from '@/pages/SemAcessoPage'

// ============================================================
// Tela de Login
// ============================================================
function LoginPage() {
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f2f2f0',
    }}>
      <div style={{
        background: '#fff',
        border: '1px solid #e0dcd8',
        borderRadius: 10,
        padding: '40px 36px',
        width: 380,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            background: '#7a1e1e',
            borderRadius: 10,
            marginBottom: 12,
          }}>
            <MessageSquare size={22} color="#fff" />
          </div>
          <h1 style={{ fontFamily: 'Merriweather, serif', fontSize: 20, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            SCONT CRM
          </h1>
          <p style={{ fontSize: 13, color: '#888480', margin: '6px 0 0' }}>Portal SCONT Soluções Contábeis</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>
            E-mail
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              style={{
                display: 'block', width: '100%', marginTop: 4,
                padding: '9px 12px', border: '1px solid #e0dcd8', borderRadius: 6,
                fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <label style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>
            Senha
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                display: 'block', width: '100%', marginTop: 4,
                padding: '9px 12px', border: '1px solid #e0dcd8', borderRadius: 6,
                fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </label>

          {erro && <p style={{ fontSize: 12, color: '#b83232', margin: 0 }}>{erro}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px',
              background: loading ? '#9b6b6b' : '#7a1e1e',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              marginTop: 4,
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// Sidebar de navegação
// ============================================================
function Sidebar({ isAdmin, onLogout }) {
  const navLinkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 14px',
    borderRadius: 6,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    color: isActive ? '#7a1e1e' : '#888480',
    background: isActive ? '#f0e8e8' : 'transparent',
    margin: '1px 0',
    transition: 'background 0.15s',
  })

  return (
    <div style={{
      width: 200,
      borderRight: '1px solid #e0dcd8',
      background: '#f7f6f4',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 8px',
      height: '100%',
    }}>
      <div style={{ padding: '6px 8px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#7a1e1e', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          SCONT
        </div>
        <div style={{ fontSize: 11, color: '#888480' }}>Portal CRM</div>
      </div>

      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#c5c0ba', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 6px' }}>
          Atendimento
        </div>
        <NavLink to="/crm" style={navLinkStyle}>
          <MessageSquare size={15} />
          WhatsApp CRM
        </NavLink>
        <NavLink to="/crm/tarefas" style={navLinkStyle}>
          <ClipboardList size={15} />
          Tarefas
        </NavLink>
        <NavLink to="/crm/contatos" style={navLinkStyle}>
          <BookUser size={15} />
          Contatos
        </NavLink>

        {isAdmin && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#c5c0ba', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 8px 6px' }}>
              Administração
            </div>
            <NavLink to="/crm/metricas" style={navLinkStyle}>
              <BarChart2 size={15} />
              Métricas
            </NavLink>
            <NavLink to="/crm/usuarios" style={navLinkStyle}>
              <Users size={15} />
              Usuários
            </NavLink>
          </>
        )}
      </nav>

      <button
        onClick={onLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, color: '#888480',
          borderRadius: 6, fontFamily: 'DM Sans, sans-serif',
        }}
      >
        <LogOut size={14} />
        Sair
      </button>
    </div>
  )
}

// ============================================================
// Header SCONT
// ============================================================
function Header({ perfil }) {
  return (
    <header style={{
      height: 52,
      background: '#7a1e1e',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 12,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        <MessageSquare size={18} color="#fff" />
        <span style={{ fontFamily: 'Merriweather, serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>
          SCONT
        </span>
        <span style={{ color: '#f0e8e8', fontSize: 13, opacity: 0.7 }}>— CRM WhatsApp</span>
      </div>

      {perfil && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#9b2c2c',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff',
          }}>
            {perfil.nome?.[0]?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize: 13, color: '#f0e8e8' }}>{perfil.nome}</span>
        </div>
      )}
    </header>
  )
}

// ============================================================
// App principal
// ============================================================
export default function App() {
  const [session, setSession]       = useState(undefined)
  const [perfil, setPerfil]         = useState(undefined) // undefined = carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) {
      buscarMeuPerfil()
        .then(p => setPerfil(p))       // null = autenticado mas sem perfil CRM
        .catch(() => setPerfil(null))
    } else if (session === null) {
      setPerfil(null)
    }
  }, [session])

  // Aguardando verificação inicial
  if (session === undefined || (session && perfil === undefined)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2f2f0' }}>
        <div style={{ color: '#888480', fontSize: 13 }}>Carregando...</div>
      </div>
    )
  }

  // Não autenticado → tela de login
  if (!session) return <LoginPage />

  // Autenticado mas sem acesso ao CRM → tela informativa
  if (!perfil) {
    return <SemAcessoPage email={session.user.email} onSair={() => supabase.auth.signOut()} />
  }

  const isAdmin = perfil.role === 'ADMIN'
  const handleLogout = () => supabase.auth.signOut()

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <Header perfil={perfil} />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Sidebar isAdmin={isAdmin} onLogout={handleLogout} />
          <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/crm" replace />} />
              <Route path="/crm" element={<CRMPage perfil={perfil} />} />
              <Route path="/crm/tarefas" element={<TarefasPage perfil={perfil} />} />
              <Route path="/crm/contatos" element={<ContatosPage />} />
              {isAdmin && <Route path="/crm/metricas" element={<MetricasPage />} />}
              {isAdmin && <Route path="/crm/usuarios" element={<UsuariosPage />} />}
              <Route path="*" element={<Navigate to="/crm" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
