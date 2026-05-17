/**
 * Generates pre-computed metro routes between all pairs of comunas.
 *
 * For each origin-destination pair:
 * 1. Find the nearest metro station to the origin comune centroid
 * 2. Find the nearest metro station to the destination comune centroid
 * 3. Compute the best metro route between those stations (using metro line geometries)
 * 4. Store as JSON: { shape: [[lng, lat], ...], time: seconds }
 *
 * Usage: npx tsx scripts/generate-metro-routes.ts
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// ─── helpers ──────────────────────────────────────────────────────────────────

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function shapeKm(coords: [number, number][]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    km += haversineKm(coords[i - 1]!, coords[i]!);
  }
  return km;
}

function shapeSeconds(coords: [number, number][]): number {
  const km = shapeKm(coords);
  const avgSpeedKmh = 32;
  return (km / avgSpeedKmh) * 3600;
}

function nearestStation(
  point: [number, number],
  stations: MetroStation[],
): MetroStation {
  let nearest = stations[0]!;
  let minDist = haversineKm(point, nearest.coordinates);
  for (const station of stations) {
    const dist = haversineKm(point, station.coordinates);
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }
  return nearest;
}

interface MetroStation {
  stop_id: string;
  name: string;
  coordinates: [number, number];
  line_id: string;
}

interface MetroLine {
  route_id: string;
  coordinates: [number, number][];
}

interface GraphEdge {
  from: string;
  to: string;
  coords: [number, number][];
  distanceKm: number;
}

function buildMetroGraph(
  stations: MetroStation[],
  lines: MetroLine[],
): Map<string, GraphEdge[]> {
  const adj = new Map<string, GraphEdge[]>();

  for (const station of stations) {
    adj.set(station.stop_id, []);
  }

  for (const line of lines) {
    const coords = line.coordinates;
    const stationOnLine = stations.filter((s) =>
      s.line_id.split(",").includes(line.route_id)
    );

    stationOnLine.sort((a, b) => {
      const idxA = findClosestIndex(a.coordinates, coords);
      const idxB = findClosestIndex(b.coordinates, coords);
      return idxA - idxB;
    });

    for (let i = 0; i < stationOnLine.length - 1; i++) {
      const from = stationOnLine[i]!;
      const to = stationOnLine[i + 1]!;
      const fromIdx = findClosestIndex(from.coordinates, coords);
      const toIdx = findClosestIndex(to.coordinates, coords);
      const edgeCoords = coords.slice(
        Math.min(fromIdx, toIdx),
        Math.max(fromIdx, toIdx) + 1
      );
      const dist = shapeKm(edgeCoords);
      adj.get(from.stop_id)!.push({
        from: from.stop_id,
        to: to.stop_id,
        coords: edgeCoords,
        distanceKm: dist,
      });
      adj.get(to.stop_id)!.push({
        from: to.stop_id,
        to: from.stop_id,
        coords: edgeCoords.reverse(),
        distanceKm: dist,
      });
    }
  }

  return adj;
}

function findClosestIndex(
  point: [number, number],
  coords: [number, number][],
): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const dist = haversineKm(point, coords[i]!);
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  }
  return minIdx;
}

function findMetroPath(
  fromId: string,
  toId: string,
  graph: Map<string, GraphEdge[]>,
): GraphEdge[] {
  if (fromId === toId) return [];

  const visited = new Set<string>();
  const queue: { id: string; path: GraphEdge[] }[] = [
    { id: fromId, path: [] },
  ];

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (id === toId) return path;

    for (const edge of graph.get(id) ?? []) {
      if (!visited.has(edge.to)) {
        queue.push({
          id: edge.to,
          path: [...path, edge],
        });
      }
    }
  }

  return [];
}

function edgesToCoords(edges: GraphEdge[]): [number, number][] {
  if (edges.length === 0) return [];
  const coords: [number, number][] = [];
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i]!;
    if (i === 0) {
      coords.push(...edge.coords);
    } else {
      coords.push(...edge.coords.slice(1));
    }
  }
  return coords;
}

// Load centroids from existing auto route files
function loadCentroidsFromRoutes(): Map<string, [number, number]> {
  const routes = readdirSync(resolve(process.cwd(), "src/data/routes"));
  const autoRoutes = routes.filter((f: string) => f.endsWith("_auto.json"));

  const centroids = new Map<string, [number, number]>();

  for (const r of autoRoutes) {
    const withoutMode = r.slice(0, -9); // Remove _auto.json
    const decoded = decodeURIComponent(withoutMode);
    // Origin is FIRST component (before first underscore)
    const firstSep = decoded.indexOf("_");
    const origen = decoded.slice(0, firstSep);

    const d = JSON.parse(readFileSync(resolve(process.cwd(), "src/data/routes", r), "utf8"));

    if (!centroids.has(origen)) {
      centroids.set(origen, d.shape[0]);
    }
  }

  return centroids;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚇 Generating metro routes for all comuna pairs...\n");

  // Load metro GeoJSON
  const metroGeo = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/data/metro.geojson"), "utf8")
  );

  const lines: MetroLine[] = metroGeo.features
    .filter((f: any) => f.geometry?.type === "LineString")
    .map((f: any) => ({
      route_id: f.properties.route_id,
      coordinates: f.geometry.coordinates,
    }));

  const stations: MetroStation[] = metroGeo.features
    .filter((f: any) => f.geometry?.type === "Point")
    .map((f: any) => ({
      stop_id: f.properties.stop_id,
      name: f.properties.name,
      coordinates: f.geometry.coordinates as [number, number],
      line_id: f.properties.line_id,
    }));

  console.log(`  Lines: ${lines.length}`);
  console.log(`  Stations: ${stations.length}`);

  const graph = buildMetroGraph(stations, lines);

  // Load centroids from existing auto routes
  const centroids = loadCentroidsFromRoutes();
  console.log(`  Comunas: ${centroids.size}`);

  // Show sample centroids to verify they're correct
  console.log(`  Vitacura centroid: ${JSON.stringify(centroids.get("Vitacura"))}`);
  console.log(`  Santiago centroid: ${JSON.stringify(centroids.get("Santiago"))}`);

  const outDir = resolve(process.cwd(), "src/data/routes");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  let count = 0;
  const start = Date.now();

  const comunas = [...centroids.entries()];

  for (const [origen, origenCentroid] of comunas) {
    for (const [destino, destinoCentroid] of comunas) {
      if (origen !== destino) {
        const origenStation = nearestStation(origenCentroid, stations);
        const destinoStation = nearestStation(destinoCentroid, stations);

        const pathEdges = findMetroPath(
          origenStation.stop_id,
          destinoStation.stop_id,
          graph
        );

        let shape: [number, number][];
        let time: number;

        if (
          pathEdges.length === 0 &&
          origenStation.stop_id !== destinoStation.stop_id
        ) {
          shape = [origenCentroid, destinoCentroid];
          time = (haversineKm(origenCentroid, destinoCentroid) / 32) * 3600;
        } else if (pathEdges.length === 0) {
          shape = [origenCentroid];
          time = 0;
        } else {
          const pathCoords = edgesToCoords(pathEdges);
          shape = [origenCentroid, ...pathCoords, destinoCentroid];
          const walkingTime = 2 * 5 * 60;
          time = shapeSeconds(pathCoords) + walkingTime;
        }

        const fileName = `${encodeURIComponent(origen)}_${encodeURIComponent(destino)}_metro.json`;
        writeFileSync(
          join(outDir, fileName),
          JSON.stringify({ shape, time: Math.round(time) })
        );
        count++;
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Generated ${count} metro routes in ${elapsed}s`);
}

main().catch((e) => {
  console.error("✗ failed:", e);
  process.exit(1);
});