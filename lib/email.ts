import { Resend } from "resend";

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "mikebaruh@gmail.com";

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
