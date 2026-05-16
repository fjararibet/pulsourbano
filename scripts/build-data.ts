/**
 * SimSantiago — Pipeline de datos
 *
 * Descarga las fuentes oficiales y emite GeoJSON estático en public/data/.
 * Corre con: npm run data:build
 *
 * Fuentes:
 *   - DTPM GTFS (Metro + Buses RED):
 *       https://www.dtpm.cl/descargas/gtfs/GTFS-Vigente.zip
 *   - OCUC Ciclovías RM (ArcGIS Hub, descarga directa GeoJSON):
 *       https://opendata.arcgis.com/datasets/964ce19732c94fe1a211443ca0a08a09_0.geojson
 *
 * Salidas (public/data/):
 *   - metro.geojson        — líneas y estaciones de Metro
 *   - buses.geojson        — recorridos y paraderos RED
 *   - ciclovias.geojson    — red de ciclovías AMS
 *   - frequencies.json     — frecuencia media por servicio/sentido
 *   - travel-times.json    — tiempo de viaje promedio por servicio/sentido
 *
 * Nota: si las URLs cambian, ajustar las constantes abajo. El script es idempotente
 * y cachea el zip GTFS en .cache/ para no redescargar 50MB cada vez.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";

// ────────────────────────────────────────────────────────────────────────────
// Configuración
// ────────────────────────────────────────────────────────────────────────────

/** Página índice donde DTPM publica los enlaces a los zips GTFS vigentes. */
const GTFS_INDEX_URL = "https://www.dtpm.cl/index.php/noticias/gtfs-vigente";
/** Fallback hard-coded por si el scraping falla (actualizar manualmente si rompe). */
const GTFS_FALLBACK_URL =
	"https://www.dtpm.cl/descargas/gtfs/GTFS_20260425_v3.zip";
const CICLOVIAS_URL =
	"https://opendata.arcgis.com/datasets/964ce19732c94fe1a211443ca0a08a09_0.geojson";

const ROOT = process.cwd();
const CACHE_DIR = join(ROOT, ".cache");
const OUT_DIR = join(ROOT, "public", "data");
const GTFS_ZIP = join(CACHE_DIR, "gtfs-dtpm.zip");

// ────────────────────────────────────────────────────────────────────────────
// Tipos GTFS mínimos (lo que usamos)
// ────────────────────────────────────────────────────────────────────────────

interface Route {
	route_id: string;
	agency_id?: string;
	route_short_name: string;
	route_long_name: string;
	route_type: string; // 1 = Metro, 3 = Bus
	route_color?: string;
	route_text_color?: string;
}

interface Trip {
	route_id: string;
	service_id: string;
	trip_id: string;
	shape_id: string;
	direction_id?: string;
	trip_headsign?: string;
}

interface ShapePoint {
	shape_id: string;
	shape_pt_lat: string;
	shape_pt_lon: string;
	shape_pt_sequence: string;
}

interface Stop {
	stop_id: string;
	stop_name: string;
	stop_lat: string;
	stop_lon: string;
	location_type?: string;
}

interface Frequency {
	trip_id: string;
	start_time: string;
	end_time: string;
	headway_secs: string;
}

interface StopTime {
	trip_id: string;
	arrival_time: string;
	departure_time: string;
	stop_id: string;
	stop_sequence: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un string GTFS "HH:MM:SS" a segundos desde el inicio del día de
 * servicio. GTFS permite HH ≥ 24 para viajes que cruzan la medianoche, así
 * que no validamos contra 23h59m59s.
 */
function parseGtfsTime(time: string): number {
	if (!time) return Number.NaN;
	const parts = time.split(":");
	if (parts.length !== 3) return Number.NaN;
	const h = Number(parts[0]);
	const m = Number(parts[1]);
	const s = Number(parts[2]);
	if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) {
		return Number.NaN;
	}
	return h * 3600 + m * 60 + s;
}

