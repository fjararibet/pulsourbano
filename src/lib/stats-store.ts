import type { ModoRow } from "#/lib/comparador/comparador-types";

export interface ComunaStats {
	statsModo: ModoRow[];
	total: number;
	initialStatsMap: Record<string, number>;
}

const statsCache = new Map<string, Promise<ComunaStats>>();

async function loadPrecomputedStats(
	origen: string,
	destino: string,
): Promise<ComunaStats> {
	const fileName = `${encodeURIComponent(origen)}_${encodeURIComponent(destino)}.json`;
	const res = await fetch(`/data/stats/${encodeURIComponent(fileName)}`);
	if (!res.ok) {
		return { statsModo: [], total: 0, initialStatsMap: {} };
	}
	const data = (await res.json()) as ComunaStats;
	return data;
}

export function getStats(
	origen: string,
	destino: string,
): Promise<ComunaStats> {
	const key = `${origen}:${destino}`;
	const cached = statsCache.get(key);
	if (cached) return cached;

	const promise = loadPrecomputedStats(origen, destino);
	statsCache.set(key, promise);
	return promise;
}
