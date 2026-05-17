import { comunasRM } from "./comunas-rm";

export type CostingMode = "auto" | "bus" | "bicycle" | "pedestrian" | "metro";

export interface CachedRoute {
	shape: [number, number][];
	time: number;
}

type RouteKey = `${string}:${string}:${CostingMode}`;

const routeCache = new Map<RouteKey, Promise<CachedRoute>>();

function makeKey(
	origen: string,
	destino: string,
	costing: CostingMode,
): RouteKey {
	return `${origen}:${destino}:${costing}`;
}

async function loadPrecomputedRoute(
	origen: string,
	destino: string,
	costing: CostingMode,
): Promise<CachedRoute> {
	const fileName = `${encodeURIComponent(origen)}_${encodeURIComponent(destino)}_${costing}.json`;
	const res = await fetch(`/data/routes/${encodeURIComponent(fileName)}`);
	if (!res.ok) throw new Error(`Route not found: ${fileName}`);
	const data = await res.json();
	return {
		shape: data.shape as [number, number][],
		time: data.time as number,
	};
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

export const ALL_COMUNA_CENTROIDS: Record<string, [number, number]> = {};

for (const comuna of comunasRM) {
	ALL_COMUNA_CENTROIDS[comuna.name] = polygonCentroid(comuna.coords);
}

export const ALL_COMUNAS = Object.keys(ALL_COMUNA_CENTROIDS);

export const ALL_COSTINGS: CostingMode[] = [
	"auto",
	"bus",
	"bicycle",
	"pedestrian",
	"metro",
];

export function getRoute(
	origen: string,
	destino: string,
	costing: CostingMode,
): Promise<CachedRoute> {
	const key = makeKey(origen, destino, costing);
	const cached = routeCache.get(key);
	if (cached) return cached;

	const promise = loadPrecomputedRoute(origen, destino, costing);
	routeCache.set(key, promise);
	return promise;
}

export function precomputePairRoutes(
	origen: string,
	destino: string,
	costings: CostingMode[] = ALL_COSTINGS,
): void {
	for (const costing of costings) {
		const key = makeKey(origen, destino, costing);
		if (routeCache.has(key)) continue;
		routeCache.set(key, loadPrecomputedRoute(origen, destino, costing));
	}
}
