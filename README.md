# Predračun POS Starter

Offline React + Vite + Tailwind starter za aplikaciju za kucanje predračuna sa Admin panelom, mapom stolova i POS ekranom.

## Brzi start
```bash
npm i
npm run dev
```

- Admin login: **admin / robertobadjo**
- Svi podaci se čuvaju lokalno (IndexedDB preko Dexie).
- Štampa koristi `window.print()` i print CSS za 80mm termalni štampač (Epson kompatibilno).

### Stranice
- `/` Stolovi (mapa)
- `/pos?table=ID` Kucanje porudžbina
- `/admin` Admin (proizvodi, kategorije, stolovi)
- `/reports` Presek (Z-izveštaj demo)
- `/print/:type/:id` Šablon za štampu

> Ovo je početna struktura; funkcionalnosti ćemo proširivati (uređivanje količina na štampanom predračunu, format računa, dnevni presek po satima, itd.).
