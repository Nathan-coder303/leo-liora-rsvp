"use client";

import { useState, useRef, useEffect } from "react";
import { Great_Vibes, Cormorant_Garamond, Cinzel } from "next/font/google";

const script  = Great_Vibes({ weight: "400", subsets: ["latin"] });
const serif   = Cormorant_Garamond({ weight: ["300","400","500"], subsets: ["latin"], style: ["normal","italic"] });
const display = Cinzel({ weight: ["400","700","900"], subsets: ["latin"] });

const GOLD       = "#c8a84a";
const GOLD_DIM   = "#a88a32";
const GOLD_LIGHT = "#e8d48a";
const CREAM      = "#f5f0e6";
const BLACK      = "#080808";
const DARK       = "#111008";

// ─── Ornament divider ────────────────────────────────────────────────────────
function Ornament({ width = "70%" }: { width?: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", width, margin:"0.1rem 0" }}>
      <div style={{ flex:1, height:1, backgroundColor:GOLD, opacity:0.5 }} />
      <svg width="22" height="14" viewBox="0 0 44 14" fill="none">
        <path d="M22,7 C19,3 14,3 12,7 C14,11 19,11 22,7 C25,3 30,3 32,7 C30,11 25,11 22,7Z" fill={GOLD}/>
        <line x1="0"  y1="7" x2="10" y2="7" stroke={GOLD} strokeWidth="1"/>
        <line x1="34" y1="7" x2="44" y2="7" stroke={GOLD} strokeWidth="1"/>
      </svg>
      <div style={{ flex:1, height:1, backgroundColor:GOLD, opacity:0.5 }} />
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ textAlign:"center", marginBottom:"2.5rem" }}>
      <h2 className={script.className} style={{ color:GOLD, fontSize:"clamp(2rem,6vw,3rem)", lineHeight:1.1 }}>
        {children}
      </h2>
      <div style={{ width:60, height:1, backgroundColor:GOLD_DIM, margin:"0.75rem auto 0" }} />
    </div>
  );
}

type Phase = "closed" | "opening" | "open";

