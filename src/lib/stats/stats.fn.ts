import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import type {
	ModoRow,
	PeriodoRow,
	PropositoRow,
	ResumenViaje,
	StatsRow,
	TiempoMedioRow,
} from "#/lib/comparador/comparador-types";

export type {
	ModoRow,
	PeriodoRow,
	PropositoRow,
	ResumenViaje,
	StatsRow,
	TiempoMedioRow,
};

export type ComunaRow = {
	id: string;
	comuna: string;
};

function validateOrigenDestino(data: unknown): {
	origen: string;
	destino: string;
} {
	if (typeof data !== "object" || data === null) {
		throw new Error("Invalid input");
	}
	const d = data as Record<string, unknown>;
	if (typeof d.origen !== "string" || typeof d.destino !== "string") {
		throw new Error("Missing fields");
	}
	return { origen: d.origen, destino: d.destino };
}

export const getComunas = createServerFn({ method: "GET" }).handler(
	async (): Promise<ComunaRow[]> => {
		try {
			const { results } = await env.EOD2012.prepare(
				`SELECT id, comuna FROM comuna ORDER BY comuna`,
			).all<ComunaRow>();
			return results;
		} catch (e) {
			console.error("[getComunas] DB error:", e);
			return [];
		}
	},
);

export const getTotalViajes = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<number> => {
		const query = `SELECT COUNT(*) AS total
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 WHERE co.comuna = ?1 AND cd.comuna = ?2`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: Array<{ total: number }> }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results[0]?.total ?? 0;
		} catch {
			return 0;
		}
	});

export const getResumenViaje = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<ResumenViaje> => {
		const query = `
		 WITH totals AS (
		   SELECT
		     COUNT(*) AS total_viajes,
		     ROUND(AVG(d.distEuclidiana), 2) AS distancia_promedio_km,
		     ROUND(AVG(v.tiempoViaje), 1) AS tiempo_promedio_min,
		     ROUND(AVG(d.distEuclidiana * 60.0 / v.tiempoViaje), 1) AS velocidad_promedio_kmh
		   FROM viaje v
		   LEFT JOIN distancia_viaje d ON d.viaje = v.viaje
		   LEFT JOIN comuna co ON co.id = v.comunaOrigen
		   LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		   WHERE co.comuna = ?1 AND cd.comuna = ?2
		     AND v.tiempoViaje > 0 AND d.distEuclidiana > 0
		 ),
		 modes AS (
		   SELECT v.modoAgregado, COUNT(*) AS n
		   FROM viaje v
		   LEFT JOIN comuna co ON co.id = v.comunaOrigen
		   LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		   WHERE co.comuna = ?1 AND cd.comuna = ?2
		   GROUP BY v.modoAgregado
		 )
		 SELECT
		   t.total_viajes, t.distancia_promedio_km, t.tiempo_promedio_min, t.velocidad_promedio_kmh,
		   COALESCE(m_bici.n, 0) AS n_viajes_bicicleta,
		   COALESCE(m_auto.n, 0) AS n_viajes_auto,
		   COALESCE(m_micro.n, 0) AS n_viajes_micro,
		   COALESCE(m_metro.n, 0) AS n_viajes_metro,
		   COALESCE(m_pie.n, 0) AS n_viajes_pie
		 FROM totals t
		 LEFT JOIN modes m_bici ON m_bici.modoAgregado = '9'
		 LEFT JOIN modes m_auto ON m_auto.modoAgregado = '1'
		 LEFT JOIN modes m_micro ON m_micro.modoAgregado IN ('2', '3', '11', '12', '14')
		 LEFT JOIN modes m_metro ON m_metro.modoAgregado = '4'
		 LEFT JOIN modes m_pie ON m_pie.modoAgregado = '8'`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: ResumenViaje[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return (
				results[0] ?? {
					total_viajes: 0,
					distancia_promedio_km: 0,
					tiempo_promedio_min: 0,
					velocidad_promedio_kmh: 0,
					n_viajes_bicicleta: 0,
					n_viajes_auto: 0,
					n_viajes_micro: 0,
					n_viajes_metro: 0,
					n_viajes_pie: 0,
				}
			);
		} catch {
			return {
				total_viajes: 0,
				distancia_promedio_km: 0,
				tiempo_promedio_min: 0,
				velocidad_promedio_kmh: 0,
				n_viajes_bicicleta: 0,
				n_viajes_auto: 0,
				n_viajes_micro: 0,
				n_viajes_metro: 0,
				n_viajes_pie: 0,
			};
		}
	});

export const getStatsPorModo = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<ModoRow[]> => {
		const query = `
		 WITH cats AS (
		   SELECT v.viaje,
		     CASE
		       WHEN v.modoAgregado IN ('1','6','17','18', '10', '7', '5', '15')
		         THEN 'Auto'
		       WHEN v.modoAgregado IN ('2','3','11','12','13','14') THEN 'Bus'
		       WHEN v.modoAgregado IN ('4','16') THEN 'Metro/Tren'
		       WHEN v.modoAgregado IN ('8','9') THEN 'No Motorizado'
		       ELSE 'Otro'
		     END AS cat_modo,
		     d.distEuclidiana,
		     v.tiempoViaje
		   FROM viaje v
		   LEFT JOIN distancia_viaje d ON d.viaje = v.viaje
		   LEFT JOIN comuna co ON co.id = v.comunaOrigen
		   LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		   WHERE co.comuna = ?1 AND cd.comuna = ?2
		     AND v.tiempoViaje > 0 AND d.distEuclidiana > 0
		 )
		 SELECT
		   cat_modo AS modo,
		   cat_modo AS modoNombre,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje,
		   ROUND(AVG(distEuclidiana * 60.0 / tiempoViaje / 1000), 1) AS velocidad_promedio,
		   ROUND(AVG(tiempoViaje), 1) AS tiempo_promedio_min,
		   ROUND(AVG(distEuclidiana), 2) / 1000 AS distancia_promedio_km
		 FROM cats
		 GROUP BY cat_modo
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): { all(): Promise<{ results: ModoRow[] }> };
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

export const getEstadisticasViajes = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<StatsRow[]> => {
		const query = `SELECT v.modoAgregado AS modo,
		        COUNT(*) AS n_viajes,
		        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje,
		        ROUND(AVG(d.distEuclidiana * 60.0 / v.tiempoViaje), 1) AS velocidad_promedio
		 FROM viaje v
		 LEFT JOIN distancia_viaje d ON d.viaje = v.viaje
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		   AND v.tiempoViaje > 0 AND d.distEuclidiana > 0
		 GROUP BY v.modoAgregado
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): { all(): Promise<{ results: StatsRow[] }> };
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

export const getStatsPorProposito = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<PropositoRow[]> => {
		const query = `
		 SELECT
		   pa.propositoEstraus AS proposito,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 LEFT JOIN proposito_agregado pa ON pa.id = v.propositoAgregado
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		 GROUP BY v.propositoAgregado
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: PropositoRow[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

export const getStatsPorPeriodo = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<PeriodoRow[]> => {
		const query = `
		 SELECT
		   p.periodos AS periodo,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 LEFT JOIN periodo p ON p.id = v.periodo
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		 GROUP BY v.periodo
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: PeriodoRow[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

export const getStatsPorTiempoMedio = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<TiempoMedioRow[]> => {
		const query = `
		 SELECT
		   tm.tiempoMedio,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 LEFT JOIN tiempo_medio tm ON tm.id = v.tiempoMedio
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		 GROUP BY v.tiempoMedio
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: TiempoMedioRow[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});
