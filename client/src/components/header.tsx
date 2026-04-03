import { Logo } from "./logo";
import { formatLST, lstHours, dateToJD, KEW_GARDENS, astronomicalDarkness, formatTime } from "@/lib/astronomy";
import { MapPin, Moon, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  darknessWindow: { start: Date; end: Date } | null;
}

export function Header({ selectedDate, onDateChange, darknessWindow }: HeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  const jd = dateToJD(now);
  const currentLST = lstHours(jd, KEW_GARDENS.longitude);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split("-").map(Number);
      const newDate = new Date(Date.UTC(y, m - 1, d, 20, 0, 0)); // ~8pm UTC
      onDateChange(newDate);
    }
  };

  // Display date in UK timezone
  const ukDate = selectedDate.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const dateStr = ukDate;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between px-4 py-2.5 gap-4">
        {/* Left: Logo + title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Logo className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">DSO Planner</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">Deep-Sky Object Planner</p>
          </div>
        </div>

        {/* Center: Date picker + darkness window */}
        <div className="flex items-center gap-4 flex-1 justify-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="date-picker">Date:</label>
            <input
              id="date-picker"
              data-testid="input-date-picker"
              type="date"
              value={dateStr}
              onChange={handleDateChange}
              className="bg-muted border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {darknessWindow && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Moon className="w-3.5 h-3.5 text-violet-400" />
              <span>Darkness:</span>
              <span className="font-mono text-foreground">
                {formatTime(darknessWindow.start)} — {formatTime(darknessWindow.end)}
              </span>
            </div>
          )}
        </div>

        {/* Right: Location + LST + version */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>Kew Gardens, UK</span>
            <span className="font-mono text-[10px]">(51.48°N, 0.30°W)</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" data-testid="text-lst">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">LST</span>
            <span className="font-mono text-primary">{formatLST(currentLST)}</span>
          </div>
          <span
            className="font-mono text-[10px] text-muted-foreground/50"
            title={`Built ${new Date(__BUILD_DATE__).toLocaleString()}`}
          >
            v{new Date(__BUILD_DATE__).toISOString().slice(0, 10)}
          </span>
        </div>
      </div>
    </header>
  );
}
