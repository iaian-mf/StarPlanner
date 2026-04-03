import { useRef, useEffect } from "react";
import { altitudeProfile, KEW_GARDENS, formatTime, type Observer } from "@/lib/astronomy";
import type { ScoredDSO } from "@/lib/types";

interface TimelineProps {
  objects: ScoredDSO[];
  timelineStart: Date;
  timelineEnd: Date;
  darknessStart: Date;
  darknessEnd: Date;
  observer?: Observer;
}

export function Timeline({
  objects,
  timelineStart,
  timelineEnd,
  darknessStart,
  darknessEnd,
  observer = KEW_GARDENS,
}: TimelineProps) {
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
    const padding = { top: 16, right: 16, bottom: 20, left: 100 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const startTime = timelineStart;
    const endTime = timelineEnd;

    const timeToX = (t: Date) => {
      const frac = (t.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime());
      return padding.left + frac * plotW;
    };

    // Darkness background
    const dkStartX = timeToX(darknessStart);
    const dkEndX = timeToX(darknessEnd);
    ctx.fillStyle = "rgba(99, 102, 241, 0.06)";
    ctx.fillRect(dkStartX, padding.top, dkEndX - dkStartX, plotH);

    // Darkness boundary lines
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(dkStartX, padding.top);
    ctx.lineTo(dkStartX, padding.top + plotH);
    ctx.moveTo(dkEndX, padding.top);
    ctx.lineTo(dkEndX, padding.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    if (objects.length === 0) return;

    const barHeight = Math.min(16, (plotH - (objects.length - 1) * 3) / objects.length);
    const gap = 3;

    type Band = "below" | "low" | "high";
    const getBand = (alt: number): Band => alt < 0 ? "below" : alt < 30 ? "low" : "high";

    // amber for 0–30°, green for 30–90°
    const bandFill: Record<Band, string | null> = {
      below: null,
      low: "#f59e0b",   // amber-400
      high: "#10b981",  // emerald-500
    };

    objects.forEach((dso, idx) => {
      const y = padding.top + idx * (barHeight + gap);
      const profile = altitudeProfile(startTime, endTime, dso.ra, dso.dec, observer, 5);

      // Label
      ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "right";
      const label = dso.commonName?.split(",")[0] || dso.displayId;
      ctx.fillText(label.length > 14 ? label.slice(0, 13) + "…" : label, padding.left - 6, y + barHeight / 2 + 3.5);

      // Draw segments coloured by altitude band
      const drawSeg = (band: Band, x1: number, x2: number) => {
        const c = bandFill[band];
        if (!c || x2 <= x1) return;
        ctx.fillStyle = c + "44";
        ctx.beginPath();
        ctx.roundRect(x1, y, x2 - x1, barHeight, 3);
        ctx.fill();
        ctx.strokeStyle = c + "99";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x1, y, x2 - x1, barHeight, 3);
        ctx.stroke();
      };

      let segBand = getBand(profile[0].altitude);
      let segStart = timeToX(profile[0].time);

      for (let i = 1; i < profile.length; i++) {
        const band = getBand(profile[i].altitude);
        const x = timeToX(profile[i].time);
        if (band !== segBand) {
          drawSeg(segBand, segStart, x);
          segStart = x;
          segBand = band;
        }
      }
      drawSeg(segBand, segStart, timeToX(profile[profile.length - 1].time));

      // Transit time marker — white vertical tick within the bar
      const tx = timeToX(dso.transitTime);
      if (tx >= padding.left && tx <= padding.left + plotW) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx, y + 1);
        ctx.lineTo(tx, y + barHeight - 1);
        ctx.stroke();

        // Small downward triangle below the bar
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.beginPath();
        ctx.moveTo(tx - 3, y + barHeight + 1);
        ctx.lineTo(tx + 3, y + barHeight + 1);
        ctx.lineTo(tx, y + barHeight + 4);
        ctx.closePath();
        ctx.fill();
      }
    });

    // Time axis
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";

    const totalHours = (endTime.getTime() - startTime.getTime()) / 3600000;
    const interval = totalHours > 8 ? 2 : 1;

    for (let i = 0; i <= totalHours; i += interval) {
      const t = new Date(startTime.getTime() + i * 3600000);
      const x = timeToX(t);
      ctx.fillText(formatTime(t), x, padding.top + plotH + 14);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
    }

  }, [objects, timelineStart, timelineEnd, darknessStart, darknessEnd, observer]);

  return (
    <div className="w-full" data-testid="timeline-chart">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{ height: `${Math.min(200, 40 + Math.min(8, objects.length) * 19)}px` }}
      />
    </div>
  );
}
