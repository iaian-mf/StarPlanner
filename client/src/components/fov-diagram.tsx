import type { FOVInfo } from "@/lib/types";

interface FOVDiagramProps {
  fovInfo: FOVInfo;
}

export function FOVDiagram({ fovInfo }: FOVDiagramProps) {
  const { equipment, fillPercent, framing, objectWidthDeg, objectHeightDeg } = fovInfo;

  // SVG dimensions
  const svgW = 160;
  const svgH = 107; // Aspect ratio of sensor
  const margin = 8;
  const fovW = svgW - margin * 2;
  const fovH = svgH - margin * 2;

  // Object size relative to FOV
  const objW = Math.min(fovW, (objectWidthDeg / equipment.fovWidth) * fovW);
  const objH = Math.min(fovH, (objectHeightDeg / equipment.fovHeight) * fovH);

  const framingColors = {
    "too-small": { fill: "rgba(245, 158, 11, 0.15)", stroke: "#f59e0b", text: "text-amber-400" },
    good: { fill: "rgba(6, 182, 212, 0.15)", stroke: "#06b6d4", text: "text-cyan-400" },
    excellent: { fill: "rgba(16, 185, 129, 0.15)", stroke: "#10b981", text: "text-emerald-400" },
    "too-large": { fill: "rgba(244, 63, 94, 0.15)", stroke: "#f43f5e", text: "text-rose-400" },
  };

  const colors = framingColors[framing];

  const framingLabel = {
    "too-small": "Small in FOV",
    good: "Good Fit",
    excellent: "Excellent Fit",
    "too-large": "Exceeds FOV",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`}>
        {/* FOV rectangle */}
        <rect
          x={margin}
          y={margin}
          width={fovW}
          height={fovH}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          rx="2"
        />
        {/* Object ellipse centered */}
        <ellipse
          cx={svgW / 2}
          cy={svgH / 2}
          rx={Math.max(2, objW / 2)}
          ry={Math.max(1.5, objH / 2)}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth="1.5"
          strokeDasharray={framing === "too-large" ? "3 2" : undefined}
        />
        {/* Crosshair */}
        <line x1={svgW / 2} y1={margin + 4} x2={svgW / 2} y2={svgH - margin - 4} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <line x1={margin + 4} y1={svgH / 2} x2={svgW - margin - 4} y2={svgH / 2} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
      </svg>
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{equipment.name}</p>
        <p className={`text-[10px] font-medium ${colors.text}`}>
          {framingLabel[framing]} ({fillPercent.toFixed(0)}%)
        </p>
      </div>
    </div>
  );
}
