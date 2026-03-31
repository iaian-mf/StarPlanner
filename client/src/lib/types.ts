export interface DSOObject {
  id: string;
  displayId: string;
  messier: string | null;
  type: string;
  typeCode: string;
  ra: number;         // decimal hours
  dec: number;        // decimal degrees
  raHMS: string;
  decDMS: string;
  constellation: string;
  majAxis: number;    // arcminutes
  minAxis: number;    // arcminutes
  magnitude: number | null;
  surfaceBrightness: number | null;
  commonName: string | null;
  maxAltitude: number;
  score: number;
}

export interface Equipment {
  name: string;
  focalLength: number;    // mm
  sensorWidth: number;    // mm
  sensorHeight: number;   // mm
  fovWidth: number;       // degrees
  fovHeight: number;      // degrees
}

export interface FOVInfo {
  equipment: Equipment;
  fillPercent: number;
  framing: "too-small" | "good" | "too-large" | "excellent";
  objectWidthDeg: number;
  objectHeightDeg: number;
}

export interface ScoredDSO extends DSOObject {
  currentAltitude: number;
  transitTime: Date;
  transitAltitude: number;
  hoursAbove30: number;
  moonDistance: number;
  moonPhase: number;
  recommendationScore: number;
  fovInfo: FOVInfo[];
}

export type SortField =
  | "recommendationScore"
  | "displayId"
  | "commonName"
  | "type"
  | "majAxis"
  | "magnitude"
  | "currentAltitude"
  | "transitTime"
  | "transitAltitude"
  | "constellation"
  | "hoursAbove30";

export type SortDirection = "asc" | "desc";

export interface Filters {
  types: string[];
  minAltitude: number;
  minAngularSize: number;
  searchQuery: string;
  currentlyVisible: boolean;
}
