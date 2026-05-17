/**
 * Builds metro.geojson from GTFS_20260425_v3 with authoritative station↔line mapping.
 *
 * Logic:
 *   stop_times → trips → route_id     (which line a platform belongs to)
 *   stations use parent_station grouping
 *   line geometries from shapes.txt ordered by shape_pt_sequence
 *
 * Output:
 *   public/data/metro.geojson
 *     - 7 LineString features (one per line)
 *     - 126 Point features (one per station)
 *
 * Usage:
 *   npx tsx scripts/build-metro-geojson-from-gtfs.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const GTFS_DIR = resolve(process.cwd(), "GTFS_20260425_v3");
const OUTPUT_PATH = resolve(process.cwd(), "public/data/metro.geojson");

const METRO_ROUTE_IDS = new Set(["L1", "L2", "L3", "L4", "L4A", "L5", "L6"]);

// ─── helpers ──────────────────────────────────────────────────────────────────

type CsvRow = Record<string, string>;

type ExistingGeoJsonFeature = {
  geometry?: { type?: string };
  properties?: Record<string, unknown> | null;
};

function cell(row: CsvRow, key: string): string {
  return row[key] ?? "";
}

function parseCsv(filename: string): CsvRow[] {
  const raw = readFileSync(resolve(GTFS_DIR, filename), "utf8").trimEnd();
  const lines = raw.split(/\r?\n/);
  const headers = lines[0]!.split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

// ─── load GTFS ────────────────────────────────────────────────────────────────

const routes = parseCsv("routes.txt");
const trips = parseCsv("trips.txt");
const stops = parseCsv("stops.txt");
const stopTimes = parseCsv("stop_times.txt");
const shapesRaw = readFileSync(resolve(GTFS_DIR, "shapes.txt"), "utf8")
  .trimEnd()
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.split(","));

// ─── route metadata (colors, names) ─────────────────────────────────────────

const routeMeta = new Map<string, { name: string; color: string; textColor: string }>();
for (const r of routes) {
  const routeId = cell(r, "route_id");
  if (METRO_ROUTE_IDS.has(routeId)) {
    routeMeta.set(routeId, {
      name: cell(r, "route_long_name"),
      color: "#" + (cell(r, "route_color") || "0f8f98"),
      textColor: "#" + (cell(r, "route_text_color") || "FFFFFF"),
    });
  }
}

// ─── trip → route + shape ─────────────────────────────────────────────────────

const tripToRoute = new Map<string, string>();
for (const t of trips) {
  const routeId = cell(t, "route_id");
  if (METRO_ROUTE_IDS.has(routeId)) {
    tripToRoute.set(cell(t, "trip_id"), routeId);
  }
}

// ─── shapes as ordered coordinate arrays ─────────────────────────────────────

type ShapePoints = { lat: number; lon: number; seq: number }[];

const shapeCoords = new Map<string, ShapePoints>();
for (const row of shapesRaw) {
  const shapeId = row[0] ?? "";
  const lat = row[1] ?? "";
  const lon = row[2] ?? "";
  const seq = row[3] ?? "";
  // shape_ids like L1-I, L1-R — extract base route id
  const baseId = shapeId.replace(/-[IR]$/, "");
  if (!METRO_ROUTE_IDS.has(baseId)) continue;
  if (!shapeCoords.has(shapeId)) shapeCoords.set(shapeId, []);
  shapeCoords.get(shapeId)!.push({ lat: Number(lat), lon: Number(lon), seq: Number(seq) });
}

// ─── station → lines mapping via stop_times + trips ───────────────────────────

const platformToStation = new Map<string, string>();
for (const s of stops) {
  const parentStation = cell(s, "parent_station");
  if (parentStation) platformToStation.set(cell(s, "stop_id"), parentStation);
}

// map: stationId → Set of route_ids
const stationLines = new Map<string, Set<string>>();

for (const st of stopTimes) {
  const stopId = cell(st, "stop_id");
  const routeId = tripToRoute.get(cell(st, "trip_id"));
  if (!routeId) continue;

  const stationId = platformToStation.get(stopId) ?? stopId;
  if (!stationId) continue;

  if (!stationLines.has(stationId)) stationLines.set(stationId, new Set());
  stationLines.get(stationId)!.add(routeId);
}

// ─── build station records ────────────────────────────────────────────────────

interface StationRec {
  id: string;
  name: string;
  lat: number;
  lon: number;
  lines: string[];
}

const stationRecords = new Map<string, StationRec>();

for (const s of stops) {
  const stopId = cell(s, "stop_id");
  if (!stationLines.has(stopId)) continue;
  const lines = [...stationLines.get(stopId)!].sort();
  stationRecords.set(stopId, {
    id: stopId,
    name: cell(s, "stop_name"),
    lat: Number(cell(s, "stop_lat")),
    lon: Number(cell(s, "stop_lon")),
    lines,
  });
}

// ─── build line geometries ─────────────────────────────────────────────────────

interface LineRec {
  routeId: string;
  name: string;
  color: string;
  textColor: string;
  // one coordinate array per direction, merged into a single ordered array
  coordinates: [number, number][];
}

const lineRecords = new Map<string, LineRec>();

for (const [routeId, meta] of routeMeta) {
  // Collect all shape_ids for this route (e.g. L1-I and L1-R)
  const routeShapeIds = [...shapeCoords.entries()]
    .filter(([sid]) => sid.startsWith(routeId + "-"))
    .map(([sid, pts]) => ({ sid, pts: pts.sort((a, b) => a.seq - b.seq) }));

  const allCoords: [number, number][] = [];
  for (const { pts } of routeShapeIds) {
    for (const p of pts) {
      allCoords.push([p.lon, p.lat]); // GeoJSON order: [lng, lat]
    }
  }

  lineRecords.set(routeId, {
    routeId,
    name: meta.name,
    color: meta.color,
    textColor: meta.textColor,
    coordinates: allCoords,
  });
}

// ─── diff against current metro.geojson ────────────────────────────────────────

let currentGeoJson: { features: ExistingGeoJsonFeature[] } | null = null;
try {
  currentGeoJson = JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) as {
    features: ExistingGeoJsonFeature[];
  };
} catch {
  // no existing file
}

if (currentGeoJson) {
  const currentPoints = currentGeoJson.features
    .filter((f) => f.geometry?.type === "Point")
    .map((f) => ({
      id: String(f.properties?.stop_id ?? ""),
      name: String(f.properties?.name ?? ""),
      line_id: String(f.properties?.line_id ?? ""),
    }));

  console.error("\n=== CHANGE REPORT ===\n");
  let changed = 0;
  for (const station of currentPoints) {
    const rec = stationRecords.get(station.id);
    if (!rec) {
      console.error(`  REMOVED ${station.id} (${station.name}): was ${station.line_id}`);
      changed++;
      continue;
    }
    const gtfsLines = rec.lines.join(",");
    if (gtfsLines !== (station.line_id ?? "").split(",").sort().join(",")) {
      console.error(
        `  CHANGED ${station.id} (${station.name}): ${station.line_id} → ${gtfsLines}`,
      );
      changed++;
    }
  }
  // Check for new stations not in current
  for (const [id, rec] of stationRecords) {
    const current = currentPoints.find((p) => p.id === id);
    if (!current) {
      console.error(`  NEW ${id} (${rec.name}): ${rec.lines.join(",")}`);
      changed++;
    }
  }
  if (changed === 0) console.error("  No changes — data already matches GTFS.");
  console.error("\n=== END REPORT ===\n");
} else {
  console.error("No existing metro.geojson found, generating from scratch.");
}

// ─── build GeoJSON FeatureCollection ─────────────────────────────────────────

const features: unknown[] = [];

// LineString features
for (const [, line] of [...lineRecords.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  features.push({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: line.coordinates,
    },
    properties: {
      route_id: line.routeId,
      short_name: line.routeId,
      long_name: line.name,
      color: line.color,
      text_color: line.textColor,
      type: "1",
    },
  });
}

// Point features
for (const [, station] of [...stationRecords.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const primaryLine = station.lines[0]!;
  const meta = routeMeta.get(primaryLine);
  features.push({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [station.lon, station.lat],
    },
    properties: {
      stop_id: station.id,
      name: station.name,
      line_id: station.lines.join(","),
      line_color: meta?.color ?? "#0f8f98",
      line_name: station.lines.map((l) => routeMeta.get(l)?.name ?? l).join(", "),
    },
  });
}

const fc = {
  type: "FeatureCollection" as const,
  features,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(fc, null, 2), "utf8");

console.error(`Written ${features.length} features to ${OUTPUT_PATH}`);
console.error(`  LineString: ${lineRecords.size}`);
console.error(`  Points: ${stationRecords.size}`);
