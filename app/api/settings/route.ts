import { google } from "googleapis";

export const runtime = "nodejs";

const SHEET_NAME = "Settings";
const HEADERS = ["Key", "Value"];

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

type SheetsClient = ReturnType<typeof google.sheets>;

async function ensureSheet(sheets: SheetsClient, id: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const existing = meta.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
  if (existing) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A1:B1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
}

// GET — returns all settings as { key: value } object
export async function GET() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  await ensureSheet(sheets, id);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${SHEET_NAME}!A:B` });
  const rows = res.data.values ?? [];
  const settings: Record<string, string> = {};
  for (const row of rows.slice(1)) {
    if (row[0]) settings[String(row[0])] = String(row[1] ?? "");
  }
  return Response.json({ settings });
}

// PUT — upserts a single { key, value }
export async function PUT(req: Request) {
  const { key, value } = await req.json() as { key: string; value: string };
  if (!key) return Response.json({ error: "key required" }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  await ensureSheet(sheets, id);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${SHEET_NAME}!A:B` });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex(r => r[0] === key);

  if (idx === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: id,
      range: `${SHEET_NAME}!A:B`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[key, value ?? ""]] },
    });
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${SHEET_NAME}!A${idx + 1}:B${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [[key, value ?? ""]] },
    });
  }
  return Response.json({ ok: true });
}
