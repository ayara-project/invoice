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
  an: "Ayam Potong Banjarmasin",
  an_full: "Ayam Potong Banjarmasin (A.n Ayara Project)",
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
      lines.push(`${idx + 1}. ${it.name} (${qtyDisplay} ${it.unit} x ${formatRupiah(p)} = ${formatRupiah(lt)})`);
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
    setIsExporting("jpg");
    setExportMsg("Membuat JPG...");
    try {
      const html2canvas = await ensureHtml2Canvas();
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${invoiceNo}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setExportMsg("JPG berhasil diunduh!");
    } catch (e) {
      setExportMsg("Gagal membuat JPG");
    } finally {
      setIsExporting(null);
      setTimeout(() => setExportMsg(""), 4000);
    }
  };

  const handleExportPDF = async () => {
    const el = document.getElementById("invoice-a4-capture") || invoiceA4Ref.current;
    if (!el) {
      setExportMsg("Invoice A4 tidak ditemukan");
      setTimeout(() => setExportMsg(""), 3000);
      return;
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
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new JsPDFCtor("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
      pdf.save(`${invoiceNo}.pdf`);
      setExportMsg("PDF berhasil diunduh!");
    } catch (e) {
      setExportMsg("Gagal membuat PDF");
    } finally {
      setIsExporting(null);
      setTimeout(() => setExportMsg(""), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] p-4 sm:p-6">
      <header className="max-w-[1120px] mx-auto mb-6 flex items-center justify-between bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-sm">
        <div className="flex items-center gap-3">
          <img src={logoAyam} alt="Logo" className="w-10 h-10 object-contain" />
          <div>
            <h1 className="font-bold text-base text-[#0f172a]">Ayam Potong Banjarmasin</h1>
            <p className="text-xs text-[#64748b]">Sistem Pembuatan Invoice Profesional</p>
          </div>
        </div>
        <button onClick={() => setInvoiceNo(generateInvoiceNo())} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] hover:bg-[#e2e8f0] transition">
          🔄 No. Baru
        </button>
      </header>

      <main className="max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KOLOM KIRI: INPUT & KATALOG */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
            <h2 className="font-bold text-sm mb-3 text-[#0f172a]">DATA PELANGGAN</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#64748b]">Nama Pelanggan</span>
                <input value={namaPelanggan} onChange={(e) => setNamaPelanggan(e.target.value)} placeholder="Contoh: Rusniawati" className="h-10 rounded-lg border border-[#e2e8f0] px-3 text-sm focus:outline-none focus:border-[#16a34a]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#64748b]">No HP / WA</span>
                <input value={noHP} onChange={(e) => setNoHP(e.target.value)} placeholder="08xx xxxx xxxx" className="h-10 rounded-lg border border-[#e2e8f0] px-3 text-sm focus:outline-none focus:border-[#16a34a]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#64748b]">Tanggal</span>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-10 rounded-lg border border-[#e2e8f0] px-3 text-sm focus:outline-none focus:border-[#16a34a]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[#64748b]">No Invoice</span>
                <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="h-10 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-mono font-bold" />
              </label>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-[#e2e8f0] p-4 shadow-sm">
            <h2 className="font-bold text-sm mb-3 text-[#0f172a]">KATALOG PRODUK</h2>
            <div className="space-y-4">
              {CATEGORIES.map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-bold text-[#64748b] mb-2 uppercase tracking-wider">{cat}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {PRODUCT_CATALOG.filter((p) => p.category === cat).map((prod) => (
                      <button key={prod.id} onClick={() => addProduct(prod)} className="flex items-center justify-between p-2.5 rounded-lg border border-[#e2e8f0] hover:border-[#16a34a] hover:bg-[#f0fdf4] transition text-left">
                        <div>
                          <p className="text-xs font-semibold text-[#0f172a]">{prod.name}</p>
                          <p className="text-[11px] text-[#64748b]">{formatRpShort(prod.defaultPrice)} / {prod.unit}</p>
                        </div>
                        <span className="w-6 h-6 rounded-full bg-[#16a34a] text-white flex items-center justify-center text-xs font-bold">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* KOLOM KANAN: PREVIEW INVOICE A4 PROFESIONAL */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={handleExportPDF} className="flex-1 h-10 rounded-lg bg-[#0f172a] text-white text-xs font-bold hover:bg-[#1e293b] transition">
              📄 Download PDF
            </button>
            <button onClick={handleExportJPG} className="flex-1 h-10 rounded-lg bg-white border border-[#e2e8f0] text-xs font-bold hover:bg-[#f8fafc] transition">
              🖼️ Download JPG
            </button>
            <button onClick={handleWaShare} className="flex-1 h-10 rounded-lg bg-[#16a34a] text-white text-xs font-bold hover:bg-[#15803d] transition">
              💬 Kirim WA
            </button>
          </div>
          {exportMsg && <p className="text-xs text-center font-semibold text-[#16a34a]">{exportMsg}</p>}

          {/* DOKUMEN INVOICE A4 */}
          <div ref={invoiceA4Ref} id="invoice-a4-capture" className="bg-white text-[#0f172a] p-8 rounded-xl border border-[#e2e8f0] shadow-md space-y-6">
            {/* Header Invoice */}
            <div className="flex justify-between items-start border-b border-[#e2e8f0] pb-6">
              <div className="flex items-center gap-3">
                <img src={logoAyam} alt="Logo" className="w-12 h-12 object-contain" />
                <div>
                  <h2 className="font-bold text-lg text-[#0f172a]">Ayam Potong Banjarmasin</h2>
                  <p className="text-xs text-[#64748b]">Jl. A. Yani KM 6 • Banjarmasin</p>
                  <p className="text-xs text-[#64748b]">WA: 0877-5208-2402</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-[#0f172a] text-white text-xs font-bold rounded-full mb-2">INVOICE</span>
                <p className="font-mono font-bold text-sm text-[#0f172a]">{invoiceNo}</p>
                <p className="text-xs text-[#64748b]">{formatTanggal(tanggal)}</p>
              </div>
            </div>

            {/* Kepada */}
            <div>
              <p className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Kepada:</p>
              <p className="font-bold text-sm text-[#0f172a]">{namaPelanggan || "Nama Pelanggan"}</p>
              {noHP && <p className="text-xs text-[#64748b]">{noHP}</p>}
            </div>

            {/* Tabel Produk */}
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-[11px] text-[#64748b] uppercase">
                  <th className="pb-2 font-bold">Produk</th>
                  <th className="pb-2 font-bold text-center">Jml</th>
                  <th className="pb-2 font-bold text-right">Harga</th>
                  <th className="pb-2 font-bold text-right">Total</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-xs">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-[#64748b]">Belum ada produk dipilih. Silakan klik dari katalog di kiri.</td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const lineTotal = parseQtyNumber(item.qty) * parsePriceNumber(item.price);
                    return (
                      <tr key={item.id} className="group">
                        <td className="py-3 font-medium text-[#0f172a]">{item.name}</td>
                        <td className="py-3 text-center">
                          <input
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, { qty: e.target.value })}
                            className="w-16 h-8 text-center border border-[#e2e8f0] rounded text-xs font-medium"
                          />{" "}
                          <span className="text-[10px] text-[#64748b]">{item.unit}</span>
                        </td>
                        <td className="py-3 text-right">
                          <input
                            value={item.price}
                            onChange={(e) => updateItem(item.id, { price: formatRibuan(e.target.value) })}
                            className="w-24 h-8 text-right border border-[#e2e8f0] rounded text-xs px-2 font-medium"
                          />
                        </td>
                        <td className="py-3 text-right font-semibold text-[#0f172a]">{formatRupiah(lineTotal)}</td>
                        <td className="py-3 text-center">
                          <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 font-bold px-1">×</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Total & Subtotal */}
            <div className="border-t border-[#e2e8f0] pt-4 space-y-2">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Subtotal</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#16a34a]">
                <span>TOTAL</span>
                <span>{formatRupiah(total)}</span>
              </div>
            </div>

            {/* Kotak Informasi Pembayaran & Kontak */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#e2e8f0]">
              <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] space-y-1">
                <p className="text-[10px] font-bold text-[#64748b] uppercase">Pembayaran Transfer</p>
                <p className="text-xs font-bold text-[#0f172a]">{REKENING.bank} {REKENING.no}</p>
                <p className="text-[11px] text-[#64748b]">a.n. <strong className="text-[#0f172a]">{REKENING.an}</strong></p>
                <p className="text-[10px] text-[#16a34a] font-medium">Konfirmasi WA setelah transfer</p>
              </div>
              <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] space-y-1">
                <p className="text-[10px] font-bold text-[#64748b] uppercase">Hubungi Kami</p>
                <p className="text-xs font-medium text-[#0f172a]">{CONTACTS.wa1} / {CONTACTS.wa2}</p>
                <p className="text-[11px] text-[#64748b]">IG: @{CONTACTS.ig}</p>
              </div>
            </div>

            {/* Footer Nota */}
            <div className="text-center text-[10px] text-[#64748b] pt-4 border-t border-[#e2e8f0]">
              Terima kasih — Simpan sebagai bukti pembayaran. Ayam segar potong hari ini.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
