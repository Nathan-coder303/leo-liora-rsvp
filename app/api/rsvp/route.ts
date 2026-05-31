import { NextRequest, NextResponse } from "next/server";
import { appendRsvpRow } from "@/lib/sheets";
import { sendRsvpNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, attending, partySize } = body;

    if (!name || typeof attending !== "boolean" || !partySize) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (attending && (partySize < 1 || partySize > 2)) {
      return NextResponse.json({ error: "Party size must be 1 or 2" }, { status: 400 });
    }

    const submittedAt = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      dateStyle: "medium",
      timeStyle: "short",
    });

    const data = {
      name: String(name).trim(),
      attending: Boolean(attending),
      partySize: Number(partySize),
      submittedAt,
    };

    await Promise.all([appendRsvpRow(data), sendRsvpNotification(data)]);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("RSVP error:", message);
    return NextResponse.json({ error: "Failed to submit RSVP", detail: message }, { status: 500 });
  }
}
