import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, seedIfEmpty } from '../store/db.js'
import { Link } from 'react-router-dom'
import { Coffee } from 'lucide-react'

/** veličina stola (~+20% od 38) */
const TABLE_SIZE = 46

/** helper: fallback xpct/ypct ako još imamo stari grid x,y */
function getPercentFromLegacy(t){
  if (typeof t.xpct === 'number' && typeof t.ypct === 'number') {
    return { xpct: t.xpct, ypct: t.ypct }
  }
  if (typeof t.x === 'number' && typeof t.y === 'number'){
    const GRID_W = 24, GRID_H = 14
    return {
      xpct: Math.min(1, Math.max(0, (t.x + 0.5)/GRID_W)),
      ypct: Math.min(1, Math.max(0, (t.y + 0.5)/GRID_H))
    }
  }
  return { xpct: 0.1, ypct: 0.1 }
}

export default function TableMap(){
  const [tables, setTables] = useState([])
  const [ordersOpen, setOrdersOpen] = useState([])
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

  // zauzet = postoji OPEN order sa ≥1 stavkom
  const occupied = useMemo(()=>{
    const qtyByOrder = items.reduce((m,i)=> (m[i.orderId]=(m[i.orderId]||0)+i.qty, m), {})
    const busy = new Set()
    for (const o of ordersOpen){ if ((qtyByOrder[o.id]||0) > 0) busy.add(o.tableId) }
    return busy
  }, [ordersOpen, items])

  return (
    <div className="fullscreen-map">{/* ostavi prostor za desni sidebar u glavnom layoutu (App pr-56) */}
      {/* POZADINA – GIF “skroz levo” i identično Admin/Layout-u */}
      <div className="tables-area">
        <img className="tables-img" src="/tables-bg.gif" alt="Mapa lokala" />
        <div className="tables-area-overlay" />
      </div>

      {/* STAGE */}
      <div className="tables-stage">
        <div className="relative w-full h-full">
          {tables.map(t=>{
            const { xpct, ypct } = getPercentFromLegacy(t)
            const isBusy = occupied.has(t.id)

            const statusClasses = isBusy
              ? 'bg-red-600/85 border-red-700 text-white hover:bg-red-600'
              : 'bg-green-600/85 border-green-700 text-white hover:bg-green-600'

            return (
              <Link
                key={t.id}
                to={`/pos?table=${t.id}`}
                className={`absolute inline-flex items-center justify-center touch-btn transition
                  rounded-[3px] shadow-sm border text-[11px] font-semibold select-none backdrop-blur-[2px]
                  ${statusClasses}
                `}
                style={{
                  left: `calc(${(xpct*100).toFixed(3)}% - ${TABLE_SIZE/2}px)`,
                  top:  `calc(${(ypct*100).toFixed(3)}% - ${TABLE_SIZE/2}px)`,
                  width: TABLE_SIZE,
                  height: TABLE_SIZE
                }}
                title={t.name}
              >
                <Coffee size={14} className="opacity-85 mr-1"/>{t.name}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
