// All astronomical calculations for DSO Planner
// Pure math — no external dependencies needed

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const HOURS_TO_DEG = 15; // 1 hour of RA = 15 degrees

export interface Observer {
  latitude: number;  // degrees
  longitude: number; // degrees (west is negative)
}

export const KEW_GARDENS: Observer = {
  latitude: 51.4787,
  longitude: -0.2955,
};

export interface AltAz {
  altitude: number;  // degrees
  azimuth: number;   // degrees (0=N, 90=E, 180=S, 270=W)
}

/**
 * Convert a JS Date to Julian Date
 */
export function dateToJD(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  const h = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  let Y = y;
  let M = m;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }

  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + h / 24 + B - 1524.5;
}

/**
 * Greenwich Mean Sidereal Time in degrees
 */
export function gmst(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  let theta = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000.0;
  theta = ((theta % 360) + 360) % 360;
  return theta;
}

/**
 * Local Sidereal Time in degrees
 */
export function lst(jd: number, longitude: number): number {
  const g = gmst(jd);
  return ((g + longitude) % 360 + 360) % 360;
}

/**
 * Local Sidereal Time in hours
 */
export function lstHours(jd: number, longitude: number): number {
  return lst(jd, longitude) / 15;
}

/**
 * Hour Angle in degrees
 * @param lstDeg Local sidereal time in degrees
 * @param raDeg Right ascension in degrees
 */
export function hourAngle(lstDeg: number, raDeg: number): number {
  let ha = lstDeg - raDeg;
  // Normalize to -180..+180
  while (ha < -180) ha += 360;
  while (ha > 180) ha -= 360;
  return ha;
}

/**
 * Convert RA in decimal hours to degrees
 */
export function raHoursToDeg(raHours: number): number {
  return raHours * HOURS_TO_DEG;
}

/**
 * Compute altitude and azimuth from hour angle, declination, and observer latitude
 */
export function altAz(haDeg: number, decDeg: number, latDeg: number): AltAz {
  const ha = haDeg * DEG_TO_RAD;
  const dec = decDeg * DEG_TO_RAD;
  const lat = latDeg * DEG_TO_RAD;

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const altitude = Math.asin(sinAlt) * RAD_TO_DEG;

  const cosAlt = Math.cos(altitude * DEG_TO_RAD);
  let azimuth: number;
  if (cosAlt === 0) {
    azimuth = 0;
  } else {
    const cosA = (Math.sin(dec) - Math.sin(lat) * sinAlt) / (Math.cos(lat) * cosAlt);
    azimuth = Math.acos(Math.max(-1, Math.min(1, cosA))) * RAD_TO_DEG;
    if (Math.sin(ha) > 0) {
      azimuth = 360 - azimuth;
    }
  }

  return { altitude, azimuth };
}

/**
 * Get the current altitude of an object
 */
export function objectAltitude(date: Date, raHours: number, decDeg: number, observer: Observer): number {
  const jd = dateToJD(date);
  const lstDeg = lst(jd, observer.longitude);
  const raDeg = raHoursToDeg(raHours);
  const ha = hourAngle(lstDeg, raDeg);
  return altAz(ha, decDeg, observer.latitude).altitude;
}

/**
 * Get altitude and azimuth of an object at a given time
 */
export function objectAltAz(date: Date, raHours: number, decDeg: number, observer: Observer): AltAz {
  const jd = dateToJD(date);
  const lstDeg = lst(jd, observer.longitude);
  const raDeg = raHoursToDeg(raHours);
  const ha = hourAngle(lstDeg, raDeg);
  return altAz(ha, decDeg, observer.latitude);
}

/**
 * Maximum altitude an object can reach (when it transits the meridian)
 */
export function maxAltitude(decDeg: number, latDeg: number): number {
  // Object transits when HA = 0
  // At transit: alt = 90 - |lat - dec|
  if (decDeg >= latDeg) {
    return 90 - (decDeg - latDeg);
  } else {
    return 90 - (latDeg - decDeg);
  }
}

/**
 * Find the transit time (when HA = 0, object at highest point)
 * Returns the transit time closest to the reference date
 */
export function transitTime(date: Date, raHours: number, observer: Observer): Date {
  const jd = dateToJD(date);
  const lstDeg = lst(jd, observer.longitude);
  const raDeg = raHoursToDeg(raHours);

  // Hour angle at the reference time
  let ha = lstDeg - raDeg;
  // We want HA = 0, so we need to go back by HA (in sidereal time)
  // Sidereal rate is ~360.985647 deg/day vs solar 360 deg/day
  // Convert HA to solar hours: HA_deg / 15 * (solar_day / sidereal_day)
  const solarToSidereal = 1.00273790935;
  let hoursToTransit = -ha / (15 * solarToSidereal);

  // Normalize to within ±12 hours
  while (hoursToTransit < -12) hoursToTransit += 24 / solarToSidereal;
  while (hoursToTransit > 12) hoursToTransit -= 24 / solarToSidereal;

  return new Date(date.getTime() + hoursToTransit * 3600000);
}

