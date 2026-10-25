# Ayam Potong Banjarmasin - Invoicing

Final build siap deploy Vercel (floating cart + auto titik ribuan + export JPG tab baru).

## Deploy ke Vercel (paling cepat)

1. Install Vercel CLI (optional) atau langsung via dashboard:
```bash
npm i -g vercel
```

2. Di folder ini:
```bash
npm install
npm run build
vercel --prod
```

Atau via GitHub:
- Push folder ini ke GitHub repo baru
- Buka vercel.com > Add New Project > Import repo
- Framework: Vite, Build: npm run build, Output: dist
- Deploy

## Env tidak perlu

Tidak pakai env variable. Semua data hardcoded + localStorage.

## Fitur final:
- Logo tanpa lingkaran
- Harga default: Karkas 1.5=65k, 1.0=50k, 0.9=35k, Afkir 60k, Fillet Segar Dada 62k Paha 60k, Frozen Dada 60k Paha 58k Bebek 60k
- Editable harga dengan auto titik ribuan
- Qty bisa desimal, kosong tidak sisa 0/1
- Invoice compact 1 halaman max 700px
- Rekening BRI 448501011871533 a.n. Rusniawati
- Label KEPADA (bukan TAGIH KEPADA), tanpa STATUS, tanpa Hari ini - Lunas/COD
- Floating bottom cart bar, klik buka drawer rincian
- Export JPG: buka di tab baru → long press Save to Photos (fix Safari iPhone)
- Export PDF: buka di tab baru

Contact WA: 0877-5208-2402 | 0815-4502-6095
IG: @ayambanjarmasin
