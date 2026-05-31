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
  const [muted,       setMuted]       = useState(false);

  const scheduleRef = useRef<HTMLDivElement>(null);
  const hotelsRef   = useRef<HTMLDivElement>(null);
  const registryRef = useRef<HTMLDivElement>(null);
  const faqRef      = useRef<HTMLDivElement>(null);
  const rsvpRef     = useRef<HTMLDivElement>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.45;
    audioRef.current = audio;
    audio.addEventListener("ended", () => {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });
    fetch("https://itunes.apple.com/lookup?id=1885844177")
      .then(r => r.json())
      .then(data => {
        const url = data.results?.[0]?.previewUrl;
        if (url && audioRef.current) audioRef.current.src = url;
      })
      .catch(() => {});
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  function scrollTo(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior:"smooth", block:"start" });
  }

  function openEnvelope() {
    if (phase !== "closed") return;
    setPhase("opening");
    audioRef.current?.play().catch(() => {});
    setTimeout(() => setCardVisible(true), 900);
    setTimeout(() => setPhase("open"), 1800);
  }

  function toggleMute() {
    if (!audioRef.current) return;
    audioRef.current.muted = !audioRef.current.muted;
    setMuted(m => !m);
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
    width:"min(720px,92vw)", margin:"0 auto", padding:"4rem 0",
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
        .nav-link   { cursor:pointer; transition:color 0.2s; letter-spacing:0.1em; font-variant:small-caps; font-size:0.72rem; }
        .nav-link:hover { color:${GOLD_LIGHT} !important; }
        .attend-btn { cursor:pointer; transition:all 0.2s; }
        .attend-btn:hover { border-color:${GOLD_LIGHT} !important; }
        .rsvp-btn:hover { background-color:${GOLD_DIM} !important; }
        select option { background-color:${DARK}; color:${GOLD}; }
        ::placeholder { color:${GOLD_DIM}; opacity:0.7; }
      `}</style>

      {/* ── STICKY NAV ── */}
      {cardVisible && (
        <nav style={{
          position:"sticky", top:0, zIndex:100,
          backgroundColor:"rgba(8,8,8,0.95)", borderBottom:`1px solid ${GOLD_DIM}`,
          padding:"0.9rem 1.5rem", backdropFilter:"blur(8px)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <span className={display.className} style={{ color:GOLD, fontSize:"1.1rem", letterSpacing:"0.15em" }}>LEO &amp; LIORA</span>
          <div style={{ display:"flex", gap:"clamp(0.8rem,3vw,2rem)" }}>
            {([["Schedule",scheduleRef],["Hotels",hotelsRef],["Registry",registryRef],["FAQs",faqRef],["RSVP",rsvpRef]] as const).map(([label,ref]) => (
              <span key={label} className="nav-link" style={{ color:GOLD }}
                onClick={() => scrollTo(ref as React.RefObject<HTMLDivElement>)}>
                {label}
              </span>
            ))}
          </div>
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
              {phase === "closed" && (
                <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <p style={{ color:GOLD_DIM, fontSize:"clamp(0.6rem,1.6vw,0.8rem)", letterSpacing:"0.14em", fontVariant:"small-caps" }}>tap to open</p>
                </div>
              )}
            </div>
            {/* Flap */}
            <div className={phase==="opening"?"flap-open":""}
              style={{ position:"absolute",top:0,left:0,right:0,height:"53%",transformOrigin:"top center",zIndex:10 }}>
              <div style={{ width:"100%",height:"100%",backgroundColor:"#1a1508",
                border:`1.5px solid ${GOLD_DIM}`,clipPath:"polygon(0% 0%,100% 0%,50% 100%)" }} />
            </div>
            {/* Seal */}
            {phase === "closed" && (
              <div style={{ position:"absolute",top:"22%",left:"50%",transform:"translateX(-50%)",zIndex:20,
                width:52,height:52,borderRadius:"50%",
                background:`radial-gradient(circle, ${GOLD} 0%, ${GOLD_DIM} 100%)`,
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 2px 14px rgba(200,168,74,0.4)" }}>
                <span className={display.className} style={{ color:BLACK,fontSize:"0.8rem",letterSpacing:"0.05em" }}>LL</span>
              </div>
            )}
          </div>
        )}

        {/* Invitation Card */}
        {cardVisible && (
          <div className="card-rise" style={{
            width:"min(420px,86vw)",
            backgroundColor:CREAM,
            border:`2px solid ${GOLD}`,
            padding:"6px",
            boxShadow:`0 0 0 6px ${CREAM}, 0 0 0 8px ${GOLD}, 0 30px 80px rgba(200,168,74,0.15), 0 20px 60px rgba(0,0,0,0.8)`,
          }}>
            <div style={{
              border:`1px solid ${GOLD}`,
              padding:"clamp(1.2rem,5%,2rem) clamp(1rem,4%,1.8rem)",
              display:"flex", flexDirection:"column", alignItems:"center",
              textAlign:"center", gap:"0.55rem",
            }}>
              {/* ב"ה */}
              <p style={{ color:GOLD, fontSize:"0.72rem", letterSpacing:"0.05em", fontFamily:"serif", direction:"rtl" }}>ב״ה</p>

              <Ornament />

              {/* Hebrew verse */}
              <p style={{ color:GOLD, fontSize:"clamp(1.4rem,4.5vw,2rem)", fontFamily:"serif", lineHeight:1.3, direction:"rtl" }}>
                אֲנִי לְדוֹדִי וְדוֹדִי לִי
              </p>
              <p style={{ color:GOLD_DIM, fontSize:"clamp(0.55rem,1.4vw,0.68rem)", letterSpacing:"0.1em", fontVariant:"small-caps" }}>
                I Am My Beloved&apos;s And My Beloved Is Mine
              </p>
              <p style={{ color:GOLD_DIM, fontSize:"clamp(0.55rem,1.4vw,0.68rem)", letterSpacing:"0.1em", fontVariant:"small-caps" }}>
                Song of Songs 6:3
              </p>

              <Ornament />

              {/* Parents */}
              <p style={{ color:GOLD, fontVariant:"small-caps", fontSize:"clamp(0.75rem,2vw,0.95rem)", letterSpacing:"0.05em", fontWeight:500 }}>
                Mr and Mrs Moshe Baruh
              </p>
              <p style={{ color:GOLD_DIM, fontSize:"clamp(0.6rem,1.5vw,0.75rem)", fontStyle:"italic" }}>and</p>
              <p style={{ color:GOLD, fontVariant:"small-caps", fontSize:"clamp(0.75rem,2vw,0.95rem)", letterSpacing:"0.05em", fontWeight:500 }}>
                Mr and Mrs Hermann Kanter
              </p>
              <p style={{ color:GOLD_DIM, fontVariant:"small-caps", fontSize:"clamp(0.58rem,1.4vw,0.7rem)", letterSpacing:"0.08em", lineHeight:1.6, marginTop:"0.2rem" }}>
                Request the Honor of Your Presence<br />at the Wedding of Their Children
              </p>

              {/* LEO & LIORA */}
              <div style={{ lineHeight:0.85, margin:"0.4rem 0" }}>
                <p className={display.className} style={{ color:GOLD, fontSize:"clamp(3.2rem,13vw,5.5rem)", fontWeight:700, letterSpacing:"0.04em" }}>LEO</p>
                <p className={script.className} style={{ color:GOLD_DIM, fontSize:"clamp(1.4rem,4vw,2.2rem)", lineHeight:1.2 }}>&amp;</p>
                <p className={display.className} style={{ color:GOLD, fontSize:"clamp(3.2rem,13vw,5.5rem)", fontWeight:700, letterSpacing:"0.04em" }}>LIORA</p>
              </div>

              <Ornament />

              <p className={script.className} style={{ color:GOLD_DIM, fontSize:"clamp(1rem,3vw,1.4rem)" }}>Together with their families</p>
              <p style={{ color:GOLD_DIM, fontVariant:"small-caps", fontSize:"clamp(0.55rem,1.4vw,0.68rem)", letterSpacing:"0.08em", lineHeight:1.7 }}>
                Joyfully Invite You to Share<br />in the Celebration of Their Marriage<br />Beneath the Chuppah
              </p>

              <Ornament />

              <p style={{ color:GOLD_DIM, fontVariant:"small-caps", fontSize:"clamp(0.55rem,1.4vw,0.68rem)", letterSpacing:"0.08em", lineHeight:1.7 }}>
                Thursday, August 13, 2026<br />
                Chuppah at Six in the Evening<br />
                Shul of Bal Harbour · Surfside, FL
              </p>

              <Ornament />

              <p style={{ color:GOLD_DIM, fontVariant:"small-caps", fontSize:"clamp(0.55rem,1.4vw,0.68rem)", letterSpacing:"0.08em", lineHeight:1.7 }}>
                With Gratitude to Hashem,<br />We Invite You to Join Us<br />as We Begin Our New Life Together
              </p>

              <Ornament />

              <p className={script.className} style={{ color:GOLD, fontSize:"clamp(1.5rem,4.5vw,2.2rem)" }}>Mazel Tov</p>

              <Ornament width="40%" />
            </div>
          </div>
        )}
      </div>

      {/* Floating mute button */}
      {cardVisible && (
        <button onClick={toggleMute} title={muted?"Unmute":"Mute"}
          style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:200,
            width:44, height:44, borderRadius:"50%",
            background:`radial-gradient(circle, ${GOLD} 0%, ${GOLD_DIM} 100%)`,
            color:BLACK, border:"none", cursor:"pointer", fontSize:"1.1rem",
            boxShadow:"0 4px 16px rgba(200,168,74,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          {muted ? "🔇" : "🎵"}
        </button>
      )}

      {/* ── SECTIONS ── */}
      {cardVisible && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>

          {/* ── SCHEDULE ── */}
          <div ref={scheduleRef} style={sectionWrap}>
            <div style={{ display:"flex",alignItems:"center",gap:"1rem",margin:"3rem 0 2.5rem" }}>
              <div style={{ flex:1,height:1,backgroundColor:GOLD_DIM,opacity:0.4 }} />
              <span style={{ color:GOLD_DIM }}>✦</span>
              <div style={{ flex:1,height:1,backgroundColor:GOLD_DIM,opacity:0.4 }} />
            </div>
            <SectionHeading>Schedule</SectionHeading>
            <div style={{ display:"flex",flexDirection:"column",gap:"1.25rem" }}>
              {[
                { time:"5:45 PM", title:"Guests Arrive", desc:"Please be seated before the ceremony begins" },
                { time:"6:00 PM", title:"Chuppah Ceremony", desc:"Shul of Bal Harbour\n9540 Collins Ave, Surfside, FL 33154" },
                { time:"Following", title:"Cocktail Hour & Reception", desc:"Immediately following the ceremony at the same location" },
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
                { name:"The Surf Club, Four Seasons", address:"9011 Collins Ave\nSurfside, FL 33154", note:"Closest to venue — steps away", tier:"Luxury" },
                { name:"The Ritz-Carlton Bal Harbour", address:"10295 Collins Ave\nBal Harbour, FL 33154", note:"5 minutes north of venue", tier:"Luxury" },
                { name:"Marriott Stanton South Beach", address:"161 Ocean Dr\nMiami Beach, FL 33139", note:"~20 minutes south of venue", tier:"Mid-Range" },
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
              <p className={script.className} style={{ color:GOLD,fontSize:"2rem",marginBottom:"1rem" }}>Coming Soon</p>
              <p style={{ color:GOLD_DIM,fontSize:"0.95rem",lineHeight:1.8,fontStyle:"italic" }}>
                Your presence at our celebration is the greatest gift.<br />
                Registry details will be shared soon.
              </p>
            </div>
          </div>

          {/* ── FAQs ── */}
          <div ref={faqRef} style={{ ...sectionWrap, borderTop:`1px solid rgba(168,138,50,0.2)` }}>
            <SectionHeading>FAQs</SectionHeading>
            <div style={{ display:"flex",flexDirection:"column",gap:"1rem" }}>
              {[
                { q:"What is the dress code?", a:"Black Tie. We encourage our guests to dress formally for the occasion." },
                { q:"Where do I park?", a:"Street parking is available on the street behind the CVS near the venue. Additional street parking is available in the surrounding area." },
                { q:"What time should I arrive?", a:"Please arrive by 5:45 PM. The chuppah will begin promptly at 6:00 PM and we want everyone to be seated before the ceremony starts." },
                { q:"Where is the ceremony?", a:"Shul of Bal Harbour\n9540 Collins Ave, Surfside, FL 33154" },
                { q:"Are the ceremony and reception at the same location?", a:"Yes, both the ceremony and reception will be held at the Shul of Bal Harbour." },
              ].map(faq => <FaqItem key={faq.q} q={faq.q} a={faq.a} />)}
            </div>
          </div>

          {/* ── RSVP ── */}
          <div ref={rsvpRef} style={{ ...sectionWrap, borderTop:`1px solid rgba(168,138,50,0.2)` }}>
            <SectionHeading>RSVP</SectionHeading>
            <p style={{ textAlign:"center",color:GOLD_DIM,fontSize:"1rem",fontStyle:"italic",marginBottom:"2.5rem" }}>
              Kindly reply by July 1, 2026
            </p>

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
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" value={name} required placeholder="Your name"
                    onChange={e=>setName(e.target.value)} style={inputStyle} />
                </div>

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
                  <label style={labelStyle}>Email <span style={{fontStyle:"italic",fontVariant:"normal",letterSpacing:0}}>(at least one required for reminders)</span></label>
                  <input type="email" value={email} placeholder="your@email.com"
                    onChange={e=>setEmail(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Cell Phone <span style={{fontStyle:"italic",fontVariant:"normal",letterSpacing:0}}>(at least one required for reminders)</span></label>
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
                  disabled={loading||attending===null||!name.trim()||(!email.trim()&&!phone.trim())}
                  style={{ padding:"0.9rem",
                    background:`linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DIM} 100%)`,
                    color:BLACK, border:"none",
                    fontVariant:"small-caps", letterSpacing:"0.14em", fontSize:"0.85rem",
                    cursor:"pointer", transition:"all 0.2s", fontFamily:serif.style.fontFamily,
                    opacity:(loading||attending===null||!name.trim()||(!email.trim()&&!phone.trim()))?0.35:1 }}>
                  {loading?"Sending...":"Submit RSVP"}
                </button>
              </form>
            )}
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
