import type { ScoredDSO } from "@/lib/types";
import { AltitudeChart } from "./altitude-chart";
import { FOVDiagram } from "./fov-diagram";
import { formatRA, formatDec, formatTime } from "@/lib/astronomy";
import { getDSOTypeColor, getAltitudeColor, getScoreColor } from "@/lib/scoring";
import { X, Clock, ArrowUp, Moon, Telescope, Target, Star, Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DetailPanelProps {
  dso: ScoredDSO;
  darknessStart: Date;
  darknessEnd: Date;
  onClose: () => void;
}

export function DetailPanel({ dso, darknessStart, darknessEnd, onClose }: DetailPanelProps) {
  const typeColor = getDSOTypeColor(dso.type);
  const moonWarning = dso.moonPhase > 0.3 && dso.moonDistance < 30;
  const name = dso.commonName?.split(",")[0] || dso.displayId;

  return (
    <div
      className="border-l border-border bg-card h-full overflow-y-auto"
      data-testid="panel-detail"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-base font-semibold text-foreground">{dso.displayId}</h2>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColor}`}>
              {dso.type}
            </Badge>
          </div>
          {dso.commonName && (
            <p className="text-xs text-muted-foreground">{dso.commonName}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
          data-testid="button-close-detail"
          aria-label="Close detail panel"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Score */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Recommendation Score</span>
          <span className={`text-lg font-bold font-mono ${getScoreColor(dso.recommendationScore)}`}>
            {dso.recommendationScore}
          </span>
        </div>

        {/* Key stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            icon={<ArrowUp className="w-3.5 h-3.5" />}
            label="Current Alt"
            value={`${dso.currentAltitude.toFixed(1)}°`}
            valueClass={getAltitudeColor(dso.currentAltitude)}
          />
          <StatCard
            icon={<Target className="w-3.5 h-3.5" />}
            label="Max Alt"
            value={`${dso.transitAltitude.toFixed(1)}°`}
            valueClass="text-foreground"
          />
          <StatCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Transit"
            value={formatTime(dso.transitTime)}
            valueClass="text-primary"
          />
          <StatCard
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Hrs >30°"
            value={`${dso.hoursAbove30.toFixed(1)}h`}
            valueClass={dso.hoursAbove30 >= 2 ? "text-emerald-400" : "text-amber-400"}
          />
          <StatCard
            icon={<Star className="w-3.5 h-3.5" />}
            label="Magnitude"
            value={dso.magnitude != null ? dso.magnitude.toFixed(1) : "—"}
            valueClass="text-foreground"
          />
          <StatCard
            icon={<Telescope className="w-3.5 h-3.5" />}
            label="Size"
            value={`${dso.majAxis.toFixed(1)}' × ${dso.minAxis.toFixed(1)}'`}
            valueClass="text-foreground"
          />
        </div>

        {/* Moon warning */}
        {moonWarning && (
          <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/20">
            <Moon className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-400">
              Moon is {dso.moonDistance.toFixed(0)}° away ({(dso.moonPhase * 100).toFixed(0)}% illuminated)
            </p>
          </div>
        )}

        {/* Coordinates */}
        <div className="space-y-1">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Coordinates</h3>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">RA:</span>
              <span className="font-mono text-foreground">{dso.raHMS}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Dec:</span>
              <span className="font-mono text-foreground">{dso.decDMS}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Constellation: <span className="text-foreground">{dso.constellation}</span>
          </div>
        </div>

        {/* Altitude Chart */}
        <div className="space-y-1">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Altitude Tonight</h3>
          <div className="h-[160px] bg-background/50 rounded border border-border">
            <AltitudeChart dso={dso} darknessStart={darknessStart} darknessEnd={darknessEnd} />
          </div>
        </div>

        {/* FOV Framing */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Equipment Framing</h3>
          <div className="flex gap-3 justify-center">
            {dso.fovInfo.map((fov, i) => (
              <FOVDiagram key={i} fovInfo={fov} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, valueClass }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="bg-background/50 rounded px-2.5 py-2 border border-border">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-mono font-medium ${valueClass}`}>{value}</p>
    </div>
  );
}
