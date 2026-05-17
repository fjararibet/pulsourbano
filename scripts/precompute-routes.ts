import { createWriteStream, existsSync, mkdirSync } from "fs";
import { readFileSync, writeFileSync } from "fs";
import https from "https";
import http from "http";

interface ComunaPolygon {
  name: string;
  coords: number[][][];
}

interface ValhallaLocation {
  lat: number;
  lon: number;
  type: "break";
}

interface ValhallaRouteRequest {
  locations: ValhallaLocation[];
  costing: string;
}

interface ValhallaRouteResponse {
  trip: {
    legs: {
      shape: string;
    }[];
    summary: {
      time: number;
      distance: number;
    };
  };
}

interface CachedRoute {
  shape: [number, number][];
  time: number;
  distance: number;
}

type CostingMode = "auto" | "bus" | "bicycle" | "pedestrian";

const COSTINGS: CostingMode[] = ["auto", "bus", "bicycle", "pedestrian"];
const VALHALLA_URL = "http://localhost:8002/route";
const OUTPUT_DIR = "./src/data/routes";
const COMUNAS_FILE = "./src/lib/comunas-rm.ts";

function polygonCentroid(coords: number[][][]): [number, number] {
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const ring of coords) {
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
      count++;
    }
  }
  return count > 0 ? [sumLng / count, sumLat / count] : [-70.65, -33.45];
}

function decodePolyline(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    coordinates.push([lng / 1e6, lat / 1e6]);
  }

  return coordinates;
}

function postJson<T>(url: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = (urlObj.protocol === "https:" ? https : http).request(
      options,
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body) as T);
          } catch {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      },
    );

    req.on("error", reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function fetchRoute(
  from: [number, number],
  to: [number, number],
  costing: CostingMode,
): Promise<CachedRoute> {
  const request: ValhallaRouteRequest = {
    locations: [
      { lat: from[1], lon: from[0], type: "break" },
      { lat: to[1], lon: to[0], type: "break" },
    ],
    costing,
  };

  const data = await postJson<ValhallaRouteResponse>(VALHALLA_URL, request);
  const shape = decodePolyline(data.trip.legs[0].shape);
  return {
    shape,
    time: data.trip.summary.time,
    distance: data.trip.summary.distance,
  };
}

async function main() {
  console.log("Loading comunas...");
  const comunasContent = readFileSync(COMUNAS_FILE, "utf-8");
  const comunasMatch = comunasContent.match(
    /export const comunasRM: ComunaPolygon\[\] = ([\s\S]*?);$/m,
  );
  if (!comunasMatch) {
    throw new Error("Could not parse comunasRM");
  }

  const comunas: ComunaPolygon[] = eval(`(${comunasMatch[1]})`);

  const centroids: Record<string, [number, number]> = {};
  for (const comuna of comunas) {
    centroids[comuna.name] = polygonCentroid(comuna.coords);
  }

  const allComunas = Object.keys(centroids);
  console.log(`Found ${allComunas.length} comunas`);

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allPairs: Array<{ origen: string; destino: string }> = [];
  for (const origen of allComunas) {
    for (const destino of allComunas) {
      if (origen !== destino) {
        allPairs.push({ origen, destino });
      }
    }
  }
  console.log(`Total pairs per costing: ${allPairs.length}`);

  const total = allPairs.length * COSTINGS.length;
  let completed = 0;

  const concurrency = 10;
  const queue = [...allPairs].flatMap((pair) =>
    COSTINGS.map((costing) => ({ ...pair, costing })),
  );

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const { origen, destino, costing } = task;
      const key = `${origen}:${destino}:${costing}`;
      const filename = `${OUTPUT_DIR}/${encodeURIComponent(origen)}_${encodeURIComponent(destino)}_${costing}.json`;

      if (existsSync(filename)) {
        completed++;
        if (completed % 100 === 0) {
          console.log(`Progress: ${completed}/${total} (cached)`);
        }
        return;
      }

      try {
        const from = centroids[origen];
        const to = centroids[destino];
        const route = await fetchRoute(from, to, costing);
        writeFileSync(filename, JSON.stringify(route));
        completed++;
        if (completed % 50 === 0) {
          console.log(
            `Progress: ${completed}/${total} (${((completed / total) * 100).toFixed(1)}%)`,
          );
        }
      } catch (err) {
        console.error(`Failed for ${key}: ${err}`);
        queue.push(task);
      }
    }
  }

  console.log(`Starting ${concurrency} concurrent workers...`);
  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);

  console.log("\nGenerating index file...");
  const indexContent: Record<string, string> = {};
  for (const origen of allComunas) {
    for (const destino of allComunas) {
      if (origen !== destino) {
        for (const costing of COSTINGS) {
          const key = `${origen}:${destino}:${costing}`;
          const filename = `${encodeURIComponent(origen)}_${encodeURIComponent(destino)}_${costing}.json`;
          indexContent[key] = filename;
        }
      }
    }
  }
  writeFileSync(
    `${OUTPUT_DIR}/index.json`,
    JSON.stringify(indexContent, null, 2),
  );
  console.log(`Wrote index to ${OUTPUT_DIR}/index.json`);
  console.log("\nDone!");
}

main().catch(console.error);