/** Distancia en km entre dos puntos `[lon, lat]` usando haversine. */
function haversineKm(a: [number, number], b: [number, number]): number {
	const R = 6371; // radio medio de la Tierra en km
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

/** Largo total en km de una polilínea ordenada de coords `[lon, lat]`. */
function shapeKm(coords: [number, number][]): number {
	let km = 0;
	for (let i = 1; i < coords.length; i++) {
		const prev = coords[i - 1];
		const curr = coords[i];
		if (!prev || !curr) continue;
		km += haversineKm(prev, curr);
	}
	return km;
}

function ensureDir(p: string) {
	if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

async function downloadIfMissing(url: string, dest: string): Promise<void> {
	if (existsSync(dest)) {
		console.log(`✓ cache hit: ${dest}`);
		return;
	}
	console.log(`↓ descargando ${url}`);
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fetch falló (${res.status}): ${url}`);
	const buf = Buffer.from(await res.arrayBuffer());
	writeFileSync(dest, buf);
	console.log(`✓ guardado en ${dest} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

/**
 * Descubre el URL del zip GTFS vigente scraping la página oficial de DTPM.
 * La página lista enlaces a "GTFS_YYYYMMDD_vN.zip" o similar; usamos el primero.
 */
async function discoverGtfsUrl(): Promise<string> {
	try {
		console.log(`🔎 buscando link GTFS en ${GTFS_INDEX_URL}`);
		const res = await fetch(GTFS_INDEX_URL);
		if (!res.ok) throw new Error(`Index ${res.status}`);
		const html = await res.text();
		// Matchea cualquier href que apunte a /descargas/gtfs/...zip
		const matches = html.match(/https?:\/\/[^"'\s)]*\/descargas\/gtfs\/[^"'\s)]+\.zip/gi);
		if (matches && matches.length > 0) {
			// Decodificar entidades HTML básicas
			const url = matches[0].replace(/&amp;/g, "&");
			console.log(`✓ link encontrado: ${url}`);
			return url;
		}
		throw new Error("no se encontró ningún link .zip en la página");
	} catch (e) {
		console.warn(`⚠ scraping falló (${(e as Error).message}), usando fallback`);
		return GTFS_FALLBACK_URL;
	}
}

function readCsvFromZip<T>(zip: AdmZip, name: string): T[] {
	const entry = zip.getEntry(name);
	if (!entry) throw new Error(`Falta ${name} en GTFS`);
	const txt = entry.getData().toString("utf-8");
	return parse(txt, { columns: true, skip_empty_lines: true, trim: true }) as T[];
}

function isBusStop(stop: Stop) {
	return !stop.location_type && /^P(?!T)[A-Z]/.test(stop.stop_id);
}

// ────────────────────────────────────────────────────────────────────────────
// Pipeline
// ────────────────────────────────────────────────────────────────────────────

async function buildGtfs() {
	ensureDir(CACHE_DIR);
	const gtfsUrl = await discoverGtfsUrl();
	await downloadIfMissing(gtfsUrl, GTFS_ZIP);

	console.log("📦 leyendo GTFS…");
	const zip = new AdmZip(GTFS_ZIP);
	const routes = readCsvFromZip<Route>(zip, "routes.txt");
	const trips = readCsvFromZip<Trip>(zip, "trips.txt");
	const shapes = readCsvFromZip<ShapePoint>(zip, "shapes.txt");
	const stops = readCsvFromZip<Stop>(zip, "stops.txt");

	let frequencies: Frequency[] = [];
	try {
		frequencies = readCsvFromZip<Frequency>(zip, "frequencies.txt");
	} catch {
		console.warn("⚠ frequencies.txt no presente — se omite");
	}

	console.log(
		`  routes=${routes.length} trips=${trips.length} shapes=${shapes.length} stops=${stops.length}`,
	);

	// Index shapes por shape_id → [lon,lat][]
	const shapeIndex = new Map<string, [number, number][]>();
	for (const p of shapes) {
		const arr = shapeIndex.get(p.shape_id) ?? [];
		arr.push([
			Number(p.shape_pt_lon),
			Number(p.shape_pt_lat),
			// seq se usa para ordenar
		]);
		shapeIndex.set(p.shape_id, arr);
	}
	// Ordenar cada shape por su sequence original
	for (const sid of shapeIndex.keys()) {
		const sorted = shapes
			.filter((p) => p.shape_id === sid)
			.sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence))
			.map((p) => [Number(p.shape_pt_lon), Number(p.shape_pt_lat)] as [number, number]);
		shapeIndex.set(sid, sorted);
	}

	const routeType = new Map(routes.map((r) => [r.route_id, r.route_type]));

	// Un shape representativo por route_id (el primer trip que matchea)
	const routeShape = new Map<string, string>();
	const routeDirectionTrips = new Map<string, Trip[]>();
	for (const t of trips) {
		if (!routeShape.has(t.route_id) && t.shape_id) {
			routeShape.set(t.route_id, t.shape_id);
		}

		if (routeType.get(t.route_id) === "3" && t.shape_id) {
			const destination = t.trip_headsign?.trim() ?? "";
			const key = `${t.route_id}|${t.direction_id ?? ""}|${destination}`;
			const routeTrips = routeDirectionTrips.get(t.route_id) ?? [];
			if (!routeTrips.some((trip) => {
				const tripDestination = trip.trip_headsign?.trim() ?? "";
				return `${trip.route_id}|${trip.direction_id ?? ""}|${tripDestination}` === key;
			})) {
				routeTrips.push(t);
				routeDirectionTrips.set(t.route_id, routeTrips);
			}
		}
	}

	const routeHeadsigns = new Map<string, Set<string>>();
	for (const t of trips) {
		if (!t.trip_headsign) continue;
		const headsigns = routeHeadsigns.get(t.route_id) ?? new Set<string>();
		headsigns.add(t.trip_headsign);
		routeHeadsigns.set(t.route_id, headsigns);
	}

	// Separar Metro (route_type = 1) vs Buses (route_type = 3)
	const metroFeatures: GeoJSON.Feature[] = [];
	const busFeatures: GeoJSON.Feature[] = [];

	for (const r of routes) {
		const destinations = [...(routeHeadsigns.get(r.route_id) ?? [])].join(" / ");

		if (r.route_type === "3") {
			for (const trip of routeDirectionTrips.get(r.route_id) ?? []) {
				const coords = shapeIndex.get(trip.shape_id);
				if (!coords || coords.length < 2) continue;
				const destination = trip.trip_headsign?.trim() ?? "";

				busFeatures.push({
					type: "Feature",
					geometry: { type: "LineString", coordinates: coords },
					properties: {
						route_id: r.route_id,
						route_key: `${r.route_id}|${trip.direction_id ?? ""}|${destination}`,
						short_name: r.route_short_name,
						long_name: r.route_long_name,
						direction_id: trip.direction_id,
						destination,
						destinations,
						color: r.route_color ? `#${r.route_color}` : undefined,
						text_color: r.route_text_color ? `#${r.route_text_color}` : undefined,
						type: r.route_type,
					},
				});
			}
			continue;
		}

		const shapeId = routeShape.get(r.route_id);
		if (!shapeId) continue;
		const coords = shapeIndex.get(shapeId);
		if (!coords || coords.length < 2) continue;

		const feat: GeoJSON.Feature = {
			type: "Feature",
			geometry: { type: "LineString", coordinates: coords },
			properties: {
				route_id: r.route_id,
				short_name: r.route_short_name,
				long_name: r.route_long_name,
				color: r.route_color ? `#${r.route_color}` : undefined,
				text_color: r.route_text_color ? `#${r.route_text_color}` : undefined,
				type: r.route_type,
			},
		};

		if (r.route_type === "1") metroFeatures.push(feat);
	}

	// Estaciones de Metro (location_type == 1) vs paraderos
	const metroStops: GeoJSON.Feature[] = [];
	const busStops: GeoJSON.Feature[] = [];
	for (const s of stops) {
		const lat = Number(s.stop_lat);
		const lon = Number(s.stop_lon);
		if (Number.isNaN(lat) || Number.isNaN(lon)) continue;

		const isMetro = s.location_type === "1";
		const properties: GeoJSON.GeoJsonProperties = {
			stop_id: s.stop_id,
			name: s.stop_name,
		};
		if (!isMetro) {
			properties.stop_kind = isBusStop(s) ? "bus_stop" : "other_stop";
		}

		const feat: GeoJSON.Feature = {
			type: "Feature",
			geometry: { type: "Point", coordinates: [lon, lat] },
			properties,
		};

		if (isMetro) metroStops.push(feat);
		else busStops.push(feat);
	}

	const tripById = new Map(trips.map((t) => [t.trip_id, t]));
	const WEEKDAY_SERVICES = new Set(["L", "LJ", "V"]);
	const getTripMetricKey = (trip: Trip) => {
		if (routeType.get(trip.route_id) !== "3") return trip.route_id;
		const destination = trip.trip_headsign?.trim() ?? "";
		return `${trip.route_id}|${trip.direction_id ?? ""}|${destination}`;
	};

	// Frecuencias: headway promedio por servicio/sentido en día hábil.
	const freqByRoute = new Map<string, number[]>();
	for (const f of frequencies) {
		const trip = tripById.get(f.trip_id);
		if (!trip || !WEEKDAY_SERVICES.has(trip.service_id)) continue;
		const headway = Number(f.headway_secs);
		if (!Number.isFinite(headway) || headway <= 0) continue;
		const metricKey = getTripMetricKey(trip);
		const arr = freqByRoute.get(metricKey) ?? [];
		arr.push(headway);
		freqByRoute.set(metricKey, arr);
	}
	const freqOut: Record<string, { mean_headway_s: number; samples: number }> = {};
	for (const [metricKey, arr] of freqByRoute.entries()) {
		const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
		freqOut[metricKey] = { mean_headway_s: Math.round(mean), samples: arr.length };
	}

	// ──────────────────────────────────────────────────────────────────────
	// Tiempo de viaje por servicio/sentido (día hábil)
	//
	// stop_times.txt es el archivo gigante (~50 MB, ~1M filas). Por cada trip
	// queremos la primera salida y la última llegada para obtener la duración
	// total del recorrido. Además guardamos largo y velocidad comercial como
	// respaldo, pero la UI muestra el tiempo promedio del viaje completo.
	//
	// Filtramos a "día hábil" combinando los service_ids L, LJ y V — Metro
	// L1/L2/L4/L5 usan LJ+V por separado en vez de L, así que sin este set
	// extendido se nos quedan fuera 4 de las 7 líneas. Los servicios S
	// (sábado), D (domingo) y F (festivo) sí se excluyen.
	// ──────────────────────────────────────────────────────────────────────
	console.log("⏱  procesando stop_times.txt (puede tardar unos segundos)…");
	const stopTimes = readCsvFromZip<StopTime>(zip, "stop_times.txt");

	type TripWindow = {
		firstDep: number;
		lastArr: number;
		minSeq: number;
		maxSeq: number;
	};
	const tripWindows = new Map<string, TripWindow>();
	for (const st of stopTimes) {
		const seq = Number(st.stop_sequence);
		const arr = parseGtfsTime(st.arrival_time);
		const dep = parseGtfsTime(st.departure_time);
		if (
			!Number.isFinite(seq) ||
			!Number.isFinite(arr) ||
			!Number.isFinite(dep)
		) {
			continue;
		}
		const cur = tripWindows.get(st.trip_id);
		if (!cur) {
			tripWindows.set(st.trip_id, {
				firstDep: dep,
				lastArr: arr,
				minSeq: seq,
				maxSeq: seq,
			});
			continue;
		}
		if (seq < cur.minSeq) {
			cur.minSeq = seq;
			cur.firstDep = dep;
		}
		if (seq > cur.maxSeq) {
			cur.maxSeq = seq;
			cur.lastArr = arr;
		}
	}

	const travelTimeAcc = new Map<
		string,
		{ totalKm: number; totalHours: number; samples: number }
	>();
	for (const t of trips) {
		if (!WEEKDAY_SERVICES.has(t.service_id)) continue;
		const window = tripWindows.get(t.trip_id);
		if (!window) continue;
		const durationSec = window.lastArr - window.firstDep;
		if (!Number.isFinite(durationSec) || durationSec <= 0) continue;
		const coords = t.shape_id ? shapeIndex.get(t.shape_id) : undefined;
		if (!coords || coords.length < 2) continue;
		const km = shapeKm(coords);
		if (km <= 0) continue;
		const hours = durationSec / 3600;
		const metricKey = getTripMetricKey(t);
		const acc = travelTimeAcc.get(metricKey) ?? {
			totalKm: 0,
			totalHours: 0,
			samples: 0,
		};
		acc.totalKm += km;
		acc.totalHours += hours;
		acc.samples += 1;
		travelTimeAcc.set(metricKey, acc);
	}

	const travelTimesOut: Record<
		string,
		{
			mean_minutes: number;
			mean_km: number;
			avg_kmh: number;
			samples: number;
		}
	> = {};
	for (const [metricKey, acc] of travelTimeAcc.entries()) {
		const avgKmh = acc.totalKm / acc.totalHours;
		travelTimesOut[metricKey] = {
			mean_minutes: Math.round((acc.totalHours / acc.samples) * 60),
			mean_km: Math.round((acc.totalKm / acc.samples) * 10) / 10,
			avg_kmh: Math.round(avgKmh * 10) / 10,
			samples: acc.samples,
		};
	}

	// Emitir
	ensureDir(OUT_DIR);

	writeFileSync(
		join(OUT_DIR, "metro.geojson"),
		JSON.stringify(
			{
				type: "FeatureCollection",
				features: [...metroFeatures, ...metroStops],
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(OUT_DIR, "buses.geojson"),
		JSON.stringify(
			{
				type: "FeatureCollection",
				features: [...busFeatures, ...busStops],
			},
			null,
			2,
		),
	);
	writeFileSync(join(OUT_DIR, "frequencies.json"), JSON.stringify(freqOut, null, 2));
	writeFileSync(
		join(OUT_DIR, "travel-times.json"),
		JSON.stringify(travelTimesOut, null, 2),
	);

	console.log(
		`✓ metro.geojson (${metroFeatures.length} líneas, ${metroStops.length} estaciones)`,
	);
	const busStopCount = busStops.filter(
		(stop) => stop.properties?.stop_kind === "bus_stop",
	).length;
	const otherStopCount = busStops.length - busStopCount;
	console.log(
		`✓ buses.geojson (${busFeatures.length} recorridos, ${busStopCount} paraderos RED, ${otherStopCount} otros puntos)`,
	);
	console.log(`✓ frequencies.json (${Object.keys(freqOut).length} servicios)`);
	console.log(
		`✓ travel-times.json (${Object.keys(travelTimesOut).length} servicios — día hábil ${[...WEEKDAY_SERVICES].join("/")})`,
	);
}

async function buildCiclovias() {
	console.log(`↓ descargando ciclovías OCUC`);
	const res = await fetch(CICLOVIAS_URL);
	if (!res.ok) {
		console.warn(`⚠ ciclovías OCUC no disponible (${res.status}) — saltando`);
		return;
	}
	const json = await res.json();
	ensureDir(OUT_DIR);
	writeFileSync(
		join(OUT_DIR, "ciclovias.geojson"),
		JSON.stringify(json, null, 2),
	);
	const n = Array.isArray(json?.features) ? json.features.length : 0;
	console.log(`✓ ciclovias.geojson (${n} segmentos)`);
}

async function main() {
	console.log("🚇 SimSantiago — build de datos\n");
	await buildGtfs();
	await buildCiclovias();
	console.log("\n✅ listo. Datos en public/data/");
}

main().catch((e) => {
	console.error("✗ pipeline falló:", e);
	process.exit(1);
});
