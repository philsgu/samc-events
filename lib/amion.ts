/**
 * lib/amion.ts
 * Fetches and parses the Amion block schedule.
 * Filters for MCUC rotation assignments and builds a date-keyed map.
 */

export interface AmionResident {
  name: string;       // e.g. "Xu, J"
  phone: string;      // e.g. "9716780302"
  email: string;      // e.g. "jennifer.xu@samc.com"
  staffType: string;  // e.g. "PGY3"
  assignment: string; // e.g. "MCUC"
  /** YYYY-MM-DD in local (Pacific) terms — used to match against calendar event dates */
  dateKey: string;
}

/**
 * Parses a single CSV-like Amion row into its fields.
 * Handles quoted fields with commas inside them.
 * Returns an array of raw string values.
 */
function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses Amion date string "M-D-YY" → "YYYY-MM-DD"
 * e.g. "6-1-26" → "2026-06-01"
 */
function parseAmionDate(raw: string): string | null {
  const parts = raw.split("-");
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = 2000 + parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Fetches the Amion schedule for the given month/year and returns all
 * MCUC rotation assignments, keyed by date string "YYYY-MM-DD".
 */
export async function fetchMcucResidents(
  month: string, // "01" – "12"
  year: string   // "2025", "2026", etc.
): Promise<Map<string, AmionResident[]>> {
  const amionId = process.env.AMION_ID;
  if (!amionId) throw new Error("AMION_ID environment variable is not set.");

  // Amion Year param = academic year start (July = start of new cycle)
  // e.g. Jan–Jun 2026 → amionYear=2025; Jul–Dec 2026 → amionYear=2026
  const amionYear = parseInt(month, 10) >= 7 ? parseInt(year, 10) : parseInt(year, 10) - 1;
  const url = `http://www.amion.com/cgi-bin/ocs?Lo=${encodeURIComponent(amionId)}&Rpt=625c&Month=${month}&Year=${amionYear}`;

  const res = await fetch(url, {
    // Amion is HTTP-only; Next.js server-side fetch is fine
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Amion fetch failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  // Check for Amion error responses
  if (text.includes("NOFI=No file") || text.includes("no schedule")) {
    throw new Error(`No Amion schedule found for ${month}/${year}.`);
  }

  const map = new Map<string, AmionResident[]>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || !line.startsWith('"')) continue;

    const fields = parseRow(line);
    // Field layout (0-indexed):
    // 0: staff name, 1: unique id, 2: backup id
    // 3: assignment name, 4: assign id, 5: backup assign id
    // 6: date (M-D-YY), 7: start time, 8: end time
    // 9: staff type, 10: pager, 11: tel, 12: email
    // 13: messagable, 14: shift note
    // 15: assignment type (r=rotation, o=oncall, c=clinic, etc.), 16: grouping
    if (fields.length < 16) continue;

    const assignmentName = fields[3];
    const assignmentType = fields[15]; // "r" for rotation

    // Only MCUC rotation entries
    if (assignmentName !== "MCUC" || assignmentType !== "r") continue;

    const name = fields[0];
    const dateRaw = fields[6];
    const staffType = fields[9];
    const phone = fields[10] || fields[11]; // prefer pager, fall back to tel
    const email = fields[12];

    const dateKey = parseAmionDate(dateRaw);
    if (!dateKey) continue;

    const resident: AmionResident = {
      name,
      phone: phone.replace(/\D/g, ""), // digits only
      email,
      staffType,
      assignment: assignmentName,
      dateKey,
    };

    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(resident);
  }

  return map;
}

/**
 * Formats an AmionResident into the two-line signup block used in
 * Google Calendar event descriptions.
 *
 * Format:
 *   Signed up by: Xu, J [Amion]
 *   Xu, J <jennifer.xu@samc.com> (PGY3 - MCUC) - 9716780302
 */
export function formatAmionEntry(r: AmionResident): string {
  const position = `${r.staffType} - ${r.assignment}`;
  return `Signed up by: ${r.name} [Amion]\n${r.name} <${r.email}> (${position}) - ${r.phone}`;
}

/**
 * Returns the date portion of a Google Calendar event as "YYYY-MM-DD" in
 * America/Los_Angeles timezone, for matching against Amion date keys.
 */
export function getEventDateKey(startDateTimeOrDate?: string): string | null {
  if (!startDateTimeOrDate) return null;
  try {
    const d = new Date(startDateTimeOrDate);
    // Convert to PST/PDT date string
    const parts = d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    // en-CA gives YYYY-MM-DD
    return parts;
  } catch {
    return null;
  }
}
