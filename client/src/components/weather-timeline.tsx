import { useRef, useEffect } from "react";
import { formatTime } from "@/lib/astronomy";

interface WeatherTimelineProps {
  times: string[];          // ISO strings (UTC)
  cloudcover: number[];     // 0–100
  precipitation: number[];  // mm/h
  timelineStart: Date;
  timelineEnd: Date;
  darknessStart: Date;
  darknessEnd: Date;
}

export function WeatherTimeline({
  times, cloudcover, precipitation,
  timelineStart, timelineEnd, darknessStart, darknessEnd,
}: WeatherTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    // Extra bottom padding to fit condition-strip time labels
    const padding = { top: 8, right: 16, bottom: 28, left: 100 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const startTime = timelineStart;
    const endTime = timelineEnd;
    const range = endTime.getTime() - startTime.getTime();

    const timeToX = (t: Date) =>
      padding.left + ((t.getTime() - startTime.getTime()) / range) * plotW;

    // Darkness background
    const dkStartX = timeToX(darknessStart);
    const dkEndX = timeToX(darknessEnd);
    ctx.fillStyle = "rgba(99, 102, 241, 0.06)";
    ctx.fillRect(dkStartX, padding.top, dkEndX - dkStartX, plotH);

    // Darkness boundary lines
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(dkStartX, padding.top); ctx.lineTo(dkStartX, padding.top + plotH);
    ctx.moveTo(dkEndX, padding.top);   ctx.lineTo(dkEndX, padding.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Cloud Cover", padding.left - 6, padding.top + plotH / 2 + 3.5);

    // Build point list within the time window
    interface Pt { x: number; cover: number; rain: boolean }
    const pts: Pt[] = [];
    for (let i = 0; i < times.length; i++) {
      const t = new Date(times[i] + "Z");
      if (t < startTime || t > endTime) continue;
      pts.push({ x: timeToX(t), cover: cloudcover[i], rain: (precipitation[i] ?? 0) > 0 });
    }
    if (pts.length < 2) return;

    const coverToY = (c: number) => padding.top + plotH - (c / 100) * plotH;

    // ── Draw filled area segmented by condition ────────────────────────────
    // Condition: "rain" | "clear" | "cloudy"
    type Cond = "rain" | "clear" | "cloudy";
    const getCond = (p: Pt): Cond => p.rain ? "rain" : p.cover < 20 ? "clear" : "cloudy";
    const condFill: Record<Cond, string> = {
      rain:   "rgba(239, 68, 68, 0.35)",   // red-500
      clear:  "rgba(16, 185, 129, 0.35)",  // emerald-500
      cloudy: "rgba(148, 163, 184, 0.25)", // slate-400
    };
    const condStroke: Record<Cond, string> = {
      rain:   "rgba(239, 68, 68, 0.7)",
      clear:  "rgba(16, 185, 129, 0.7)",
      cloudy: "rgba(148, 163, 184, 0.55)",
    };

    // Draw per-segment filled polygon
    let segStart = 0;
    let segCond = getCond(pts[0]);

    const drawAreaSeg = (from: number, to: number, cond: Cond) => {
      if (to <= from) return;
      const segPts = pts.slice(from, to + 1);
      ctx.beginPath();
      ctx.moveTo(segPts[0].x, padding.top + plotH);
      for (const p of segPts) ctx.lineTo(p.x, coverToY(p.cover));
      ctx.lineTo(segPts[segPts.length - 1].x, padding.top + plotH);
      ctx.closePath();
      ctx.fillStyle = condFill[cond];
      ctx.fill();
    };

    for (let i = 1; i < pts.length; i++) {
      const cond = getCond(pts[i]);
      if (cond !== segCond) {
        drawAreaSeg(segStart, i, segCond);
        segStart = i;
        segCond = cond;
      }
    }
    drawAreaSeg(segStart, pts.length - 1, segCond);

    // Draw single outline over the whole cloud cover line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, coverToY(pts[0].cover));
    for (const p of pts) ctx.lineTo(p.x, coverToY(p.cover));
    ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ── Condition strip + time labels ─────────────────────────────────────
    const stripY = padding.top + plotH + 4;
    const stripH = 6;

    interface Period { cond: Cond; startX: number; endX: number; startT: Date; endT: Date }
    const periods: Period[] = [];
    let pStart = 0;
    let pCond = getCond(pts[0]);
    // We need times alongside pts for labels — rebuild with times
    const ptTimes: Date[] = [];
    { let pi = 0;
      for (let i = 0; i < times.length; i++) {
        const t = new Date(times[i] + "Z");
        if (t < startTime || t > endTime) continue;
        ptTimes[pi++] = t;
      }
    }

    const closePeriod = (endIdx: number) => {
      if (pCond === "cloudy") { pStart = endIdx; return; }
      periods.push({
        cond: pCond,
        startX: pts[pStart].x,
        endX: pts[endIdx].x,
        startT: ptTimes[pStart],
        endT: ptTimes[endIdx],
      });
      pStart = endIdx;
    };

    for (let i = 1; i < pts.length; i++) {
      const c = getCond(pts[i]);
      if (c !== pCond) { closePeriod(i); pCond = c; }
    }
    closePeriod(pts.length - 1);

    // Draw strip rectangles and labels
    ctx.font = "8px Inter, sans-serif";
    const MIN_LABEL_PX = 32; // don't label very narrow periods

    for (const p of periods) {
      const x1 = Math.max(p.startX, padding.left);
      const x2 = Math.min(p.endX, padding.left + plotW);
      if (x2 <= x1) continue;
      ctx.fillStyle = p.cond === "rain" ? "rgba(239,68,68,0.7)" : "rgba(16,185,129,0.7)";
      ctx.fillRect(x1, stripY, x2 - x1, stripH);

      if (x2 - x1 < MIN_LABEL_PX) continue;

      ctx.fillStyle = p.cond === "rain" ? "rgba(239,68,68,0.9)" : "rgba(16,185,129,0.9)";
      ctx.textAlign = "left";
      ctx.fillText(formatTime(p.startT), x1 + 2, stripY + stripH + 10);
      ctx.textAlign = "right";
      ctx.fillText(formatTime(p.endT), x2 - 2, stripY + stripH + 10);
    }

    // ── Y-axis labels ──────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "8px Inter, sans-serif";
    ctx.textAlign = "right";
    for (const pct of [100, 50, 0]) {
      ctx.fillText(`${pct}%`, padding.left - 6, coverToY(pct) + 3);
    }

  }, [times, cloudcover, precipitation, timelineStart, timelineEnd, darknessStart, darknessEnd]);

  return (
    <canvas ref={canvasRef} className="w-full" style={{ height: "80px" }} />
  );
}
