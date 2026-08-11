"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Cinzel, Cormorant_Garamond } from "next/font/google";

const display = Cinzel({ weight: ["400","700"], subsets: ["latin"] });
const serif   = Cormorant_Garamond({ weight: ["400","500"], subsets: ["latin"] });

const GOLD     = "#c8a84a";
const GOLD_DIM = "#a88a32";
const DARK     = "#111008";
const BLACK    = "#080808";

type Guest = {
  sheetRow: number;
  firstName: string;
  lastName: string;
  fullName: string;
  manualStatus: string;
  manualDate: string;
  addedAt: string;
  partySize: number;
  invitedBy: string;
  phone: string;
  firstOpened: string;
  sentAt: string;
  titleOverride: string;
  rsvpParty: number | null;
  effectiveStatus: "attending" | "committed" | "declined" | "fyi" | "pending" | "removed";
  source: "manual" | "rsvp" | "pending";
  statusDate: string;
  fuzzyMatch?: boolean;
  rsvpName: string | null;
  rsvpAttending: string | null;
  rsvpDate: string | null;
};

const SOURCES = ["Baruh", "Kanter", "Leo", "Liora"] as const;

type Filter  = "all" | "pending" | "attending" | "committed" | "declined" | "fyi" | "removed" | "added" | "opened";
type SortKey = "firstName" | "lastName" | "status" | "addedAt";

function normalize(s: string) { return s.trim().toLowerCase().replace(/\s+/g, " "); }

function displayPhone(p: string): string {
  if (!p) return "";
  const digits = p.replace(/[^\d]/g, "");
  return digits.length > 10 ? `+${digits}` : digits;
}