export default function Home() {
  const [phase,       setPhase]       = useState<Phase>("closed");
  const [cardVisible, setCardVisible] = useState(false);
  const [attending,   setAttending]   = useState<boolean | null>(null);
  const [name,        setName]        = useState("");
  const [partySize,   setPartySize]   = useState(1);
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [song,        setSong]        = useState("");
  const [advice,      setAdvice]      = useState("");
  const [submitted,   setSubmitted]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [muted,       setMuted]       = useState(true);
  const [addressLine, setAddressLine] = useState("");
  const [isLastMinute, setIsLastMinute] = useState(false);

  const scheduleRef = useRef<HTMLDivElement>(null);
  const hotelsRef   = useRef<HTMLDivElement>(null);
  const registryRef = useRef<HTMLDivElement>(null);
  const faqRef      = useRef<HTMLDivElement>(null);
  const rsvpRef     = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    // Full song served from Vercel CDN — no third-party dependency
    audioRef.current.src = "/song.mp3";
    audioRef.current.load();
  }, []);

  // Personalized invite tracking — when opened via /?g=<slug>, log it, set the address line, and pre-fill the name
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("lm") === "1") setIsLastMinute(true);
    const slug = params.get("g");
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch("/api/opens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.fullName) setName(data.fullName);

        // Build formal address line — honors per-guest titleOverride from the sheet
        const first: string = (data.firstName ?? "").trim();
        const last:  string = (data.lastName  ?? "").trim();
        const override: string = (data.titleOverride ?? "").toLowerCase();
        const fLower = first.toLowerCase();
        let title = "Mr. & Mrs.";
        if (/^rabbi\b/i.test(fLower) || /^rav\b/i.test(fLower)) title = "Rabbi & Rebbetzin";
        if (override === "mr")   title = "Mr.";
        else if (override === "mrs")  title = "Mrs.";
        else if (override === "none") title = "";
        if (last) setAddressLine(title ? `${title} ${last}` : last);
        else if (first) setAddressLine(first);
      } catch {}
    })();
  }, []);

  function scrollTo(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  function openEnvelope() {
    if (phase !== "closed") return;
    setPhase("opening");
    // audio.play() called directly inside the click handler — guaranteed by browser
    audioRef.current?.play().then(() => setMuted(false)).catch(() => {});
    setTimeout(() => setCardVisible(true), 900);
    setTimeout(() => setPhase("open"), 1800);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    if (muted) {
      audio.play().catch(() => {});
      setMuted(false);
    } else {
      audio.pause();
      setMuted(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || attending === null) return;
    if (!email.trim() && !phone.trim()) { setError("Please provide at least an email or phone number for reminders."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/rsvp", { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ name, attending, partySize, email, phone, song, advice }) });
      if (!res.ok) throw new Error();

      // Last-minute flow: also add to Guests sheet so they show up in the tracker
      if (isLastMinute) {
        const parts = name.trim().split(/\s+/);
        const firstName = parts[0] ?? "";
        const lastName  = parts.slice(1).join(" ");
        try {
          await fetch("/api/guests", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ firstName, lastName, partySize, invitedBy:"Last-Minute", phone }),
          });
        } catch {} // ignore duplicates / failures — RSVP itself succeeded
      }

      setSubmitted(true);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  const inputStyle: React.CSSProperties = {
    width:"100%", borderBottom:`1px solid ${GOLD_DIM}`,
    padding:"0.5rem 0", color:GOLD_LIGHT, outline:"none",
    backgroundColor:"transparent", fontSize:"1rem", fontFamily:serif.style.fontFamily,
  };
  const labelStyle: React.CSSProperties = {
    display:"block", fontSize:"0.72rem", color:GOLD_DIM,
    marginBottom:"0.25rem", letterSpacing:"0.07em", fontVariant:"small-caps",
  };
  const sectionWrap: React.CSSProperties = {
    width:"min(720px,92vw)", margin:"0 auto", padding:"4rem 0", scrollMarginTop:"80px",
  };

  return (
    <div className={serif.className} style={{ minHeight:"100vh", backgroundColor:BLACK, color:GOLD }}>
      <style>{`
        @keyframes flapOpen    { 0%{transform:perspective(800px) rotateX(0deg)}  100%{transform:perspective(800px) rotateX(-180deg)} }
        @keyframes envShrink   { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.92)} }
        @keyframes cardRise    { 0%{opacity:0;transform:translateY(60px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideUp { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
        .flap-open  { animation: flapOpen 1s cubic-bezier(.4,0,.2,1) forwards; transform-origin: top center; }
        .env-shrink { animation: envShrink 0.5s ease-out 1.3s forwards; }
        .card-rise  { animation: cardRise 0.9s cubic-bezier(.22,1,.36,1) forwards; }
        .fade-up    { animation: fadeSlideUp 0.7s ease-out both; }
        .nav-link   { cursor:pointer; transition:color 0.2s; letter-spacing:0.08em; font-variant:small-caps; font-size:clamp(0.62rem,2.2vw,1rem); }
        @media(max-width:600px){ .desktop-nav{ display:none !important; } .mobile-nav{ display:flex !important; } .mobile-top{ display:flex !important; } body{ padding-bottom:60px; padding-top:126px; } .music-btn{ bottom:calc(4.5rem + env(safe-area-inset-bottom)) !important; } }
        @media(min-width:601px){ .desktop-nav{ display:flex !important; } .mobile-nav{ display:none !important; } .mobile-top{ display:none !important; } }
        .nav-link:hover { color:${GOLD_LIGHT} !important; }
        .attend-btn { cursor:pointer; transition:all 0.2s; }
        .attend-btn:hover { border-color:${GOLD_LIGHT} !important; }
        .rsvp-btn:hover { background-color:${GOLD_DIM} !important; }
        select option { background-color:${DARK}; color:${GOLD}; }
        ::placeholder { color:${GOLD_DIM}; opacity:0.7; }
      `}</style>

      {/* ── DESKTOP NAV (top sticky) ── */}
      {cardVisible && (
        <nav className="desktop-nav" style={{
          position:"sticky", top:0, zIndex:100,
          backgroundColor:"rgba(8,8,8,0.95)", borderBottom:`1px solid ${GOLD_DIM}`,
          padding:"0.3rem clamp(0.6rem,2vw,1.5rem)", backdropFilter:"blur(8px)",
          alignItems:"center", justifyContent:"space-between", gap:"0.5rem",
        }}>
          <img src="/logo.png" alt="Leo & Liora" style={{ height:"104px", width:"auto", objectFit:"contain", flexShrink:0, mixBlendMode:"normal" }} />
          <div style={{ display:"flex", gap:"clamp(0.4rem,2vw,2rem)", flexWrap:"nowrap" }}>
            {([["RSVP",rsvpRef],["Schedule",scheduleRef],["Hotels",hotelsRef],["Registry",registryRef],["FAQs",faqRef]] as const).map(([label,ref]) => (
              <span key={label} className="nav-link" style={{ color:GOLD }}
                onClick={() => scrollTo(ref as React.RefObject<HTMLDivElement>)}>{label}</span>
            ))}
          </div>
        </nav>
      )}

      {/* ── MOBILE TOP HEADER (logo) ── */}
      {cardVisible && (
        <div className="mobile-top" style={{
          position:"fixed", top:0, left:0, right:0, zIndex:100,
          backgroundColor:"rgba(8,8,8,0.97)", borderBottom:`1px solid ${GOLD_DIM}`,
          backdropFilter:"blur(8px)",
          flexDirection:"row", alignItems:"center", justifyContent:"center",
          padding:"0.3rem 0",
        }}>
          <img src="/logo.png" alt="Leo & Liora" style={{ height:"116px", width:"auto", objectFit:"contain", mixBlendMode:"normal" }} />
        </div>
      )}

      {/* ── MOBILE NAV (bottom bar — links only) ── */}
      {cardVisible && (
        <nav className="mobile-nav" style={{
          position:"fixed", bottom:0, left:0, right:0, zIndex:100,
          backgroundColor:"rgba(8,8,8,0.97)", borderTop:`1px solid ${GOLD_DIM}`,
          backdropFilter:"blur(8px)",
          flexDirection:"row", alignItems:"center", justifyContent:"space-around",
          padding:"0.55rem 0 calc(0.55rem + env(safe-area-inset-bottom))",
        }}>
          {([["RSVP",rsvpRef],["Schedule",scheduleRef],["Hotels",hotelsRef],["Registry",registryRef],["FAQs",faqRef]] as const).map(([label,ref]) => (
            <span key={label} onClick={() => scrollTo(ref as React.RefObject<HTMLDivElement>)}
              style={{ color:GOLD, fontVariant:"small-caps", letterSpacing:"0.06em",
                fontSize:"1.1rem", cursor:"pointer", padding:"0.15rem 0.25rem" }}>
              {label}
            </span>
          ))}
        </nav>
      )}

      {/* ── HERO ── */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"clamp(2rem,6vw,4rem) 1rem 0" }}>

        {/* Envelope */}
        {phase !== "open" && (
          <div onClick={openEnvelope} className={phase === "opening" ? "env-shrink" : ""}
            style={{ width:"min(520px,88vw)", cursor:phase==="closed"?"pointer":"default",
              userSelect:"none", position:"relative", marginBottom:"1.5rem" }}>
            <div style={{ width:"100%", paddingBottom:"66%", position:"relative",
              backgroundColor:"#1a1508", border:`1.5px solid ${GOLD_DIM}`,
              boxShadow:`0 0 0 4px #080808, 0 0 0 5px ${GOLD_DIM}, 0 20px 60px rgba(0,0,0,0.7)`, overflow:"hidden" }}>
              <div style={{ position:"absolute",inset:0, background:`linear-gradient(to right,#0d0a00 0%,transparent 55%)`, clipPath:"polygon(0% 0%,52% 50%,0% 100%)" }} />
              <div style={{ position:"absolute",inset:0, background:`linear-gradient(to left,#0d0a00 0%,transparent 55%)`,  clipPath:"polygon(100% 0%,48% 50%,100% 100%)" }} />
              <div style={{ position:"absolute",inset:0, background:`linear-gradient(to top,#0d0a00 0%,transparent 55%)`,   clipPath:"polygon(0% 100%,50% 46%,100% 100%)" }} />
              {/* Logo + tap to open — all below the flap (flap covers top 53%) */}
              {phase === "closed" && (
                <div style={{ position:"absolute", top:"54%", bottom:0, left:0, right:0,
                  display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"space-evenly",
                  padding:"0.3rem 0 0.6rem" }}>
                  {/* L&L monogram */}
                  <img src="/logo.png" alt="Leo & Liora" style={{ width:"clamp(55px,16vw,90px)", height:"auto", objectFit:"contain", mixBlendMode:"normal" }} />
                  <p style={{ color:GOLD_DIM, fontSize:"clamp(0.5rem,1.3vw,0.65rem)", letterSpacing:"0.14em", fontVariant:"small-caps" }}>tap to open</p>
                </div>
              )}
            </div>
            {/* Flap */}
            <div className={phase==="opening"?"flap-open":""}
              style={{ position:"absolute",top:0,left:0,right:0,height:"53%",transformOrigin:"top center",zIndex:10 }}>
              <div style={{ width:"100%",height:"100%",backgroundColor:"#1a1508",
                border:`1.5px solid ${GOLD_DIM}`,clipPath:"polygon(0% 0%,100% 0%,50% 100%)" }} />
              {/* Personalized addressee — calligraphy on the upper quarter of the envelope */}
              {addressLine && phase === "closed" && (
                <p className={script.className} style={{
                  position:"absolute", top:"28%", left:"50%", transform:"translateX(-50%)",
                  color:GOLD, fontSize:"clamp(1.2rem,4.5vw,1.9rem)", lineHeight:1.1,
                  margin:0, textAlign:"center", whiteSpace:"nowrap",
                  textShadow:"0 1px 2px rgba(0,0,0,0.5)",
                  pointerEvents:"none",
                }}>
                  {addressLine}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Invitation Card */}
        {cardVisible && (
          <div className="card-rise" style={{
            width:"min(440px,88vw)", backgroundColor:CREAM,
            padding:"4px", boxShadow:`0 30px 80px rgba(0,0,0,0.75)`,
            marginBottom:"1rem",
          }}>
            {/* Outer border */}
            <div style={{ border:`1.5px solid ${GOLD_DIM}`, padding:"6px" }}>
              {/* Inner border */}
              <div style={{
                border:`1px solid ${GOLD_DIM}`,
                display:"flex", flexDirection:"column", alignItems:"center",
                textAlign:"center", backgroundColor:CREAM,
                padding:"clamp(1.2rem,4vw,2rem) clamp(1rem,4vw,1.8rem)",
                gap:"clamp(0.4rem,1.2vw,0.7rem)",
              }}>
                {/* ב״ה */}
                <p style={{ color:GOLD_DIM, fontSize:"clamp(0.6rem,1.5vw,0.72rem)", direction:"rtl", marginBottom:0 }}>ב״ה</p>

                <Ornament width="52%" />

                {/* Hebrew verse */}
                <p style={{ color:GOLD, fontSize:"clamp(1.4rem,5.5vw,2.1rem)", direction:"rtl", lineHeight:1.25, fontFamily:"serif", margin:"0.1rem 0" }}>
                  אֲנִי לְדוֹדִי וְדוֹדִי לִי
                </p>

                {/* Translation */}
                <div style={{ color:GOLD_DIM, fontSize:"clamp(0.52rem,1.4vw,0.65rem)", fontVariant:"small-caps", letterSpacing:"0.1em", lineHeight:1.7 }}>
                  I am my beloved's and my beloved is mine<br/>
                  Song of Songs 6:3
                </div>

                <Ornament width="52%" />

                {/* Personalized addressing — only shown when invitation was opened via personalized link */}
                {addressLine && (
                  <>
                    <p style={{
                      color:GOLD,
                      fontFamily:"'Great Vibes', cursive",
                      fontSize:"clamp(1.4rem,4.5vw,2rem)",
                      lineHeight:1.1,
                      margin:"0.2rem 0",
                    }}>
                      {addressLine}
                    </p>
                    <Ornament width="36%" />
                  </>
                )}

                {/* Pre-names block */}
                <div style={{ color:GOLD_DIM, fontVariant:"small-caps", fontSize:"clamp(0.56rem,1.4vw,0.7rem)", letterSpacing:"0.1em", lineHeight:1.75 }}>
                  With gratitude to Hashem,
                </div>
                <div style={{ color:GOLD, fontVariant:"small-caps", fontSize:"clamp(0.7rem,1.8vw,0.9rem)", letterSpacing:"0.04em", lineHeight:1.9 }}>
                  Mr. and Mrs. Hermann Kanter<br/>
                  <span style={{ fontSize:"0.85em", color:GOLD_DIM }}>and</span><br/>
                  Mr. and Mrs. Moche Baruh
                </div>
                <div style={{ color:GOLD_DIM, fontVariant:"small-caps", fontSize:"clamp(0.56rem,1.4vw,0.7rem)", letterSpacing:"0.1em", lineHeight:1.75 }}>
                  request the honor of your presence<br/>
                  at the wedding of their beloved children
                </div>

                {/* LEO & LIORA */}
                <div style={{ margin:"0.2rem 0", lineHeight:1 }}>
                  <p className={display.className} style={{ color:GOLD, fontSize:"clamp(3rem,13vw,5.5rem)", letterSpacing:"0.1em", lineHeight:0.95, margin:0 }}>LEO</p>
                  <p className={script.className} style={{ color:GOLD, fontSize:"clamp(1.6rem,6vw,2.6rem)", lineHeight:1.1, margin:0 }}>&amp;</p>
                  <p className={display.className} style={{ color:GOLD, fontSize:"clamp(3rem,13vw,5.5rem)", letterSpacing:"0.1em", lineHeight:0.95, margin:0 }}>LIORA</p>
                </div>

                <Ornament width="52%" />

                {/* Date, time & venue */}
                <div style={{ color:GOLD_DIM, fontVariant:"small-caps", fontSize:"clamp(0.6rem,1.5vw,0.72rem)", letterSpacing:"0.12em", lineHeight:1.9, textAlign:"center" }}>
                  <span style={{ color:GOLD, fontSize:"clamp(0.9rem,2.2vw,1.1rem)", fontWeight:700 }}>Thursday, August 13, 2026</span><br/>
                  <span style={{ color:GOLD, fontSize:"clamp(0.9rem,2.2vw,1.1rem)", fontWeight:700, fontVariant:"normal", letterSpacing:"0.05em", direction:"rtl", display:"inline-block" }}>ל׳ אב תשפ״ו</span><br/>
                Cocktail at Five O'Clock<br/>
                  Chuppah at Six O'Clock<br/>
                  <br/>
                  <span style={{ color:GOLD }}>Shul of Bal Harbour</span><br/>
                  9540 Collins Ave<br/>
                  Surfside, FL 33154
                </div>

                <Ornament width="52%" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio — preload="auto" buffers on mount; play() fires inside click */}
      <audio ref={audioRef} loop preload="auto" style={{ display:"none" }} />

      {/* Floating play/pause button */}
      {cardVisible && (
        <button onClick={toggleMute} title={muted ? "Play music" : "Pause music"}
          className="music-btn"
          style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:200,
            width:48, height:48, borderRadius:"50%",
            background:"transparent", border:"none", cursor:"pointer", padding:0,
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke={GOLD} strokeWidth="1.6"/>
            {muted ? (
              /* Pause bars — music is paused */
              <>
                <rect x="18" y="16" width="4" height="16" rx="1.5" fill={GOLD}/>
                <rect x="26" y="16" width="4" height="16" rx="1.5" fill={GOLD}/>
              </>
            ) : (
              /* Music note — music is playing */
              <>
                <line x1="20" y1="18" x2="30" y2="15.5" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="20" y1="18" x2="20" y2="29"   stroke={GOLD} strokeWidth="1.6" strokeLinecap="round"/>
                <line x1="30" y1="15.5" x2="30" y2="26.5" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round"/>
                <ellipse cx="18" cy="29.5" rx="3.2" ry="2.2" transform="rotate(-12 18 29.5)" stroke={GOLD} strokeWidth="1.4" fill="none"/>
                <ellipse cx="28" cy="27"   rx="3.2" ry="2.2" transform="rotate(-12 28 27)"   stroke={GOLD} strokeWidth="1.4" fill="none"/>
              </>
            )}
          </svg>
        </button>
      )}

      {/* ── SECTIONS ── */}
      {cardVisible && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>

          {/* ── RSVP ── */}
          <div ref={rsvpRef} style={sectionWrap}>
            <SectionHeading>RSVP</SectionHeading>
            <p style={{ textAlign:"center",color:GOLD_DIM,fontSize:"1rem",fontStyle:"italic",marginBottom:"2.5rem" }}>
              Kindly reply by July 31, 2026
            </p>

            {isLastMinute && !submitted && (
              <div style={{ maxWidth:480, margin:"0 auto 1.25rem", padding:"0.6rem 1rem",
                border:`1px solid ${GOLD_DIM}`, backgroundColor:"rgba(200,168,74,0.05)", textAlign:"center" }}>
                <p style={{ color:GOLD, fontSize:"0.72rem", letterSpacing:"0.1em", fontVariant:"small-caps", margin:0 }}>
                  Last-Minute RSVP
                </p>
                <p style={{ color:GOLD_DIM, fontSize:"0.78rem", margin:"0.2rem 0 0", fontStyle:"italic" }}>
                  You'll be added to the guest list when you submit.
                </p>
              </div>
            )}

            {submitted ? (
              <div style={{ textAlign:"center",padding:"3rem 0" }}>
                <p className={script.className} style={{ color:GOLD,fontSize:"2.5rem" }}>Thank you, {name}!</p>
                <p style={{ color:GOLD_DIM,marginTop:"0.75rem",fontSize:"1rem",fontStyle:"italic" }}>
                  {attending
                    ? `We can't wait to celebrate with you${partySize>1?" and your guest":""}.`
                    : "We'll miss you — thank you for letting us know."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:"1.5rem",maxWidth:480,margin:"0 auto" }}>
                {addressLine ? (
                  // Personalized invite — show the guest's name as a display, no input needed
                  <div style={{ textAlign:"center", padding:"1.1rem 1rem", border:`1px solid ${GOLD_DIM}`, backgroundColor:"rgba(200,168,74,0.04)" }}>
                    <p style={{ color:GOLD_DIM, fontSize:"0.7rem", fontVariant:"small-caps", letterSpacing:"0.12em", marginBottom:"0.3rem" }}>
                      Responding as
                    </p>
                    <p className={script.className} style={{ color:GOLD, fontSize:"clamp(1.6rem,5vw,2.2rem)", lineHeight:1.1, margin:0 }}>
                      {addressLine}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>Full Name</label>
                    <input type="text" value={name} required placeholder="Your name"
                      onChange={e=>setName(e.target.value)} style={inputStyle} />
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Will you be attending?</label>
                  <div style={{ display:"flex",gap:"0.75rem" }}>
                    {[{label:"Joyfully Accepts",value:true},{label:"Regretfully Declines",value:false}].map(opt=>(
                      <button key={String(opt.value)} type="button" className="attend-btn"
                        onClick={()=>{setAttending(opt.value); if(!opt.value) setPartySize(1);}}
                        style={{ flex:1, padding:"0.7rem 0.5rem",
                          border:`1px solid ${attending===opt.value?GOLD:GOLD_DIM}`,
                          background:attending===opt.value?GOLD:"transparent",
                          color:attending===opt.value?BLACK:GOLD_DIM,
                          fontSize:"clamp(0.6rem,1.8vw,0.72rem)", fontVariant:"small-caps",
                          letterSpacing:"0.05em", cursor:"pointer", transition:"all 0.2s",
                          fontFamily:serif.style.fontFamily }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {attending && (
                  <div>
                    <label style={labelStyle}>Number of Guests (including yourself)</label>
                    <select value={partySize} onChange={e=>setPartySize(Number(e.target.value))}
                      style={{...inputStyle,cursor:"pointer"}}>
                      {[1,2].map(n=><option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Email <span style={{fontStyle:"italic",fontVariant:"normal",letterSpacing:0}}>{attending ? "(required — we'll send your calendar invite here)" : "(at least one required for reminders)"}</span></label>
                  <input type="email" value={email} placeholder="your@email.com" required={!!attending}
                    onChange={e=>setEmail(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Cell Phone <span style={{fontStyle:"italic",fontVariant:"normal",letterSpacing:0}}>{attending ? "(optional)" : "(at least one required for reminders)"}</span></label>
                  <input type="tel" value={phone} placeholder="(555) 000-0000"
                    onChange={e=>setPhone(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Song Request <span style={{fontStyle:"italic",fontVariant:"normal",letterSpacing:0}}>(optional)</span></label>
                  <input type="text" value={song} placeholder="What song will get you on the dance floor?"
                    onChange={e=>setSong(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Advice for the Couple <span style={{fontStyle:"italic",fontVariant:"normal",letterSpacing:0}}>(optional)</span></label>
                  <textarea value={advice} placeholder="Best marriage advice you've got?" rows={3}
                    onChange={e=>setAdvice(e.target.value)}
                    style={{...inputStyle,resize:"none",display:"block"}} />
                </div>

                {error && <p style={{color:"#e08080",fontSize:"0.85rem"}}>{error}</p>}

                <button type="submit" className="rsvp-btn"
                  disabled={loading||attending===null||!name.trim()||(attending ? !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) : (!email.trim()&&!phone.trim()))}
                  style={{ padding:"0.9rem",
                    background:`linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DIM} 100%)`,
                    color:BLACK, border:"none",
                    fontVariant:"small-caps", letterSpacing:"0.14em", fontSize:"0.85rem",
                    cursor:"pointer", transition:"all 0.2s", fontFamily:serif.style.fontFamily,
                    opacity:(loading||attending===null||!name.trim()||(attending ? !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) : (!email.trim()&&!phone.trim())))?0.35:1 }}>
                  {loading?"Sending...":"Submit RSVP"}
                </button>
              </form>
            )}
          </div>

          {/* ── SCHEDULE ── */}
          <div ref={scheduleRef} style={{ ...sectionWrap, borderTop:`1px solid rgba(168,138,50,0.2)` }}>
            <div style={{ display:"flex",alignItems:"center",gap:"1rem",margin:"3rem 0 2.5rem" }}>
              <div style={{ flex:1,height:1,backgroundColor:GOLD_DIM }} />
              <span style={{ color:GOLD_DIM }}>✦</span>
              <div style={{ flex:1,height:1,backgroundColor:GOLD_DIM }} />
            </div>
            <SectionHeading>Schedule</SectionHeading>
            <div style={{ display:"flex",flexDirection:"column",gap:"1.25rem" }}>
              {[
                { time:"5:00 PM", title:"Cocktail", desc:"Shul of Bal Harbour\n9540 Collins Ave, Surfside, FL 33154" },
                { time:"6:00 PM", title:"Chuppah", desc:"Ceremony following" },
              ].map(ev => (
                <div key={ev.title} style={{ display:"flex",gap:"2rem",alignItems:"flex-start",
                  padding:"1.5rem 2rem", backgroundColor:DARK,
                  border:`1px solid ${GOLD_DIM}`, opacity:1 }}>
                  <div style={{ minWidth:90,textAlign:"right" }}>
                    <p style={{ color:GOLD,fontVariant:"small-caps",fontSize:"0.95rem",letterSpacing:"0.08em" }}>{ev.time}</p>
                  </div>
                  <div style={{ width:1,backgroundColor:GOLD_DIM,alignSelf:"stretch",opacity:0.5 }} />
                  <div>
                    <p style={{ color:GOLD,fontVariant:"small-caps",letterSpacing:"0.08em",fontSize:"1.05rem",marginBottom:"0.35rem" }}>{ev.title}</p>
                    <p style={{ color:GOLD_DIM,fontSize:"0.95rem",lineHeight:1.7,whiteSpace:"pre-line" }}>{ev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── HOTELS ── */}
          <div ref={hotelsRef} style={{ ...sectionWrap, borderTop:`1px solid ${GOLD_DIM}`, borderTopColor:"rgba(168,138,50,0.2)" }}>
            <SectionHeading>Hotels</SectionHeading>
            <p style={{ textAlign:"center",color:GOLD_DIM,fontSize:"1rem",marginBottom:"2rem",fontStyle:"italic" }}>
              We recommend the following hotels near the Shul of Bal Harbour.
            </p>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:"1.25rem" }}>
              {[
                { name:"Grand Beach Hotel Surfside", address:"9449 Collins Ave\nSurfside, FL 33154", note:"Steps from venue", tier:"Luxury" },
                { name:"Altair Hotel", address:"9540 W Bay Harbor Dr\nBay Harbor Islands, FL 33154", note:"Minutes from venue", tier:"Boutique" },
                { name:"The Surf Club, Four Seasons", address:"9011 Collins Ave\nSurfside, FL 33154", note:"Closest to venue — steps away", tier:"Luxury" },
                { name:"St. Regis Bal Harbour Resort", address:"9703 Collins Ave\nBal Harbour, FL 33154", note:"5 minutes north of venue", tier:"Luxury" },
              ].map(h => (
                <div key={h.name} style={{ backgroundColor:DARK,border:`1px solid ${GOLD_DIM}`,
                  padding:"1.5rem",transition:"border-color 0.2s" }}>
                  <p style={{ color:GOLD_DIM,fontSize:"0.7rem",fontVariant:"small-caps",letterSpacing:"0.1em",marginBottom:"0.4rem" }}>{h.tier}</p>
                  <p style={{ color:GOLD,fontVariant:"small-caps",fontSize:"1rem",letterSpacing:"0.05em",marginBottom:"0.5rem" }}>{h.name}</p>
                  <p style={{ color:GOLD_DIM,fontSize:"0.9rem",lineHeight:1.7,whiteSpace:"pre-line",marginBottom:"0.5rem" }}>{h.address}</p>
                  <p style={{ color:GOLD_DIM,fontSize:"0.8rem",fontStyle:"italic",opacity:0.7 }}>{h.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── REGISTRY ── */}
          <div ref={registryRef} style={{ ...sectionWrap, borderTop:`1px solid rgba(168,138,50,0.2)` }}>
            <SectionHeading>Registry</SectionHeading>
            <div style={{ textAlign:"center",padding:"2.5rem",backgroundColor:DARK,border:`1px solid ${GOLD_DIM}` }}>
              <p style={{ color:GOLD_DIM,fontSize:"0.95rem",lineHeight:1.8,fontStyle:"italic",marginBottom:"1.5rem" }}>
                Your presence at our celebration is the greatest gift.<br />
                For those who wish to honor us with a gift, we are registered at:
              </p>
              <a href="https://www.theknot.com/lioraandleo" target="_blank" rel="noopener noreferrer"
                style={{ display:"inline-block", padding:"0.7rem 2rem",
                  border:`1px solid ${GOLD}`, color:GOLD,
                  fontVariant:"small-caps", letterSpacing:"0.12em", fontSize:"0.85rem",
                  textDecoration:"none", fontFamily:"inherit",
                  transition:"all 0.2s" }}
                onMouseOver={e=>(e.currentTarget.style.backgroundColor=GOLD,e.currentTarget.style.color="#080808")}
                onMouseOut={e=>(e.currentTarget.style.backgroundColor="transparent",e.currentTarget.style.color=GOLD)}>
                The Knot — View Registry
              </a>
            </div>
          </div>

          {/* ── FAQs ── */}
          <div ref={faqRef} style={{ ...sectionWrap, borderTop:`1px solid rgba(168,138,50,0.2)` }}>
            <SectionHeading>FAQs</SectionHeading>
            <div style={{ display:"flex",flexDirection:"column",gap:"1rem" }}>
              {[
                { q:"What is the dress code?", a:"Black Tie. We encourage our guests to dress formally for the occasion." },
                { q:"Where do I park?", a:"Street parking is available on the street behind the CVS near the venue. Additional street parking is available in the surrounding area." },
                { q:"What time should I arrive?", a:"Cocktail hour begins at 5:00 PM. The chuppah will begin at 6:00 PM, with the ceremony following." },
                { q:"Where is the ceremony?", a:"Shul of Bal Harbour\n9540 Collins Ave, Surfside, FL 33154" },
                { q:"Are the ceremony and reception at the same location?", a:"Yes, both the ceremony and reception will be held at the Shul of Bal Harbour." },
              ].map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
            </div>
          </div>

          {/* Footer */}
          <footer style={{ borderTop:`1px solid rgba(168,138,50,0.2)`, width:"100%", padding:"2.5rem 1rem", textAlign:"center" }}>
            <p className={display.className} style={{ color:GOLD, fontSize:"1.4rem", letterSpacing:"0.15em" }}>LEO &amp; LIORA</p>
            <p className={script.className} style={{ color:GOLD_DIM, fontSize:"1.2rem", marginTop:"0.3rem" }}>Mazel Tov</p>
            <p style={{ color:GOLD_DIM, fontSize:"0.7rem", letterSpacing:"0.1em", fontVariant:"small-caps", marginTop:"0.5rem", opacity:0.6 }}>
              August 13, 2026 · Surfside, Florida
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ backgroundColor:DARK, border:`1px solid ${GOLD_DIM}` }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
        padding:"1.1rem 1.5rem", backgroundColor:"transparent", border:"none",
        cursor:"pointer", textAlign:"left", fontFamily:"inherit",
      }}>
        <span style={{ color:GOLD, fontVariant:"small-caps", letterSpacing:"0.06em", fontSize:"1rem" }}>{q}</span>
        <span style={{ color:GOLD_DIM, fontSize:"1.1rem", transition:"transform 0.2s", transform:open?"rotate(45deg)":"rotate(0deg)" }}>+</span>
      </button>
      {open && (
        <div style={{ padding:"0 1.5rem 1.1rem", color:GOLD_DIM, fontSize:"1rem", lineHeight:1.8, whiteSpace:"pre-line" }}>
          {a}
        </div>
      )}
    </div>
  );
}
