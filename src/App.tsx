import React, { useState, useEffect, useMemo, useRef } from "react";
import logoAyam from "./assets/logo.png";

type Unit = "Ekor" | "Kg";
type ProductDef = { id: string; name: string; unit: Unit; category: string; defaultPrice: number; };
type InvoiceItem = { id: string; name: string; unit: Unit; qty: string; price: string; };

// --- Helpers: qty (decimal) vs price (thousand separated) ---
function parseQtyNumber(s: string): number {
  if (!s) return 0;
  const normalized = s.replace(/,/g, ".").trim();
  if (normalized === "" || normalized === ".") return 0;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}
function sanitizeDecimalInput(raw: string): string | null {
  if (raw === "") return "";
  const v = raw.replace(/,/g, ".");
  if (!/^[0-9]*\.?[0-9]*$/.test(v)) return null;
  const dots = (v.match(/\./g) || []).length;
  if (dots > 1) return null;
  return v;
}
function formatRibuan(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cleaned = digits.replace(/^0+(?=\d)/, "");
  if (!cleaned) return "0";
  return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function parsePriceNumber(raw: string): number {
  if (!raw) return 0;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return isNaN(n) ? 0 : n;
}

const PRODUCT_CATALOG: ProductDef[] = [
  { id: "karkas-1.5", name: "Ayam Karkas Ukuran 1,5 kg", unit: "Ekor", category: "AYAM KARKAS SEGAR", defaultPrice: 65000 },
  { id: "karkas-1.0", name: "Ayam Karkas Ukuran 1,0 kg", unit: "Ekor", category: "AYAM KARKAS SEGAR", defaultPrice: 50000 },
  { id: "karkas-0.9", name: "Ayam Karkas Ukuran 0,9 kg", unit: "Ekor", category: "AYAM KARKAS SEGAR", defaultPrice: 35000 },
  { id: "afkir", name: "Ayam Petelur (Afkir)", unit: "Ekor", category: "AYAM SEGAR LAINNYA", defaultPrice: 60000 },
  { id: "dada-fillet-segar", name: "Dada Fillet (Boneless Breast) - Segar", unit: "Kg", category: "FILLET AYAM SEGAR", defaultPrice: 62000 },
  { id: "paha-fillet-segar", name: "Paha Fillet (Boneless Leg) - Segar", unit: "Kg", category: "FILLET AYAM SEGAR", defaultPrice: 60000 },
  { id: "dada-fillet-frozen", name: "Dada Fillet (Boneless Breast) - Frozen", unit: "Kg", category: "PRODUK FROZEN (BEKU)", defaultPrice: 60000 },
  { id: "paha-fillet-frozen", name: "Paha Fillet (Boneless Leg) - Frozen", unit: "Kg", category: "PRODUK FROZEN (BEKU)", defaultPrice: 58000 },
  { id: "bebek", name: "Bebek - Frozen", unit: "Ekor", category: "PRODUK FROZEN (BEKU)", defaultPrice: 60000 },
];

const CATEGORIES = ["AYAM KARKAS SEGAR", "AYAM SEGAR LAINNYA", "FILLET AYAM SEGAR", "PRODUK FROZEN (BEKU)"] as const;
const CONTACTS = {
  wa1: "0877-5208-2402",
  wa2: "0815-4502-6095",
  ig: "ayambanjarmasin",
};
const REKENING = {
  bank: "BRI",
  no: "448501011871533",
  an: "Rusniawati",
};

function generateInvoiceNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rnd = String(Math.floor(Math.random() * 900) + 100);
  return `INV-${y}${m}${day}-${rnd}`;
}
function formatRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
function formatRpShort(n: number) {
  if (!n) return "Rp 0";
  return `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
}
function formatTanggal(dateStr: string) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  } catch {
    return dateStr;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed load ${src}`));
    document.head.appendChild(s);
  });
}
async function ensureHtml2Canvas(): Promise<any> {
  const w = window as any;
  if (w.html2canvas) return w.html2canvas;
  const cdns = [
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  ];
  for (const url of cdns) {
    try {
      await loadScript(url);
      if (w.html2canvas) return w.html2canvas;
    } catch {}
  }
  throw new Error("html2canvas unavailable");
}
async function ensureJsPDF(): Promise<any> {
  const w = window as any;
  if (w.jspdf && w.jspdf.jsPDF) return w.jspdf.jsPDF;
  if (w.jsPDF) return w.jsPDF;
  const cdns = [
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  ];
  for (const url of cdns) {
    try {
      await loadScript(url);
      if (w.jspdf && w.jspdf.jsPDF) return w.jspdf.jsPDF;
      if (w.jsPDF) return w.jsPDF;
    } catch {}
  }
  throw new Error("jsPDF unavailable");
}
async function ensureHtmlToImage(): Promise<any> {
  const w = window as any;
  if (w.htmlToImage) return w.htmlToImage;
  const cdns = [
    "https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js",
    "https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.js",
  ];
  for (const url of cdns) {
    try {
      await loadScript(url);
      if (w.htmlToImage) return w.htmlToImage;
    } catch {}
  }
  throw new Error("html-to-image unavailable");
}

function dataURLToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
function dataURLToFile(dataUrl: string, filename: string): File {
  const blob = dataURLToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
}

