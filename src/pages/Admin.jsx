import { useEffect, useRef, useState, useMemo } from 'react'
import { db, seedIfEmpty, ensureCategoryIcons, resetAndImport } from '../store/db.js'
import { Card, Button, Badge } from '../components/UI.jsx'
import useAuth from '../store/useAuth.js'
import * as Icons from 'lucide-react'

/* Veličina stola i UI (+20%) */
const TABLE_SIZE = 38

const ICON_CHOICES = [
  'Coffee','Beer','Wine','Martini','GlassWater','CupSoda','Utensils',
  'Pizza','IceCream','Cake','Cookie','Croissant','Soup','Salad','Sandwich',
  'Zap','Apple','Snowflake','CupSoda','Mug','Cookie','Cherry','Fish','Drumstick',
]

function getIconByName(name){
  return Icons[name] || Icons.Utensils
}

/* CSV parser (auto , ili ;) + navodnici */
function parseCSV(text){
  const firstLine = (text.split(/\r?\n/)[0] || '')
  const delim = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','
  const lines = text.split(/\r?\n/).filter(l => l.trim().length>0)
  const rows = []
  if (lines.length === 0) return rows

  const parseLine = (line) => {
    const out = []; let cur = ''; let inQ = false
    for (let i=0;i<line.length;i++){
      const ch = line[i]
      if (ch === '"'){ if (inQ && line[i+1] === '"'){ cur += '"'; i++ } else { inQ = !inQ } }
      else if (ch === delim && !inQ){ out.push(cur); cur = '' }
      else { cur += ch }
    }
    out.push(cur)
    return out.map(s=>s.trim())
  }

  const header = parseLine(lines[0])
  const idxCat = header.findIndex(h => h.trim().toLowerCase() === 'kategorija')
  const idxName = header.findIndex(h => h.trim().toLowerCase() === 'naziv artikla')
  const idxPrice = header.findIndex(h => h.toLowerCase().includes('cena'))
  if (idxCat === -1 || idxName === -1 || idxPrice === -1){
    throw new Error('CSV zaglavlje nije prepoznato. Očekujem: Kategorija, Naziv artikla, Cena (RSD)')
  }

  for (let i=1;i<lines.length;i++){
    const cols = parseLine(lines[i])
    if (!cols[idxName]) continue
    rows.push({
      'Kategorija': cols[idxCat] ?? '',
      'Naziv artikla': cols[idxName],
      'Cena (RSD)': cols[idxPrice] ?? ''
    })
  }
  return rows
}

/* ==================== ADMIN ===================== */
export default function Admin(){
  const { user } = useAuth()
  const [tab, setTab] = useState('layout')

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [tables, setTables] = useState([])

  useEffect(()=>{ (async ()=>{
    await seedIfEmpty()
    await ensureCategoryIcons()
    await reloadAll()
  })() },[])

  async function reloadAll(){
    const cats = await db.table('categories').orderBy('sort').toArray()
    const prods = await db.table('products').toArray()
    const t = await db.table('posTables').toArray()
    setCategories(cats); setProducts(prods); setTables(t)
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-4 pr-64">
        <Card>
          <div className="text-lg font-semibold">Pristup ograničen</div>
          <div className="opacity-80">Prijavite se kao admin da biste uređivali artikle, kategorije, stolove i račune.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 pr-64 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button className={tab==='products'?'opacity-100':'opacity-60'} onClick={()=>setTab('products')}>Proizvodi</Button>
        <Button className={tab==='categories'?'opacity-100':'opacity-60'} onClick={()=>setTab('categories')}>Kategorije</Button>
        <Button className={tab==='layout'?'opacity-100':'opacity-60'} onClick={()=>setTab('layout')}>Raspored</Button>
        <Button className={tab==='receipts'?'opacity-100':'opacity-60'} onClick={()=>setTab('receipts')}>Računi</Button>
      </div>

      {tab==='categories' && <CategoriesTab categories={categories} onChange={reloadAll}/>}
      {tab==='products' && <ProductsTab categories={categories} products={products} onChange={reloadAll} />}
      {tab==='layout'    && <LayoutTab tables={tables} onChange={reloadAll}/>}
      {tab==='receipts'  && <ReceiptsTab />}
    </div>
  )
}

