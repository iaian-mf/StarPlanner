import { useState, useMemo } from "react";
import type { ScoredDSO, SortField, SortDirection, Filters } from "@/lib/types";
import { getDSOTypeColor, getAltitudeColor, getScoreColor } from "@/lib/scoring";
import { formatTime } from "@/lib/astronomy";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Eye, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

interface DSOTableProps {
  objects: ScoredDSO[];
  selectedId: string | null;
  onSelect: (dso: ScoredDSO) => void;
  pinnedIds: Set<string>;
  onTogglePin: (id: string) => void;
}

const DSO_TYPES = [
  "Galaxy",
  "Nebula",
  "Open Cluster",
  "Globular Cluster",
  "Planetary Nebula",
  "Cluster + Nebula",
  "Supernova Remnant",
  "HII Region",
  "Stellar Association",
];

// Rise azimuth via spherical trig: cos(A) = sin(δ) / cos(φ)
const KEW_LAT_RAD = 51.48 * Math.PI / 180;
function getRiseDirection(decDeg: number): string {
  const cosA = Math.sin(decDeg * Math.PI / 180) / Math.cos(KEW_LAT_RAD);
  if (cosA >= 1) return "N"; // circumpolar — always above horizon
  if (cosA <= -1) return "—"; // never rises above this latitude
  const azDeg = Math.acos(cosA) * 180 / Math.PI;
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(azDeg / 22.5) % 16];
}

