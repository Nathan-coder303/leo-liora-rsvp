"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  partySize: number;
  invitedBy: string;
  phone: string;
  email: string;
  firstOpened: string;
  sentAt: string;
  manualStatus: string;
  titleOverride: string;
  cycleCount: number;
  lastContactedAt: string;
  statusDate: string;
  effectiveStatus: "attending" | "committed" | "declined" | "fyi" | "pending" | "removed";
};

const TEMPLATE_KEY = "leo-liora-invite-template";
const DEFAULT_TEMPLATE =
  `Hi {name}! 💍\nLeo & Liora are getting married on August 13, 2026 at the Shul of Bal Harbour. We'd love for you to celebrate with us.\n\nPlease RSVP here: {link}`;

// Reminder templates — filled out here, then pick which one to send per guest.
// 1–3 chase the RSVP; 4–6 are countdown notes to guests who already said yes.
const REMINDER_KEYS = ["reminder1", "reminder2", "reminder3", "reminder4", "reminder5", "reminder6", "reminder7"] as const;
const DEFAULT_REMINDERS = [
  `Hi {name}! Just a gentle reminder to RSVP for Leo & Liora's wedding 💍\n\n{link}`,
  `Hi {name}, we haven't heard back yet and would love to know if you can join us. Please RSVP here: {link}`,
  `Hi {name}, last call to RSVP for Leo & Liora's wedding so we can finalize the guest count 🙏\n{link}`,
  // Reminder 4 — the 11-day countdown (send Aug 2)
  `Hi {name} — 11 days. 💍✨\n\nThe countdown is officially on, and we're getting more excited every day.\n\nThank you for being part of this moment—it truly means the world to us, and we can't wait to celebrate together.\n\nThursday, August 13, 2026\n\n🥂 Cocktail Hour | 5:00 PM\n💍 Ceremony to Follow\n\n📍 The Shul of Bal Harbour\n9540 Collins Ave\nSurfside, FL 33154\n\nThe invite is already on your calendar.\n\nAll that's left is to show up, celebrate, dance, and help us make some unforgettable memories.\n\nSee you in 11 days.\n\nLeo & Liora ❤️`,
  // Reminder 5 — the night before (send Aug 12)
  `Hi {name} — tomorrow. 💍✨\n\nAfter all the counting down, it's finally here.\n\nThursday, August 13, 2026\n\n🥂 Cocktail Hour | 5:00 PM\n💍 Ceremony to Follow\n\n📍 The Shul of Bal Harbour\n9540 Collins Ave\nSurfside, FL 33154\n\nCome a few minutes early so you're settled with a drink in hand before we begin. Parking is along Collins Ave and in the garage next to the Shul.\n\nWe can't wait to see your face in that room.\n\nSee you tomorrow.\n\nLeo & Liora ❤️`,
  // Reminder 6 — wedding day, around noon (send Aug 13)
  `Hi {name} — today's the day. 💍✨\n\nWe're getting married in a few hours, and we can't wait to celebrate with you.\n\n🥂 Cocktail Hour | 5:00 PM\n💍 Ceremony to Follow\n\n📍 The Shul of Bal Harbour\n9540 Collins Ave\nSurfside, FL 33154\n\nDoors open at 5:00 — come early, grab a drink, and find us.\n\nBring your dancing shoes. See you tonight! 🎉\n\nLeo & Liora ❤️`,
  // Reminder 7 — the 2-day countdown (send Aug 11). Appended, not slotted in
  // date order, so the already-saved reminder5/6 text keeps its own key.
  `Hi {name} — 2 days! 💍✨\n\nThat's 48 hours. 2,880 minutes. Not that anyone is counting (we are, obviously).\n\nThe rings are ready, the flowers are in, and Leo's speech is currently 11 pages long. Liora is gently negotiating it down to three.\n\nThursday, August 13, 2026\n\n🥂 Cocktail Hour | 5:00 PM\n💍 Ceremony to Follow\n\n📍 The Shul of Bal Harbour\n9540 Collins Ave\nSurfside, FL 33154\n\n💌 Your invitation: {link}\n📅 Add to your calendar: https://calendar.google.com/calendar/render?action=TEMPLATE&text=Leo%20%26%20Liora%27s%20Wedding&dates=20260813T210000Z%2F20260814T040000Z&location=The%20Shul%20of%20Bal%20Harbour%2C%209540%20Collins%20Ave%2C%20Surfside%2C%20FL%2033154\n\nYour only job: show up, look wonderful (easy for you), and bring your appetite.\n\nSee you in 2 days!\n\nLeo & Liora ❤️`,
];
const MSG_LABELS = ["Invitation", "Reminder 1", "Reminder 2", "Reminder 3", "R4 · 11 Days", "Aug 12 · Eve", "Aug 13 · Day Of", "Aug 11 · 2 Days"];
/** Picker order. Storage keys stay put; only the display sequence is dated. */
const MSG_ORDER = [0, 1, 2, 3, 4, 7, 5, 6];

const SITE_BASE = "https://leo-liora-rsvp.vercel.app";

// Display phone with + prefix for any non-US number (more than 10 digits)
function displayPhone(p: string): string {
  if (!p) return "";
  const digits = p.replace(/[^\d]/g, "");
  return digits.length > 10 ? `+${digits}` : digits;
}

type CycleFilter    = "all" | "never" | "1" | "2" | "3plus";
type ResponseFilter = "all" | "not-opened" | "opened" | "not-sent" | "classified" | "pending" | "attending" | "committed" | "declined" | "fyi" | "no-phone" | "no-email";

// "No Email" = coming to the wedding but has no address on file, so the countdown
// notes have to reach them by text instead of the email blast.
/** Whose guest this is. Blank invitedBy means Baruh, as on the /baruh page. */
const hostOf = (g: { invitedBy: string }) => g.invitedBy?.trim() || "Baruh";

const isNoEmail = (g: { email: string; effectiveStatus: string }) =>
  !g.email && (g.effectiveStatus === "attending" || g.effectiveStatus === "committed");
type SortKey        = "name" | "recent" | "cycle";

