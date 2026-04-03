import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import dsoCatalog from "@/data/dso-catalog.json";
import type { DSOObject, ScoredDSO } from "@/lib/types";
import { astronomicalDarkness, sunAltitude, KEW_GARDENS, type Observer } from "@/lib/astronomy";
import { scoreAllDSOs } from "@/lib/scoring";
import { Header } from "@/components/header";
import { DSOTable } from "@/components/dso-table";
import { DetailPanel } from "@/components/detail-panel";
import { Timeline } from "@/components/timeline";
import { WeatherTimeline } from "@/components/weather-timeline";
import { ChevronDown, ChevronUp } from "lucide-react";

interface WeatherData {
  times: string[];
  cloudcover: number[];
  precipitation: number[];
}

// Cast catalog data
const catalog = dsoCatalog as DSOObject[];

/** Find the sunset and sunrise bracketing the given night using 10-min sampling. */
function findSunriseSunset(date: Date, observer: Observer): { sunset: Date; sunrise: Date } {
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));

  let sunset = new Date(base.getTime() + 6 * 3600000);
  let prev = sunAltitude(base, observer);
  for (let m = 10; m <= 12 * 60; m += 10) {
    const t = new Date(base.getTime() + m * 60000);
    const alt = sunAltitude(t, observer);
    if (prev >= 0 && alt < 0) { sunset = t; break; }
    prev = alt;
  }

  const midnight = new Date(base.getTime() + 12 * 3600000);
  let sunrise = new Date(midnight.getTime() + 6 * 3600000);
  prev = sunAltitude(midnight, observer);
  for (let m = 10; m <= 12 * 60; m += 10) {
    const t = new Date(midnight.getTime() + m * 60000);
    const alt = sunAltitude(t, observer);
    if (prev < 0 && alt >= 0) { sunrise = t; break; }
    prev = alt;
  }

  return { sunset, sunrise };
}

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
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const lastDateRef = useRef<string>("");

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch cloud cover from Open-Meteo, at most once every 30 minutes
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=51.48&longitude=-0.30&hourly=cloudcover,precipitation&timezone=UTC&forecast_days=3"
        );
        const json = await res.json();
        setWeatherData({ times: json.hourly.time, cloudcover: json.hourly.cloudcover, precipitation: json.hourly.precipitation });
      } catch {
        // silently fail — weather is optional
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate darkness window for selected date
  const darknessWindow = useMemo(() => {
    return astronomicalDarkness(selectedDate, KEW_GARDENS);
  }, [selectedDate]);

  // Sunset/sunrise bracket for the timeline X axis
  const sunriseSunset = useMemo(() => findSunriseSunset(selectedDate, KEW_GARDENS), [selectedDate]);

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

  // Reset pinned objects to top 3 when the selected date changes
  useEffect(() => {
    const dateKey = selectedDate.toISOString().slice(0, 10);
    if (dateKey !== lastDateRef.current && scoredObjects.length > 0) {
      lastDateRef.current = dateKey;
      setPinnedIds(new Set(scoredObjects.slice(0, 3).map(d => d.id)));
    }
  }, [selectedDate, scoredObjects]);

  const pinnedObjects = useMemo(
    () => scoredObjects.filter(d => pinnedIds.has(d.id)),
    [scoredObjects, pinnedIds]
  );

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedDSO(null);
  }, []);

  const handleSelectDSO = useCallback((dso: ScoredDSO) => {
    setSelectedDSO(prev => prev?.id === dso.id ? null : dso);
  }, []);

  const handleTogglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
            <div className="px-4 pb-2 space-y-1">
              {weatherData && (
                <>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider pt-1">Cloud Cover</p>
                  <WeatherTimeline
                    times={weatherData.times}
                    cloudcover={weatherData.cloudcover}
                    precipitation={weatherData.precipitation}
                    timelineStart={sunriseSunset.sunset}
                    timelineEnd={sunriseSunset.sunrise}
                    darknessStart={darknessWindow.start}
                    darknessEnd={darknessWindow.end}
                  />
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider pt-1">Object Visibility</p>
                </>
              )}
              <Timeline
                objects={pinnedObjects}
                timelineStart={sunriseSunset.sunset}
                timelineEnd={sunriseSunset.sunrise}
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
            pinnedIds={pinnedIds}
            onTogglePin={handleTogglePin}
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
