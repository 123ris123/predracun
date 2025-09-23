import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

// Ukloni boot loader kad React proradi
const boot = document.getElementById('boot')
if (boot) {
  setTimeout(()=> boot.style.opacity = '0', 150)
  setTimeout(()=> boot.remove(), 350)
}

// PWA – registruj SW samo u produkciji
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.log('SW reg error', err))
  })
}
