import { useEffect, useState } from "react";
import type { AgendaEvent } from "./types";
import { isSameDay } from "@/lib/date-utils";

/**
 * 24-hour circular quadrant. Hour 0 is at the top (12 o'clock),
 * hours advance clockwise. Each event is drawn as a colored arc.
 */
type Props = {
  date: Date;
  events: AgendaEvent[];
  onEventTap?: (id: string) => void;
};

const SIZE = 300;
const CENTER = SIZE / 2;
const R_OUTER = 132;
const R_INNER = 108;
const STROKE = R_OUTER - R_INNER;
const R_MID = (R_OUTER + R_INNER) / 2;

function hourToAngle(h: number): number {
  // 0..24 -> -90..270 (deg). Start at top, clockwise.
  return (h / 24) * 360 - 90;
}
function polar(a: number, r: number): [number, number] {
  const rad = (a * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}
function arcPath(hStart: number, hEnd: number): string {
  const a0 = hourToAngle(hStart);
  const a1 = hourToAngle(hEnd);
  const large = hEnd - hStart > 12 ? 1 : 0;
  const [x0, y0] = polar(a0, R_MID);
  const [x1, y1] = polar(a1, R_MID);
  return `M ${x0} ${y0} A ${R_MID} ${R_MID} 0 ${large} 1 ${x1} ${y1}`;
}

export function DayClock({ date, events, onEventTap }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  // Clip events to today
  const arcs = events
    .map((e) => {
      const s = new Date(e.starts_at);
      const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
      const sClip = s < dayStart ? dayStart : s;
      const eClip = en > dayEnd ? dayEnd : en;
      const hs = (sClip.getTime() - dayStart.getTime()) / 3.6e6;
      const he = (eClip.getTime() - dayStart.getTime()) / 3.6e6;
      if (he <= hs) return null;
      // Minimum arc so tiny events remain visible
      const spanned = Math.max(he - hs, 0.4);
      return { id: e.id, color: e.list_color, hs, he: hs + spanned, icon: e.icon };
    })
    .filter(Boolean) as {
      id: string; color: string; hs: number; he: number; icon: string | null;
    }[];

  const showHand = isSameDay(now, date);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const handAngle = hourToAngle(nowH);
  const [hx, hy] = polar(handAngle, R_INNER - 12);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block h-auto w-full max-w-[300px]"
      aria-label="Quadrante 24 ore"
    >
      {/* Background dial */}
      <circle cx={CENTER} cy={CENTER} r={R_OUTER + 6} fill="var(--color-card)" />
      <circle
        cx={CENTER} cy={CENTER} r={R_MID}
        fill="none" stroke="var(--color-muted)" strokeWidth={STROKE - 2}
        opacity="0.5"
      />

      {/* Hour ticks every 3h with labels */}
      {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
        const a = hourToAngle(h);
        const [x1, y1] = polar(a, R_OUTER + 2);
        const [x2, y2] = polar(a, R_OUTER - 6);
        const [tx, ty] = polar(a, R_OUTER + 18);
        return (
          <g key={h}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-muted-foreground)" strokeWidth="1" opacity="0.6" />
            <text
              x={tx} y={ty}
              textAnchor="middle" dominantBaseline="central"
              fill="var(--color-muted-foreground)"
              fontSize="11" fontFamily="var(--font-display)"
            >
              {h}
            </text>
          </g>
        );
      })}
      {/* minor ticks every hour */}
      {Array.from({ length: 24 }, (_, h) => h).map((h) => {
        if (h % 3 === 0) return null;
        const a = hourToAngle(h);
        const [x1, y1] = polar(a, R_OUTER);
        const [x2, y2] = polar(a, R_OUTER - 3);
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-border)" strokeWidth="1" />;
      })}

      {/* Event arcs */}
      {arcs.map((a) => (
        <path
          key={a.id}
          d={arcPath(a.hs, a.he)}
          stroke={a.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          onClick={() => onEventTap?.(a.id)}
          style={{ cursor: onEventTap ? "pointer" : undefined }}
        />
      ))}

      {/* Center hub */}
      <circle cx={CENTER} cy={CENTER} r={R_INNER - 18} fill="var(--color-card)" stroke="var(--color-border)" />

      {/* Hand (only if today) */}
      {showHand && (
        <>
          <line
            x1={CENTER} y1={CENTER} x2={hx} y2={hy}
            stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round"
          />
          <circle cx={CENTER} cy={CENTER} r="5" fill="var(--color-primary)" />
        </>
      )}
    </svg>
  );
}
