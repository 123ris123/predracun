import { useState, useRef, useEffect } from 'react'
import useAuth from '../store/useAuth.js'
import { Card, Button, Input, Label } from '../components/UI.jsx'

export default function Login(){
  const { user, login } = useAuth()

  // Uvek admin kao korisničko ime, lozinka prazna dok je ti ne uneseš
  const [u, setU] = useState('admin')
  const [p, setP] = useState('')               // <-- prazno polje
  const [msg, setMsg] = useState('')
  const passRef = useRef(null)

  // Anti-autofill: fokusiraj lozinku posle mount-a da isključi autofill na nekim browserima
  useEffect(()=>{
    // mali timeout da pregazi eventualni autofill
    setTimeout(()=>{
      if (passRef.current) {
        // reset vrednosti i selekcije
        passRef.current.value = ''
        passRef.current.setAttribute('autocomplete', 'new-password')
      }
    }, 0)
  }, [])

  function onSubmit(e){
    e.preventDefault()
    const res = login(u, p)
    if (!res.ok) setMsg(res.error || 'Prijava neuspešna')
  }

  if (user){
    return (
      <div className="max-w-md mx-auto p-4">
        <Card>
          <div className="text-lg font-semibold mb-2">Već ste prijavljeni</div>
          <div className="opacity-80">Idite na Admin ili POS.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <Card>
        <div className="text-xl font-semibold mb-4">Prijava</div>
        <form onSubmit={onSubmit} className="space-y-3" autoComplete="off">
          <div>
            <Label>Korisničko ime</Label>
            <Input
              value={u}
              onChange={e=>setU(e.target.value)}
              autoComplete="username"
              // držimo 'admin' ali dozvoljavamo da se ispravi ako baš želiš
              inputMode="text"
            />
          </div>
          <div>
            <Label>Lozinka</Label>
            <Input
              ref={passRef}
              type="password"
              value={p}
              onChange={e=>setP(e.target.value)}
              // Anti-autofill trikovi
              autoComplete="new-password"
              name="password_new"
              placeholder="Unesite lozinku"
            />
          </div>
          {msg && <div className="text-red-400 text-sm">{msg}</div>}
          <Button type="submit" className="w-full">Prijavi se</Button>
        </form>
      </Card>
    </div>
  )
}
