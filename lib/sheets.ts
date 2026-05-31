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
  submittedAt: string;
}) {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Ensure header row exists
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A1:D1",
  });

  if (!existing.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A1:D1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["Name", "Attending", "Party Size", "Submitted At"]],
      },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A:D",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          data.name,
          data.attending ? "Yes" : "No",
          data.partySize,
          data.submittedAt,
        ],
      ],
    },
  });
}
