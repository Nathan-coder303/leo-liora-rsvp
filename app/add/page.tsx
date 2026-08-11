"use client";

import { useState, useEffect } from "react";
import { Cinzel, Cormorant_Garamond } from "next/font/google";

const display = Cinzel({ weight: ["400","700"], subsets: ["latin"] });
const serif   = Cormorant_Garamond({ weight: ["400","500"], subsets: ["latin"] });

const GOLD     = "#c8a84a";
const GOLD_DIM = "#a88a32";
const DARK     = "#111008";
const BLACK    = "#080808";

const SOURCES = ["Kanter", "Leo", "Liora"] as const;
const SITE_BASE = "https://leo-liora-rsvp.vercel.app";
const DEFAULT_TEMPLATE =
  `Hi {name}! 💍\nLeo & Liora are getting married on August 13, 2026 at the Shul of Bal Harbour. We'd love for you to celebrate with us.\n\nPlease RSVP here: {link}`;

type LastAdded = { sheetRow: number; fullName: string; firstName: string; phone: string; sent: boolean };

type StatGuest = {
  sheetRow: number;
  firstName: string;
  lastName: string;
  fullName: string;
  invitedBy: string;
  partySize: number;
  phone: string;
  firstOpened: string;
  sentAt: string;
  manualStatus: string;
  effectiveStatus: "attending" | "committed" | "declined" | "fyi" | "pending" | "removed";
  rsvpParty: number | null;
  rsvpAttending: string | null;
  rsvpDate: string | null;
  cycleCount: number;
  lastContactedAt: string;
};

type StatKey = "invited" | "opened" | "attending" | "committed" | "declined" | "pending" | null;

