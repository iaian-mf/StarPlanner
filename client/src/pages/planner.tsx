import { useState, useEffect, useMemo, useCallback } from "react";
import dsoCatalog from "@/data/dso-catalog.json";
import type { DSOObject, ScoredDSO } from "@/lib/types";
import { astronomicalDarkness, KEW_GARDENS } from "@/lib/astronomy";
import { scoreAllDSOs } from "@/lib/scoring";
import { Header } from "@/components/header";
import { DSOTable } from "@/components/dso-table";
import { DetailPanel } from "@/components/detail-panel";
import { Timeline } from "@/components/timeline";
import { ChevronDown, ChevronUp } from "lucide-react";

// Cast catalog data
const catalog = dsoCatalog as DSOObject[];

function getTonight(): Date {
  // We need UK local time to determine "tonight"
  // Use Europe/London timezone to get the current date in the UK
  const now = new Date();
  const ukDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); // YYYY-MM-DD format
  const ukHour = parseInt(now.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }));
  
  const [y, m, d] = ukDateStr.split('-').map(Number);
  
  // If before noon UK time, use "last night" (yesterday evening)
  if (ukHour < 12) {
    const yesterday = new Date(Date.UTC(y, m - 1, d - 1, 20, 0, 0)); // ~8pm UTC, ~9pm BST
    return yesterday;
  }
  return new Date(Date.UTC(y, m - 1, d, 20, 0, 0)); // ~8pm UTC, ~9pm BST
}

export default function PlannerPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(getTonight);
  const [selectedDSO, setSelectedDSO] = useState<ScoredDSO | null>(null);
  const [showTimeline, setShowTimeline] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Calculate darkness window for selected date
  const darknessWindow = useMemo(() => {
    return astronomicalDarkness(selectedDate, KEW_GARDENS);
  }, [selectedDate]);

  // Score all objects
  const scoredObjects = useMemo(() => {
    if (!darknessWindow) return [];

    // Use current time if "tonight", otherwise mid-darkness
    const now = new Date();
    const nowUK = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const selectedUK = selectedDate.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const isTonight = nowUK === selectedUK;

    // If it's tonight and current time is during darkness, use now
    // Otherwise use mid-darkness point
    const evalTime = (isTonight && now >= darknessWindow.start && now <= darknessWindow.end)
      ? now
      : new Date((darknessWindow.start.getTime() + darknessWindow.end.getTime()) / 2);

    return scoreAllDSOs(catalog, evalTime, darknessWindow.start, darknessWindow.end, KEW_GARDENS);
  }, [selectedDate, darknessWindow, currentTime]);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedDSO(null);
  }, []);

  const handleSelectDSO = useCallback((dso: ScoredDSO) => {
    setSelectedDSO(prev => prev?.id === dso.id ? null : dso);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden" data-testid="page-planner">
      <Header
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        darknessWindow={darknessWindow}
      />

      {/* Timeline section */}
      {darknessWindow && scoredObjects.length > 0 && (
        <div className="border-b border-border bg-card/50 shrink-0">
          <button
            data-testid="button-toggle-timeline"
            onClick={() => setShowTimeline(!showTimeline)}
            className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="uppercase tracking-wider text-[10px] font-medium">Visibility Timeline — Top Targets</span>
            {showTimeline ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showTimeline && (
            <div className="px-4 pb-2">
              <Timeline
                objects={scoredObjects}
                darknessStart={darknessWindow.start}
                darknessEnd={darknessWindow.end}
              />
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* DSO Table */}
        <div className={`flex-1 min-w-0 ${selectedDSO ? "" : ""}`}>
          <DSOTable
            objects={scoredObjects}
            selectedId={selectedDSO?.id ?? null}
            onSelect={handleSelectDSO}
          />
        </div>

        {/* Detail panel */}
        {selectedDSO && darknessWindow && (
          <div className="w-[360px] shrink-0">
            <DetailPanel
              dso={selectedDSO}
              darknessStart={darknessWindow.start}
              darknessEnd={darknessWindow.end}
              onClose={() => setSelectedDSO(null)}
            />
          </div>
        )}
      </div>

      {/* No darkness warning */}
      {!darknessWindow && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-amber-400 text-sm font-medium">No astronomical darkness on this date</p>
            <p className="text-muted-foreground text-xs">
              The sun doesn't get below -18° at this latitude. Try a date further from summer solstice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
