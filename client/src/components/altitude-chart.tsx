import { useRef, useEffect } from "react";
import { altitudeProfile, KEW_GARDENS, formatTime, type Observer } from "@/lib/astronomy";
import type { ScoredDSO } from "@/lib/types";

interface AltitudeChartProps {
  dso: ScoredDSO;
  darknessStart: Date;
  darknessEnd: Date;
  observer?: Observer;
}

export function AltitudeChart({ dso, darknessStart, darknessEnd, observer = KEW_GARDENS }: AltitudeChartProps) {
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
    const padding = { top: 20, right: 16, bottom: 28, left: 40 };
    const plotW = w - padding.left - padding.right;
    const plotH = h - padding.top - padding.bottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Time range: 6pm to 6am (12 hours centered on midnight)
    const midnight = new Date(darknessStart);
    midnight.setHours(24, 0, 0, 0);
    const startTime = new Date(midnight.getTime() - 6 * 3600000);
    const endTime = new Date(midnight.getTime() + 6 * 3600000);

    const timeToX = (t: Date) => {
      const frac = (t.getTime() - startTime.getTime()) / (endTime.getTime() - startTime.getTime());
      return padding.left + frac * plotW;
    };

    const altToY = (alt: number) => {
      const frac = Math.max(0, Math.min(1, alt / 90));
      return padding.top + plotH * (1 - frac);
    };

    // Draw darkness window
    const dkStartX = timeToX(darknessStart);
    const dkEndX = timeToX(darknessEnd);
    ctx.fillStyle = "rgba(99, 102, 241, 0.08)";
    ctx.fillRect(dkStartX, padding.top, dkEndX - dkStartX, plotH);

    // Draw 30° threshold
    ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, altToY(30));
    ctx.lineTo(padding.left + plotW, altToY(30));
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw 30° label
    ctx.fillStyle = "rgba(245, 158, 11, 0.5)";
    ctx.font = "9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("30°", padding.left + 4, altToY(30) - 3);

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.5;
    for (let alt = 0; alt <= 90; alt += 15) {
      ctx.beginPath();
      ctx.moveTo(padding.left, altToY(alt));
      ctx.lineTo(padding.left + plotW, altToY(alt));
      ctx.stroke();
    }

    // Draw altitude profile
    const profile = altitudeProfile(startTime, endTime, dso.ra, dso.dec, observer, 5);

    // Fill area under curve
    ctx.beginPath();
    ctx.moveTo(timeToX(profile[0].time), altToY(0));
    for (const p of profile) {
      const x = timeToX(p.time);
      const y = altToY(Math.max(0, p.altitude));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(timeToX(profile[profile.length - 1].time), altToY(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
    grad.addColorStop(0, "rgba(6, 182, 212, 0.25)");
    grad.addColorStop(1, "rgba(6, 182, 212, 0.02)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2;
    for (let i = 0; i < profile.length; i++) {
      const x = timeToX(profile[i].time);
      const y = altToY(Math.max(0, profile[i].altitude));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mark transit
    const transitX = timeToX(dso.transitTime);
    if (transitX >= padding.left && transitX <= padding.left + plotW) {
      ctx.strokeStyle = "rgba(34, 211, 238, 0.5)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(transitX, padding.top);
      ctx.lineTo(transitX, padding.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#22d3ee";
      ctx.font = "9px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Transit", transitX, padding.top - 5);
    }

    // Y-axis labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    for (let alt = 0; alt <= 90; alt += 30) {
      ctx.fillText(`${alt}°`, padding.left - 6, altToY(alt) + 3);
    }

    // X-axis time labels
    ctx.textAlign = "center";
    for (let hr = -6; hr <= 6; hr += 2) {
      const t = new Date(midnight.getTime() + hr * 3600000);
      const x = timeToX(t);
      ctx.fillText(formatTime(t), x, padding.top + plotH + 14);
    }

    // Bottom axis line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.stroke();

  }, [dso, darknessStart, darknessEnd, observer]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
      data-testid="canvas-altitude-chart"
    />
  );
}
