import { useEffect, useMemo, useState } from 'react'
import { db } from '../store/db.js'
import { Card, Button } from '../components/UI.jsx'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/* === PRINT TEMPLATES (80mm) za izveštaje === */
function buildPrintCSS(){
  return `
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color: #000; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .receipt { width: 72mm; margin: 0 auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace; font-size: 12px; line-height: 1.25; padding: 6px 4px; }
      .center { text-align: center; }
      .row { display:flex; justify-content:space-between; gap:8px; }
      .hr { border-top:1px dashed #000; margin:6px 0; }
      .small { font-size: 11px; }
      .muted { opacity:.9 }
      .bold { font-weight:700 }
      .mt2 { margin-top:6px } .mb2 { margin-bottom:6px }
    </style>
  `
}
function openPrint(html){
  const w = window.open('', 'PRINT', 'width=420,height=600')
  w.document.write(html)
  w.document.close()
  w.focus()
}

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
    const css = buildPrintCSS()
    const html = `
      <!doctype html><html><head><meta charset="utf-8">${css}</head>
      <body><div class="receipt">
        <div class="center bold">PRESEK ZA DAN</div>
        <div class="center small muted">${d.day}</div>
        <div class="hr"></div>
        <div class="row"><div>Ukupno artikala</div><div class="bold">${d.count}</div></div>
        <div class="row"><div>Ukupan promet</div><div class="bold">${d.total.toFixed(2)} RSD</div></div>
        <div class="hr"></div>
        <div class="center small">Hvala!</div>
      </div>
      <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close(); }, 50) };</script>
      </body></html>
    `
    openPrint(html)
  }

  function printWeek(){
    const css = buildPrintCSS()
    const rows = last7.map(d=>`<div class="row"><div>${d.day}</div><div>${d.total.toFixed(2)} RSD</div></div>`).join('')
    const html = `
      <!doctype html><html><head><meta charset="utf-8">${css}</head>
      <body><div class="receipt">
        <div class="center bold">PRESEK POSLEDNJIH 7 DANA</div>
        <div class="hr"></div>
        ${rows || '<div class="small muted">Nema podataka.</div>'}
        <div class="hr"></div>
        <div class="row"><div class="bold">Ukupno 7 dana</div><div class="bold">${sumLast7.toFixed(2)} RSD</div></div>
      </div>
      <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close(); }, 50) };</script>
      </body></html>
    `
    openPrint(html)
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
