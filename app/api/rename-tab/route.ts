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

// POST { from, to } — rename a tab
export async function POST(req: Request) {
  const { from, to } = await req.json() as { from: string; to: string };
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const tab = meta.data.sheets?.find(s => s.properties?.title === from);
  if (!tab) return Response.json({ error: `Tab "${from}" not found` }, { status: 404 });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId: tab.properties!.sheetId!, title: to },
          fields: "title",
        },
      }],
    },
  });
  return Response.json({ ok: true, renamed: `"${from}" → "${to}"` });
}