/**
 * Find rise and set times for an object (when altitude = horizonAlt)
 * Returns null if object is circumpolar or never rises
 */
export function riseSetTimes(
  date: Date,
  raHours: number,
  decDeg: number,
  observer: Observer,
  horizonAlt: number = 0
): { rise: Date; set: Date } | null {
  const dec = decDeg * DEG_TO_RAD;
  const lat = observer.latitude * DEG_TO_RAD;
  const h0 = horizonAlt * DEG_TO_RAD;

  const cosH = (Math.sin(h0) - Math.sin(lat) * Math.sin(dec)) / (Math.cos(lat) * Math.cos(dec));

  if (cosH < -1) return null; // Circumpolar - always above horizon
  if (cosH > 1) return null;  // Never rises

  const H = Math.acos(cosH) * RAD_TO_DEG; // Hour angle at rise/set in degrees

  const transit = transitTime(date, raHours, observer);
  const hoursFromTransit = H / 15 / 1.00273790935;

  return {
    rise: new Date(transit.getTime() - hoursFromTransit * 3600000),
    set: new Date(transit.getTime() + hoursFromTransit * 3600000),
  };
}

/**
 * Compute altitude profile over a time range
 * Returns array of {time, altitude} at given interval
 */
export function altitudeProfile(
  startTime: Date,
  endTime: Date,
  raHours: number,
  decDeg: number,
  observer: Observer,
  intervalMinutes: number = 10
): Array<{ time: Date; altitude: number }> {
  const profile: Array<{ time: Date; altitude: number }> = [];
  const startMs = startTime.getTime();
  const endMs = endTime.getTime();
  const intervalMs = intervalMinutes * 60000;

  for (let ms = startMs; ms <= endMs; ms += intervalMs) {
    const time = new Date(ms);
    const alt = objectAltitude(time, raHours, decDeg, observer);
    profile.push({ time, altitude: alt });
  }

  return profile;
}

/**
 * Calculate hours an object is above a given altitude within a time range
 */
export function hoursAboveAltitude(
  startTime: Date,
  endTime: Date,
  raHours: number,
  decDeg: number,
  observer: Observer,
  minAlt: number = 30,
  intervalMinutes: number = 5
): number {
  const profile = altitudeProfile(startTime, endTime, raHours, decDeg, observer, intervalMinutes);
  const aboveCount = profile.filter(p => p.altitude >= minAlt).length;
  return (aboveCount * intervalMinutes) / 60;
}

// ---- Sun calculations for astronomical darkness ----

/**
 * Approximate solar coordinates
 * Returns RA in hours and Dec in degrees
 */
export function sunPosition(jd: number): { ra: number; dec: number } {
  const T = (jd - 2451545.0) / 36525.0;
  // Mean longitude
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
  // Mean anomaly
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360;
  const MRad = M * DEG_TO_RAD;

  // Equation of center
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(MRad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * MRad)
    + 0.000289 * Math.sin(3 * MRad);

  // Sun's true longitude
  const sunLon = (L0 + C) * DEG_TO_RAD;

  // Obliquity of ecliptic
  const eps = (23.439291 - 0.0130042 * T) * DEG_TO_RAD;

  // RA and Dec
  const ra = Math.atan2(Math.cos(eps) * Math.sin(sunLon), Math.cos(sunLon)) * RAD_TO_DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(sunLon)) * RAD_TO_DEG;

  return { ra: ((ra + 360) % 360) / 15, dec };
}

/**
 * Sun altitude at a given time and location
 */
export function sunAltitude(date: Date, observer: Observer): number {
  const jd = dateToJD(date);
  const sun = sunPosition(jd);
  return objectAltitude(date, sun.ra, sun.dec, observer);
}

/**
 * Find astronomical darkness window for a given night
 * Sun below -18 degrees
 * Returns start/end of darkness
 */
export function astronomicalDarkness(
  date: Date,
  observer: Observer
): { start: Date; end: Date } | null {
  // Start searching from noon of the given date
  const noon = new Date(date);
  noon.setUTCHours(12, 0, 0, 0);

  let darkStart: Date | null = null;
  let darkEnd: Date | null = null;

  // Scan from noon to noon+24h in 5-minute increments
  for (let m = 0; m <= 24 * 60; m += 5) {
    const t = new Date(noon.getTime() + m * 60000);
    const alt = sunAltitude(t, observer);

    if (alt < -18) {
      if (!darkStart) darkStart = t;
      darkEnd = t;
    } else if (darkStart && darkEnd) {
      // Sun has risen back above -18, we found the window
      break;
    }
  }

  // Refine start time
  if (darkStart) {
    const roughStart = new Date(darkStart.getTime() - 5 * 60000);
    for (let m = 0; m <= 10; m++) {
      const t = new Date(roughStart.getTime() + m * 60000);
      if (sunAltitude(t, observer) < -18) {
        darkStart = t;
        break;
      }
    }
  }

  // Refine end time
  if (darkEnd) {
    for (let m = 0; m <= 10; m++) {
      const t = new Date(darkEnd.getTime() + m * 60000);
      if (sunAltitude(t, observer) >= -18) {
        darkEnd = t;
        break;
      }
    }
  }

  if (darkStart && darkEnd) {
    return { start: darkStart, end: darkEnd };
  }

  return null;
}

