export type AgendaEvent = {
  id: string;
  owner_id: string;
  title: string;
  icon: string | null;
  place: string | null;
  starts_at: string;
  ends_at: string | null;
  description: string | null;
  visibility_type: "public" | "lists" | "private";
  origin_id: string | null;
  list_color: string;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
};

export type CalendarView = "day" | "week" | "month" | "year";

/** Colore neutro usato per eventi pubblici o privati senza lista. */
export const DEFAULT_EVENT_COLOR = "#94A3B8";
