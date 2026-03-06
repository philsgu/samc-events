"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { type CalendarEvent, type CalendarInfo, type Profile } from "@/lib/types";

interface Props {
  events: CalendarEvent[];
  monthGroups: Record<string, { label: string; events: CalendarEvent[] }>;
  monthKeys: string[];
  pastMonthGroups: Record<string, { label: string; events: CalendarEvent[] }>;
  pastMonthKeys: string[];
  calKey: string;
  calendars: Record<string, CalendarInfo>;
  profile: Profile;
  fetchError: string;
}

function formatEventDate(isoStr?: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function formatEventTime(isoStr?: string): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
}

function parseSignupBlocks(desc: string): { generic: string[]; signups: string[] } {
  const normalized = desc.replace(/<br>/gi, "\n");
  const parts = normalized.split("\n\n").map((p) => p.trim()).filter(Boolean);
  const generic: string[] = [];
  const signups: string[] = [];
  for (const p of parts) {
    if (p.startsWith("Signed up by:")) signups.push(p);
    else generic.push(p);
  }
  return { generic, signups };
}

interface ModalState {
  open: boolean;
  action: "sign-up" | "cancel";
  eventId: string;
  eventTitle: string;
  calKey: string;
  targetFullName?: string;
}

export default function EventsClient({
  monthGroups,
  monthKeys,
  pastMonthGroups,
  pastMonthKeys,
  calKey,
  calendars,
  profile,
  fetchError,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [dropOpen, setDropOpen] = useState(false);
  const [pastExpanded, setPastExpanded] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    open: false, action: "sign-up", eventId: "", eventTitle: "", calKey,
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  // Live event data keyed by eventId so we can optimistically update
  const [eventData, setEventData] = useState<Record<string, CalendarEvent>>({});
  const dropRef = useRef<HTMLDivElement>(null);

  // Load saved month filter
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mc_selected_month") ?? "all";
      setSelectedMonth(saved);
    } catch { /* ignore */ }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function openModal(
    action: "sign-up" | "cancel",
    event: CalendarEvent,
    ck: string,
    targetFullName?: string
  ) {
    setModal({ open: true, action, eventId: event.id, eventTitle: event.summary, calKey: ck, targetFullName });
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    setModal((m) => ({ ...m, open: false }));
    document.body.classList.remove("modal-open");
  }

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    const { action, eventId, calKey: ck, targetFullName } = modal;
    try {
      let res: Response;
      if (action === "sign-up") {
        res = await fetch(`/api/signup/${eventId}?cal=${ck}`, { method: "POST" });
      } else {
        res = await fetch(`/api/cancel/${eventId}?cal=${ck}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_full_name: targetFullName }),
        });
      }
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "Request failed.", "error");
      } else {
        setEventData((prev) => ({ ...prev, [eventId]: json.event }));
        showToast(action === "sign-up" ? "Signed up!" : "Signup cancelled.", "success");
        closeModal();
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    }
    setLoading(false);
  }, [modal]);

  function getEvent(ev: CalendarEvent): CalendarEvent {
    return eventData[ev.id] ?? ev;
  }

  function isSignedUp(ev: CalendarEvent): boolean {
    if (!profile?.full_name) return false;
    const e = getEvent(ev);
    return !!(e.description?.split("\n\n").some(
      (p) => p.includes(`Signed up by: ${profile.full_name}`) && !p.includes("[Amion]")
    ));
  }

  function isPast(ev: CalendarEvent): boolean {
    const raw = ev.start?.dateTime ?? ev.start?.date;
    if (!raw) return false;
    return new Date(raw) <= new Date();
  }

  const allMonthOptions = [
    { value: "all", label: "All months" },
    ...monthKeys.map((mk) => ({
      value: mk,
      label: `${monthGroups[mk].label} (${monthGroups[mk].events.length})`,
    })),
  ];

  const selectedLabel =
    allMonthOptions.find((o) => o.value === selectedMonth)?.label ?? "All months";

  function setMonth(val: string) {
    setSelectedMonth(val);
    try { localStorage.setItem("mc_selected_month", val); } catch { /* ignore */ }
    setDropOpen(false);
  }

  return (
    <div className="page-container">
      {/* Calendar Tabs */}
      <div className="calendar-tabs">
        {Object.entries(calendars).map(([key, info]) => (
          <Link
            key={key}
            href={`/?cal=${key}`}
            className={`btn btn-sm ${key === calKey ? "btn-primary" : "btn-outline"}`}
          >
            {info.short_label}
          </Link>
        ))}
      </div>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          <span>
            <strong>Calendar error:</strong> {fetchError}
          </span>
        </div>
      )}

      {/* Month filter */}
      <div className="filter-bar">
        <div
          className={`custom-select ${dropOpen ? "open" : ""}`}
          ref={dropRef}
        >
          <button
            className="btn btn-outline btn-sm custom-select-toggle"
            type="button"
            onClick={() => setDropOpen((o) => !o)}
            aria-expanded={dropOpen}
          >
            <span>{selectedLabel}</span>
            <span>▾</span>
          </button>
          <ul className="custom-select-options" role="listbox">
            {allMonthOptions.map((opt) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={selectedMonth === opt.value}
                onClick={() => setMonth(opt.value)}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Events by month */}
      {monthKeys.length === 0 && !fetchError && (
        <div style={{ color: "var(--text-secondary)", padding: "2rem 0" }}>
          No upcoming events found.
        </div>
      )}

      {monthKeys
        .filter((mk) => selectedMonth === "all" || mk === selectedMonth)
        .map((mk) => {
          const { label, events: monthEvents } = monthGroups[mk];
          return (
            <div key={mk} className="month-section">
              <div className="month-divider">
                <h2 className="month-header">{label}</h2>
              </div>
              <div className="event-group">
                {monthEvents.map((ev) => {
                  const liveEv = getEvent(ev);
                  const signedUp = isSignedUp(ev);
                  const past = isPast(ev);
                  const { generic, signups } = parseSignupBlocks(
                    liveEv.description ?? ""
                  );
                  const startRaw = ev.start?.dateTime ?? ev.start?.date;
                  return (
                    <div key={ev.id} className="event-card">
                      <h3 className="event-title">{ev.summary}</h3>
                      <div className="event-meta">
                        <div className="event-meta-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          {formatEventDate(startRaw)}
                        </div>
                        <div className="event-meta-row">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {formatEventTime(startRaw)}
                        </div>
                      </div>

                      {ev.location && (
                        <div className="event-location">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0, marginTop: 2}}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="event-location-link"
                          >
                            {ev.location}
                          </a>
                        </div>
                      )}

                      {(generic.length > 0 || signups.length > 0) && (
                        <div className="event-desc-block">
                          {generic.map((g, i) => (
                            <div
                              key={i}
                              dangerouslySetInnerHTML={{
                                __html: g.replace(/\n/g, "<br>"),
                              }}
                            />
                          ))}
                          {signups.length > 0 && generic.length > 0 && (
                            <hr className="signup-sep" />
                          )}
                          {signups.map((s, i) => {
                            const firstLine = s.split("\n")[0];
                            const signerName = firstLine.includes(":")
                              ? firstLine.split(":")[1].trim()
                              : firstLine;
                            return (
                              <div key={i} className="signup-entry">
                                <span
                                  dangerouslySetInnerHTML={{
                                    __html: s.replace(/\n/g, "<br>"),
                                  }}
                                />
                                {profile?.is_admin && (
                                  <button
                                    className="btn btn-danger btn-sm"
                                    style={{ flexShrink: 0 }}
                                    onClick={() =>
                                      openModal("cancel", liveEv, calKey, signerName)
                                    }
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="event-actions">
                        {signedUp ? (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => openModal("cancel", liveEv, calKey)}
                          >
                            Cancel
                          </button>
                        ) : past ? (
                          <span className="text-muted">Event passed</span>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openModal("sign-up", liveEv, calKey)}
                          >
                            Sign Up
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

      {/* Past Events toggle */}
      {pastMonthKeys.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setPastExpanded((v) => !v)}
            style={{ width: "100%", justifyContent: "space-between", display: "flex", alignItems: "center" }}
          >
            <span>Past Events (this academic year)</span>
            <span style={{ fontSize: "0.8rem" }}>{pastExpanded ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {pastExpanded && (
            <div style={{ marginTop: "1rem" }}>
              {pastMonthKeys.map((mk) => {
                const { label, events: monthEvents } = pastMonthGroups[mk];
                return (
                  <div key={mk} className="month-section">
                    <div className="month-divider">
                      <h2 className="month-header" style={{ color: "var(--text-secondary)" }}>
                        {label}
                      </h2>
                    </div>
                    <div className="event-group">
                      {monthEvents.map((ev) => {
                        const liveEv = getEvent(ev);
                        const signedUp = isSignedUp(ev);
                        const { generic, signups } = parseSignupBlocks(liveEv.description ?? "");
                        const startRaw = ev.start?.dateTime ?? ev.start?.date;
                        return (
                          <div key={ev.id} className="event-card" style={{ opacity: 0.75 }}>
                            <h3 className="event-title">{ev.summary}</h3>
                            <div className="event-meta">
                              <div className="event-meta-row">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                {formatEventDate(startRaw)}
                              </div>
                              <div className="event-meta-row">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {formatEventTime(startRaw)}
                              </div>
                            </div>

                            {ev.location && (
                              <div className="event-location">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="event-location-link"
                                >
                                  {ev.location}
                                </a>
                              </div>
                            )}

                            {(generic.length > 0 || signups.length > 0) && (
                              <div className="event-desc-block">
                                {generic.map((g, i) => (
                                  <div key={i} dangerouslySetInnerHTML={{ __html: g.replace(/\n/g, "<br>") }} />
                                ))}
                                {signups.length > 0 && generic.length > 0 && <hr className="signup-sep" />}
                                {signups.map((s, i) => {
                                  const firstLine = s.split("\n")[0];
                                  const signerName = firstLine.includes(":")
                                    ? firstLine.split(":")[1].trim()
                                    : firstLine;
                                  return (
                                    <div key={i} className="signup-entry">
                                      <span dangerouslySetInnerHTML={{ __html: s.replace(/\n/g, "<br>") }} />
                                      {profile?.is_admin && (
                                        <button
                                          className="btn btn-danger btn-sm"
                                          style={{ flexShrink: 0 }}
                                          onClick={() => openModal("cancel", liveEv, calKey, signerName)}
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="event-actions">
                              {signedUp ? (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => openModal("cancel", liveEv, calKey)}
                                >
                                  Cancel
                                </button>
                              ) : (
                                <span className="text-muted">Event passed</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <div className={`modal-overlay ${modal.open ? "open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">
          <div className="modal-title">Confirm Action</div>
          <div className="modal-body">
            {modal.action === "sign-up"
              ? `Are you sure you want to sign up for "${modal.eventTitle}"?`
              : modal.targetFullName
              ? `Are you sure you want to remove ${modal.targetFullName} from "${modal.eventTitle}"?`
              : `Are you sure you want to cancel your registration for "${modal.eventTitle}"?`}
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleConfirm} disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              Confirm
            </button>
            <button className="btn btn-outline" onClick={closeModal} disabled={loading}>
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "1.5rem",
            right: "1.5rem",
            zIndex: 2000,
            padding: "0.75rem 1.25rem",
            borderRadius: "var(--radius)",
            background: toast.type === "success" ? "#065f46" : "#b91c1c",
            color: "#fff",
            fontSize: "0.875rem",
            boxShadow: "var(--shadow-lg)",
            maxWidth: "320px",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
