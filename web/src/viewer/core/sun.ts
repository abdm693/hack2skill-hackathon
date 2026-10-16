/**
 * Sun path for Lahore (NOAA solar-position approximation, PKT = UTC+5).
 *
 * World compass: the plot FRONT (towards the road, world −Z) points to `site.facing`. Directions are
 * measured clockwise when seen from above (+Y), so for a north-facing plot east = +X, south = +Z.
 * (Engine track: import `sunDirection` if you want the SDK's `s.lights.sun({hour})` to match the viewer.)
 */
import * as THREE from "three";
import { clamp, smoothstep } from "./units";

export type Facing = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export const LAHORE = { lat: 31.5204, lng: 74.3587, tz: 5 };
/** Late May: sunrise ≈ 5:05, sunset ≈ 18:55 PKT, so the 6..19 slider is daylight and 17.5 is golden hour. */
export const SUN_DAY_OF_YEAR = 140;

const FACING_AZ: Record<Facing, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const D2R = Math.PI / 180;

export interface SunState {
  /** Unit vector pointing from the scene TOWARDS the sun (world space). */
  dir: THREE.Vector3;
  elevationDeg: number;
  azimuthDeg: number; // compass, clockwise from north
  /** 0 at/below the horizon → 1 in full daylight; use to scale the sun light. */
  daylight: number;
  color: THREE.Color;
}

export function solarPosition(hour: number, dayOfYear = SUN_DAY_OF_YEAR, loc = LAHORE) {
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hour - 12) / 24);
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hour * 60 + eqTime + 4 * loc.lng - 60 * loc.tz; // true solar time, minutes
  const ha = (tst / 4 - 180) * D2R; // hour angle
  const lat = loc.lat * D2R;
  const cosZen = clamp(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha), -1, 1);
  const elevation = 90 - Math.acos(cosZen) / D2R;
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / D2R + 180;
  return { elevationDeg: elevation, azimuthDeg: (az + 360) % 360 };
}

const WARM = new THREE.Color("#ff9d5c");
const GOLD = new THREE.Color("#ffd6a3");
const NOON = new THREE.Color("#fff6ea");

export function sunState(hour: number, facing: Facing = "N", dayOfYear = SUN_DAY_OF_YEAR): SunState {
  const { elevationDeg, azimuthDeg } = solarPosition(hour, dayOfYear);
  const theta = (azimuthDeg - FACING_AZ[facing]) * D2R;
  // Keep the light a hair above the horizon so shadows stay defined at dusk; the sky uses the true value.
  const el = Math.max(elevationDeg, 1.5) * D2R;
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(theta), Math.sin(el), -Math.cos(el) * Math.cos(theta)).normalize();
  const daylight = smoothstep(-3, 12, elevationDeg);
  const color = new THREE.Color().copy(WARM).lerp(GOLD, smoothstep(2, 14, elevationDeg)).lerp(NOON, smoothstep(14, 45, elevationDeg));
  return { dir, elevationDeg, azimuthDeg, daylight, color };
}

/** Direction for the Sky shader (uses the true elevation so the disc can set below the horizon). */
export function skyDirection(hour: number, facing: Facing = "N", dayOfYear = SUN_DAY_OF_YEAR): THREE.Vector3 {
  const { elevationDeg, azimuthDeg } = solarPosition(hour, dayOfYear);
  const theta = (azimuthDeg - FACING_AZ[facing]) * D2R;
  const el = elevationDeg * D2R;
  return new THREE.Vector3(Math.cos(el) * Math.sin(theta), Math.sin(el), -Math.cos(el) * Math.cos(theta)).normalize();
}
