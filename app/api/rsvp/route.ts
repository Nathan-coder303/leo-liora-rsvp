import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { appendRsvpRow } from "@/lib/sheets";
import { sendRsvpNotification, sendWeddingInvite } from "@/lib/email";

function normalize(s: string) { return s.trim().toLowerCase().replace(/\s+/g, " "); }
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// When a guest RSVPs with partySize=2 but their addressing was set to just Mr. or Mrs.,
// clear the override so future opens show "Mr. & Mrs. [LastName]".
async function upgradeTitleIfCouple(name: string, partySize: number) {
  if (partySize < 2) return;
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const id  = process.env.GOOGLE_SHEET_ID;
    if (!raw || !id) return;
    const credentials = JSON.parse(raw);
    if (credentials.private_key) credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    const auth = new google.auth.GoogleAuth({
      credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "Guests!A:K" });
    const rows = res.data.values ?? [];
    const nameKey = normalize(name);

    let matchRow = -1;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const first = (r[0] ?? "").trim();
      const last  = (r[1] ?? "").trim();
      if (!first) continue;
      const full = [first, last].filter(Boolean).join(" ");
      if (normalize(full) === nameKey) { matchRow = i + 1; break; }
    }
    // Fuzzy fallback: exact last name + first-letter match on first name
    if (matchRow < 0) {
      const parts = nameKey.split(" ");
      if (parts.length >= 2) {
        const nFirst = parts[0]; const nLast = parts.slice(1).join(" ");
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const gLast = normalize((r[1] ?? ""));
          const gFirst = normalize((r[0] ?? ""));
          if (gLast === nLast && gFirst[0] === nFirst[0]) { matchRow = i + 1; break; }
        }
      }
    }
    if (matchRow < 0) return;

    const currentTitle = (rows[matchRow - 1][10] ?? "").trim().toLowerCase();
    if (currentTitle !== "mr" && currentTitle !== "mrs") return;

    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `Guests!K${matchRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[""]] },
    });
    console.log(`Upgraded title for row ${matchRow} (${name}) from "${currentTitle}" → both (partySize=${partySize})`);
  } catch (err) {
    console.error("upgradeTitleIfCouple failed:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, attending, partySize, email, phone, song, advice } = body;

    if (!name || typeof attending !== "boolean" || !partySize) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    // Attending guests must give a valid email (needed for the calendar invite). Declines still allow email OR phone.
    if (attending) {
      if (!email?.trim() || !EMAIL_RE.test(email.trim())) {
        return NextResponse.json({ error: "A valid email is required to attend" }, { status: 400 });
      }
    } else if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
    }
    if (attending && (partySize < 1 || partySize > 2)) {
      return NextResponse.json({ error: "Party size must be 1 or 2" }, { status: 400 });
    }

    const submittedAt = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const data = {
      name: String(name).trim(),
      attending: Boolean(attending),
      partySize: Number(partySize),
      email: String(email || "").trim(),
      phone: String(phone || "").trim(),
      song: String(song || "").trim(),
      advice: String(advice || "").trim(),
      submittedAt,
    };

    try {
      await appendRsvpRow(data);
    } catch (sheetsErr) {
      const msg = sheetsErr instanceof Error ? sheetsErr.message : String(sheetsErr);
      console.error("Sheets error:", msg);
      return NextResponse.json({ error: "Sheets failed", detail: msg }, { status: 500 });
    }
    // Fire-and-forget: upgrade Mr./Mrs. → both if this is a couple RSVP
    if (data.attending) {
      upgradeTitleIfCouple(data.name, data.partySize)
        .catch(err => console.error("title upgrade failed:", err));
    }
    // Fire-and-forget: email attending guests a calendar invite so the event lands on their calendar.
    // (Delivery to guests requires a verified Resend domain; harmless no-op/log otherwise.)
    if (data.attending && data.email) {
      sendWeddingInvite(data.email, data.name)
        .catch(err => console.error("wedding invite send failed:", err));
    }

    try {
      await sendRsvpNotification(data);
    } catch (emailErr) {
      const msg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error("Email error:", msg);
      return NextResponse.json({ error: "Email failed", detail: msg }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("RSVP error:", message);
    return NextResponse.json({ error: "Failed to submit RSVP", detail: message }, { status: 500 });
  }
}
