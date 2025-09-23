import { useState } from 'react'
import useAuth from '../store/useAuth.js'
import { Card, Button, Input, Label } from '../components/UI.jsx'

export default function Login(){
  const { user, login } = useAuth()
  const [u, setU] = useState('admin')
  const [p, setP] = useState('robertobadjo')
  const [msg, setMsg] = useState('')

  function onSubmit(e){
    e.preventDefault()
    const res = login(u, p)
    if (!res.ok) setMsg(res.error)
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
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label>Korisničko ime</Label>
            <Input value={u} onChange={e=>setU(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Lozinka</Label>
            <Input type="password" value={p} onChange={e=>setP(e.target.value)} />
          </div>
          {msg && <div className="text-red-400 text-sm">{msg}</div>}
          <Button type="submit" className="w-full">Prijavi se</Button>
        </form>
      </Card>
    </div>
  )
}
