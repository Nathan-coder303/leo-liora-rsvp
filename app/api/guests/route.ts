import { google } from "googleapis";

export const runtime = "nodejs";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const credentials = JSON.parse(raw);
  if (credentials.private_key)
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Last 10 digits of a phone — lets "13054093677" and "(305) 409-3677" compare equal
function last10(phone: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function nowStamp() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Guests sheet columns:
// A: First Name  B: Last Name  C: Manual Status (Yes/No/FYI)
// D: Manual Date  E: Added At  F: Party Size  G: Invited By
// H: Phone (international format, no +)  I: First Opened  J: Sent At
// K: Title Override ("" default = Mr. & Mrs. / Rabbi & Rebbetzin, "mr" | "mrs" | "none")
// L: Cycle Count (1 = initial send, 2 = first reminder, ...)  M: Last Contacted At

// RSVP columns:
// A: Name  B: Attending  C: Party Size  D: Email  E: Phone  F: Song  G: Advice  H: Submitted At

export async function GET() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  const [guestRes, rsvpRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: "Guests!A:M" }),
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: "RSVP!A:H" }),
  ]);

  const guestRows = guestRes.data.values ?? [];
  const rsvpRows  = rsvpRes.data.values  ?? [];

  const rsvpMap = new Map<string, { rsvpName: string; attending: string; submittedAt: string; rsvpParty: number; email: string }>();
  // Phone is the sturdier join key than the name — guests type their name differently every time
  const emailByPhone = new Map<string, string>();
  for (const row of rsvpRows) {
    const name = row[0]; const attending = row[1];
    const partyRaw = (row[2] ?? "").toString().trim();
    const email = (row[3] ?? "").toString().trim();
    const rsvpPhone = last10((row[4] ?? "").toString());
    const submittedAt = row[7] ?? "";
    if (!name || name === "Name") continue;
    const rsvpParty = parseInt(partyRaw) > 0 ? parseInt(partyRaw) : 1;
    if (email && rsvpPhone && !emailByPhone.has(rsvpPhone)) emailByPhone.set(rsvpPhone, email);
    // A later blank-email row for the same name must not erase an email we already have
    const prior = rsvpMap.get(normalize(name));
    rsvpMap.set(normalize(name), { rsvpName: name, attending: attending ?? "", submittedAt, rsvpParty, email: email || prior?.email || "" });
  }

  const matchedKeys = new Set<string>();

  const guests = guestRows
    .map((row, idx) => ({ row, sheetRow: idx + 1 }))
    .filter(({ row }) => row[0] && row[0] !== "Name" && row[0] !== "First Name")
    .map(({ row, sheetRow }) => {
      const firstName    = (row[0] ?? "").trim();
      const lastName     = (row[1] ?? "").trim();
      const manualStatus = (row[2] ?? "").trim();
      const manualDate   = (row[3] ?? "").trim();
      const addedAt      = (row[4] ?? "").trim();
      const partyRaw     = (row[5] ?? "").trim();
      const partySize    = parseInt(partyRaw) > 0 ? parseInt(partyRaw) : 1;
      const invitedBy    = (row[6] ?? "").trim() || "Baruh";
      const phone        = (row[7] ?? "").trim();
      const firstOpened  = (row[8] ?? "").trim();
      const sentAt       = (row[9] ?? "").trim();
      const titleOverride = (row[10] ?? "").trim().toLowerCase();
      const cycleRaw      = (row[11] ?? "").trim();
      const cycleCount    = parseInt(cycleRaw) > 0 ? parseInt(cycleRaw) : (sentAt ? 1 : 0);
      const lastContactedAt = (row[12] ?? "").trim() || sentAt;
      const fullName     = [firstName, lastName].filter(Boolean).join(" ");
      const fullKey      = normalize(fullName);

      // Try exact match first
      let rsvp = rsvpMap.get(fullKey);
      let fuzzyMatch = false;

      if (rsvp) {
        matchedKeys.add(fullKey);
      } else if (lastName) {
        // Try last-name match with a similar first name
        const guestLast  = normalize(lastName);
        const guestFirst = normalize(firstName);
        const candidates = [...rsvpMap.entries()].filter(([key]) => {
          if (matchedKeys.has(key)) return false;
          const parts = key.split(" ");
          if (parts.length < 2) return false;
          const rsvpLast = parts.slice(1).join(" ");
          return rsvpLast === guestLast;
        });

        if (candidates.length === 1) {
          const [rsvpKey, candidate] = candidates[0];
          const rsvpFirst = rsvpKey.split(" ")[0];
          // Similar = same first letter, or one starts-with the other (Mike/Michael)
          const similar = rsvpFirst[0] === guestFirst[0]
                          || rsvpFirst.startsWith(guestFirst)
                          || guestFirst.startsWith(rsvpFirst);
          if (similar) {
            rsvp = candidate;
            fuzzyMatch = true;
            matchedKeys.add(rsvpKey);
          }
        }
      }

      let effectiveStatus: "attending" | "committed" | "declined" | "fyi" | "pending" | "removed";
      let source: "manual" | "rsvp" | "pending";
      let statusDate = "";

      if (manualStatus) {
        const m = manualStatus.toLowerCase();
        effectiveStatus = m === "yes"       ? "attending"
                        : m === "committed" ? "committed"
                        : m === "no"        ? "declined"
                        : m === "removed"   ? "removed"
                        : "fyi";
        source     = "manual";
        statusDate = manualDate;
      } else if (rsvp) {
        effectiveStatus = rsvp.attending.toLowerCase() === "yes" ? "attending" : "declined";
        source     = "rsvp";
        statusDate = rsvp.submittedAt;
      } else {
        effectiveStatus = "pending";
        source     = "pending";
      }

      // Email only ever lives on the RSVP tab — match on phone first, then fall back to the name match
      const email = emailByPhone.get(last10(phone)) || rsvp?.email || "";

      return {
        sheetRow, firstName, lastName, fullName,
        manualStatus, manualDate, addedAt,
        partySize, invitedBy, phone, firstOpened, sentAt, titleOverride,
        cycleCount, lastContactedAt, email,
        effectiveStatus, source, statusDate, fuzzyMatch,
        rsvpName: rsvp?.rsvpName ?? null,
        rsvpAttending: rsvp?.attending ?? null,
        rsvpDate: rsvp?.submittedAt ?? null,
        rsvpParty: rsvp?.rsvpParty ?? null,
      };
    });

  const unexpected = [...rsvpMap.entries()]
    .filter(([key]) => !matchedKeys.has(key))
    .map(([, v]) => ({
      sheetRow: -1, firstName: v.rsvpName, lastName: "", fullName: v.rsvpName,
      manualStatus: "", manualDate: "", addedAt: "",
      partySize: 1, invitedBy: "", phone: "", firstOpened: "", sentAt: "",
      cycleCount: 0, lastContactedAt: "", email: v.email,
      effectiveStatus: v.attending.toLowerCase() === "yes" ? "attending" : "declined" as "attending" | "declined",
      source: "rsvp" as const,
      statusDate: v.submittedAt,
      rsvpName: v.rsvpName, rsvpAttending: v.attending, rsvpDate: v.submittedAt, rsvpParty: v.rsvpParty,
    }));

  return Response.json({ guests, unexpected });
}

