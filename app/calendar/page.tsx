"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Cinzel, Cormorant_Garamond } from "next/font/google";

const display = Cinzel({ weight: ["400","700"], subsets: ["latin"] });
const serif   = Cormorant_Garamond({ weight: ["400","500"], subsets: ["latin"] });

const GOLD     = "#c8a84a";
const GOLD_DIM = "#a88a32";
const DARK     = "#111008";
const BLACK    = "#080808";

const ICS_LINK = "https://leo-liora-rsvp.vercel.app/wedding.ics";

type Guest = {
  sheetRow: number;
  firstName: string;
  lastName: string;
  fullName: string;
  partySize: number;
  invitedBy: string;
  phone: string;
  effectiveStatus: string;
  rsvpName: string | null;
  manualStatus: string;
  sentAt: string;
  cycleCount: number;
  lastContactedAt: string;
};

const SOURCES = ["all", "Baruh", "Kanter", "Leo", "Liora"] as const;

function displayPhone(p: string): string {
  if (!p) return "";
  const digits = p.replace(/[^\d]/g, "");
  return digits.length > 10 ? `+${digits}` : digits;
}
const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Greeting: keep a leading Rabbi/Rav title, otherwise just the first name
function greet(full: string): string {
  const p = (full || "").trim().split(/\s+/);
  const t = (p[0] || "").toLowerCase();
  if (["rabbi", "rav", "reb", "rebbetzin"].includes(t) && p.length > 1) return `${p[0]} ${p[1]}`;
  return p[0] || "there";
}
function buildMessage(g: Guest): string {
  return `Hi ${greet(g.fullName)}! 💍 Leo & Liora are getting married Thursday, August 13, 2026 at 5:00 PM at the Shul of Bal Harbour (Surfside, FL). We don't have your email on file — tap to add it to your calendar: ${ICS_LINK}  Can't wait to celebrate with you! 🎉`;
}

