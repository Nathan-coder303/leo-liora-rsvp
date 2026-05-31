"use client";

import { useState } from "react";
import { Great_Vibes, Cormorant_Garamond } from "next/font/google";

const script = Great_Vibes({ weight: "400", subsets: ["latin"] });
const serif = Cormorant_Garamond({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const TAUPE = "#a89890";
const TAUPE_DARK = "#8a7068";
const CREAM = "#f5f0eb";
const BG = "#ddd6cf";

function PalmTree() {
  return (
    <svg viewBox="0 0 200 560" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <path
        d="M95,560 C92,480 88,400 93,320 C98,240 102,170 95,100 C91,62 87,40 80,12"
        stroke={TAUPE} strokeWidth="14" strokeLinecap="round" fill="none"
      />
      {/* frond upper-right large */}
      <path d="M80,12 C105,-4 168,-18 205,2 C188,-1 142,7 113,21 C97,29 83,20 80,12Z" fill={TAUPE} />
      {/* frond right */}
      <path d="M80,12 C100,22 166,14 207,42 C186,33 134,32 104,41 C90,46 80,30 80,12Z" fill={TAUPE} />
      {/* frond lower-right */}
      <path d="M80,12 C96,38 155,62 193,99 C169,80 118,62 94,63 C83,63 76,35 80,12Z" fill={TAUPE} />
      {/* frond far lower-right */}
      <path d="M80,12 C88,50 134,98 162,148 C140,120 100,88 85,80 C77,76 73,40 80,12Z" fill={TAUPE} />
      {/* frond upper-left */}
      <path d="M80,12 C61,-4 22,-16 0,1 C17,-2 54,9 67,22 C73,28 80,20 80,12Z" fill={TAUPE} />
      {/* frond left */}
      <path d="M80,12 C65,28 22,34 0,56 C18,44 56,42 72,50 C79,54 81,28 80,12Z" fill={TAUPE} />
      {/* frond lower-left */}
      <path d="M80,12 C70,42 32,76 8,112 C26,90 62,70 76,68 C82,66 83,36 80,12Z" fill={TAUPE} />
    </svg>
  );
}

function EnvelopeSeal() {
  return (
    <div style={{
      width: 48, height: 48, borderRadius: "50%",
      backgroundColor: TAUPE,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
    }}>
      <span className={serif.className} style={{ color: CREAM, fontSize: "1rem", fontStyle: "italic", letterSpacing: "-0.02em" }}>LL</span>
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

  function openEnvelope() {
    if (phase !== "closed") return;
    setPhase("opening");
    setTimeout(() => setCardVisible(true), 900);
    setTimeout(() => setPhase("open"), 1800);
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
    width: "100%",
    borderBottom: `1px solid ${TAUPE}`,
    padding: "0.5rem 0",
    color: TAUPE_DARK,
    outline: "none",
    backgroundColor: "transparent",
    fontSize: "1rem",
    fontFamily: serif.style.fontFamily,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    color: TAUPE,
    marginBottom: "0.25rem",
    letterSpacing: "0.06em",
    fontVariant: "small-caps",
  };

  return (
    <div
      className={serif.className}
      style={{ minHeight: "100vh", backgroundColor: BG, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "5rem" }}
    >
      <style>{`
        @keyframes flapOpen {
          0%   { transform: perspective(800px) rotateX(0deg);    }
          100% { transform: perspective(800px) rotateX(-180deg); }
        }
        @keyframes envelopeShrink {
          0%   { opacity: 1; transform: scale(1);    }
          100% { opacity: 0; transform: scale(0.92); }
        }
        @keyframes cardRise {
          0%   { opacity: 0; transform: translateY(50px); }
          100% { opacity: 1; transform: translateY(0);    }
        }
        @keyframes formFadeIn {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0);    }
        }
        .flap-open    { animation: flapOpen 1s cubic-bezier(0.4,0,0.2,1) forwards; transform-origin: top center; }
        .env-shrink   { animation: envelopeShrink 0.5s ease-out 1.3s forwards; }
        .card-rise    { animation: cardRise 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
        .form-fade-in { animation: formFadeIn 0.6s ease-out 0.4s both; }
        .rsvp-btn:hover { background-color: #8a7068 !important; }
        .attend-btn:hover { border-color: ${TAUPE_DARK} !important; color: ${TAUPE_DARK} !important; }
      `}</style>

      {/* ── ENVELOPE ── */}
      {phase !== "open" && (
        <div
          onClick={openEnvelope}
          className={phase === "opening" ? "env-shrink" : ""}
          style={{
            marginTop: "clamp(3rem, 10vw, 6rem)",
            width: "min(520px, 88vw)",
            cursor: phase === "closed" ? "pointer" : "default",
            userSelect: "none",
            position: "relative",
          }}
        >
          {/* Envelope body */}
          <div style={{
            width: "100%",
            paddingBottom: "66%",
            position: "relative",
            backgroundColor: CREAM,
            border: `1.5px solid ${TAUPE}`,
            boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
            overflow: "hidden",
          }}>
            {/* Left fold */}
            <div style={{ position: "absolute", inset: 0,
              background: `linear-gradient(to right, #ece5de 0%, transparent 55%)`,
              clipPath: "polygon(0% 0%, 52% 50%, 0% 100%)" }} />
            {/* Right fold */}
            <div style={{ position: "absolute", inset: 0,
              background: `linear-gradient(to left, #ece5de 0%, transparent 55%)`,
              clipPath: "polygon(100% 0%, 48% 50%, 100% 100%)" }} />
            {/* Bottom fold */}
            <div style={{ position: "absolute", inset: 0,
              background: `linear-gradient(to top, #e5ddd6 0%, transparent 55%)`,
              clipPath: "polygon(0% 100%, 50% 46%, 100% 100%)" }} />

            {phase === "closed" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: TAUPE, fontSize: "clamp(0.6rem, 1.6vw, 0.8rem)", letterSpacing: "0.14em", fontVariant: "small-caps" }}>
                  tap to open
                </p>
              </div>
            )}
          </div>

          {/* Flap */}
          <div
            className={phase === "opening" ? "flap-open" : ""}
            style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: "53%",
              transformOrigin: "top center",
              zIndex: 10,
            }}
          >
            <div style={{
              width: "100%", height: "100%",
              backgroundColor: CREAM,
              border: `1.5px solid ${TAUPE}`,
              clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)",
            }} />
          </div>

          {/* Wax seal */}
          {phase === "closed" && (
            <div style={{ position: "absolute", top: "22%", left: "50%", transform: "translateX(-50%)", zIndex: 20 }}>
              <EnvelopeSeal />
            </div>
          )}
        </div>
      )}

      {/* ── INVITATION CARD ── */}
      {cardVisible && (
        <div
          className="card-rise"
          style={{
            marginTop: phase === "open" ? "clamp(2rem, 8vw, 4rem)" : "1.5rem",
            width: "min(580px, 92vw)",
            aspectRatio: "1 / 1",
            position: "relative",
            backgroundColor: CREAM,
            border: `1.5px solid #c4b5ad`,
            boxShadow: "0 16px 50px rgba(0,0,0,0.13)",
            overflow: "hidden",
          }}
        >
          {/* Subtle texture */}
          <div style={{
            position: "absolute", inset: 0, opacity: 0.04,
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }} />

          {/* Palm tree */}
          <div style={{ position: "absolute", top: 0, left: 0, width: "46%", height: "100%" }}>
            <PalmTree />
          </div>

          {/* Hebrew - top right */}
          <div style={{
            position: "absolute", top: 10, right: 12,
            color: TAUPE, fontSize: "clamp(0.5rem, 1.2vw, 0.65rem)",
            direction: "rtl",
          }}>
            ב״ס
          </div>

          {/* Monogram */}
          <div style={{
            position: "absolute", top: 16, right: 16,
            color: TAUPE, fontStyle: "italic", lineHeight: 1,
            display: "flex", alignItems: "flex-end",
          }}>
            <span style={{ fontSize: "clamp(2.8rem, 9vw, 4.8rem)" }}>L</span>
            <span style={{ fontSize: "clamp(2rem, 6.5vw, 3.4rem)", marginLeft: "-0.12em", marginBottom: "0.05em" }}>L</span>
          </div>

          {/* Text block */}
          <div style={{
            position: "absolute",
            top: 0, right: 0, bottom: 0, left: "38%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textAlign: "center",
            paddingTop: "clamp(3rem, 14%, 5rem)",
            paddingBottom: "clamp(1rem, 4%, 2rem)",
            paddingLeft: "0.5rem",
            paddingRight: "clamp(0.5rem, 3%, 1.2rem)",
            gap: "clamp(0.12rem, 0.4vw, 0.28rem)",
          }}>
            <p style={{ color: TAUPE, fontVariant: "small-caps", letterSpacing: "0.07em", fontSize: "clamp(0.48rem, 1.3vw, 0.68rem)" }}>
              With Gratitude to Hashem
            </p>
            <p style={{ color: TAUPE, fontVariant: "small-caps", fontSize: "clamp(0.48rem, 1.3vw, 0.68rem)" }}>
              Mr. And Mrs. Moshe Baruh
            </p>
            <p style={{ color: TAUPE, fontVariant: "small-caps", fontSize: "clamp(0.48rem, 1.3vw, 0.68rem)" }}>
              Mr. And Mrs. Kanter
            </p>
            <p style={{ color: TAUPE, fontVariant: "small-caps", fontSize: "clamp(0.44rem, 1.2vw, 0.62rem)", lineHeight: 1.5, marginTop: "0.15rem" }}>
              Request the honor of your presence<br />at the marriage of their children
            </p>
            <p className={script.className} style={{ color: TAUPE, fontSize: "clamp(1.7rem, 5.5vw, 3rem)", lineHeight: 1.1, marginTop: "0.1rem" }}>
              Leo &amp; Liora
            </p>
            <p style={{ color: TAUPE, fontVariant: "small-caps", fontSize: "clamp(0.48rem, 1.3vw, 0.68rem)", marginTop: "0.2rem" }}>
              Thursday, August 13, 2026
            </p>
            <p style={{ color: TAUPE, fontVariant: "small-caps", fontSize: "clamp(0.44rem, 1.2vw, 0.62rem)", lineHeight: 1.5 }}>
              Chuppah at Six in the Evening,<br />Reception to Follow
            </p>
            <p style={{ color: TAUPE, fontVariant: "small-caps", fontSize: "clamp(0.44rem, 1.2vw, 0.62rem)" }}>
              Shul of Bal Harbour
            </p>
          </div>

          {/* Black Tie */}
          <div style={{
            position: "absolute", bottom: 10, left: 12,
            color: TAUPE, fontVariant: "small-caps", letterSpacing: "0.06em",
            fontSize: "clamp(0.42rem, 1.1vw, 0.6rem)",
          }}>
            Black Tie
          </div>
        </div>
      )}

      {/* ── RSVP FORM ── */}
      {cardVisible && (
        <div
          className="form-fade-in"
          style={{ width: "min(460px, 88vw)", marginTop: "clamp(2rem, 6vw, 3.5rem)" }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.8rem" }}>
            <p style={{ color: TAUPE, fontVariant: "small-caps", letterSpacing: "0.12em", fontSize: "0.7rem" }}>
              — kindly reply —
            </p>
          </div>

          {submitted ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <p className={script.className} style={{ color: TAUPE, fontSize: "2.5rem" }}>
                Thank you, {name}!
              </p>
              <p style={{ color: TAUPE, marginTop: "0.75rem", fontSize: "0.95rem", fontStyle: "italic" }}>
                {attending
                  ? `We can't wait to celebrate with you${partySize > 1 ? " and your guest" : ""}.`
                  : "We'll miss you — thank you for letting us know."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>

              <div>
                <label style={labelStyle}>Full Name</label>
                <input type="text" value={name} required placeholder="Your name"
                  onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Will you be attending?</label>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {[
                    { label: "Joyfully Accepts", value: true },
                    { label: "Regretfully Declines", value: false },
                  ].map(opt => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      className="attend-btn"
                      onClick={() => { setAttending(opt.value); if (!opt.value) setPartySize(1); }}
                      style={{
                        flex: 1, padding: "0.65rem 0.5rem",
                        border: `1px solid ${attending === opt.value ? TAUPE_DARK : TAUPE}`,
                        backgroundColor: attending === opt.value ? TAUPE : "transparent",
                        color: attending === opt.value ? CREAM : TAUPE,
                        fontSize: "clamp(0.6rem, 1.8vw, 0.75rem)",
                        fontVariant: "small-caps", letterSpacing: "0.05em",
                        cursor: "pointer", transition: "all 0.2s",
                        fontFamily: serif.style.fontFamily,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {attending && (
                <div>
                  <label style={labelStyle}>Number of Guests (including yourself)</label>
                  <select value={partySize} onChange={e => setPartySize(Number(e.target.value))} style={{ ...inputStyle, cursor: "pointer" }}>
                    {[1, 2].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label style={labelStyle}>Email <span style={{ fontStyle: "italic", fontVariant: "normal", letterSpacing: 0 }}>(at least one required for reminders)</span></label>
                <input type="email" value={email} placeholder="your@email.com"
                  onChange={e => setEmail(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Cell Phone <span style={{ fontStyle: "italic", fontVariant: "normal", letterSpacing: 0 }}>(at least one required for reminders)</span></label>
                <input type="tel" value={phone} placeholder="(555) 000-0000"
                  onChange={e => setPhone(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Song Request <span style={{ fontStyle: "italic", fontVariant: "normal", letterSpacing: 0 }}>(optional)</span></label>
                <input type="text" value={song} placeholder="What song will get you on the dance floor?"
                  onChange={e => setSong(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Advice for the Couple <span style={{ fontStyle: "italic", fontVariant: "normal", letterSpacing: 0 }}>(optional)</span></label>
                <textarea value={advice} placeholder="Best marriage advice you've got?" rows={3}
                  onChange={e => setAdvice(e.target.value)}
                  style={{ ...inputStyle, resize: "none", display: "block" }} />
              </div>

              {error && <p style={{ color: "#b85c5c", fontSize: "0.8rem" }}>{error}</p>}

              <button
                type="submit"
                className="rsvp-btn"
                disabled={loading || attending === null || !name.trim() || (!email.trim() && !phone.trim())}
                style={{
                  padding: "0.85rem",
                  backgroundColor: TAUPE,
                  color: CREAM,
                  border: "none",
                  fontVariant: "small-caps",
                  letterSpacing: "0.12em",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  opacity: (loading || attending === null || !name.trim() || (!email.trim() && !phone.trim())) ? 0.4 : 1,
                  fontFamily: serif.style.fontFamily,
                }}
              >
                {loading ? "Sending..." : "Submit RSVP"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
