import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type ComunaRow = { comuna: string | null };
type ModoRow = { modoAgregado: string | null };
export type DestinoRow = { destino: string | null; total_viajes: number };

/** Lista de comunas disponibles para seleccionar como origen. */
export const getComunasList = createServerFn({ method: "GET" }).handler(
	async (): Promise<string[]> => {
		const { results } = await env.EOD2012.prepare(
			`SELECT comuna FROM comuna ORDER BY comuna`,
		).all<ComunaRow>();
		return results.map((r) => r.comuna).filter((c): c is string => !!c);
	},
);

/** Valores distintos de modoAgregado en la base de datos. */
export const getModoAgregadoValues = createServerFn({ method: "GET" }).handler(
	async (): Promise<string[]> => {
		const { results } = await env.EOD2012.prepare(
			`SELECT DISTINCT modoAgregado FROM viaje WHERE modoAgregado IS NOT NULL ORDER BY modoAgregado`,
		).all<ModoRow>();
		return results.map((r) => r.modoAgregado).filter((m): m is string => !!m);
	},
);

/** Viajes ponderados desde una comuna origen hacia cada comuna destino.
 *  Usa el factor de expansion apropiado segun el tipo de dia del viaje
 *  (factorLaboralNormal, factorSabadoNormal, etc.), lo que aproxima
 *  los viajes reales de la poblacion. */
export const getDestinosDesdeComuna = createServerFn({
	method: "POST",
})
	.inputValidator((input: { comunaOrigen: string; modos?: string[] }) => input)
	.handler(async ({ data }): Promise<DestinoRow[]> => {
		const { comunaOrigen, modos } = data;

		let modoFilter = "";
		const params: (string | number)[] = [comunaOrigen];

		if (modos && modos.length > 0) {
			const placeholders = modos.map(() => "?").join(", ");
			modoFilter = `AND v.modoAgregado IN (${placeholders})`;
			params.push(...modos);
		}

		const query = `
			SELECT
				cd.comuna AS destino,
				SUM(
					COALESCE(
						v.factorLaboralNormal,
						v.factorSabadoNormal,
						v.factorDomingoNormal,
						v.factorLaboralEstival,
						v.factorFindesemanaEstival,
						1
					)
				) AS total_viajes
			FROM viaje v
			JOIN comuna co ON co.id = v.comunaOrigen
			JOIN comuna cd ON cd.id = v.comunaDestino
			WHERE co.comuna = ?
				${modoFilter}
			GROUP BY cd.comuna
			ORDER BY total_viajes DESC
		`;

		const stmt = env.EOD2012.prepare(query);
		// biome-ignore lint/suspicious/noExplicitAny: D1PreparedStatement.bind is not in the local type stubs.
		const { results } = (await (stmt as any).bind(...params).all()) as {
			results: DestinoRow[];
		};

		return results;
	});
