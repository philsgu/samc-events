"use client";

/**
 * components/AddToCalendarButton.tsx
 *
 * Navigates directly to the ICS API endpoint so the browser receives a real
 * URL response with Content-Type: text/calendar.  This is required for iOS
 * Safari to trigger the native "Open in Calendar" sheet — blob: URLs created
 * via createObjectURL() are not handled by the iOS file/app system and render
 * as raw text instead.
 *
 * Because this is a same-origin navigation, the browser automatically includes
 * the session cookie — no special auth handling needed.
 */

import { useState } from "react";

interface AddToCalendarButtonProps {
  eventId: string;
  calKey: string;
  eventTitle: string;
}

export default function AddToCalendarButton({
  eventId,
  calKey,
}: AddToCalendarButtonProps) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    // Navigate to the ICS endpoint directly. The browser handles the
    // Content-Disposition: attachment response — on mobile this triggers
    // the native "Add to Calendar" / "Open in Calendar" sheet.
    window.location.href = `/api/ics/${eventId}?cal=${calKey}`;
    // Brief visual feedback; reset after a moment since navigation may
    // not unmount this component immediately on mobile.
    setTimeout(() => setLoading(false), 3000);
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn btn-outline btn-sm"
    >
      {loading ? "Opening…" : "Add to Calendar"}
    </button>
  );
}
