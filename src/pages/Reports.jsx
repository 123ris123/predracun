import { useEffect, useMemo, useState } from 'react'
import { db } from '../store/db.js'
import { Card, Button } from '../components/UI.jsx'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function groupByDay(rows){
  const map = new Map()
  for (const r of rows){
    const key = r.day
    const prev = map.get(key) || { day: key, total: 0, count: 0 }
    prev.total += r.qty * r.priceEach
    prev.count += r.qty
    map.set(key, prev)
  }
  return Array.from(map.values()).sort((a,b)=>a.day.localeCompare(b.day))
}

export default function Reports(){
  const [sales, setSales] = useState([])
  const [openTotals, setOpenTotals] = useState({ total:0, count:0, byTable:[] })

  useEffect(()=>{
    reload()
  },[])

  async function reload(){
    // sales = arhiva svih štampanih predračuna (stavke)
    const s = await db.table('sales').toArray()
    setSales(s)

    // trenutno otkucano = sumiraj OPEN orders + njihove stavke
    const ordersOpen = await db.table('orders').where('status').equals('open').toArray()
    const items = await db.table('orderItems').toArray()
    const byOrder = new Map()
    for (const it of items){
      const arr = byOrder.get(it.orderId) || []
      arr.push(it)
      byOrder.set(it.orderId, arr)
    }
    const byTable = []
    let total = 0, count = 0
    for (const o of ordersOpen){
      const its = byOrder.get(o.id) || []
      const t = its.reduce((s,x)=>s + x.qty * (x.priceEach||0), 0)
      const c = its.reduce((s,x)=>s + x.qty, 0)
      if (c > 0){
        byTable.push({ tableId: o.tableId, total: t, count: c })
        total += t; count += c
      }
    }
    setOpenTotals({ total, count, byTable })
  }

  const byDay = useMemo(()=> groupByDay(sales), [sales])
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const today = byDay.find(d=>d.day===todayStr)
  const last7 = byDay.slice(-7)
  const sumLast7 = last7.reduce((s,d)=>s+d.total,0)

  function printDay(d){
    const w = window.open('', 'PRINT', 'height=600,width=400')
    w.document.write(`<pre class="receipt" style="font-family:monospace">`)
    w.document.write(`*** PRESEK ZA DAN ${d.day} ***\n`)
    w.document.write(`Ukupno artikala: ${d.count}\n`)
    w.document.write(`Ukupan promet:   ${d.total.toFixed(2)} RSD\n`)
    w.document.write(`----------------------------\n`)
    w.document.write(`Hvala!\n`)
    w.document.write(`</pre>`)
    w.print(); w.close()
  }

  function printWeek(){
    const w = window.open('', 'PRINT', 'height=600,width=400')
    w.document.write(`<pre class="receipt" style="font-family:monospace">`)
    w.document.write(`*** PRESEK POSLEDNJIH 7 DANA ***\n`)
    last7.forEach(d=>{
      w.document.write(`${d.day} -> ${d.total.toFixed(2)} RSD (${d.count} art)\n`)
    })
    w.document.write(`----------------------------\n`)
    w.document.write(`Ukupno 7 dana: ${sumLast7.toFixed(2)} RSD\n`)
    w.document.write(`</pre>`)
    w.print(); w.close()
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Card>
        <div className="text-lg font-semibold mb-3">Danas (odštampani predračuni)</div>
        {today ? (
          <div className="flex items-center justify-between">
            <div>{today.day}</div>
            <div className="text-xl font-bold">{today.total.toFixed(2)} RSD</div>
            <Button onClick={()=>printDay(today)}>Štampaj</Button>
          </div>
        ) : (
          <div className="opacity-70">Nema podataka za danas.</div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Poslednjih 7 dana</div>
          {last7.length>0 && <Button onClick={printWeek}>Štampaj 7 dana</Button>}
        </div>
        {last7.length>0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={last7}>
              <XAxis dataKey="day"/>
              <YAxis/>
              <Tooltip/>
              <Bar dataKey="total" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="opacity-70">Nema podataka.</div>
        )}
      </Card>

      <Card>
        <div className="text-lg font-semibold mb-3">Trenutno otkucano (otvoreni stolovi)</div>
        {openTotals.count>0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>Ukupno</div>
              <div className="text-xl font-bold">{openTotals.total.toFixed(2)} RSD ({openTotals.count} art)</div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {openTotals.byTable.map((t,idx)=>(
                <div key={idx} className="border rounded-xl px-3 py-2 flex items-center justify-between">
                  <div>Sto #{t.tableId}</div>
                  <div>{t.total.toFixed(2)} RSD ({t.count})</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="opacity-70">Trenutno nema otkucanih stavki na stolovima.</div>
        )}
      </Card>

      <Card>
        <div className="text-lg font-semibold mb-3">Svi dani (odštampani predračuni)</div>
        <div className="space-y-1">
          {byDay.map(d=>(
            <div key={d.day} className="flex items-center justify-between border-b py-1">
              <div>{d.day}</div>
              <div>{d.total.toFixed(2)} RSD ({d.count} art)</div>
              <Button size="sm" onClick={()=>printDay(d)}>Štampa</Button>
            </div>
          ))}
          {byDay.length===0 && <div className="opacity-70">Nema podataka.</div>}
        </div>
      </Card>
    </div>
  )
}
