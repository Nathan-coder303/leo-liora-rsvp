"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cinzel, Cormorant_Garamond } from "next/font/google";

const display = Cinzel({ weight: ["400","700"], subsets: ["latin"] });
const serif   = Cormorant_Garamond({ weight: ["400","500"], subsets: ["latin"] });

const GOLD     = "#c8a84a";
const GOLD_DIM = "#a88a32";
const DARK     = "#111008";
const BLACK    = "#080808";

type Payment = { amount: number; date: string; by: string };
type Item = { id: string; item: string; amount: number; perPerson?: boolean; note?: string; paid?: number; paidBy?: string; payments?: Payment[] };

const PAID_BY_OPTIONS = ["Baruh", "Leo", "Liora"];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
// Sum a payment list; the item's "paid" is derived from its payments.
function paidOf(it: { payments?: Payment[]; paid?: number }): number {
  if (it.payments && it.payments.length) return it.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return it.paid ?? 0;
}
// Human-readable date for a payment (accepts YYYY-MM-DD); blank if none.
function fmtDate(d: string): string {
  if (!d) return "";
  const t = Date.parse(d);
  if (Number.isNaN(t)) return d;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const DEFAULT_ITEMS: Item[] = [
  { id: "photographer",     item: "Photographer",         amount: 3300 },
  { id: "venue",            item: "Venue",                amount: 6000 },
  { id: "flowers",          item: "Flowers",              amount: 3000 },
  { id: "dj",               item: "DJ",                   amount: 4500 },
  { id: "chuppa",           item: "Chuppa",               amount: 1000 },
  { id: "kippot",           item: "Kippot",               amount: 500  },
  { id: "catering",         item: "Catering",             amount: 120,  perPerson: true, note: "× attending people" },
  { id: "catering-fee",     item: "Catering service fee", amount: 2500 },
];

const STORAGE_KEY = "leo-liora-budget-items-v2";

function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function BudgetPage() {
  const [attendingPeople, setAttendingPeople] = useState(0);
  const [invitedPeople,   setInvitedPeople]   = useState(0);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState("");

  const [items,       setItems]       = useState<Item[]>([]);
  const [addOpen,     setAddOpen]     = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newAmount,   setNewAmount]   = useState("");
  const [newPerPerson,setNewPerPerson]= useState(false);
  const [newPaid,     setNewPaid]     = useState("");
  const [newPaidBy,   setNewPaidBy]   = useState("");
  const [newPaidDate, setNewPaidDate] = useState("");

  // Edit state
  const [editId,        setEditId]        = useState<string | null>(null);
  const [editName,      setEditName]      = useState("");
  const [editAmount,    setEditAmount]    = useState("");
  const [editPerPerson, setEditPerPerson] = useState(false);
  const [editPayments,  setEditPayments]  = useState<Payment[]>([]);

  async function loadItems() {
    const res = await fetch("/api/budget");
    if (!res.ok) throw new Error("Failed to load budget");
    const data = await res.json();
    return data.items as Item[];
  }

  // Initial load — fetch from API; seed defaults if Sheet is empty
  useEffect(() => {
    (async () => {
      try {
        let serverItems = await loadItems();
        if (serverItems.length === 0) {
          // Seed with defaults (one-time)
          await Promise.all(DEFAULT_ITEMS.map(it =>
            fetch("/api/budget", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(it) })
          ));
          serverItems = await loadItems();
        }
        setItems(serverItems);
      } catch {
        setError(prev => prev || "Failed to load budget.");
      }
    })();
  }, []);

  async function handleAdd() {
    const name   = newName.trim();
    const amount = parseFloat(newAmount);
    if (!name || !Number.isFinite(amount) || amount <= 0) return;
    const paidNum = parseFloat(newPaid);
    const payments: Payment[] = Number.isFinite(paidNum) && paidNum > 0
      ? [{ amount: paidNum, date: newPaidDate || todayISO(), by: newPaidBy.trim() }]
      : [];
    const newItem: Item = {
      id: Date.now().toString(36),
      item: name, amount, perPerson: newPerPerson,
      payments,
      paid: payments.reduce((s, p) => s + p.amount, 0),
      paidBy: newPaidBy.trim(),
    };
    setItems(prev => [...prev, newItem]);
    setNewName(""); setNewAmount(""); setNewPerPerson(false); setNewPaid(""); setNewPaidBy(""); setNewPaidDate(""); setAddOpen(false);
    try {
      await fetch("/api/budget", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(newItem) });
    } catch { setError("Save failed."); }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this expense?")) return;
    setItems(prev => prev.filter(i => i.id !== id));
    setEditId(null);
    try {
      await fetch(`/api/budget?id=${encodeURIComponent(id)}`, { method:"DELETE" });
    } catch { setError("Delete failed."); }
  }

  function startEdit(it: Item) {
    setEditId(it.id);
    setEditName(it.item);
    setEditAmount(String(it.amount));
    setEditPerPerson(!!it.perPerson);
    // Load existing payments, synthesizing one from a legacy single "paid" value if needed
    const pmts = it.payments && it.payments.length
      ? it.payments.map(p => ({ ...p }))
      : (it.paid && it.paid > 0 ? [{ amount: it.paid, date: "", by: it.paidBy ?? "" }] : []);
    setEditPayments(pmts);
  }

  function addEditPayment() {
    setEditPayments(prev => [...prev, { amount: 0, date: todayISO(), by: "" }]);
  }
  function updateEditPayment(idx: number, patch: Partial<Payment>) {
    setEditPayments(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }
  function removeEditPayment(idx: number) {
    setEditPayments(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveEdit() {
    if (!editId) return;
    const name   = editName.trim();
    const amount = parseFloat(editAmount);
    if (!name || !Number.isFinite(amount) || amount < 0) return;
    // Keep only payments with a real amount
    const payments = editPayments
      .map(p => ({ amount: Number(p.amount) || 0, date: p.date || "", by: (p.by || "").trim() }))
      .filter(p => p.amount > 0);
    const updated: Item = {
      id: editId, item: name, amount, perPerson: editPerPerson,
      payments,
      paid: payments.reduce((s, p) => s + p.amount, 0),
      paidBy: [...new Set(payments.map(p => p.by).filter(Boolean))].join(", "),
    };
    setItems(prev => prev.map(i => i.id === editId ? { ...i, ...updated } : i));
    setEditId(null);
    try {
      await fetch("/api/budget", { method:"PUT", headers:{"Content-Type":"application/json"}, body: JSON.stringify(updated) });
    } catch { setError("Save failed."); }
  }

  async function resetDefaults() {
    if (!confirm("Reset all expenses to the original defaults? Any custom items will be removed.")) return;
    // Delete current then re-add defaults
    await Promise.all(items.map(i => fetch(`/api/budget?id=${encodeURIComponent(i.id)}`, { method:"DELETE" })));
    await Promise.all(DEFAULT_ITEMS.map(it =>
      fetch("/api/budget", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(it) })
    ));
    setItems(await loadItems());
  }

  async function importFromLocal() {
    let local: Item[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) local = JSON.parse(raw);
    } catch {}
    if (!local.length) return alert("No items found on this device to import.");
    if (!confirm(`Import ${local.length} expense${local.length>1?"s":""} from this device to the synced budget? Existing items with the same name will be skipped.`)) return;
    const existingNames = new Set(items.map(i => i.item.trim().toLowerCase()));
    const toAdd = local.filter(i => !existingNames.has(i.item.trim().toLowerCase()));
    await Promise.all(toAdd.map(it =>
      fetch("/api/budget", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ...it, id: `${it.id}-imported-${Date.now()}` }) })
    ));
    setItems(await loadItems());
    alert(`Imported ${toAdd.length} expense${toAdd.length!==1?"s":""}.`);
  }

  function downloadCSV() {
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const today = new Date().toISOString().split("T")[0];
    const headers = ["Item","Rate","Per Person","Subtotal","Paid","Balance","Paid By","Payments"];
    const csvRows = lines.map(l => [
      l.item,
      String(l.amount),
      l.perPerson ? "Yes" : "No",
      String(l.subtotal),
      String(l.paid ?? 0),
      String(l.balance),
      l.paidBy ?? "",
      (l.payments ?? []).map(p => `${money(p.amount)}${p.date ? ` on ${fmtDate(p.date)}` : ""}${p.by ? ` (${p.by})` : ""}`).join("; "),
    ].map(esc).join(","));
    const csv = [
      esc(`Leo & Liora — Wedding Budget Statement`),
      esc(`Date: ${today}`),
      esc(`Attending: ${attendingPeople} people · Invited: ${invitedPeople} people`),
      "",
      headers.map(esc).join(","),
      ...csvRows,
      "",
      [esc("TOTAL"), "", "", esc(String(total)), esc(String(totalPaid)), esc(String(totalBalance)), "", ""].join(","),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leo-liora-budget-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printStatement() {
    window.print();
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/guests");
        if (!res.ok) throw new Error();
        const data = await res.json();
        // Head count comes from the Mr/Mrs titles (same rule as the Guests tab): both = 2, single = 1, none = 0.
        const heads = (g: { titleOverride?: string }) => {
          const t = (g.titleOverride || "").toLowerCase();
          if (t === "mr" || t === "mrs") return 1;
          if (t === "none") return 0;
          return 2;
        };
        const attending = data.guests
          .filter((g: { effectiveStatus: string }) => g.effectiveStatus === "attending")
          .reduce((sum: number, g: { titleOverride?: string }) => sum + heads(g), 0);
        const invited = data.guests
          .filter((g: { effectiveStatus: string }) => g.effectiveStatus !== "removed")
          .reduce((sum: number, g: { titleOverride?: string }) => sum + heads(g), 0);
        setAttendingPeople(attending);
        setInvitedPeople(invited);
      } catch { setError("Failed to load attending count."); }
      finally { setLoading(false); }
    })();
  }, []);

  const lines = items.map(item => {
    const subtotal = item.perPerson ? item.amount * attendingPeople : item.amount;
    const paid     = paidOf(item);
    const balance  = subtotal - paid;
    return { ...item, subtotal, paid, balance };
  });

  const total          = lines.reduce((s, l) => s + l.subtotal, 0);
  const totalPaid      = lines.reduce((s, l) => s + l.paid, 0);
  const totalBalance   = lines.reduce((s, l) => s + l.balance, 0);
  const projectedTotal = lines.reduce((s, l) => s + (l.perPerson ? l.amount * invitedPeople : l.subtotal), 0);

  // Per-payer rollup — total contributed by each person across every payment
  const byPayer = (() => {
    const map = new Map<string, number>();
    for (const it of items) {
      for (const p of it.payments ?? []) {
        const key = (p.by || "").trim() || "Unassigned";
        map.set(key, (map.get(key) || 0) + (Number(p.amount) || 0));
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const payerColor = (name: string) =>
    name === "Baruh" ? "#7dc87d" : name === "Leo" ? "#88aadd" : name === "Liora" ? "#c78ad9" : GOLD_DIM;

  const tabBtn = (label: string, href: string, active: boolean) => (
    <Link href={href} style={{
      padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
      fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
      background: active ? GOLD : "transparent",
      color: active ? BLACK : GOLD_DIM,
      border:`1px solid ${active ? GOLD : GOLD_DIM}`, transition:"all 0.2s",
    }}>{label}</Link>
  );

  return (
    <div className={serif.className} style={{ minHeight:"100vh", backgroundColor:BLACK, color:GOLD, padding:"2rem 1rem" }}>
      <style>{`
        * { box-sizing:border-box; }
        @media print {
          html, body { background:white !important; }
          body, body * { color:#000 !important; }
          .no-print { display:none !important; }
          .print-table { border-color:#444 !important; }
          .print-bg-light { background:#f3f3f3 !important; }
          .print-bg-none { background:transparent !important; }
        }
      `}</style>

      <div style={{ maxWidth:780, margin:"0 auto 1.25rem" }}>
        <p className={display.className} style={{ fontSize:"clamp(1.1rem,3.5vw,1.8rem)", letterSpacing:"0.15em", marginBottom:"0.25rem" }}>LEO &amp; LIORA</p>
        <p style={{ color:GOLD_DIM, fontSize:"0.75rem", letterSpacing:"0.1em", fontVariant:"small-caps" }}>Wedding Budget · August 13, 2026</p>
        <div style={{ height:1, backgroundColor:GOLD_DIM, opacity:0.25, marginTop:"0.9rem" }} />
      </div>

      <div style={{ maxWidth:780, margin:"0 auto" }}>
        {/* Tabs */}
        <div className="no-print" style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem" }}>
          {tabBtn("Guests", "/guests", false)}
          {tabBtn("Send",   "/send-it", false)}
          {tabBtn("Budget", "/budget", true)}
          {tabBtn("Baruh",  "/baruh", false)}
          {tabBtn("Calendar", "/calendar", false)}
        </div>

        {/* People counts */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"0.65rem", marginBottom:"1.75rem" }}>
          <div style={{ backgroundColor:DARK, border:`1px solid ${GOLD_DIM}`, padding:"0.8rem", textAlign:"center" }}>
            <p style={{ fontSize:"clamp(1.2rem,4vw,2rem)", color:"#7dc87d", fontWeight:600, lineHeight:1 }}>{attendingPeople}</p>
            <p style={{ fontSize:"0.63rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginTop:"0.25rem" }}>Attending (people)</p>
          </div>
          <div style={{ backgroundColor:DARK, border:`1px solid ${GOLD_DIM}`, padding:"0.8rem", textAlign:"center" }}>
            <p style={{ fontSize:"clamp(1.2rem,4vw,2rem)", color:GOLD, fontWeight:600, lineHeight:1 }}>{invitedPeople}</p>
            <p style={{ fontSize:"0.63rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginTop:"0.25rem" }}>Invited (people)</p>
          </div>
        </div>

        {/* Add expense button + form */}
        <div className="no-print" style={{ marginBottom:"1rem" }}>
          <div style={{ display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap" }}>
            <button onClick={() => setAddOpen(o => !o)} style={{
              padding:"0.4rem 1rem", cursor:"pointer", fontSize:"0.75rem", fontVariant:"small-caps",
              letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
              background: addOpen ? GOLD : "transparent", color: addOpen ? BLACK : GOLD,
              border:`1px solid ${GOLD}`, transition:"all 0.2s" }}>
              + Add Expense
            </button>
            <button onClick={downloadCSV} style={{
              padding:"0.4rem 0.9rem", cursor:"pointer", fontSize:"0.72rem", fontVariant:"small-caps",
              letterSpacing:"0.07em", fontFamily:serif.style.fontFamily, whiteSpace:"nowrap",
              background:"transparent", color:GOLD, border:`1px solid ${GOLD_DIM}` }}>
              ↓ CSV
            </button>
            <button onClick={printStatement} style={{
              padding:"0.4rem 0.9rem", cursor:"pointer", fontSize:"0.72rem", fontVariant:"small-caps",
              letterSpacing:"0.07em", fontFamily:serif.style.fontFamily, whiteSpace:"nowrap",
              background:"transparent", color:GOLD, border:`1px solid ${GOLD_DIM}` }}>
              🖨 Print / PDF
            </button>
            <button onClick={importFromLocal} title="Import items saved on this device's browser into the shared budget" style={{
              padding:"0.4rem 0.8rem", cursor:"pointer", fontSize:"0.68rem", fontVariant:"small-caps",
              letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
              background:"transparent", color:"#88aadd", border:`1px solid rgba(120,160,220,0.4)` }}>
              Import This Device
            </button>
            <button onClick={resetDefaults} style={{
              padding:"0.4rem 0.8rem", cursor:"pointer", fontSize:"0.68rem", fontVariant:"small-caps",
              letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
              background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}` }}>
              Reset Defaults
            </button>
          </div>
          {addOpen && (
            <div style={{ marginTop:"0.7rem", padding:"0.9rem 1rem", border:`1px solid ${GOLD_DIM}`, backgroundColor:DARK }}>
              <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap", alignItems:"flex-end" }}>
                <div style={{ flex:2, minWidth:160 }}>
                  <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Item</p>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Hair & makeup"
                    style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                      color:GOLD, fontSize:"0.85rem", padding:"0.28rem 0.5rem",
                      fontFamily:serif.style.fontFamily, outline:"none" }} />
                </div>
                <div style={{ flex:1, minWidth:110 }}>
                  <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Amount ($)</p>
                  <input type="number" min={0} step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0"
                    style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                      color:GOLD, fontSize:"0.85rem", padding:"0.28rem 0.5rem",
                      fontFamily:serif.style.fontFamily, outline:"none" }} />
                </div>
                <label style={{ display:"flex", alignItems:"center", gap:"0.4rem", fontSize:"0.78rem", color:GOLD_DIM, cursor:"pointer", paddingBottom:"0.3rem" }}>
                  <input type="checkbox" checked={newPerPerson} onChange={e => setNewPerPerson(e.target.checked)}
                    style={{ accentColor:GOLD, cursor:"pointer" }} />
                  Per person
                </label>
                <div style={{ flex:1, minWidth:110 }}>
                  <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Paid ($)</p>
                  <input type="number" min={0} step="0.01" value={newPaid} onChange={e => setNewPaid(e.target.value)} placeholder="0"
                    style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                      color:GOLD, fontSize:"0.85rem", padding:"0.28rem 0.5rem",
                      fontFamily:serif.style.fontFamily, outline:"none" }} />
                </div>
                <div style={{ flex:1, minWidth:130 }}>
                  <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Paid On</p>
                  <input type="date" value={newPaidDate} onChange={e => setNewPaidDate(e.target.value)}
                    style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                      color:GOLD, fontSize:"0.85rem", padding:"0.24rem 0.5rem",
                      fontFamily:serif.style.fontFamily, outline:"none", colorScheme:"dark" }} />
                </div>
                <div style={{ flex:1, minWidth:130 }}>
                  <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Paid By</p>
                  <input list="paid-by-options-add" value={newPaidBy} onChange={e => setNewPaidBy(e.target.value)} placeholder="Baruh / Leo / Liora"
                    style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                      color:GOLD, fontSize:"0.85rem", padding:"0.28rem 0.5rem",
                      fontFamily:serif.style.fontFamily, outline:"none" }} />
                  <datalist id="paid-by-options-add">
                    {PAID_BY_OPTIONS.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>
                <button onClick={handleAdd} disabled={!newName.trim() || !parseFloat(newAmount)} style={{
                  padding:"0.35rem 1.2rem", cursor:"pointer", fontSize:"0.75rem", fontVariant:"small-caps",
                  letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
                  background:GOLD, color:BLACK, border:`1px solid ${GOLD}`,
                  opacity:(!newName.trim() || !parseFloat(newAmount)) ? 0.4 : 1 }}>
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <p style={{ color:GOLD_DIM, textAlign:"center", padding:"2rem", fontStyle:"italic" }}>Loading…</p>
        ) : error ? (
          <p style={{ color:"#d97777", textAlign:"center", padding:"2rem" }}>{error}</p>
        ) : (
          <>
            {/* Line items */}
            <div className="print-table" style={{ border:`1px solid ${GOLD_DIM}`, overflowX:"auto" }}>
              <div className="print-bg-light" style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px 110px 110px 100px 30px", minWidth:840,
                padding:"0.6rem 1rem", backgroundColor:DARK, borderBottom:`1px solid ${GOLD_DIM}`, gap:"0.75rem" }}>
                <span style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Item</span>
                <span style={{ justifySelf:"end", fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Rate</span>
                <span style={{ justifySelf:"end", fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Subtotal</span>
                <span style={{ justifySelf:"end", fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Paid</span>
                <span style={{ justifySelf:"end", fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Balance</span>
                <span style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Paid By</span>
                <span />
              </div>

              {lines.map((l, i) => {
                const isEditing = editId === l.id;
                if (isEditing) {
                  const previewAmount = parseFloat(editAmount);
                  const previewSubtotal = Number.isFinite(previewAmount)
                    ? (editPerPerson ? previewAmount * attendingPeople : previewAmount)
                    : 0;
                  return (
                    <div key={l.id} style={{
                      padding:"0.7rem 1rem", backgroundColor:"rgba(200,168,74,0.08)",
                      borderBottom: i < lines.length-1 ? `1px solid rgba(168,138,50,0.12)` : "none",
                      borderLeft:`2px solid ${GOLD}`,
                    }}>
                      <div style={{ display:"flex", gap:"0.6rem", alignItems:"center", flexWrap:"wrap" }}>
                        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Item"
                          style={{ flex:"2 1 200px", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                            color:GOLD, fontSize:"0.9rem", padding:"0.32rem 0.5rem",
                            fontFamily:serif.style.fontFamily, outline:"none" }} />
                        <input type="number" min={0} step="0.01" value={editAmount}
                          onChange={e => setEditAmount(e.target.value)} placeholder="Amount"
                          style={{ flex:"1 1 110px", maxWidth:140, background:"transparent", border:`1px solid ${GOLD_DIM}`,
                            color:GOLD, fontSize:"0.9rem", padding:"0.32rem 0.5rem",
                            fontFamily:serif.style.fontFamily, outline:"none", textAlign:"right" }} />
                        <label style={{ fontSize:"0.78rem", color:GOLD_DIM, display:"flex", alignItems:"center", gap:"0.35rem", cursor:"pointer", whiteSpace:"nowrap" }}>
                          <input type="checkbox" checked={editPerPerson} onChange={e => setEditPerPerson(e.target.checked)}
                            style={{ accentColor:GOLD, cursor:"pointer" }} />
                          Per person
                        </label>
                      </div>
                      {/* Payments — one or more, each with a date + who paid */}
                      <div style={{ marginTop:"0.7rem" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.35rem" }}>
                          <span style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Payments</span>
                          <button onClick={addEditPayment}
                            style={{ fontSize:"0.66rem", padding:"0.2rem 0.6rem", cursor:"pointer", fontVariant:"small-caps",
                              letterSpacing:"0.05em", fontFamily:serif.style.fontFamily,
                              background:"transparent", color:GOLD, border:`1px solid ${GOLD_DIM}` }}>+ Add payment</button>
                        </div>
                        {editPayments.length === 0 && (
                          <p style={{ fontSize:"0.72rem", color:GOLD_DIM, fontStyle:"italic", margin:"0 0 0.4rem" }}>No payments yet — add one to record an amount, date, and who paid.</p>
                        )}
                        {editPayments.map((p, pi) => (
                          <div key={pi} style={{ display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap", marginBottom:"0.4rem" }}>
                            <input type="number" min={0} step="0.01" value={p.amount || ""} placeholder="Amount"
                              onChange={e => updateEditPayment(pi, { amount: parseFloat(e.target.value) || 0 })}
                              style={{ flex:"1 1 100px", maxWidth:130, background:"transparent", border:`1px solid ${GOLD_DIM}`,
                                color:GOLD, fontSize:"0.88rem", padding:"0.3rem 0.5rem",
                                fontFamily:serif.style.fontFamily, outline:"none", textAlign:"right" }} />
                            <input type="date" value={p.date}
                              onChange={e => updateEditPayment(pi, { date: e.target.value })}
                              style={{ flex:"1 1 140px", maxWidth:170, background:"transparent", border:`1px solid ${GOLD_DIM}`,
                                color:GOLD, fontSize:"0.86rem", padding:"0.26rem 0.5rem",
                                fontFamily:serif.style.fontFamily, outline:"none", colorScheme:"dark" }} />
                            <input list="paid-by-options" value={p.by} placeholder="Paid by"
                              onChange={e => updateEditPayment(pi, { by: e.target.value })}
                              style={{ flex:"2 1 150px", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                                color:GOLD, fontSize:"0.88rem", padding:"0.3rem 0.5rem",
                                fontFamily:serif.style.fontFamily, outline:"none" }} />
                            <button onClick={() => removeEditPayment(pi)} title="Remove payment"
                              style={{ padding:"0.28rem 0.5rem", cursor:"pointer", fontSize:"0.8rem",
                                background:"transparent", color:"#d97777", border:`1px solid rgba(200,80,80,0.4)` }}>✕</button>
                          </div>
                        ))}
                        <datalist id="paid-by-options">
                          {PAID_BY_OPTIONS.map(o => <option key={o} value={o} />)}
                        </datalist>
                      </div>
                      <div style={{ display:"flex", gap:"0.6rem", alignItems:"center", flexWrap:"wrap", marginTop:"0.55rem" }}>
                        <button onClick={saveEdit}
                          style={{ padding:"0.32rem 1rem", cursor:"pointer", fontSize:"0.75rem", fontVariant:"small-caps",
                            letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
                            background:GOLD, color:BLACK, border:`1px solid ${GOLD}` }}>✓ Save</button>
                        <button onClick={() => setEditId(null)}
                          style={{ padding:"0.32rem 0.8rem", cursor:"pointer", fontSize:"0.75rem", fontVariant:"small-caps",
                            letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
                            background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}` }}>Cancel</button>
                        <button onClick={() => handleRemove(l.id)} title="Delete"
                          style={{ padding:"0.32rem 0.6rem", cursor:"pointer", fontSize:"0.75rem", fontVariant:"small-caps",
                            background:"transparent", color:"#d97777", border:`1px solid rgba(200,80,80,0.4)` }}>🗑 Delete</button>
                      </div>
                      {(() => {
                        const previewPaid = editPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                        return (
                          <p style={{ fontSize:"0.72rem", color:GOLD_DIM, marginTop:"0.5rem", fontStyle:"italic" }}>
                            Subtotal preview: <span style={{ color:GOLD }}>{money(previewSubtotal)}</span>
                            {editPerPerson && ` (${money(previewAmount || 0)} × ${attendingPeople} attending)`}
                            {" · Paid: "}<span style={{ color:"#7dc87d" }}>{money(previewPaid)}</span>
                            {" · Balance preview: "}
                            <span style={{ color: previewSubtotal - previewPaid > 0 ? "#d97777" : "#7dc87d" }}>
                              {money(previewSubtotal - previewPaid)}
                            </span>
                          </p>
                        );
                      })()}
                    </div>
                  );
                }
                const balanceColor = l.balance > 0 ? "#d97777" : l.balance < 0 ? "#88aadd" : "#7dc87d";
                return (
                  <div key={l.id} style={{
                    display:"grid", gridTemplateColumns:"1fr 110px 110px 110px 110px 100px 30px", minWidth:840,
                    padding:"0.65rem 1rem", alignItems:"center", gap:"0.75rem",
                    backgroundColor: i%2===0 ? "transparent" : "rgba(200,168,74,0.02)",
                    borderBottom: i < lines.length-1 ? `1px solid rgba(168,138,50,0.12)` : "none",
                  }}>
                    <span onClick={() => startEdit(l)} style={{ display:"block", fontSize:"0.92rem", color:GOLD, cursor:"pointer" }}>
                      {l.item}
                      {l.note && <span style={{ fontSize:"0.7rem", color:GOLD_DIM, marginLeft:"0.4rem", fontStyle:"italic" }}>{l.note}</span>}
                      {l.payments && l.payments.length > 0 && (
                        <span style={{ display:"block", fontSize:"0.68rem", color:GOLD_DIM, marginTop:"0.2rem", lineHeight:1.5 }}>
                          {l.payments.map((p, pi) => (
                            <span key={pi} style={{ marginRight:"0.7rem", whiteSpace:"nowrap" }}>
                              💵 {money(p.amount)}{p.date ? ` · ${fmtDate(p.date)}` : ""}{p.by ? ` · ${p.by}` : ""}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span onClick={() => startEdit(l)} style={{
                      justifySelf:"end", display:"flex", flexDirection:"column", alignItems:"flex-end",
                      fontSize:"0.85rem", color:GOLD_DIM, cursor:"pointer", fontVariant:"tabular-nums" }}>
                      <span>{money(l.amount)}</span>
                      {l.perPerson && <span style={{ fontSize:"0.65rem", opacity:0.7 }}>/person</span>}
                    </span>
                    <span onClick={() => startEdit(l)} style={{
                      justifySelf:"end", fontSize:"0.92rem", color:GOLD,
                      fontWeight:500, cursor:"pointer", fontVariant:"tabular-nums" }}>
                      {money(l.subtotal)}
                    </span>
                    <span onClick={() => startEdit(l)} style={{
                      justifySelf:"end", fontSize:"0.88rem", color: l.paid > 0 ? "#7dc87d" : GOLD_DIM,
                      cursor:"pointer", fontVariant:"tabular-nums" }}>
                      {money(l.paid)}
                    </span>
                    <span onClick={() => startEdit(l)} style={{
                      justifySelf:"end", fontSize:"0.92rem", color: balanceColor,
                      fontWeight:500, cursor:"pointer", fontVariant:"tabular-nums" }}>
                      {money(l.balance)}
                    </span>
                    <span onClick={() => startEdit(l)} style={{
                      fontSize:"0.78rem", color:GOLD_DIM, cursor:"pointer", fontVariant:"small-caps", letterSpacing:"0.04em" }}>
                      {l.paidBy || ""}
                    </span>
                    <button onClick={() => startEdit(l)} title="Edit" className="no-print"
                      style={{ background:"transparent", border:"none", color:GOLD_DIM,
                        cursor:"pointer", fontSize:"0.78rem", padding:"0.1rem 0.25rem" }}>✎</button>
                  </div>
                );
              })}

              {/* Total */}
              <div className="print-bg-light" style={{ display:"grid", gridTemplateColumns:"1fr 110px 110px 110px 110px 100px 30px", minWidth:840,
                padding:"0.85rem 1rem", backgroundColor:DARK, borderTop:`1px solid ${GOLD_DIM}`, gap:"0.75rem" }}>
                <span style={{ fontSize:"0.78rem", color:GOLD, fontVariant:"small-caps", letterSpacing:"0.1em", fontWeight:600 }}>
                  Total (based on attending)
                </span>
                <span />
                <span className={display.className} style={{ justifySelf:"end", fontSize:"1.05rem", color:GOLD, fontWeight:700, fontVariant:"tabular-nums" }}>
                  {money(total)}
                </span>
                <span className={display.className} style={{ justifySelf:"end", fontSize:"1.05rem", color:"#7dc87d", fontWeight:700, fontVariant:"tabular-nums" }}>
                  {money(totalPaid)}
                </span>
                <span className={display.className} style={{ justifySelf:"end", fontSize:"1.05rem", color: totalBalance > 0 ? "#d97777" : "#7dc87d", fontWeight:700, fontVariant:"tabular-nums" }}>
                  {money(totalBalance)}
                </span>
                <span />
                <span />
              </div>
            </div>

            {/* Per-payer rollup — how much each person has paid across all items */}
            {byPayer.length > 0 && (
              <div style={{ marginTop:"1rem", border:`1px solid ${GOLD_DIM}`, backgroundColor:DARK, padding:"0.85rem 1rem" }}>
                <p style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", margin:"0 0 0.6rem" }}>
                  Paid by person
                </p>
                <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(byPayer.length, 4)},1fr)`, gap:"0.65rem" }}>
                  {byPayer.map(([name, amt]) => (
                    <div key={name} style={{ textAlign:"center", padding:"0.5rem 0.4rem", border:`1px solid rgba(168,138,50,0.25)` }}>
                      <p className={display.className} style={{ fontSize:"1.1rem", color:payerColor(name), fontWeight:700, lineHeight:1, margin:0, fontVariant:"tabular-nums" }}>
                        {money(amt)}
                      </p>
                      <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.08em", fontVariant:"small-caps", marginTop:"0.3rem" }}>
                        {name}{totalPaid > 0 ? ` · ${Math.round((amt / totalPaid) * 100)}%` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Worst-case projection */}
            {invitedPeople > attendingPeople && (
              <div style={{ marginTop:"1rem", padding:"0.8rem 1rem", border:`1px dashed ${GOLD_DIM}`, backgroundColor:"rgba(200,168,74,0.02)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:"0.78rem", color:GOLD_DIM, fontVariant:"small-caps", letterSpacing:"0.08em" }}>
                    If everyone invited attends ({invitedPeople} people)
                  </span>
                  <span style={{ fontSize:"1rem", color:GOLD_DIM, fontWeight:600 }}>{money(projectedTotal)}</span>
                </div>
              </div>
            )}

            <p style={{ color:GOLD_DIM, fontSize:"0.7rem", textAlign:"center", marginTop:"1.5rem", fontStyle:"italic" }}>
              Catering scales with attending count from the guest tracker. Tell Claude any new items to add to the budget.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
