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

type SheetsClient = ReturnType<typeof google.sheets>;

async function ensureSheet(sheets: SheetsClient, id: string, title: string, headers: string[]) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const existing = meta.data.sheets?.find(s => s.properties?.title === title);
  if (existing) return existing.properties!.sheetId!;

  const add = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  const newId = add.data.replies?.[0]?.addSheet?.properties?.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${title}!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
  return newId!;
}

// POST { tabs: [{ name, headers, rows }] } — creates each tab if missing, replaces contents below the header
export async function POST(req: Request) {
  const body = await req.json() as {
    tabs: { name: string; headers: string[]; rows: (string | number)[][] }[];
  };

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  const results: { tab: string; rows: number }[] = [];

  for (const tab of body.tabs) {
    const sheetId = await ensureSheet(sheets, id, tab.name, tab.headers);
    const lastCol = String.fromCharCode(64 + tab.headers.length);

    // Clear existing data below header (rows 2 onward)
    await sheets.spreadsheets.values.clear({
      spreadsheetId: id,
      range: `${tab.name}!A2:${lastCol}`,
    });

    if (tab.rows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: `${tab.name}!A2:${lastCol}${1 + tab.rows.length}`,
        valueInputOption: "RAW",
        requestBody: { values: tab.rows },
      });
    }
    results.push({ tab: tab.name, rows: tab.rows.length, sheetId } as { tab: string; rows: number });
  }

  return Response.json({ ok: true, results });
}

// GET ?tab=<name> — read rows from a triage tab
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab");
  if (!tab) return Response.json({ error: "tab required" }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!A:D` });
  const rows = res.data.values ?? [];
  return Response.json({ rows });
}
