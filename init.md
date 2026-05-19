# samc-events — Project Overview

## What it is
A Next.js app deployed on **Vercel** that lets SAMC residents sign up for (and cancel from) GME clinic events pulled from Google Calendar.

## Tech stack
- **Framework**: Next.js (App Router)
- **Auth + DB**: Supabase
- **Deployment**: Vercel
- **Calendar**: Google Calendar API (two calendars)
- **Schedule data**: Amion (MCUC rotation block)
- **Email**: Brevo (send-reminders cron)

## Calendars
| Key | Label |
|-----|-------|
| `mobile` | SAMC GME Mobile Clinic |
| `sport` | SAMC GME Sports Medicine |

## AMION Integration
- **Rotation block**: `MCUC` (assignment type `r` = rotation)
- **Source**: `lib/amion.ts` — fetches Amion's CSV schedule via `AMION_ID` env var
- **Sync route**: `POST /api/admin/amion-sync` — admin-only, takes `{ month, year }`, matches MCUC residents to Google Calendar events by date (Pacific time) and writes sign-up entries into event descriptions
- **Format written to calendar**: `Signed up by: Last, F [Amion]` followed by name/email/PGY level/phone

## Cron Job
- `vercel.json` runs `GET /api/admin/send-reminders` daily at **16:00 UTC**
- Logs results to `cron_logs` table in Supabase

## Key routes
| Route | Purpose |
|-------|---------|
| `/` | Event listing (grouped by month, mobile or sports) |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth |
| `/settings` | User profile settings |
| `/signed-up` | Confirmation page after signup |
| `/participation` | Participation history |
| `/admin` | Admin panel: users, cron log, Amion sync |
| `POST /api/signup/[eventId]` | Sign up for an event |
| `POST /api/cancel/[eventId]` | Cancel signup |
| `POST /api/admin/amion-sync` | Sync MCUC residents from Amion to calendar |
| `GET /api/admin/send-reminders` | Send email reminders (cron target) |
| `GET /api/ics/[eventId]` | Download .ics calendar file |

## Environment variables needed
- `AMION_ID` — Amion login ID for schedule fetch
- Supabase URL + anon/service keys
- Google Calendar service account credentials
- Brevo API key (email reminders)
