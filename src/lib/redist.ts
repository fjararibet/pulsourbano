export type ModoRow = {
	modo: string | null;
	modoNombre: string | null;
	n_viajes: number;
	porcentaje: number;
	velocidad_promedio: number;
	tiempo_promedio_min: number;
	distancia_promedio_km: number;
};

export type PropositoRow = {
	proposito: string | null;
	n_viajes: number;
	porcentaje: number;
};

export type PeriodoRow = {
	periodo: string | null;
	n_viajes: number;
	porcentaje: number;
};

export type TiempoMedioRow = {
	tiempoMedio: string | null;
	n_viajes: number;
	porcentaje: number;
};

export type ResumenViaje = {
	total_viajes: number;
	distancia_promedio_km: number;
	tiempo_promedio_min: number;
	velocidad_promedio_kmh: number;
	n_viajes_bicicleta: number;
	n_viajes_auto: number;
	n_viajes_micro: number;
	n_viajes_metro: number;
	n_viajes_pie: number;
};

export type StatsRow = {
	modo: string | null;
	n_viajes: number;
	porcentaje: number;
	velocidad_promedio: number;
};

export function redistributeModo(
	real: ModoRow[],
	modoExcluir: string,
): ModoRow[] {
	const removed = real.find((r) => r.modo === modoExcluir);
	if (!removed) return real;

	const remaining = real.filter((r) => r.modo !== modoExcluir);
	if (remaining.length === 0) return [];

	const extraPerMode = removed.n_viajes / remaining.length;

	const withExtras = remaining.map((r) => ({
		...r,
		n_viajes: r.n_viajes + extraPerMode,
	}));

	return recalculateModoPercentages(withExtras);
}

export function redistributeGeneric<
	T extends { n_viajes: number; porcentaje: number },
>(rows: T[], removedTrips: number): T[] {
	if (rows.length === 0) return [];
	const total = rows.reduce((sum, r) => sum + r.n_viajes, 0);
	if (total === 0) return rows;

	const withExtras = rows.map((r) => ({
		...r,
		n_viajes: r.n_viajes + removedTrips * (r.n_viajes / total),
	}));

	return recalculatePercentages(withExtras);
}

function recalculateModoPercentages(rows: ModoRow[]): ModoRow[] {
	const total = rows.reduce((sum, r) => sum + r.n_viajes, 0);
	if (total === 0) return rows;

	return rows.map((r) => ({
		...r,
		porcentaje: Math.round((r.n_viajes / total) * 1000) / 10,
	}));
}

function recalculatePercentages<
	T extends { n_viajes: number; porcentaje: number },
>(rows: T[]): T[] {
	const total = rows.reduce((sum, r) => sum + r.n_viajes, 0);
	if (total === 0) return rows;

	return rows.map((r) => ({
		...r,
		porcentaje: Math.round((r.n_viajes / total) * 1000) / 10,
	}));
}

export function getRemovedTrips(
	statsModo: ModoRow[],
	modoExcluir: string,
): number {
	const removed = statsModo.find((r) => r.modo === modoExcluir);
	return removed?.n_viajes ?? 0;
}