export default function SendPage() {
  const [guests,    setGuests]    = useState<Guest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [template,  setTemplate]  = useState(DEFAULT_TEMPLATE);
  const [cycleFilter,    setCycleFilter]    = useState<CycleFilter>("all");
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("not-opened");
  // Who invited them. Blank counts as "Baruh", matching the /baruh page.
  // Defaults to Baruh: this tab is the Baruh list now, with everyone else on
  // /dayof. Switch the dropdown to see another host.
  const [hostFilter, setHostFilter] = useState<string>("Baruh");
  /** Hosts present in the sheet, with their live guest counts. Baruh first. */
  const hosts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of guests) {
      if (g.effectiveStatus === "removed") continue;
      const h = hostOf(g);
      m.set(h, (m.get(h) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) =>
      a[0] === "Baruh" ? -1 : b[0] === "Baruh" ? 1 : a[0].localeCompare(b[0])
    );
  }, [guests]);
  const [sortKey,        setSortKey]        = useState<SortKey>("name");
  const [search,    setSearch]    = useState("");

  // Inline phone editing
  const [editRow,   setEditRow]   = useState<number | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [copiedRow, setCopiedRow] = useState<number | null>(null);

  // Import contacts panel
  const [importOpen,  setImportOpen]  = useState(false);
  const [importText,  setImportText]  = useState("");
  const [importPreview, setImportPreview] = useState<{ matched: { guest: Guest; phone: string; sourceName: string }[]; unmatched: { name: string; phone: string }[] } | null>(null);
  const [importApplying, setImportApplying] = useState(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Reminder templates + which message is currently selected to send (0 = invitation, 1..6 = reminders)
  const [reminders, setReminders] = useState<string[]>(DEFAULT_REMINDERS);
  const [remindersLoaded, setRemindersLoaded] = useState(false);
  const [reminderStatus, setReminderStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeMsg, setActiveMsg] = useState(0);

  // Load the shared template from the Sheet on mount (fallback to localStorage cache if API fails)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          const t = data.settings?.inviteTemplate;
          if (typeof t === "string" && t.length > 0) setTemplate(t);
          // Load any saved reminder templates, keeping the defaults for blanks
          setReminders(prev => prev.map((d, i) => {
            const v = data.settings?.[REMINDER_KEYS[i]];
            return typeof v === "string" && v.length > 0 ? v : d;
          }));
        } else {
          const saved = localStorage.getItem(TEMPLATE_KEY);
          if (saved) setTemplate(saved);
        }
      } catch {
        try { const saved = localStorage.getItem(TEMPLATE_KEY); if (saved) setTemplate(saved); } catch {}
      } finally {
        setTemplateLoaded(true);
        setRemindersLoaded(true);
      }
    })();
  }, []);

  // Debounced save to the Sheet (700ms after last keystroke) once the initial fetch is done
  useEffect(() => {
    if (!templateLoaded) return;
    try { localStorage.setItem(TEMPLATE_KEY, template); } catch {}
    setTemplateStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "inviteTemplate", value: template }),
        });
        setTemplateStatus("saved");
        setTimeout(() => setTemplateStatus("idle"), 1500);
      } catch { setTemplateStatus("idle"); }
    }, 700);
    return () => clearTimeout(timer);
  }, [template, templateLoaded]);

  // Debounced save for the reminder templates
  useEffect(() => {
    if (!remindersLoaded) return;
    setReminderStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await Promise.all(REMINDER_KEYS.map((k, i) =>
          fetch("/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: k, value: reminders[i] ?? "" }),
          })));
        setReminderStatus("saved");
        setTimeout(() => setReminderStatus("idle"), 1500);
      } catch { setReminderStatus("idle"); }
    }, 700);
    return () => clearTimeout(timer);
  }, [reminders, remindersLoaded]);

  const load = useCallback(async (preserveScroll = false) => {
    const scrollY = preserveScroll ? window.scrollY : 0;
    if (!preserveScroll) setLoading(true);
    try {
      const res = await fetch("/api/guests");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGuests(data.guests);
      if (preserveScroll) requestAnimationFrame(() => window.scrollTo(0, scrollY));
    } catch { setError("Failed to load."); }
    finally { if (!preserveScroll) setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function savePhone(g: Guest) {
    const cleaned = editPhone.replace(/[^\d]/g, "");
    setGuests(prev => prev.map(x => x.sheetRow === g.sheetRow ? { ...x, phone: cleaned } : x));
    setEditRow(null);
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName, lastName: g.lastName,
          manualStatus: g.manualStatus || "", prevManualStatus: g.manualStatus || "",
          phone: cleaned,
        }),
      });
    } catch { setError("Save failed."); }
  }

  async function toggleSent(g: Guest) {
    const becomingSent = !g.sentAt;
    const stamp = becomingSent ? new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month:"2-digit", day:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit", hour12:true,
    }) : "";
    // First-ever toggle → cycle 1. Un-check → reset cycles.
    const newCycle = becomingSent ? (g.cycleCount || 1) : 0;
    setGuests(prev => prev.map(x => x.sheetRow === g.sheetRow
      ? { ...x, sentAt: stamp, cycleCount: newCycle, lastContactedAt: becomingSent ? stamp : "" }
      : x));
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName, lastName: g.lastName,
          manualStatus: g.manualStatus || "", prevManualStatus: g.manualStatus || "",
          markSent: becomingSent,
          clearSent: !becomingSent,
          resetCycles: !becomingSent,
        }),
      });
    } catch { setError("Save failed."); }
  }

  // Called each time a contact action fires (WhatsApp / SMS / Copy).
  // Increments cycleCount and stamps lastContactedAt. Also sets sentAt on first send.
  async function recordContact(g: Guest) {
    const stamp = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      month:"2-digit", day:"2-digit", year:"numeric",
      hour:"2-digit", minute:"2-digit", hour12:true,
    });
    const nextCycle = (g.cycleCount || 0) + 1;
    const newSentAt = g.sentAt || stamp;
    setGuests(prev => prev.map(x => x.sheetRow === g.sheetRow
      ? { ...x, sentAt: newSentAt, cycleCount: nextCycle, lastContactedAt: stamp }
      : x));
    try {
      await fetch("/api/guests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetRow: g.sheetRow,
          firstName: g.firstName, lastName: g.lastName,
          manualStatus: g.manualStatus || "", prevManualStatus: g.manualStatus || "",
          markSent: !g.sentAt, // stamp sentAt if this is the very first contact
          incrementCycle: true,
        }),
      });
    } catch { setError("Save failed."); }
  }

  function inviteURL(g: Guest) {
    return `${SITE_BASE}/?g=${g.sheetRow}`;
  }

  function buildMessage(g: Guest) {
    // The selected message (Invitation or one of the 3 reminders) is what gets sent
    const text = activeMsg === 0 ? template : (reminders[activeMsg - 1] ?? "");
    return text
      .replace(/\{name\}/g, g.firstName)
      .replace(/\{fullName\}/g, g.fullName)
      .replace(/\{link\}/g, inviteURL(g));
  }

  function whatsappURL(g: Guest) {
    const phone = g.phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(buildMessage(g));
    if (!phone) return `https://wa.me/?text=${text}`;
    return `https://wa.me/${phone}?text=${text}`;
  }

  // Parse pasted contact data — handles vCard, CSV, and "Name, +phone" lines
  function parseContacts(text: string): { name: string; phone: string }[] {
    const out: { name: string; phone: string }[] = [];
    if (/BEGIN:VCARD/i.test(text)) {
      // vCard parsing — unfold continuation lines first
      const unfolded = text.replace(/\r?\n[ \t]/g, "");
      const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
      for (const card of cards) {
        const lines = card.split(/\r?\n/);
        let name = ""; let phone = "";
        for (const line of lines) {
          if (/^FN[:;]/i.test(line)) {
            name = line.replace(/^FN[^:]*:/i, "").trim();
          } else if (/^N[:;]/i.test(line) && !name) {
            const parts = line.replace(/^N[^:]*:/i, "").split(";");
            const last = parts[0]?.trim() ?? ""; const first = parts[1]?.trim() ?? "";
            name = [first, last].filter(Boolean).join(" ");
          } else if (/^TEL[:;]/i.test(line) && !phone) {
            phone = line.replace(/^TEL[^:]*:/i, "").trim();
          }
        }
        if (name && phone) out.push({ name, phone });
      }
    } else {
      // CSV / plain-text — one contact per line
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || /^name\b/i.test(line)) continue;
        // Find a phone-shaped substring
        const phoneMatch = line.match(/\+?[\d][\d\s()\-.]{7,}/);
        if (!phoneMatch) continue;
        const phone = phoneMatch[0];
        // Name = the rest, minus the phone, minus separators
        const name = line.replace(phone, "").replace(/[,;|\t]/g, " ").replace(/\s+/g, " ").trim();
        if (name) out.push({ name, phone });
      }
    }
    return out;
  }

  function normalize(s: string) { return s.trim().toLowerCase().replace(/\s+/g, " "); }

  function matchContacts() {
    const contacts = parseContacts(importText);
    const matched: { guest: Guest; phone: string; sourceName: string }[] = [];
    const unmatched: { name: string; phone: string }[] = [];
    const usedRows = new Set<number>();
    for (const c of contacts) {
      const cleanedPhone = c.phone.replace(/[^\d]/g, "");
      if (!cleanedPhone) continue;
      const cKey = normalize(c.name);
      // 1) exact full-name match
      let hit = guests.find(g => !usedRows.has(g.sheetRow) && normalize(g.fullName) === cKey);
      if (!hit) {
        // 2) last + first letter match
        const parts = cKey.split(" ");
        const cFirst = parts[0]; const cLast = parts.slice(1).join(" ");
        if (cLast) {
          const candidates = guests.filter(g =>
            !usedRows.has(g.sheetRow) && normalize(g.lastName) === cLast
          );
          if (candidates.length === 1) {
            const g = candidates[0];
            const gFirst = normalize(g.firstName);
            if (gFirst[0] === cFirst[0] || gFirst.startsWith(cFirst) || cFirst.startsWith(gFirst)) {
              hit = g;
            }
          }
        }
      }
      if (hit) {
        usedRows.add(hit.sheetRow);
        matched.push({ guest: hit, phone: cleanedPhone, sourceName: c.name });
      } else {
        unmatched.push({ name: c.name, phone: cleanedPhone });
      }
    }
    setImportPreview({ matched, unmatched });
  }

  async function applyImport() {
    if (!importPreview) return;
    setImportApplying(true);
    try {
      // Skip rows that already have a phone (don't overwrite)
      const toApply = importPreview.matched.filter(m => !m.guest.phone);
      await Promise.all(toApply.map(m =>
        fetch("/api/guests", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetRow: m.guest.sheetRow,
            firstName: m.guest.firstName, lastName: m.guest.lastName,
            manualStatus: m.guest.manualStatus || "", prevManualStatus: m.guest.manualStatus || "",
            phone: m.phone,
          }),
        })
      ));
      await load();
      setImportPreview(null); setImportText(""); setImportOpen(false);
      alert(`Applied ${toApply.length} phone${toApply.length !== 1 ? "s" : ""}. Skipped ${importPreview.matched.length - toApply.length} that already had numbers.`);
    } catch { setError("Import failed."); }
    finally { setImportApplying(false); }
  }

  function openWhatsApp(g: Guest) {
    if (!g.phone) return;
    const url = whatsappURL(g);
    // Try popup-style new tab; if blocked, fall back to same-tab navigation
    const win = window.open(url, "_blank");
    if (!win) window.location.href = url;
    // Auto-mark as sent so the user doesn't have to check the box after each send
    recordContact(g);
  }

  async function copyLink(g: Guest) {
    // Copy the full personalized message (first name + link) using the shared template — ready to paste into iMessage, Signal, email, anywhere
    const message = buildMessage(g);
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopiedRow(g.sheetRow);
    setTimeout(() => setCopiedRow(prev => prev === g.sheetRow ? null : prev), 2500);
  }

  function sendSMS(g: Guest) {
    if (!g.phone) return;
    const body = encodeURIComponent(buildMessage(g));
    const phone = g.phone.replace(/[^\d]/g, "");
    const url = `sms:+${phone}?&body=${body}`;
    window.location.href = url;
    recordContact(g);
  }

  const filtered = useMemo(() => {
    // Removed guests never appear anywhere on /send-it. FYI guests only appear when the response filter is "fyi".
    const list = guests.filter(g => {
      if (g.effectiveStatus === "removed") return false;
      if (g.effectiveStatus === "fyi" && responseFilter !== "fyi" && responseFilter !== "classified") return false;
      if (hostFilter !== "all" && hostOf(g) !== hostFilter) return false;

      // Cycle dimension
      if (cycleFilter === "never" && g.cycleCount !== 0) return false;
      if (cycleFilter === "1"     && g.cycleCount !== 1) return false;
      if (cycleFilter === "2"     && g.cycleCount !== 2) return false;
      if (cycleFilter === "3plus" && g.cycleCount < 3)   return false;

      // Response dimension
      if (responseFilter === "not-sent"   && g.sentAt) return false;
      if (responseFilter === "opened"     && !g.firstOpened) return false;
      if (responseFilter === "not-opened" && (g.firstOpened || g.effectiveStatus === "attending" || g.effectiveStatus === "committed" || g.effectiveStatus === "declined")) return false;
      if (responseFilter === "pending"    && g.effectiveStatus !== "pending")   return false;
      if (responseFilter === "attending"  && g.effectiveStatus !== "attending") return false;
      if (responseFilter === "committed"  && g.effectiveStatus !== "committed") return false;
      if (responseFilter === "declined"   && g.effectiveStatus !== "declined")  return false;
      if (responseFilter === "fyi"        && g.effectiveStatus !== "fyi")       return false;
      if (responseFilter === "classified" && g.effectiveStatus !== "attending" && g.effectiveStatus !== "committed" && g.effectiveStatus !== "declined" && g.effectiveStatus !== "fyi") return false;
      if (responseFilter === "no-phone"   && g.phone) return false;
      if (responseFilter === "no-email"   && !isNoEmail(g)) return false;

      if (search) {
        const q = search.toLowerCase();
        return g.fullName.toLowerCase().includes(q) || g.phone.includes(q) || g.email.toLowerCase().includes(q);
      }
      return true;
    });

    // Sort dimension
    const parseDate = (s: string) => { const t = Date.parse(s); return Number.isNaN(t) ? 0 : t; };
    // When viewing a single status (Attending / Declined / FYI only), always order by
    // timestamp of acceptance/response (most recent first), regardless of the sort dropdown.
    const singleStatusView = responseFilter === "attending" || responseFilter === "committed" || responseFilter === "declined" || responseFilter === "fyi";
    if (singleStatusView) {
      list.sort((a, b) => parseDate(b.statusDate) - parseDate(a.statusDate) || a.fullName.localeCompare(b.fullName));
    } else if (sortKey === "recent") {
      list.sort((a, b) => parseDate(b.lastContactedAt) - parseDate(a.lastContactedAt));
    } else if (sortKey === "cycle") {
      list.sort((a, b) => (b.cycleCount || 0) - (a.cycleCount || 0) || a.fullName.localeCompare(b.fullName));
    } else {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return list;
  }, [guests, cycleFilter, responseFilter, hostFilter, sortKey, search]);

  const counts = useMemo(() => {
    // Base pool depends on the response filter — FYI is a special separate bucket.
    const inBase = (g: Guest) => {
      if (g.effectiveStatus === "removed") return false;
      if (g.effectiveStatus === "fyi" && responseFilter !== "fyi" && responseFilter !== "classified") return false;
      return true;
    };

    const matchesResponse = (g: Guest) => {
      if (responseFilter === "not-sent")   return !g.sentAt;
      if (responseFilter === "opened")     return !!g.firstOpened;
      if (responseFilter === "not-opened") return !g.firstOpened && g.effectiveStatus !== "attending" && g.effectiveStatus !== "committed" && g.effectiveStatus !== "declined";
      if (responseFilter === "pending")    return g.effectiveStatus === "pending";
      if (responseFilter === "attending")  return g.effectiveStatus === "attending";
      if (responseFilter === "committed")  return g.effectiveStatus === "committed";
      if (responseFilter === "declined")   return g.effectiveStatus === "declined";
      if (responseFilter === "fyi")        return g.effectiveStatus === "fyi";
      if (responseFilter === "classified") return g.effectiveStatus === "attending" || g.effectiveStatus === "committed" || g.effectiveStatus === "declined" || g.effectiveStatus === "fyi";
      if (responseFilter === "no-phone")   return !g.phone;
      if (responseFilter === "no-email")   return isNoEmail(g);
      return true;
    };

    const matchesCycle = (g: Guest) => {
      if (cycleFilter === "never") return g.cycleCount === 0;
      if (cycleFilter === "1")     return g.cycleCount === 1;
      if (cycleFilter === "2")     return g.cycleCount === 2;
      if (cycleFilter === "3plus") return g.cycleCount >= 3;
      return true;
    };

    // Cycle dropdown counts respect the currently-selected Response filter
    const cyclePool = guests.filter(g => inBase(g) && matchesResponse(g));
    // Response dropdown counts respect the currently-selected Cycle filter
    const responsePool = guests.filter(g => {
      if (g.effectiveStatus === "removed") return false;
      // For response counts, always include FYI so its count is accurate; other exclusions apply to the base
      return matchesCycle(g);
    });

    return {
      cAll:    cyclePool.length,
      cNever:  cyclePool.filter(g => g.cycleCount === 0).length,
      c1:      cyclePool.filter(g => g.cycleCount === 1).length,
      c2:      cyclePool.filter(g => g.cycleCount === 2).length,
      c3plus:  cyclePool.filter(g => g.cycleCount >= 3).length,
      rAll:       responsePool.filter(g => g.effectiveStatus !== "fyi").length,
      rNotSent:   responsePool.filter(g => g.effectiveStatus !== "fyi" && !g.sentAt).length,
      rOpened:    responsePool.filter(g => g.effectiveStatus !== "fyi" &&  g.firstOpened).length,
      rNotOpened: responsePool.filter(g => g.effectiveStatus !== "fyi" && !g.firstOpened && g.effectiveStatus !== "attending" && g.effectiveStatus !== "committed" && g.effectiveStatus !== "declined").length,
      rPending:   responsePool.filter(g => g.effectiveStatus === "pending").length,
      rAttending: responsePool.filter(g => g.effectiveStatus === "attending").length,
      rCommitted: responsePool.filter(g => g.effectiveStatus === "committed").length,
      rDeclined:  responsePool.filter(g => g.effectiveStatus === "declined").length,
      rNoPhone:   responsePool.filter(g => g.effectiveStatus !== "fyi" && !g.phone).length,
      rNoEmail:   responsePool.filter(isNoEmail).length,
      rNoEmailSeats: responsePool.filter(isNoEmail).reduce((sum, g) => {
        const t = (g.titleOverride || "").toLowerCase();
        return sum + (t === "mr" || t === "mrs" ? 1 : t === "none" ? 0 : 2);
      }, 0),
      rFyi:       responsePool.filter(g => g.effectiveStatus === "fyi").length,
      rClassified: responsePool.filter(g => g.effectiveStatus === "attending" || g.effectiveStatus === "committed" || g.effectiveStatus === "declined" || g.effectiveStatus === "fyi").length,
    };
  }, [guests, cycleFilter, responseFilter]);

  const tab = (label: string, href: string, active: boolean) => (
    <Link href={href} style={{
      padding:"0.4rem 1.1rem", textDecoration:"none", fontSize:"0.75rem",
      fontVariant:"small-caps", letterSpacing:"0.08em", fontFamily:serif.style.fontFamily,
      background: active ? GOLD : "transparent",
      color: active ? BLACK : GOLD_DIM,
      border:`1px solid ${active ? GOLD : GOLD_DIM}` }}>{label}</Link>
  );

  const selectStyle: React.CSSProperties = {
    padding:"0.42rem 0.55rem", cursor:"pointer", fontSize:"0.75rem",
    fontVariant:"small-caps", letterSpacing:"0.05em", fontFamily:serif.style.fontFamily,
    background:DARK, color:GOLD, border:`1px solid ${GOLD_DIM}`, outline:"none",
    width:"100%",
  };
  const labelStyle: React.CSSProperties = {
    display:"block", fontSize:"0.6rem", color:GOLD_DIM, letterSpacing:"0.1em",
    fontVariant:"small-caps", marginBottom:"0.2rem",
  };

  return (
    <div className={serif.className} style={{ minHeight:"100vh", backgroundColor:BLACK, color:GOLD, padding:"2rem 1rem" }}>
      <style>{`* { box-sizing:border-box; } ::placeholder { color:${GOLD_DIM}; opacity:0.6; }`}</style>

      <div style={{ maxWidth:980, margin:"0 auto 1.25rem" }}>
        <p className={display.className} style={{ fontSize:"clamp(1.1rem,3.5vw,1.8rem)", letterSpacing:"0.15em", marginBottom:"0.25rem" }}>LEO &amp; LIORA</p>
        <p style={{ color:GOLD_DIM, fontSize:"0.75rem", letterSpacing:"0.1em", fontVariant:"small-caps" }}>Send Invitations · August 13, 2026</p>
        <div style={{ height:1, backgroundColor:GOLD_DIM, opacity:0.25, marginTop:"0.9rem" }} />
      </div>

      <div style={{ maxWidth:980, margin:"0 auto" }}>
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem" }}>
          {tab("Guests", "/guests", false)}
          {tab("Send",   "/send-it", true)}
          {tab("Budget", "/budget", false)}
          {tab("Baruh",  "/baruh", false)}
          {tab("Day Of", "/dayof", false)}
          {tab("Calendar", "/calendar", false)}
        </div>

        {/* Import contacts */}
        <div style={{ marginBottom:"1rem" }}>
          <button onClick={() => setImportOpen(o => !o)} style={{
            padding:"0.4rem 1rem", cursor:"pointer", fontSize:"0.75rem", fontVariant:"small-caps",
            letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
            background: importOpen ? GOLD : "transparent", color: importOpen ? BLACK : "#88aadd",
            border:`1px solid ${importOpen ? GOLD : "rgba(120,160,220,0.5)"}` }}>
            📇 Import Phones from Contacts
          </button>
          {importOpen && (
            <div style={{ marginTop:"0.7rem", padding:"1rem", border:`1px solid ${GOLD_DIM}`, backgroundColor:DARK }}>
              <p style={{ fontSize:"0.75rem", color:GOLD_DIM, marginBottom:"0.55rem", lineHeight:1.5 }}>
                Paste the contents of your contacts export (vCard / .vcf, CSV, or plain text). I&apos;ll match each contact against your guest list by name and fill in their phone number automatically. Existing phone numbers won&apos;t be overwritten.
              </p>
              <textarea value={importText} onChange={e => { setImportText(e.target.value); setImportPreview(null); }}
                placeholder="Paste vCard, CSV, or 'Name, +phone' lines here…" rows={6}
                style={{ width:"100%", background:"transparent", border:`1px solid ${GOLD_DIM}`,
                  color:GOLD, fontSize:"0.8rem", padding:"0.45rem 0.6rem",
                  fontFamily:"monospace", outline:"none", resize:"vertical" }} />
              <div style={{ display:"flex", gap:"0.5rem", marginTop:"0.6rem", alignItems:"center" }}>
                <button onClick={matchContacts} disabled={!importText.trim()} style={{
                  padding:"0.35rem 1rem", cursor:"pointer", fontSize:"0.72rem", fontVariant:"small-caps",
                  letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
                  background:GOLD, color:BLACK, border:`1px solid ${GOLD}`,
                  opacity:!importText.trim() ? 0.4 : 1 }}>
                  Preview Matches
                </button>
                {importPreview && (
                  <button onClick={applyImport} disabled={importApplying || importPreview.matched.filter(m => !m.guest.phone).length === 0} style={{
                    padding:"0.35rem 1rem", cursor:"pointer", fontSize:"0.72rem", fontVariant:"small-caps",
                    letterSpacing:"0.07em", fontFamily:serif.style.fontFamily,
                    background:"#7dc87d", color:BLACK, border:`1px solid #7dc87d`,
                    opacity:(importApplying || importPreview.matched.filter(m => !m.guest.phone).length === 0) ? 0.4 : 1 }}>
                    {importApplying ? "Saving…" : `✓ Apply ${importPreview.matched.filter(m => !m.guest.phone).length} new phone${importPreview.matched.filter(m => !m.guest.phone).length !== 1 ? "s" : ""}`}
                  </button>
                )}
              </div>

              {/* Preview */}
              {importPreview && (
                <div style={{ marginTop:"0.9rem", maxHeight:"320px", overflowY:"auto", border:`1px solid ${GOLD_DIM}` }}>
                  <p style={{ padding:"0.45rem 0.7rem", fontSize:"0.7rem", color:"#7dc87d", fontVariant:"small-caps", letterSpacing:"0.08em", borderBottom:`1px solid ${GOLD_DIM}`, backgroundColor:"rgba(125,200,125,0.05)" }}>
                    ✓ Matched ({importPreview.matched.length})
                  </p>
                  {importPreview.matched.length === 0 ? (
                    <p style={{ padding:"0.65rem 0.7rem", fontSize:"0.75rem", color:GOLD_DIM, fontStyle:"italic" }}>None matched.</p>
                  ) : importPreview.matched.map((m, i) => (
                    <div key={i} style={{ padding:"0.4rem 0.7rem", fontSize:"0.78rem", display:"flex", justifyContent:"space-between", gap:"0.5rem",
                      borderBottom: i < importPreview.matched.length-1 ? "1px solid rgba(168,138,50,0.12)" : "none",
                      color: m.guest.phone ? GOLD_DIM : GOLD }}>
                      <span>{m.sourceName} → <span style={{ color:GOLD }}>{m.guest.fullName}</span>
                        {m.guest.phone && <span style={{ marginLeft:"0.4rem", fontSize:"0.65rem", color:GOLD_DIM, fontStyle:"italic" }}>(already has phone — skipped)</span>}
                      </span>
                      <span style={{ fontFamily:"monospace", color:GOLD_DIM }}>{displayPhone(m.phone)}</span>
                    </div>
                  ))}
                  {importPreview.unmatched.length > 0 && (
                    <>
                      <p style={{ padding:"0.45rem 0.7rem", fontSize:"0.7rem", color:"#d97777", fontVariant:"small-caps", letterSpacing:"0.08em", borderTop:`1px solid ${GOLD_DIM}`, borderBottom:`1px solid ${GOLD_DIM}`, backgroundColor:"rgba(217,119,119,0.05)" }}>
                        ✗ Unmatched ({importPreview.unmatched.length}) — these contacts aren&apos;t on the guest list
                      </p>
                      {importPreview.unmatched.map((u, i) => (
                        <div key={i} style={{ padding:"0.4rem 0.7rem", fontSize:"0.75rem", color:GOLD_DIM, display:"flex", justifyContent:"space-between", gap:"0.5rem",
                          borderBottom: i < importPreview.unmatched.length-1 ? "1px solid rgba(168,138,50,0.12)" : "none" }}>
                          <span>{u.name}</span>
                          <span style={{ fontFamily:"monospace" }}>{displayPhone(u.phone)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Messages — Invitation + 6 reminders. Pick which one to send; the active one is used by WhatsApp / Text / Copy. */}
        <div style={{ marginBottom:"1.25rem", padding:"0.9rem 1rem", border:`1px solid ${GOLD_DIM}`, backgroundColor:DARK }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.55rem", flexWrap:"wrap", gap:"0.5rem" }}>
            <p style={{ fontSize:"0.65rem", color:GOLD_DIM, letterSpacing:"0.1em", fontVariant:"small-caps", margin:0 }}>
              Messages — use <code style={{color:GOLD}}>{`{name}`}</code> and <code style={{color:GOLD}}>{`{link}`}</code> · pick which to send
            </p>
            <span style={{ fontSize:"0.62rem", color: (templateStatus === "saved" || reminderStatus === "saved") ? "#7dc87d" : GOLD_DIM, fontStyle:"italic" }}>
              {(!templateLoaded || !remindersLoaded) ? "Loading…"
                : (templateStatus === "saving" || reminderStatus === "saving") ? "Saving…"
                : (templateStatus === "saved" || reminderStatus === "saved") ? "✓ Synced to sheet"
                : "Synced across devices"}
            </span>
          </div>

          {/* Selector — which message WhatsApp / Text / Copy will send */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"0.4rem", marginBottom:"0.7rem" }}>
            {MSG_ORDER.map((i) => {
              const label = MSG_LABELS[i];
              const active = activeMsg === i;
              return (
                <button key={label} onClick={() => setActiveMsg(i)} style={{
                  padding:"0.4rem 0.3rem", cursor:"pointer", fontSize:"0.7rem", textAlign:"center",
                  fontVariant:"small-caps", letterSpacing:"0.05em", fontFamily:serif.style.fontFamily,
                  background: active ? GOLD : "transparent", color: active ? BLACK : GOLD_DIM,
                  border:`1px solid ${active ? GOLD : GOLD_DIM}`, transition:"all 0.15s" }}>
                  {active ? "● " : ""}{label}
                </button>
              );
            })}
          </div>

          {/* Editors — invitation + reminders, active one highlighted */}
          {MSG_ORDER.map((i, pos) => {
            const label = MSG_LABELS[i];
            const active = activeMsg === i;
            const value = i === 0 ? template : reminders[i - 1];
            const onChange = (v: string) => {
              if (i === 0) setTemplate(v);
              else setReminders(prev => prev.map((r, idx) => idx === i - 1 ? v : r));
            };
            const loaded = i === 0 ? templateLoaded : remindersLoaded;
            return (
              <div key={label} style={{ marginBottom: pos < MSG_ORDER.length - 1 ? "0.55rem" : 0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.2rem" }}>
                  <span style={{ fontSize:"0.6rem", color: active ? GOLD : GOLD_DIM, letterSpacing:"0.08em", fontVariant:"small-caps" }}>
                    {label}{active ? " · sending this" : ""}
                  </span>
                  {!active && (
                    <button onClick={() => setActiveMsg(i)}
                      style={{ fontSize:"0.58rem", color:GOLD_DIM, background:"transparent",
                        border:"none", cursor:"pointer", fontStyle:"italic", padding:0 }}>
                      use this →
                    </button>
                  )}
                </div>
                <textarea value={value} onChange={e => onChange(e.target.value)} rows={i === 0 ? 4 : i >= 4 ? 10 : 2}
                  disabled={!loaded}
                  placeholder={i === 0 ? "" : `${label} message…`}
                  style={{ width:"100%", background:"transparent",
                    border:`1px solid ${active ? GOLD : GOLD_DIM}`,
                    color:GOLD, fontSize:"0.85rem", padding:"0.45rem 0.6rem",
                    fontFamily:serif.style.fontFamily, outline:"none", resize:"vertical",
                    opacity: loaded ? 1 : 0.5 }} />
              </div>
            );
          })}
        </div>

        {/* Filters — two dropdowns you can combine, plus sort */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"0.5rem", marginBottom:"0.5rem" }}>
          <div>
            <label style={labelStyle}>Cycle</label>
            <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value as CycleFilter)} style={selectStyle}>
              <option value="all">All Cycles ({counts.cAll})</option>
              <option value="never">Never Sent ({counts.cNever})</option>
              <option value="1">Cycle 1 ({counts.c1})</option>
              <option value="2">Cycle 2 ({counts.c2})</option>
              <option value="3plus">Cycle 3+ ({counts.c3plus})</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Response</label>
            <select value={responseFilter} onChange={e => setResponseFilter(e.target.value as ResponseFilter)} style={selectStyle}>
              <option value="all">All Responses ({counts.rAll})</option>
              <option value="pending">○ No Response ({counts.rPending})</option>
              <option value="not-opened">Not Opened ({counts.rNotOpened})</option>
              <option value="opened">Opened ({counts.rOpened})</option>
              <option value="not-sent">Not Sent ({counts.rNotSent})</option>
              <option value="classified">✔ All Classified — Attending + Committed + Declined + FYI ({counts.rClassified})</option>
              <option value="attending">✓ Attending ({counts.rAttending})</option>
              <option value="committed">◆ Committed ({counts.rCommitted})</option>
              <option value="declined">✗ Declined ({counts.rDeclined})</option>
              <option value="no-email">✉︎ No Email — text these ({counts.rNoEmail})</option>
              <option value="no-phone">No Phone ({counts.rNoPhone})</option>
              <option value="fyi">○ FYI ({counts.rFyi})</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Invited By</label>
            <select value={hostFilter} onChange={e => setHostFilter(e.target.value)} style={selectStyle}>
              <option value="all">Everyone ({hosts.reduce((n, h) => n + h[1], 0)})</option>
              {hosts.map(([h, n]) => (
                <option key={h} value={h}>{h} ({n})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Sort By</label>
            <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} style={selectStyle}>
              <option value="name">Name (A → Z)</option>
              <option value="recent">Last Contacted</option>
              <option value="cycle">Cycle (high first)</option>
            </select>
          </div>
        </div>

        {/* Result count + quick reset */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem", fontSize:"0.7rem", color:GOLD_DIM }}>
          <span>
            <strong style={{ color:GOLD }}>{filtered.length}</strong> matching guests
            {responseFilter === "no-email" && (
              <span style={{ marginLeft:"0.5rem", fontStyle:"italic" }}>
                · {counts.rNoEmailSeats} seats · no address on file, so these need the text
              </span>
            )}
          </span>
          {(cycleFilter !== "all" || responseFilter !== "not-opened" || hostFilter !== "Baruh" || sortKey !== "name") && (
            <button onClick={() => { setCycleFilter("all"); setResponseFilter("not-opened"); setHostFilter("Baruh"); setSortKey("name"); }}
              style={{ background:"transparent", color:GOLD_DIM, border:"none", cursor:"pointer",
                fontSize:"0.7rem", fontStyle:"italic", padding:0, textDecoration:"underline" }}>
              reset filters
            </button>
          )}
        </div>

        {/* Search */}
        <div style={{ position:"relative", marginBottom:"1rem" }}>
          <input type="text" placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:"100%", padding:"0.38rem 2rem 0.38rem 0.7rem", background:"transparent",
              border:`1px solid ${GOLD_DIM}`, color:GOLD, fontSize:"0.85rem",
              fontFamily:serif.style.fontFamily, outline:"none" }} />
          {search && (
            <button onClick={() => setSearch("")}
              style={{ position:"absolute", right:"0.4rem", top:"50%", transform:"translateY(-50%)",
                background:"none", border:"none", color:GOLD_DIM, cursor:"pointer", fontSize:"0.85rem" }}>✕</button>
          )}
        </div>

        {loading ? (
          <p style={{ color:GOLD_DIM, textAlign:"center", padding:"3rem", fontStyle:"italic" }}>Loading…</p>
        ) : error ? (
          <p style={{ color:"#d97777", textAlign:"center", padding:"3rem" }}>{error}</p>
        ) : (
          <div style={{ border:`1px solid ${GOLD_DIM}`, overflow:"hidden" }}>
            {filtered.length === 0 ? (
              <p style={{ color:GOLD_DIM, textAlign:"center", padding:"2rem", fontStyle:"italic" }}>No guests match.</p>
            ) : filtered.map((g, i) => {
              const isEditing = editRow === g.sheetRow;
              const noPhone = !g.phone;
              return (
                <div key={g.sheetRow} style={{
                  padding:"0.7rem 1rem",
                  backgroundColor: i%2===0 ? "transparent" : "rgba(200,168,74,0.02)",
                  borderBottom: i < filtered.length-1 ? `1px solid rgba(168,138,50,0.12)` : "none",
                  borderLeft: noPhone ? `2px solid rgba(217,119,119,0.5)` : `2px solid transparent`,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", flexWrap:"wrap" }}>
                    <span style={{ flex:"1 1 160px", fontSize:"0.95rem", color:GOLD }}>
                      {g.fullName}
                      {g.partySize > 1 && <span style={{ color:GOLD_DIM, marginLeft:"0.35rem", fontSize:"0.75rem" }}>× {g.partySize}</span>}
                      {g.invitedBy && (
                        <span title={`Invited by ${g.invitedBy}`}
                          style={{ marginLeft:"0.5rem", padding:"0.05rem 0.4rem",
                            fontSize:"0.62rem", fontVariant:"small-caps", letterSpacing:"0.06em",
                            color:GOLD_DIM, border:`1px solid ${GOLD_DIM}`, borderRadius:"2px", verticalAlign:"middle" }}>
                          {g.invitedBy}
                        </span>
                      )}
                      {isNoEmail(g) && (
                        <span title="No email on file — this guest only gets the countdown by text"
                          style={{ marginLeft:"0.5rem", padding:"0.05rem 0.4rem",
                            fontSize:"0.62rem", fontVariant:"small-caps", letterSpacing:"0.06em",
                            background:"rgba(120,160,220,0.18)", color:"#88aadd",
                            border:"1px solid rgba(120,160,220,0.4)", borderRadius:"2px", verticalAlign:"middle" }}>
                          ✉︎ no email
                        </span>
                      )}
                      {g.cycleCount > 0 && (
                        <span title={`Contacted ${g.cycleCount} time${g.cycleCount>1?"s":""}${g.lastContactedAt?`, last on ${g.lastContactedAt}`:""}`}
                          style={{ marginLeft:"0.5rem", padding:"0.05rem 0.4rem",
                            fontSize:"0.62rem", fontVariant:"small-caps", letterSpacing:"0.06em",
                            background: g.cycleCount === 1 ? "rgba(200,168,74,0.15)"
                                      : g.cycleCount === 2 ? "rgba(120,160,220,0.18)"
                                      :                      "rgba(217,119,119,0.18)",
                            color: g.cycleCount === 1 ? GOLD_DIM : g.cycleCount === 2 ? "#88aadd" : "#d97777",
                            border:`1px solid ${g.cycleCount === 1 ? "rgba(200,168,74,0.35)"
                                              : g.cycleCount === 2 ? "rgba(120,160,220,0.4)"
                                              :                      "rgba(217,119,119,0.4)"}`,
                            borderRadius:"2px", verticalAlign:"middle" }}>
                          Cycle {g.cycleCount}
                        </span>
                      )}
                    </span>

                    {/* Phone (editable inline) */}
                    {isEditing ? (
                      <div style={{ display:"flex", gap:"0.3rem", alignItems:"center" }}>
                        <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                          placeholder="13055551234" autoFocus
                          style={{ width:140, background:"transparent", border:`1px solid ${GOLD}`,
                            color:GOLD, fontSize:"0.82rem", padding:"0.22rem 0.4rem",
                            fontFamily:serif.style.fontFamily, outline:"none" }} />
                        <button onClick={() => savePhone(g)}
                          style={{ padding:"0.2rem 0.55rem", cursor:"pointer", fontSize:"0.7rem",
                            background:GOLD, color:BLACK, border:"none", fontFamily:serif.style.fontFamily }}>✓</button>
                        <button onClick={() => setEditRow(null)}
                          style={{ padding:"0.2rem 0.45rem", cursor:"pointer", fontSize:"0.7rem",
                            background:"transparent", color:GOLD_DIM, border:`1px solid ${GOLD_DIM}`,
                            fontFamily:serif.style.fontFamily }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditRow(g.sheetRow); setEditPhone(g.phone); }}
                        style={{ minWidth:140, padding:"0.22rem 0.5rem", cursor:"pointer", fontSize:"0.78rem",
                          textAlign:"left", background:"transparent",
                          color: g.phone ? GOLD : "#d97777",
                          border:`1px dashed ${g.phone ? GOLD_DIM : "rgba(217,119,119,0.5)"}`,
                          fontFamily:serif.style.fontFamily }}>
                        {g.phone ? displayPhone(g.phone) : "+ add phone"}
                      </button>
                    )}

                    {/* WhatsApp button — opens wa.me link */}
                    <button onClick={() => openWhatsApp(g)} disabled={!g.phone}
                      title={g.phone ? `Open WhatsApp chat with ${g.fullName}` : "Add a phone number first"}
                      style={{
                        padding:"0.32rem 0.85rem", fontSize:"0.78rem",
                        fontVariant:"small-caps", letterSpacing:"0.05em", fontFamily:serif.style.fontFamily,
                        background: g.phone ? "#25D366" : "transparent",
                        color: g.phone ? "white" : GOLD_DIM,
                        border:`1px solid ${g.phone ? "#25D366" : GOLD_DIM}`,
                        opacity: g.phone ? 1 : 0.4,
                        cursor: g.phone ? "pointer" : "not-allowed",
                        whiteSpace:"nowrap",
                      }}>
                      WhatsApp →
                    </button>

                    {/* SMS button — opens Messages app pre-filled */}
                    <button onClick={() => sendSMS(g)} disabled={!g.phone}
                      title={g.phone ? `Open Messages app with the invitation pre-filled` : "Add a phone number first"}
                      style={{
                        padding:"0.32rem 0.7rem", fontSize:"0.78rem",
                        fontVariant:"small-caps", letterSpacing:"0.05em", fontFamily:serif.style.fontFamily,
                        background: g.phone ? "#3478F6" : "transparent",
                        color: g.phone ? "white" : GOLD_DIM,
                        border:`1px solid ${g.phone ? "#3478F6" : GOLD_DIM}`,
                        opacity: g.phone ? 1 : 0.4,
                        cursor: g.phone ? "pointer" : "not-allowed",
                        whiteSpace:"nowrap",
                      }}>
                      💬 Text
                    </button>

                    <button onClick={() => copyLink(g)}
                      title="Copy the full personalized message (name + link) — paste into iMessage, email, anywhere"
                      style={{ padding:"0.32rem 0.5rem", cursor:"pointer", fontSize:"0.78rem",
                        background: copiedRow === g.sheetRow ? "#7dc87d" : "transparent",
                        color: copiedRow === g.sheetRow ? BLACK : GOLD_DIM,
                        border:`1px solid ${copiedRow === g.sheetRow ? "#7dc87d" : GOLD_DIM}`,
                        fontFamily:serif.style.fontFamily, transition:"all 0.15s" }}>
                      {copiedRow === g.sheetRow ? "✓ Copied" : "📋 Copy"}
                    </button>

                    {/* Sent toggle */}
                    <label style={{ display:"flex", alignItems:"center", gap:"0.3rem", fontSize:"0.75rem", color:GOLD_DIM, cursor:"pointer" }}>
                      <input type="checkbox" checked={!!g.sentAt} onChange={() => toggleSent(g)}
                        style={{ accentColor:GOLD, cursor:"pointer" }} />
                      Sent
                    </label>
                  </div>

                  {/* Status row below */}
                  <div style={{ display:"flex", gap:"1rem", marginTop:"0.35rem", fontSize:"0.68rem", color:GOLD_DIM, flexWrap:"wrap" }}>
                    {g.effectiveStatus === "fyi" && (
                      <span style={{ color:"#88aadd", padding:"0.1rem 0.45rem", border:"1px solid rgba(120,160,220,0.4)", background:"rgba(120,160,220,0.08)", letterSpacing:"0.06em", fontVariant:"small-caps" }}>
                        ○ FYI · send later
                      </span>
                    )}
                    {g.sentAt && (
                      <span style={{ color:"#88aadd" }}>
                        📤 {g.lastContactedAt && g.lastContactedAt !== g.sentAt ? `Last: ${g.lastContactedAt}` : `Sent ${g.sentAt}`}
                      </span>
                    )}
                    {g.firstOpened && <span style={{ color:"#7dc87d" }}>👁 Opened {g.firstOpened}</span>}
                    {g.effectiveStatus === "attending" && <span style={{ color:"#7dc87d" }}>✓ Attending</span>}
                    {g.effectiveStatus === "committed" && <span style={{ color:"#b18ad9" }}>◆ Committed</span>}
                    {g.effectiveStatus === "declined"  && <span style={{ color:"#d97777" }}>✗ Declined</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ color:GOLD_DIM, fontSize:"0.7rem", textAlign:"center", marginTop:"1.5rem", fontStyle:"italic" }}>
          Phone format: international with country code, digits only (e.g. <code style={{color:GOLD}}>13055551234</code> for US).
        </p>
      </div>
    </div>
  );
}
