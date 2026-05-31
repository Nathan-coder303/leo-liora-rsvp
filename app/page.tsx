"use client";

import { useState } from "react";

export default function Home() {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || attending === null) return;
    if (!email.trim() && !phone.trim()) {
      setError("Please provide at least an email or phone number.");
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
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-light mb-4">Thank you, {name}!</h1>
          <p className="text-gray-500">
            {attending
              ? `We can't wait to celebrate with you${partySize > 1 ? ` and your ${partySize - 1} guest${partySize - 1 > 1 ? "s" : ""}` : ""}.`
              : "We'll miss you — thank you for letting us know."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <p className="text-sm tracking-widest text-gray-400 uppercase mb-2">You are invited to the wedding of</p>
          <h1 className="text-5xl font-light mb-1">Leo &amp; Liora</h1>
          <p className="text-gray-400 mt-3">August 13, 2026</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your name"
              className="w-full border-b border-gray-300 py-2 text-gray-800 outline-none focus:border-gray-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-3">Will you be attending?</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setAttending(true)}
                className={`flex-1 py-3 border text-sm transition-colors ${
                  attending === true
                    ? "border-gray-800 bg-gray-800 text-white"
                    : "border-gray-300 text-gray-600 hover:border-gray-500"
                }`}
              >
                Joyfully Accepts
              </button>
              <button
                type="button"
                onClick={() => { setAttending(false); setPartySize(1); }}
                className={`flex-1 py-3 border text-sm transition-colors ${
                  attending === false
                    ? "border-gray-800 bg-gray-800 text-white"
                    : "border-gray-300 text-gray-600 hover:border-gray-500"
                }`}
              >
                Regretfully Declines
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Email <span className="text-gray-400">(at least one required for reminders)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border-b border-gray-300 py-2 text-gray-800 outline-none focus:border-gray-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Cell Phone <span className="text-gray-400">(at least one required for reminders)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full border-b border-gray-300 py-2 text-gray-800 outline-none focus:border-gray-800 bg-transparent"
            />
          </div>

          {attending && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Number of Guests (including yourself)</label>
              <select
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
                className="w-full border-b border-gray-300 py-2 text-gray-800 outline-none focus:border-gray-800 bg-transparent"
              >
                {[1, 2].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Song Request <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={song}
              onChange={(e) => setSong(e.target.value)}
              placeholder="What song will get you on the dance floor?"
              className="w-full border-b border-gray-300 py-2 text-gray-800 outline-none focus:border-gray-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Advice for the Couple <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
              placeholder="Best marriage advice you've got?"
              rows={3}
              className="w-full border-b border-gray-300 py-2 text-gray-800 outline-none focus:border-gray-800 bg-transparent resize-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || attending === null || !name.trim() || (!email.trim() && !phone.trim())}
            className="w-full py-3 bg-gray-800 text-white text-sm tracking-wide disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            {loading ? "Sending..." : "Submit RSVP"}
          </button>
        </form>
      </div>
    </main>
  );
}