// ---- Moon calculations ----

/**
 * Approximate moon position (low-precision, good enough for proximity warnings)
 * Returns RA in hours and Dec in degrees
 */
export function moonPosition(jd: number): { ra: number; dec: number; phase: number } {
  const T = (jd - 2451545.0) / 36525.0;

  // Moon's mean longitude
  const L = (218.3165 + 481267.8813 * T) % 360;
  // Moon's mean anomaly
  const M = (134.9634 + 477198.8676 * T) % 360;
  // Moon's mean elongation
  const D = (297.8502 + 445267.1115 * T) % 360;
  // Moon's argument of latitude
  const F = (93.2720 + 483202.0175 * T) % 360;

  const LRad = L * DEG_TO_RAD;
  const MRad = M * DEG_TO_RAD;
  const DRad = D * DEG_TO_RAD;
  const FRad = F * DEG_TO_RAD;

  // Simplified longitude
  const lon = L
    + 6.289 * Math.sin(MRad)
    - 1.274 * Math.sin(2 * DRad - MRad)
    + 0.658 * Math.sin(2 * DRad)
    + 0.214 * Math.sin(2 * MRad)
    - 0.186 * Math.sin((357.5291 + 35999.0503 * T) * DEG_TO_RAD)
    - 0.114 * Math.sin(2 * FRad);

  const lat = 5.128 * Math.sin(FRad)
    + 0.281 * Math.sin((MRad + LRad))
    - 0.178 * Math.sin(LRad - MRad);

  const lonRad = lon * DEG_TO_RAD;
  const latRad = lat * DEG_TO_RAD;
  const eps = (23.439291 - 0.0130042 * T) * DEG_TO_RAD;

  // Convert ecliptic to equatorial
  const ra = Math.atan2(
    Math.sin(lonRad) * Math.cos(eps) - Math.tan(latRad) * Math.sin(eps),
    Math.cos(lonRad)
  ) * RAD_TO_DEG;

  const dec = Math.asin(
    Math.sin(latRad) * Math.cos(eps) + Math.cos(latRad) * Math.sin(eps) * Math.sin(lonRad)
  ) * RAD_TO_DEG;

  // Phase angle (simplified) — 0 = new moon, 0.5 = full moon
  const phase = (1 - Math.cos(DRad)) / 2;

  return { ra: ((ra + 360) % 360) / 15, dec, phase };
}

/**
 * Angular separation between two celestial objects in degrees
 */
export function angularSeparation(
  ra1Hours: number, dec1Deg: number,
  ra2Hours: number, dec2Deg: number
): number {
  const ra1 = ra1Hours * 15 * DEG_TO_RAD;
  const dec1 = dec1Deg * DEG_TO_RAD;
  const ra2 = ra2Hours * 15 * DEG_TO_RAD;
  const dec2 = dec2Deg * DEG_TO_RAD;

  const cosSep = Math.sin(dec1) * Math.sin(dec2)
    + Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2);

  return Math.acos(Math.max(-1, Math.min(1, cosSep))) * RAD_TO_DEG;
}

/**
 * Moon distance from a DSO object at a given time
 */
export function moonSeparation(date: Date, raHours: number, decDeg: number): { separation: number; moonPhase: number } {
  const jd = dateToJD(date);
  const moon = moonPosition(jd);
  const sep = angularSeparation(raHours, decDeg, moon.ra, moon.dec);
  return { separation: sep, moonPhase: moon.phase };
}

// ---- Formatting helpers ----

export function formatRA(raHours: number): string {
  const h = Math.floor(raHours);
  const mFrac = (raHours - h) * 60;
  const m = Math.floor(mFrac);
  const s = (mFrac - m) * 60;
  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toFixed(0).padStart(2, '0')}s`;
}

export function formatDec(decDeg: number): string {
  const sign = decDeg >= 0 ? '+' : '-';
  const abs = Math.abs(decDeg);
  const d = Math.floor(abs);
  const mFrac = (abs - d) * 60;
  const m = Math.floor(mFrac);
  const s = (mFrac - m) * 60;
  return `${sign}${d}° ${m.toString().padStart(2, '0')}' ${s.toFixed(0).padStart(2, '0')}"`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });
}

export function formatLST(lstHours: number): string {
  const h = Math.floor(lstHours);
  const m = Math.floor((lstHours - h) * 60);
  const s = Math.floor(((lstHours - h) * 60 - m) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
