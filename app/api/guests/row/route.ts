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

// DELETE ?sheetRow=N — actually remove a row from the Guests tab (shifts subsequent rows up)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const sheetRow = parseInt(searchParams.get("sheetRow") ?? "", 10);
  if (!sheetRow || sheetRow < 2) {
    return Response.json({ error: "sheetRow >= 2 required" }, { status: 400 });
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const id = process.env.GOOGLE_SHEET_ID!;

  // Find the Guests sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const guestsSheet = meta.data.sheets?.find(s => s.properties?.title === "Guests");
  if (!guestsSheet) return Response.json({ error: "Guests sheet not found" }, { status: 404 });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: id,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: guestsSheet.properties!.sheetId!,
            dimension: "ROWS",
            startIndex: sheetRow - 1, // zero-based
            endIndex: sheetRow,
          },
        },
      }],
    },
  });

  return Response.json({ ok: true, deleted: sheetRow });
}
