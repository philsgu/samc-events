/**
 * lib/email.ts
 * Resend client and email helpers for SAMC GME Events.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "SAMC Events <noreply@healtolearn.com>";

export interface ReminderEmailOptions {
  to: string;
  recipientName: string;
  eventTitle: string;
  /** e.g. "Wednesday, March 5, 2026" */
  eventDateDisplay: string;
  /** e.g. "8:00 AM – 12:00 PM" or null for all-day */
  eventTimeDisplay: string | null;
  eventLocation: string | null;
  calendarLabel: string;
}

export async function sendReminderEmail(opts: ReminderEmailOptions): Promise<void> {
  const {
    to,
    recipientName,
    eventTitle,
    eventDateDisplay,
    eventTimeDisplay,
    eventLocation,
    calendarLabel,
  } = opts;

  const timeRow = eventTimeDisplay
    ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:90px">Time</td><td style="padding:4px 0;font-size:14px"><strong>${eventTimeDisplay}</strong></td></tr>`
    : "";

  const locationRow = eventLocation
    ? `<tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:90px">Location</td><td style="padding:4px 0;font-size:14px"><strong>${eventLocation}</strong></td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,0.07)">

        <!-- Header -->
        <tr><td style="background:#2563eb;padding:24px 32px;border-radius:12px 12px 0 0">
          <p style="margin:0;color:#bfdbfe;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">${calendarLabel}</p>
          <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px;font-weight:700">Event Reminder</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px">
          <p style="margin:0 0 20px;color:#1e293b;font-size:15px">Hi ${recipientName},</p>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6">
            This is a reminder that you are signed up for an event <strong>tomorrow</strong>:
          </p>

          <!-- Event detail box -->
          <table cellpadding="0" cellspacing="0" width="100%" style="background:#f1f5f9;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <tr><td>
              <p style="margin:0 0 12px;color:#1e293b;font-size:16px;font-weight:700">${eventTitle}</p>
              <table cellpadding="0" cellspacing="0">
                <tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:90px">Date</td><td style="padding:4px 0;font-size:14px"><strong>${eventDateDisplay}</strong></td></tr>
                ${timeRow}
                ${locationRow}
              </table>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;color:#475569;font-size:13px;line-height:1.6">
            If you have questions or need to cancel, please contact your program coordinator.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #e2e8f0">
          <p style="margin:0;color:#94a3b8;font-size:12px">SAMC GME Events &mdash; This is an automated reminder. Please do not reply to this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${recipientName},`,
    "",
    `This is a reminder that you are signed up for an event tomorrow:`,
    "",
    `Event: ${eventTitle}`,
    `Date: ${eventDateDisplay}`,
    eventTimeDisplay ? `Time: ${eventTimeDisplay}` : null,
    eventLocation ? `Location: ${eventLocation}` : null,
    "",
    "If you have questions or need to cancel, please contact your program coordinator.",
    "",
    "— SAMC GME Events (automated reminder)",
  ]
    .filter((l) => l !== null)
    .join("\n");

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Reminder: ${eventTitle} — tomorrow, ${eventDateDisplay}`,
    html,
    text,
  });
}
