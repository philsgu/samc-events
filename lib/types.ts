export interface Profile {
  id: string;
  full_name: string;
  cell_number: string;
  email: string;
  specialty: string;
  is_admin: boolean;
  created_at: string;
}

export interface CalendarInfo {
  id: string;
  label: string;
  short_label: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
}

export const CALENDARS: Record<string, CalendarInfo> = {
  mobile: {
    id: "790bf60764e7a2b5b8037b116ec8dd03c2db8d6dad59ce434402777ca1e238c8@group.calendar.google.com",
    label: "SAMC GME Mobile Clinic",
    short_label: "Mobile Clinic",
  },
  sport: {
    id: "0dea2ae1cd4d9093f041cacc95ec8e9d37ce0f62e6c06d48b9cf2d661f1f10e1@group.calendar.google.com",
    label: "SAMC GME Sport Medicine",
    short_label: "Sports Medicine",
  },
};

export const SPECIALTIES = [
  { value: "EM", label: "Emergency Medicine (EM)" },
  { value: "FM", label: "Family Medicine (FM)" },
  { value: "IM", label: "Internal Medicine (IM)" },
  { value: "TY", label: "Transitional Medicine (TY)" },
];
