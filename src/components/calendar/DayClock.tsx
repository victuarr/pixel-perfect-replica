import React, { useEffect, useMemo, useState } from "react";
import type { AgendaEvent } from "./types";
import { isSameDay, formatTime } from "@/lib/date-utils";

/**
 * 24-hour circular quadrant. Hour 0 is at the top (12 o'clock),
 * hours advance clockwise. Events are drawn as filled annular sectors;
 * overlapping events are placed on concentric lanes so none is hidden.
 */
type Props = {
  date: Date;
  events: AgendaEvent[];
  onEventTap?: (id: string) => void;
  onHourTap?: (hour: number) => void;
};

const SIZE = 300;
const CENTER = SIZE / 2;
const R_OUTER_MAX = 132;
const R_INNER_MIN = 28;
const MAX_LANES = 4;
const LANE_GAP = 2;
const LANE_THICKNESS = (R_OUTER_MAX - R_INNER_MIN - LANE_GAP * (MAX_LANES - 1)) / MAX_LANES;

function hourToAngle(h: number): number {
  return (h / 24) * 360 - 90;
}
function polar(a: number, r: number): [number, number] {
  const rad = (a * Math.PI) / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}

/** Filled annular sector between two hours and two radii. */
function slicePath(hStart: number, hEnd: number, rOuter: number, rInner: number): string {
  const a0 = hourToAngle(hStart);
  const a1 = hourToAngle(hEnd);
  const large = hEnd - hStart > 12 ? 1 : 0;
  const [ox0, oy0] = polar(a0, rOuter);
  const [ox1, oy1] = polar(a1, rOuter);
  const [ix1, iy1] = polar(a1, rInner);
  const [ix0, iy0] = polar(a0, rInner);
  return [
    `M ${ox0} ${oy0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${ox1} ${oy1}`,
    `L ${ix1} ${iy1}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ix0} ${iy0}`,
    `Z`,
  ].join(" ");
}

type Slice = {
  id: string;
  title: string;
  color: string;
  icon: string | null;
  hs: number;
  he: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  starts_at: string;
  place: string | null;
};

/** Greedy interval-graph lane assignment. Returns lane index per slice id. */
function assignLanes(slices: Slice[]): Map<string, number> {
  const sorted = [...slices].sort((a, b) => a.hs - b.hs || b.he - b.he);
  const laneEnds: number[] = []; // hs of "he" per lane (running end time)
  const laneOf = new Map<string, number>();
  for (const s of sorted) {
    let placed = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= s.hs) {
        placed = i;
        break;
      }
    }
    if (placed === -1) {
      placed = laneEnds.length;
      laneEnds.push(s.he);
    } else {
      laneEnds[placed] = s.he;
    }
    laneOf.set(s.id, placed);
  }
  return laneOf;
}

