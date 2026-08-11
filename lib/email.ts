import { Resend } from "resend";

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "mikebaruh@gmail.com";

// Wedding details for the auto-sent calendar invite (Aug 13, 2026, 5 PM–midnight ET).
// Times in UTC (EDT = UTC-4): 5 PM ET = 21:00Z; midnight ET = 04:00Z next day.
const WEDDING = {
  uid: "leo-liora-wedding-2026@leo-liora-rsvp",
  summary: "Leo & Liora's Wedding",
  location: "Shul of Bal Harbour, 9540 Collins Ave, Surfside, FL 33154",
  description: "We can't wait to celebrate with you! Ceremony begins at 5:00 PM.",
  dtStart: "20260813T210000Z",
  dtEnd: "20260814T040000Z",
  organizer: NOTIFY_EMAIL,
};

const icsEscape = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

function buildWeddingIcs(toEmail: string): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Leo Liora//Wedding//EN",
    "CALSCALE:GREGORIAN", "METHOD:REQUEST", "BEGIN:VEVENT",
    `UID:${WEDDING.uid}`,
    "DTSTAMP:20260723T000000Z",
    `DTSTART:${WEDDING.dtStart}`,
    `DTEND:${WEDDING.dtEnd}`,
    `SUMMARY:${icsEscape(WEDDING.summary)}`,
    `LOCATION:${icsEscape(WEDDING.location)}`,
    `DESCRIPTION:${icsEscape(WEDDING.description)}`,
    `ORGANIZER;CN=Leo & Liora:mailto:${WEDDING.organizer}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${toEmail}`,
    "STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

// Emails the guest a calendar invite (.ics) for the wedding so it lands on their calendar.
// NOTE: delivery to non-owner addresses requires a verified Resend domain; with the sandbox
// sender (onboarding@resend.dev) only the account owner's address receives mail.
export async function sendWeddingInvite(toEmail: string, name: string) {
  if (!process.env.RESEND_API_KEY || !toEmail) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const ics = buildWeddingIcs(toEmail);
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  await resend.emails.send({
    from: "Leo & Liora <onboarding@resend.dev>",
    to: toEmail,
    subject: "You're invited 💍 Leo & Liora's Wedding — Aug 13, 2026",
    html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#222">
        <h2 style="letter-spacing:2px;text-align:center">LEO &amp; LIORA</h2>
        <p>Hi ${first}, thank you for your RSVP — we can't wait to celebrate with you! 💍</p>
        <table style="font-size:15px;line-height:1.6">
          <tr><td><strong>When</strong></td><td>&nbsp;Thursday, August 13, 2026 · 5:00 PM</td></tr>
          <tr><td><strong>Where</strong></td><td>&nbsp;Shul of Bal Harbour, Surfside, FL</td></tr>
        </table>
        <p style="font-size:14px;color:#555">The calendar invite is attached — open it to add the wedding to your calendar.</p>
      </div>`,
    attachments: [{ filename: "leo-liora-wedding.ics", content: Buffer.from(ics).toString("base64") }],
  });
}

export async function sendOpenNotification(data: {
  firstName: string;
  lastName: string;
  openedAt: string;
  sheetRow: number;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ") || "(unnamed)";
  await resend.emails.send({
    from: "Invite Opens <onboarding@resend.dev>",
    to: NOTIFY_EMAIL,
    subject: `👁 ${fullName} opened the invitation`,
    html: `
      <h2>Invitation Opened</h2>
      <p style="font-family:sans-serif;font-size:15px">
        <strong>${fullName}</strong> just opened their personalized invitation.
      </p>
      <table style="border-collapse:collapse;font-family:sans-serif">
        <tr><td style="padding:6px 12px;font-weight:bold">Name</td><td style="padding:6px 12px">${fullName}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold">Opened at</td><td style="padding:6px 12px">${data.openedAt}</td></tr>
        <tr><td style="padding:6px 12px;font-weight:bold">Guest row</td><td style="padding:6px 12px">${data.sheetRow}</td></tr>
      </table>
    `,
  });
}

export async function sendRsvpNotification(data: {
  name: string;
  attending: boolean;
  partySize: number;
  email: string;
  phone: string;
  song: string;
  advice: string;
  submittedAt: string;
}) {
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const status = data.attending ? "✅ ATTENDING" : "❌ NOT ATTENDING";
  await resend.emails.send({
    from: "RSVP <onboarding@resend.dev>",
    to: NOTIFY_EMAIL,
    subject: `RSVP: ${data.name} — ${status}`,
    html: `
      <h2>New RSVP for Leo & Liora's Wedding</h2>
      <table style="border-collapse:collapse;font-family:sans-serif">
        <tr><td style="padding:8px;font-weight:bold">Name</td><td style="padding:8px">${data.name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Attending</td><td style="padding:8px">${data.attending ? "Yes" : "No"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Party Size</td><td style="padding:8px">${data.partySize}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Email</td><td style="padding:8px">${data.email || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Phone</td><td style="padding:8px">${data.phone || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Song Request</td><td style="padding:8px">${data.song || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Advice</td><td style="padding:8px">${data.advice || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold">Submitted</td><td style="padding:8px">${data.submittedAt}</td></tr>
      </table>
    `,
  });
}