export default function AddGuestPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [partySize, setPartySize] = useState(2); // Mr & Mrs default = couple
  const [source,    setSource]    = useState("Liora");
  const [phone,     setPhone]     = useState("");
  const [mr,        setMr]        = useState(true);
  const [mrs,       setMrs]       = useState(true);

  // Keep party size in sync with the checkboxes: both → 2, one → 1
  // (User can still manually type a higher number for families, but flipping a checkbox re-syncs)
  useEffect(() => {
    if (mr && mrs) setPartySize(2);
    else if (mr || mrs) setPartySize(1);
  }, [mr, mrs]);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null);
  const [template,  setTemplate]  = useState(DEFAULT_TEMPLATE);
  const [allGuests, setAllGuests] = useState<StatGuest[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [openStat, setOpenStat] = useState<StatKey>(null);

  // Build the personalized invitation message for any guest in the stats list
  function buildMessageFor(g: { sheetRow: number; firstName: string; fullName: string }) {
    const link = `${SITE_BASE}/?g=${g.sheetRow}`;
    return template
      .replace(/\{name\}/g, g.firstName || g.fullName.split(" ")[0] || "")
      .replace(/\{fullName\}/g, g.fullName)
      .replace(/\{link\}/g, link);
  }

  function whatsappURLFor(g: StatGuest) {
    const text = encodeURIComponent(buildMessageFor(g));
    const phone = (g.phone || "").replace(/[^\d]/g, "");
    if (!phone) return `https://wa.me/?text=${text}`;
    return `https://wa.me/${phone}?text=${text}`;
  }

  // Increment cycle + stamp lastContactedAt for a specific guest (matches /send-it recordContact behavior)
  async function recordContactFor(g: StatGuest) {
    const stamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month:"2-digit", day:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit", hour12:true,
    });
    setAllGuests(prev => prev.map(x => x.sheetRow === g.sheetRow
      ? { ...x, cycleCount: (x.cycleCount || 0) + 1, lastContactedAt: stamp, sentAt: x.sentAt || stamp }
      : x));
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName || g.fullName.split(" ")[0],
          lastName:  g.lastName  || g.fullName.split(" ").slice(1).join(" "),
          manualStatus: "", prevManualStatus: "",
          markSent: !g.sentAt,
          incrementCycle: true,
        }),
      });
    } catch {}
  }

  function sendWhatsAppFor(g: StatGuest) {
    if (!g.phone) return;
    const url = whatsappURLFor(g);
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    recordContactFor(g);
  }

  function sendSMSFor(g: StatGuest) {
    if (!g.phone) return;
    const body = encodeURIComponent(buildMessageFor(g));
    const phone = g.phone.replace(/[^\d]/g, "");
    window.location.href = `sms:+${phone}?&body=${body}`;
    recordContactFor(g);
  }

  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  async function copyMessageFor(g: StatGuest) {
    const text = buildMessageFor(g);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopiedRow(g.sheetRow);
    setTimeout(() => setCopiedRow(prev => prev === g.sheetRow ? null : prev), 2000);
  }

  // Reassign a guest's "invited by" — helpers use this if they picked the wrong source when adding
  async function reassign(g: StatGuest, newSource: string) {
    // Optimistic: update local state so the list reflects the change instantly
    setAllGuests(prev => prev.map(x => x.sheetRow === g.sheetRow ? { ...x, invitedBy: newSource } : x));
    try {
      const [first, ...rest] = g.fullName.split(" ");
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: first, lastName: rest.join(" "),
          // Preserve the existing manual status — reassigning invited-by must not clear it
          manualStatus: g.manualStatus || "", prevManualStatus: g.manualStatus || "",
          invitedBy: newSource,
        }),
      });
    } catch {}
  }

  async function saveStatus(g: StatGuest, newStatus: string) {
    // Optimistic: update local state + recompute effectiveStatus so the row reflects instantly
    setAllGuests(prev => prev.map(x => x.sheetRow === g.sheetRow
      ? { ...x, manualStatus: newStatus,
          effectiveStatus: newStatus.toLowerCase() === "yes"       ? "attending"
                         : newStatus.toLowerCase() === "committed" ? "committed"
                         : newStatus.toLowerCase() === "no"        ? "declined"
                         : newStatus.toLowerCase() === "fyi"       ? "fyi"
                         : newStatus.toLowerCase() === "removed"   ? "removed"
                         : x.rsvpAttending
                            ? (x.rsvpAttending.toLowerCase() === "yes" ? "attending" : "declined")
                            : "pending",
        }
      : x));
    try {
      const [first, ...rest] = g.fullName.split(" ");
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: first, lastName: rest.join(" "),
          manualStatus: newStatus, prevManualStatus: g.manualStatus || "",
          invitedBy: g.invitedBy || source,
        }),
      });
    } catch {}
  }

  // Load guest list for the stats panel — refreshes when the source dropdown changes
  const refreshStats = async () => {
    try {
      const res = await fetch("/api/guests");
      if (!res.ok) return;
      const data = await res.json();
      setAllGuests(data.guests);
      setStatsLoaded(true);
    } catch {}
  };
  useEffect(() => { refreshStats(); }, []);

  // Pull the shared invite template from the Settings tab so we send the same message everyone else does
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = await res.json();
        const t = data.settings?.inviteTemplate;
        if (typeof t === "string" && t.length > 0) setTemplate(t);
      } catch {}
    })();
  }, []);

  async function handleAdd() {
    if (!firstName.trim()) return;
    setSaving(true); setError("");
    try {
      const titleOverride = mr && mrs ? "" : mr ? "mr" : mrs ? "mrs" : "none";
      const res = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, partySize, invitedBy: source, phone, titleOverride }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? `Failed (HTTP ${res.status})`); return; }
      const cleanedPhone = phone.replace(/[^\d]/g, "");
      setLastAdded({
        sheetRow: data.sheetRow,
        fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        firstName: firstName.trim(),
        phone: cleanedPhone,
        sent: false,
      });
      setFirstName(""); setLastName(""); setPartySize(2); setPhone(""); setMr(true); setMrs(true);
      // Update stats after successful add
      refreshStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add.");
    } finally {
      setSaving(false);
    }
  }

  function buildMessage(la: LastAdded) {
    const link = `${SITE_BASE}/?g=${la.sheetRow}`;
    return template
      .replace(/\{name\}/g, la.firstName)
      .replace(/\{fullName\}/g, la.fullName)
      .replace(/\{link\}/g, link);
  }

  function whatsappURL(la: LastAdded) {
    const text = encodeURIComponent(buildMessage(la));
    if (!la.phone) return `https://wa.me/?text=${text}`;
    return `https://wa.me/${la.phone}?text=${text}`;
  }

  async function markSent(la: LastAdded) {
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: la.sheetRow, firstName: la.fullName.split(" ")[0], lastName: la.fullName.split(" ").slice(1).join(" "),
          manualStatus: "", prevManualStatus: "", markSent: true,
        }),
      });
    } catch {}
  }

  function sendWhatsApp() {
    if (!lastAdded) return;
    const url = whatsappURL(lastAdded);
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    if (!lastAdded.sent) {
      setLastAdded({ ...lastAdded, sent: true });
      markSent(lastAdded);
    }
  }

  function sendSMS() {
    if (!lastAdded) return;
    const body = encodeURIComponent(buildMessage(lastAdded));
    // sms: URI — opens native Messages app with recipient and body pre-filled
    const url = lastAdded.phone
      ? `sms:+${lastAdded.phone}?&body=${body}`
      : `sms:?&body=${body}`;
    window.location.href = url;
    if (!lastAdded.sent) {
      setLastAdded({ ...lastAdded, sent: true });
      markSent(lastAdded);
    }
  }

  const [copied, setCopied] = useState(false);
  async function copyMessage() {
    if (!lastAdded) return;
    const text = buildMessage(lastAdded);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const labelStyle: React.CSSProperties = {
    display:"block", fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em",
    fontVariant:"small-caps", marginBottom:"0.35rem",
  };
  const inputStyle: React.CSSProperties = {
    width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
    color:GOLD, fontSize:"0.95rem", padding:"0.55rem 0.7rem",
    fontFamily:serif.style.fontFamily, outline:"none",
  };

  return (
    <div className={serif.className} style={{ minHeight:"100vh", backgroundColor:BLACK, color:GOLD, padding:"2.5rem 1rem" }}>
      <style>{`* { box-sizing:border-box; } ::placeholder { color:${GOLD_DIM}; opacity:0.55; } select option { background:${DARK}; color:${GOLD}; }`}</style>

      <div style={{ maxWidth:440, margin:"0 auto" }}>
        <p className={display.className} style={{ fontSize:"clamp(1.1rem,3.5vw,1.7rem)", letterSpacing:"0.15em", textAlign:"center", marginBottom:"0.35rem" }}>LEO &amp; LIORA</p>
        <p style={{ color:GOLD_DIM, fontSize:"0.7rem", letterSpacing:"0.1em", fontVariant:"small-caps", textAlign:"center" }}>Add Guest</p>
        <div style={{ height:1, backgroundColor:GOLD_DIM, opacity:0.25, margin:"1rem 0 1.5rem" }} />

        {/* Stats + always-visible editable table of the current source's guests */}
        {(() => {
          const mine = allGuests.filter(g => g.invitedBy === source && g.effectiveStatus !== "removed");
          const attending = mine.filter(g => g.effectiveStatus === "attending");
          const committed = mine.filter(g => g.effectiveStatus === "committed");
          const declined  = mine.filter(g => g.effectiveStatus === "declined");
          const opened    = mine.filter(g => !!g.firstOpened);
          const notResp   = mine.filter(g => g.effectiveStatus !== "attending" && g.effectiveStatus !== "committed" && g.effectiveStatus !== "declined" && g.effectiveStatus !== "fyi");
          const attendingPeople = attending.reduce((sum, g) => sum + (g.rsvpParty && g.rsvpParty > 0 ? g.rsvpParty : (g.partySize || 1)), 0);
          const committedPeople = committed.reduce((sum, g) => sum + (g.partySize || 1), 0);
          const totalPeople     = mine.reduce((sum, g) => sum + (g.partySize || 1), 0);

          // openStat now acts as a persistent status filter — default null = All
          const activeList: StatGuest[] = openStat === "opened"    ? opened
                          : openStat === "attending" ? attending
                          : openStat === "committed" ? committed
                          : openStat === "declined"  ? declined
                          : openStat === "pending"   ? notResp
                          :                            mine; // default (null or "invited") shows all

          const Stat = ({ k, label, value, sub, color }: {
            k: Exclude<StatKey, null>; label: string; value: number | string; sub?: string; color?: string;
          }) => {
            const isActive = openStat === k || (k === "invited" && openStat === null);
            return (
              <button onClick={() => setOpenStat(k === "invited" ? null : k)}
                title={`Show only ${label}`}
                style={{ flex:"1 1 60px", minWidth:60, padding:"0.55rem 0.35rem", textAlign:"center",
                  backgroundColor: isActive ? "rgba(200,168,74,0.1)" : DARK,
                  border:`1px solid ${isActive ? GOLD : GOLD_DIM}`,
                  cursor:"pointer", transition:"all 0.15s",
                  fontFamily:"inherit" }}>
                <p style={{ fontSize:"1.2rem", color:color || GOLD, fontWeight:600, lineHeight:1, margin:0 }}>{value}</p>
                <p style={{ fontSize:"0.55rem", color:GOLD_DIM, letterSpacing:"0.08em", fontVariant:"small-caps", marginTop:"0.2rem" }}>{label}</p>
                {sub && <p style={{ fontSize:"0.5rem", color:GOLD_DIM, opacity:0.7, marginTop:"0.1rem" }}>{sub}</p>}
              </button>
            );
          };

          const activeLabel = openStat === null ? "All Guests"
            : ({ invited:"All Guests", opened:"Opened", attending:"Attending", committed:"Committed", declined:"Declined", pending:"No Response" } as Record<Exclude<StatKey,null>,string>)[openStat];

          return (
            <div style={{ marginBottom:"1.5rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"0.5rem" }}>
                <p style={{ fontSize:"0.68rem", color:GOLD_DIM, fontVariant:"small-caps", letterSpacing:"0.1em", margin:0 }}>
                  Your Guests · <span style={{ color:GOLD }}>{source}</span>
                </p>
                <button onClick={refreshStats} disabled={!statsLoaded}
                  style={{ background:"transparent", color:GOLD_DIM, border:"none", cursor:"pointer",
                    fontSize:"0.65rem", padding:0, fontStyle:"italic" }}>
                  {statsLoaded ? "↻ refresh" : "loading…"}
                </button>
              </div>
              <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}>
                <Stat k="invited"   label="Invited"     value={mine.length}       sub={`${totalPeople} people`} />
                <Stat k="opened"    label="Opened"      value={opened.length}     color="#7dc87d" />
                <Stat k="attending" label="Attending"   value={attending.length}  sub={`${attendingPeople} people`} color="#7dc87d" />
                <Stat k="committed" label="Committed"   value={committed.length}  sub={`${committedPeople} people`} color="#b18ad9" />
                <Stat k="declined"  label="Declined"    value={declined.length}   color="#d97777" />
                <Stat k="pending"   label="No Response" value={notResp.length}    color={GOLD} />
              </div>

              {/* Always-visible editable table of the current filter's guests */}
              <div style={{ marginTop:"0.6rem", border:`1px solid ${GOLD_DIM}`, backgroundColor:DARK,
                maxHeight:"420px", overflowY:"auto", overflowX:"auto" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:"0.5rem",
                  padding:"0.5rem 0.7rem", borderBottom:`1px solid ${GOLD_DIM}`, fontSize:"0.62rem", color:GOLD_DIM,
                  fontVariant:"small-caps", letterSpacing:"0.08em", backgroundColor:"rgba(200,168,74,0.04)",
                  alignItems:"center" }}>
                  <span>{activeLabel} ({activeList.length})</span>
                  <span>Status</span>
                  <span>Send</span>
                  <span>Invited By</span>
                </div>
                {activeList.length === 0 ? (
                  <p style={{ padding:"0.7rem", fontSize:"0.75rem", color:GOLD_DIM, fontStyle:"italic", textAlign:"center" }}>
                    None yet.
                  </p>
                ) : activeList
                    .slice()
                    .sort((a, b) => a.fullName.localeCompare(b.fullName))
                    .map((g, i) => {
                      const status = g.effectiveStatus;
                      const chipColor = status === "attending" ? "#7dc87d"
                                      : status === "committed" ? "#b18ad9"
                                      : status === "declined"  ? "#d97777"
                                      : status === "fyi"       ? "#88aadd"
                                      : GOLD_DIM;
                      const chipBorder = status === "attending" ? "rgba(100,180,100,0.4)"
                                       : status === "committed" ? "rgba(177,138,217,0.4)"
                                       : status === "declined"  ? "rgba(200,80,80,0.4)"
                                       : status === "fyi"       ? "rgba(120,160,220,0.4)"
                                       : "rgba(168,138,50,0.4)";
                      return (
                        <div key={g.sheetRow} style={{
                          display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:"0.5rem", alignItems:"center",
                          padding:"0.5rem 0.7rem", fontSize:"0.78rem",
                          borderBottom: i < activeList.length-1 ? "1px solid rgba(168,138,50,0.12)" : "none" }}>
                          <span style={{ color:GOLD, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {g.fullName}
                            {g.partySize > 1 && <span style={{ color:GOLD_DIM, marginLeft:"0.35rem", fontSize:"0.7rem" }}>× {g.partySize}</span>}
                            {g.firstOpened && <span title={`Opened ${g.firstOpened}`} style={{ marginLeft:"0.35rem", fontSize:"0.65rem", color:"#7dc87d" }}>👁</span>}
                            {g.cycleCount > 0 && (
                              <span title={`Contacted ${g.cycleCount} time${g.cycleCount>1?"s":""}${g.lastContactedAt?` — last on ${g.lastContactedAt}`:""}`}
                                style={{ marginLeft:"0.35rem", fontSize:"0.58rem",
                                  color: g.cycleCount === 1 ? GOLD_DIM : g.cycleCount === 2 ? "#88aadd" : "#d97777",
                                  border:`1px solid ${g.cycleCount === 1 ? GOLD_DIM : g.cycleCount === 2 ? "rgba(120,160,220,0.4)" : "rgba(217,119,119,0.4)"}`,
                                  borderRadius:"2px", padding:"0 0.25rem" }}>
                                C{g.cycleCount}
                              </span>
                            )}
                          </span>
                          <select value={g.manualStatus || ""} onChange={e => saveStatus(g, e.target.value)}
                            title="Set status"
                            style={{ fontSize:"0.66rem", color:chipColor, background:DARK,
                              border:`1px solid ${chipBorder}`, padding:"0.15rem 0.3rem",
                              fontVariant:"small-caps", letterSpacing:"0.05em",
                              fontFamily:serif.style.fontFamily, cursor:"pointer", whiteSpace:"nowrap" }}>
                            <option value="">— {g.rsvpAttending ? `RSVP: ${g.rsvpAttending}` : "auto"}</option>
                            <option value="Yes">✓ Attending</option>
                            <option value="Committed">◆ Committed</option>
                            <option value="No">✗ Declined</option>
                            <option value="FYI">○ FYI</option>
                            <option value="Removed">⊘ Removed</option>
                          </select>
                          {/* Send actions — WhatsApp / Text / Copy — each increments cycle */}
                          <span style={{ display:"flex", gap:"0.3rem", alignItems:"center" }}>
                            <button onClick={() => sendWhatsAppFor(g)} disabled={!g.phone}
                              title={g.phone ? `Resend WhatsApp (cycle ${g.cycleCount + 1})` : "No phone"}
                              style={{ padding:"0.32rem 0.55rem", fontSize:"0.72rem", cursor: g.phone ? "pointer" : "not-allowed",
                                background: g.phone ? "#25D366" : "transparent",
                                color: g.phone ? "white" : GOLD_DIM,
                                border:`1px solid ${g.phone ? "#25D366" : GOLD_DIM}`,
                                fontWeight:600, letterSpacing:"0.05em",
                                opacity: g.phone ? 1 : 0.4 }}>WA</button>
                            <button onClick={() => sendSMSFor(g)} disabled={!g.phone}
                              title={g.phone ? `Resend SMS (cycle ${g.cycleCount + 1})` : "No phone"}
                              style={{ padding:"0.32rem 0.5rem", fontSize:"0.85rem", cursor: g.phone ? "pointer" : "not-allowed",
                                background: g.phone ? "#3478F6" : "transparent",
                                color: g.phone ? "white" : GOLD_DIM,
                                border:`1px solid ${g.phone ? "#3478F6" : GOLD_DIM}`,
                                opacity: g.phone ? 1 : 0.4, lineHeight:1 }}>💬</button>
                            <button onClick={() => copyMessageFor(g)}
                              title="Copy personalized message"
                              style={{ padding:"0.32rem 0.5rem", fontSize:"0.85rem", cursor:"pointer",
                                background: copiedRow === g.sheetRow ? "#7dc87d" : "transparent",
                                color: copiedRow === g.sheetRow ? BLACK : GOLD_DIM,
                                border:`1px solid ${copiedRow === g.sheetRow ? "#7dc87d" : GOLD_DIM}`, lineHeight:1 }}>
                              {copiedRow === g.sheetRow ? "✓" : "📋"}
                            </button>
                          </span>
                          <select value={g.invitedBy || source} onChange={e => reassign(g, e.target.value)}
                            title="Reassign this guest to a different invited-by"
                            style={{ fontSize:"0.65rem", color:GOLD_DIM, background:DARK,
                              border:`1px solid rgba(168,138,50,0.4)`, padding:"0.15rem 0.3rem",
                              fontVariant:"small-caps", letterSpacing:"0.04em",
                              fontFamily:serif.style.fontFamily, cursor:"pointer" }}>
                            {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      );
                    })}
              </div>

              {mine.length === 0 && statsLoaded && (
                <p style={{ color:GOLD_DIM, fontSize:"0.7rem", textAlign:"center", marginTop:"0.5rem", fontStyle:"italic" }}>
                  No guests added under <span style={{ color:GOLD }}>{source}</span> yet.
                </p>
              )}
            </div>
          );
        })()}

        {lastAdded && (
          <div style={{ marginBottom:"1.5rem", padding:"0.85rem 1rem",
            border:"1px solid rgba(125,200,125,0.4)", background:"rgba(125,200,125,0.06)", textAlign:"center" }}>
            <p style={{ color:"#7dc87d", fontSize:"0.85rem", margin:0 }}>
              ✓ Added <strong style={{ color:GOLD }}>{lastAdded.fullName}</strong> to the guest list.
            </p>
            <button onClick={() => setLastAdded(null)}
              style={{ marginTop:"0.55rem", padding:"0.3rem 0.85rem", cursor:"pointer", fontSize:"0.68rem",
                fontVariant:"small-caps", letterSpacing:"0.06em", fontFamily:serif.style.fontFamily,
                background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}` }}>
              Add another
            </button>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:"1.1rem" }}>
          <div>
            <label style={labelStyle}>First Name *</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" autoFocus style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Last Name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" style={inputStyle} />
            <div style={{ display:"flex", gap:"1.1rem", marginTop:"0.55rem", fontSize:"0.78rem", color:GOLD_DIM }}>
              <label style={{ display:"flex", alignItems:"center", gap:"0.35rem", cursor:"pointer", userSelect:"none" }}>
                <input type="checkbox" checked={mr}  onChange={e => setMr(e.target.checked)}
                  style={{ accentColor:GOLD, cursor:"pointer", width:15, height:15 }} />
                Mr
              </label>
              <label style={{ display:"flex", alignItems:"center", gap:"0.35rem", cursor:"pointer", userSelect:"none" }}>
                <input type="checkbox" checked={mrs} onChange={e => setMrs(e.target.checked)}
                  style={{ accentColor:GOLD, cursor:"pointer", width:15, height:15 }} />
                Mrs
              </label>
              <span style={{ fontSize:"0.7rem", fontStyle:"italic", opacity:0.7 }}>
                Invitation reads &ldquo;{mr && mrs ? "Mr. & Mrs." : mr ? "Mr." : mrs ? "Mrs." : ""} {lastName || "[last name]"}&rdquo;
              </span>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
            <div>
              <label style={labelStyle}>Party Size</label>
              <input type="number" min={1} value={partySize}
                onChange={e => setPartySize(Math.max(1, parseInt(e.target.value) || 1))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Invited By</label>
              <select value={source} onChange={e => setSource(e.target.value)}
                style={{ ...inputStyle, background:DARK, cursor:"pointer" }}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Phone <span style={{ opacity:0.65, letterSpacing:0, textTransform:"none" }}>(country code, digits only)</span></label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="13055551234" style={inputStyle} />
          </div>

          {error && <p style={{ color:"#d97777", fontSize:"0.85rem", margin:0 }}>✗ {error}</p>}

          <button onClick={handleAdd} disabled={saving || !firstName.trim()} style={{
            padding:"0.85rem", cursor:"pointer", fontSize:"0.85rem",
            fontVariant:"small-caps", letterSpacing:"0.14em", fontFamily:serif.style.fontFamily,
            background:`linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DIM} 100%)`,
            color:BLACK, border:"none", transition:"opacity 0.2s",
            opacity:(!firstName.trim() || saving) ? 0.4 : 1,
          }}>
            {saving ? "Adding…" : "Add Guest"}
          </button>

          {/* Always-visible send buttons — greyed until a guest has just been added */}
          {(() => {
            const hasGuest = !!lastAdded;
            const canWhatsApp = hasGuest && !!lastAdded!.phone;
            const canCopy = hasGuest;
            return (
              <>
                <button onClick={sendWhatsApp} disabled={!canWhatsApp}
                  title={
                    !hasGuest ? "Add a guest first — then send the invitation here"
                    : !lastAdded!.phone ? "This guest has no phone — edit them in the tracker to add one"
                    : "Send the WhatsApp invitation now"
                  }
                  style={{
                    padding:"0.8rem", cursor: canWhatsApp ? "pointer" : "not-allowed",
                    fontSize:"0.8rem", fontVariant:"small-caps", letterSpacing:"0.1em",
                    fontFamily:serif.style.fontFamily,
                    background: canWhatsApp ? "#25D366" : "transparent",
                    color: canWhatsApp ? "white" : GOLD_DIM,
                    border:`1px solid ${canWhatsApp ? "#25D366" : GOLD_DIM}`,
                    opacity: canWhatsApp ? 1 : 0.55, transition:"all 0.2s",
                  }}>
                  {lastAdded?.sent ? "✓ Sent — send WhatsApp again?" : "Send WhatsApp Invitation →"}
                </button>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" }}>
                  <button onClick={sendSMS} disabled={!canWhatsApp}
                    title={
                      !hasGuest ? "Add a guest first"
                      : !lastAdded!.phone ? "This guest has no phone"
                      : "Open Messages app with the invitation pre-filled"
                    }
                    style={{
                      padding:"0.7rem 0.5rem", cursor: canWhatsApp ? "pointer" : "not-allowed",
                      fontSize:"0.72rem", fontVariant:"small-caps", letterSpacing:"0.08em",
                      fontFamily:serif.style.fontFamily,
                      background: canWhatsApp ? "#3478F6" : "transparent",
                      color: canWhatsApp ? "white" : GOLD_DIM,
                      border:`1px solid ${canWhatsApp ? "#3478F6" : GOLD_DIM}`,
                      opacity: canWhatsApp ? 1 : 0.55, transition:"all 0.2s",
                    }}>
                    💬 Text (SMS)
                  </button>

                  <button onClick={copyMessage} disabled={!canCopy}
                    title={hasGuest ? "Copy the invitation message so you can paste it anywhere" : "Add a guest first"}
                    style={{
                      padding:"0.7rem 0.5rem", cursor: canCopy ? "pointer" : "not-allowed",
                      fontSize:"0.72rem", fontVariant:"small-caps", letterSpacing:"0.08em",
                      fontFamily:serif.style.fontFamily,
                      background: copied ? "#7dc87d" : "transparent",
                      color: copied ? BLACK : (canCopy ? GOLD : GOLD_DIM),
                      border:`1px solid ${copied ? "#7dc87d" : (canCopy ? GOLD : GOLD_DIM)}`,
                      opacity: canCopy ? 1 : 0.55, transition:"all 0.2s",
                    }}>
                    {copied ? "✓ Copied!" : "📋 Copy Message"}
                  </button>
                </div>
              </>
            );
          })()}

          {!lastAdded && (
            <p style={{ color:GOLD_DIM, fontSize:"0.68rem", textAlign:"center", margin:0, fontStyle:"italic", opacity:0.7 }}>
              Fill in the fields above → tap <span style={{ color:GOLD }}>Add Guest</span>. Then choose <span style={{ color:"#25D366" }}>WhatsApp</span>, <span style={{ color:"#3478F6" }}>Text (SMS)</span>, or <span style={{ color:GOLD }}>Copy Message</span> to send the invitation.
            </p>
          )}
        </div>

        <p style={{ color:GOLD_DIM, fontSize:"0.65rem", textAlign:"center", marginTop:"2rem", fontStyle:"italic", opacity:0.7 }}>
          Guests added here go straight into the tracker with a timestamp.
        </p>
      </div>
    </div>
  );
}
