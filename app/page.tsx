"use client";

import { useState, useRef, useEffect } from "react";
import { Great_Vibes, Cormorant_Garamond } from "next/font/google";

const script = Great_Vibes({ weight: "400", subsets: ["latin"] });
const serif = Cormorant_Garamond({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const TAUPE = "#a89890";
const TAUPE_DARK = "#7a6a62";
const TAUPE_LIGHT = "#c4b5ad";
const CREAM = "#f5f0eb";
const BG = "#ddd6cf";

// ─── Palm Tree ───────────────────────────────────────────────────────────────
function PalmTree() {
  return (
    <svg viewBox="0 0 200 560" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <path d="M95,560 C92,480 88,400 93,320 C98,240 102,170 95,100 C91,62 87,40 80,12"
        stroke={TAUPE} strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M80,12 C105,-4 168,-18 205,2 C188,-1 142,7 113,21 C97,29 83,20 80,12Z" fill={TAUPE} />
      <path d="M80,12 C100,22 166,14 207,42 C186,33 134,32 104,41 C90,46 80,30 80,12Z" fill={TAUPE} />
      <path d="M80,12 C96,38 155,62 193,99 C169,80 118,62 94,63 C83,63 76,35 80,12Z" fill={TAUPE} />
      <path d="M80,12 C88,50 134,98 162,148 C140,120 100,88 85,80 C77,76 73,40 80,12Z" fill={TAUPE} />
      <path d="M80,12 C61,-4 22,-16 0,1 C17,-2 54,9 67,22 C73,28 80,20 80,12Z" fill={TAUPE} />
      <path d="M80,12 C65,28 22,34 0,56 C18,44 56,42 72,50 C79,54 81,28 80,12Z" fill={TAUPE} />
      <path d="M80,12 C70,42 32,76 8,112 C26,90 62,70 76,68 C82,66 83,36 80,12Z" fill={TAUPE} />
    </svg>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "2rem 0" }}>
      <div style={{ flex: 1, height: 1, backgroundColor: TAUPE_LIGHT }} />
      <span style={{ color: TAUPE_LIGHT, fontSize: "1rem" }}>✦</span>
      <div style={{ flex: 1, height: 1, backgroundColor: TAUPE_LIGHT }} />
    </div>
  );
}

// ─── Section Heading ─────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
      <h2 className={script.className} style={{ color: TAUPE, fontSize: "clamp(2rem, 6vw, 3rem)", lineHeight: 1.1 }}>
        {children}
      </h2>
      <div style={{ width: 60, height: 1, backgroundColor: TAUPE_LIGHT, margin: "0.75rem auto 0" }} />
    </div>
  );
}