// POST — add new guest (uses append + duplicate check)
export async function POST(req: Request) {
  const { firstName, lastName, partySize, invitedBy, phone, titleOverride } = await req.json() as {
    firstName: string; lastName: string; partySize?: number; invitedBy?: string; phone?: string; titleOverride?: string;
  };
  if (!firstName?.trim()) return Response.json({ error: "First name required" }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  // Duplicate check
  const existingRes = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "Guests!A:B" });
  const newKey = normalize(`${firstName} ${lastName ?? ""}`);
  const isDupe = (existingRes.data.values ?? []).some(r => {
    const fn = (r[0] ?? "").trim();
    if (!fn || fn === "First Name" || fn === "Name") return false;
    return normalize(`${fn} ${r[1] ?? ""}`) === newKey;
  });
  if (isDupe) {
    return Response.json({ error: `"${firstName.trim()} ${(lastName ?? "").trim()}" is already on the guest list.` }, { status: 409 });
  }

  const party = Number.isFinite(partySize) && (partySize as number) > 0 ? Math.floor(partySize as number) : 1;
  const source = invitedBy?.trim() || "Baruh";
  const phoneDigits = (phone ?? "").replace(/[^\d]/g, "");
  const titleVal = (titleOverride ?? "").trim().toLowerCase();

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: "Guests!A:M",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[
      firstName.trim(), (lastName ?? "").trim(), "", "", nowStamp(),
      String(party), source, phoneDigits, "", "", titleVal, "", "",
    ]] },
  });

  const updatedRange = appendRes.data.updates?.updatedRange ?? "";
  const rowMatch = updatedRange.match(/!A(\d+)/);
  const sheetRow = rowMatch ? parseInt(rowMatch[1]) : -1;

  return Response.json({ ok: true, sheetRow });
}

