import type { DSOObject, ScoredDSO, Equipment, FOVInfo } from "./types";
import {
  objectAltitude,
  transitTime,
  hoursAboveAltitude,
  moonSeparation,
  KEW_GARDENS,
  type Observer,
} from "./astronomy";

/**
 * Equipment definitions
 */
export const EQUIPMENT: Equipment[] = [
  {
    name: "Askar 80ED + ASI2600 Duo",
    focalLength: 560,
    sensorWidth: 23.5,
    sensorHeight: 15.7,
    fovWidth: 2.41,
    fovHeight: 1.61,
  },
  {
    name: "Seestar S50",
    focalLength: 250,
    sensorWidth: 5.6,
    sensorHeight: 3.2,
    fovWidth: 1.29,
    fovHeight: 0.73,
  },
];

/**
 * Calculate FOV info for a DSO with a given equipment
 */
export function calculateFOV(dso: DSOObject, equipment: Equipment): FOVInfo {
  const objWidthDeg = (dso.majAxis || 0) / 60;
  const objHeightDeg = (dso.minAxis || 0) / 60;

  const fillWidth = objWidthDeg / equipment.fovWidth;
  const fillHeight = objHeightDeg / equipment.fovHeight;
  const fillPercent = Math.max(fillWidth, fillHeight) * 100;

  // Good framing: object fills 20-80% of FOV
  let framing: "too-small" | "good" | "too-large" | "excellent";
  if (fillPercent < 10) {
    framing = "too-small";
  } else if (fillPercent <= 30) {
    framing = "good";
  } else if (fillPercent <= 70) {
    framing = "excellent";
  } else if (fillPercent <= 100) {
    framing = "good";
  } else {
    framing = "too-large";
  }

  return {
    equipment,
    fillPercent,
    framing,
    objectWidthDeg: objWidthDeg,
    objectHeightDeg: objHeightDeg,
  };
}

/**
 * Score a DSO for a given date/time and observer
 */
export function scoreDSO(
  dso: DSOObject,
  dateTime: Date,
  darknessStart: Date,
  darknessEnd: Date,
  observer: Observer = KEW_GARDENS
): ScoredDSO {
  const currentAlt = objectAltitude(dateTime, dso.ra, dso.dec, observer);
  const transit = transitTime(dateTime, dso.ra, observer);
  const transitAlt = objectAltitude(transit, dso.ra, dso.dec, observer);

  // Hours remaining above 30° from now until darkness end
  const hoursAbove30 = hoursAboveAltitude(
    dateTime,
    darknessEnd,
    dso.ra,
    dso.dec,
    observer,
    30,
    5
  );

  // Moon proximity
  const { separation: moonDist, moonPhase } = moonSeparation(dateTime, dso.ra, dso.dec);

  // --- Scoring algorithm ---
  let score = 0;

  // 1. Current altitude score (0-30 points)
  if (currentAlt >= 60) {
    score += 30;
  } else if (currentAlt >= 45) {
    score += 25;
  } else if (currentAlt >= 30) {
    score += 20;
  } else if (currentAlt >= 20) {
    score += 12;
  } else if (currentAlt >= 10) {
    score += 5;
  } else if (currentAlt > 0) {
    score += 1;
  }

  // 2. Angular size score (0-25 points)
  const majAxis = dso.majAxis || 0;
  if (majAxis >= 30) {
    score += 25;
  } else if (majAxis >= 15) {
    score += 20;
  } else if (majAxis >= 8) {
    score += 15;
  } else if (majAxis >= 4) {
    score += 10;
  } else if (majAxis >= 2) {
    score += 6;
  } else {
    score += 2;
  }

  // 3. Hours above 30° score (0-20 points)
  if (hoursAbove30 >= 4) {
    score += 20;
  } else if (hoursAbove30 >= 3) {
    score += 16;
  } else if (hoursAbove30 >= 2) {
    score += 12;
  } else if (hoursAbove30 >= 1) {
    score += 8;
  } else if (hoursAbove30 > 0) {
    score += 3;
  }

  // 4. Magnitude score (0-15 points) — brighter = higher score
  const mag = dso.magnitude || 12;
  if (mag <= 4) {
    score += 15;
  } else if (mag <= 6) {
    score += 12;
  } else if (mag <= 8) {
    score += 9;
  } else if (mag <= 10) {
    score += 6;
  } else {
    score += 3;
  }

  // 5. Transit bonus (0-10 points) — near transit = bonus
  const hoursFromTransit = Math.abs(transit.getTime() - dateTime.getTime()) / 3600000;
  if (hoursFromTransit < 0.5) {
    score += 10;
  } else if (hoursFromTransit < 1) {
    score += 8;
  } else if (hoursFromTransit < 2) {
    score += 5;
  } else if (hoursFromTransit < 3) {
    score += 2;
  }

  // Moon penalty: if moon is bright and close, reduce score
  const moonPenalty = moonPhase > 0.3 && moonDist < 30
    ? Math.round((0.3 - (moonDist / 100)) * 20 * moonPhase)
    : 0;
  score = Math.max(0, score - Math.max(0, moonPenalty));

  // FOV calculations
  const fovInfo = EQUIPMENT.map(eq => calculateFOV(dso, eq));

  return {
    ...dso,
    currentAltitude: currentAlt,
    transitTime: transit,
    transitAltitude: transitAlt,
    hoursAbove30,
    moonDistance: moonDist,
    moonPhase,
    recommendationScore: Math.min(100, score),
    fovInfo,
  };
}

/**
 * Score all DSOs and return sorted by recommendation score
 */
export function scoreAllDSOs(
  catalog: DSOObject[],
  dateTime: Date,
  darknessStart: Date,
  darknessEnd: Date,
  observer: Observer = KEW_GARDENS
): ScoredDSO[] {
  return catalog
    .map(dso => scoreDSO(dso, dateTime, darknessStart, darknessEnd, observer))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}

/**
 * Get DSO type color class
 */
export function getDSOTypeColor(type: string): string {
  const typeMap: Record<string, string> = {
    "Galaxy": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "Nebula": "bg-violet-500/20 text-violet-400 border-violet-500/30",
    "Open Cluster": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "Globular Cluster": "bg-amber-500/20 text-amber-300 border-amber-500/30",
    "Planetary Nebula": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "Cluster + Nebula": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "Supernova Remnant": "bg-rose-500/20 text-rose-400 border-rose-500/30",
    "HII Region": "bg-pink-500/20 text-pink-400 border-pink-500/30",
    "Stellar Association": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };
  return typeMap[type] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
}

/**
 * Get altitude color class
 */
export function getAltitudeColor(alt: number): string {
  if (alt >= 45) return "text-emerald-400";
  if (alt >= 20) return "text-amber-400";
  if (alt > 0) return "text-rose-400";
  return "text-muted-foreground";
}

/**
 * Get score color class
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-cyan-400";
  if (score >= 30) return "text-amber-400";
  return "text-muted-foreground";
}
