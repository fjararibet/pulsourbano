import { comunasRM } from "./comunas-rm";

export type CostingMode = "auto" | "bus" | "bicycle" | "metro";

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
	const shape = data.shape as [number, number][];
	return {
		shape: costing === "metro" ? smoothMetroShape(shape) : shape,
		time: data.time as number,
	};
}

function smoothMetroShape(points: [number, number][]): [number, number][] {
	if (points.length < 4) return points;

	const start = points[0];
	const end = points.at(-1);
	if (!start || !end) return points;

	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const lenSq = dx * dx + dy * dy;
	if (lenSq < 1e-10) return decimateShape(points, 18);

	const bucketCount = Math.min(
		28,
		Math.max(10, Math.round(Math.sqrt(points.length))),
	);
	const buckets = Array.from({ length: bucketCount }, () => ({
		lng: 0,
		lat: 0,
		count: 0,
	}));

	for (const point of points) {
		const t = Math.max(
			0,
			Math.min(
				1,
				((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lenSq,
			),
		);
		const bucket =
			buckets[Math.min(bucketCount - 1, Math.floor(t * bucketCount))];
		if (!bucket) continue;
		bucket.lng += point[0];
		bucket.lat += point[1];
		bucket.count++;
	}

	const smoothed: [number, number][] = [start];
	for (const bucket of buckets) {
		if (bucket.count === 0) continue;
		const averaged: [number, number] = [
			bucket.lng / bucket.count,
			bucket.lat / bucket.count,
		];
		const previous = smoothed.at(-1);
		if (!previous || distanceSq(previous, averaged) > 1e-8) {
			smoothed.push(averaged);
		}
	}
	if (distanceSq(smoothed.at(-1) ?? start, end) > 1e-8) smoothed.push(end);

	return smoothed.length >= 2 ? smoothed : [start, end];
}

function decimateShape(
	points: [number, number][],
	targetCount: number,
): [number, number][] {
	if (points.length <= targetCount) return points;
	const decimated: [number, number][] = [];
	const lastIndex = points.length - 1;
	for (let i = 0; i < targetCount; i++) {
		const index = Math.round((i / (targetCount - 1)) * lastIndex);
		const point = points[index];
		if (point) decimated.push(point);
	}
	return decimated;
}

function distanceSq(a: [number, number], b: [number, number]): number {
	const dx = a[0] - b[0];
	const dy = a[1] - b[1];
	return dx * dx + dy * dy;
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

export const ALL_COSTINGS: CostingMode[] = ["auto", "bus", "bicycle", "metro"];

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
