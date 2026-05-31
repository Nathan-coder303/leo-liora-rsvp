import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
  const credentials = JSON.parse(raw);
  // Vercel sometimes strips newlines from the private key
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function appendRsvpRow(data: {
  name: string;
  attending: boolean;
  partySize: number;
  email: string;
  phone: string;
  song: string;
  advice: string;
  submittedAt: string;
}) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Write header row if sheet is empty
  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A:A",
  });

  const usedRows = colA.data.values?.length || 0;

  if (usedRows === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A1:F1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["Name", "Attending", "Party Size", "Email", "Phone", "Song Request", "Advice", "Submitted At"]],
      },
    });
  }

  // Write to the exact next row so columns never shift
  const nextRow = usedRows + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Sheet1!A${nextRow}:H${nextRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        data.name,
        data.attending ? "Yes" : "No",
        data.partySize,
        data.email,
        data.phone,
        data.song,
        data.advice,
        data.submittedAt,
      ]],
    },
  });
}