export default function App() {
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [noHP, setNoHP] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [invoiceNo, setInvoiceNo] = useState(generateInvoiceNo);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [previewTab, setPreviewTab] = useState<"thermal" | "a4">("a4");
  const [customName, setCustomName] = useState("");
  const [customUnit, setCustomUnit] = useState<Unit>("Kg");
  const [showCustom, setShowCustom] = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  const [isExporting, setIsExporting] = useState<null | "pdf" | "jpg">(null);
  const [exportMsg, setExportMsg] = useState<string>("");
  const [cartOpen, setCartOpen] = useState(false);
  const invoiceA4Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefix = `INV-${tanggal.replaceAll("-", "")}`;
    if (!invoiceNo.startsWith(prefix)) setInvoiceNo(`${prefix}-${invoiceNo.split("-").pop() || "001"}`);
  }, [tanggal]);

  const addProduct = (prod: ProductDef) => {
    const idx = items.findIndex((it) => it.name === prod.name && it.unit === prod.unit);
    if (idx >= 0) {
      const c = [...items];
      const cur = parseQtyNumber(c[idx].qty);
      c[idx] = { ...c[idx], qty: String(cur + 1) };
      setItems(c);
    } else {
      setItems((prev) => [...prev, { id: `${prod.id}-${Date.now()}`, name: prod.name, unit: prod.unit, qty: "1", price: String(prod.defaultPrice) }]);
    }
    setCartOpen(true);
  };
  const addCustomProduct = () => {
    if (!customName.trim()) return;
    const name = customName.trim();
    const idx = items.findIndex((it) => it.name.toLowerCase() === name.toLowerCase() && it.unit === customUnit);
    if (idx >= 0) {
      const c = [...items];
      const cur = parseQtyNumber(c[idx].qty);
      c[idx] = { ...c[idx], qty: String(cur + 1) };
      setItems(c);
    } else {
      setItems((prev) => [...prev, { id: `custom-${Date.now()}`, name, unit: customUnit, qty: "1", price: "0" }]);
    }
    setCustomName("");
    setShowCustom(false);
    setCartOpen(true);
  };
  const updateItem = (id: string, patch: Partial<InvoiceItem>) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + parseQtyNumber(it.qty) * parsePriceNumber(it.price), 0), [items]);
  const total = subtotal;

  const waText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`*Ayam Potong Banjarmasin*`);
    lines.push(`${invoiceNo} - ${formatTanggal(tanggal)}`);
    lines.push(``);
    if (namaPelanggan) lines.push(`Pelanggan: ${namaPelanggan}`);
    if (noHP) lines.push(`No HP: ${noHP}`);
    lines.push(``);
    lines.push(`*Rincian Pesanan:*`);
    items.forEach((it, idx) => {
      const q = parseQtyNumber(it.qty);
      const p = parsePriceNumber(it.price);
      const lt = q * p;
      const qtyDisplay = it.qty === "" ? "0" : it.qty;
      lines.push(`${idx + 1}. ${it.name} - ${qtyDisplay} ${it.unit} x ${formatRupiah(p)} = ${formatRupiah(lt)}`);
    });
    lines.push(``);
    lines.push(`Subtotal: ${formatRupiah(subtotal)}`);
    lines.push(`*TOTAL: ${formatRupiah(total)}*`);
    lines.push(``);
    lines.push(`Pembayaran: ${REKENING.bank} ${REKENING.no} a.n. ${REKENING.an}`);
    lines.push(``);
    lines.push(`Terima kasih 🙏`);
    lines.push(`Hub: ${CONTACTS.wa1} / ${CONTACTS.wa2} | IG: @${CONTACTS.ig}`);
    return lines.join("\n");
  }, [namaPelanggan, noHP, tanggal, invoiceNo, items, subtotal, total]);

  const handleWaShare = () => {
    const enc = encodeURIComponent(waText);
    window.open(`https://wa.me/?text=${enc}`, "_blank");
  };
  const handleCopyWa = () => {
    const el = document.createElement("textarea");
    el.value = waText;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    setWaCopied(true);
    setTimeout(() => setWaCopied(false), 2000);
  };

  const handleExportJPG = async () => {
    const el = document.getElementById("invoice-a4-capture") || invoiceA4Ref.current;
    if (!el) {
      setExportMsg("Invoice A4 tidak ditemukan");
      setTimeout(() => setExportMsg(""), 3000);
      return;
    }
    let imgWin: Window | null = null;
    try {
      imgWin = window.open("", "_blank");
    } catch {}
    if (imgWin) {
      try {
        imgWin.document.write(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Memuat Invoice...</title><style>body{margin:0;background:#0f172a;color:white;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}</style></head><body><p>Membuat JPG (metode preview langsung)...</p></body></html>`);
        imgWin.document.close();
      } catch {}
    }
    setIsExporting("jpg");
    setExportMsg("Membuat JPG - mode preview langsung...");
    try {
      // Tunggu font 100% ke-load biar preview = export
      try {
        // @ts-ignore
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      } catch {}
      // Kasih jeda biar render stabil
      await new Promise(r => setTimeout(r, 300));

      const htmlToImage = await ensureHtmlToImage();
      // CARA 1: Langsung foto preview apa adanya - 100% identik
      const dataUrl = await htmlToImage.toJpeg(el, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 3, // high res biar tajam
        cacheBust: true,
        // style agar tidak ada shift
        style: {
          margin: "0",
        }
      });

      if (imgWin && !imgWin.closed) {
        const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${invoiceNo}</title><style>body{margin:0;background:#000;color:#fff;font-family:-apple-system,Inter,sans-serif} img{width:100%;display:block;background:#fff} .hint{text-align:center;padding:14px 16px;font-size:14px;line-height:1.4;background:#0f172a} .hint b{color:#22c55e}</style></head><body><img src="${dataUrl}" alt="${invoiceNo}"><p class="hint">✅ Hasil 100% sama dengan preview<br/>Tekan lama gambar → <b>Add to Photos / Save Image</b></p></body></html>`;
        try {
          imgWin.document.open();
          imgWin.document.write(html);
          imgWin.document.close();
          imgWin.focus();
        } catch {
          try { imgWin.location.href = dataUrl; } catch {}
        }
      } else {
        const fallbackWin = window.open();
        if (fallbackWin) {
          const html = `<html><head><meta name="viewport" content="width=device-width"><title>${invoiceNo}</title></head><body style="margin:0;background:#000"><img src="${dataUrl}" style="width:100%;display:block"><p style="color:white;text-align:center;font-family:sans-serif;padding:12px">Tekan lama gambar → Add to Photos</p></body></html>`;
          fallbackWin.document.write(html);
          fallbackWin.document.close();
        }
      }
      try {
        const nav: any = navigator;
        if (nav.share && nav.canShare) {
          const file = dataURLToFile(dataUrl, `${invoiceNo}.jpg`);
          if (nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title: "Invoice " + invoiceNo, text: `Invoice ${invoiceNo}` });
          }
        }
      } catch {}
      try {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${invoiceNo}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch {}
      setExportMsg("JPG 100% sama dengan preview — cek tab baru");
    } catch (e: any) {
      console.error(e);
      setExportMsg("Gagal JPG preview langsung, coba fallback html2canvas...");
      // FALLBACK ke html2canvas kalau html-to-image gagal
      try {
        const html2canvas = await ensureHtml2Canvas();
        const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: "#ffffff", logging: false });
        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const fallbackWin = window.open();
        if (fallbackWin) {
          fallbackWin.document.write(`<html><body style="margin:0"><img src="${dataUrl}" style="width:100%"></body></html>`);
          fallbackWin.document.close();
        }
      } catch {}
      if (imgWin && !imgWin.closed) { try { imgWin.close(); } catch {} }
    } finally {
      setIsExporting(null);
      setTimeout(() => setExportMsg(""), 5000);
    }
  };

  const handleExportPDF = async () => {
    const el = document.getElementById("invoice-a4-capture") || invoiceA4Ref.current;
    if (!el) {
      setExportMsg("Invoice A4 tidak ditemukan");
      setTimeout(() => setExportMsg(""), 3000);
      return;
    }
    let pdfWin: Window | null = null;
    try {
      pdfWin = window.open("", "_blank");
    } catch {}
    if (pdfWin) {
      try {
        pdfWin.document.write(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Memuat PDF...</title><style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}</style></head><body><p>Membuat PDF...</p></body></html>`);
        pdfWin.document.close();
      } catch {}
    }
    setIsExporting("pdf");
    setExportMsg("Membuat PDF...");
    try {
      const [html2canvas, JsPDFCtor] = await Promise.all([ensureHtml2Canvas(), ensureJsPDF()]);
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document) => {
          const clonedEl = clonedDoc.getElementById("invoice-a4-capture") as HTMLElement | null;
          if (clonedEl) {
            clonedEl.style.letterSpacing = "normal";
            clonedEl.style.lineHeight = "1.4";
            clonedEl.style.overflow = "visible";
          }
        },
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new JsPDFCtor("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let finalW = imgW;
      let finalH = imgH;
      if (imgH > pageH) {
        finalH = pageH;
        finalW = (canvas.width * pageH) / canvas.height;
      }
      const x = (pageW - finalW) / 2;
      const y = 0;
      pdf.addImage(imgData, "JPEG", x, y, finalW, finalH);
      const blob = pdf.output("blob");
      const fileName = `${invoiceNo}.pdf`;
      const objectURL = URL.createObjectURL(blob);
      if (pdfWin && !pdfWin.closed) {
        try {
          pdfWin.location.href = objectURL;
          pdfWin.focus();
        } catch {
          const w = window.open(objectURL, "_blank");
          if (w) w.focus();
        }
      } else {
        const w = window.open(objectURL, "_blank");
        if (w) w.focus();
      }
      try {
        const nav: any = navigator;
        if (nav.share && nav.canShare) {
          const file = new File([blob], fileName, { type: "application/pdf" });
          if (nav.canShare({ files: [file] })) {
            await nav.share({ files: [file], title: "Invoice " + invoiceNo });
          }
        }
      } catch {}
      try {
        pdf.save(fileName);
      } catch {}
      setExportMsg("PDF dibuka di tab baru — bagikan / simpan dari preview Safari");
      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectURL);
        } catch {}
      }, 60000);
    } catch (e) {
      setExportMsg("Gagal PDF — butuh internet untuk loader");
      if (pdfWin && !pdfWin.closed) {
        try {
          pdfWin.close();
        } catch {}
      }
    } finally {
      setIsExporting(null);
      setTimeout(() => setExportMsg(""), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]" style={{ paddingTop: "var(--safe-area-inset-top)", boxSizing: "border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        :root {
          --bg: #f8fafc;
          --surface: #ffffff;
          --surface-2: #f1f5f9;
          --line: #e2e8f0;
          --line-strong: #cbd5e1;
          --text: #0f172a;
          --muted: #334155;
          --muted-2: #64748b;
          --primary: #16a34a;
          --primary-soft: #dcfce7;
          --primary-dark: #15803d;
          --radius: 12px;
        }
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        h1,h2,h3,.jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
        input, select { color: #0f172a; }
        input::placeholder { color: #94a3b8; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <header className="sticky top-[var(--safe-area-inset-top)] z-30 backdrop-blur-xl bg-white/95 border-b border-[#e2e8f0]">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={logoAyam} alt="Logo Ayam Potong Banjarmasin" className="w-[38px] h-[38px] object-contain shrink-0" />
            <div className="leading-tight">
              <h1 className="jakarta font-bold text-[14px] tracking-tight text-[#0f172a]">Ayam Potong Banjarmasin</h1>
              <p className="text-[11px] text-[#334155] font-medium">Segar • Halal • Antar Hari Ini</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#15803d] border border-[#bbf7d0]">ONLINE</div>
            <button onClick={() => setInvoiceNo(generateInvoiceNo())} className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] hover:bg-white transition text-[#0f172a]">
              🔄 {invoiceNo.split("-").pop()}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-4 sm:gap-5 items-start pb-[88px]">
        {/* LEFT */}
        <div className="space-y-4">
          <section className="bg-white rounded-[12px] border border-[#e2e8f0] shadow-[0_1px_2px_rgba(15,23,42,0.06)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="jakarta font-bold text-[12px] tracking-wide text-[#0f172a]">DATA PELANGGAN & INVOICE</h2>
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#0f172a] text-white font-bold tracking-wide">{invoiceNo}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-[#334155] uppercase">Nama Pelanggan</span>
                <input value={namaPelanggan} onChange={(e) => setNamaPelanggan(e.target.value)} placeholder="Contoh: Ibu Siti / RM Padang" className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] transition" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-[#334155] uppercase">No HP / WA</span>
                <input value={noHP} onChange={(e) => setNoHP(e.target.value)} placeholder="08xx xxxx xxxx" className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-[#334155] uppercase">Tanggal</span>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[13px] font-medium" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-[#334155] uppercase">No Invoice</span>
                <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-10 rounded-lg border border-[#e2e8f0] bg-[#f1f5f9] px-3 text-[12px] font-mono font-bold text-[#0f172a]" />
              </label>
            </div>
            <div className="mt-3 p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] flex items-center gap-2 text-[11px]">
              <span className="text-[10px] font-bold tracking-widest text-[#334155] uppercase">Pembayaran:</span>
              <span className="font-bold text-[#0f172a]">{REKENING.bank} {REKENING.no}</span>
              <span className="text-[#334155]">
                a.n. <span className="font-bold text-[#0f172a]">{REKENING.an}</span>
              </span>
            </div>
          </section>

          <section className="bg-white rounded-[12px] border border-[#e2e8f0] p-4">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="jakarta font-bold text-[12px] tracking-wide text-[#0f172a]">PILIH PRODUK</h2>
              <span className="text-[10px] text-[#334155] font-medium">Tap tambah • harga auto titik</span>
            </div>
            <div className="space-y-3">
              {CATEGORIES.map((cat) => (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-px flex-1 bg-[#e2e8f0]" />
                    <span className="text-[9px] font-bold tracking-[0.14em] text-[#64748b] uppercase px-2">{cat}</span>
                    <div className="h-px flex-1 bg-[#e2e8f0]" />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PRODUCT_CATALOG.filter((p) => p.category === cat).map((prod) => (
                      <button key={prod.id} onClick={() => addProduct(prod)} className="group text-left flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#e2e8f0] bg-white hover:border-[#16a34a] hover:bg-[#f0fdf4] transition">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold leading-[1.3] truncate text-[#0f172a]">{prod.name}</p>
                          <p className="text-[10px] text-[#334155] mt-0.5 flex items-center gap-1.5">
                            <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded border ${prod.unit === "Kg" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>{prod.unit}</span>
                            <span className="font-bold text-[#0f172a]">{formatRpShort(prod.defaultPrice)}/{prod.unit}</span>
                          </p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-white border border-[#e2e8f0] group-hover:bg-[#16a34a] group-hover:text-white flex items-center justify-center text-[14px] font-bold text-[#0f172a] transition">+</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-px flex-1 bg-[#e2e8f0]" />
                  <span className="text-[9px] font-bold tracking-[0.14em] text-[#64748b] uppercase px-2">PRODUK CUSTOM</span>
                  <div className="h-px flex-1 bg-[#e2e8f0]" />
                </div>
                {!showCustom ? (
                  <button onClick={() => setShowCustom(true)} className="w-full p-2.5 rounded-lg border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-[12px] font-semibold text-[#334155] hover:border-[#16a34a] hover:text-[#15803d] transition">
                    + Produk Custom (nama & Kg/Ekor)
                  </button>
                ) : (
                  <div className="rounded-lg border border-[#16a34a]/30 bg-[#f0fdf4] p-2.5 space-y-2">
                    <div className="grid grid-cols-[1fr_90px] gap-2">
                      <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nama produk custom" className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-3 text-[12px]" />
                      <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value as Unit)} className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-2 text-[12px] font-bold">
                        <option value="Kg">Kg</option>
                        <option value="Ekor">Ekor</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowCustom(false)} className="flex-1 h-9 rounded-lg bg-white border border-[#e2e8f0] text-[12px] font-semibold text-[#0f172a]">
                        Batal
                      </button>
                      <button onClick={addCustomProduct} className="flex-1 h-9 rounded-lg bg-[#16a34a] text-white text-[12px] font-bold hover:bg-[#15803d]">
                        Tambah
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT - COMPACT INVOICE */}
        <div className="lg:sticky lg:top-[72px] space-y-3">
          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-1.5 flex gap-1">
            <button onClick={() => setPreviewTab("thermal")} className={`flex-1 h-8 rounded-lg text-[11px] font-bold tracking-wide transition ${previewTab === "thermal" ? "bg-[#0f172a] text-white" : "bg-[#f1f5f9] text-[#334155] hover:text-[#0f172a]"}`}>
              NOTA THERMAL
            </button>
            <button onClick={() => setPreviewTab("a4")} className={`flex-1 h-8 rounded-lg text-[11px] font-bold tracking-wide transition ${previewTab === "a4" ? "bg-[#0f172a] text-white" : "bg-[#f1f5f9] text-[#334155] hover:text-[#0f172a]"}`}>
              INVOICE A4 COMPACT
            </button>
          </div>

          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-widest text-[#334155] uppercase">EXPORT 1 HALAMAN</p>
              {exportMsg && <span className="text-[10px] font-bold text-[#15803d] bg-[#dcfce7] px-2 py-0.5 rounded-full border border-[#bbf7d0]">{exportMsg}</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExportPDF} disabled={!!isExporting} className="h-10 rounded-lg bg-[#0f172a] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#1e293b] disabled:opacity-60 transition">
                <span>📄</span>
                {isExporting === "pdf" ? "Proses..." : "Export PDF"}
              </button>
              <button onClick={handleExportJPG} disabled={!!isExporting} className="h-10 rounded-lg bg-white border border-[#e2e8f0] text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#f8fafc] disabled:opacity-60 transition text-[#0f172a]">
                <span>🖼️</span>
                {isExporting === "jpg" ? "Proses..." : "Export JPG"}
              </button>
            </div>
            <div className="rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] p-2 flex gap-2 items-start">
              <span className="text-[14px] leading-none">📱</span>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-[#15803d] leading-[1.3]">Di iPhone: tekan lama gambar → Save to Photos</p>
                <p className="text-[9px] text-[#334155] leading-[1.3]">JPG dibuka di tab baru otomatis. Untuk simpan ke galeri, tekan lama gambar sampai muncul <span className="font-bold">Add to Photos / Save Image</span>.</p>
              </div>
            </div>
            <p className="text-[10px] text-[#334155] leading-[1.4]">
              Invoice compact auto-height (overflow visible) — hasil export pasti <span className="font-bold text-[#0f172a]">1 halaman</span> A4: <span className="font-mono font-bold">{invoiceNo}.pdf</span>
            </p>
          </div>

          {previewTab === "thermal" ? (
            <div className="flex justify-center">
              <div id="invoice-thermal-capture" className="w-[300px] bg-white text-[#0f172a] shadow-[0_4px_20px_rgba(0,0,0,0.08)] rounded-[8px] overflow-hidden border border-[#e2e8f0]">
                <div className="p-3 font-mono text-[11px] leading-[1.35]">
                  <div className="flex flex-col items-center text-center gap-1.5 pb-2.5 border-b border-dashed border-[#cbd5e1]">
                    <img src={logoAyam} alt="Logo Ayam Potong Banjarmasin" className="w-9 h-9 object-contain" />
                    <div>
                      <p className="font-bold text-[11px] tracking-tight jakarta text-[#0f172a]">AYAM POTONG BANJARMASIN</p>
                      <p className="text-[9px] text-[#334155] mt-0.5">Segar • Halal • Antar</p>
                    </div>
                  </div>
                  <div className="py-2 space-y-0.5 border-b border-dashed border-[#cbd5e1] text-[#0f172a]">
                    <div className="flex justify-between">
                      <span>No:</span>
                      <span className="font-bold">{invoiceNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tgl:</span>
                      <span>{formatTanggal(tanggal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pel:</span>
                      <span className="max-w-[140px] truncate text-right">{namaPelanggan || "-"}</span>
                    </div>
                    {noHP && (
                      <div className="flex justify-between">
                        <span>HP:</span>
                        <span>{noHP}</span>
                      </div>
                    )}
                  </div>
                  <div className="py-2 space-y-1.5">
                    {items.length === 0 ? (
                      <p className="text-center text-[#64748b] py-1">- belum ada item -</p>
                    ) : (
                      items.map((it) => (
                        <div key={it.id} className="space-y-0">
                          <p className="font-bold leading-[1.3] line-clamp-2 text-[#0f172a] text-[11px]">{it.name}</p>
                          <div className="flex justify-between text-[10px] text-[#0f172a]">
                            <span>
                              {it.qty === "" ? "0" : it.qty} {it.unit} x {formatRupiah(parsePriceNumber(it.price))}
                            </span>
                            <span className="font-bold">{formatRupiah(parseQtyNumber(it.qty) * parsePriceNumber(it.price))}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="pt-2 border-t border-dashed border-[#cbd5e1] space-y-0.5 text-[#0f172a]">
                    <div className="flex justify-between text-[11px]">
                      <span>Subtotal</span>
                      <span className="font-bold">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[12px] pt-1 border-t border-[#0f172a] mt-1">
                      <span>TOTAL</span>
                      <span>{formatRupiah(total)}</span>
                    </div>
                  </div>
                  <div className="mt-2.5 p-2 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] text-center">
                    <p className="text-[9px] font-bold tracking-widest text-[#334155] uppercase">Pembayaran</p>
                    <p className="text-[11px] font-bold text-[#0f172a] mt-0.5">
                      {REKENING.bank} {REKENING.no}
                    </p>
                    <p className="text-[10px] text-[#334155]">
                      a.n. <span className="font-bold text-[#0f172a]">{REKENING.an}</span>
                    </p>
                  </div>
                  <div className="pt-2.5 text-center text-[9px] text-[#334155] leading-[1.35] space-y-1">
                    <p>Terima kasih 🙏 Barang tidak dapat dikembalikan</p>
                    <div className="pt-1.5 mt-1.5 border-t border-dashed border-[#e2e8f0]">
                      <p className="font-bold text-[#0f172a]">
                        Hub: {CONTACTS.wa1} | {CONTACTS.wa2}
                      </p>
                      <p>IG: @{CONTACTS.ig}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              id="invoice-a4-capture"
              ref={invoiceA4Ref}
              className="bg-white text-[#0f172a] rounded-[10px] border border-[#e2e8f0] shadow-[0_4px_20px_rgba(15,23,42,0.06)]"
              style={{ width: "100%", maxWidth: "100%", lineHeight: "1.4", overflow: "visible" }}
            >
              <div className="p-6 flex flex-col" style={{ minHeight: "560px", overflow: "visible" }}>
                {/* PROFESSIONAL HEADER - Balanced */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
                  <div className="flex items-start gap-3 shrink-0">
                    <img src={logoAyam} alt="Logo Ayam Potong Banjarmasin" className="w-[38px] h-[38px] object-contain shrink-0" style={{display:"block"}} />
                    <div className="leading-[1.3]">
                      <h3 className="jakarta font-extrabold text-[13.5px] tracking-tight text-[#0f172a] leading-[1.2]">Ayam Potong Banjarmasin</h3>
                      <p className="text-[10px] text-[#64748b] mt-1 leading-[1.4] font-medium">
                        Jl. A. Yani KM 6 • Banjarmasin<br/>WA {CONTACTS.wa1} • IG @{CONTACTS.ig}
                      </p>
                      <div className="mt-2.5 inline-flex items-center text-[9px] font-extrabold tracking-[0.16em] px-3 py-1.5 rounded-full bg-[#0f172a] text-white leading-none">
                        INVOICE
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 max-w-[55%]">
                    <p className="text-[8.5px] tracking-[0.16em] text-[#64748b] font-bold uppercase">Nomor Invoice</p>
                    <div className="inline-flex items-center bg-[#0f172a] text-white font-mono font-bold text-[12px] tracking-tight px-3.5 py-2 rounded-full whitespace-nowrap leading-none shadow-sm" style={{ whiteSpace: "nowrap" }}>
                      {invoiceNo}
                    </div>
                    <p className="text-[10.5px] text-[#0f172a] font-semibold mt-0.5">{formatTanggal(tanggal)}</p>
                    <p className="text-[9px] text-[#64748b] font-medium">No. HP: {noHP || "-"}</p>
                  </div>
                </div>

                <div className="py-3.5 border-b border-[#f1f5f9]">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <p className="text-[8.5px] tracking-[0.16em] font-extrabold text-[#64748b] uppercase">Kepada Pelanggan</p>
                      <p className="font-bold text-[13.5px] mt-1.5 text-[#0f172a] leading-[1.4] break-words" style={{ wordBreak: "break-word" }}>{namaPelanggan || "Nama Pelanggan"}</p>
                      <p className="text-[10.5px] text-[#334155] mt-1 font-medium">{noHP || "No HP / WA"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8.5px] tracking-[0.16em] font-extrabold text-[#64748b] uppercase">Status</p>
                      <div className="mt-1.5 inline-flex px-2.5 py-1 rounded-full bg-[#dcfce7] text-[#15803d] text-[9px] font-extrabold tracking-wide border border-[#bbf7d0]"></div>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5" style={{ overflow: "visible" }}>
                  <table className="w-full text-[11px] leading-[1.4]" style={{ overflow: "visible" }}>
                    <thead>
                      <tr className="text-[8px] tracking-[0.14em] text-[#94a3b8] uppercase border-b border-[#e2e8f0] h-[28px]">
                        <th className="text-left font-bold py-0 px-2">Produk</th>
                        <th className="text-center font-bold py-0 w-[56px]">Jml</th>
                        <th className="text-right font-bold py-0 w-[80px]">Harga</th>
                        <th className="text-right font-bold py-0 w-[88px] pr-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-[#64748b] text-[11px]">
                            Belum ada produk dipilih
                          </td>
                        </tr>
                      ) : (
                        items.map((it) => (
                          <tr key={it.id} className="border-b border-[#f1f5f9] min-h-[28px]">
                            <td className="py-1.5 px-1 align-top">
                              <p className="font-bold text-[11px] leading-[1.4] text-[#0f172a] break-words" style={{ wordBreak: "break-word", overflow: "visible" }}>{it.name}</p>
                            </td>
                            <td className="py-1.5 text-center font-semibold text-[11px] text-[#0f172a] leading-[1.4] align-top">
                              {it.qty === "" ? "0" : it.qty} {it.unit}
                            </td>
                            <td className="py-1.5 text-right text-[10px] text-[#0f172a] leading-[1.4] align-top">{formatRupiah(parsePriceNumber(it.price))}</td>
                            <td className="py-1.5 text-right font-bold text-[11px] pr-1 text-[#0f172a] leading-[1.4] align-top">{formatRupiah(parseQtyNumber(it.qty) * parsePriceNumber(it.price))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="w-[200px] space-y-1.5 py-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#64748b]">Subtotal</span>
                      <span className="font-medium text-[#0f172a]">{formatRupiah(subtotal)}</span>
                    </div>
                    <div className="h-px bg-[#f1f5f9]" />
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-[11px] text-[#0f172a]">TOTAL</span>
                      <span className="font-bold text-[13px] text-[#0f172a]">{formatRupiah(total)}</span>
                    </div>
                  </div>
                </div>

                {/* PAYMENT & CONTACT - Simple bottom, small, A4 */}
                <div className="mt-auto pt-8">
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#f1f5f9]">
                    <div className="rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-3">
                      <p className="text-[8px] font-bold tracking-[0.14em] text-[#64748b] uppercase">Pembayaran</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="inline-grid place-items-center rounded-[8px] bg-[#0f172a] text-white text-[9px] font-bold tracking-wide" style={{height:"22px", minWidth:"42px", lineHeight:"22px"}}>{REKENING.bank}</span>
                        <span className="font-mono font-bold text-[11px] text-[#0f172a]">{REKENING.no}</span>
                      </div>
                      <p className="text-[9px] text-[#334155] mt-1.5">a.n. <span className="font-bold text-[#0f172a]">{REKENING.an}</span></p>
                    </div>
                    <div className="rounded-lg bg-white border border-[#e2e8f0] p-3">
                      <p className="text-[8px] font-bold tracking-[0.14em] text-[#64748b] uppercase">Hubungi Toko</p>
                      <p className="text-[9px] font-bold text-[#0f172a] mt-1.5">{CONTACTS.wa1} • {CONTACTS.wa2}</p>
                      <p className="text-[9px] text-[#64748b] mt-1">IG @{CONTACTS.ig}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-[12px]"></div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#f1f5f9] h-[8px]" style={{ overflow: "visible" }}></div>
              </div>
              <div className="h-1 bg-[#16a34a] rounded-b-[10px]" style={{ overflow: "visible" }} />
            </div>
          )}

          <div className="bg-white rounded-[12px] border border-[#e2e8f0] p-3">
            <p className="text-[10px] font-bold tracking-widest text-[#334155] uppercase mb-2">Preview Teks WhatsApp</p>
            <pre className="whitespace-pre-wrap break-words text-[11px] leading-[1.35] font-mono bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3 max-h-[200px] overflow-auto text-[#0f172a]">{waText}</pre>
          </div>
        </div>
      </main>

      {/* Floating cart bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#e2e8f0] shadow-[0_-4px_24px_rgba(15,23,42,0.12)]">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-full bg-[#0f172a] text-white flex items-center justify-center shrink-0">
              <span className="text-[16px]">🛒</span>
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#16a34a] text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                  {items.length}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold leading-none text-[#0f172a] truncate">
                {items.length === 0 ? "Keranjang kosong" : `${items.length} produk • ${formatRupiah(total)}`}
              </p>
              <p className="text-[10px] text-[#64748b] mt-1 leading-none truncate">
                {items.length === 0 ? "Pilih produk di atas" : `Subtotal ${formatRupiah(subtotal)} • ${items.map((i) => `${i.qty || "0"} ${i.unit}`).slice(0, 2).join(", ")}${items.length > 2 ? "…" : ""}`}
              </p>
            </div>
          </div>
          <button onClick={() => setCartOpen(true)} className="shrink-0 h-[42px] px-4 sm:px-5 rounded-full bg-[#0f172a] text-white text-[12px] font-bold flex items-center gap-2 hover:bg-[#1e293b] transition">
            <span>{items.length ? "Lihat Rincian" : "Buka Keranjang"}</span>
            <span className="text-[14px]">{cartOpen ? "⌄" : "⌃"}</span>
          </button>
        </div>
      </div>

      {/* Cart Drawer / Bottom Sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setCartOpen(false)} style={{ animation: "fadeIn 0.2s ease" }} />
          <div
            className="relative bg-white w-full sm:max-w-[440px] h-[86vh] sm:h-full rounded-t-[20px] sm:rounded-l-[20px] sm:rounded-tr-none shadow-[0_-8px_40px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden self-end sm:self-auto"
            style={{ animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}
          >
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-[#e2e8f0]" />
            </div>
            <div className="px-4 sm:px-5 h-[56px] flex items-center justify-between border-b border-[#e2e8f0] shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center">🛒</div>
                <div>
                  <h3 className="jakarta font-bold text-[13px] text-[#0f172a] leading-none">Rincian Pesanan</h3>
                  <p className="text-[10px] text-[#64748b] mt-1">{items.length} produk • {formatRupiah(total)}</p>
                </div>
              </div>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center text-[#0f172a] hover:bg-[#0f172a] hover:text-white transition">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2 bg-[#f8fafc]">
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-white border border-[#e2e8f0] mx-auto flex items-center justify-center text-[24px]">🛒</div>
                  <p className="text-[13px] font-bold text-[#0f172a] mt-4">Belum ada produk</p>
                  <p className="text-[11px] text-[#64748b] mt-1">Tap + pada daftar produk untuk menambahkan</p>
                </div>
              ) : (
                items.map((it) => (
                  <div key={it.id} className="bg-white rounded-[12px] border border-[#e2e8f0] p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold leading-[1.3] text-[#0f172a]">{it.name}</p>
                        <p className="text-[10px] text-[#334155] mt-0.5 flex items-center gap-1.5">
                          <span className={`inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded border ${it.unit === "Kg" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"}`}>{it.unit}</span>
                          <span>Editable</span>
                        </p>
                      </div>
                      <button onClick={() => removeItem(it.id)} className="w-7 h-7 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[12px] text-[#64748b] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition shrink-0">
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-[88px_1fr_96px] gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold tracking-widest text-[#334155] uppercase">Jml ({it.unit})</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={it.qty}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const sanitized = sanitizeDecimalInput(raw);
                            if (sanitized === null) return;
                            updateItem(it.id, { qty: sanitized });
                          }}
                          onBlur={() => {
                            if (it.qty === ".") updateItem(it.id, { qty: "" });
                          }}
                          className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-2 text-[13px] font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a]"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold tracking-widest text-[#334155] uppercase">Harga/{it.unit} (auto titik)</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#64748b]">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={formatRibuan(it.price)}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              updateItem(it.id, { price: digits });
                            }}
                            className="h-10 rounded-lg border border-[#e2e8f0] bg-white pl-7 pr-2 text-[13px] font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#16a34a]/20 focus:border-[#16a34a] w-full"
                          />
                        </div>
                      </label>
                      <div className="flex flex-col gap-1 justify-end">
                        <span className="text-[9px] font-bold tracking-widest text-[#334155] uppercase">Subtotal</span>
                        <div className="h-10 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] px-2 flex items-center text-[11px] font-bold text-[#15803d]">{formatRupiah(parseQtyNumber(it.qty) * parsePriceNumber(it.price))}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 bg-white border-t border-[#e2e8f0] p-4 space-y-3">
              <div className="rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] p-3 space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#334155] font-medium">Subtotal</span>
                  <span className="font-bold text-[#0f172a]">{formatRupiah(subtotal)}</span>
                </div>
                <div className="h-px bg-[#e2e8f0]" />
                <div className="flex justify-between text-[14px]">
                  <span className="font-bold jakarta text-[#0f172a]">TOTAL</span>
                  <span className="font-bold text-[#15803d] jakarta">{formatRupiah(total)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleExportPDF} disabled={!!isExporting} className="h-11 rounded-[10px] bg-[#0f172a] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#1e293b] disabled:opacity-60 transition">
                  <span>📄</span>
                  {isExporting === "pdf" ? "Proses..." : "Export PDF"}
                </button>
                <button onClick={handleExportJPG} disabled={!!isExporting} className="h-11 rounded-[10px] bg-white border border-[#e2e8f0] text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#f8fafc] disabled:opacity-60 transition text-[#0f172a]">
                  <span>🖼️</span>
                  {isExporting === "jpg" ? "Proses..." : "Export JPG"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleCopyWa} className="h-11 rounded-[10px] bg-white border border-[#e2e8f0] text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#f8fafc] transition text-[#0f172a]">
                  {waCopied ? "✓ Tersalin" : "📋 Salin WA"}
                </button>
                <button onClick={handleWaShare} className="h-11 rounded-[10px] bg-[#25D366] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#1ebe5a] transition">
                  WhatsApp
                </button>
              </div>
              <p className="text-[10px] text-center text-[#64748b] leading-[1.3]">Harga otomatis titik ribuan • Qty desimal tetap • Klik backdrop / X untuk tutup</p>
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-[1120px] mx-auto px-4 sm:px-6 pb-[88px] pt-4 text-center text-[11px] text-[#334155]">
        <div className="inline-flex flex-col sm:flex-row gap-1 sm:gap-2 items-center justify-center bg-white border border-[#e2e8f0] rounded-full px-4 py-2 shadow-sm">
          <span className="font-semibold text-[#0f172a]">© {new Date().getFullYear()} Ayam Potong Banjarmasin</span>
          <span className="hidden sm:inline text-[#cbd5e1]">•</span>
          <span className="font-bold text-[#0f172a]">BRI {REKENING.no} a.n. {REKENING.an}</span>
          <span className="hidden sm:inline text-[#cbd5e1]">•</span>
          <span className="font-medium">📞 {CONTACTS.wa1} | {CONTACTS.wa2}</span>
          <span className="hidden sm:inline text-[#cbd5e1]">•</span>
          <span>IG @{CONTACTS.ig}</span>
        </div>
      </footer>
    </div>
  );
}
