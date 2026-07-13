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
  created_at: string;
  updated_at: string;
};

export type CalendarView = "day" | "week" | "month" | "year";

export const CATEGORY_COLORS = [
  { label: "Lavoro", value: "#3B7BF0" },
  { label: "Amici", value: "#12B48C" },
  { label: "Techno", value: "#E0348B" },
  { label: "Personale", value: "#F59E3C" },
];
