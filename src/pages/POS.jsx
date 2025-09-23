import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { db, seedIfEmpty, ensureCategoryIcons, archiveOrder } from '../store/db.js'
import { Card, Button } from '../components/UI.jsx'
import { BackBar } from '../App.jsx'
import * as Icons from 'lucide-react'
import { Grid2X2, Star, Printer } from 'lucide-react'

const TAB_ALL = -1
const TAB_TOP = -2

function getIconByName(name){
  return Icons[name] || Icons.Utensils
}

/* === PRINT TEMPLATES (80mm) — profi izgled, bez QR, sa logoom === */
function buildPrintCSS(){
  return `
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color: #000; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .receipt {
        width: 72mm; margin: 0 auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
        font-size: 12px; line-height: 1.25; padding: 8px 4px 12mm; /* malo duža traka */
        position: relative;
        background-image: url('/racun_logo.png');
        background-repeat: no-repeat;
        background-position: center 85%;
        background-size: 36mm auto;
        opacity: 0.999; /* hack za neke drajvere */
      }
      .center { text-align: center; }
      .left { text-align: left; }
      .row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
      .hr { border-top:1px dashed #000; margin:7px 0; }
      .divider { text-align:center; letter-spacing:1px; margin:6px 0; }
      .muted { opacity:.9 }
      .small { font-size: 11px; }
      .bold { font-weight: 700; }
      .mono { font-variant-numeric: tabular-nums; }
      .qty { min-width: 22px; text-align:right; }
      .name { flex:1; padding-right:6px; word-break: break-word; }
      .unit { min-width: 62px; text-align:right; }
      .sum { min-width: 62px; text-align:right; }
      .logo-top { display:block; margin:0 auto 2px auto; width: 34mm; height:auto; }
      .watermark-note { text-align:center; font-size:10px; opacity:.9; margin-top:6px }
      .foot-warn { margin-top: 8px; border-top:1px solid #000; padding-top:6px; text-align:center; font-weight:700; }
      .tail { height: 8mm; } /* kratki feed za cutter */
    </style>
  `
}

function formatDateTime(d=new Date()){
  return d.toLocaleString('sr-RS')
}

function buildReceiptHTML({ shop, meta, items=[], total=0, warning='OVO NIJE FISKALNI RAČUN' }){
  const css = buildPrintCSS()
  const header = `
    ${shop.logo ? `<img src="${shop.logo}" class="logo-top" alt="logo" />` : ''}
    <div class="center bold">${shop.name}</div>
    ${shop.place ? `<div class="center small">${shop.place}</div>` : ''}
    ${shop.paymentPlace ? `<div class="center small">Uplatno mesto: ${shop.paymentPlace}</div>` : ''}
  `
  const metaBlock = `
    <div class="divider small">*** ${meta.title} ***</div>
    <div class="row small mono"><div>Datum/čas</div><div>${meta.datetime}</div></div>
    ${meta.refLeft ? `<div class="row small mono"><div>Ref</div><div>${meta.refLeft}</div></div>` : ''}
  `
  const headCols = `
    <div class="row small muted mono">
      <div class="name left">Artikal</div>
      <div class="unit">Kol × Cena</div>
      <div class="sum">Iznos</div>
    </div>
  `
  const lines = items.map(it => {
    const unit = `${it.qty}× ${(it.priceEach || 0).toFixed(2)}`
    const sum = (it.qty * (it.priceEach||0)).toFixed(2)
    return `
      <div class="row mono">
        <div class="name">${it.name || 'Artikal'}</div>
        <div class="unit">${unit}</div>
        <div class="sum">${sum} RSD</div>
      </div>
    `
  }).join('')

  const extras = `
    <div class="hr"></div>
    <div class="row mono"><div>Stavki ukupno</div><div>${items.reduce((s,i)=>s+i.qty,0)}</div></div>
    <div class="row mono"><div>Način plaćanja</div><div>Gotovina</div></div>
    <div class="row mono"><div>Valuta</div><div>RSD</div></div>
    <div class="watermark-note">Hvala na poseti — CaffeClub M</div>
  `

  return `
    <!doctype html><html><head><meta charset="utf-8">${css}</head>
    <body>
      <div class="receipt">
        ${header}
        <div class="hr"></div>
        ${metaBlock}
        <div class="hr"></div>
        ${headCols}
        ${lines || '<div class="small muted">— Nema stavki —</div>'}
        <div class="hr"></div>
        <div class="row bold mono"><div>UKUPNO</div><div>${total.toFixed(2)} RSD</div></div>
        ${extras}
        <div class="foot-warn small">${warning}</div>
        <div class="tail"></div>
      </div>
      <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close(); }, 80) };</script>
    </body></html>
  `
}

