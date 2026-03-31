export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="DSO Planner logo"
    >
      {/* Telescope aperture circle */}
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.5" />
      {/* Spider vanes */}
      <line x1="16" y1="5" x2="16" y2="27" stroke="currentColor" strokeWidth="1" />
      <line x1="5" y1="16" x2="27" y2="16" stroke="currentColor" strokeWidth="1" />
      {/* Central obstruction */}
      <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1" />
      {/* Star accent */}
      <circle cx="25" cy="7" r="2" fill="currentColor" />
      <line x1="25" y1="4" x2="25" y2="10" stroke="currentColor" strokeWidth="0.8" />
      <line x1="22" y1="7" x2="28" y2="7" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}
