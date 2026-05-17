export type ModoRow = {
	modo: string | null;
	modoNombre: string | null;
	n_viajes: number;
	porcentaje: number;
	velocidad_promedio: number;
	tiempo_promedio_min: number;
	distancia_promedio_km: number;
};

export type ModoState = {
	delta: number;
	locked: boolean;
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