export default function CalendarPage() {
  const [guests,  setGuests]  = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [source,  setSource]  = useState<(typeof SOURCES)[number]>("all");
  const [search,  setSearch]  = useState("");
  const [copiedRow, setCopiedRow] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [gRes, rRes] = await Promise.all([
          fetch("/api/guests"),
          fetch("/api/guests/raw?tab=RSVP&range=A:H"),
        ]);
        if (!gRes.ok || !rRes.ok) throw new Error();
        const gData = await gRes.json();
        const rData = await rRes.json();
        // Names that have a valid email on file (from the RSVP tab, column D)
        const withEmail = new Set<string>();
        for (const row of (rData.rows || []).slice(1)) {
          const nm = norm(row[0]); const em = (row[3] || "").trim();
          if (nm && EMAIL_RE.test(em)) withEmail.add(nm);
        }
        // Attending guests with NO email on file
        const noEmail = (gData.guests as Guest[]).filter(g => {
          if (g.effectiveStatus !== "attending") return false;
          const keys = [norm(g.rsvpName || ""), norm(g.fullName)].filter(Boolean);
          return !keys.some(k => withEmail.has(k));
        }).sort((a, b) => (a.invitedBy || "").localeCompare(b.invitedBy || "") || a.fullName.localeCompare(b.fullName));
        setGuests(noEmail);
      } catch { setError("Failed to load guests."); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => guests.filter(g => {
    if (source !== "all" && (g.invitedBy || "Baruh") !== source) return false;
    if (search) {
      const q = search.toLowerCase();
      return g.fullName.toLowerCase().includes(q) || g.phone.includes(search.replace(/[^\d]/g, ""));
    }
    return true;
  }), [guests, source, search]);

  // Mark sent + bump the contact cycle, same as the Send tab
  async function recordContact(g: Guest) {
    const stamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month:"2-digit", day:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", hour12:true,
    });
    setGuests(prev => prev.map(x => x.sheetRow === g.sheetRow
      ? { ...x, sentAt: x.sentAt || stamp, cycleCount: (x.cycleCount || 0) + 1, lastContactedAt: stamp }
      : x));
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName, lastName: g.lastName,
          manualStatus: g.manualStatus || "", prevManualStatus: g.manualStatus || "",
          markSent: !g.sentAt,
          incrementCycle: true,
        }),
      });
    } catch { setError("Failed to record contact."); }
  }

  function openWhatsApp(g: Guest) {
    if (!g.phone) return;
    const phone = g.phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(buildMessage(g));
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    recordContact(g);
  }
  function sendSMS(g: Guest) {
    if (!g.phone) return;
    const phone = g.phone.replace(/[^\d]/g, "");
    window.location.href = `sms:+${phone}?&body=${encodeURIComponent(buildMessage(g))}`;
    recordContact(g);
  }
  async function copyMessage(g: Guest) {
    const msg = buildMessage(g);
    try { await navigator.clipboard.writeText(msg); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = msg; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopiedRow(g.sheetRow);
    setTimeout(() => setCopiedRow(p => p === g.sheetRow ? null : p), 2500);
  }

  const tab = (label: string, href: string, active: boolean) => (
    <Link href={href} style={{
      padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
      fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
      background: active ? GOLD : "transparent", color: active ? BLACK : GOLD_DIM,
      border:`1px solid ${active ? GOLD : GOLD_DIM}` }}>{label}</Link>
  );
  const actionBtn = (bg: string, fg: string, brd: string, onClick: () => void, label: string, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding:"0.32rem 0.7rem", fontSize:"0.74rem", cursor: disabled ? "not-allowed" : "pointer",
      fontVariant:"small-caps", letterSpacing:"0.04em", fontFamily:serif.style.fontFamily,
      background: disabled ? "transparent" : bg, color: disabled ? GOLD_DIM : fg,
      border:`1px solid ${disabled ? GOLD_DIM : brd}`, opacity: disabled ? 0.4 : 1, whiteSpace:"nowrap" }}>
      {label}
    </button>
  );

  return (
    <div className={serif.className} style={{ minHeight:"100vh", backgroundColor:BLACK, color:GOLD, padding:"2rem 1rem" }}>
      <style>{`* { box-sizing:border-box; } ::placeholder { color:${GOLD_DIM}; opacity:0.6; }`}</style>

      <div style={{ maxWidth:900, margin:"0 auto 1.25rem" }}>
        <p className={display.className} style={{ fontSize:"clamp(1.1rem,3.5vw,1.8rem)", letterSpacing:"0.15em", marginBottom:"0.25rem" }}>LEO &amp; LIORA</p>
        <p style={{ color:GOLD_DIM, fontSize:"0.75rem", letterSpacing:"0.1em", fontVariant:"small-caps" }}>Calendar invite · attending guests with no email</p>
        <div style={{ height:1, backgroundColor:GOLD_DIM, opacity:0.25, marginTop:"0.9rem" }} />
      </div>

      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
          {tab("Guests", "/guests", false)}
          {tab("Send",   "/send-it", false)}
          {tab("Budget", "/budget", false)}
          {tab("Baruh",  "/baruh", false)}
          {tab("Calendar", "/calendar", true)}
        </div>

        <p style={{ fontSize:"0.8rem", color:GOLD_DIM, marginBottom:"0.9rem", lineHeight:1.5 }}>
          These attending guests have no email on file, so they didn&apos;t get the emailed invite. Send them the
          calendar link by WhatsApp or text — tapping it adds the wedding to their phone&apos;s calendar.
        </p>

        {/* Source filter */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"0.4rem", marginBottom:"0.6rem" }}>
          {SOURCES.map(s => {
            const count = s === "all" ? guests.length : guests.filter(g => (g.invitedBy || "Baruh") === s).length;
            const active = source === s;
            return (
              <button key={s} onClick={() => setSource(s)} style={{
                padding:"0.42rem 0.3rem", cursor:"pointer", fontSize:"0.72rem", textAlign:"center",
                fontVariant:"small-caps", letterSpacing:"0.05em", fontFamily:serif.style.fontFamily,
                background: active ? GOLD : "transparent", color: active ? BLACK : GOLD_DIM,
                border:`1px solid ${active ? GOLD : GOLD_DIM}` }}>
                {s === "all" ? "All" : s} ({count})
              </button>
            );
          })}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…"
          style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`, marginBottom:"0.9rem",
            color:GOLD, fontSize:"0.85rem", padding:"0.4rem 0.6rem", fontFamily:serif.style.fontFamily, outline:"none" }} />

        {loading ? (
          <p style={{ color:GOLD_DIM, textAlign:"center", padding:"2rem", fontStyle:"italic" }}>Loading…</p>
        ) : error ? (
          <p style={{ color:"#d97777", textAlign:"center", padding:"2rem" }}>{error}</p>
        ) : filtered.length === 0 ? (
          <p style={{ color:GOLD_DIM, textAlign:"center", padding:"2rem", fontStyle:"italic" }}>No guests found.</p>
        ) : (
          <div style={{ border:`1px solid ${GOLD_DIM}` }}>
            {filtered.map((g, i) => (
              <div key={g.sheetRow} style={{
                padding:"0.7rem 1rem", display:"flex", alignItems:"center", gap:"0.6rem", flexWrap:"wrap",
                borderBottom: i < filtered.length-1 ? `1px solid rgba(168,138,50,0.12)` : "none",
                backgroundColor: i%2===0 ? "transparent" : "rgba(200,168,74,0.02)",
                borderLeft: g.phone ? "2px solid transparent" : "2px solid rgba(217,119,119,0.5)" }}>
                <div style={{ flex:"1 1 190px", minWidth:0 }}>
                  <span style={{ fontSize:"0.92rem", color:GOLD }}>
                    {g.fullName}
                    <span style={{ color:GOLD_DIM, marginLeft:"0.4rem", fontSize:"0.62rem", fontVariant:"small-caps", letterSpacing:"0.05em", border:`1px solid ${GOLD_DIM}`, borderRadius:"2px", padding:"0.03rem 0.35rem" }}>{g.invitedBy || "?"}</span>
                  </span>
                  <div style={{ fontSize:"0.7rem", color: g.phone ? GOLD_DIM : "#d97777", marginTop:"0.15rem" }}>
                    {g.phone ? displayPhone(g.phone) : "no phone"}
                    {g.cycleCount > 0 && <span style={{ marginLeft:"0.5rem", color:"#88aadd" }}>· contacted ×{g.cycleCount}{g.lastContactedAt ? ` (${g.lastContactedAt})` : ""}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                  {actionBtn("#25D366", "white", "#25D366", () => openWhatsApp(g), "WhatsApp →", !g.phone)}
                  {actionBtn("#3478F6", "white", "#3478F6", () => sendSMS(g), "💬 Text", !g.phone)}
                  {actionBtn(
                    copiedRow === g.sheetRow ? "#7dc87d" : "transparent",
                    copiedRow === g.sheetRow ? BLACK : GOLD_DIM,
                    copiedRow === g.sheetRow ? "#7dc87d" : GOLD_DIM,
                    () => copyMessage(g),
                    copiedRow === g.sheetRow ? "✓ Copied" : "📋 Copy Link",
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ color:GOLD_DIM, fontSize:"0.7rem", textAlign:"center", marginTop:"1.25rem", fontStyle:"italic" }}>
          {filtered.length} guest{filtered.length !== 1 ? "s" : ""} shown · calendar link: {ICS_LINK}
        </p>
      </div>
    </div>
  );
}
