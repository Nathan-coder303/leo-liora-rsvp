import { google } from "googleapis";

export const runtime = "nodejs";

const SHEET_NAME = "Budget";
// "Paid" and "Paid By" are kept as derived summaries (sum of payments / unique payers) for CSV/print
// and backward compatibility; "Payments" holds the full list as JSON: [{ amount, date, by }].
const HEADERS = ["ID", "Item", "Amount", "Per Person", "Note", "Paid", "Paid By", "Payments"];

type Payment = { amount: number; date: string; by: string };

// Parse the JSON payments column; fall back to a single synthesized payment from the legacy Paid/Paid By.
function parsePayments(raw: unknown, legacyPaid: number, legacyBy: string): Payment[] {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .map(p => ({ amount: Number(p?.amount) || 0, date: String(p?.date ?? ""), by: String(p?.by ?? "") }))
          .filter(p => p.amount !== 0 || p.date || p.by);
      }
    } catch { /* fall through */ }
  }
  if (legacyPaid > 0) return [{ amount: legacyPaid, date: "", by: legacyBy }];
  return [];
}

function summarize(payments: Payment[]): { paid: number; paidBy: string } {
  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paidBy = [...new Set(payments.map(p => p.by).filter(Boolean))].join(", ");
  return { paid, paidBy };
}

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
  const sheet = meta.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
  if (sheet) return sheet.properties!.sheetId!;

  const add = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
  });
  const newId = add.data.replies?.[0]?.addSheet?.properties?.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A1:H1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS] },
  });
  return newId!;
}

export async function GET() {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  await ensureSheet(sheets, id);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${SHEET_NAME}!A:H` });
  const rows = res.data.values ?? [];

  const items = rows.slice(1)
    .filter(r => r[0] && r[1])
    .map(r => {
      const legacyPaid = parseFloat(String(r[5] ?? "0")) || 0;
      const legacyBy = r[6] ? String(r[6]) : "";
      const payments = parsePayments(r[7], legacyPaid, legacyBy);
      const { paid, paidBy } = summarize(payments);
      return {
        id: String(r[0]),
        item: String(r[1] ?? ""),
        amount: parseFloat(String(r[2] ?? "0")) || 0,
        perPerson: String(r[3] ?? "").toUpperCase() === "TRUE",
        note: r[4] ? String(r[4]) : undefined,
        payments,
        paid,
        paidBy,
      };
    });

  return Response.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json() as { id: string; item: string; amount: number; perPerson?: boolean; note?: string; paid?: number; paidBy?: string; payments?: Payment[] };
  if (!body.id || !body.item) return Response.json({ error: "id and item required" }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  await ensureSheet(sheets, id);

  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${SHEET_NAME}!A:A` });
  const exists = (existing.data.values ?? []).some(r => r[0] === body.id);
  if (exists) return Response.json({ ok: true, skipped: true });

  const payments = Array.isArray(body.payments)
    ? body.payments
    : parsePayments(undefined, body.paid ?? 0, body.paidBy ?? "");
  const { paid, paidBy } = summarize(payments);

  await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A:H`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[
      body.id, body.item, String(body.amount),
      body.perPerson ? "TRUE" : "FALSE", body.note ?? "",
      String(paid), paidBy, JSON.stringify(payments),
    ]] },
  });
  return Response.json({ ok: true });
}

export async function PUT(req: Request) {
  const body = await req.json() as { id: string; item: string; amount: number; perPerson?: boolean; note?: string; paid?: number; paidBy?: string; payments?: Payment[] };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  await ensureSheet(sheets, id);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${SHEET_NAME}!A:H` });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex(r => r[0] === body.id);
  if (idx === -1) return Response.json({ error: "not found" }, { status: 404 });

  // Preserve existing values for unspecified fields
  const cur = rows[idx];
  const existingNote = cur[4] ?? "";

  // Payments: use the provided list, else preserve what's on the sheet (parsing legacy Paid if needed)
  const payments = Array.isArray(body.payments)
    ? body.payments
    : parsePayments(cur[7], parseFloat(String(cur[5] ?? "0")) || 0, cur[6] ?? "");
  const { paid, paidBy } = summarize(payments);

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${SHEET_NAME}!A${idx + 1}:H${idx + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [[
      body.id, body.item, String(body.amount),
      body.perPerson ? "TRUE" : "FALSE",
      body.note !== undefined ? body.note : existingNote,
      String(paid), paidBy, JSON.stringify(payments),
    ]] },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("id");
  if (!itemId) return Response.json({ error: "id required" }, { status: 400 });

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  const sheetId = await ensureSheet(sheets, id);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${SHEET_NAME}!A:E` });
  const rows = res.data.values ?? [];
  const idx = rows.findIndex(r => r[0] === itemId);
  if (idx === -1) return Response.json({ error: "not found" }, { status: 404 });

  // Actually delete the row so the sheet stays clean
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 },
        },
      }],
    },
  });

  return Response.json({ ok: true });
}
