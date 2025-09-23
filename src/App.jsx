import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import POS from './pages/POS.jsx'
import Admin from './pages/Admin.jsx'
import Reports from './pages/Reports.jsx'
import PrintPreview from './pages/PrintPreview.jsx'
import TableMap from './pages/TableMap.jsx'
import useAuth from './store/useAuth.js'
import { useTheme } from './store/useTheme.js'
import { LayoutGrid, ReceiptText, Settings2, LogIn, Moon, Sun, HelpCircle } from 'lucide-react'

/* ====== DESNI SIDEBAR ====== */
function SideBar(){
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const loc = useLocation()
  const [showHelp, setShowHelp] = useState(false)
  if (loc.pathname.startsWith('/print')) return null

  const linkBase = "flex items-center gap-3 px-3 py-2 rounded-xl touch-btn transition"
  const linkIdle = "text-neutral-900 hover:bg-neutral-100 border border-transparent dark:text-neutral-200 dark:hover:bg-neutral-800"
  const linkActive = "bg-neutral-100 border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700"

  const NavItem = ({to, icon:Icon, children}) => (
    <NavLink to={to} className={({isActive})=>`${linkBase} ${isActive? linkActive: linkIdle}`}>
      <Icon size={20}/><span className="font-medium">{children}</span>
    </NavLink>
  )

  return (
    <>
      <div
        className="no-print fixed top-0 right-0 h-screen w-60 bg-white/80 dark:bg-neutral-950/90 backdrop-blur border-l border-neutral-200 dark:border-neutral-800 flex flex-col"
      >
        {/* HEADER sa natpisom i logom */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center py-3">
          <div className="text-xs opacity-70 mb-1">Created By:</div>
          <img
            src={theme === 'light' ? '/logo-light.png' : '/logo-dark.png'}
            alt="Caffe Club M"
            className="h-36 w-full object-contain block"
            style={{ margin: 0, padding: 0 }}
          />
        </div>

        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          <NavItem to="/" icon={LayoutGrid}>Stolovi</NavItem>
          <NavItem to="/pos" icon={ReceiptText}>Brzo kucanje</NavItem>
          <NavItem to="/admin" icon={Settings2}>Admin</NavItem>
          <NavItem to="/reports" icon={ReceiptText}>Presek</NavItem>
        </nav>

        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col gap-2">
          <button
            onClick={toggle}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 touch-btn transition"
            title="Tema"
          >
            {theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}
            <span>Tema</span>
          </button>

          <button
            onClick={()=>setShowHelp(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 touch-btn transition"
            title="Pomoć"
          >
            <HelpCircle size={18}/>
            <span>Pomoć</span>
          </button>

          {user ? (
            <>
              <div className="opacity-80 text-sm text-center">Prijavljen: <b>{user.username}</b></div>
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

      {/* HELP MODAL (ostaje isto kao ranije) */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setShowHelp(false)} />
          <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl w-[min(720px,90vw)] max-h-[85vh] overflow-auto p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold flex items-center gap-2"><HelpCircle size={18}/> Pomoć</div>
              <button onClick={()=>setShowHelp(false)} className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">Zatvori</button>
            </div>
            <div className="space-y-3 text-sm leading-6">
              {/* ... opis kao pre ... */}
              <div><b>Stolovi (Mapa):</b> Kliknite na sto da otvorite POS za taj sto.</div>
              <div><b>Brzo kucanje:</b> Kucanje predračuna bez dodeljenog stola.</div>
              <div><b>Admin → Proizvodi/Kategorije:</b> Upravljanje artiklima i kategorijama.</div>
              <div><b>Admin → Raspored:</b> Podešavanje pozicija stolova na slici.</div>
              <div><b>Štampa:</b> Predračun ide u arhivu; brisanje ga uklanja i iz preseka.</div>
              <div><b>Presek:</b> Promet danas, zadnjih 7 dana i otvoreni stolovi.</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ====== BACK dugme ====== */
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

/* ====== ROOT APP ====== */
export default function App(){
  const { theme } = useTheme()
  useEffect(()=>{
    const root = document.documentElement
    root.classList.remove('light','dark')
    root.classList.add(theme)
    const bootLogo = document.getElementById('boot-logo')
    if (bootLogo) bootLogo.src = theme === 'light' ? '/logo-light.png' : '/logo-dark.png'
  }, [theme])

  return (
    <div className="min-h-screen flex">
      {/* MAIN CONTENT */}
      <div className="flex-1 pr-60"> {/* usklađeno sa užim sidebar-om */}
        <Routes>
          <Route path="/" element={<TableMap/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/pos" element={<POS/>}/>
          <Route path="/admin" element={<Admin/>}/>
          <Route path="/reports" element={<Reports/>}/>
          <Route path="/print/:type/:id" element={<PrintPreview/>} />
        </Routes>
      </div>
      {/* SIDEBAR */}
      <SideBar/>
    </div>
  )
}