function openPrint(html){
  const w = window.open('', 'PRINT', 'width=420,height=600')
  w.document.write(html)
  w.document.close()
  w.focus()
}

export default function POS(){
  const [params] = useSearchParams()
  const nav = useNavigate()
  const tableId = parseInt(params.get('table') || '0')
  const quickMode = !tableId

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([])
  const [orderId, setOrderId] = useState(null)
  const [activeTab, setActiveTab] = useState(TAB_ALL)
  const [topIds, setTopIds] = useState([])

  useEffect(()=>{ (async ()=>{
    await seedIfEmpty()
    await ensureCategoryIcons()
    const cats = await db.table('categories').orderBy('sort').toArray()
    const prods = await db.table('products').toArray()
    setCategories(cats); setProducts(prods)

    const allItems = await db.table('orderItems').toArray()
    const countByProd = allItems.reduce((m, i) => (m[i.productId]=(m[i.productId]||0)+i.qty, m), {})
    const sorted = Object.entries(countByProd).sort((a,b)=>b[1]-a[1]).map(([id])=>parseInt(id))
    setTopIds(sorted.slice(0, 12))

    if (!quickMode){
      let o = await db.table('orders').where({ tableId, status: 'open' }).first()
      if (!o){
        const id = await db.table('orders').add({ tableId, status: 'open', createdAt: new Date().toISOString() })
        o = await db.table('orders').get(id)
      }
      setOrderId(o.id)
      const it = await db.table('orderItems').where('orderId').equals(o.id).toArray()
      setItems(it)
    } else {
      setOrderId(null)
      setItems([])
    }
  })() },[tableId])

  async function addItem(p){
    if (quickMode){
      setItems(prev=>{
        const e = prev.find(x=>x.productId===p.id)
        if (e) return prev.map(x=> x.productId===p.id ? {...x, qty: x.qty+1, priceEach: p.price} : x)
        return [...prev, { id: crypto.randomUUID(), productId: p.id, qty: 1, priceEach: p.price }]
      })
      return
    }
    const existing = await db.table('orderItems').where({ orderId, productId: p.id }).first()
    if (existing){
      await db.table('orderItems').update(existing.id, { qty: existing.qty + 1 })
    } else {
      await db.table('orderItems').add({ orderId, productId: p.id, qty: 1, priceEach: p.price })
    }
    const it = await db.table('orderItems').where('orderId').equals(orderId).toArray()
    setItems(it)
  }

  async function changeQty(item, delta){
    if (quickMode){
      setItems(prev=>{
        const q = item.qty + delta
        if (q <= 0) return prev.filter(x=>x.id!==item.id)
        return prev.map(x=> x.id===item.id ? {...x, qty:q} : x)
      })
      return
    }
    const q = item.qty + delta
    if (q <= 0){
      await db.table('orderItems').delete(item.id)
    } else {
      await db.table('orderItems').update(item.id, { qty: q })
    }
    const it = await db.table('orderItems').where('orderId').equals(orderId).toArray()
    setItems(it)
  }

  const total = useMemo(()=>items.reduce((s,i)=>s + i.qty * i.priceEach, 0), [items])

  const filteredProducts = useMemo(()=>{
    if (activeTab === TAB_ALL) return products
    if (activeTab === TAB_TOP) return products.filter(p => topIds.includes(p.id))
    return products.filter(p => p.categoryId === activeTab)
  }, [products, activeTab, topIds])

  async function printAndArchive(){
    let list = items
    let label = quickMode ? 'Brzo kucanje' : `Sto #${tableId}`

    if (!quickMode){
      list = await db.table('orderItems').where('orderId').equals(orderId).toArray()
    }

    const mapped = list.map(it=>{
      const p = products.find(x=>x.id===it.productId)
      return { name: p?.name ?? 'Artikal', qty: it.qty, priceEach: it.priceEach ?? p?.price ?? 0 }
    })
    const totalNow = mapped.reduce((s,i)=> s + i.qty*i.priceEach, 0)

    // arhiva
    if (items.length > 0){
      if (quickMode){
        const id = await db.table('orders').add({ tableId: null, status: 'open', createdAt: new Date().toISOString() })
        for (const it of items){
          await db.table('orderItems').add({ orderId: id, productId: it.productId, qty: it.qty, priceEach: it.priceEach })
        }
        await archiveOrder(id)
        setItems([])
      } else {
        await archiveOrder(orderId)
      }
    }

    // podaci o lokalu
    const shop = {
      name: 'Caffe Club M',
      place: '15310 Ribari',
      paymentPlace: 'CaffeClub M',
      logo: '/racun_logo.png' // <-- postavi ovaj fajl u public/
    }
    const meta = {
      title: 'PREDRAČUN',
      datetime: formatDateTime(new Date()),
      refLeft: label
    }

    const html = buildReceiptHTML({
      shop,
      meta,
      items: mapped,
      total: totalNow,
      warning: 'OVO NIJE FISKALNI RAČUN'
    })
    openPrint(html)

    if (!quickMode) nav('/')
  }

  function saveAndBack(){
    if (!quickMode) return nav('/')
    setItems([])
  }

  return (
    <div className="max-w-7xl mx-auto p-4 grid md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <BackBar to="/" label="Nazad na stolove" />
      </div>

      <Card className="order-2 md:order-1">
        <div className="text-lg font-semibold mb-3">
          {quickMode ? 'Brzo kucanje' : `Sto #${tableId}`}
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1 no-scrollbar">
          {items.map(i=> (
            <ItemRow key={i.id} item={i} onDec={()=>changeQty(i,-1)} onInc={()=>changeQty(i,1)} products={products} />
          ))}
          {items.length===0 && <div className="opacity-60">Nema stavki. Dodajte sa desne strane.</div>}
        </div>

        <div className="mt-4 border-t border-neutral-200/70 dark:border-neutral-800 pt-3 flex items-center justify-between">
          <div className="text-lg">Ukupno:</div>
          <div className="text-2xl font-bold">{total.toFixed(2)} RSD</div>
        </div>

        {quickMode ? (
          <div className="mt-3 grid grid-cols-1 gap-2">
            <Button onClick={printAndArchive} className="w-full touch-btn flex items-center justify-center gap-2">
              <Printer size={18}/> Štampaj predračun
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button onClick={printAndArchive} className="w-full touch-btn flex items-center justify-center gap-2">
              <Printer size={18}/> Štampaj predračun
            </Button>
            <Button onClick={saveAndBack} className="w-full bg-neutral-700 hover:bg-neutral-600 touch-btn">
              Sačuvaj / Nazad
            </Button>
          </div>
        )}
      </Card>

      <Card className="order-1 md:order-2">
        <div className="text-lg font-semibold mb-3">Artikli</div>

        <div className="flex flex-wrap gap-2 pb-2">
          <TabBtn active={activeTab===TAB_ALL} onClick={()=>setActiveTab(TAB_ALL)} icon={<Grid2X2 size={16}/>}>Sve</TabBtn>
          <TabBtn active={activeTab===TAB_TOP} onClick={()=>setActiveTab(TAB_TOP)} icon={<Star size={16}/>}>Najčešće</TabBtn>
          {categories.map(c=>{
            const Icon = getIconByName(c.icon)
            return (
              <TabBtn key={c.id} active={activeTab===c.id} onClick={()=>setActiveTab(c.id)} icon={<Icon size={16}/>}>
                {c.name}
              </TabBtn>
            )
          })}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
          {filteredProducts.map(p=>(
            <button
              key={p.id}
              onClick={()=>addItem(p)}
              className="text-left rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-4 hover:border-brand active:scale-[0.99] transition touch-btn bg-[var(--surface)]"
            >
              <div className="font-semibold text-[15px]">{p.name}</div>
              <div className="text-sm opacity-70 mt-1">{p.price.toFixed(2)} RSD</div>
            </button>
          ))}
          {filteredProducts.length===0 && (
            <div className="opacity-60">Nema artikala u ovoj kategoriji.</div>
          )}
        </div>
      </Card>
    </div>
  )
}

function TabBtn({active, onClick, children, icon}){
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-xl touch-btn text-sm border flex items-center gap-2 transition
        ${active
          ? 'bg-brand/20 border-brand text-neutral-900 dark:text-white'
          : 'bg-[var(--surface)] border-neutral-200/80 hover:border-brand dark:bg-neutral-900 dark:border-neutral-800'
        }`}
    >
      {icon}{children}
    </button>
  )
}

function ItemRow({item, onInc, onDec, products}){
  const p = products.find(x=>x.id===item.productId)
  const name = p?.name ?? 'Artikal'
  const price = item.priceEach ?? p?.price ?? 0
  return (
    <div className="flex items-center justify-between border border-neutral-200/80 dark:border-neutral-800 rounded-2xl px-3 py-2 transition bg-[var(--surface)]">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs opacity-70">{price.toFixed(2)} RSD</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onDec} className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-800 touch-btn transition">−</button>
        <div className="w-8 text-center">{item.qty}</div>
        <button onClick={onInc} className="px-3 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:border-neutral-800 touch-btn transition">+</button>
      </div>
    </div>
  )
}
