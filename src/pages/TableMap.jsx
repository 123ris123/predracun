import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, seedIfEmpty } from '../store/db.js'
import { Card } from '../components/UI.jsx'
import { Link } from 'react-router-dom'
import { Coffee } from 'lucide-react'

const GRID_W = 12
const GRID_H = 7
const CELL_GAP = 8 // px
const PAD = 12 // unutrašnja margina kontejnera

export default function TableMap(){
  const [tables, setTables] = useState([])
  const [ordersOpen, setOrdersOpen] = useState([]) // SAMO open
  const [items, setItems] = useState([])

  const reload = useCallback(async ()=>{
    await seedIfEmpty()
    const [t, oo, it] = await Promise.all([
      db.table('posTables').toArray(),
      db.table('orders').where('status').equals('open').toArray(),
      db.table('orderItems').toArray(),
    ])
    setTables(t)
    setOrdersOpen(oo)
    setItems(it)
  },[])

  useEffect(()=>{
    reload()
    const onFocus = ()=>reload()
    const onVis = ()=>{ if (document.visibilityState === 'visible') reload() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return ()=>{
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  },[reload])

  // zauzet = postoji OPEN order za sto i taj order ima ≥1 stavku
  const occupied = useMemo(()=>{
    const qtyByOrder = items.reduce((m,i)=> (m[i.orderId]=(m[i.orderId]||0)+i.qty, m), {})
    const busy = new Set()
    for (const o of ordersOpen){
      if ((qtyByOrder[o.id]||0) > 0) busy.add(o.tableId)
    }
    return busy
  }, [ordersOpen, items])

  return (
    <div className="max-w-7xl mx-auto p-4 grid gap-4">
      <Card>
        <div className="text-lg font-semibold mb-3">Mapa lokala</div>

        {/* ČISTA pozadina (bez mesh) + “floor” ploča */}
        <div
          className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.06))',
            padding: PAD,
          }}
        >
          {/* Wrapper koji računa apsolutne pozicije */}
          <div
            className="relative"
            style={{ width: '100%', height: `calc(56px * ${GRID_H})` }}
          >
            {/* Stočići pozicionirani iz (x,y) na vizuelnu mrežu — bez crtanja mreže */}
            {tables.map(t=>{
              // prosek širine kolone: wrapperWidth / GRID_W — ovde koristimo CSS calc kroz inline stil
              // relativno pozicioniranje kroz CSS varijable
              const left = `calc( (100% - ${(GRID_W-1)*CELL_GAP}px) * ${ (t.x??0) / GRID_W } + ${(t.x??0)*CELL_GAP}px )`
              const top  = `calc( (100% - ${(GRID_H-1)*CELL_GAP}px) * ${ (t.y??0) / GRID_H } + ${(t.y??0)*CELL_GAP}px )`
              const isBusy = occupied.has(t.id)

              return (
                <Link
                  key={t.id}
                  to={`/pos?table=${t.id}`}
                  className={`absolute inline-flex items-center justify-center touch-btn transition
                    rounded-2xl shadow-sm border text-sm font-semibold select-none
                    ${isBusy
                      ? 'border-red-400/70 bg-red-500/10 hover:border-red-400'
                      : 'border-neutral-200 bg-white/90 hover:border-brand dark:border-neutral-700 dark:bg-neutral-900/80'}
                  `}
                  style={{
                    left, top,
                    width: 64, height: 64 // kvadratni sto (duplo manji i jasniji)
                  }}
                  title={t.name}
                >
                  <Coffee size={16} className="opacity-70 mr-1"/>{t.name}
                  {isBusy && (
                    <span
                      className="absolute -top-1.5 -right-1.5 inline-block w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-neutral-900"
                      title="Zauzet"
                    />
                  )}
                </Link>
              )
            })}

            {/* Legenda u uglu */}
            <div className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1 align-middle"></span>
              Zauzet sto
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
