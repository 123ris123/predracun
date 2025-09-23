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

/* === PRINT TEMPLATES (80mm) === */
function buildPrintCSS(){
  return `
    <style>
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0; padding: 0; background: #fff; color: #000; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .receipt { width: 72mm; margin: 0 auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace; font-size: 12px; line-height: 1.25; padding: 6px 4px; }
      .center { text-align: center; }
      .row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
      .hr { border-top:1px dashed #000; margin:6px 0; }
      .muted { opacity:.9 }
      .small { font-size: 11px; }
      .tot { font-weight: 700; }
      .qty { min-width: 22px; text-align:right; }
      .name { flex:1; }
      .price { min-width: 48px; text-align:right; }
      .mt2 { margin-top: 6px; } .mt1 { margin-top: 3px; }
      .mb2 { margin-bottom: 6px; }
      .nowrap { white-space: nowrap; }
    </style>
  `
}

function buildReceiptHTML({ title='Predračun', tableLabel='Brzo kucanje', items=[], total=0, footerNote='Hvala!' }){
  const css = buildPrintCSS()
  const lines = items.map(it => `
    <div class="row">
      <div class="qty">${it.qty}×</div>
      <div class="name">${it.name}</div>
      <div class="price">${(it.qty * it.priceEach).toFixed(2)} RSD</div>
    </div>
  `).join('')
  return `
    <!doctype html><html><head><meta charset="utf-8">${css}</head>
    <body>
      <div class="receipt">
        <div class="center"><b>${title}</b></div>
        <div class="center small muted">${tableLabel}</div>
        <div class="hr"></div>
        ${lines || '<div class="small muted">— Nema stavki —</div>'}
        <div class="hr"></div>
        <div class="row tot"><div>UKUPNO</div><div>${total.toFixed(2)} RSD</div></div>
        <div class="mt2 center small">${footerNote}</div>
      </div>
      <script>window.onload=()=>{ setTimeout(()=>{ window.print(); window.close(); }, 50) };</script>
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

  /* NOVO: štampa preko template-a (80mm) — bez viška papira */
  async function printAndArchive(){
    // pripremi stavke i naziv stola
    let list = items
    let label = quickMode ? 'Brzo kucanje' : `Sto #${tableId}`

    if (!quickMode){
      // pročitaj sveže iz baze (pre arhiviranja)
      list = await db.table('orderItems').where('orderId').equals(orderId).toArray()
    }

    const mapped = list.map(it=>{
      const p = products.find(x=>x.id===it.productId)
      return { name: p?.name ?? 'Artikal', qty: it.qty, priceEach: it.priceEach ?? p?.price ?? 0 }
    })
    const totalNow = mapped.reduce((s,i)=> s + i.qty*i.priceEach, 0)

    // arhiviraj po starom toku
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

    // otvori print prozor sa šablonom
    const html = buildReceiptHTML({
      title: 'Predračun',
      tableLabel: label,
      items: mapped,
      total: totalNow,
      footerNote: 'Hvala!'
    })
    openPrint(html)

    if (!quickMode) nav('/') // sto se oslobađa i vraćamo se na mapu
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

        {/* Dugmad — u quick modu prikazujemo SAMO štampu */}
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

        {/* Tabovi kategorija (wrap u 2 reda) */}
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

        {/* GRID artikala */}
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
