import { google } from "googleapis";

export const runtime = "nodejs";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const credentials = JSON.parse(raw);
  if (credentials.private_key)
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// GET ?tab=<name>&range=<A:Z> — read raw rows from any tab
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") || "Guests";
  const range = searchParams.get("range") || "A:Z";
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${tab}!${range}` });
  return Response.json({ tab, range, rows: res.data.values ?? [] });
}
