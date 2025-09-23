import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login.jsx'
import POS from './pages/POS.jsx'
import Admin from './pages/Admin.jsx'
import Reports from './pages/Reports.jsx'
import PrintPreview from './pages/PrintPreview.jsx'
import TableMap from './pages/TableMap.jsx'
import useAuth from './store/useAuth.js'
import { useTheme } from './store/useTheme.js'
import { LayoutGrid, ReceiptText, Settings2, LogIn, Moon, Sun } from 'lucide-react'

function TopBar(){
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const loc = useLocation()
  if (loc.pathname.startsWith('/print')) return null

  const linkBase = "flex items-center gap-2 px-4 py-2 rounded-xl touch-btn transition"
  const linkIdle = "text-neutral-900 hover:bg-neutral-100 border border-transparent dark:text-neutral-200 dark:hover:bg-neutral-800"
  const linkActive = "bg-neutral-100 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700"

  const NavItem = ({to, icon:Icon, children}) => (
    <NavLink to={to} className={({isActive})=>`${linkBase} ${isActive? linkActive: linkIdle}`}>
      <Icon size={20}/><span className="text-[15px] font-medium">{children}</span>
    </NavLink>
  )

  return (
    <div className="no-print sticky top-0 z-40 bg-white/70 dark:bg-neutral-950/80 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-3 flex items-center gap-3">
        <div className="font-bold text-xl tracking-wide">Caffe Club M POS</div>
        <nav className="flex gap-2 overflow-auto no-scrollbar">
          <NavItem to="/" icon={LayoutGrid}>Stolovi</NavItem>
          <NavItem to="/pos" icon={ReceiptText}>Brzo kucanje</NavItem>
          <NavItem to="/admin" icon={Settings2}>Admin</NavItem>
          <NavItem to="/reports" icon={ReceiptText}>Presek</NavItem>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggle}
            className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 touch-btn transition"
            title="Tema"
          >
            {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
          {user ? (
            <>
              <span className="opacity-80 hidden sm:block text-sm">Prijavljen: <b>{user.username}</b></span>
              <button
                onClick={logout}
                className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 touch-btn text-sm transition"
              >
                Odjava
              </button>
            </>
          ) : (
            <NavLink className={`${linkBase} ${linkIdle}`} to="/login"><LogIn size={18}/>Prijava</NavLink>
          )}
        </div>
      </div>
    </div>
  )
}

export function BackBar({ to='/', label='Nazad na stolove' }){
  const nav = useNavigate()
  return (
    <div className="no-print mb-3">
      <button
        onClick={()=>nav(to)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:border-neutral-800 touch-btn transition"
      >
        <span className="text-lg">←</span><span className="font-medium">{label}</span>
      </button>
    </div>
  )
}

export default function App(){
  const { theme } = useTheme()

  useEffect(()=>{
    const root = document.documentElement
    root.classList.remove('light','dark')
    root.classList.add(theme)
    // promeni ikoncu na boot-u ako još postoji
    const bootLogo = document.getElementById('boot-logo')
    if (bootLogo) bootLogo.src = theme === 'light' ? '/logo-light.png' : '/logo-dark.png'
  }, [theme])

  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 transition-colors">
      <TopBar/>
      <Routes>
        <Route path="/" element={<TableMap/>}/>
        <Route path="/login" element={<Login/>}/>
        <Route path="/pos" element={<POS/>}/>
        <Route path="/admin" element={<Admin/>}/>
        <Route path="/reports" element={<Reports/>}/>
        <Route path="/print/:type/:id" element={<PrintPreview/>} />
      </Routes>
    </div>
  )
}
