import { create } from 'zustand'

const initial = (() => localStorage.getItem('theme') || 'dark')()

export const useTheme = create((set, get) => ({
  theme: initial,
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    set({ theme: next })
  },
  setTheme: (t) => {
    localStorage.setItem('theme', t)
    set({ theme: t })
  }
}))
