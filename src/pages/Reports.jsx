// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from 'react'
import { db } from '../store/db.js'
import { Card, Button } from '../components/UI.jsx'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/* ====================== POMOĆNE – RADNI DAN (granica 15:00) ====================== */
/** yyyy-MM-dd iz Date (lokalno) */
function ymd(d){
  const y = d.getFullYear()
  const m = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
/** Granica radnog dana: 15:00.
 * - 00:00–14:59 -> PRETHODNI kalendarski dan
 * - 15:00–23:59 -> TEKUĆI kalendarski dan
 */
function businessDayKey(dateLike){
  const d = (dateLike instanceof Date) ? dateLike : new Date(dateLike)
  if (isNaN(d.getTime())) return null
  const h = d.getHours()
  if (h < 15){
    const prev = new Date(d)
    prev.setDate(prev.getDate()-1)
    return ymd(prev)
  }
  return ymd(d)
}
/** Ljudski label opsega za dati “business day”: [dan 15:00] – [sutradan 14:59] */
function businessDayRangeLabel(dayKey){
  const [Y, M, D] = dayKey.split('-').map(Number)
  const start = new Date(Y, M-1, D, 15, 0, 0)
  const end = new Date(start); end.setDate(end.getDate()+1); end.setHours(14,59,59,999)
  return `${format(start, 'yyyy-MM-dd HH:mm')} – ${format(end, 'yyyy-MM-dd HH:mm')}`
}

/* ====================== PRINT CSS ====================== */
function buildPrintCSS(){
  const SHIFT_MM = 2; // blagi nudge ulevo da se centrira na većini termalnih
  return `
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color: #000; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .receipt {
        width: 72mm; margin-left:auto; margin-right:auto; padding: 8px 6px 10mm 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
        font-size: 12.5px; line-height: 1.28;
        transform: translateX(-${SHIFT_MM}mm);
      }
      .center { text-align:center }
      .row { display:flex; justify-content:space-between; gap:8px }
      .hr { border-top:1px dashed #000; margin:8px 0 }
      .small { font-size:11.5px }
      .bold { font-weight:700 }
      .mono { font-variant-numeric: tabular-nums; }
      .name { flex:1; padding-right:6px }
      .unit { min-width: 64px; text-align:right }
      .amt  { min-width: 64px; text-align:right }
    </style>
  `
}
function openPrint(html){
  const w = window.open('', 'PRINT', 'width=420,height=600')
  w.document.write(html)
  w.document.close()
  w.focus()
}
function formatDateTime(d=new Date()){ return d.toLocaleString('sr-RS') }

/* ====================== GRUPISANJE ====================== */
/** Grupisanje po radnom danu – koristi _ts (timestamp) ako postoji, inače “day”. */
function groupByBusinessDay(rows){
  const map = new Map()
  for (const r of rows){
    const t = r._ts ?? r.createdAt ?? r.timestamp ?? r.time ?? null
    const key = t ? businessDayKey(t) : (r.day ?? null)
    if (!key) continue
    const prev = map.get(key) || { day: key, total: 0, count: 0 }
    prev.total += (r.qty || 0) * (r.priceEach || 0)
    prev.count += (r.qty || 0)
    map.set(key, prev)
  }
  return Array.from(map.values()).sort((a,b)=> a.day.localeCompare(b.day))
}
function groupItems(rows){
  const m = new Map()
  for (const r of rows){
    const name = r.name || r.productName || `Artikal${r.productId ? ' #' + r.productId : ''}`
    const prev = m.get(name) || { name, qty: 0, amt: 0 }
    prev.qty += (r.qty || 0)
    prev.amt += (r.qty || 0) * (r.priceEach || 0)
    m.set(name, prev)
  }
  return Array.from(m.values()).sort((a,b)=> b.qty - a.qty || b.amt - a.amt)
}
function renderGroupedRows(grouped){
  return grouped.map(it => {
    const avg = it.qty ? (it.amt / it.qty) : 0
    return `
      <div class="row mono">
        <div class="name">${it.name}</div>
        <div class="unit">${it.qty}× ${avg.toFixed(2)}</div>
        <div class="amt">${it.amt.toFixed(2)} RSD</div>
      </div>
    `
  }).join('')
}

/* ====================== KOMPONENTA ====================== */
export default function Reports(){
  const [sales, setSales] = useState([])
  const [openTotals, setOpenTotals] = useState({ total:0, count:0, byTable:[] })

  useEffect(()=>{ reload() },[])

  async function reload(){
    // Sve odštampane stavke
    const s = await db.table('sales').toArray()

    // Upari sa archivedOrders da bismo imali SIGURAN timestamp (vreme štampe) kad ga nema u sales
    let ordersById = new Map()
    try {
      const archivedOrders = await db.table('archivedOrders').toArray()
      ordersById = new Map(archivedOrders.map(o => [o.id, o]))
    } catch (e) {
      // ako nema tabele (starija šema), samo preskoči
    }

    // Obogati svaki sales red sa _ts
    const sEnriched = s.map(row => {
      const ts =
        row.createdAt ||
        row.timestamp ||
        row.time ||
        (row.orderId != null ? ordersById.get(row.orderId)?.createdAt : null) ||
        null
      return { ...row, _ts: ts }
    })
    setSales(sEnriched)

    // Trenutno otkucano po stolovima (ne menja se logika)
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

  // Grupisanje po "radnom danu" (granica 15:00)
  const byDay = useMemo(()=> groupByBusinessDay(sales), [sales])

  // Današnji radni dan (po granici 15:00)
  const todayBizKey = businessDayKey(new Date())
  const today = byDay.find(d=>d.day===todayBizKey)

  // Poslednjih 7 radnih dana
  const last7 = byDay.slice(-7)
  const sumLast7 = last7.reduce((s,d)=>s+d.total,0)

  function printDay(d){
    // Stavke za taj radni dan
    const itemsOfDay = sales.filter(s => {
      const t = s._ts ?? s.createdAt ?? s.timestamp ?? s.time ?? null
      const key = t ? businessDayKey(t) : (s.day ?? null)
      return key === d.day
    })
    const grouped = groupItems(itemsOfDay)
    const css = buildPrintCSS()
    const rows = renderGroupedRows(grouped)
    const rangeLabel = businessDayRangeLabel(d.day)

    const html = `
      <!doctype html><html><head><meta charset="utf-8">${css}</head>
      <body><div class="receipt">
        <div class="center bold">PRESEK ZA RADNI DAN</div>
        <div class="center small">${rangeLabel}</div>
        <div class="hr"></div>
        <div class="row mono"><div>Ukupan promet</div><div class="bold">${d.total.toFixed(2)} RSD</div></div>
        <div class="row mono"><div>Ukupno artikala</div><div class="bold">${d.count}</div></div>
        <div class="hr"></div>
        <div class="center small bold">ARTIKLI</div>
        <div class="row small mono" style="opacity:.9"><div class="name">Artikal</div><div class="unit">Kol × Cena</div><div class="amt">Ukupno</div></div>
        ${rows || '<div class="small" style="opacity:.8">Nema podataka o artiklima.</div>'}
        <div class="hr"></div>
        <div class="center small mono">--------------</div>
        <div class="center small mono">Štampano: ${formatDateTime(new Date())}</div>
      </div>
      <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close(); }, 80) };</script>
      </body></html>
    `
    openPrint(html)
  }

  function printWeek(){
    const daySet = new Set(last7.map(d => d.day))
    const itemsOfWeek = sales.filter(s => {
      const t = s._ts ?? s.createdAt ?? s.timestamp ?? s.time ?? null
      const key = t ? businessDayKey(t) : (s.day ?? null)
      return daySet.has(key)
    })
    const grouped = groupItems(itemsOfWeek)
    const css = buildPrintCSS()
    const rowsDays = last7.map(d=>`<div class="row mono"><div>${d.day}</div><div>${d.total.toFixed(2)} RSD</div></div>`).join('')
    const rowsItems = renderGroupedRows(grouped)
    const html = `
      <!doctype html><html><head><meta charset="utf-8">${css}</head>
      <body><div class="receipt">
        <div class="center bold">PRESEK POSLEDNJIH 7 RADNIH DANA</div>
        <div class="hr"></div>
        ${rowsDays || '<div class="small" style="opacity:.8">Nema podataka.</div>'}
        <div class="hr"></div>
        <div class="row mono"><div class="bold">Ukupno 7 dana</div><div class="bold">${sumLast7.toFixed(2)} RSD</div></div>
        <div class="hr"></div>
        <div class="center small bold">ARTIKLI (UKUPNO)</div>
        <div class="row small mono" style="opacity:.9"><div class="name">Artikal</div><div class="unit">Kol × Cena</div><div class="amt">Ukupno</div></div>
        ${rowsItems || '<div class="small" style="opacity:.8">Nema podataka o artiklima.</div>'}
        <div class="hr"></div>
        <div class="center small mono">--------------</div>
        <div class="center small mono">Štampano: ${formatDateTime(new Date())}</div>
      </div>
      <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close(); }, 80) };</script>
      </body></html>
    `
    openPrint(html)
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Card>
        <div className="text-lg font-semibold mb-3">Danas (odštampani predračuni — radni dan)</div>
        {today ? (
          <div className="flex items-center justify-between">
            <div>{today.day}</div>
            <div className="text-xl font-bold">{today.total.toFixed(2)} RSD</div>
            <Button onClick={()=>printDay(today)}>Štampaj</Button>
          </div>
        ) : (
          <div className="opacity-70">Nema podataka za današnji radni dan.</div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Poslednjih 7 radnih dana</div>
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
        <div className="text-lg font-semibold mb-3">Svi radni dani</div>
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
