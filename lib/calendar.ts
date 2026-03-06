import { google } from "googleapis";
import { CalendarEvent } from "./types";

function getAuth() {
  // Use a service account key stored as a JSON env var,
  // OR use OAuth2 with a refresh token (matching the original app's approach).
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const key = JSON.parse(serviceAccountJson);
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  }

  // Fallback: OAuth2 with stored refresh token
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

export async function getCalendarService() {
  const auth = getAuth();
  return google.calendar({ version: "v3", auth: auth as never });
}

export async function listEvents(calendarId: string): Promise<CalendarEvent[]> {
  const service = await getCalendarService();
  const res = await service.events.list({
    calendarId,
    singleEvents: true,
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
    maxResults: 100,
  });
  return (res.data.items ?? []) as CalendarEvent[];
}

export async function listPastEvents(calendarId: string): Promise<CalendarEvent[]> {
  const service = await getCalendarService();
  const now = new Date();
  // Start of current academic year (July 1) — matches Amion year logic
  const academicYearStart =
    now.getMonth() >= 6
      ? new Date(now.getFullYear(), 6, 1)      // July 1 this year
      : new Date(now.getFullYear() - 1, 6, 1); // July 1 last year

  const res = await service.events.list({
    calendarId,
    singleEvents: true,
    orderBy: "startTime",
    timeMin: academicYearStart.toISOString(),
    timeMax: now.toISOString(),
    maxResults: 200,
  });
  // Return in ascending chronological order (July → today)
  return (res.data.items ?? []) as CalendarEvent[];
}

export async function getEvent(
  calendarId: string,
  eventId: string
): Promise<CalendarEvent> {
  const service = await getCalendarService();
  const res = await service.events.get({ calendarId, eventId });
  return res.data as CalendarEvent;
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  body: CalendarEvent
): Promise<CalendarEvent> {
  const service = await getCalendarService();
  const res = await service.events.update({
    calendarId,
    eventId,
    requestBody: body as never,
  });
  return res.data as CalendarEvent;
}

/** Format a date/time string or dateTime to PST display string */
export function toPST(isoStr?: string): string {
  if (!isoStr) return "";
  try {
    const dt = new Date(isoStr);
    return dt.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

export function getEventDateTime(event: CalendarEvent): Date | null {
  const raw = event.start?.dateTime ?? event.start?.date;
  if (!raw) return null;
  try {
    return new Date(raw);
  } catch {
    return null;
  }
}
