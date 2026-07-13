import { useEffect, useState } from "react";
import type { AgendaEvent } from "./types";
import { isSameDay } from "@/lib/date-utils";

/**
 * 24-hour circular quadrant. Hour 0 is at the top (12 o'clock),
 * hours advance clockwise. Each event is drawn as a filled pie slice.
 */
type Props = {
  date: Date;
  events: AgendaEvent[];
  onEventTap?: (id: string) => void;
};

const SIZE = 300;
const CENTER = SIZE / 2;
const R_OUTER = 132;
const R_INNER = 28; // small hub so slices reach near the center
const R_LABEL = 78; // radius for the text label along the slice

function hourToAngle(h: number): number {
  return (h / 24) * 360 - 90;
}
function polar(a: number, r: number): [number, number] {
  const rad = (a * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

/** Filled pie slice (annular sector) between two hours. */
function slicePath(hStart: number, hEnd: number): string {
  const a0 = hourToAngle(hStart);
  const a1 = hourToAngle(hEnd);
  const large = hEnd - hStart > 12 ? 1 : 0;
  const [ox0, oy0] = polar(a0, R_OUTER);
  const [ox1, oy1] = polar(a1, R_OUTER);
  const [ix1, iy1] = polar(a1, R_INNER);
  const [ix0, iy0] = polar(a0, R_INNER);
  return [
    `M ${ox0} ${oy0}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${ox1} ${oy1}`,
    `L ${ix1} ${iy1}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${ix0} ${iy0}`,
    `Z`,
  ].join(" ");
}

/** Curved text path along the middle of the slice, kept upright. */
function labelPath(hStart: number, hEnd: number): { d: string; flipped: boolean } {
  const mid = (hStart + hEnd) / 2;
  // On the bottom half (hours 6..18) the text would be upside-down: flip direction.
  const flipped = mid > 6 && mid < 18;
  const a0 = hourToAngle(flipped ? hEnd : hStart);
  const a1 = hourToAngle(flipped ? hStart : hEnd);
  const [x0, y0] = polar(a0, R_LABEL);
  const [x1, y1] = polar(a1, R_LABEL);
  const large = Math.abs(hEnd - hStart) > 12 ? 1 : 0;
  const sweep = flipped ? 0 : 1;
  return {
    d: `M ${x0} ${y0} A ${R_LABEL} ${R_LABEL} 0 ${large} ${sweep} ${x1} ${y1}`,
    flipped,
  };
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

  const slices = events
    .map((e) => {
      const s = new Date(e.starts_at);
      const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
      const sClip = s < dayStart ? dayStart : s;
      const eClip = en > dayEnd ? dayEnd : en;
      const hs = (sClip.getTime() - dayStart.getTime()) / 3.6e6;
      const he = (eClip.getTime() - dayStart.getTime()) / 3.6e6;
      if (he <= hs) return null;
      const spanned = Math.max(he - hs, 0.6);
      return {
        id: e.id,
        title: e.title,
        color: e.list_color,
        icon: e.icon,
        hs,
        he: Math.min(24, hs + spanned),
      };
    })
    .filter(Boolean) as {
      id: string; title: string; color: string; icon: string | null; hs: number; he: number;
    }[];

  const showHand = isSameDay(now, date);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const handAngle = hourToAngle(nowH);
  const [hx, hy] = polar(handAngle, R_OUTER - 6);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block h-auto w-full max-w-[300px]"
      aria-label="Quadrante 24 ore"
    >
      {/* Background dial */}
      <circle cx={CENTER} cy={CENTER} r={R_OUTER + 6} fill="var(--color-card)" />
      <circle
        cx={CENTER} cy={CENTER} r={R_OUTER}
        fill="var(--color-muted)" opacity="0.35"
      />

      {/* Event slices */}
      <defs>
        {slices.map((s) => {
          const { d } = labelPath(s.hs, s.he);
          return <path key={`p-${s.id}`} id={`label-${s.id}`} d={d} />;
        })}
      </defs>
      {slices.map((s) => {
        const span = s.he - s.hs;
        const label = s.icon ? `${s.icon} ${s.title}` : s.title;
        // approx chars that fit along the arc
        const maxChars = Math.max(2, Math.floor(span * 4.5));
        const shown = label.length > maxChars ? label.slice(0, Math.max(1, maxChars - 1)) + "…" : label;
        return (
          <g
            key={s.id}
            onClick={() => onEventTap?.(s.id)}
            style={{ cursor: onEventTap ? "pointer" : undefined }}
          >
            <path
              d={slicePath(s.hs, s.he)}
              fill={s.color}
              stroke="var(--color-card)"
              strokeWidth="1.5"
              opacity="0.9"
            />
            {span >= 1 && (
              <text
                fontSize="10"
                fontWeight="600"
                fill="#fff"
                style={{ pointerEvents: "none" }}
              >
                <textPath href={`#label-${s.id}`} startOffset="50%" textAnchor="middle">
                  {shown}
                </textPath>
              </text>
            )}
          </g>
        );
      })}

      {/* Hour ticks every 3h with labels */}
      {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
        const a = hourToAngle(h);
        const [x1, y1] = polar(a, R_OUTER + 2);
        const [x2, y2] = polar(a, R_OUTER - 4);
        const [tx, ty] = polar(a, R_OUTER + 18);
        return (
          <g key={h}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-muted-foreground)" strokeWidth="1" opacity="0.7" />
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
      {Array.from({ length: 24 }, (_, h) => h).map((h) => {
        if (h % 3 === 0) return null;
        const a = hourToAngle(h);
        const [x1, y1] = polar(a, R_OUTER);
        const [x2, y2] = polar(a, R_OUTER - 3);
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-border)" strokeWidth="1" />;
      })}

      {/* Center hub */}
      <circle cx={CENTER} cy={CENTER} r={R_INNER} fill="var(--color-card)" stroke="var(--color-border)" />

      {/* Hand (only if today) */}
      {showHand && (
        <>
          <line
            x1={CENTER} y1={CENTER} x2={hx} y2={hy}
            stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"
          />
          <circle cx={CENTER} cy={CENTER} r="4" fill="var(--color-primary)" />
        </>
      )}
    </svg>
  );
}
