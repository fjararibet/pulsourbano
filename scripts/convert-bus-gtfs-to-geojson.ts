/**
 * Converts GTFS bus data from gtfs_extract/ into a GeoJSON FeatureCollection.
 * Output is written to data/buses.geojson (or path given as first argument).
 *
 * Input files (from gtfs_extract/):
 *   - bus_routes.json  : route info (route_id, route_short_name, route_long_name, route_color, etc.)
 *   - bus_trips.json   : trip to route/shape mapping (route_id, shape_id)
 *   - bus_shapes.json  : GPS points for each shape_id, ordered by shape_pt_sequence
 *   - bus_stops.json   : stop info (stop_id, stop_name, stop_lat, stop_lon)
 *
 * Output:
 *   - LineString features (kind="route") for each unique shape_id
 *   - Point features (kind="stop") for each stop
 *
 * Usage:
 *   npx tsx scripts/convert-bus-gtfs-to-geojson.ts
 *   npx tsx scripts/convert-bus-gtfs-to-geojson.ts /custom/path/buses.geojson
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type GtfsRoute = {
	route_id: string;
	route_short_name: string;
	route_long_name: string;
	route_color: string;
	route_text_color: string;
};

type GtfsTrip = {
	route_id: string;
	shape_id: string;
	trip_id: string;
};

type GtfsShape = {
	shape_id: string;
	shape_pt_lat: string;
	shape_pt_lon: string;
	shape_pt_sequence: number;
};

type GtfsStop = {
	stop_id: string;
	stop_name: string;
	stop_lat: string;
	stop_lon: string;
};

type GeoJsonFeature = {
	type: "Feature";
	geometry: { type: string; coordinates: unknown };
	properties: Record<string, unknown>;
};

const GTFS_DIR = resolve(process.cwd(), "gtfs_extract");
const OUT_PATH = resolve(process.cwd(), process.argv[2] ?? "data/buses.geojson");
const log = (msg: string) => process.stderr.write(`${msg}\n`);

async function loadJson<T>(filename: string): Promise<T> {
	const raw = await readFile(resolve(GTFS_DIR, filename), "utf8");
	return JSON.parse(raw) as T;
}

async function main() {
	log("Loading GTFS files...");
	const [routes, trips, shapes, stops] = await Promise.all([
		loadJson<GtfsRoute[]>("bus_routes.json"),
		loadJson<GtfsTrip[]>("bus_trips.json"),
		loadJson<GtfsShape[]>("bus_shapes.json"),
		loadJson<GtfsStop[]>("bus_stops.json"),
	]);
	log(`  ${routes.length} routes, ${trips.length} trips, ${shapes.length} shape points, ${stops.length} stops`);

	log("Building shape_id → route_id lookup...");
	const shapeToRoute = new Map<string, { route: GtfsRoute; shapeId: string }>();
	for (const trip of trips) {
		if (!shapeToRoute.has(trip.shape_id)) {
			const route = routes.find((r) => r.route_id === trip.route_id);
			if (route) {
				shapeToRoute.set(trip.shape_id, { route, shapeId: trip.shape_id });
			}
		}
	}

	log("Grouping shape points by shape_id...");
	const shapePoints = new Map<string, GtfsShape[]>();
	for (const pt of shapes) {
		const arr = shapePoints.get(pt.shape_id) ?? [];
		arr.push(pt);
		shapePoints.set(pt.shape_id, arr);
	}

	log("Building route LineString features...");
	const features: GeoJsonFeature[] = [];
	let routeCount = 0;
	for (const [shapeId, pts] of shapePoints) {
		const routeInfo = shapeToRoute.get(shapeId);
		if (!routeInfo) continue;

		const sorted = pts.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence);
		const coordinates = sorted.map((p) => [
			parseFloat(p.shape_pt_lon),
			parseFloat(p.shape_pt_lat),
		]);

		features.push({
			type: "Feature",
			geometry: { type: "LineString", coordinates },
			properties: {
				route_id: routeInfo.route.route_id,
				short_name: routeInfo.route.route_short_name,
				long_name: routeInfo.route.route_long_name,
				color: routeInfo.route.route_color,
				text_color: routeInfo.route.route_text_color,
				shape_id: shapeId,
				stop_kind: "route",
			},
		});
		routeCount++;
		if (routeCount % 100 === 0) log(`  ${routeCount} routes processed`);
	}
	log(`  ${routeCount} route features created`);

	log("Building stop Point features...");
	let stopCount = 0;
	for (const stop of stops) {
		const lat = parseFloat(stop.stop_lat);
		const lon = parseFloat(stop.stop_lon);
		if (isNaN(lat) || isNaN(lon)) continue;

		features.push({
			type: "Feature",
			geometry: { type: "Point", coordinates: [lon, lat] },
			properties: {
				stop_id: stop.stop_id,
				name: stop.stop_name,
				stop_kind: "stop",
			},
		});
		stopCount++;
	}
	log(`  ${stopCount} stop features created`);

	log(`Writing ${features.length} features to ${OUT_PATH}...`);
	const fc = JSON.stringify({ type: "FeatureCollection", features });
	const { writeFile } = await import("node:fs/promises");
	await writeFile(OUT_PATH, fc);

	log("Done!");
}

main().catch((err) => {
	log(`Error: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
});
