import { google } from "googleapis";
import { sendOpenNotification } from "@/lib/email";

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

function nowStamp() {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// POST { slug } — records first-open timestamp in column I if not already set.
// Returns the guest's display name so the page can personalize.
export async function POST(req: Request) {
  const { slug } = await req.json() as { slug: string };
  const sheetRow = parseInt(slug, 10);
  if (!sheetRow || sheetRow < 2) return Response.json({ ok: false }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `Guests!A${sheetRow}:K${sheetRow}` });
  const row = cur.data.values?.[0];
  if (!row || !row[0]) return Response.json({ ok: false }, { status: 404 });

  const firstName = (row[0] ?? "").trim();
  const lastName  = (row[1] ?? "").trim();
  const existingOpened = (row[8] ?? "").trim();
  const titleOverride = (row[10] ?? "").trim().toLowerCase();

  // Only stamp — and notify — on the first open
  if (!existingOpened) {
    const openedAt = nowStamp();
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `Guests!I${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [[openedAt]] },
    });
    // Fire the email in the background — don't block the response
    sendOpenNotification({ firstName, lastName, openedAt, sheetRow })
      .catch(err => console.error("open email failed:", err));
  }

  return Response.json({
    ok: true,
    firstName, lastName, titleOverride,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
  });
}
