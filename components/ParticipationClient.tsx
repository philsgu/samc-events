"use client";

import { useState } from "react";
import type { ParticipationData } from "@/app/participation/page";

interface Props {
  data: ParticipationData;
}

export default function ParticipationClient({ data }: Props) {
  const { profile, personal, allUsers, totalParticipants, fetchError } = data;
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  const totalPersonal = personal.mobileCount + personal.sportCount;

  // Derive sorted unique specialty options — "All" first, "Amion" last, rest alphabetical
  const specialtyOptions = allUsers
    ? [
        "all",
        ...Array.from(new Set(allUsers.map((r) => r.specialty)))
          .filter((s) => s !== "Amion")
          .sort((a, b) => a.localeCompare(b)),
        ...(allUsers.some((r) => r.specialty === "Amion") ? ["Amion"] : []),
      ]
    : ["all"];

  const filteredUsers =
    !allUsers || specialtyFilter === "all"
      ? allUsers
      : allUsers.filter((r) => r.specialty === specialtyFilter);

  return (
    <div className="page-container">
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: "1.5rem",
        }}
      >
        Participation Summary
      </h1>

      {fetchError && (
        <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
          <strong>Error:</strong> {fetchError}
        </div>
      )}

      {/* ── Personal Summary ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            borderBottom: "2px solid var(--border)",
            paddingBottom: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          Your Summary — {profile?.full_name}
        </h2>

        {/* Stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <StatCard label="Total Events" value={totalPersonal} color="var(--primary)" />
          <StatCard label="Mobile Clinic" value={personal.mobileCount} color="var(--secondary)" />
          <StatCard label="Sports Medicine" value={personal.sportCount} color="#7c3aed" />
        </div>

        {/* Sites visited */}
        {personal.sites.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.5rem",
              }}
            >
              Sites Visited
            </h3>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {personal.sites.map((s) => (
                    <tr key={s.location}>
                      <td data-label="Location">{s.location}</td>
                      <td data-label="Visits">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Event history */}
        {personal.events.length > 0 ? (
          <div>
            <h3
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: "0.5rem",
              }}
            >
              Event History (this academic year)
            </h3>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Calendar</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {personal.events.map((ev, i) => (
                    <tr key={i}>
                      <td data-label="Calendar">
                        <span
                          className={`badge ${ev.calendarKey === "mobile" ? "badge-success" : "badge-primary"}`}
                        >
                          {ev.calendarLabel}
                        </span>
                      </td>
                      <td data-label="Date">{ev.date}</td>
                      <td data-label="Time" style={{ whiteSpace: "nowrap" }}>{ev.time}</td>
                      <td data-label="Event">{ev.title}</td>
                      <td data-label="Location">{ev.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !fetchError && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No events attended yet this academic year.
            </p>
          )
        )}
      </section>

      {/* ── Admin: All Users ─────────────────────────────────────────────── */}
      {profile?.is_admin && allUsers !== null && (
        <section>
          {/* Section header */}
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderBottom: "2px solid var(--border)",
              paddingBottom: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            All Participants —{" "}
            {specialtyFilter === "all"
              ? `${totalParticipants} unique`
              : `${filteredUsers?.length} of ${totalParticipants} (${specialtyFilter})`}
          </h2>

          {/* Specialty filter pills */}
          {specialtyOptions.length > 1 && (
            <div
              style={{
                display: "flex",
                gap: "0.4rem",
                flexWrap: "wrap",
                marginBottom: "1rem",
              }}
            >
              {specialtyOptions.map((opt) => (
                <button
                  key={opt}
                  className={`btn btn-sm ${specialtyFilter === opt ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setSpecialtyFilter(opt)}
                >
                  {opt === "all" ? "All" : opt}
                </button>
              ))}
            </div>
          )}

          {!filteredUsers || filteredUsers.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No participants found{specialtyFilter !== "all" ? ` for ${specialtyFilter}` : ""}.
            </p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Specialty</th>
                    <th>Mobile Clinic</th>
                    <th>Sports Medicine</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((row, i) => (
                    <tr key={i}>
                      <td data-label="Name">
                        {row.name}
                        {row.isAmion && (
                          <span
                            className="badge"
                            style={{ marginLeft: "0.4rem", fontSize: "0.68rem" }}
                          >
                            Amion
                          </span>
                        )}
                      </td>
                      <td data-label="Specialty">
                        {row.isAmion ? (
                          <span className="badge" style={{ fontSize: "0.68rem" }}>
                            Amion
                          </span>
                        ) : (
                          <span
                            className="badge badge-primary"
                            style={{ fontSize: "0.68rem" }}
                          >
                            {row.specialty}
                          </span>
                        )}
                      </td>
                      <td data-label="Mobile Clinic">{row.mobileCount}</td>
                      <td data-label="Sports Medicine">{row.sportCount}</td>
                      <td data-label="Total">
                        <strong>{row.total}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Small stat card ───────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem 1.25rem",
        boxShadow: "var(--shadow)",
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <span
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: "0.78rem",
          color: "var(--text-secondary)",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  );
}
