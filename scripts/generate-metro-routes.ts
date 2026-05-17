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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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

function polygonCentroid(coords: number[][][]): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const ring of coords) {
    for (const [lng = 0, lat = 0] of ring) {
      sumLng += lng;
      sumLat += lat;
      count++;
    }
  }
  return count > 0 ? [sumLng / count, sumLat / count] : [-70.65, -33.45];
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

// Build adjacency list connecting stations that are adjacent on the same line
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
    // For each consecutive pair of stations on the line, find which stations are nearby
    const stationOnLine = stations.filter((s) =>
      s.line_id.split(",").includes(line.route_id)
    );

    // Sort stations on this line by their order along the line
    stationOnLine.sort((a, b) => {
      const idxA = findClosestIndex(a.coordinates, coords);
      const idxB = findClosestIndex(b.coordinates, coords);
      return idxA - idxB;
    });

    // Connect consecutive stations on the same line
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

// Simple BFS to find shortest path between stations
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

// Concatenate edges into a single coordinate array
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

// ─── commune centroids ────────────────────────────────────────────────────────

interface ComunaPolygon {
  name: string;
  coords: number[][][];
}

// Minimal commune data with centroids pre-computed
const COMUNAS: { name: string; centroid: [number, number] }[] = [
  { name: "San Joaquín", centroid: [-70.629, -33.490] },
  { name: "San Miguel", centroid: [-70.649, -33.497] },
  { name: "San Ramón", centroid: [-70.639, -33.510] },
  { name: "Independencia", centroid: [-70.664, -33.415] },
  { name: "La Cisterna", centroid: [-70.668, -33.534] },
  { name: "Peñalolén", centroid: [-70.540, -33.480] },
  { name: "Providencia", centroid: [-70.600, -33.435] },
  { name: "La Reina", centroid: [-70.530, -33.450] },
  { name: "Calera de Tango", centroid: [-70.780, -33.620] },
  { name: "Colina", centroid: [-70.670, -33.200] },
  { name: "Santiago", centroid: [-70.660, -33.450] },
  { name: "Lampa", centroid: [-70.900, -33.280] },
  { name: "Vitacura", centroid: [-70.590, -33.390] },
  { name: "Las Condes", centroid: [-70.550, -33.410] },
  { name: "Lo Barnechea", centroid: [-70.510, -33.360] },
  { name: "La Florida", centroid: [-70.580, -33.520] },
  { name: "Maipú", centroid: [-70.770, -33.510] },
  { name: "Puente Alto", centroid: [-70.580, -33.600] },
  { name: "San Bernardo", centroid: [-70.700, -33.590] },
  { name: "Buin", centroid: [-70.740, -33.610] },
  { name: "Padre Hurtado", centroid: [-70.800, -33.550] },
  { name: "La Pintana", centroid: [-70.640, -33.570] },
  { name: "San José de Maipo", centroid: [-70.450, -33.630] },
  { name: "Pirque", centroid: [-70.520, -33.630] },
  { name: "Providencia", centroid: [-70.600, -33.435] },
  { name: "Ñuñoa", centroid: [-70.590, -33.460] },
  { name: "Macul", centroid: [-70.610, -33.480] },
  { name: "San Joaquín", centroid: [-70.629, -33.490] },
  { name: "Pedro Aguirre Cerda", centroid: [-70.670, -33.470] },
  { name: "Cerro Navia", centroid: [-70.720, -33.440] },
  { name: "Conchalí", centroid: [-70.700, -33.410] },
  { name: " Huechuraba", centroid: [-70.680, -33.380] },
  { name: "Recoleta", centroid: [-70.640, -33.420] },
  { name: "Quinta Normal", centroid: [-70.700, -33.440] },
  { name: "Cerro Navia", centroid: [-70.720, -33.440] },
  { name: "Renca", centroid: [-70.730, -33.420] },
  { name: "Quilicura", centroid: [-70.730, -33.360] },
  { name: "Pudahuel", centroid: [-70.760, -33.440] },
  { name: "Lo Prado", centroid: [-70.720, -33.460] },
  { name: "Estación Central", centroid: [-70.690, -33.460] },
  { name: "Cerrillos", centroid: [-70.710, -33.500] },
  { name: "Maipú", centroid: [-70.770, -33.510] },
  { name: "Santiago", centroid: [-70.660, -33.450] },
  { name: "La Granja", centroid: [-70.610, -33.510] },
  { name: "La Pintana", centroid: [-70.640, -33.570] },
  { name: "San Ramón", centroid: [-70.639, -33.510] },
  { name: "Lo Espejo", centroid: [-70.700, -33.520] },
  { name: "El Bosque", centroid: [-70.690, -33.530] },
  { name: "La Cisterna", centroid: [-70.668, -33.534] },
  { name: "Lo Espejo", centroid: [-70.700, -33.520] },
  { name: "Cerro Navia", centroid: [-70.720, -33.440] },
];

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚇 Generating metro routes for all comuna pairs...\n");

  // Load metro GeoJSON
  const metroGeo = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/data/metro.geojson"), "utf8")
  );

  // Extract lines and stations
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

  // Build graph
  const graph = buildMetroGraph(stations, lines);

  // Output directory
  const outDir = resolve(process.cwd(), "src/data/routes");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Generate routes for each pair
  let count = 0;
  const start = Date.now();

  for (const origen of COMUNAS) {
    for (const destino of COMUNAS) {
      if (origen.name !== destino.name) {
        const origenStation = nearestStation(origen.centroid, stations);
        const destinoStation = nearestStation(destino.centroid, stations);

        const pathEdges = findMetroPath(
          origenStation.stop_id,
          destinoStation.stop_id,
          graph
        );

        let shape: [number, number][];
        let time: number;

        if (pathEdges.length === 0 && origenStation.stop_id !== destinoStation.stop_id) {
          shape = [origen.centroid, destino.centroid];
          time = haversineKm(origen.centroid, destino.centroid) / 32 * 3600;
        } else if (pathEdges.length === 0) {
          shape = [origen.centroid];
          time = 0;
        } else {
          const pathCoords = edgesToCoords(pathEdges);
          shape = [origen.centroid, ...pathCoords, destino.centroid];
          const walkingTime = 2 * 5 * 60;
          time = shapeSeconds(pathCoords) + walkingTime;
        }

        const fileName = `${encodeURIComponent(origen.name)}_${encodeURIComponent(destino.name)}_metro.json`;
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
