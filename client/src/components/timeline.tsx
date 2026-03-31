import { useRef, useEffect } from "react";
import { altitudeProfile, KEW_GARDENS, formatTime, type Observer } from "@/lib/astronomy";
import type { ScoredDSO } from "@/lib/types";

// Consistent color palette for timeline bars
const BAR_COLORS = [
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#3b82f6", // blue
  "#ec4899", // pink
  "#14b8a6", // teal
];

interface TimelineProps {
  objects: ScoredDSO[];
  darknessStart: Date;
  darknessEnd: Date;
  observer?: Observer;
  maxObjects?: number;
}

export function Timeline({
  objects,
  darknessStart,
  darknessEnd,
  observer = KEW_GARDENS,
  maxObjects = 8,
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

    // Time range from darkness start -30min to darkness end +30min
    const startTime = new Date(darknessStart.getTime() - 30 * 60000);
    const endTime = new Date(darknessEnd.getTime() + 30 * 60000);

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

    const topObjects = objects.slice(0, maxObjects);
    const barHeight = Math.min(16, (plotH - (topObjects.length - 1) * 3) / topObjects.length);
    const gap = 3;

    topObjects.forEach((dso, idx) => {
      const y = padding.top + idx * (barHeight + gap);
      const color = BAR_COLORS[idx % BAR_COLORS.length];

      // Calculate visibility windows above 30°
      const profile = altitudeProfile(startTime, endTime, dso.ra, dso.dec, observer, 5);

      // Label
      ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
      ctx.font = "10px Inter, sans-serif";
      ctx.textAlign = "right";
      const label = dso.commonName?.split(",")[0] || dso.displayId;
      ctx.fillText(label.length > 14 ? label.slice(0, 13) + "…" : label, padding.left - 6, y + barHeight / 2 + 3.5);

      // Draw visibility bar
      let inWindow = false;
      let windowStart = 0;

      for (let i = 0; i < profile.length; i++) {
        const above = profile[i].altitude >= 30;
        const x = timeToX(profile[i].time);

        if (above && !inWindow) {
          windowStart = x;
          inWindow = true;
        } else if (!above && inWindow) {
          // Draw bar
          ctx.fillStyle = color + "44";
          ctx.beginPath();
          ctx.roundRect(windowStart, y, x - windowStart, barHeight, 3);
          ctx.fill();

          ctx.strokeStyle = color + "88";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(windowStart, y, x - windowStart, barHeight, 3);
          ctx.stroke();

          inWindow = false;
        }
      }

      // Close any remaining window
      if (inWindow) {
        const x = timeToX(profile[profile.length - 1].time);
        ctx.fillStyle = color + "44";
        ctx.beginPath();
        ctx.roundRect(windowStart, y, x - windowStart, barHeight, 3);
        ctx.fill();

        ctx.strokeStyle = color + "88";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(windowStart, y, x - windowStart, barHeight, 3);
        ctx.stroke();
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

      // Tick
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + plotH);
      ctx.stroke();
    }

  }, [objects, darknessStart, darknessEnd, observer, maxObjects]);

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
