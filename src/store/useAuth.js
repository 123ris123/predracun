import { create } from 'zustand'

const ADMIN = { username: 'admin', password: 'robertobadjo' }

const useAuth = create((set) => ({
  user: (()=> {
    const s = localStorage.getItem('auth_user')
    return s ? JSON.parse(s) : null
  })(),
  login: (username, password) => {
    if (username === ADMIN.username && password === ADMIN.password){
      localStorage.setItem('auth_user', JSON.stringify({ username }))
      set({ user: { username } })
      return { ok: true }
    }
    return { ok: false, error: 'Pogrešni kredencijali' }
  },
  logout: () => {
    localStorage.removeItem('auth_user')
    set({ user: null })
  }
}))

export default useAuth
