import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ModoRow } from "#/lib/comparador/comparador-types";

const paramsSchema = z.object({
	origen: z.string().min(1),
	destino: z.string().min(1),
});

export const getComparadorStats = createServerFn({ method: "GET" })
	.inputValidator(paramsSchema)
	.handler(async ({ data }) => {
		const { origen, destino } = data;

		const statsQuery = `
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

		const totalQuery = `
		 SELECT COUNT(*) AS total
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 WHERE co.comuna = ?1 AND cd.comuna = ?2`;

		try {
			const [statsStmt, totalStmt] = [
				env.EOD2012.prepare(statsQuery) as ReturnType<
					typeof env.EOD2012.prepare
				> & {
					bind: (a: string, b: string) => {
						all(): Promise<{ results: ModoRow[] }>;
					};
				},
				env.EOD2012.prepare(totalQuery) as ReturnType<
					typeof env.EOD2012.prepare
				> & {
					bind: (a: string, b: string) => {
						all(): Promise<{ results: Array<{ total: number }> }>;
					};
				},
			];

			const [statsResults, totalResults] = await Promise.all([
				statsStmt.bind(origen, destino).all(),
				totalStmt.bind(origen, destino).all(),
			]);

			const statsModo = statsResults.results;
			const total = totalResults.results[0]?.total ?? 0;

			const initialStatsMap: Record<string, number> = {};
			statsModo.forEach((m) => {
				if (m.modo) {
					initialStatsMap[m.modo] = m.porcentaje;
				}
			});

			return {
				statsModo,
				total,
				initialStatsMap,
			};
		} catch (e) {
			console.error("[getComparadorStats] DB error:", e);
			return {
				statsModo: [] as ModoRow[],
				total: 0,
				initialStatsMap: {},
			};
		}
	});