export function DayClock({ date, events, onEventTap, onHourTap }: Props) {
  const [now, setNow] = useState(new Date());
  const [overflowAt, setOverflowAt] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const slices: Slice[] = useMemo(() => {
    return events
      .map((e) => {
        const s = new Date(e.starts_at);
        const en = e.ends_at ? new Date(e.ends_at) : new Date(s.getTime() + 60 * 60 * 1000);
        const continuesBefore = s < dayStart;
        const continuesAfter = en > dayEnd;
        const sClip = continuesBefore ? dayStart : s;
        const eClip = continuesAfter ? dayEnd : en;
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
          continuesBefore,
          continuesAfter,
          starts_at: e.starts_at,
          place: e.place ?? null,
        } as Slice;
      })
      .filter(Boolean) as Slice[];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, date.getTime()]);

  const laneOf = useMemo(() => assignLanes(slices), [slices]);

  // Split into visible (lanes 0..MAX_LANES-1) and overflow (lane >= MAX_LANES).
  const visible = slices.filter((s) => (laneOf.get(s.id) ?? 0) < MAX_LANES);
  const overflow = slices.filter((s) => (laneOf.get(s.id) ?? 0) >= MAX_LANES);

  // Group overflow events by contiguous overlapping clusters, so we can place
  // a "+N" chip at the middle of the cluster.
  const overflowClusters: { hCenter: number; items: Slice[] }[] = [];
  {
    const sorted = [...overflow].sort((a, b) => a.hs - b.hs);
    let cur: Slice[] = [];
    let curEnd = -Infinity;
    for (const s of sorted) {
      if (cur.length === 0 || s.hs < curEnd) {
        cur.push(s);
        curEnd = Math.max(curEnd, s.he);
      } else {
        const hs = Math.min(...cur.map((x) => x.hs));
        const he = Math.max(...cur.map((x) => x.he));
        overflowClusters.push({ hCenter: (hs + he) / 2, items: cur });
        cur = [s];
        curEnd = s.he;
      }
    }
    if (cur.length) {
      const hs = Math.min(...cur.map((x) => x.hs));
      const he = Math.max(...cur.map((x) => x.he));
      overflowClusters.push({ hCenter: (hs + he) / 2, items: cur });
    }
  }

  const showHand = isSameDay(now, date);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const handAngle = hourToAngle(nowH);
  const [hx, hy] = polar(handAngle, R_OUTER_MAX - 6);

  const overflowList = overflowAt != null ? overflowClusters[overflowAt]?.items ?? [] : [];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto block h-auto w-full max-w-[300px]"
        aria-label="Quadrante 24 ore"
      >
        {/* Background dial */}
        <circle cx={CENTER} cy={CENTER} r={R_OUTER_MAX + 6} fill="var(--color-card)" />
        <circle
          cx={CENTER} cy={CENTER} r={R_OUTER_MAX}
          fill="var(--color-muted)" opacity="0.35"
        />

        {/* Event slices, lane by lane (outer → inner) */}
        {visible.map((s) => {
          const lane = laneOf.get(s.id) ?? 0;
          const rOuter = R_OUTER_MAX - lane * (LANE_THICKNESS + LANE_GAP);
          const rInner = rOuter - LANE_THICKNESS;
          const markers: React.ReactNode[] = [];
          if (s.continuesBefore) {
            const [mx, my] = polar(hourToAngle(s.hs), rOuter + 4);
            markers.push(
              <circle key="cb" cx={mx} cy={my} r="2.4" fill={s.color} stroke="var(--color-card)" strokeWidth="1" />
            );
          }
          if (s.continuesAfter) {
            const [mx, my] = polar(hourToAngle(s.he), rOuter + 4);
            markers.push(
              <circle key="ca" cx={mx} cy={my} r="2.4" fill={s.color} stroke="var(--color-card)" strokeWidth="1" />
            );
          }
          return (
            <g
              key={s.id}
              onClick={() => onEventTap?.(s.id)}
              style={{ cursor: onEventTap ? "pointer" : undefined }}
            >
              <title>{s.title}</title>
              <path
                d={slicePath(s.hs, s.he, rOuter, rInner)}
                fill={s.color}
                stroke="var(--color-card)"
                strokeWidth="1.5"
                opacity="0.9"
              />
              {markers}
            </g>
          );
        })}

        {/* Overflow "+N" chips */}
        {overflowClusters.map((c, i) => {
          const a = hourToAngle(c.hCenter);
          const r = R_INNER_MIN + 10;
          const [cx, cy] = polar(a, r);
          return (
            <g
              key={`ov-${i}`}
              onClick={() => setOverflowAt(i)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={cx} cy={cy} r="10" fill="var(--color-primary)" stroke="var(--color-card)" strokeWidth="1.5" />
              <text
                x={cx} y={cy}
                textAnchor="middle" dominantBaseline="central"
                fill="var(--color-primary-foreground)"
                fontSize="9"
                fontFamily="var(--font-display)"
                fontWeight="700"
              >
                +{c.items.length}
              </text>
            </g>
          );
        })}

        {/* Hour ticks and clickable labels for all 24 hours */}
        {Array.from({ length: 24 }, (_, h) => h).map((h) => {
          const a = hourToAngle(h);
          const major = h % 3 === 0;
          const [x1, y1] = polar(a, R_OUTER_MAX + 2);
          const [x2, y2] = polar(a, R_OUTER_MAX - (major ? 4 : 3));
          const [tx, ty] = polar(a, R_OUTER_MAX + 16);
          return (
            <g
              key={h}
              onClick={() => onHourTap?.(h)}
              style={{ cursor: onHourTap ? "pointer" : undefined }}
            >
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={major ? "var(--color-muted-foreground)" : "var(--color-border)"}
                strokeWidth="1" opacity={major ? 0.7 : 1}
              />
              <text
                x={tx} y={ty}
                textAnchor="middle" dominantBaseline="central"
                fill="var(--color-muted-foreground)"
                fontSize={major ? "10" : "8"}
                fontFamily="var(--font-display)"
                opacity={major ? 1 : 0.75}
              >
                {h}
              </text>
              {onHourTap && (
                <circle cx={tx} cy={ty} r="12" fill="transparent" />
              )}
            </g>
          );
        })}

        {/* Center hub */}
        <circle cx={CENTER} cy={CENTER} r={R_INNER_MIN} fill="var(--color-card)" stroke="var(--color-border)" />

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

      {/* Overflow popover */}
      {overflowAt != null && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          onClick={() => setOverflowAt(null)}
        >
          <div
            className="max-h-[80%] w-[85%] overflow-auto rounded-2xl border border-border bg-card p-3 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Altri eventi
            </p>
            <ul className="flex flex-col gap-1.5">
              {overflowList.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      setOverflowAt(null);
                      onEventTap?.(s.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg bg-background/60 p-2 text-left hover:bg-accent/60"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm"
                      style={{ backgroundColor: s.color + "22", color: s.color }}
                    >
                      {s.icon ?? "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatTime(new Date(s.starts_at))}
                        {s.place ? ` · ${s.place}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