export function DSOTable({ objects, selectedId, onSelect, pinnedIds, onTogglePin }: DSOTableProps) {
  const [sortField, setSortField] = useState<SortField>("recommendationScore");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [filters, setFilters] = useState<Filters>({
    types: [],
    minAltitude: 0,
    minAngularSize: 0,
    searchQuery: "",
    currentlyVisible: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "displayId" || field === "commonName" || field === "type" || field === "constellation" ? "asc" : "desc");
    }
  };

  const toggleTypeFilter = (type: string) => {
    setFilters(f => ({
      ...f,
      types: f.types.includes(type)
        ? f.types.filter(t => t !== type)
        : [...f.types, type],
    }));
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...objects];

    // Apply filters
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      list = list.filter(d =>
        d.displayId.toLowerCase().includes(q) ||
        (d.commonName?.toLowerCase().includes(q)) ||
        d.constellation.toLowerCase().includes(q) ||
        (d.messier?.toLowerCase().includes(q))
      );
    }

    if (filters.types.length > 0) {
      list = list.filter(d => filters.types.includes(d.type));
    }

    if (filters.minAltitude > 0) {
      list = list.filter(d => d.currentAltitude >= filters.minAltitude);
    }

    if (filters.minAngularSize > 0) {
      list = list.filter(d => d.majAxis >= filters.minAngularSize);
    }

    if (filters.currentlyVisible) {
      list = list.filter(d => d.currentAltitude > 0);
    }

    // Sort
    list.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "displayId":
          aVal = a.displayId; bVal = b.displayId;
          return sortDir === "asc"
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal as string);
        case "commonName":
          aVal = a.commonName || ""; bVal = b.commonName || "";
          return sortDir === "asc"
            ? (aVal as string).localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal as string);
        case "type":
          aVal = a.type; bVal = b.type;
          return sortDir === "asc"
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal as string);
        case "constellation":
          aVal = a.constellation; bVal = b.constellation;
          return sortDir === "asc"
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal as string);
        case "transitTime":
          aVal = a.transitTime.getTime(); bVal = b.transitTime.getTime();
          break;
        default:
          aVal = (a as any)[sortField] ?? 0;
          bVal = (b as any)[sortField] ?? 0;
      }

      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [objects, filters, sortField, sortDir]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const hasActiveFilters = filters.types.length > 0 || filters.minAltitude > 0 || filters.minAngularSize > 0 || filters.currentlyVisible;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search objects..."
            value={filters.searchQuery}
            onChange={e => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
            className="pl-8 h-7 text-xs bg-background border-border"
          />
        </div>

        <button
          data-testid="button-toggle-filters"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors border ${
            showFilters || hasActiveFilters
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
              {(filters.types.length > 0 ? 1 : 0) + (filters.minAltitude > 0 ? 1 : 0) + (filters.minAngularSize > 0 ? 1 : 0) + (filters.currentlyVisible ? 1 : 0)}
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <label className="text-[11px] text-muted-foreground cursor-pointer flex items-center gap-1.5" htmlFor="visible-toggle">
            <Eye className="w-3.5 h-3.5" />
            Visible only
          </label>
          <Switch
            id="visible-toggle"
            data-testid="switch-visible-only"
            checked={filters.currentlyVisible}
            onCheckedChange={v => setFilters(f => ({ ...f, currentlyVisible: v }))}
            className="scale-75"
          />
        </div>

        <span className="text-[11px] text-muted-foreground tabular-nums">
          {filteredAndSorted.length} objects
        </span>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="px-3 py-2.5 border-b border-border bg-card/50 space-y-2.5 shrink-0" data-testid="panel-filters">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Object Type</span>
            <div className="flex flex-wrap gap-1">
              {DSO_TYPES.map(type => (
                <button
                  key={type}
                  data-testid={`button-type-${type.replace(/\s+/g, "-").toLowerCase()}`}
                  onClick={() => toggleTypeFilter(type)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    filters.types.includes(type)
                      ? getDSOTypeColor(type) + " border-current"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-muted-foreground flex items-center justify-between mb-1">
                Min Altitude
                <span className="font-mono">{filters.minAltitude}°</span>
              </span>
              <Slider
                data-testid="slider-min-altitude"
                value={[filters.minAltitude]}
                onValueChange={([v]) => setFilters(f => ({ ...f, minAltitude: v }))}
                min={0}
                max={60}
                step={5}
                className="w-full"
              />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground flex items-center justify-between mb-1">
                Min Size
                <span className="font-mono">{filters.minAngularSize}'</span>
              </span>
              <Slider
                data-testid="slider-min-size"
                value={[filters.minAngularSize]}
                onValueChange={([v]) => setFilters(f => ({ ...f, minAngularSize: v }))}
                min={0}
                max={60}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              <th className="px-2 py-1.5 w-7" title="Pin to timeline" />
              <Th field="recommendationScore" label="Score" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="center" />
              <Th field="displayId" label="Object" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <Th field="commonName" label="Name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <Th field="type" label="Type" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              <Th field="majAxis" label="Size" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right" />
              <Th field="magnitude" label="Mag" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right" />
              <Th field="currentAltitude" label="Alt" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right" />
              <Th field="transitTime" label="Transit" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right" />
              <Th field="transitAltitude" label="Max Alt" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right" />
              <th className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground text-center">Rises</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map(dso => (
              <tr
                key={dso.id}
                data-testid={`row-dso-${dso.id}`}
                onClick={() => onSelect(dso)}
                className={`border-b border-border/50 cursor-pointer transition-colors ${
                  selectedId === dso.id
                    ? "bg-primary/5"
                    : "hover:bg-muted/40"
                }`}
              >
                {/* Pin toggle */}
                <td className="px-2 py-1.5 w-7">
                  <button
                    onClick={e => { e.stopPropagation(); onTogglePin(dso.id); }}
                    title={pinnedIds.has(dso.id) ? "Remove from timeline" : "Add to timeline"}
                    className="w-3.5 h-3.5 rounded-full border transition-colors flex-shrink-0"
                    style={{
                      background: pinnedIds.has(dso.id) ? "#f59e0b" : "transparent",
                      borderColor: pinnedIds.has(dso.id) ? "#f59e0b" : "rgba(255,255,255,0.2)",
                    }}
                  />
                </td>

                {/* Score */}
                <td className="px-2 py-1.5 text-center">
                  <span className={`font-mono font-bold text-sm ${getScoreColor(dso.recommendationScore)}`}>
                    {dso.recommendationScore}
                  </span>
                </td>

                {/* Object ID */}
                <td className="px-2 py-1.5">
                  <span className="font-mono font-medium text-foreground">{dso.displayId}</span>
                </td>

                {/* Name */}
                <td className="px-2 py-1.5 max-w-[140px]">
                  <span className="text-muted-foreground truncate block">
                    {dso.commonName?.split(",")[0] || "—"}
                  </span>
                </td>

                {/* Type */}
                <td className="px-2 py-1.5">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-normal whitespace-nowrap ${getDSOTypeColor(dso.type)}`}>
                    {dso.type}
                  </Badge>
                </td>

                {/* Size */}
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {dso.majAxis.toFixed(1)}'
                </td>

                {/* Magnitude */}
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {dso.magnitude != null ? dso.magnitude.toFixed(1) : "—"}
                </td>

                {/* Current Altitude */}
                <td className="px-2 py-1.5 text-right">
                  <span className={`font-mono font-medium ${getAltitudeColor(dso.currentAltitude)}`}>
                    {dso.currentAltitude > 0 ? `${dso.currentAltitude.toFixed(1)}°` : "—"}
                  </span>
                </td>

                {/* Transit */}
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {formatTime(dso.transitTime)}
                </td>

                {/* Max Alt */}
                <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                  {dso.transitAltitude.toFixed(1)}°
                </td>

                {/* Rise compass direction */}
                <td className="px-2 py-1.5 text-center font-mono text-muted-foreground">
                  {getRiseDirection(dso.dec)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSorted.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No objects match the current filters
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ field, label, sortField, sortDir, onSort, align = "left" }: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDirection;
  onSort: (field: SortField) => void;
  align?: "left" | "right" | "center";
}) {
  const isActive = sortField === field;
  const alignClass = align === "right" ? "text-right justify-end" : align === "center" ? "text-center justify-center" : "text-left";

  return (
    <th
      className={`px-2 py-1.5 text-[10px] uppercase tracking-wider font-medium cursor-pointer select-none transition-colors hover:text-foreground ${
        isActive ? "text-primary" : "text-muted-foreground"
      }`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        <span>{label}</span>
        {isActive ? (
          sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
        )}
      </div>
    </th>
  );
}
