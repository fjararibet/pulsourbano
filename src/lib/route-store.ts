import { comunasRM } from "./comunas-rm";
import type { CostingMode } from "./valhalla";
import { runValhallaRoute } from "./valhalla";

export interface CachedRoute {
	shape: [number, number][];
	time: number;
	distance: number;
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

export const ALL_COMUNA_CENTROIDS: Record<string, [number, number]> = {};

for (const comuna of comunasRM) {
	ALL_COMUNA_CENTROIDS[comuna.name] = polygonCentroid(comuna.coords);
}

export function getRoute(
	origen: string,
	destino: string,
	costing: CostingMode,
): Promise<CachedRoute> {
	const key = makeKey(origen, destino, costing);
	const cached = routeCache.get(key);
	if (cached) return cached;

	const coords = ALL_COMUNA_CENTROIDS[origen];
	const destCoords = ALL_COMUNA_CENTROIDS[destino];
	if (!coords || !destCoords) {
		return Promise.reject(
			new Error(`Missing coords for ${origen} or ${destino}`),
		);
	}

	const promise = runValhallaRoute(coords, destCoords, costing).then(
		(result) => ({
			shape: result.shape,
			time: result.time,
			distance: result.distance,
		}),
	);

	routeCache.set(key, promise);
	return promise;
}

export const ALL_COMUNAS = Object.keys(ALL_COMUNA_CENTROIDS);

export function allPairs(): Array<{ origen: string; destino: string }> {
	const pairs: Array<{ origen: string; destino: string }> = [];
	for (const origen of ALL_COMUNAS) {
		for (const destino of ALL_COMUNAS) {
			if (origen !== destino) {
				pairs.push({ origen, destino });
			}
		}
	}
	return pairs;
}

export const ALL_COSTINGS: CostingMode[] = [
	"auto",
	"bus",
	"bicycle",
	"pedestrian",
];

export function precomputeAllRoutes(
	pairs: Array<{ origen: string; destino: string }>,
	costings: CostingMode[] = ALL_COSTINGS,
	onProgress?: (done: number, total: number) => void,
): void {
	const tasks: Array<() => void> = [];

	for (const { origen, destino } of pairs) {
		for (const costing of costings) {
			const key = makeKey(origen, destino, costing);
			if (routeCache.has(key)) continue;

			const origenCoords = ALL_COMUNA_CENTROIDS[origen];
			const destCoords = ALL_COMUNA_CENTROIDS[destino];
			if (!origenCoords || !destCoords) continue;

			const promise = runValhallaRoute(origenCoords, destCoords, costing).then(
				(result) => ({
					shape: result.shape,
					time: result.time,
					distance: result.distance,
				}),
			);

			routeCache.set(key, promise);
			tasks.push(() => promise);
		}
	}

	if (onProgress && tasks.length > 0) {
		let completed = 0;
		for (const task of tasks) {
			task().finally(() => {
				completed++;
				onProgress(completed, tasks.length);
			});
		}
	}
}

export function precomputePairRoutes(
	origen: string,
	destino: string,
	costings: CostingMode[] = ALL_COSTINGS,
): void {
	for (const costing of costings) {
		const key = makeKey(origen, destino, costing);
		if (routeCache.has(key)) continue;

		const origenCoords = ALL_COMUNA_CENTROIDS[origen];
		const destCoords = ALL_COMUNA_CENTROIDS[destino];
		if (!origenCoords || !destCoords) continue;

		const promise = runValhallaRoute(origenCoords, destCoords, costing).then(
			(result) => ({
				shape: result.shape,
				time: result.time,
				distance: result.distance,
			}),
		);

		routeCache.set(key, promise);
	}
}

export function precomputeAllRoutesForComunas(
	comunas: string[],
	costings: CostingMode[] = ALL_COSTINGS,
): void {
	for (const origen of comunas) {
		for (const destino of comunas) {
			if (origen !== destino) {
				precomputePairRoutes(origen, destino, costings);
			}
		}
	}
}