type Phase = "closed" | "opening" | "open";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [cardVisible, setCardVisible] = useState(false);
  const [attending, setAttending] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [song, setSong] = useState("");
  const [advice, setAdvice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const scheduleRef = useRef<HTMLDivElement>(null);
  const hotelsRef   = useRef<HTMLDivElement>(null);
  const registryRef = useRef<HTMLDivElement>(null);
  const faqRef      = useRef<HTMLDivElement>(null);
  const rsvpRef     = useRef<HTMLDivElement>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    audioRef.current = audio;
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
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (!email.trim() && !phone.trim()) {
      setError("Please provide at least an email or phone number for reminders.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, attending, partySize, email, phone, song, advice }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", borderBottom: `1px solid ${TAUPE}`,
    padding: "0.5rem 0", color: TAUPE_DARK, outline: "none",
    backgroundColor: "transparent", fontSize: "1rem",
    fontFamily: serif.style.fontFamily,
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.72rem", color: TAUPE,
    marginBottom: "0.25rem", letterSpacing: "0.07em", fontVariant: "small-caps",
  };
  const sectionWrap: React.CSSProperties = {
    width: "min(680px, 90vw)", margin: "0 auto",
    padding: "4rem 0",
  };

  return (
    <div className={serif.className} style={{ minHeight: "100vh", backgroundColor: BG }}>
      <style>{`
        @keyframes flapOpen    { 0%{transform:perspective(800px) rotateX(0deg)} 100%{transform:perspective(800px) rotateX(-180deg)} }
        @keyframes envShrink   { 0%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.92)} }
        @keyframes cardRise    { 0%{opacity:0;transform:translateY(50px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes fadeSlideUp { 0%{opacity:0;transform:translateY(24px)} 100%{opacity:1;transform:translateY(0)} }
        .flap-open  { animation: flapOpen 1s cubic-bezier(.4,0,.2,1) forwards; transform-origin: top center; }
        .env-shrink { animation: envShrink 0.5s ease-out 1.3s forwards; }
        .card-rise  { animation: cardRise 0.8s cubic-bezier(.22,1,.36,1) forwards; }
        .fade-up    { animation: fadeSlideUp 0.7s ease-out both; }
        .nav-link   { cursor:pointer; transition:color 0.2s; letter-spacing:0.1em; font-variant:small-caps; font-size:0.72rem; }
        .nav-link:hover { color: ${TAUPE_DARK} !important; }
        .attend-btn { cursor:pointer; transition:all 0.2s; }
        .attend-btn:hover { border-color:${TAUPE_DARK} !important; }
        .rsvp-btn:hover { background-color:${TAUPE_DARK} !important; }
        .hotel-card { transition: box-shadow 0.2s; }
        .hotel-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.12) !important; }
      `}</style>

      {/* ── STICKY NAV (shows after open) ── */}
      {cardVisible && (
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          backgroundColor: CREAM, borderBottom: `1px solid ${TAUPE_LIGHT}`,
          padding: "0.9rem 1.5rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          backdropFilter: "blur(6px)",
        }}>
          <span className={script.className} style={{ color: TAUPE, fontSize: "1.4rem" }}>Leo &amp; Liora</span>
          <div style={{ display: "flex", gap: "clamp(0.8rem, 3vw, 2rem)" }}>
            {[
              ["Schedule", scheduleRef],
              ["Hotels",   hotelsRef],
              ["Registry", registryRef],
              ["FAQs",     faqRef],
              ["RSVP",     rsvpRef],
            ].map(([label, ref]) => (
              <span
                key={label as string}
                className="nav-link"
                style={{ color: TAUPE }}
                onClick={() => scrollTo(ref as React.RefObject<HTMLDivElement>)}
              >
                {label as string}
              </span>
            ))}
          </div>
        </nav>
      )}

      {/* ── HERO ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(2rem,6vw,4rem) 1rem 0" }}>

        {/* Envelope */}
        {phase !== "open" && (
          <div
            onClick={openEnvelope}
            className={phase === "opening" ? "env-shrink" : ""}
            style={{ width: "min(520px, 88vw)", cursor: phase === "closed" ? "pointer" : "default", userSelect: "none", position: "relative", marginBottom: "1.5rem" }}
          >
            <div style={{
              width: "100%", paddingBottom: "66%", position: "relative",
              backgroundColor: CREAM, border: `1.5px solid ${TAUPE}`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.14)", overflow: "hidden",
            }}>
              <div style={{ position:"absolute",inset:0, background:`linear-gradient(to right,#ece5de 0%,transparent 55%)`, clipPath:"polygon(0% 0%,52% 50%,0% 100%)" }} />
              <div style={{ position:"absolute",inset:0, background:`linear-gradient(to left,#ece5de 0%,transparent 55%)`,  clipPath:"polygon(100% 0%,48% 50%,100% 100%)" }} />
              <div style={{ position:"absolute",inset:0, background:`linear-gradient(to top,#e5ddd6 0%,transparent 55%)`,   clipPath:"polygon(0% 100%,50% 46%,100% 100%)" }} />
              {phase === "closed" && (
                <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <p style={{ color:TAUPE, fontSize:"clamp(0.6rem,1.6vw,0.8rem)", letterSpacing:"0.14em", fontVariant:"small-caps" }}>tap to open</p>
                </div>
              )}
            </div>
            {/* Flap */}
            <div className={phase === "opening" ? "flap-open" : ""}
              style={{ position:"absolute",top:0,left:0,right:0,height:"53%",transformOrigin:"top center",zIndex:10 }}>
              <div style={{ width:"100%",height:"100%",backgroundColor:CREAM,border:`1.5px solid ${TAUPE}`,clipPath:"polygon(0% 0%,100% 0%,50% 100%)" }} />
            </div>
            {/* Seal */}
            {phase === "closed" && (
              <div style={{ position:"absolute",top:"22%",left:"50%",transform:"translateX(-50%)",zIndex:20,
                width:48,height:48,borderRadius:"50%",backgroundColor:TAUPE,
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 2px 10px rgba(0,0,0,0.18)" }}>
                <span className={serif.className} style={{ color:CREAM,fontSize:"1rem",fontStyle:"italic" }}>LL</span>
              </div>
            )}
          </div>
        )}

        {/* Invitation Card */}
        {cardVisible && (
          <div className="card-rise" style={{
            width:"min(580px,92vw)", aspectRatio:"1/1",
            position:"relative", backgroundColor:CREAM,
            border:`1.5px solid ${TAUPE_LIGHT}`,
            boxShadow:"0 16px 50px rgba(0,0,0,0.13)", overflow:"hidden",
          }}>
            <div style={{ position:"absolute",inset:0,opacity:0.04,
              backgroundImage:"radial-gradient(circle,#000 1px,transparent 1px)",backgroundSize:"18px 18px" }} />
            <div style={{ position:"absolute",top:0,left:0,width:"46%",height:"100%" }}><PalmTree /></div>
            <div style={{ position:"absolute",top:10,right:12,color:TAUPE,fontSize:"clamp(0.5rem,1.2vw,0.65rem)",direction:"rtl" }}>ב״ס</div>
            <div style={{ position:"absolute",top:16,right:16,color:TAUPE,fontStyle:"italic",lineHeight:1,display:"flex",alignItems:"flex-end" }}>
              <span style={{ fontSize:"clamp(2.8rem,9vw,4.8rem)" }}>L</span>
              <span style={{ fontSize:"clamp(2rem,6.5vw,3.4rem)",marginLeft:"-0.12em",marginBottom:"0.05em" }}>L</span>
            </div>
            <div style={{
              position:"absolute",top:0,right:0,bottom:0,left:"38%",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              textAlign:"center",
              paddingTop:"clamp(3rem,14%,5rem)",paddingBottom:"clamp(1rem,4%,2rem)",
              paddingLeft:"0.5rem",paddingRight:"clamp(0.5rem,3%,1.2rem)",
              gap:"clamp(0.15rem,0.5vw,0.35rem)",
            }}>
              <p style={{ color:TAUPE,fontVariant:"small-caps",letterSpacing:"0.07em",fontSize:"clamp(0.7rem,1.8vw,0.95rem)" }}>With Gratitude to Hashem</p>
              <p style={{ color:TAUPE,fontVariant:"small-caps",fontSize:"clamp(0.7rem,1.8vw,0.95rem)" }}>Mr. And Mrs. Moshe Baruh</p>
              <p style={{ color:TAUPE,fontVariant:"small-caps",fontSize:"clamp(0.7rem,1.8vw,0.95rem)" }}>Mr. And Mrs. Kanter</p>
              <p style={{ color:TAUPE,fontVariant:"small-caps",fontSize:"clamp(0.65rem,1.6vw,0.85rem)",lineHeight:1.6,marginTop:"0.2rem" }}>
                Request the honor of your presence<br />at the marriage of their children
              </p>
              <p className={script.className} style={{ color:TAUPE,fontSize:"clamp(2.2rem,7vw,3.8rem)",lineHeight:1.1,marginTop:"0.15rem" }}>Leo &amp; Liora</p>
              <p style={{ color:TAUPE,fontVariant:"small-caps",fontSize:"clamp(0.7rem,1.8vw,0.95rem)",marginTop:"0.25rem" }}>Thursday, August 13, 2026</p>
              <p style={{ color:TAUPE,fontVariant:"small-caps",fontSize:"clamp(0.65rem,1.6vw,0.85rem)",lineHeight:1.6 }}>
                Chuppah at Six in the Evening,<br />Reception to Follow
              </p>
              <p style={{ color:TAUPE,fontVariant:"small-caps",fontSize:"clamp(0.65rem,1.6vw,0.85rem)" }}>Shul of Bal Harbour</p>
            </div>
            <div style={{ position:"absolute",bottom:12,left:14,color:TAUPE,fontVariant:"small-caps",letterSpacing:"0.06em",fontSize:"clamp(0.6rem,1.4vw,0.78rem)" }}>
              Black Tie
            </div>
          </div>
        )}
      </div>

      {/* ── FLOATING MUSIC CONTROL ── */}
      {cardVisible && (
        <button
          onClick={toggleMute}
          title={muted ? "Unmute music" : "Mute music"}
          style={{
            position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 200,
            width: 44, height: 44, borderRadius: "50%",
            backgroundColor: TAUPE, color: CREAM, border: "none",
            cursor: "pointer", fontSize: "1.15rem",
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background-color 0.2s",
          }}
        >
          {muted ? "🔇" : "🎵"}
        </button>
      )}

      {/* ── WEDDING WEBSITE SECTIONS ── */}
      {cardVisible && (
        <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}>

          {/* ── SCHEDULE ── */}
          <div ref={scheduleRef} style={sectionWrap}>
            <Divider />
            <SectionHeading>Schedule</SectionHeading>
            <div style={{ display:"flex",flexDirection:"column",gap:"2rem" }}>
              {[
                { time:"5:45 PM", title:"Guests Arrive", desc:"Please be seated before the ceremony begins" },
                { time:"6:00 PM", title:"Chuppah Ceremony", desc:"Shul of Bal Harbour\n9540 Collins Ave, Surfside, FL 33154" },
                { time:"Following", title:"Cocktail Hour & Reception", desc:"Immediately following the ceremony at the same location" },
              ].map(ev => (
                <div key={ev.title} style={{
                  display:"flex",gap:"2rem",alignItems:"flex-start",
                  padding:"1.5rem 2rem",backgroundColor:CREAM,
                  border:`1px solid ${TAUPE_LIGHT}`,
                }}>
                  <div style={{ minWidth:90,textAlign:"right" }}>
                    <p style={{ color:TAUPE,fontVariant:"small-caps",fontSize:"0.95rem",letterSpacing:"0.08em" }}>{ev.time}</p>
                  </div>
                  <div style={{ width:1,backgroundColor:TAUPE_LIGHT,alignSelf:"stretch" }} />
                  <div>
                    <p style={{ color:TAUPE_DARK,fontVariant:"small-caps",letterSpacing:"0.08em",fontSize:"1.05rem",marginBottom:"0.35rem" }}>{ev.title}</p>
                    <p style={{ color:TAUPE,fontSize:"1rem",lineHeight:1.7,whiteSpace:"pre-line" }}>{ev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── HOTELS ── */}
          <div ref={hotelsRef} style={{ ...sectionWrap, borderTop:`1px solid ${TAUPE_LIGHT}` }}>
            <SectionHeading>Hotels</SectionHeading>
            <p style={{ textAlign:"center",color:TAUPE,fontSize:"1.05rem",marginBottom:"2rem",fontStyle:"italic" }}>
              We recommend the following hotels near the Shul of Bal Harbour.
            </p>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"1.25rem" }}>
              {[
                {
                  name:"The Surf Club, Four Seasons",
                  address:"9011 Collins Ave\nSurfside, FL 33154",
                  note:"Closest to venue — steps away",
                  tier:"Luxury",
                },
                {
                  name:"The Ritz-Carlton Bal Harbour",
                  address:"10295 Collins Ave\nBal Harbour, FL 33154",
                  note:"5 minutes north of venue",
                  tier:"Luxury",
                },
                {
                  name:"Marriott Stanton South Beach",
                  address:"161 Ocean Dr\nMiami Beach, FL 33139",
                  note:"~20 minutes south of venue",
                  tier:"Mid-Range",
                },
              ].map(h => (
                <div key={h.name} className="hotel-card" style={{
                  backgroundColor:CREAM,border:`1px solid ${TAUPE_LIGHT}`,
                  padding:"1.5rem",boxShadow:"0 4px 16px rgba(0,0,0,0.07)",
                }}>
                  <p style={{ color:TAUPE,fontSize:"0.75rem",fontVariant:"small-caps",letterSpacing:"0.1em",marginBottom:"0.4rem" }}>{h.tier}</p>
                  <p style={{ color:TAUPE_DARK,fontVariant:"small-caps",fontSize:"1.05rem",letterSpacing:"0.05em",marginBottom:"0.5rem" }}>{h.name}</p>
                  <p style={{ color:TAUPE,fontSize:"0.95rem",lineHeight:1.7,whiteSpace:"pre-line",marginBottom:"0.6rem" }}>{h.address}</p>
                  <p style={{ color:TAUPE_LIGHT,fontSize:"0.88rem",fontStyle:"italic" }}>{h.note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── REGISTRY ── */}
          <div ref={registryRef} style={{ ...sectionWrap, borderTop:`1px solid ${TAUPE_LIGHT}` }}>
            <SectionHeading>Registry</SectionHeading>
            <div style={{ textAlign:"center",padding:"2.5rem",backgroundColor:CREAM,border:`1px solid ${TAUPE_LIGHT}` }}>
              <p className={script.className} style={{ color:TAUPE,fontSize:"2rem",marginBottom:"1rem" }}>Coming Soon</p>
              <p style={{ color:TAUPE,fontSize:"0.9rem",lineHeight:1.8,fontStyle:"italic" }}>
                Your presence at our celebration is the greatest gift.<br />
                Registry details will be shared soon.
              </p>
            </div>
          </div>

          {/* ── FAQs ── */}
          <div ref={faqRef} style={{ ...sectionWrap, borderTop:`1px solid ${TAUPE_LIGHT}` }}>
            <SectionHeading>FAQs</SectionHeading>
            <div style={{ display:"flex",flexDirection:"column",gap:"1.25rem" }}>
              {[
                {
                  q:"What is the dress code?",
                  a:"Black Tie. We encourage our guests to dress formally for the occasion.",
                },
                {
                  q:"Where do I park?",
                  a:"Street parking is available on the street behind the CVS near the venue. Additional street parking is available in the surrounding area.",
                },
                {
                  q:"What time should I arrive?",
                  a:"Please arrive by 5:45 PM. The chuppah will begin promptly at 6:00 PM and we want everyone to be seated before the ceremony starts.",
                },
                {
                  q:"Where is the ceremony taking place?",
                  a:"Shul of Bal Harbour\n9540 Collins Ave, Surfside, FL 33154",
                },
                {
                  q:"Will the ceremony and reception be at the same location?",
                  a:"Yes, both the ceremony and reception will be held at the Shul of Bal Harbour.",
                },
              ].map(faq => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>

          {/* ── RSVP ── */}
          <div ref={rsvpRef} style={{ ...sectionWrap, borderTop:`1px solid ${TAUPE_LIGHT}` }}>
            <SectionHeading>RSVP</SectionHeading>
            <p style={{ textAlign:"center",color:TAUPE,fontSize:"1rem",fontStyle:"italic",marginBottom:"2rem" }}>
              Kindly reply by July 1, 2026
            </p>

            {submitted ? (
              <div style={{ textAlign:"center",padding:"3rem 0" }}>
                <p className={script.className} style={{ color:TAUPE,fontSize:"2.5rem" }}>Thank you, {name}!</p>
                <p style={{ color:TAUPE,marginTop:"0.75rem",fontSize:"0.95rem",fontStyle:"italic" }}>
                  {attending
                    ? `We can't wait to celebrate with you${partySize > 1 ? " and your guest" : ""}.`
                    : "We'll miss you — thank you for letting us know."}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display:"flex",flexDirection:"column",gap:"1.5rem",maxWidth:480,margin:"0 auto" }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input type="text" value={name} required placeholder="Your name"
                    onChange={e => setName(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Will you be attending?</label>
                  <div style={{ display:"flex",gap:"0.75rem" }}>
                    {[{ label:"Joyfully Accepts",value:true },{ label:"Regretfully Declines",value:false }].map(opt => (
                      <button key={String(opt.value)} type="button" className="attend-btn"
                        onClick={() => { setAttending(opt.value); if (!opt.value) setPartySize(1); }}
                        style={{
                          flex:1,padding:"0.7rem 0.5rem",
                          border:`1px solid ${attending === opt.value ? TAUPE_DARK : TAUPE}`,
                          backgroundColor:attending === opt.value ? TAUPE : "transparent",
                          color:attending === opt.value ? CREAM : TAUPE,
                          fontSize:"clamp(0.6rem,1.8vw,0.72rem)",fontVariant:"small-caps",
                          letterSpacing:"0.05em",cursor:"pointer",transition:"all 0.2s",
                          fontFamily:serif.style.fontFamily,
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {attending && (
                  <div>
                    <label style={labelStyle}>Number of Guests (including yourself)</label>
                    <select value={partySize} onChange={e => setPartySize(Number(e.target.value))}
                      style={{ ...inputStyle,cursor:"pointer" }}>
                      {[1,2].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Email <span style={{ fontStyle:"italic",fontVariant:"normal",letterSpacing:0 }}>(at least one required for reminders)</span></label>
                  <input type="email" value={email} placeholder="your@email.com"
                    onChange={e => setEmail(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Cell Phone <span style={{ fontStyle:"italic",fontVariant:"normal",letterSpacing:0 }}>(at least one required for reminders)</span></label>
                  <input type="tel" value={phone} placeholder="(555) 000-0000"
                    onChange={e => setPhone(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Song Request <span style={{ fontStyle:"italic",fontVariant:"normal",letterSpacing:0 }}>(optional)</span></label>
                  <input type="text" value={song} placeholder="What song will get you on the dance floor?"
                    onChange={e => setSong(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Advice for the Couple <span style={{ fontStyle:"italic",fontVariant:"normal",letterSpacing:0 }}>(optional)</span></label>
                  <textarea value={advice} placeholder="Best marriage advice you've got?" rows={3}
                    onChange={e => setAdvice(e.target.value)}
                    style={{ ...inputStyle,resize:"none",display:"block" }} />
                </div>

                {error && <p style={{ color:"#b85c5c",fontSize:"0.8rem" }}>{error}</p>}

                <button type="submit" className="rsvp-btn"
                  disabled={loading || attending === null || !name.trim() || (!email.trim() && !phone.trim())}
                  style={{
                    padding:"0.9rem",backgroundColor:TAUPE,color:CREAM,border:"none",
                    fontVariant:"small-caps",letterSpacing:"0.14em",fontSize:"0.8rem",
                    cursor:"pointer",transition:"background-color 0.2s",
                    opacity:(loading||attending===null||!name.trim()||(!email.trim()&&!phone.trim()))?0.4:1,
                    fontFamily:serif.style.fontFamily,
                  }}>
                  {loading ? "Sending..." : "Submit RSVP"}
                </button>
              </form>
            )}
          </div>

          {/* Footer */}
          <footer style={{ borderTop:`1px solid ${TAUPE_LIGHT}`,width:"100%",padding:"2rem 1rem",textAlign:"center" }}>
            <p className={script.className} style={{ color:TAUPE,fontSize:"1.8rem" }}>Leo &amp; Liora</p>
            <p style={{ color:TAUPE_LIGHT,fontSize:"0.7rem",letterSpacing:"0.1em",fontVariant:"small-caps",marginTop:"0.3rem" }}>
              August 13, 2026 · Surfside, Florida
            </p>
          </footer>
        </div>
      )}
    </div>
  );
}

// ─── FAQ accordion item ───────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ backgroundColor: CREAM, border: `1px solid ${TAUPE_LIGHT}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "1.1rem 1.5rem", backgroundColor: "transparent", border: "none",
          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
        }}
      >
        <span style={{ color: TAUPE_DARK, fontVariant: "small-caps", letterSpacing: "0.06em", fontSize: "1rem" }}>{q}</span>
        <span style={{ color: TAUPE, fontSize: "1.1rem", transition: "transform 0.2s", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
      </button>
      {open && (
        <div style={{ padding: "0 1.5rem 1.1rem", color: TAUPE, fontSize: "1rem", lineHeight: 1.8, whiteSpace: "pre-line" }}>
          {a}
        </div>
      )}
    </div>
  );
}
