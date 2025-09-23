import { useEffect, useState } from 'react'
import { db, seedIfEmpty, ensureCategoryIcons, resetAndImport } from '../store/db.js'
import { Card, Button, Input, Label, Badge } from '../components/UI.jsx'
import useAuth from '../store/useAuth.js'
import * as Icons from 'lucide-react'

const GRID_W = 12
const GRID_H = 7

const ICON_CHOICES = [
  'Coffee','Beer','Wine','Martini','GlassWater','CupSoda','Utensils',
  'Pizza','IceCream','Cake','Cookie','Croissant','Soup','Salad','Sandwich',
  'Zap','Apple','Snowflake','Plus'
]

function getIconByName(name){
  return Icons[name] || Icons.Utensils
}

// CSV parser (autodetect , ili ;) + navodnici
function parseCSV(text){
  const firstLine = (text.split(/\r?\n/)[0] || '')
  const delim = (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0) ? ';' : ','
  const lines = text.split(/\r?\n/).filter(l => l.trim().length>0)
  const rows = []
  if (lines.length === 0) return rows

  const parseLine = (line) => {
    const out = []
    let cur = ''
    let inQ = false
    for (let i=0;i<line.length;i++){
      const ch = line[i]
      if (ch === '"'){
        if (inQ && line[i+1] === '"'){ cur += '"'; i++ } else { inQ = !inQ }
      } else if (ch === delim && !inQ){
        out.push(cur); cur = ''
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out.map(s=>s.trim())
  }

  const header = parseLine(lines[0])
  const idxCat = header.findIndex(h => h.trim().toLowerCase() === 'kategorija')
  const idxName = header.findIndex(h => h.trim().toLowerCase() === 'naziv artikla')
  const idxPrice = header.findIndex(h => h.toLowerCase().includes('cena'))
  if (idxCat === -1 || idxName === -1 || idxPrice === -1){
    throw new Error('CSV zaglavlje nije prepoznato. Očekujem: Kategorija, Naziv artikla, Cena (RSD), [Normativ]')
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

export default function Admin(){
  const { user } = useAuth()
  const [tab, setTab] = useState('products')
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
      <div className="max-w-xl mx-auto p-4">
        <Card>
          <div className="text-lg font-semibold">Pristup ograničen</div>
          <div className="opacity-80">Prijavite se kao admin da biste uređivali artikle, kategorije i stolove.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button className={tab==='products'?'opacity-100':'opacity-60'} onClick={()=>setTab('products')}>Proizvodi</Button>
        <Button className={tab==='categories'?'opacity-100':'opacity-60'} onClick={()=>setTab('categories')}>Kategorije</Button>
        <Button className={tab==='layout'?'opacity-100':'opacity-60'} onClick={()=>setTab('layout')}>Raspored</Button>
      </div>

      {tab==='categories' && <CategoriesTab categories={categories} onChange={reloadAll}/>}
      {tab==='products' && <ProductsTab onChange={reloadAll} categories={categories} products={products}/>}
      {tab==='layout'    && <LayoutTab tables={tables} onChange={reloadAll}/>}
    </div>
  )
}

/* -------------------- KATEGORIJE --------------------- */
function CategoriesTab({ categories, onChange }){
  async function changeIcon(catId, iconName){
    await db.table('categories').update(catId, { icon: iconName })
    onChange()
  }
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <div className="text-lg font-semibold mb-3">Sve kategorije</div>
        <div className="space-y-2">
          {categories.map(c=>{
            const Icon = getIconByName(c.icon)
            return (
              <div key={c.id} className="flex items-center justify-between border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon size={18} className="opacity-80"/>
                  <div className="font-medium">{c.name}</div>
                  <Badge className="ml-2">#{c.sort}</Badge>
                </div>
                <IconPickerButton value={c.icon} onPick={(name)=>changeIcon(c.id, name)} />
              </div>
            )
          })}
          {categories.length===0 && <div className="opacity-70">Nema kategorija.</div>}
        </div>
      </Card>
      <Card>
        <div className="text-lg font-semibold mb-3">Napomena</div>
        <p className="opacity-80 text-sm">Ikonice možeš menjati klikom na biranje ikona. Kategorije nastaju automatski prilikom uvoza CSV-a na osnovu naziva/kategorije iz fajla.</p>
      </Card>
    </div>
  )
}

function IconPickerButton({ value, onPick }){
  const [open, setOpen] = useState(false)
  const Icon = getIconByName(value)
  return (
    <div className="relative">
      <button onClick={()=>setOpen(o=>!o)} className="px-3 py-2 rounded-xl border bg-white dark:bg-neutral-800">
        <span className="inline-flex items-center gap-2"><Icon size={18}/>{value}</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-2 w-72 max-h-72 overflow-auto p-2 rounded-xl border bg-white dark:bg-neutral-900 shadow">
          <div className="grid grid-cols-4 gap-2">
            {ICON_CHOICES.map(name=>{
              const I = getIconByName(name)
              return (
                <button key={name} onClick={()=>{ onPick(name); setOpen(false) }}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-brand transition`}>
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

/* -------------------- PROIZVODI + RESET & IMPORT CSV --------------------- */
function ProductsTab({ onChange, categories, products }){
  const [csvFile, setCsvFile] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleResetAndImport(){
    if (!csvFile){ alert('Izaberite CSV fajl.'); return }
    if (!confirm('OBRISAĆE sve postojeće proizvode i kategorije i uvesti iz CSV-a. Nastaviti?')) return
    setBusy(true)
    try {
      const text = await csvFile.text()
      const rows = parseCSV(text)
      await resetAndImport(rows) // pametno kategorizuje
      onChange()
      alert('Uvoz gotov: artikli i kategorije su postavljeni.')
    } catch (e) {
      console.error(e)
      alert('Greška pri uvozu: ' + e.message)
    } finally {
      setBusy(false)
      setCsvFile(null)
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <div className="text-lg font-semibold mb-3">Reset &amp; Import iz CSV</div>
        <p className="text-sm opacity-80 mb-2">
          Ubaci tvoj fajl <b>CaffeClubM Artikli i Normativi.csv</b>. Ignorišemo “Normativ”; bitne kolone su:
          <b> Kategorija, Naziv artikla, Cena (RSD)</b>. Ako “Kategorija” nije dobra/prazna, sistem je određuje po nazivu artikla.
        </p>
        <input
          type="file" accept=".csv"
          onChange={e=>setCsvFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-neutral-300 dark:file:border-neutral-700 file:bg-white dark:file:bg-neutral-800 file:text-current"
          disabled={busy}
        />
        <div className="mt-3 flex gap-2">
          <Button onClick={handleResetAndImport} disabled={busy || !csvFile}>
            {busy ? 'Uvozim…' : 'Resetuj i uvezi CSV'}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="text-lg font-semibold mb-3">Trenutni proizvodi</div>
        <div className="grid sm:grid-cols-2 gap-2 max-h-[60vh] overflow-auto pr-1">
          {products.map(p=>{
            const c = categories.find(x=>x.id===p.categoryId)
            const Icon = getIconByName(c?.icon)
            return (
              <div key={p.id} className="flex items-center justify-between border rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  {Icon && <Icon size={16} className="opacity-70" />}
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs opacity-70">{c?.name ?? '—'}</div>
                  </div>
                </div>
                <div className="font-semibold">{(p.price ?? 0).toFixed(2)} RSD</div>
              </div>
            )
          })}
          {products.length===0 && <div className="opacity-60">Nema proizvoda — uvezite CSV.</div>}
        </div>
      </Card>
    </div>
  )
}

/* -------------------- RASPORED (isti grid kao front) --------------------- */
function LayoutTab({ tables, onChange }){
  const [selectedId, setSelectedId] = useState(null)

  async function placeAtCell(col, row){
    if (!selectedId) return
    const t = tables.find(x=>x.id===selectedId)
    if (!t) return
    const x = Math.max(0, Math.min(GRID_W-1, col))
    const y = Math.max(0, Math.min(GRID_H-1, row))
    await db.table('posTables').update(t.id, { x, y })
    onChange()
  }

  function handleGridClick(e){
    const host = e.currentTarget
    const rect = host.getBoundingClientRect()
    const cellW = rect.width / GRID_W
    const cellH = rect.height / GRID_H
    const col = Math.floor((e.clientX - rect.left) / cellW)
    const row = Math.floor((e.clientY - rect.top) / cellH)
    placeAtCell(col, row)
  }

  return (
    <div className="grid lg:grid-cols-[300px,1fr] gap-4">
      <Card>
        <div className="text-lg font-semibold mb-3">Stolovi</div>
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {tables.map(t=>{
            const active = selectedId === t.id
            return (
              <button key={t.id} onClick={()=>setSelectedId(t.id)}
                className={`w-full text-left px-3 py-2 rounded-xl border transition
                  ${active ? 'border-brand bg-brand/10' : 'border-neutral-200 dark:border-neutral-800 hover:border-brand'}`}>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs opacity-70">({t.x ?? 0},{t.y ?? 0})</div>
              </button>
            )
          })}
          {tables.length===0 && <div className="opacity-70">Nema stolova.</div>}
        </div>
      </Card>

      <Card>
        <div className="text-lg font-semibold mb-3">Raspored (klikni na mrežu da postaviš izabrani sto)</div>
        <div
          className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3 select-none"
          style={{height: 36*GRID_H + 28}}
          onClick={handleGridClick}
        >
          <div
            className="relative w-full h-full"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_W}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_H}, 1fr)`,
              gap: '6px',
            }}
          >
            {tables.map(t=>{
              const col = Math.min(Math.max((t.x ?? 0), 0), GRID_W-1) + 1
              const row = Math.min(Math.max((t.y ?? 0), 0), GRID_H-1) + 1
              const active = selectedId === t.id
              return (
                <div key={t.id}
                  className={`rounded-xl border aspect-square flex items-center justify-center transition
                    ${active ? 'border-brand bg-brand/10' : 'border-neutral-300 hover:border-brand dark:border-neutral-700'}
                  `}
                  style={{ gridColumnStart: col, gridRowStart: row }}
                >
                  <span className="text-sm font-semibold">{t.name}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-2 text-sm opacity-80">1) Izaberi sto sa leve strane. 2) Klik na ćeliju da ga postaviš. Pozicija se čuva odmah.</div>
      </Card>
    </div>
  )
}