const STATUS_CFG = {
  attending: { bg:"rgba(100,180,100,0.15)", color:"#7dc87d", border:"rgba(100,180,100,0.3)", label:"✓ Attending" },
  declined:  { bg:"rgba(200,80,80,0.15)",   color:"#d97777", border:"rgba(200,80,80,0.3)",   label:"✗ Declined"  },
  fyi:       { bg:"rgba(120,160,220,0.15)", color:"#88aadd", border:"rgba(120,160,220,0.3)", label:"○ FYI"       },
  pending:   { bg:"rgba(200,160,74,0.12)",  color:GOLD,       border:"rgba(200,160,74,0.25)", label:"○ No Response" },
  removed:   { bg:"rgba(120,120,120,0.12)", color:"#888",    border:"rgba(120,120,120,0.3)", label:"⊘ Removed"   },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_CFG }) {
  const c = STATUS_CFG[status];
  return (
    <span style={{ display:"inline-block", padding:"0.18rem 0.6rem", fontSize:"0.7rem",
      letterSpacing:"0.08em", fontVariant:"small-caps", borderRadius:"2px",
      background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}


export default function GuestsPage() {
  const [guests,     setGuests]     = useState<Guest[]>([]);
  const [unexpected, setUnexpected] = useState<Guest[]>([]);
  const [filter,     setFilter]     = useState<Filter>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all"); // all | Baruh | Kanter | Leo | Liora
  const [search,     setSearch]     = useState("");
  const [sort,       setSort]       = useState<SortKey>("lastName");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("asc");
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [lastFetch,  setLastFetch]  = useState("");

  // Triage state — per-row "sent from" + guest count for adding an unmatched RSVP to the list
  const [triageSource, setTriageSource] = useState<Record<string, string>>({});
  const [triageParty,  setTriageParty]  = useState<Record<string, number>>({});
  const [addingTriage, setAddingTriage] = useState<string | null>(null);

  // Edit state
  const [editRow,    setEditRow]    = useState<number | null>(null);
  const [editFirst,  setEditFirst]  = useState("");
  const [editLast,   setEditLast]   = useState("");
  const [editManual, setEditManual] = useState("");
  const [editParty,  setEditParty]  = useState(1);
  const [editSource, setEditSource] = useState("Baruh");
  const [editPhone,  setEditPhone]  = useState("");
  const [editMr,     setEditMr]     = useState(true);
  const [editMrs,    setEditMrs]    = useState(true);
  const [saving,     setSaving]     = useState(false);

  // Add state
  const [addOpen,   setAddOpen]   = useState(false);
  const [addFirst,  setAddFirst]  = useState("");
  const [addLast,   setAddLast]   = useState("");
  const [addParty,  setAddParty]  = useState(1);
  const [addSource, setAddSource] = useState("Baruh");
  const [addPhone,  setAddPhone]  = useState("");
  const [addError,  setAddError]  = useState("");
  const [adding,    setAdding]    = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const [saveError,  setSaveError]  = useState("");

  const load = useCallback(async (preserveScroll = false) => {
    const scrollY = preserveScroll ? window.scrollY : 0;
    if (!preserveScroll) setLoading(true);
    try {
      const res = await fetch("/api/guests");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGuests(data.guests);
      setUnexpected(data.unexpected);
      setLastFetch(new Date().toLocaleTimeString());
      if (preserveScroll) requestAnimationFrame(() => window.scrollTo(0, scrollY));
    } catch { setError("Failed to load."); }
    finally   { if (!preserveScroll) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live polling: refresh the guest list every 30s without disturbing scroll, edit mode, or open menus
  useEffect(() => {
    const id = setInterval(() => {
      if (editRow === null && !saving && !addOpen) load(true);
    }, 30000);
    return () => clearInterval(id);
  }, [load, editRow, saving, addOpen]);

  function startEdit(g: Guest) {
    setEditRow(g.sheetRow);
    setEditFirst(g.firstName);
    setEditLast(g.lastName);
    setEditManual(g.manualStatus);
    setEditParty(g.partySize || 1);
    setEditSource(g.invitedBy || "Baruh");
    setEditPhone(g.phone || "");
    const t = (g.titleOverride || "").toLowerCase();
    if (t === "mr")        { setEditMr(true);  setEditMrs(false); }
    else if (t === "mrs")  { setEditMr(false); setEditMrs(true);  }
    else if (t === "none") { setEditMr(false); setEditMrs(false); }
    else                   { setEditMr(true);  setEditMrs(true);  } // default = both
  }

  async function saveEdit(g: Guest) {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: editFirst, lastName: editLast,
          manualStatus: editManual, prevManualStatus: g.manualStatus,
          partySize: editParty, invitedBy: editSource,
          phone: editPhone,
          titleOverride: editMr && editMrs ? "" : editMr ? "mr" : editMrs ? "mrs" : "none",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditRow(null);
      await new Promise(r => setTimeout(r, 600));
      load(true);
    } catch (e) {
      setSaveError(`Save failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  function currentTitle(g: Guest): { mr: boolean; mrs: boolean } {
    const t = (g.titleOverride || "").toLowerCase();
    if (t === "mr")   return { mr: true,  mrs: false };
    if (t === "mrs")  return { mr: false, mrs: true  };
    if (t === "none") return { mr: false, mrs: false };
    return { mr: true, mrs: true }; // default = both
  }

  async function saveStatus(g: Guest, newStatus: string) {
    // Optimistically update the visible row so the dropdown feels instant
    setGuests(prev => prev.map(x => x.sheetRow === g.sheetRow
      ? { ...x, manualStatus: newStatus,
          effectiveStatus: newStatus.toLowerCase() === "yes"       ? "attending"
                         : newStatus.toLowerCase() === "committed" ? "committed"
                         : newStatus.toLowerCase() === "no"        ? "declined"
                         : newStatus.toLowerCase() === "fyi"       ? "fyi"
                         : newStatus.toLowerCase() === "removed"   ? "removed"
                         : x.rsvpAttending
                            ? (x.rsvpAttending.toLowerCase() === "yes" ? "attending" : "declined")
                            : "pending",
          source: newStatus ? "manual" : (x.rsvpAttending ? "rsvp" : "pending"),
        }
      : x));
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName, lastName: g.lastName,
          manualStatus: newStatus, prevManualStatus: g.manualStatus,
        }),
      });
    } catch { setSaveError("Failed to update status."); }
  }

  async function updateInvitedBy(g: Guest, newSource: string) {
    setGuests(prev => prev.map(x => x.sheetRow === g.sheetRow ? { ...x, invitedBy: newSource } : x));
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName, lastName: g.lastName,
          manualStatus: g.manualStatus, prevManualStatus: g.manualStatus,
          invitedBy: newSource,
        }),
      });
    } catch { setSaveError("Failed to update Invited By."); }
  }

  async function toggleTitle(g: Guest, next: { mr: boolean; mrs: boolean }) {
    const titleOverride = next.mr && next.mrs ? "" : next.mr ? "mr" : next.mrs ? "mrs" : "none";
    // Number of guests follows the titles: Mr + Mrs = 2, a single title (or none) = 1.
    const partySize = next.mr && next.mrs ? 2 : 1;
    // Optimistic local update — totals recompute from state, so the count updates instantly
    setGuests(prev => prev.map(x => x.sheetRow === g.sheetRow ? { ...x, titleOverride, partySize } : x));
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName, lastName: g.lastName,
          manualStatus: g.manualStatus, prevManualStatus: g.manualStatus,
          partySize,
          titleOverride,
        }),
      });
    } catch { setSaveError("Failed to save title."); }
  }

  async function clearManual(g: Guest) {
    await fetch("/api/guests", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetRow: g.sheetRow, firstName: g.firstName, lastName: g.lastName,
        manualStatus: "", prevManualStatus: g.manualStatus,
      }),
    });
    load(true);
  }

  // Triage → add an unmatched RSVP to the guest list with a chosen "sent from" + guest count.
  // Once added, the new Guests row matches the existing RSVP by name and leaves the triage list.
  async function addFromTriage(g: Guest, key: string) {
    const src = triageSource[key] || "Baruh";
    const party = triageParty[key] || (g.rsvpParty && g.rsvpParty > 0 ? g.rsvpParty : 1);
    const [first, ...rest] = g.fullName.trim().split(" ");
    setAddingTriage(key);
    setSaveError("");
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: first, lastName: rest.join(" "),
          partySize: party, invitedBy: src,
        }),
      });
      // 409 = already on the list; treat as success and just refresh
      if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`);
      await new Promise(r => setTimeout(r, 400));
      load(true);
    } catch (e) {
      setSaveError(`Add failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setAddingTriage(null);
    }
  }

  async function resetAll() {
    if (!confirm("Clear ALL manual statuses? Only RSVP replies will remain. This cannot be undone.")) return;
    setResetting(true);
    await fetch("/api/guests", { method: "DELETE" });
    setResetting(false);
    load();
  }

  async function handleAdd() {
    if (!addFirst.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: addFirst, lastName: addLast,
          partySize: addParty, invitedBy: addSource,
          phone: addPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? `Failed (HTTP ${res.status})`); return; }
      setAddFirst(""); setAddLast(""); setAddParty(1); setAddSource("Baruh"); setAddPhone("");
      setAddOpen(false);
      load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  }

  const filtered = guests
    .filter(g => {
      if (filter === "fyi"       && g.effectiveStatus !== "fyi")       return false;
      if (filter === "pending"   && g.effectiveStatus !== "pending")   return false;
      if (filter === "attending" && g.effectiveStatus !== "attending") return false;
      if (filter === "committed" && g.effectiveStatus !== "committed") return false;
      if (filter === "declined"  && g.effectiveStatus !== "declined")  return false;
      if (filter === "removed"   && g.effectiveStatus !== "removed")   return false;
      if (filter === "added"     && !g.addedAt)                        return false;
      if (filter === "opened"    && !g.firstOpened)                    return false;
      if (sourceFilter !== "all" && (g.invitedBy || "Baruh") !== sourceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const qDigits = search.replace(/[^\d]/g, "");
        const nameMatch = g.firstName.toLowerCase().includes(q) || g.lastName.toLowerCase().includes(q);
        const phoneMatch = qDigits.length > 0 && g.phone.includes(qDigits);
        return nameMatch || phoneMatch;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "addedAt") {
        const da = a.addedAt ? new Date(a.addedAt).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
        const db = b.addedAt ? new Date(b.addedAt).getTime() : (sortDir === "asc" ? Infinity : -Infinity);
        return sortDir === "asc" ? da - db : db - da;
      }
      const av = sort === "status" ? a.effectiveStatus : sort === "lastName" ? a.lastName : a.firstName;
      const bv = sort === "status" ? b.effectiveStatus : sort === "lastName" ? b.lastName : b.firstName;
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  // Status filters and their counts are scoped to the selected source tab (who invited them),
  // so picking a source narrows everything below it.
  const inSource = sourceFilter === "all"
    ? guests
    : guests.filter(g => (g.invitedBy || "Baruh") === sourceFilter);
  const counts = {
    total:     inSource.length,
    attending: inSource.filter(g => g.effectiveStatus === "attending").length,
    committed: inSource.filter(g => g.effectiveStatus === "committed").length,
    declined:  inSource.filter(g => g.effectiveStatus === "declined").length,
    pending:   inSource.filter(g => g.effectiveStatus === "pending").length,
    fyi:       inSource.filter(g => g.effectiveStatus === "fyi").length,
    removed:   inSource.filter(g => g.effectiveStatus === "removed").length,
    added:     inSource.filter(g => !!g.addedAt).length,
    opened:    inSource.filter(g => !!g.firstOpened).length,
  };
  // Head count comes from the Mr/Mrs title checkboxes: both Mr & Mrs = 2, a single title = 1, none = 0.
  // This is what you toggle, so every total updates live the moment a box is unchecked — even after RSVP.
  const headCount = (g: Guest) => {
    const t = (g.titleOverride || "").toLowerCase();
    if (t === "mr" || t === "mrs") return 1;
    if (t === "none") return 0;
    return 2; // default = both Mr & Mrs
  };
  const peopleTotals = {
    invited:   inSource.reduce((sum, g) => sum + headCount(g), 0),
    attending: inSource.filter(g => g.effectiveStatus === "attending").reduce((sum, g) => sum + headCount(g), 0),
    committed: inSource.filter(g => g.effectiveStatus === "committed").reduce((sum, g) => sum + headCount(g), 0),
    filtered:  filtered.reduce((sum, g) => sum + headCount(g), 0),
  };
  const missingLastName = guests.filter(g => !g.lastName).length;

  function downloadCSV() {
    const statusLabel: Record<string, string> = {
      attending: "Attending", committed: "Committed", declined: "Declined", fyi: "FYI", pending: "No Response",
    };
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["First Name","Last Name","Party","Invited By","Status","RSVP","RSVP Date","Manual","Manual Date","Added At"];
    const rows = filtered.map(g => [
      g.firstName, g.lastName,
      String(g.partySize || 1), g.invitedBy || "",
      statusLabel[g.effectiveStatus] ?? g.effectiveStatus,
      g.rsvpAttending ?? "", g.rsvpDate ?? "",
      g.manualStatus, g.manualDate,
      g.addedAt,
    ].map(esc).join(","));
    const csv = [headers.map(esc).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leo-liora-guests${filter !== "all" ? `-${filter}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const textInput = (val: string, set: (v: string) => void, ph: string) => (
    <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
        color:GOLD, fontSize:"0.82rem", padding:"0.22rem 0.45rem",
        fontFamily:serif.style.fontFamily, outline:"none" }} />
  );

  const filterBtn = (f: Filter, label: string, count: number) => (
    <button onClick={() => setFilter(f)} style={{
      padding:"0.35rem 0.85rem", cursor:"pointer", fontSize:"0.75rem",
      fontVariant:"small-caps", letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
      background: filter===f ? GOLD : "transparent",
      color: filter===f ? BLACK : GOLD_DIM,
      border:`1px solid ${filter===f ? GOLD : GOLD_DIM}`, transition:"all 0.2s",
    }}>{label} ({count})</button>
  );

  const colHead = (label: string, key: SortKey) => (
    <span onClick={() => {
      if (sort === key) setSortDir(d => d === "asc" ? "desc" : "asc");
      else { setSort(key); setSortDir("asc"); }
    }} style={{
      fontSize:"0.65rem", color: sort===key ? GOLD : GOLD_DIM,
      letterSpacing:"0.1em", fontVariant:"small-caps", cursor:"pointer", userSelect:"none",
    }}>{label}{sort===key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</span>
  );

  return (
    <div className={serif.className} style={{ minHeight:"100vh", backgroundColor:BLACK, color:GOLD, padding:"2rem 1rem" }}>
      <style>{`
        * { box-sizing:border-box; }
        ::placeholder { color:${GOLD_DIM}; opacity:0.6; }
        select option { background:${DARK}; color:${GOLD}; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
      `}</style>

      <div style={{ maxWidth:980, margin:"0 auto 1.75rem" }}>
        <p className={display.className} style={{ fontSize:"clamp(1.1rem,3.5vw,1.8rem)", letterSpacing:"0.15em", marginBottom:"0.25rem" }}>LEO &amp; LIORA</p>
        <p style={{ color:GOLD_DIM, fontSize:"0.75rem", letterSpacing:"0.1em", fontVariant:"small-caps" }}>Guest Response Tracker · August 13, 2026</p>
        <div style={{ height:1, backgroundColor:GOLD_DIM, opacity:0.25, marginTop:"0.9rem" }} />
      </div>

      <div style={{ maxWidth:980, margin:"0 auto" }}>

        {/* Tabs */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem" }}>
          <Link href="/guests" style={{ padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
            fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
            background:GOLD, color:BLACK, border:`1px solid ${GOLD}` }}>Guests</Link>
          <Link href="/send-it" style={{ padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
            fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
            background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}` }}>Send</Link>
          <Link href="/budget" style={{ padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
            fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
            background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}` }}>Budget</Link>
          <Link href="/baruh" style={{ padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
            fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
            background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}` }}>Baruh</Link>
          <Link href="/calendar" style={{ padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
            fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
            background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}` }}>Calendar</Link>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:"0.65rem", marginBottom:"1.75rem" }}>
          {([
            { label:"Invited",     value:counts.total,           color:GOLD,      sub:"" },
            { label:"Attending",   value:peopleTotals.attending, color:"#7dc87d", sub:"" },
            { label:"Committed",   value:counts.committed,        color:"#b18ad9", sub:"" },
            { label:"Declined",    value:counts.declined,         color:"#d97777", sub:"" },
            { label:"No Response", value:counts.pending,          color:GOLD_DIM,  sub:"" },
            { label:"FYI",         value:counts.fyi,              color:"#88aadd", sub:"" },
          ] as const).map(s => (
            <div key={s.label} style={{ backgroundColor:DARK, border:`1px solid ${GOLD_DIM}`, padding:"0.7rem", textAlign:"center" }}>
              <p style={{ fontSize:"clamp(1.2rem,4vw,2rem)", color:s.color, fontWeight:600, lineHeight:1 }}>{s.value}</p>
              <p style={{ fontSize:"0.63rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginTop:"0.25rem" }}>{s.label}</p>
              {s.sub && <p style={{ fontSize:"0.55rem", color:GOLD_DIM, opacity:0.65, marginTop:"0.15rem" }}>{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Missing last name warning */}
        {missingLastName > 0 && (
          <div style={{ marginBottom:"1rem", padding:"0.55rem 1rem", border:`1px solid rgba(200,160,74,0.4)`,
            backgroundColor:"rgba(200,160,74,0.05)", fontSize:"0.78rem", color:GOLD_DIM }}>
            ⚠ {missingLastName} guest{missingLastName > 1 ? "s" : ""} missing a last name — highlighted below.
          </div>
        )}
        {saveError && (
          <div style={{ marginBottom:"1rem", padding:"0.55rem 1rem", border:`1px solid rgba(200,80,80,0.4)`,
            backgroundColor:"rgba(200,80,80,0.05)", fontSize:"0.78rem", color:"#d97777" }}>
            ✗ {saveError}
          </div>
        )}

        {/* Controls */}
        <div style={{ marginBottom:"1.1rem" }}>
          {/* Source tabs — filter by who invited (Baruh / Kanter / Leo / Liora) */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"0.4rem", marginBottom:"0.5rem" }}>
            {(["all", "Baruh", "Kanter", "Leo", "Liora"] as const).map(s => {
              const count = s === "all"
                ? guests.length
                : guests.filter(g => (g.invitedBy || "Baruh") === s).length;
              const isActive = sourceFilter === s;
              return (
                <button key={s} onClick={() => setSourceFilter(s)} style={{
                  padding:"0.42rem 0.3rem", cursor:"pointer", fontSize:"0.72rem", textAlign:"center",
                  fontVariant:"small-caps", letterSpacing:"0.06em", fontFamily:serif.style.fontFamily,
                  background: isActive ? GOLD : "transparent",
                  color: isActive ? BLACK : GOLD_DIM,
                  border:`1px solid ${isActive ? GOLD : GOLD_DIM}`, transition:"all 0.2s",
                }}>
                  {s === "all" ? "All Sources" : s} ({count})
                </button>
              );
            })}
          </div>
          {/* Filter buttons — 3 per row, equal width */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"0.4rem", marginBottom:"0.5rem" }}>
            {([ ["all","All",counts.total], ["pending","No Response",counts.pending],
                ["attending","Attending",peopleTotals.attending], ["committed","Committed",counts.committed],
                ["declined","Declined",counts.declined],
                ["fyi","FYI",counts.fyi], ["removed","Removed",counts.removed],
                ["opened","👁 Opened",counts.opened],
                ["added","Added by Me",counts.added] ] as [Filter,string,number][]).map(([f,label,count]) => (
              <button key={f} onClick={() => {
                setFilter(f);
                if (f === "added") { setSort("addedAt"); setSortDir("desc"); }
              }} style={{
                padding:"0.4rem 0.3rem", cursor:"pointer", fontSize:"0.72rem", textAlign:"center",
                fontVariant:"small-caps", letterSpacing:"0.05em", fontFamily:serif.style.fontFamily,
                background: filter===f ? GOLD : "transparent",
                color: filter===f ? BLACK : GOLD_DIM,
                border:`1px solid ${filter===f ? GOLD : GOLD_DIM}`, transition:"all 0.2s",
              }}>{label} ({count})</button>
            ))}
          </div>
          {/* Action row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto auto", gap:"0.4rem", alignItems:"center" }}>
            <div style={{ position:"relative", display:"flex", alignItems:"center" }}>
              <input type="text" placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ padding:"0.38rem 2rem 0.38rem 0.7rem", background:"transparent",
                  border:`1px solid ${GOLD_DIM}`, color:GOLD, fontSize:"0.82rem",
                  fontFamily:serif.style.fontFamily, outline:"none", width:"100%" }} />
              {search && (
                <button onClick={() => setSearch("")}
                  style={{ position:"absolute", right:"0.4rem", background:"none", border:"none",
                    color:GOLD_DIM, cursor:"pointer", fontSize:"0.85rem", lineHeight:1, padding:"0.1rem" }}>✕</button>
              )}
            </div>
            <button onClick={() => setAddOpen(o => !o)} style={{
              padding:"0.38rem 0.8rem", cursor:"pointer", fontSize:"0.72rem", fontVariant:"small-caps",
              letterSpacing:"0.05em", fontFamily:serif.style.fontFamily, whiteSpace:"nowrap",
              background: addOpen ? GOLD : "transparent", color: addOpen ? BLACK : GOLD,
              border:`1px solid ${GOLD}`, transition:"all 0.2s" }}>+ Add</button>
            <button onClick={downloadCSV} style={{ padding:"0.38rem 0.7rem", cursor:"pointer", fontSize:"0.72rem",
              fontVariant:"small-caps", letterSpacing:"0.05em", fontFamily:serif.style.fontFamily, whiteSpace:"nowrap",
              background:"transparent", color:GOLD, border:`1px solid ${GOLD_DIM}` }}>↓ CSV</button>
            <button onClick={() => load()} title="Refresh (auto-refreshing every 30s)" style={{
              padding:"0.38rem 0.6rem", cursor:"pointer", fontSize:"0.75rem",
              fontVariant:"small-caps", fontFamily:serif.style.fontFamily,
              background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}`,
              display:"flex", alignItems:"center", gap:"0.3rem" }}>
              <span style={{ fontSize:"0.5rem", color:"#7dc87d", animation:"pulse 1.6s ease-in-out infinite" }}>●</span> ↻
            </button>
            <button onClick={resetAll} disabled={resetting} style={{ padding:"0.38rem 0.6rem", cursor:"pointer", fontSize:"0.68rem",
              fontVariant:"small-caps", fontFamily:serif.style.fontFamily, whiteSpace:"nowrap",
              background:"transparent", color:"#d97777", border:`1px solid rgba(200,80,80,0.4)`,
              opacity: resetting ? 0.5 : 1 }}>{resetting ? "…" : "Reset"}</button>
          </div>
        </div>

        {/* Add guest form */}
        {addOpen && (
          <div style={{ marginBottom:"1.1rem", padding:"0.9rem 1rem",
            border:`1px solid ${GOLD_DIM}`, backgroundColor:DARK }}>
            <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap", alignItems:"flex-end" }}>
              <div style={{ flex:1, minWidth:130 }}>
                <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>First Name</p>
                {textInput(addFirst, setAddFirst, "First name")}
              </div>
              <div style={{ flex:1, minWidth:130 }}>
                <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Last Name</p>
                {textInput(addLast, setAddLast, "Last name")}
              </div>
              <div style={{ width:80 }}>
                <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Party</p>
                <input type="number" min={1} value={addParty} onChange={e => setAddParty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                    color:GOLD, fontSize:"0.82rem", padding:"0.22rem 0.45rem",
                    fontFamily:serif.style.fontFamily, outline:"none" }} />
              </div>
              <div style={{ minWidth:110 }}>
                <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>Invited By</p>
                <select value={addSource} onChange={e => setAddSource(e.target.value)}
                  style={{ width:"100%", background:DARK, color:GOLD, border:`1px solid ${GOLD_DIM}`,
                    fontSize:"0.82rem", padding:"0.22rem 0.4rem", fontFamily:serif.style.fontFamily, outline:"none" }}>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex:1, minWidth:150 }}>
                <p style={{ fontSize:"0.62rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.25rem" }}>
                  Phone <span style={{ textTransform:"none", letterSpacing:0, opacity:0.7 }}>(country code, digits only)</span>
                </p>
                <input type="tel" value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="13055551234"
                  style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                    color:GOLD, fontSize:"0.82rem", padding:"0.22rem 0.45rem",
                    fontFamily:serif.style.fontFamily, outline:"none" }} />
              </div>
              <button onClick={handleAdd} disabled={adding || !addFirst.trim()} style={{
                padding:"0.35rem 1.1rem", cursor:"pointer", fontSize:"0.75rem", fontVariant:"small-caps",
                letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
                background:GOLD, color:BLACK, border:`1px solid ${GOLD}`,
                opacity:(!addFirst.trim() || adding) ? 0.4 : 1 }}>
                {adding ? "Saving…" : "Save"}
              </button>
            </div>
            {addError && (
              <p style={{ marginTop:"0.6rem", fontSize:"0.78rem", color:"#d97777" }}>✗ {addError}</p>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p style={{ color:GOLD_DIM, textAlign:"center", padding:"3rem", fontStyle:"italic" }}>Loading…</p>
        ) : error ? (
          <p style={{ color:"#d97777", textAlign:"center", padding:"3rem" }}>{error}</p>
        ) : (
          <>
            <div style={{ border:`1px solid ${GOLD_DIM}`, overflowX:"auto" }}>
              {/* Headers — 8 cols: first | last | status | # | invited by | phone | added | edit */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 150px 50px 90px 130px 1fr 30px",
                padding:"0.55rem 1rem", backgroundColor:DARK, borderBottom:`1px solid ${GOLD_DIM}`, gap:"0.75rem", minWidth:900 }}>
                {colHead("First Name", "firstName")}
                {colHead("Last Name",  "lastName")}
                {colHead("Status",     "status")}
                <span style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>#</span>
                <span style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Invited By</span>
                <span style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps" }}>Phone</span>
                {colHead("Added", "addedAt")}
                <span />
              </div>

              {filtered.length === 0 ? (
                <p style={{ color:GOLD_DIM, textAlign:"center", padding:"2rem", fontStyle:"italic" }}>No guests match.</p>
              ) : filtered.map((g, i) => {
                const isEditing   = editRow === g.sheetRow;
                const missingLast = !g.lastName;
                return (
                  <div key={g.sheetRow} style={{
                    display:"grid", gridTemplateColumns:"1fr 1fr 150px 50px 90px 130px 1fr 30px",
                    padding:"0.6rem 1rem", alignItems:"center", gap:"0.75rem", minWidth:900,
                    backgroundColor: missingLast ? "rgba(200,160,74,0.05)" : i%2===0 ? "transparent" : "rgba(200,168,74,0.02)",
                    borderBottom: i < filtered.length-1 ? `1px solid rgba(168,138,50,0.12)` : "none",
                    borderLeft: missingLast ? `2px solid ${GOLD_DIM}` : "2px solid transparent",
                  }}>
                    {isEditing ? (
                      <>
                        {textInput(editFirst, setEditFirst, "First")}
                        {textInput(editLast,  setEditLast,  "Last")}

                        {/* Manual status dropdown — moved before Party to match read-mode column order */}
                        <select value={editManual} onChange={e => setEditManual(e.target.value)}
                          style={{ background:DARK, color:GOLD, border:`1px solid ${GOLD_DIM}`,
                            fontSize:"0.78rem", padding:"0.22rem 0.4rem", fontFamily:serif.style.fontFamily, outline:"none" }}>
                          <option value="">— (auto)</option>
                          <option value="Yes">Yes — Attending</option>
                          <option value="Committed">Committed — working on logistics</option>
                          <option value="No">No — Declined</option>
                          <option value="FYI">FYI</option>
                          <option value="Removed">Removed</option>
                        </select>

                        <input type="number" min={1} value={editParty}
                          onChange={e => setEditParty(Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                            color:GOLD, fontSize:"0.82rem", padding:"0.22rem 0.35rem",
                            fontFamily:serif.style.fontFamily, outline:"none" }} />

                        <select value={editSource} onChange={e => setEditSource(e.target.value)}
                          style={{ background:DARK, color:GOLD, border:`1px solid ${GOLD_DIM}`,
                            fontSize:"0.78rem", padding:"0.22rem 0.4rem", fontFamily:serif.style.fontFamily, outline:"none" }}>
                          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="13055551234"
                          style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                            color:GOLD, fontSize:"0.78rem", padding:"0.22rem 0.4rem",
                            fontFamily:serif.style.fontFamily, outline:"none" }} />

                        <div style={{ display:"flex", flexDirection:"column", gap:"0.25rem" }}>
                          <span style={{ fontSize:"0.65rem", color:GOLD_DIM, fontStyle:"italic" }}>
                            {editManual && editManual !== g.manualStatus ? "Will stamp now" : g.manualDate || "—"}
                          </span>
                          <div style={{ display:"flex", gap:"0.5rem", fontSize:"0.65rem", color:GOLD_DIM }}>
                            <label style={{ display:"flex", alignItems:"center", gap:"0.2rem", cursor:"pointer" }}>
                              <input type="checkbox" checked={editMr}  onChange={e => setEditMr(e.target.checked)}
                                style={{ accentColor:GOLD, cursor:"pointer", width:12, height:12 }} />
                              Mr
                            </label>
                            <label style={{ display:"flex", alignItems:"center", gap:"0.2rem", cursor:"pointer" }}>
                              <input type="checkbox" checked={editMrs} onChange={e => setEditMrs(e.target.checked)}
                                style={{ accentColor:GOLD, cursor:"pointer", width:12, height:12 }} />
                              Mrs
                            </label>
                          </div>
                        </div>

                        <div style={{ display:"flex", gap:"0.25rem" }}>
                          <button onClick={() => saveEdit(g)} disabled={saving}
                            style={{ fontSize:"0.7rem", padding:"0.2rem 0.45rem", cursor:"pointer",
                              background:GOLD, color:BLACK, border:"none", fontFamily:serif.style.fontFamily }}>
                            {saving ? "…" : "✓"}
                          </button>
                          <button onClick={() => setEditRow(null)}
                            style={{ fontSize:"0.7rem", padding:"0.2rem 0.45rem", cursor:"pointer",
                              background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}`, fontFamily:serif.style.fontFamily }}>
                            ✕
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize:"0.88rem", color: g.effectiveStatus==="pending" ? GOLD : GOLD_DIM }}>
                          {g.firstName}
                        </span>
                        <div style={{ display:"flex", flexDirection:"column", gap:"0.2rem", minWidth:0 }}>
                          <span style={{ fontSize:"0.88rem", color: g.effectiveStatus==="pending" ? GOLD : GOLD_DIM }}>
                            {g.lastName
                              ? g.lastName
                              : <span style={{ color:GOLD_DIM, opacity:0.45, fontStyle:"italic" }}>—</span>
                            }
                            {g.rsvpName && normalize(g.rsvpName) !== normalize(g.fullName) && (
                              <span style={{ fontSize:"0.65rem", color: g.fuzzyMatch ? "#e0b85a" : GOLD_DIM, marginLeft:"0.35rem", fontStyle:"italic" }}>
                                {g.fuzzyMatch ? "≈" : ""}({g.rsvpName})
                              </span>
                            )}
                          </span>
                          {(() => {
                            const t = currentTitle(g);
                            return (
                              <div style={{ display:"flex", gap:"0.4rem", fontSize:"0.6rem", color:GOLD_DIM }}>
                                <label style={{ display:"flex", alignItems:"center", gap:"0.15rem", cursor:"pointer", userSelect:"none" }}>
                                  <input type="checkbox" checked={t.mr}
                                    onChange={e => toggleTitle(g, { mr: e.target.checked, mrs: t.mrs })}
                                    style={{ accentColor:GOLD, cursor:"pointer", width:11, height:11, margin:0 }} />
                                  Mr
                                </label>
                                <label style={{ display:"flex", alignItems:"center", gap:"0.15rem", cursor:"pointer", userSelect:"none" }}>
                                  <input type="checkbox" checked={t.mrs}
                                    onChange={e => toggleTitle(g, { mr: t.mr, mrs: e.target.checked })}
                                    style={{ accentColor:GOLD, cursor:"pointer", width:11, height:11, margin:0 }} />
                                  Mrs
                                </label>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Status cell — inline editable dropdown + source/date info */}
                        <div style={{ display:"flex", flexDirection:"column", gap:"0.15rem", minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"0.25rem" }}>
                            <select value={g.manualStatus || ""} onChange={e => saveStatus(g, e.target.value)}
                              style={{ flex:1, minWidth:0,
                                fontSize:"0.7rem",
                                color: g.effectiveStatus==="attending" ? "#7dc87d"
                                     : g.effectiveStatus==="committed" ? "#b18ad9"
                                     : g.effectiveStatus==="declined"  ? "#d97777"
                                     : g.effectiveStatus==="fyi"       ? "#88aadd"
                                     : g.effectiveStatus==="removed"   ? "#888"
                                     : GOLD,
                                background:"transparent",
                                border:`1px solid ${
                                  g.effectiveStatus==="attending" ? "rgba(100,180,100,0.35)"
                                : g.effectiveStatus==="committed" ? "rgba(177,138,217,0.35)"
                                : g.effectiveStatus==="declined"  ? "rgba(200,80,80,0.35)"
                                : g.effectiveStatus==="fyi"       ? "rgba(120,160,220,0.35)"
                                : g.effectiveStatus==="removed"   ? "rgba(120,120,120,0.35)"
                                : "rgba(200,160,74,0.3)"}`,
                                padding:"0.2rem 0.3rem",
                                fontVariant:"small-caps", letterSpacing:"0.05em",
                                fontFamily:serif.style.fontFamily, cursor:"pointer" }}>
                              <option value="">— {g.source === "rsvp" ? `RSVP: ${g.rsvpAttending}` : "auto"}</option>
                              <option value="Yes">✓ Attending</option>
                              <option value="Committed">◆ Committed</option>
                              <option value="No">✗ Declined</option>
                              <option value="FYI">○ FYI</option>
                              <option value="Removed">⊘ Removed</option>
                            </select>
                            {g.manualStatus && (
                              <button onClick={() => clearManual(g)} title="Clear manual status — revert to RSVP or pending"
                                style={{ background:"transparent", border:"none", color:"#d97777",
                                  cursor:"pointer", fontSize:"0.7rem", padding:"0 0.1rem", lineHeight:1 }}>✕</button>
                            )}
                          </div>
                          {g.source === "rsvp" && g.statusDate && (
                            <div style={{ fontSize:"0.6rem", color:"#7dc87d", opacity:0.75 }}>RSVP · {g.statusDate}</div>
                          )}
                          {g.source === "manual" && g.statusDate && (
                            <div style={{ fontSize:"0.6rem", color:"#88aadd", opacity:0.75 }}>Manual · {g.statusDate}</div>
                          )}
                          {g.firstOpened && (
                            <div style={{ fontSize:"0.6rem", color:"#7dc87d", opacity:0.85, fontWeight:500 }}>
                              👁 {g.firstOpened}
                            </div>
                          )}
                        </div>
                        {/* Party size */}
                        <span style={{ fontSize:"0.85rem", color:GOLD, textAlign:"center", fontWeight: g.partySize > 1 ? 600 : 400 }}>
                          {g.partySize || 1}
                        </span>
                        {/* Invited by — inline editable dropdown */}
                        <select value={g.invitedBy || "Baruh"} onChange={e => updateInvitedBy(g, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize:"0.72rem", color:GOLD_DIM, background:"transparent",
                            border:`1px solid rgba(168,138,50,0.3)`, padding:"0.15rem 0.25rem",
                            fontVariant:"small-caps", letterSpacing:"0.05em",
                            fontFamily:serif.style.fontFamily, cursor:"pointer" }}>
                          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {/* Phone */}
                        <span style={{ fontSize:"0.78rem", color: g.phone ? GOLD : GOLD_DIM, fontVariant:"tabular-nums", opacity: g.phone ? 1 : 0.4 }}>
                          {g.phone ? displayPhone(g.phone) : "—"}
                        </span>
                        {/* Added date cell — only shows when this guest was added via the tracker */}
                        <div>
                          {g.addedAt
                            ? <span style={{ fontSize:"0.65rem", color:GOLD_DIM }}>Added · {g.addedAt}</span>
                            : <span style={{ fontSize:"0.65rem", color:GOLD_DIM, opacity:0.25 }}>—</span>
                          }
                        </div>
                        <button onClick={() => startEdit(g)} title="Edit"
                          style={{ background:"transparent", border:"none", color:GOLD_DIM, cursor:"pointer",
                            fontSize:"0.78rem", padding:"0.1rem 0.25rem" }}>✎</button>
                      </>
                    )}
                  </div>
                );
              })}
              {/* Totals row */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 150px 50px 90px 130px 1fr 30px",
                padding:"0.65rem 1rem", backgroundColor:DARK, borderTop:`1px solid ${GOLD_DIM}`, gap:"0.75rem", minWidth:900 }}>
                <span style={{ fontSize:"0.72rem", color:GOLD, fontVariant:"small-caps", letterSpacing:"0.08em", fontWeight:600 }}>
                  Total {filter !== "all" ? `(${filter})` : ""}
                </span>
                <span />
                <span style={{ display:"flex", flexDirection:"column", lineHeight:1.15 }}>
                  <span style={{ fontSize:"1.05rem", color:"#7dc87d", fontWeight:700, fontVariant:"tabular-nums" }}>{peopleTotals.filtered}</span>
                  <span style={{ fontSize:"0.6rem", color:GOLD_DIM, fontVariant:"small-caps", letterSpacing:"0.06em" }}>people</span>
                </span>
                <span style={{ fontSize:"0.85rem", color:GOLD, textAlign:"center", fontWeight:600 }}>{peopleTotals.filtered}</span>
                <span />
                <span />
                <span style={{ fontSize:"0.7rem", color:GOLD_DIM }}>
                  {peopleTotals.invited} invited (people)
                </span>
                <span />
              </div>
            </div>

            {/* Unexpected RSVPs — needs triage */}
            {unexpected.length > 0 && (
              <div style={{ marginTop:"1.75rem" }}>
                <p style={{ fontSize:"0.75rem", color:"#e0b85a", letterSpacing:"0.1em", fontVariant:"small-caps", marginBottom:"0.65rem" }}>
                  ⚠ Needs triage — RSVPs not matched to a guest · set who invited them + guest count, then add to the list
                </p>
                <div style={{ border:`1px solid rgba(224,184,90,0.4)`, overflowX:"auto" }}>
                  {unexpected.map((g, i) => {
                    const key = g.fullName + i;
                    const src = triageSource[key] || "Baruh";
                    const party = triageParty[key] || (g.rsvpParty && g.rsvpParty > 0 ? g.rsvpParty : 1);
                    const busy = addingTriage === key;
                    return (
                    <div key={key} style={{
                      display:"grid", gridTemplateColumns:"1.3fr 130px 120px 70px 150px 120px",
                      padding:"0.6rem 1rem", alignItems:"center", gap:"0.75rem", minWidth:820,
                      borderBottom: i < unexpected.length-1 ? `1px solid rgba(168,138,50,0.12)` : "none",
                    }}>
                      <span style={{ fontSize:"0.88rem", color:GOLD, fontStyle:"italic", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {g.fullName}
                      </span>
                      <StatusBadge status={g.effectiveStatus as keyof typeof STATUS_CFG} />
                      {/* Sent from — who invited them */}
                      <select value={src} onChange={e => setTriageSource(s => ({ ...s, [key]: e.target.value }))}
                        title="Who invited them (Sent from)"
                        style={{ fontSize:"0.72rem", color:GOLD, background:DARK, border:`1px solid rgba(168,138,50,0.5)`,
                          padding:"0.2rem 0.3rem", fontVariant:"small-caps", letterSpacing:"0.04em",
                          fontFamily:serif.style.fontFamily, cursor:"pointer" }}>
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {/* Number of guests */}
                      <input type="number" min={1} value={party}
                        onChange={e => setTriageParty(p => ({ ...p, [key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                        title="Number of guests"
                        style={{ width:"100%", background:"transparent", border:`1px solid rgba(168,138,50,0.5)`,
                          color:GOLD, fontSize:"0.8rem", padding:"0.2rem 0.35rem",
                          fontFamily:serif.style.fontFamily, outline:"none" }} />
                      <span style={{ fontSize:"0.65rem", color:"#7dc87d", opacity:0.8 }}>
                        RSVP{g.statusDate ? ` · ${g.statusDate}` : ""}
                      </span>
                      <button onClick={() => addFromTriage(g, key)} disabled={busy}
                        style={{ fontSize:"0.68rem", padding:"0.32rem 0.5rem", cursor: busy ? "default" : "pointer",
                          background: busy ? "transparent" : GOLD, color: busy ? GOLD_DIM : BLACK,
                          border:`1px solid ${GOLD}`, fontVariant:"small-caps", letterSpacing:"0.05em",
                          fontFamily:serif.style.fontFamily }}>
                        {busy ? "Adding…" : "+ Add to list"}
                      </button>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p style={{ color:GOLD_DIM, fontSize:"0.65rem", textAlign:"right", marginTop:"0.9rem", fontStyle:"italic" }}>
              Updated: {lastFetch} · {filtered.length} of {counts.total} shown
            </p>
          </>
        )}
      </div>
    </div>
  );
}