// DELETE — clear all manual statuses (columns C + D) for every guest row
export async function DELETE() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: "Guests!A:M" });
  const rows = res.data.values ?? [];

  const cleared = rows.map(row => [
    row[0] ?? "", row[1] ?? "", "", "", row[4] ?? "", row[5] ?? "", row[6] ?? "",
    row[7] ?? "", row[8] ?? "", row[9] ?? "", row[10] ?? "", row[11] ?? "", row[12] ?? "",
  ]);

  if (cleared.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `Guests!A1:M${cleared.length}`,
      valueInputOption: "RAW",
      requestBody: { values: cleared },
    });
  }

  return Response.json({ ok: true, cleared: cleared.length });
}

// PUT — update name, manual status, party, invitedBy, phone, sentAt
export async function PUT(req: Request) {
  const body = await req.json() as {
    sheetRow: number; firstName: string; lastName: string;
    manualStatus: string; prevManualStatus: string;
    partySize?: number; invitedBy?: string;
    phone?: string;
    markSent?: boolean;
    clearSent?: boolean;
    titleOverride?: string;
    incrementCycle?: boolean;
    resetCycles?: boolean;
  };
  const { sheetRow, firstName, lastName, manualStatus, prevManualStatus, partySize, invitedBy, phone, markSent, clearSent, titleOverride, incrementCycle, resetCycles } = body;

  if (!sheetRow) return Response.json({ error: "sheetRow required" }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  const statusChanged = manualStatus !== prevManualStatus;
  const manualDate = manualStatus ? (statusChanged ? nowStamp() : undefined) : "";

  // Read current row to preserve unspecified fields
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `Guests!A${sheetRow}:M${sheetRow}` });
  const curRow = cur.data.values?.[0] ?? [];
  const addedAt        = curRow[4] ?? "";
  const existingDate   = curRow[3] ?? "";
  const existingParty  = curRow[5] ?? "1";
  const existingSource = curRow[6] ?? "Baruh";
  const existingPhone  = curRow[7] ?? "";
  const existingOpened = curRow[8] ?? "";
  const existingSent   = curRow[9] ?? "";
  const existingTitle  = curRow[10] ?? "";
  const existingCycleRaw = curRow[11] ?? "";
  const existingCycle = parseInt(existingCycleRaw) > 0 ? parseInt(existingCycleRaw) : (existingSent ? 1 : 0);
  const existingLastContact = curRow[12] ?? existingSent;

  const party = Number.isFinite(partySize) && (partySize as number) > 0
    ? String(Math.floor(partySize as number))
    : existingParty;
  const source = invitedBy?.trim() || existingSource;
  const phoneVal = phone !== undefined ? phone.replace(/[^\d]/g, "") : existingPhone;
  const sentAtVal = clearSent ? "" : (markSent && !existingSent ? nowStamp() : existingSent);
  const titleVal = titleOverride !== undefined ? titleOverride.trim().toLowerCase() : existingTitle;

  // Cycle counter — increments each time a contact action fires (WhatsApp/SMS click or Sent toggle)
  let cycleVal: string;
  let lastContactVal: string;
  if (resetCycles || clearSent) {
    cycleVal = "";
    lastContactVal = "";
  } else if (incrementCycle) {
    const nextCycle = existingCycle + 1;
    cycleVal = String(nextCycle);
    lastContactVal = nowStamp();
  } else if (markSent && !existingSent) {
    // First-ever send via toggleSent (checkbox) — treat as cycle 1
    cycleVal = "1";
    lastContactVal = nowStamp();
  } else {
    cycleVal = existingCycleRaw;
    lastContactVal = existingLastContact;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `Guests!A${sheetRow}:M${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[
      firstName.trim(),
      (lastName ?? "").trim(),
      manualStatus,
      manualDate !== undefined ? manualDate : existingDate,
      addedAt,
      party,
      source,
      phoneVal,
      existingOpened,
      sentAtVal,
      titleVal,
      cycleVal,
      lastContactVal,
    ]] },
  });

  return Response.json({ ok: true });
}
