// src/store/useAuth.js
import { useEffect, useState, useCallback } from 'react'

// Kredencijali (lokalni, bez servera)
const USERNAME = 'admin'
const PASSWORD = '100100'
const LS_KEY = 'ccm_pos_user'

// ---- Globalno stanje i pretplatnici (shared između svih komponenti) ----
let currentUser = null
const listeners = new Set()

function notify() {
  for (const cb of listeners) cb(currentUser)
}

function setCurrentUser(next) {
  currentUser = next
  try {
    if (next) localStorage.setItem(LS_KEY, JSON.stringify(next))
    else localStorage.removeItem(LS_KEY)
  } catch {}
  notify()
}

// Pokušaj da inicijalno učita iz localStorage (samo jednom po modulu)
;(function bootFromStorage(){
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.username) currentUser = parsed
    }
  } catch {}
})()

export default function useAuth(){
  const [user, setUser] = useState(currentUser)

  useEffect(()=>{
    // Pretplata na promene globalnog auth stanja
    const cb = (u)=> setUser(u)
    listeners.add(cb)
    // Sync sa localStorage ako je neko drugi već ulogovao pre mount-a
    setUser(currentUser)

    return ()=> {
      listeners.delete(cb)
    }
  }, [])

  const login = useCallback((username, password)=>{
    if (username !== USERNAME){
      return { ok:false, error:'Nepostojeći korisnik' }
    }
    if (password !== PASSWORD){
      return { ok:false, error:'Pogrešna lozinka' }
    }
    const u = { username: USERNAME, loggedInAt: Date.now() }
    setCurrentUser(u) // obaveštava sve pretplatnike (SideBar, itd.)
    return { ok:true }
  },[])

  const logout = useCallback(()=>{
    setCurrentUser(null) // obaveštava sve pretplatnike
  },[])

  return { user, login, logout }
}
