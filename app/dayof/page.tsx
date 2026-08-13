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

const SITE_BASE = "https://leo-liora-rsvp.vercel.app";
const MSG_KEY   = "leo-liora-dayof-message";
const DEFAULT_MSG =
  `Hi {name}! 💍\nWe can't wait to celebrate Leo & Liora's wedding with you.\n\nDetails & RSVP: {link}`;

type Guest = {
  sheetRow: number;
  firstName: string;
  lastName: string;
  fullName: string;
  partySize: number;
  invitedBy: string;
  phone: string;
  sentAt: string;
  cycleCount: number;
  lastContactedAt: string;
  manualStatus: string;
  effectiveStatus: "attending" | "committed" | "declined" | "fyi" | "pending" | "removed";
};

// Display phone with a + prefix for any non-US number (more than 10 digits) — matches the Send tab
function displayPhone(p: string): string {
  if (!p) return "";
  const digits = p.replace(/[^\d]/g, "");
  return digits.length > 10 ? `+${digits}` : digits;
}

export default function DayOfPage() {
  const [guests,  setGuests]  = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  const [message, setMessage] = useState(DEFAULT_MSG);
  const [photo,     setPhoto]     = useState<File | null>(null);
  const [photoURL,  setPhotoURL]  = useState("");
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Detect whether this device can share files (image + text) via the native share sheet
  useEffect(() => {
    try {
      const testFile = new File([""], "x.png", { type: "image/png" });
      setCanShareFiles(!!navigator.canShare && navigator.canShare({ files: [testFile] }));
    } catch { setCanShareFiles(false); }
  }, []);

  // Persist the composed message across reloads
  useEffect(() => {
    try { const saved = localStorage.getItem(MSG_KEY); if (saved) setMessage(saved); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(MSG_KEY, message); } catch {}
  }, [message]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/guests");
        if (!res.ok) throw new Error();
        const data = await res.json();
        // Everyone EXCEPT Baruh's guests. Blank invitedBy counts as Baruh, so
        // an unassigned guest stays on the Baruh side rather than appearing here.
        const theirs = (data.guests as Guest[])
          .filter(g => (g.invitedBy || "Baruh") !== "Baruh" && g.effectiveStatus !== "removed")
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        setGuests(theirs);
      } catch { setError("Failed to load guests."); }
      finally { setLoading(false); }
    })();
  }, []);

  function onPickPhoto(file: File | null) {
    setPhoto(file);
    setPhotoURL(prev => { if (prev) URL.revokeObjectURL(prev); return file ? URL.createObjectURL(file) : ""; });
  }

  function inviteURL(g: Guest) {
    return `${SITE_BASE}/?g=${g.sheetRow}`;
  }
  function buildMessage(g: Guest) {
    return message
      .replace(/\{name\}/g, g.firstName)
      .replace(/\{fullName\}/g, g.fullName)
      .replace(/\{link\}/g, inviteURL(g));
  }
  // Same wa.me format as the Send tab
  function whatsappURL(g: Guest) {
    const phone = g.phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(buildMessage(g));
    if (!phone) return `https://wa.me/?text=${text}`;
    return `https://wa.me/${phone}?text=${text}`;
  }

  // Mark sent + bump the contact cycle, just like the Send tab, so tracking stays accurate
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
    const url = whatsappURL(g);
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    recordContact(g);
  }

  function sendSMS(g: Guest) {
    if (!g.phone) return;
    const body = encodeURIComponent(buildMessage(g));
    const phone = g.phone.replace(/[^\d]/g, "");
    window.location.href = `sms:+${phone}?&body=${body}`;
    recordContact(g);
  }

  async function copyMessage(g: Guest) {
    const msg = buildMessage(g);
    try {
      await navigator.clipboard.writeText(msg);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = msg; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopiedRow(g.sheetRow);
    setTimeout(() => setCopiedRow(prev => prev === g.sheetRow ? null : prev), 2500);
  }

  // Share the attached photo + caption via the native share sheet (pick WhatsApp + the contact)
  async function shareWithPhoto(g: Guest) {
    if (!photo) return;
    const text = buildMessage(g);
    try {
      const file = new File([photo], photo.name || "photo.jpg", { type: photo.type || "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ text, files: [file] });
        recordContact(g);
        return;
      }
    } catch (e) {
      // user cancelled the share sheet — don't treat as an error
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    // Fallback (e.g. desktop): copy the caption, download the photo, open WhatsApp chat
    await copyMessage(g);
    downloadPhoto();
    openWhatsApp(g);
  }

  function downloadPhoto() {
    if (!photoURL) return;
    const a = document.createElement("a");
    a.href = photoURL;
    a.download = photo?.name || "wedding-photo.jpg";
    a.click();
  }

  const filtered = guests.filter(g => {
    if (!search) return true;
    const q = search.toLowerCase();
    return g.fullName.toLowerCase().includes(q) || g.phone.includes(search.replace(/[^\d]/g, ""));
  });

  const withPhone = guests.filter(g => g.phone).length;

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
        <p style={{ color:GOLD_DIM, fontSize:"0.75rem", letterSpacing:"0.1em", fontVariant:"small-caps" }}>Day Of · compose &amp; send</p>
        <div style={{ height:1, backgroundColor:GOLD_DIM, opacity:0.25, marginTop:"0.9rem" }} />
      </div>

      <div style={{ maxWidth:900, margin:"0 auto" }}>
        {/* Tabs — Send and Day Of only. Guests, Budget, Baruh and Calendar are
            deliberately not linked here: this page is used on the day itself,
            where a mis-tap into another list is a distraction. */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          {tab("Send",   "/send-it", false)}
          {tab("Day Of", "/dayof", true)}
        </div>

        {/* Composer window */}
        <div style={{ marginBottom:"1.5rem", padding:"1rem", border:`1px solid ${GOLD_DIM}`, backgroundColor:DARK }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.4rem", flexWrap:"wrap", gap:"0.4rem" }}>
            <p style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", margin:0 }}>
              New message — use <code style={{color:GOLD}}>{`{name}`}</code> and <code style={{color:GOLD}}>{`{link}`}</code>
            </p>
            <button onClick={() => setMessage(DEFAULT_MSG)} style={{
              fontSize:"0.6rem", color:GOLD_DIM, background:"transparent", border:"none",
              cursor:"pointer", fontStyle:"italic" }}>reset text</button>
          </div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
            placeholder="Write your message… {name} and {link} get filled in per guest"
            style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
              color:GOLD, fontSize:"0.9rem", padding:"0.5rem 0.6rem",
              fontFamily:serif.style.fontFamily, outline:"none", resize:"vertical" }} />

          {/* Photo attach */}
          <div style={{ marginTop:"0.75rem", display:"flex", gap:"0.75rem", alignItems:"center", flexWrap:"wrap" }}>
            <label style={{ display:"inline-flex", alignItems:"center", gap:"0.4rem", padding:"0.35rem 0.8rem",
              cursor:"pointer", fontSize:"0.72rem", fontVariant:"small-caps", letterSpacing:"0.05em",
              background:"transparent", color:GOLD, border:`1px solid ${GOLD_DIM}` }}>
              📷 {photo ? "Change photo" : "Attach photo"}
              <input type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => onPickPhoto(e.target.files?.[0] ?? null)} />
            </label>
            {photo && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoURL} alt="attachment preview" style={{ height:48, width:48, objectFit:"cover", border:`1px solid ${GOLD_DIM}` }} />
                <span style={{ fontSize:"0.72rem", color:GOLD_DIM, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{photo.name}</span>
                <button onClick={downloadPhoto} style={{ fontSize:"0.66rem", color:"#88aadd", background:"transparent",
                  border:`1px solid rgba(120,160,220,0.4)`, padding:"0.25rem 0.5rem", cursor:"pointer", fontVariant:"small-caps" }}>↓ Download</button>
                <button onClick={() => onPickPhoto(null)} style={{ fontSize:"0.66rem", color:"#d97777", background:"transparent",
                  border:`1px solid rgba(200,80,80,0.4)`, padding:"0.25rem 0.5rem", cursor:"pointer", fontVariant:"small-caps" }}>✕ Remove</button>
              </>
            )}
          </div>
          <p style={{ fontSize:"0.66rem", color:GOLD_DIM, marginTop:"0.6rem", lineHeight:1.5, fontStyle:"italic" }}>
            {photo
              ? (canShareFiles
                  ? "“Send w/ photo” opens your phone’s share sheet with the photo + caption — pick WhatsApp and the contact to send both together."
                  : "This device can’t share files directly. “Send w/ photo” will copy the caption, download the photo, and open the WhatsApp chat — then attach the photo with the 📎 clip.")
              : "Tip: WhatsApp links can only prefill text. To send a picture too, attach one above."}
          </p>
        </div>

        {/* Search + count */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem", gap:"0.75rem", flexWrap:"wrap" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…"
            style={{ flex:"1 1 220px", background:"transparent", border:`1px solid ${GOLD_DIM}`,
              color:GOLD, fontSize:"0.85rem", padding:"0.4rem 0.6rem", fontFamily:serif.style.fontFamily, outline:"none" }} />
          <span style={{ fontSize:"0.68rem", color:GOLD_DIM, fontVariant:"small-caps", letterSpacing:"0.06em" }}>
            {guests.length} guests · {withPhone} with phone
          </span>
        </div>

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
                    {g.partySize > 1 && <span style={{ color:GOLD_DIM, marginLeft:"0.35rem", fontSize:"0.75rem" }}>× {g.partySize}</span>}
                  </span>
                  <div style={{ fontSize:"0.7rem", color: g.phone ? GOLD_DIM : "#d97777", marginTop:"0.15rem" }}>
                    {g.phone ? displayPhone(g.phone) : "no phone"}
                    {g.cycleCount > 0 && <span style={{ marginLeft:"0.5rem", color:"#88aadd" }}>· sent ×{g.cycleCount}{g.lastContactedAt ? ` (${g.lastContactedAt})` : ""}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                  {actionBtn("#25D366", "white", "#25D366", () => openWhatsApp(g), "WhatsApp →", !g.phone)}
                  {photo && actionBtn(GOLD, BLACK, GOLD, () => shareWithPhoto(g), "📷 Send w/ photo")}
                  {actionBtn("#3478F6", "white", "#3478F6", () => sendSMS(g), "💬 Text", !g.phone)}
                  {actionBtn(
                    copiedRow === g.sheetRow ? "#7dc87d" : "transparent",
                    copiedRow === g.sheetRow ? BLACK : GOLD_DIM,
                    copiedRow === g.sheetRow ? "#7dc87d" : GOLD_DIM,
                    () => copyMessage(g),
                    copiedRow === g.sheetRow ? "✓ Copied" : "📋 Copy",
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ color:GOLD_DIM, fontSize:"0.7rem", textAlign:"center", marginTop:"1.5rem", fontStyle:"italic" }}>
          Messages use the same WhatsApp format as the Send tab. Sending here marks the guest as contacted and bumps their cycle count.
        </p>
      </div>
    </div>
  );
}