/* -------------------- KATEGORIJE (CRUD) --------------------- */
function CategoriesTab({ categories, onChange }){
  const [name, setName] = useState('')
  const [sort, setSort] = useState( (categories.at(-1)?.sort ?? 0) + 1 )
  const [icon, setIcon] = useState('Utensils')

  async function addCat(){
    if (!name.trim()) return
    await db.table('categories').add({ name: name.trim(), sort: Number(sort)||0, icon })
    setName(''); setSort((Number(sort)||0)+1)
    onChange()
  }
  async function delCat(id){
    if (!confirm('Obrisati kategoriju? (Proizvodi zadržaće categoryId, proveri nakon brisanja)')) return
    await db.table('categories').delete(id)
    onChange()
  }
  async function updateCat(c){
    await db.table('categories').update(c.id, { name: c.name, sort: c.sort, icon: c.icon })
    onChange()
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <div className="text-lg font-semibold mb-3">Dodaj kategoriju</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Naziv" className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900"/>
          <input value={sort} onChange={e=>setSort(e.target.value)} type="number" placeholder="Sort" className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900"/>
          <IconPicker value={icon} onPick={setIcon}/>
        </div>
        <div className="mt-3">
          <Button onClick={addCat}>Sačuvaj</Button>
        </div>
      </Card>

      <Card>
        <div className="text-lg font-semibold mb-3">Sve kategorije</div>
        <div className="space-y-2">
          {categories.map(c=>{
            const Icon = getIconByName(c.icon)
            return (
              <div key={c.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2">
                <input
                  defaultValue={c.name}
                  onBlur={e=>updateCat({ ...c, name: e.target.value })}
                  className="px-2 py-1 rounded-lg border bg-white dark:bg-neutral-900"
                />
                <input
                  type="number"
                  defaultValue={c.sort}
                  onBlur={e=>updateCat({ ...c, sort: Number(e.target.value)||0 })}
                  className="w-20 px-2 py-1 rounded-lg border bg-white dark:bg-neutral-900 text-right"
                />
                <IconPicker value={c.icon} onPick={(name)=>updateCat({ ...c, icon: name })}/>
                <button onClick={()=>delCat(c.id)} className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700">Obriši</button>
              </div>
            )
          })}
          {categories.length===0 && <div className="opacity-70">Nema kategorija.</div>}
        </div>
      </Card>
    </div>
  )
}

function IconPicker({ value, onPick }){
  const [open, setOpen] = useState(false)
  const Icon = getIconByName(value)
  return (
    <div className="relative">
      <button onClick={()=>setOpen(o=>!o)} className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800">
        <span className="inline-flex items-center gap-2"><Icon size={18}/>{value}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-80 max-h-80 overflow-auto p-2 rounded-xl border bg-white dark:bg-neutral-900 shadow">
          <div className="grid grid-cols-5 gap-2">
            {ICON_CHOICES.map(name=>{
              const I = getIconByName(name)
              return (
                <button key={name} onClick={()=>{ onPick(name); setOpen(false) }}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-brand transition">
                  <I size={20}/><span className="text-[11px] opacity-80">{name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------- PROIZVODI (CRUD) --------------------- */
function ProductsTab({ categories, products, onChange }){
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [catId, setCatId] = useState(categories[0]?.id || null)
  const [csvFile, setCsvFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')

  async function addProd(){
    if (!name.trim() || !catId) return
    const p = Number(price) || 0
    await db.table('products').add({ name: name.trim(), price: p, categoryId: catId })
    setName(''); setPrice('')
    onChange()
  }
  async function updateProd(p){
    await db.table('products').update(p.id, { name: p.name, price: Number(p.price)||0, categoryId: Number(p.categoryId)||null })
    onChange()
  }
  async function delProd(id){
    if (!confirm('Obrisati proizvod?')) return
    await db.table('products').delete(id)
    onChange()
  }

  async function handleResetAndImport(){
    if (!csvFile){ alert('Izaberite CSV fajl.'); return }
    if (!confirm('OBRISAĆE sve postojeće proizvode i kategorije i uvesti iz CSV-a. Nastaviti?')) return
    setBusy(true)
    try {
      const text = await csvFile.text()
      const rows = parseCSV(text)
      await resetAndImport(rows)
      onChange()
      alert('Uvoz gotov.')
    } catch (e) {
      console.error(e)
      alert('Greška pri uvozu: ' + e.message)
    } finally {
      setBusy(false)
      setCsvFile(null)
    }
  }

  const filtered = useMemo(()=>{
    const qq = q.trim().toLowerCase()
    if (!qq) return products
    return products.filter(p => p.name.toLowerCase().includes(qq))
  },[products, q])

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <div className="text-lg font-semibold mb-3">Dodaj proizvod</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Naziv artikla" className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900 sm:col-span-2"/>
          <input value={price} onChange={e=>setPrice(e.target.value)} type="number" placeholder="Cena (RSD)" className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900"/>
          <select value={catId ?? ''} onChange={e=>setCatId(Number(e.target.value)||null)} className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900">
            <option value="">Kategorija…</option>
            {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={addProd}>Sačuvaj</Button>
        </div>

        <div className="mt-6 text-sm font-semibold">Masovni uvoz (CSV)</div>
        <input
          type="file" accept=".csv"
          onChange={e=>setCsvFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-neutral-300 dark:file:border-neutral-700 file:bg-white dark:file:bg-neutral-800 file:text-current mt-1"
          disabled={busy}
        />
        <div className="mt-2">
          <Button onClick={handleResetAndImport} disabled={busy || !csvFile}>
            {busy ? 'Uvozim…' : 'Resetuj i uvezi CSV'}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="text-lg font-semibold mb-3">Svi proizvodi</div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pretraga…" className="mb-2 w-full px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900"/>
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {filtered.map(p=>{
            return (
              <div key={p.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2">
                <input defaultValue={p.name} onBlur={e=>updateProd({ ...p, name: e.target.value })} className="px-2 py-1 rounded-lg border bg-white dark:bg-neutral-900"/>
                <input type="number" defaultValue={p.price} onBlur={e=>updateProd({ ...p, price: Number(e.target.value)||0 })} className="w-28 px-2 py-1 rounded-lg border bg-white dark:bg-neutral-900 text-right"/>
                <select defaultValue={p.categoryId ?? ''} onChange={e=>updateProd({ ...p, categoryId: Number(e.target.value)||null })} className="px-2 py-1 rounded-lg border bg-white dark:bg-neutral-900">
                  <option value="">—</option>
                  {categories.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={()=>delProd(p.id)} className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700">Obriši</button>
              </div>
            )
          })}
          {filtered.length===0 && <div className="opacity-70">Nema proizvoda.</div>}
        </div>
      </Card>
    </div>
  )
}

/* -------------------- RASPORED --------------------- */
function LayoutTab({ tables, onChange }){
  const stageRef = useRef(null)
  const [selectedId, setSelectedId] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [openEditor, setOpenEditor] = useState(false) // FULLSCREEN editor

  function toPct(clientX, clientY){
    const host = stageRef.current
    if (!host) return { xpct: 0, ypct: 0 }
    const rect = host.getBoundingClientRect()
    const x = clientX - rect.left - TABLE_SIZE/2
    const y = clientY - rect.top  - TABLE_SIZE/2
    const xpct = Math.min(1, Math.max(0, x / Math.max(1, rect.width  - TABLE_SIZE)))
    const ypct = Math.min(1, Math.max(0, y / Math.max(1, rect.height - TABLE_SIZE)))
    return { xpct: +xpct.toFixed(4), ypct: +ypct.toFixed(4) }
  }

  async function setTablePct(id, xpct, ypct){
    await db.table('posTables').update(id, { xpct, ypct })
    onChange()
  }

  function handleGridClick(e){
    if (!selectedId) return
    const { xpct, ypct } = toPct(e.clientX, e.clientY)
    setTablePct(selectedId, xpct, ypct)
  }

  function handlePointerDown(e, id){
    e.preventDefault()
    setSelectedId(id)
    setDragId(id)

    const move = (ev)=>{
      if (dragId === null) return
      const ptX = ev.clientX ?? (ev.touches?.[0]?.clientX)
      const ptY = ev.clientY ?? (ev.touches?.[0]?.clientY)
      if (ptX==null || ptY==null) return
      const { xpct, ypct } = toPct(ptX, ptY)
      setTablePct(id, xpct, ypct)
    }
    const up = ()=>{
      setDragId(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', up)
    }
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    window.addEventListener('touchmove', move, { passive: true })
    window.addEventListener('touchend', up, { passive: true })
  }

  async function addTable(){
    const name = `Sto ${tables.length + 1}`
    await db.table('posTables').add({ name, xpct: 0.05, ypct: 0.05 })
    onChange()
  }

  return (
    <>
      <div className="grid lg:grid-cols-[280px,1fr] gap-4">
        <Card>
          <div className="text-lg font-semibold mb-3">Stolovi</div>
          <div className="mb-2 flex gap-2">
            <Button onClick={addTable}>+ Dodaj sto</Button>
            <Button onClick={()=>setOpenEditor(true)} className="bg-neutral-700 hover:bg-neutral-600">Editor rasporeda (cela mapa)</Button>
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {tables.map(t=>{
              const active = selectedId === t.id
              const label = (t.name || `Sto ${t.id}`)
              return (
                <button key={t.id} onClick={()=>setSelectedId(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition
                    ${active ? 'border-brand bg-brand/10' : 'border-neutral-200 dark:border-neutral-800 hover:border-brand'}`}>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs opacity-70">x:{(t.xpct??0).toFixed?.(2) ?? '—'} y:{(t.ypct??0).toFixed?.(2) ?? '—'}</div>
                </button>
              )
            })}
            {tables.length===0 && <div className="opacity-70">Nema stolova.</div>}
          </div>
        </Card>

        {/* Pregled u kartici (može ostati), ali za 100% istu poziciju koristi FULL editor */}
        <Card>
          <div className="text-lg font-semibold mb-3">Raspored — pregled</div>
          <div className="relative rounded-2xl overflow-hidden" style={{height: 'calc(100svh - 220px)'}}>
            <div className="tables-area">
              <img className="tables-img" src="/tables-bg.gif" alt="Mapa lokala" />
              <div className="tables-area-overlay" />
            </div>
            <div
              ref={stageRef}
              className="tables-stage select-none"
              onClick={handleGridClick}
            >
              <div className="relative w-full h-full">
                {tables.map(t=>{
                  let xpct = typeof t.xpct === 'number' ? t.xpct : (typeof t.x==='number' ? Math.min(1, Math.max(0, (t.x+0.5)/24)) : 0.05)
                  let ypct = typeof t.ypct === 'number' ? t.ypct : (typeof t.y==='number' ? Math.min(1, Math.max(0, (t.y+0.5)/14)) : 0.05)
                  const active = selectedId === t.id
                  return (
                    <div
                      key={t.id}
                      onPointerDown={(e)=>handlePointerDown(e, t.id)}
                      onTouchStart={(e)=>handlePointerDown(e, t.id)}
                      className={`absolute rounded-lg border flex items-center justify-center select-none cursor-grab active:cursor-grabbing
                        ${active ? 'border-brand bg-brand/10' : 'border-neutral-300 hover:border-brand dark:border-neutral-700'}
                      `}
                      style={{
                        left: `calc(${(xpct*100).toFixed(3)}% - ${TABLE_SIZE/2}px)`,
                        top:  `calc(${(ypct*100).toFixed(3)}% - ${TABLE_SIZE/2}px)`,
                        width: TABLE_SIZE, height: TABLE_SIZE
                      }}
                    >
                      <span className="text-[11px] font-semibold">{t.name || `Sto ${t.id}`}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="mt-2 text-sm opacity-80">
            Za potpuno precizno postavljanje (identično mapi), koristi <b>Editor rasporeda (cela mapa)</b>.
          </div>
        </Card>
      </div>

      {/* FULLSCREEN EDITOR – isti “view” kao mapa stolova */}
      {openEditor && (
        <div className="fixed inset-0 z-[90]">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setOpenEditor(false)} />
          <div className="absolute inset-0 pointer-events-none pr-64">{/* isto polje kao glavni view (pr-64 = širina sidebara) */}
            <div className="relative w-full h-full pointer-events-auto">
              {/* Toolbar */}
              <div className="no-print absolute top-3 left-3 z-10 flex gap-2">
                <Button onClick={()=>setOpenEditor(false)} className="bg-neutral-700 hover:bg-neutral-600">Zatvori</Button>
                <Button onClick={()=>setSelectedId(null)} className="bg-neutral-700/70 hover:bg-neutral-600/80">Poništi selekciju</Button>
              </div>

              {/* Identicna pozadina/veličina kao TableMap */}
              <div className="fullscreen-map">
                <div className="tables-area">
                  <img className="tables-img" src="/tables-bg.gif" alt="Mapa lokala" />
                  <div className="tables-area-overlay" />
                </div>
                <div
                  ref={stageRef}
                  className="tables-stage select-none"
                  onClick={handleGridClick}
                >
                  <div className="relative w-full h-full">
                    {tables.map(t=>{
                      let xpct = typeof t.xpct === 'number' ? t.xpct : (typeof t.x==='number' ? Math.min(1, Math.max(0, (t.x+0.5)/24)) : 0.05)
                      let ypct = typeof t.ypct === 'number' ? t.ypct : (typeof t.y==='number' ? Math.min(1, Math.max(0, (t.y+0.5)/14)) : 0.05)
                      const active = selectedId === t.id
                      return (
                        <div
                          key={t.id}
                          onPointerDown={(e)=>handlePointerDown(e, t.id)}
                          onTouchStart={(e)=>handlePointerDown(e, t.id)}
                          className={`absolute rounded-lg border flex items-center justify-center select-none cursor-grab active:cursor-grabbing
                            ${active ? 'border-brand bg-brand/10' : 'border-neutral-300 hover:border-brand dark:border-neutral-700'}
                          `}
                          style={{
                            left: `calc(${(xpct*100).toFixed(3)}% - ${TABLE_SIZE/2}px)`,
                            top:  `calc(${(ypct*100).toFixed(3)}% - ${TABLE_SIZE/2}px)`,
                            width: TABLE_SIZE, height: TABLE_SIZE
                          }}
                        >
                          <span className="text-[11px] font-semibold">{t.name || `Sto ${t.id}`}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------- RAČUNI (arhiva predračuna) — neizmenjeno osim pr-64 gore u layoutu --------------------- */
function ReceiptsTab(){
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tableId, setTableId] = useState('')
  const [q, setQ] = useState('')
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')

  const [rows, setRows] = useState([])
  const [tables, setTables] = useState([])

  useEffect(()=>{ (async ()=>{
    const t = await db.table('posTables').toArray()
    setTables(t)
    await runSearch()
  })() },[])

  async function runSearch(){
    let list = await db.table('archivedOrders').reverse().sortBy('createdAt')
    if (from){
      const f = new Date(from).toISOString()
      list = list.filter(o => o.createdAt >= f)
    }
    if (to){
      const t = new Date(to)
      t.setDate(t.getDate()+1)
      const tIso = t.toISOString()
      list = list.filter(o => o.createdAt < tIso)
    }
    if (tableId){
      const tid = Number(tableId)
      list = list.filter(o => (o.tableId ?? 0) === tid)
    }
    const out = []
    for (const o of list){
      const its = await db.table('archivedItems').where('orderId').equals(o.id).toArray()
      const total = its.reduce((s,i)=> s + (i.qty * (i.priceEach ?? 0)), 0)
      const text = its.map(i => `${i.name ?? ''} x${i.qty}`).join(', ')
      out.push({
        ...o, items: its, total, text,
        date: new Date(o.createdAt)
      })
    }
    const qq = q.trim().toLowerCase()
    let f = out
    if (qq) f = f.filter(r => r.text.toLowerCase().includes(qq))
    const minN = min ? Number(min) : null
    const maxN = max ? Number(max) : null
    if (minN != null) f = f.filter(r => r.total >= minN)
    if (maxN != null) f = f.filter(r => r.total <= maxN)

    setRows(f)
  }

  async function removeReceipt(id){
    if (!confirm('Obrisati ovaj račun iz arhive? (biće uklonjen i iz preseka)')) return
    await db.table('archivedItems').where('orderId').equals(id).delete()
    await db.table('archivedOrders').delete(id)
    await runSearch()
  }

  return (
    <Card>
      <div className="text-lg font-semibold mb-3">Računi (arhiva predračuna)</div>
      <div className="grid md:grid-cols-6 gap-2">
        <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900" />
        <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900" />
        <select value={tableId} onChange={e=>setTableId(e.target.value)} className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900">
          <option value="">Sto (svi)</option>
          {tables.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tekst stavki…" className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900" />
        <input type="number" value={min} onChange={e=>setMin(e.target.value)} placeholder="Min RSD" className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900" />
        <input type="number" value={max} onChange={e=>setMax(e.target.value)} placeholder="Max RSD" className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-900" />
      </div>
      <div className="mt-2">
        <Button onClick={runSearch}>Pretraži</Button>
      </div>

      <div className="mt-4 space-y-2 max-h-[60vh] overflow-auto pr-1">
        {rows.map(r=>{
          const dateStr = r.date.toLocaleString()
          const tableName = r.tableId ? (tables.find(t=>t.id===r.tableId)?.name ?? `Sto ${r.tableId}`) : 'Brzo kucanje'
          return (
            <div key={r.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="font-semibold">{tableName}</div>
                <div className="text-sm opacity-80">{dateStr}</div>
              </div>
              <div className="mt-1 text-sm opacity-90">{r.text || '—'}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-lg font-bold">{r.total.toFixed(2)} RSD</div>
                <div className="flex gap-2">
                  <Button onClick={()=>removeReceipt(r.id)} className="bg-red-600 hover:bg-red-700">Obriši</Button>
                </div>
              </div>
            </div>
          )
        })}
        {rows.length===0 && <div className="opacity-70">Nema rezultata za dati filter.</div>}
      </div>
    </Card>
  )
}
